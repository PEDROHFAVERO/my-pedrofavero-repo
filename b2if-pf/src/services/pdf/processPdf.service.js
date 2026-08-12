/**
 * processPdf.service.js — Serviço de processamento de PDF via Edge Function
 *
 * ARQUITETURA CORRETA (Lei 5):
 *   Browser extrai texto (pdfjs) → Edge Function chama Gemini server-side
 *   A GEMINI_API_KEY nunca toca o browser.
 *
 * Substitui: chamada direta buscarChaveGemini() + processarPDFNoBrowser()
 * em PageCategorizador.jsx
 */
import { supabase } from '../../lib/supabase.js';
import { ProcessPDFResultSchema, validar } from '../../schemas/cliente.schema.js';

// ── Histórico de categorizações do cliente ───────────────────────────────────
/**
 * Monta um histórico compacto das categorizações já feitas pelo cliente.
 * Usado para injetar no prompt do Gemini como "memória" — assim ele replica
 * decisões anteriores em vez de categorizar do zero a cada importação.
 *
 * Algoritmo:
 *   1. Pega transações com status='categorizado' e categoria preenchida
 *   2. Normaliza a descrição: lowercase, remove valores monetários, datas e
 *      sequências numéricas longas (preserva nomes e palavras-chave)
 *   3. Agrupa por (descrição_normalizada → categoria_id), contando frequência
 *   4. Ordena por frequência decrescente e retorna os top MAX_HISTORICO
 *
 * Limite de 80 entradas: prompt já é grande (texto do PDF + taxonomia).
 * 80 pares acrescentam ~3-4KB ao payload — custo marginal mínimo.
 *
 * @param {Array} transacoes - clienteAtivo.transacoes
 * @returns {Array<{padrao: string, categoria_id: string, freq: number}>}
 */
const MAX_HISTORICO = 80;

export function montarHistoricoCategorizacoes(transacoes = []) {
  if (!transacoes?.length) return [];

  // Normaliza descrição: remove R$ valores, datas DD/MM, sequências numéricas
  // longas (ex: doc 1234567), mantém palavras e nomes
  function normalizar(desc = '') {
    return desc
      .toLowerCase()
      .replace(/r\$\s*[\d.,]+/g, '')        // remove valores monetários
      .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, '') // remove datas DD/MM ou DD/MM/AAAA
      .replace(/\b\d{5,}\b/g, '')           // remove números longos (doc, protocolo)
      .replace(/\s+/g, ' ')                 // normaliza espaços
      .trim();
  }

  // Agrupa: chave = "descricao_normalizada|categoria_id", valor = frequência
  const mapa = new Map();
  for (const t of transacoes) {
    if (t.status !== 'categorizado' || !t.categoria || !t.descricao) continue;
    const padrao = normalizar(t.descricao);
    if (!padrao || padrao.length < 3) continue;
    const chave = `${padrao}|||${t.categoria}`;
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  }

  // Ordena por frequência desc e pega top MAX_HISTORICO
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_HISTORICO)
    .map(([chave, freq]) => {
      const [padrao, categoria_id] = chave.split('|||');
      return { padrao, categoria_id, freq };
    });
}

