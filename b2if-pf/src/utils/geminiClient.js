/**
 * geminiClient.js v6.0 — text: (texto puro) + streamGenerateContent (SSE)
 *
 * PROBLEMA RESOLVIDO v6:
 *   inline_data (base64) com PDFs grandes (~380k chars) → Gemini demora 240s
 *   e atinge MAX_TOKENS antes de terminar o JSON → JSON cortado/inválido.
 *
 *   CORREÇÃO: extrair texto com pdfjs-dist no browser (~9k chars) e enviar
 *   como {text: textoPDF} ao invés de {inline_data: {data: base64}}.
 *   Resultado: ~15s, sem MAX_TOKENS, sem timeout.
 *
 * FLUXO:
 *   1. buscarChaveGemini() — Edge Function get-gemini-key (<500ms)
 *   2. geminiCall() — SSE stream com text:, acumula chunks, retorna texto
 *   3. processarPDFNoBrowser(textoPDF, ...) — identificação + extração
 *
 * COMPARAÇÃO:
 *   v5 (inline_data): BB Visa Infinite 382k chars base64 → 242s → MAX_TOKENS ❌
 *   v6 (text:):       BB Visa Infinite ~9k chars texto   → ~15s → completo  ✅
 */

// ── Constantes hardcoded (fallback seguro — anon key é pública) ───────────────
const _SUPA_URL  = 'https://mioppztwrhrbnkkhuubs.supabase.co';
const _SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pb3BwenR3cmhyYm5ra2h1dWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQ0NjQsImV4cCI6MjA5MDQ4MDQ2NH0.opPC34brWzXzrTbtcXcn9Xl8ZO5WIBgkm1Fa9D6iaZU';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE  = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`;

// ── Categorias v5.0 — APENAS IDs ativos (sem oculto:true) ───────────────────
// Macro correto: 'Despesas Essenciais' (era 'Despesas Fixas' no v4.0)
const PROMPT_CATEGORIAS = `Escolha a categoria (ID exato) e o macro correto.

MACROS e suas CATEGORIAS (use os IDs exatos):

Receitas → salario, ferias, decimo_terceiro, pro_labore, dividendos, rec_investimentos, renda_extra, aluguel_rec, bonus_plr, reembolso, emprestimo_rec, restituicao_irpf, resgates
Despesas Essenciais → aluguel_prest, condominio, iptu, energia, agua, gas, internet, telefone, celular, manutencao_res, saude, plano_odonto, farmacia, consulta, academia, seguro_vida, seguro_carro, seguro_res, faculdade_mba, mensalidade_escolar, material_didatico, transp_escolar, assinaturas, anuidade, impostos, ipva, passagem, combustivel, manutencao, estacionamento, lava_jato, uber, aluguel_financ_veiculo, salario_diaria, encargos, prestador, supermercado, feira, acougue
Consumo Mensal → alimentacao_fora, personal, esporte, beleza, cosmeticos, vestuario, acessorios, lazer, streaming, viagem, clube, pets, doacoes, presente, papelaria, comemoracoes, livro_curso, outros
Dívidas → fin_cartao, emprestimo, emprestimo_part, juros_div
Investimentos → reserva, investimento, previdencia, custodia, custos_op, iof, ir, perdas
Fluxo Interno → entre_contas, saque_fisico, pgto_fatura

Retorne: "categoria": "<id_da_categoria>", "macro": "<nome_do_macro>"`;