// ── Configuração de chunking por banco ───────────────────────────────────────
// Bancos com extratos/faturas longos que excedem o limite padrão.
// CHUNK_SIZE: tamanho de cada chunk enviado ao servidor (com overlap de 500 chars).
// MAX_CHUNKS: quantos chunks processar no máximo (evita custos excessivos).
// Estratégia: processar em chunks e mesclar deduplicando por data+descrição+valor.
//
// REGRA DE CALIBRAÇÃO:
//   chunkSize ≈ (limite_timeout_55s / N_transacoes_por_char) × 0.8
//   Extratos longos (12+ páginas): chunkSize 12k-14k, maxChunks 3-4
//   Extratos médios (5-12 páginas): chunkSize 10k, maxChunks 2-3
//   Faturas simples (1-6 páginas): chunkSize 10k, maxChunks 1-2
//
// IMPORTANTE: os IDs aqui devem corresponder exatamente aos retornados por
// detectarBanco() em pdfParser.js.
const CHUNK_CONFIG = {
  // Extratos longos (muitas páginas, muitas transações)
  inter:     { chunkSize: 12000, maxChunks: 4 }, // até ~48k chars (11-17 páginas)
  bradesco:  { chunkSize:  6000, maxChunks: 3 }, // extratos Bradesco ~13k chars (10 páginas) — chunks pequenos para caber no timeout de 55s
  santander: { chunkSize: 14000, maxChunks: 3 }, // faturas Santander ~27k chars, layout 2 colunas com múltiplos cartões
  bb:        { chunkSize: 12000, maxChunks: 3 }, // extratos BB podem ser longos
  itau:      { chunkSize: 12000, maxChunks: 3 }, // extratos Itaú longos
  // Extratos/faturas médios
  nubank:        { chunkSize: 15000, maxChunks: 4 }, // extrato Nubank: texto estruturado por X/Y (~12k chars/8pág), chunk grande para caber tudo em 1 chamada; max 4 para extratos muito longos (3+ meses)
  nubank_fatura: { chunkSize: 10000, maxChunks: 3 }, // fatura Nubank: pode ter 6+ meses de parcelamentos
  sicoob:    { chunkSize: 10000, maxChunks: 2 }, // cooperativas têm extratos razoáveis
  sicredi:   { chunkSize: 10000, maxChunks: 2 },
  c6:        { chunkSize: 10000, maxChunks: 2 }, // C6 pode ter múltiplos cartões virtuais
  caixa:     { chunkSize: 10000, maxChunks: 2 },
  xp:        { chunkSize: 10000, maxChunks: 2 },
  mercadopago: { chunkSize: 10000, maxChunks: 2 },
  // Bancos com documentos geralmente curtos ou moderados
  btg:       { chunkSize: 10000, maxChunks: 2 },
  neon:      { chunkSize: 10000, maxChunks: 2 },
  safra:     { chunkSize: 10000, maxChunks: 2 },
  picpay:    { chunkSize: 10000, maxChunks: 2 },
  pagbank:   { chunkSize: 10000, maxChunks: 2 },
  // Asaas — gateway com muitas microtransações (taxas de R$0,55 a R$0,99 por cobrança)
  // Extratos longos (4+ meses): ~55KB de texto com centenas de lançamentos
  // chunkSize 13000 → ~4 chunks para cobrir todo o período sem timeout (~45s/chunk)
  asaas:     { chunkSize: 13000, maxChunks: 5 },
  // Fallback para bancos não mapeados — conservador (1 chunk)
  default:   { chunkSize: 10000, maxChunks: 1 },
};

/**
 * Divide o texto em chunks com overlap para não perder transações na junção.
 * @param {string} texto
 * @param {number} chunkSize
 * @param {number} overlap  Quantidade de chars de sobreposição entre chunks
 */
function dividirEmChunks(texto, chunkSize, overlap = 500) {
  if (texto.length <= chunkSize) return [texto];
  const chunks = [];
  let pos = 0;
  while (pos < texto.length) {
    chunks.push(texto.slice(pos, pos + chunkSize));
    pos += chunkSize - overlap;
  }
  return chunks;
}

/**
 * Mescla listas de transações removendo duplicatas exatas (mesmo data+descrição+valor).
 */