// CAT_MACRO v5.0 — APENAS IDs ativos, macro 'Despesas Essenciais'
const CAT_MACRO = {
  // Receitas
  salario:'Receitas', ferias:'Receitas', decimo_terceiro:'Receitas', pro_labore:'Receitas',
  bonus_plr:'Receitas', dividendos:'Receitas', rec_investimentos:'Receitas',
  renda_extra:'Receitas', aluguel_rec:'Receitas', reembolso:'Receitas',
  emprestimo_rec:'Receitas', restituicao_irpf:'Receitas', resgates:'Receitas',
  // Despesas Essenciais (v5.0 — era 'Despesas Fixas')
  aluguel_prest:'Despesas Essenciais', condominio:'Despesas Essenciais', iptu:'Despesas Essenciais',
  energia:'Despesas Essenciais', agua:'Despesas Essenciais', gas:'Despesas Essenciais',
  internet:'Despesas Essenciais', telefone:'Despesas Essenciais', celular:'Despesas Essenciais',
  manutencao_res:'Despesas Essenciais',
  saude:'Despesas Essenciais', plano_odonto:'Despesas Essenciais', farmacia:'Despesas Essenciais',
  consulta:'Despesas Essenciais', academia:'Despesas Essenciais',
  seguro_vida:'Despesas Essenciais', seguro_carro:'Despesas Essenciais', seguro_res:'Despesas Essenciais',
  faculdade_mba:'Despesas Essenciais', mensalidade_escolar:'Despesas Essenciais',
  material_didatico:'Despesas Essenciais', transp_escolar:'Despesas Essenciais',
  assinaturas:'Despesas Essenciais', anuidade:'Despesas Essenciais', impostos:'Despesas Essenciais',
  ipva:'Despesas Essenciais', passagem:'Despesas Essenciais', combustivel:'Despesas Essenciais',
  manutencao:'Despesas Essenciais', estacionamento:'Despesas Essenciais',
  lava_jato:'Despesas Essenciais', uber:'Despesas Essenciais', aluguel_financ_veiculo:'Despesas Essenciais',
  salario_diaria:'Despesas Essenciais', encargos:'Despesas Essenciais', prestador:'Despesas Essenciais',
  supermercado:'Despesas Essenciais', feira:'Despesas Essenciais', acougue:'Despesas Essenciais',
  // Consumo Mensal
  alimentacao_fora:'Consumo Mensal', personal:'Consumo Mensal', esporte:'Consumo Mensal',
  beleza:'Consumo Mensal', cosmeticos:'Consumo Mensal', vestuario:'Consumo Mensal',
  acessorios:'Consumo Mensal', lazer:'Consumo Mensal', streaming:'Consumo Mensal',
  viagem:'Consumo Mensal', clube:'Consumo Mensal', pets:'Consumo Mensal',
  doacoes:'Consumo Mensal', presente:'Consumo Mensal', papelaria:'Consumo Mensal',
  comemoracoes:'Consumo Mensal', livro_curso:'Consumo Mensal', outros:'Consumo Mensal',
  // Dívidas
  fin_cartao:'Dívidas', emprestimo:'Dívidas', emprestimo_part:'Dívidas', juros_div:'Dívidas',
  // Investimentos
  reserva:'Investimentos', investimento:'Investimentos', previdencia:'Investimentos',
  custodia:'Investimentos', custos_op:'Investimentos', iof:'Investimentos',
  ir:'Investimentos', perdas:'Investimentos',
  // Fluxo Interno
  entre_contas:'Fluxo Interno', saque_fisico:'Fluxo Interno', pgto_fatura:'Fluxo Interno',
};

const MESES_PT = {
  '01':'Janeiro','02':'Fevereiro','03':'Março','04':'Abril',
  '05':'Maio','06':'Junho','07':'Julho','08':'Agosto',
  '09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro',
};

// ── buscarChaveGemini ─────────────────────────────────────────────────────────
export async function buscarChaveGemini(supabaseUrl, supabaseAnonKey) {
  const url  = `${supabaseUrl || _SUPA_URL}/functions/v1/get-gemini-key`;
  const anon = supabaseAnonKey || _SUPA_ANON;

  console.log('[geminiClient v4] buscarChaveGemini →', url);

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${anon}`,
      'apikey': anon,
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Não foi possível obter a chave Gemini (HTTP ${res.status}): ${txt.substring(0, 200)}`);
  }

  const data = await res.json();
  if (!data.key) throw new Error('Chave Gemini não retornada pelo servidor.');

  console.log('[geminiClient v4] chave obtida, length:', data.key.length);
  return data.key;
}

// ── geminiCallStream — SSE streaming para evitar timeout do browser ──────────
/**
 * Usa streamGenerateContent (SSE) em vez de generateContent.
 *
 * POR QUÊ STREAMING:
 *   generateContent não-streaming leva ~60s para extração completa.
 *   O browser corta conexões fetch() que ficam sem dados por ~60s → tela preta.
 *   streamGenerateContent envia chunks continuamente → conexão nunca fica idle.
 *
 * COMO FUNCIONA:
 *   - Endpoint: /streamGenerateContent?alt=sse&key=...
 *   - Resposta: Server-Sent Events (text/event-stream)
 *   - Cada linha "data: {...}" é um chunk JSON com parte do texto
 *   - Acumulamos todos os chunks e retornamos o texto completo
 */
async function geminiCall(textoPDF, textoParts, apiKey, label = 'call') {
  // Envia texto puro — 40x menor que base64, sem MAX_TOKENS, sem timeout
  const parts = [
    ...textoParts.map(t => ({ text: t })),
    { text: `\n\nDOCUMENTO:\n${textoPDF}` },
  ];

  console.log(`[geminiClient v6] ${label} — streaming, texto len: ${textoPDF.length}`);
  const t0 = Date.now();

  const res = await fetch(
    `${GEMINI_BASE}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
        },
      }),
    },
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini HTTP ${res.status} em ${label}: ${txt.substring(0, 300)}`);
  }

  // Lê o stream SSE e acumula o texto completo
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText    = '';
  let finishReason = 'unknown';
  let buffer      = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // Mantém a última linha incompleta no buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      try {
        const chunk = JSON.parse(jsonStr);
        const candidate = chunk?.candidates?.[0];
        if (!candidate) continue;

        const chunkText = candidate?.content?.parts?.[0]?.text ?? '';
        fullText += chunkText;

        if (candidate.finishReason && candidate.finishReason !== 'OTHER') {
          finishReason = candidate.finishReason;
        }
      } catch (_) {
        // chunk JSON malformado — ignora
      }
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[geminiClient v6] ${label} — done em ${elapsed}s | finishReason: ${finishReason} | chars: ${fullText.length}`);

  if (!fullText && finishReason !== 'STOP') {
    throw new Error(`Gemini retornou finishReason=${finishReason} sem texto em ${label}`);
  }

  return fullText;
}

// ── processarMetasMD ─────────────────────────────────────────────────────────
/**
 * Processa PDF de metas do "Meu Dinheiro" via Gemini.
 * Segue o mesmo padrão de geminiCall (SSE streaming) já validado.
 *
 * @param {string} textoPDF  - texto extraído do PDF
 * @param {string} apiKey    - chave Gemini
 * @param {Array}  categoriasCliente - clienteAtivo.categorias (completo)
 * @param {function} onProgress
 * @returns {{ ok, meses, itens }}
 *   meses: ['2026-02', '2026-03', ...]
 *   itens: [{ nomeMD, tipo, metas:{mes:valor}, mapeamento, confianca, macroSugerido, catIdSugerido }]
 */
export async function processarMetasMD(textoPDF, apiKey, categoriasCliente, onProgress) {
  if (!apiKey) throw new Error('Chave Gemini não fornecida.');
  if (!textoPDF || textoPDF.length < 50) throw new Error('Texto do PDF vazio ou muito curto.');

  const texto = textoPDF.substring(0, 15000);

  // ── Monta lista de categorias existentes para o Gemini mapear ─────────────
  const subcats = (categoriasCliente || []).filter(c => !c.isCategoria);
  const listaParaPrompt = subcats.map(c => `${c.id}|${c.nome}|${c.grupo}`).join('\n');

  // ── ETAPA 1: Parsing estruturado do PDF ───────────────────────────────────
  onProgress?.('Lendo estrutura do PDF...');

  const promptParsing = `Você receberá o texto de um relatório de metas de orçamento do aplicativo "Meu Dinheiro" (meudinheiroweb.com.br).

Extraia TODAS as linhas de META (ignore as linhas "Realizado" e "Resultado") e retorne um array JSON com este formato exato:
[
  {
    "nomeMD": "nome exato da categoria como aparece no PDF",
    "tipo": "receita" ou "despesa" ou "investimento",
    "metas": {"2026-02": 1500.00, "2026-03": 1500.00, ...}
  }
]