function mesclarTransacoes(listas) {
  const seen = new Set();
  const result = [];
  for (const lista of listas) {
    for (const t of lista) {
      // Normaliza a chave: ignora diferenças de ID gerado pelo servidor
      const key = `${t.data}|${String(t.descricao).trim().toLowerCase()}|${Math.abs(Number(t.valor)).toFixed(2)}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(t);
      }
    }
  }
  return result;
}

/**
 * Processa um texto de PDF via Edge Function `process-pdf`.
 * Usa SSE para receber progresso em tempo real.
 * Para bancos com textos longos, divide em chunks e mescla os resultados.
 *
 * @param {Object} params
 * @param {string}   params.textoPDF   - Texto extraído do PDF (via pdfjs no browser)
 * @param {string}   params.nomeConta  - Nome da conta/banco para esta importação
 * @param {string}   [params.banco]       - ID do banco detectado (ex: 'inter', 'bradesco')
 * @param {'extrato'|'fatura'} [params.tipoPDF] - Tipo definido pelo usuário (pula etapa de identificação por IA)
 * @param {string}   [params.nomeCliente]  - Nome do titular (melhora detecção de Fluxo Interno)
 * @param {string[]} [params.nomesFamilia] - Nomes do núcleo familiar
 * @param {function} [params.onProgress]  - Callback de progresso (msg: string) => void
 * @param {function} [params.onCancel]    - Ref de cancelamento: () => boolean
 * @returns {Promise<import('../../types/domain.js').ProcessPDFResult>}
 */
export async function processarPDFViaServidor({ textoPDF, nomeConta, banco = 'generico', tipoPDF, nomeCliente = '', nomesFamilia = [], historicoCategorizacoes = [], onProgress, onCancel }) {
  if (!textoPDF || textoPDF.trim().length < 50) {
    throw new Error(
      'Este PDF parece ser uma imagem escaneada e não pode ser lido automaticamente. ' +
      'Exporte o extrato em formato digital pelo app do banco.'
    );
  }

  // Obtém o token JWT do usuário logado para autenticar na Edge Function
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    || 'https://mioppztwrhrbnkkhuubs.supabase.co';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pb3BwenR3cmhyYm5ra2h1dWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQ0NjQsImV4cCI6MjA5MDQ4MDQ2NH0.opPC34brWzXzrTbtcXcn9Xl8ZO5WIBgkm1Fa9D6iaZU';

  const url = `${supabaseUrl}/functions/v1/process-pdf`;

  // ── Configuração de chunking baseada no banco detectado ─────────────────────
  const cfg = CHUNK_CONFIG[banco] ?? CHUNK_CONFIG.default;
  const chunks = dividirEmChunks(textoPDF, cfg.chunkSize);
  const textoFoiTruncado = chunks.length > cfg.maxChunks; // há texto além do maxChunks
  const chunksParaProcessar = chunks.slice(0, cfg.maxChunks);

  const totalChunks = chunksParaProcessar.length;
  const resultadosPorChunk = []; // lista de arrays de transações, um por chunk
  let primeiroResultado = null;

  // ── Processa cada chunk ──────────────────────────────────────────────────────
  for (let ci = 0; ci < totalChunks; ci++) {
    if (onCancel?.()) throw new Error('Processamento cancelado pelo usuário.');

    const chunksLabel = totalChunks > 1 ? ` (parte ${ci + 1}/${totalChunks})` : '';
    onProgress?.(`Conectando ao servidor de processamento${chunksLabel}…`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        textoPDF: chunksParaProcessar[ci],
        nomeConta,
        tipoPDF:  tipoPDF ?? 'extrato',
        banco,                              // permite prompts específicos no servidor
        nomeCliente:  nomeCliente || '',    // titular para detecção de Fluxo Interno
        nomesFamilia: nomesFamilia || [],   // núcleo familiar para detecção de Fluxo Interno
        historicoCategorizacoes,            // memória de categorizações anteriores deste cliente
        chunkIndex:  ci,                    // diagnóstico no servidor
        totalChunks,
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Servidor retornou erro ${res.status}: ${txt.substring(0, 200)}`);
    }

    // ── Lê SSE em tempo real ───────────────────────────────────────────────────
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';
    let resultado = null;

    while (true) {
      if (onCancel?.()) { reader.cancel(); throw new Error('Processamento cancelado pelo usuário.'); }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event: ')) continue;
        if (!line.startsWith('data: '))  continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        let evt;
        try { evt = JSON.parse(jsonStr); } catch (_) { continue; }

        if (evt.msg) {
          onProgress?.(`${evt.msg}${chunksLabel}`);
        } else if (evt.ok === true && evt.transacoes) {
          resultado = evt;
        } else if (evt.ok === false) {
          throw new Error(evt.erro || 'Erro desconhecido no servidor.');
        }
      }
    }

    // Parse defensivo do buffer final
    if (!resultado) {
      try {
        const match = buffer.match(/data:\s*(\{[\s\S]*\})/);
        if (match) resultado = JSON.parse(match[1]);
      } catch (_) { /* ignora */ }
    }

    if (!resultado) {
      if (ci === 0) throw new Error('Servidor não retornou resultado. Tente novamente.');
      // Chunks adicionais: tolerante a falha (já temos dados do primeiro)
      console.warn(`[processPdf] chunk ${ci + 1} não retornou resultado, usando dados parciais`);
      break;
    }

    // Guarda metadados do primeiro chunk (tipoDoc, compFatura, vencimento)
    if (ci === 0) primeiroResultado = resultado;
    resultadosPorChunk.push(resultado.transacoes ?? []);
  }

  const totalTransacoes = resultadosPorChunk.reduce((acc, arr) => acc + arr.length, 0);
  if (totalTransacoes === 0) {
    throw new Error('Nenhuma transação encontrada no PDF.');
  }

  // ── Mescla e deduplica transações de todos os chunks ─────────────────────────
  // mesclarTransacoes recebe um array de arrays (um por chunk) e deduplica
  // transações que aparecem na zona de overlap entre chunks.
  const transacoesMescladas = totalChunks > 1
    ? mesclarTransacoes(resultadosPorChunk)
    : (resultadosPorChunk[0] ?? []);

  // ── Aviso de importação parcial ───────────────────────────────────────────────
  // Se o texto foi truncado (mais chunks do que processamos), avisamos o usuário
  // para não confiar cegamente que todos os lançamentos foram importados.
  let aviso = undefined;
  if (textoFoiTruncado) {
    const charsIgnorados = textoPDF.length - chunksParaProcessar.reduce((acc, c) => acc + c.length, 0);
    const pctIgnorado = Math.round((charsIgnorados / textoPDF.length) * 100);
    aviso = `⚠️ PDF muito longo: apenas ${totalChunks * cfg.chunkSize} de ${textoPDF.length} caracteres foram processados (~${pctIgnorado}% ignorado). Verifique se todos os lançamentos foram importados e considere dividir o extrato em períodos menores.`;
    console.warn('[processPdf] IMPORTAÇÃO PARCIAL:', aviso);
  }

  const resultadoFinal = {
    ...primeiroResultado,
    transacoes: transacoesMescladas,
    ...(aviso ? { aviso } : {}),
  };

  // Valida a resposta com Zod antes de retornar
  return validar(ProcessPDFResultSchema, resultadoFinal, 'resposta process-pdf');
}

/**
 * Parser SSE mais robusto para o formato event/data do process-pdf.
 * Usado internamente para reprocessar chunks acumulados.
 *
 * @param {string} rawText
 * @param {function} onProgress
 * @returns {{ resultado: object|null }}
 */
export function parsearEventosSSE(rawText, onProgress) {
  let resultado = null;
  const blocos = rawText.split('\n\n');

  for (const bloco of blocos) {
    const linhas = bloco.split('\n');
    let eventType = '';
    let dataStr = '';

    for (const linha of linhas) {
      if (linha.startsWith('event: ')) eventType = linha.slice(7).trim();
      if (linha.startsWith('data: '))  dataStr   = linha.slice(6).trim();
    }

    if (!dataStr) continue;

    try {
      const evt = JSON.parse(dataStr);
      if (eventType === 'progress' || evt.msg) {
        onProgress?.(evt.msg || 'Processando…');
      } else if (eventType === 'result' || (evt.ok === true && evt.transacoes)) {
        resultado = evt;
      } else if (eventType === 'error' || evt.ok === false) {
        throw new Error(evt.erro || 'Erro no servidor.');
      }
    } catch (e) {
      if (e.message?.includes('Erro')) throw e;
      // JSON malformado — ignora
    }
  }

  return { resultado };
}