REGRAS:
1. Use sempre valores POSITIVOS (ignore o sinal negativo do PDF).
2. A chave de cada mês deve ser "AAAA-MM" — ex: "fev/26" → "2026-02".
3. Inclua APENAS meses com meta diferente de zero.
4. Ignore linhas de totais como "Receitas", "Despesas", "Resultado" — só linhas de categorias individuais.
5. tipo="receita" para entradas, tipo="despesa" para saídas, tipo="investimento" para investimentos/reservas.
6. Retorne APENAS o array JSON, sem nenhum texto adicional.`;

  const parseTexto = await geminiCall(texto, [promptParsing], apiKey, 'metas-parsing');

  let itensRaw;
  try {
    itensRaw = extrairJSON(parseTexto);
    if (!Array.isArray(itensRaw)) throw new Error('não é array');
  } catch (e) {
    throw new Error(`Falha ao extrair metas do PDF: ${e.message}`);
  }

  // ── ETAPA 2: Mapeamento Gemini — nomeMD → subcategoria do sistema ─────────
  onProgress?.('Mapeando categorias com Gemini...');

  const nomesMD = itensRaw.map(i => i.nomeMD);

  const promptMapeamento = `Você deve mapear cada categoria do "Meu Dinheiro" para a subcategoria mais adequada do sistema B2IF.

CATEGORIAS DO SISTEMA B2IF (formato: id|nome|macro):
${listaParaPrompt}

CATEGORIAS DO "MEU DINHEIRO" PARA MAPEAR:
${nomesMD.map((n, i) => `${i}. "${n}"`).join('\n')}

Para cada categoria, retorne um array JSON na mesma ordem:
[
  {
    "indice": 0,
    "catIdSugerido": "id_da_subcategoria_b2if ou null se não houver equivalente",
    "confianca": 0.0 a 1.0,
    "macroSugerido": "Receitas|Despesas Essenciais|Consumo Mensal|Dívidas|Investimentos|Fluxo Interno"
  }
]

REGRAS:
1. confianca >= 0.75 = mapeamento confirmado; < 0.75 = precisa revisão humana.
2. Se não houver equivalente razoável, use catIdSugerido: null.
3. macroSugerido deve sempre ser preenchido mesmo quando catIdSugerido é null.
4. Retorne APENAS o array JSON.`;

  const mapTexto = await geminiCall(texto, [promptMapeamento], apiKey, 'metas-mapeamento');

  let mapeamentos;
  try {
    mapeamentos = extrairJSON(mapTexto);
    if (!Array.isArray(mapeamentos)) throw new Error('não é array');
  } catch (e) {
    // fallback: sem mapeamento
    mapeamentos = nomesMD.map((_, i) => ({ indice: i, catIdSugerido: null, confianca: 0, macroSugerido: 'Consumo Mensal' }));
  }

  // ── ETAPA 3: Combinar resultados ──────────────────────────────────────────
  onProgress?.('Finalizando...');

  // Detectar todos os meses presentes
  const mesesSet = new Set();
  for (const item of itensRaw) {
    Object.keys(item.metas || {}).forEach(m => mesesSet.add(m));
  }
  const meses = [...mesesSet].sort();

  const mapPorIndice = {};
  for (const m of mapeamentos) mapPorIndice[m.indice] = m;

  const itens = itensRaw.map((item, i) => {
    const map = mapPorIndice[i] || { catIdSugerido: null, confianca: 0, macroSugerido: 'Consumo Mensal' };
    // Busca o nome da subcategoria sugerida
    const catObj = map.catIdSugerido
      ? subcats.find(c => c.id === map.catIdSugerido)
      : null;

    return {
      nomeMD:       item.nomeMD,
      tipo:         item.tipo || 'despesa',
      metas:        item.metas || {},
      catIdSugerido:  catObj ? map.catIdSugerido : null,
      nomeSugerido:   catObj ? catObj.nome : null,
      confianca:      typeof map.confianca === 'number' ? map.confianca : 0,
      macroSugerido:  map.macroSugerido || 'Consumo Mensal',
      // status: 'mapeado' | 'revisar' | 'novo'
      status: catObj && map.confianca >= 0.75 ? 'mapeado' : 'revisar',
    };
  });

  return { ok: true, meses, itens };
}

// ── extrairJSON ───────────────────────────────────────────────────────────────
function extrairJSON(texto) {
  const limpo = texto
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const m = limpo.match(/\[[\s\S]*\]/);
  if (m) {
    try { return JSON.parse(m[0]); } catch (_) {}
  }

  // Tenta objeto se não achou array
  const m2 = limpo.match(/\{[\s\S]*\}/);
  if (m2) {
    try { return JSON.parse(m2[0]); } catch (_) {}
  }

  throw new Error(`Gemini não retornou JSON válido. Amostra: ${limpo.substring(0, 200)}`);
}

// ── normFormato ───────────────────────────────────────────────────────────────
function normFormato(f, isFatura) {
  // Retorna IDs internos do sistema: pix | cartao_credito | cartao_debito | dinheiro | boleto | ted
  if (isFatura) return 'cartao_credito';
  const fl = (f ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (fl.includes('ted') || fl.includes('doc'))                                        return 'ted';
  if (fl.includes('pix') || fl.includes('transfer'))                                   return 'pix';
  if (fl.includes('debito') || fl.includes('debit') || fl.includes('cartao_debito'))  return 'cartao_debito';
  if (fl.includes('credito') || fl.includes('credit') || fl.includes('cartao_credito')) return 'cartao_credito';
  if (fl.includes('dinheiro') || fl.includes('especie') || fl.includes('saque'))      return 'dinheiro';
  if (fl.includes('boleto') || fl.includes('conta'))                                   return 'boleto';
  return 'pix'; // fallback
}

// ── processarPDFNoBrowser ─────────────────────────────────────────────────────
/**
 * Processa PDF diretamente no browser via Gemini API (inline_data).
 * Sem File Upload API → sem CORS 403.
 *
 * @param {string} base64 - PDF em base64
 * @param {string} apiKey - chave Gemini
 * @param {string} nomeConta
 * @param {function} onProgress
 * @returns {{ ok, tipoDoc, compFatura, vencimento, transacoes }}
 */
export async function processarPDFNoBrowser(textoPDF, apiKey, nomeConta, onProgress) {
  console.log('[geminiClient v6] === processarPDFNoBrowser ===');
  console.log('[geminiClient v6] nomeConta:', nomeConta, '| texto len:', textoPDF.length);

  if (!apiKey) throw new Error('Chave Gemini não fornecida.');
  if (!textoPDF || textoPDF.length < 50) throw new Error('Texto do PDF vazio ou muito curto. O PDF pode ser uma imagem escaneada sem texto selecionável.');

  const texto = textoPDF.substring(0, 15000); // limita a 15k chars

  // ── ETAPA 1: Identificar tipo do documento ───────────────────────────────
  onProgress?.('Identificando tipo do documento…');
  console.log('[geminiClient v6] Etapa 1: identificação');

  const promptId = `Analise este documento financeiro brasileiro e retorne APENAS um objeto JSON (sem markdown):
{"tipo":"fatura","vencimento":"YYYY-MM-DD","fechamento":"YYYY-MM-DD","anoDocumento":2026}
ou
{"tipo":"extrato","vencimento":null,"fechamento":null,"anoDocumento":2026}

Regras:
- tipo: "fatura" se for fatura de cartão de crédito; "extrato" se for extrato bancário
- vencimento: data de vencimento da fatura (só para faturas)
- fechamento: data de fechamento/corte (só para faturas)
- anoDocumento: ano principal dos lançamentos do documento`;

  const idTexto = await geminiCall(texto, [promptId], apiKey, 'identificacao');

  let tipoInfo;
  try {
    tipoInfo = extrairJSON(idTexto);
  } catch (_) {
    // fallback
    tipoInfo = { tipo: 'extrato', vencimento: null, fechamento: null, anoDocumento: new Date().getFullYear() };
  }

  const isFatura  = tipoInfo.tipo === 'fatura';
  const tipoDoc   = isFatura ? 'fatura' : 'extrato';
  const anoDoc    = tipoInfo.anoDocumento || new Date().getFullYear();
  const vencStr   = tipoInfo.vencimento ?? '';
  const fechStr   = tipoInfo.fechamento ?? '';

  // Competência da fatura = mês do VENCIMENTO (não do fechamento)
  // Ex: fatura que vence em março → competência 2026-03, mesmo que compras sejam de fevereiro
  let compFatura = '';
  if (isFatura) {
    const dataRef = vencStr || fechStr; // vencimento tem prioridade
    if (dataRef) {
      const parts = dataRef.split('-');
      if (parts.length >= 2) {
        compFatura = `${parts[0]}-${parts[1]}`;
      }
    }
  }

  console.log(`[geminiClient v6] tipo: ${tipoDoc} | venc: ${vencStr} | fecha: ${fechStr} | comp: ${compFatura} | ano: ${anoDoc}`);

  // ── ETAPA 2: Extrair lançamentos ─────────────────────────────────────────
  onProgress?.('Extraindo lançamentos…');
  console.log('[geminiClient v6] Etapa 2: extração');

  // Mês de vencimento da fatura (para regra de ano das parcelas)
  const vencMes = vencStr ? Number(vencStr.split('-')[1]) : 0;

  let promptPDF;
  if (isFatura) {
    promptPDF = `Extraia TODOS os lançamentos desta fatura de cartão de crédito.
Vencimento da fatura: ${vencStr || 'desconhecido'} | Ano principal: ${anoDoc}

REGRAS CRÍTICAS:
1. VALOR: sempre NEGATIVO (despesa). Ex: -45.90, -1200.00
   EXCEÇÃO: estornos/créditos são POSITIVOS.
2. DATA DE COMPRA (campo "data"): use a data real em que a compra foi feita (YYYY-MM-DD).
   - Se a data na fatura mostra apenas dia/mês (ex: "05/12"), determine o ano correto:
     * Se o mês da compra <= mês do vencimento (${vencMes}): use ano ${anoDoc}
     * Se o mês da compra >  mês do vencimento (${vencMes}): use ano ${anoDoc - 1}
     * Exemplo: fatura vence em março (mês 3). Compra em "05/12" → dezembro > março → ano ${anoDoc - 1} → data "${anoDoc - 1}-12-05"
     * Exemplo: fatura vence em março (mês 3). Compra em "15/02" → fevereiro <= março → ano ${anoDoc} → data "${anoDoc}-02-15"
3. FORMATO: sempre "Crédito" para faturas.
4. DESCRICAO: copie EXATAMENTE como aparece na fatura.
5. ${PROMPT_CATEGORIAS}
6. PARCELAS: se houver "3/12" → parcelaAtual=3, parcelaTotal=12. Sem parcela → 1/1.

FORMATO DO ARRAY (retorne APENAS o array JSON, sem nenhum texto adicional):
[
  {"descricao":"iFood *Restaurante X","valor":-45.90,"data":"${anoDoc}-02-05","categoria":"alimentacao_fora","macro":"Consumo Mensal","formato":"Crédito","parcelaAtual":1,"parcelaTotal":1},
  {"descricao":"LOJA XYZ PARC 3/12","valor":-150.00,"data":"${anoDoc - 1}-12-05","categoria":"outros","macro":"Consumo Mensal","formato":"Crédito","parcelaAtual":3,"parcelaTotal":12}
]`;
  } else {
    promptPDF = `Extraia TODOS os lançamentos deste extrato bancário.

REGRAS CRÍTICAS:
1. VALOR: NEGATIVO para débitos/saídas, POSITIVO para créditos/entradas.
2. DATA: use a data de cada lançamento (formato YYYY-MM-DD). Ano=${anoDoc}.
3. FORMATO DE PAGAMENTO — use EXATAMENTE uma dessas strings:
   - "Pix" para PIX, TED, DOC, transferências
   - "Débito" para compras com cartão de débito
   - "Dinheiro" para saques e depósitos em espécie
   - "Boleto" para pagamentos de boleto/conta
   - "Pix" como padrão para débitos/créditos sem classificação clara
4. DESCRICAO: copie a descrição EXATAMENTE como aparece no extrato.
5. ${PROMPT_CATEGORIAS}
6. PARCELAS: parcelaAtual=1, parcelaTotal=1 para todas (extrato não tem parcelamento).

FORMATO DO ARRAY (retorne APENAS o array JSON, sem nenhum texto adicional):
[
  {"descricao":"iFood *Restaurante X","valor":-45.90,"data":"${anoDoc}-03-05","categoria":"alimentacao_fora","macro":"Consumo Mensal","formato":"Débito","parcelaAtual":1,"parcelaTotal":1},
  {"descricao":"Salario Empresa X","valor":5000.00,"data":"${anoDoc}-03-05","categoria":"salario","macro":"Receitas","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}
]`;
  }

  const parseTexto = await geminiCall(texto, [promptPDF], apiKey, 'extracao');

  let lista;
  try {
    lista = extrairJSON(parseTexto);
    if (!Array.isArray(lista)) throw new Error('JSON não é um array');
  } catch (e) {
    throw new Error(`Falha ao extrair transações do PDF: ${e.message}`);
  }

  console.log(`[geminiClient v6] extraídas: ${lista.length} transações`);

  if (!lista || lista.length === 0) {
    throw new Error(
      isFatura
        ? 'Nenhuma transação encontrada. Verifique se o PDF é uma fatura com texto selecionável.'
        : 'Nenhuma transação encontrada. Verifique se o PDF é um extrato com texto selecionável.'
    );
  }

  // ── ETAPA 3: Pós-processar ───────────────────────────────────────────────
  onProgress?.('Processando lançamentos…');

  const hoje = new Date().toISOString().substring(0, 10);

  const transacoes = lista
    .filter(t => t?.descricao && t?.valor != null)
    .map(t => {
      const valorRaw   = Number(t.valor);
      const tipo       = valorRaw < 0 ? 'despesa' : 'receita';
      const valor      = Math.abs(valorRaw);
      let data = String(t.data ?? hoje).substring(0, 10);
      const pAtual     = Number(t.parcelaAtual ?? 1) || 1;
      const pTotal     = Number(t.parcelaTotal ?? 1) || 1;
      const pRestantes = Math.max(1, pTotal - pAtual + 1);
      const formato    = normFormato(t.formato ?? '', isFatura);
      const cat        = String(t.categoria ?? 'outros');
      const macro      = String(t.macro ?? CAT_MACRO[cat] ?? 'Consumo Mensal');

      // Segurança extra: se data de compra for posterior ao vencimento,
      // o Gemini errou o ano → subtrai 1 ano
      if (isFatura && vencStr && data > vencStr) {
        const [dAno, dMes, dDia] = data.split('-');
        data = `${Number(dAno) - 1}-${dMes}-${dDia}`;
      }

      // Competência = sempre o mês do vencimento da fatura (não o mês da compra)
      let competencia;
      if (isFatura && compFatura) {
        competencia = compFatura;
      } else {
        const ps = data.split('-');
        competencia = `${ps[0]}-${ps[1]}`;
      }

      const [cAno, cMes] = competencia.split('-');
      const periodoLabel = `${MESES_PT[cMes] ?? cMes} ${cAno}`;

      const parcelamento = pTotal > 1
        ? `Parcela ${pAtual}/${pTotal}`
        : null;

      return {
        id:                crypto.randomUUID(),
        descricao:         String(t.descricao).trim(),
        valor:             tipo === 'despesa' ? -valor : valor,
        data,
        competencia,
        periodoLabel,
        categoria:         cat,
        grupoImportado:    macro,
        macro,
        formato,
        tipo,
        parcelaAtual:      pAtual,
        parcelaTotal:      pTotal,
        parcelasRestantes: pRestantes,
        parcelamento,
        conta:             nomeConta ?? 'Importado',
        status:            'pendente',
      };
    });

  console.log(`[geminiClient v6] ✅ sucesso: ${transacoes.length} transações | tipoDoc: ${tipoDoc}`);

  return {
    ok:         true,
    tipoDoc,
    compFatura,
    vencimento: vencStr,
    transacoes,
  };
}
