/**
 * whatsapp-webhook v9.9 — Fix: registra lançamentos explícitos mesmo no modo Café Consigo Mesmo
 *
 * O bot agora é um assistente financeiro de verdade no WhatsApp:
 *  - Mantém histórico de conversa (últimas 12 mensagens)
 *  - Uma única chamada ao Gemini por mensagem
 *  - Gemini decide: salvar transação OU conversar/aconselhar
 *  - Contexto financeiro real do cliente (gastos, planejamento, saldo)
 *  - Suporte a texto, áudio, imagem, documento
 *
 * Bugs corrigidos em relação a v8.8:
 *  - PROMPT_CATEGORIAS, CATS, FMT, salvarTransacao, parsearESalvar definidos
 *  - geminiChamar definida (separada de geminiGerar para multimodal)
 *  - processarTexto, processarAudio, processarImagem passam sessionId
 *  - Áudio e Imagem usam processarComIA (conversacional) após extração
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Constantes de ambiente ────────────────────────────────────────────────────

const META_VERIFY_TOKEN    = Deno.env.get('META_VERIFY_TOKEN')         ?? 'b2if_verify_2025';
const META_ACCESS_TOKEN    = Deno.env.get('META_ACCESS_TOKEN')         ?? '';
const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID')      ?? '1038876762647039';
const META_API_VERSION     = 'v20.0';
const GEMINI_API_KEY       = Deno.env.get('GEMINI_API_KEY')            ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const GEMINI_MODEL   = 'gemini-2.5-flash';
const GEMINI_BASE    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`;
const GEMINI_TIMEOUT = 20_000;  // 20s — conversacional precisa de um pouco mais
const UPLOAD_TIMEOUT = 25_000;
const MAX_IDADE_HORAS = 6;
const CAFE_TIMEOUT_MIN = 30;  // Café expira após 30min de inatividade

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Café Consigo Mesmo — keywords de detecção ─────────────────────────────────
const CAFE_TRIGGERS = [
  'café consigo mesmo', 'cafe consigo mesmo',
  'quero um café comigo', 'quero um cafe comigo',
  'café comigo mesmo', 'cafe comigo mesmo',
  'modo café', 'modo cafe',
  'bate papo financeiro', 'bater papo financeiro',
  'reflexão financeira', 'reflexao financeira',
];

const CAFE_ENCERRAR = [
  'encerrar café', 'encerrar cafe', 'sair do café', 'sair do cafe',
  'fechar café', 'fechar cafe', 'obrigado café', 'obrigado cafe',
  'até mais café', 'ate mais cafe', 'tchau café', 'tchau cafe',
];

console.log(`[v9.9] META:${!!META_ACCESS_TOKEN} GEMINI:${!!GEMINI_API_KEY} SUPA:${!!SUPABASE_URL}`);

// ── Categorias válidas ────────────────────────────────────────────────────────

// IDs das categorias padrão B2IF v5.0 (espelha categorias.js — apenas IDs ativos, sem aliases ocultos)
const CATS = new Set([
  // Receitas
  'salario','ferias','decimo_terceiro','pro_labore',
  'dividendos','rec_investimentos','renda_extra','aluguel_rec',
  'bonus_plr','reembolso','emprestimo_rec','restituicao_irpf','resgates',
  // Despesas Essenciais — Moradia
  'aluguel_prest','condominio','iptu','energia','agua','gas','internet','telefone','celular','manutencao_res',
  // Despesas Essenciais — Saúde
  'saude','plano_odonto','farmacia','consulta','academia',
  // Despesas Essenciais — Seguros
  'seguro_vida','seguro_carro','seguro_res',
  // Despesas Essenciais — Educação
  'faculdade_mba','mensalidade_escolar','material_didatico','transp_escolar',
  // Despesas Essenciais — Custos Profissionais e Impostos
  'assinaturas','anuidade','impostos',
  // Despesas Essenciais — Transporte
  'ipva','passagem','combustivel','manutencao','estacionamento','lava_jato','uber',
  // Despesas Essenciais — Funcionários
  'salario_diaria','encargos','prestador',
  // Despesas Essenciais — Alimentação
  'supermercado','feira','acougue',
  // Consumo Mensal — Alimentação
  'alimentacao_fora',
  // Consumo Mensal — Bem-estar
  'personal','esporte','beleza','cosmeticos','vestuario','acessorios',
  // Consumo Mensal — Lazer
  'lazer','streaming','viagem','clube',
  // Consumo Mensal — Pets
  'pets',
  // Consumo Mensal — Doações
  'doacoes',
  // Consumo Mensal — Livre
  'presente','papelaria','comemoracoes','livro_curso','outros',
  // Dívidas
  'fin_cartao','emprestimo','emprestimo_part','juros_div',
  // Investimentos
  'reserva','investimento','previdencia','custodia','custos_op','iof','ir','perdas',
  // Fluxo Interno
  'entre_contas','saque_fisico','pgto_fatura',
]);

// FMT: normaliza qualquer variante para o padrão PT do sistema (igual à planilha)
const FMT: Record<string, string> = {
  // Pix
  pix: 'Pix', pix_enviado: 'Pix', pix_recebido: 'Pix',
  transferencia: 'Pix', transferência: 'Pix', ted: 'Pix', doc: 'Pix',
  // Crédito
  credito: 'Crédito', crédito: 'Crédito', credit: 'Crédito',
  cartao: 'Crédito', cartao_credito: 'Crédito',
  'cartão crédito': 'Crédito', 'cartao crédito': 'Crédito',
  'cartão de crédito': 'Crédito',
  // Débito
  debito: 'Débito', débito: 'Débito', cartao_debito: 'Débito',
  'cartão débito': 'Débito', 'cartão de débito': 'Débito',
  // Dinheiro
  dinheiro: 'Dinheiro', especie: 'Dinheiro', espécie: 'Dinheiro', cash: 'Dinheiro', saque: 'Dinheiro',
  // Boleto
  boleto: 'Boleto',
  // Valores já no padrão PT (passthrough)
  'Pix': 'Pix', 'Crédito': 'Crédito', 'Débito': 'Débito', 'Dinheiro': 'Dinheiro', 'Boleto': 'Boleto',
};

// Prompt de categorias e macros — espelha categorias.js v5.0
const PROMPT_CATEGORIAS = `Escolha a categoria e o macro mais adequados.

MACROS e suas CATEGORIAS (use os IDs exatos, sem aspas extras):

Receitas → salario, ferias, decimo_terceiro, pro_labore, dividendos, rec_investimentos, renda_extra, aluguel_rec, bonus_plr, reembolso, emprestimo_rec, restituicao_irpf, resgates
Despesas Essenciais → aluguel_prest, condominio, iptu, energia, agua, gas, internet, telefone, celular, manutencao_res, saude, plano_odonto, farmacia, consulta, academia, seguro_vida, seguro_carro, seguro_res, faculdade_mba, mensalidade_escolar, material_didatico, transp_escolar, assinaturas, anuidade, impostos, ipva, passagem, combustivel, manutencao, estacionamento, lava_jato, uber, salario_diaria, encargos, prestador, supermercado, feira, acougue
Consumo Mensal → alimentacao_fora, personal, esporte, beleza, cosmeticos, vestuario, acessorios, lazer, streaming, viagem, clube, pets, doacoes, presente, papelaria, comemoracoes, livro_curso, outros
Dívidas → fin_cartao, emprestimo, emprestimo_part, juros_div
Investimentos → reserva, investimento, previdencia, custodia, custos_op, iof, ir, perdas
Fluxo Interno → entre_contas, saque_fisico, pgto_fatura

REGRA DE SINAL:
- Receitas → valor POSITIVO
- Despesas Essenciais, Consumo Mensal, Dívidas, Investimentos → valor NEGATIVO
- Fluxo Interno (entre_contas, saque_fisico, pgto_fatura) → valor pode ser positivo ou negativo conforme o extrato

Retorne: "categoria": "<id_da_categoria>", "macro": "<nome_do_macro>"`;


// Mapa macro PT → id interno (para normalização) — v5.0
const MACRO_MAP: Record<string, string> = {
  'receitas': 'Receitas',
  'despesas essenciais': 'Despesas Essenciais',
  'despesas fixas': 'Despesas Essenciais',   // alias legado → v5.0
  'consumo mensal': 'Consumo Mensal',
  'dívidas': 'Dívidas', 'dividas': 'Dívidas',
  'investimentos': 'Investimentos',
  'fluxo interno': 'Fluxo Interno',
};

// Mapa categoria → macro v5.0 (para inferir macro quando não vem do Gemini)
const CAT_MACRO: Record<string, string> = {
  // Receitas
  salario: 'Receitas', ferias: 'Receitas', decimo_terceiro: 'Receitas', pro_labore: 'Receitas',
  dividendos: 'Receitas', rec_investimentos: 'Receitas', renda_extra: 'Receitas', aluguel_rec: 'Receitas',
  bonus_plr: 'Receitas', reembolso: 'Receitas', emprestimo_rec: 'Receitas',
  restituicao_irpf: 'Receitas', resgates: 'Receitas',
  // Despesas Essenciais — Moradia
  aluguel_prest: 'Despesas Essenciais', condominio: 'Despesas Essenciais', iptu: 'Despesas Essenciais',
  energia: 'Despesas Essenciais', agua: 'Despesas Essenciais', gas: 'Despesas Essenciais',
  internet: 'Despesas Essenciais', telefone: 'Despesas Essenciais', celular: 'Despesas Essenciais',
  manutencao_res: 'Despesas Essenciais',
  // Despesas Essenciais — Saúde
  saude: 'Despesas Essenciais', plano_odonto: 'Despesas Essenciais', farmacia: 'Despesas Essenciais',
  consulta: 'Despesas Essenciais', academia: 'Despesas Essenciais',
  // Despesas Essenciais — Seguros
  seguro_vida: 'Despesas Essenciais', seguro_carro: 'Despesas Essenciais', seguro_res: 'Despesas Essenciais',
  // Despesas Essenciais — Educação
  faculdade_mba: 'Despesas Essenciais', mensalidade_escolar: 'Despesas Essenciais',
  material_didatico: 'Despesas Essenciais', transp_escolar: 'Despesas Essenciais',
  // Despesas Essenciais — Custos Profissionais e Impostos
  assinaturas: 'Despesas Essenciais', anuidade: 'Despesas Essenciais', impostos: 'Despesas Essenciais',
  // Despesas Essenciais — Transporte
  ipva: 'Despesas Essenciais', passagem: 'Despesas Essenciais', combustivel: 'Despesas Essenciais',
  manutencao: 'Despesas Essenciais', estacionamento: 'Despesas Essenciais',
  lava_jato: 'Despesas Essenciais', uber: 'Despesas Essenciais',
  // Despesas Essenciais — Funcionários
  salario_diaria: 'Despesas Essenciais', encargos: 'Despesas Essenciais', prestador: 'Despesas Essenciais',
  // Despesas Essenciais — Alimentação
  supermercado: 'Despesas Essenciais', feira: 'Despesas Essenciais', acougue: 'Despesas Essenciais',
  // Consumo Mensal
  alimentacao_fora: 'Consumo Mensal',
  personal: 'Consumo Mensal', esporte: 'Consumo Mensal', beleza: 'Consumo Mensal',
  cosmeticos: 'Consumo Mensal', vestuario: 'Consumo Mensal', acessorios: 'Consumo Mensal',
  lazer: 'Consumo Mensal', streaming: 'Consumo Mensal', viagem: 'Consumo Mensal', clube: 'Consumo Mensal',
  pets: 'Consumo Mensal',
  doacoes: 'Consumo Mensal',
  presente: 'Consumo Mensal', papelaria: 'Consumo Mensal', comemoracoes: 'Consumo Mensal',
  livro_curso: 'Consumo Mensal', outros: 'Consumo Mensal',
  // Dívidas
  fin_cartao: 'Dívidas', emprestimo: 'Dívidas', emprestimo_part: 'Dívidas', juros_div: 'Dívidas',
  // Investimentos
  reserva: 'Investimentos', investimento: 'Investimentos', previdencia: 'Investimentos',
  custodia: 'Investimentos', custos_op: 'Investimentos', iof: 'Investimentos',
  ir: 'Investimentos', perdas: 'Investimentos',
  // Fluxo Interno
  entre_contas: 'Fluxo Interno', saque_fisico: 'Fluxo Interno', pgto_fatura: 'Fluxo Interno',
};

// ── Utilitários gerais ────────────────────────────────────────────────────────

function fetchT(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

function jsonR(data: unknown, s = 200): Response {
  return new Response(JSON.stringify(data), {
    status: s,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normTel(raw: string): string {
  const n = String(raw).replace(/\D/g, '');
  if (n.startsWith('55') && n.length >= 12) return n;
  if (n.length >= 10 && n.length <= 11) return '55' + n;
  if (n.length === 12 && !n.startsWith('55')) return '55' + n;
  return n;
}

function telVariantes(tel: string): string[] {
  const vars = new Set<string>([tel]);
  if (tel.startsWith('55') && tel.length === 13) {
    // 13 dígitos (55+DDD+9+8dig): gera versão sem o 9 → 12 dígitos
    // Ex: 5511987654321 → 551187654321
    vars.add('55' + tel.substring(2, 4) + tel.substring(5));
  } else if (tel.startsWith('55') && tel.length === 12) {
    // 12 dígitos (55+DDD+8dig): gera versão com o 9 extra → 13 dígitos
    // Ex: 559898149285 → 5598981494285 (para celulares do interior: MA, PA, AM etc.)
    // O 9 é inserido logo após o DDD, antes dos 8 dígitos do número
    vars.add('55' + tel.substring(2, 4) + '9' + tel.substring(4));
  }
  return [...vars];
}

function fmtVal(v: number): string {
  const a = Math.abs(Number(v));
  const p = a.toFixed(2).split('.');
  return 'R$ ' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1];
}

function fmtData(d: string | null | undefined): string {
  try {
    const s = String(d ?? new Date().toISOString()).substring(0, 10);
    const [a, m, dd] = s.split('-');
    return `${dd}/${m}/${a}`;
  } catch { return String(d ?? ''); }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── WhatsApp — enviar mensagem ────────────────────────────────────────────────

async function enviarMsg(tel: string, texto: string): Promise<void> {
  if (!tel || !META_ACCESS_TOKEN) return;
  try {
    const r = await fetchT(
      `https://graph.facebook.com/${META_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: tel,
          type: 'text',
          text: { preview_url: false, body: texto },
        }),
      },
      10_000
    );
    if (!r.ok) {
      const err = await r.text();
      console.error('[enviarMsg] HTTP', r.status, err.substring(0, 200));
      if (r.status === 401 || err.includes('OAuthException'))
        console.error('[enviarMsg] TOKEN EXPIRADO — renovar META_ACCESS_TOKEN');
    }
  } catch (e: any) { console.error('[enviarMsg]', e?.message); }
}

// ── WhatsApp — resolver URL de mídia ─────────────────────────────────────────

async function resolverMediaUrl(mediaId: string): Promise<string | null> {
  try {
    const r = await fetchT(
      `https://graph.facebook.com/${META_API_VERSION}/${mediaId}`,
      { headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` } },
      10_000
    );
    if (!r.ok) { console.error('[media] HTTP', r.status); return null; }
    const d = await r.json();
    return d?.url ?? null;
  } catch (e: any) { console.error('[media]', e?.message); return null; }
}

// ── WhatsApp — baixar conteúdo de mídia ──────────────────────────────────────

async function baixarMedia(url: string): Promise<Uint8Array | null> {
  try {
    const r = await fetchT(url, {
      headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` },
    }, 20_000);
    if (!r.ok) { console.error('[baixar] HTTP', r.status); return null; }
    const buf = await r.arrayBuffer();
    return new Uint8Array(buf);
  } catch (e: any) { console.error('[baixar]', e?.message); return null; }
}

// ── Gemini — upload de arquivo (File API) ────────────────────────────────────

async function uploadGeminiFile(
  dados: Uint8Array,
  mimeType: string,
  nome: string
): Promise<string | null> {
  try {
    const initR = await fetchT(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(dados.length),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: nome } }),
      },
      10_000
    );
    if (!initR.ok) {
      console.error('[upload] init HTTP', initR.status, await initR.text().catch(() => ''));
      return null;
    }
    const uploadUrl = initR.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) { console.error('[upload] sem upload URL'); return null; }

    const uploadR = await fetchT(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Length': String(dados.length),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: dados,
    }, UPLOAD_TIMEOUT);
    if (!uploadR.ok) {
      console.error('[upload] upload HTTP', uploadR.status, await uploadR.text().catch(() => ''));
      return null;
    }
    const fileInfo = await uploadR.json();
    const uri  = fileInfo?.file?.uri  ?? null;
    const name = fileInfo?.file?.name ?? null;
    if (!uri) { console.error('[upload] sem URI no retorno'); return null; }

    if (name) {
      for (let i = 0; i < 10; i++) {
        await sleep(1500);
        try {
          const stR = await fetchT(
            `https://generativelanguage.googleapis.com/v1beta/${name}?key=${GEMINI_API_KEY}`,
            {}, 8_000
          );
          if (stR.ok) {
            const st = await stR.json();
            if (st?.state === 'ACTIVE') break;
            if (st?.state === 'FAILED') { console.error('[upload] FAILED'); return null; }
          }
        } catch { /* continua polling */ }
      }
    }

    console.log('[upload] ok uri=', uri.substring(0, 50));
    return uri;
  } catch (e: any) { console.error('[upload]', e?.message); return null; }
}

// ── Gemini — chamada conversacional (com system_instruction + history) ────────
// Usada pelo cérebro central processarComIA

async function geminiChamar(payload: {
  system_instruction: any;
  contents: any[];
  generationConfig?: any;
}): Promise<string | null> {
  try {
    const body = {
      system_instruction: payload.system_instruction,
      contents: payload.contents,
      generationConfig: payload.generationConfig ?? {
        temperature: 1.0,
        maxOutputTokens: 512,
        thinkingConfig: { thinkingBudget: -1 },
      },
    };
    const r = await fetchT(
      `${GEMINI_BASE}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      GEMINI_TIMEOUT
    );
    if (!r.ok) {
      const t = await r.text();
      console.error('[geminiChamar] HTTP', r.status, t.substring(0, 300));
      return null;
    }
    const d = await r.json();
    const reason = d?.candidates?.[0]?.finishReason ?? '';
    if (reason && reason !== 'STOP') console.warn('[geminiChamar] finishReason:', reason);
    const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    return txt || null;
  } catch (e: any) { console.error('[geminiChamar]', e?.message); return null; }
}

// ── Gemini — extração PDF via SSE streaming (sem timeout fixo) ───────────────
// Usa streamGenerateContent?alt=sse para evitar timeout em PDFs grandes (4+ págs)
// SSE envia chunks contínuos → sem idle timeout → funciona para extratos do BB

async function geminiGerarPDF(parts: any[]): Promise<{ data: any[] | null; truncated: boolean }> {
  try {
    const r = await fetch(
      `${GEMINI_BASE}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 65536,
            thinkingConfig: { thinkingBudget: 1024 },  // CRÍTICO: cap fixo → sem runaway thinking, mas modelo consegue parsear parcelamentos
          },
        }),
      }
    );
    if (!r.ok) {
      const t = await r.text();
      console.error('[geminiGerarPDF] HTTP', r.status, t.substring(0, 300));
      return { data: null, truncated: false };
    }

    // Lê SSE acumulando todos os chunks
    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    let fullText = '';
    let buf = '';
    let truncated = false;  // Bug #1: flag para MAX_TOKENS

    outer: while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const obj = JSON.parse(raw);
          const cands = obj && obj.candidates;
          if (cands && cands[0] && cands[0].content && cands[0].content.parts) {
            const ps = cands[0].content.parts;
            for (let j = 0; j < ps.length; j++) {
              if (ps[j] && ps[j].text) fullText += ps[j].text;
            }
          }
          const fin = cands && cands[0] && cands[0].finishReason;
          if (fin && fin !== 'STOP' && fin !== 'OTHER' && fin !== '') {
            console.warn('[geminiGerarPDF] finishReason:', fin);
            if (fin === 'MAX_TOKENS') truncated = true;  // Bug #1: detecta truncamento
          }
        } catch (_e) { /* chunk malformado — ignora */ }
      }
    }

    console.log('[geminiGerarPDF] SSE completo, chars:', fullText.length, 'truncated:', truncated);
    if (!fullText) { console.warn('[geminiGerarPDF] resposta vazia'); return { data: null, truncated: false }; }
    console.log('[geminiGerarPDF] amostra:', fullText.substring(0, 300));

    // Remove markdown se presente
    const cleaned = fullText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    // Encontra o maior array JSON válido no texto
    let best: any[] | null = null;
    let depth = 0;
    let start = -1;
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '[') {
        if (depth === 0) start = i;
        depth++;
      } else if (cleaned[i] === ']') {
        depth--;
        if (depth === 0 && start >= 0) {
          const candidate = cleaned.substring(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (!best || parsed.length > best.length) best = parsed;
            }
          } catch (_e) { /* tenta próximo */ }
          start = -1;
        }
      }
    }

    if (best) {
      console.log('[geminiGerarPDF] array ok, itens:', best.length);
      return { data: best, truncated };
    }
    console.warn('[geminiGerarPDF] sem array JSON válido, amostra:', cleaned.substring(0, 300));
    return { data: null, truncated };
  } catch (e: any) { console.error('[geminiGerarPDF]', e && e.message); return { data: null, truncated: false }; }
}

// ── Gemini — extração PDF retornando texto bruto (para metadados) ─────────────
// Usa SSE para evitar timeout de 15s do generateContent

async function geminiGerarPDFRaw(fileUri: string, promptText: string): Promise<string | null> {
  try {
    const r = await fetch(
      `${GEMINI_BASE}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: promptText },
            { file_data: { mime_type: 'application/pdf', file_uri: fileUri } },
          ]}],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
            thinkingConfig: { thinkingBudget: 512 },  // cap fixo para extração de metadados
          },
        }),
      }
    );
    if (!r.ok) { console.error('[geminiGerarPDFRaw] HTTP', r.status); return null; }

    const reader = r.body!.getReader();
    const dec = new TextDecoder();
    let fullText = '';
    let buf = '';

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const obj = JSON.parse(raw);
          const cands = obj && obj.candidates;
          if (cands && cands[0] && cands[0].content && cands[0].content.parts) {
            const ps = cands[0].content.parts;
            for (let j = 0; j < ps.length; j++) {
              if (ps[j] && ps[j].text) fullText += ps[j].text;
            }
          }
        } catch (_e) { /* ignora */ }
      }
    }

    console.log('[geminiGerarPDFRaw] SSE completo, chars:', fullText.length);
    console.log('[geminiGerarPDFRaw] resposta:', fullText.substring(0, 200));
    return fullText.trim() || null;
  } catch (e: any) { console.error('[geminiGerarPDFRaw]', e && e.message); return null; }
}

// ── Gemini — extração multimodal (áudio/imagem) ───────────────────────────────
// Usada quando precisamos passar file_data ou inline_data

async function geminiGerar(parts: any[]): Promise<any> {
  try {
    const r = await fetchT(
      `${GEMINI_BASE}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingBudget: -1 },
          },
        }),
      },
      GEMINI_TIMEOUT
    );
    if (!r.ok) {
      const t = await r.text();
      console.error('[geminiGerar] HTTP', r.status, t.substring(0, 300));
      return null;
    }
    const d = await r.json();
    const reason = d?.candidates?.[0]?.finishReason ?? '';
    if (reason && reason !== 'STOP') console.warn('[geminiGerar] finishReason:', reason);
    const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!txt || txt === 'null') return null;
    const clean = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    try {
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object' && parsed.descricao !== undefined) return parsed;
      console.warn('[geminiGerar] JSON inesperado:', clean.substring(0, 100));
      return null;
    } catch {
      console.warn('[geminiGerar] não-JSON:', clean.substring(0, 100));
      return null;
    }
  } catch (e: any) { console.error('[geminiGerar]', e?.message); return null; }
}

// ── Contexto financeiro do cliente ────────────────────────────────────────────

async function buscarContextoFinanceiro(clienteId: string): Promise<{
  nomeCliente: string;
  totalDespesasMes: number;
  totalReceitasMes: number;
  saldoMes: number;
  topCategorias: { cat: string; total: number }[];
  planejamentoCategorias: { cat: string; projetado: number; realizado: number }[];
  qtdTransacoesMes: number;
  ultimasTransacoes: { descricao: string; valor: number; tipo: string; data: string }[];
  contasAPagar: { nome: string; valor: number; diaVencimento: number; categoriaId: string; pago: boolean; diasParaVencer: number }[];
  totalBotMes: number;
  margensPorCategoria: { cat: string; previsto: number; realizadoBot: number; margem: number }[];
}> {
  const vazio = {
    nomeCliente: '', totalDespesasMes: 0, totalReceitasMes: 0, saldoMes: 0,
    topCategorias: [], planejamentoCategorias: [], qtdTransacoesMes: 0, ultimasTransacoes: [],
    contasAPagar: [], totalBotMes: 0, margensPorCategoria: [],
  };
  try {
    const { data: cli, error } = await db
      .from('clientes').select('nome, dados').eq('id', clienteId).maybeSingle();
    if (error || !cli) return vazio;

    const dados       = cli.dados ?? {};
    const anoAtivo    = String(dados.anoAtivo ?? new Date().getFullYear());
    const mesAtualN   = new Date().getMonth();         // 0-based
    const anoAtualN   = new Date().getFullYear();
    const mesStr      = String(mesAtualN + 1).padStart(2, '0');
    const competencia = `${anoAtualN}-${mesStr}`;

    // Bot lê transacoesBot (rascunhos comportamentais) para consciência do cliente.
    // transacoes (extrato oficial) é usado apenas no Planejador/Categorizador.
    const txBot: any[] = (dados.transacoesBot ?? []).filter(
      (t: any) => String(t.competencia ?? '').startsWith(competencia)
    );
    // Para contexto do bot também usamos transacoes oficiais do mês (somente leitura)
    // para dar ao Gemini a visão completa do que já foi conciliado
    const txOficial: any[] = (dados.transacoes ?? []).filter(
      (t: any) => String(t.competencia ?? '').startsWith(competencia)
    );
    // Merge para contexto: oficial + bot (sem duplicatas por id)
    const idsOficiais = new Set(txOficial.map((t: any) => t.id));
    const txMes: any[] = [...txOficial, ...txBot.filter((t: any) => !idsOficiais.has(t.id))];

    const totalDespesasMes = txMes.filter((t: any) => t.tipo === 'despesa')
      .reduce((s: number, t: any) => s + Math.abs(Number(t.valor)), 0);
    const totalReceitasMes = txMes.filter((t: any) => t.tipo === 'receita')
      .reduce((s: number, t: any) => s + Math.abs(Number(t.valor)), 0);

    const porCat: Record<string, number> = {};
    txMes.filter((t: any) => t.tipo === 'despesa').forEach((t: any) => {
      const c = String(t.categoria ?? 'outros');
      porCat[c] = (porCat[c] ?? 0) + Math.abs(Number(t.valor));
    });
    const topCategorias = Object.entries(porCat)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([cat, total]) => ({ cat, total }));

    const planMes = dados.planejamento?.[anoAtivo]?.[mesAtualN] ?? {};
    const planejamentoCategorias = Object.entries(porCat)
      .filter(([cat]) => planMes[cat]?.projetado > 0)
      .map(([cat, realizado]) => ({
        cat, realizado,
        projetado: Number(planMes[cat]?.projetado ?? 0),
      }))
      .filter(p => p.projetado > 0);

    const ultimasTransacoes = [...txMes]
      .sort((a: any, b: any) =>
        String(b.criadoEm ?? b.data).localeCompare(String(a.criadoEm ?? a.data)))
      .slice(0, 5)
      .map((t: any) => ({
        descricao: String(t.descricao ?? ''),
        valor:     Math.abs(Number(t.valor)),
        tipo:      String(t.tipo ?? 'despesa'),
        data:      String(t.data ?? ''),
      }));

    // ── Contas a Pagar ────────────────────────────────────────────────────────
    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const contasAPagarRaw: any[] = (dados.contasAPagar ?? []).filter((c: any) => c.ativo !== false);

    // Uma conta está "paga este mês" se existir transação oficial no mês com a mesma categoriaId
    const catsPagasOficial = new Set(txOficial.filter((t: any) => t.tipo === 'despesa').map((t: any) => t.categoria));

    const contasAPagar = contasAPagarRaw.map((c: any) => {
      const diaVenc = Number(c.diaVencimento ?? 1);
      const diasParaVencer = diaVenc >= diaHoje ? diaVenc - diaHoje : (new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaVenc).getTime() - hoje.getTime()) / 86400000;
      const pago = catsPagasOficial.has(c.categoriaId);
      return {
        nome: String(c.nome ?? ''),
        valor: Number(c.valor ?? 0),
        diaVencimento: diaVenc,
        categoriaId: String(c.categoriaId ?? ''),
        pago,
        diasParaVencer: Math.round(diasParaVencer),
      };
    });

    // ── Totais do bot no mês ──────────────────────────────────────────────────
    const totalBotMes = txBot
      .filter((t: any) => t.tipo === 'despesa')
      .reduce((s: number, t: any) => s + Math.abs(Number(t.valor)), 0);

    // ── Margens por categoria (previsto - realizado_bot) ──────────────────────
    const porCatBot: Record<string, number> = {};
    txBot.filter((t: any) => t.tipo === 'despesa').forEach((t: any) => {
      const c = String(t.categoria ?? 'outros');
      porCatBot[c] = (porCatBot[c] ?? 0) + Math.abs(Number(t.valor));
    });

    const margensPorCategoria = Object.entries(planMes)
      .filter(([, v]: [string, any]) => Number(v?.projetado ?? 0) > 0)
      .map(([cat, v]: [string, any]) => ({
        cat,
        previsto: Number(v?.projetado ?? 0),
        realizadoBot: porCatBot[cat] ?? 0,
        margem: Number(v?.projetado ?? 0) - (porCatBot[cat] ?? 0),
      }))
      .sort((a, b) => a.margem - b.margem); // mais críticas primeiro

    return {
      nomeCliente: String(cli.nome ?? ''),
      totalDespesasMes, totalReceitasMes,
      saldoMes: totalReceitasMes - totalDespesasMes,
      topCategorias, planejamentoCategorias,
      qtdTransacoesMes: txMes.length, ultimasTransacoes,
      contasAPagar, totalBotMes, margensPorCategoria,
    };
  } catch (e: any) {
    console.error('[contexto]', e?.message);
    return vazio;
  }
}

// ── Histórico de conversa ─────────────────────────────────────────────────────

async function buscarHistorico(sessionId: string): Promise<{ role: string; text: string }[]> {
  try {
    const { data, error } = await db
      .from('bot_messages')
      .select('de, conteudo, criado_em')
      .eq('session_id', sessionId)
      .order('criado_em', { ascending: false })
      .limit(12);
    if (error || !data) return [];
    return data.reverse().map((m: any) => ({
      role: m.de === 'bot' ? 'model' : 'user',
      text: String(m.conteudo ?? ''),
    }));
  } catch (e: any) { console.error('[historico]', e?.message); return []; }
}

// ── Salvar resposta do bot no histórico ───────────────────────────────────────

async function salvarMensagemBot(sessionId: string, texto: string): Promise<void> {
  try {
    await db.from('bot_messages').insert({
      session_id: sessionId,
      de: 'bot', tipo: 'text',
      conteudo: texto, lida: true,
    });
  } catch (e: any) { console.error('[salvarBot]', e?.message); }
}

// ── Montar string de contexto financeiro ─────────────────────────────────────

function montarContextoStr(ctx: Awaited<ReturnType<typeof buscarContextoFinanceiro>>): string {
  const mes = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const linhas: string[] = [`Dados financeiros de ${mes}:`];

  // Receitas e despesas oficiais (extrato importado)
  if (ctx.totalDespesasMes > 0 || ctx.totalReceitasMes > 0) {
    if (ctx.totalReceitasMes > 0)
      linhas.push(`- Receitas do mês (extrato): ${fmtVal(ctx.totalReceitasMes)}`);
    linhas.push(`- Despesas do mês (extrato): ${fmtVal(ctx.totalDespesasMes)}`);
    linhas.push(`- Saldo do mês: ${fmtVal(ctx.saldoMes)}`);
  }

  // Gastos registrados pelo bot (rascunhos comportamentais)
  if (ctx.totalBotMes > 0)
    linhas.push(`- Gastos registrados pelo cliente no WhatsApp este mês (rascunho): ${fmtVal(ctx.totalBotMes)}`);

  if (ctx.totalDespesasMes === 0 && ctx.totalBotMes === 0)
    linhas.push('- Nenhuma transação registrada neste mês ainda.');

  // Maiores gastos por categoria (bot)
  if (ctx.topCategorias.length > 0)
    linhas.push(`- Maiores gastos registrados: ${ctx.topCategorias.map(c =>
      `${c.cat} ${fmtVal(c.total)}`).join(' | ')}`);

  // Margens por categoria (previsto - bot)
  if (ctx.margensPorCategoria.length > 0) {
    linhas.push('- Margem restante por categoria (previsto - registrado no WhatsApp):');
    ctx.margensPorCategoria.slice(0, 6).forEach(m => {
      const status = m.margem < 0 ? '(estourou)' : m.margem < m.previsto * 0.2 ? '(quase no limite)' : '';
      linhas.push(`  ${m.cat}: ${fmtVal(m.margem)} de margem (previsto ${fmtVal(m.previsto)}) ${status}`);
    });
  }

  // Contas a pagar
  if (ctx.contasAPagar.length > 0) {
    const pendentes = ctx.contasAPagar.filter(c => !c.pago);
    const vencendoEm3 = pendentes.filter(c => c.diasParaVencer >= 0 && c.diasParaVencer <= 3);
    if (vencendoEm3.length > 0) {
      linhas.push(`- ATENÇÃO — Contas vencendo em até 3 dias: ${vencendoEm3.map(c =>
        `${c.nome} ${fmtVal(c.valor)} (dia ${c.diaVencimento})`).join(' | ')}`);
    }
    if (pendentes.length > 0) {
      linhas.push(`- Contas a pagar pendentes: ${pendentes.map(c =>
        `${c.nome} ${fmtVal(c.valor)} (dia ${c.diaVencimento}${c.pago ? ' — pago' : ''})`).join(' | ')}`);
    }
  }

  // Últimas transações registradas pelo cliente
  if (ctx.ultimasTransacoes.length > 0)
    linhas.push(`- Últimas transações: ${ctx.ultimasTransacoes.map(t =>
      `${t.descricao} ${fmtVal(t.valor)} ${t.tipo === 'receita' ? 'entrada' : 'saída'}`).join(' | ')}`);

  return linhas.join('\n');
}

// ── Salvar transação no banco ─────────────────────────────────────────────────

async function salvarTransacao(
  clienteId: string,
  tel: string,
  t: any,
  nomeRemetente?: string
): Promise<any | null> {
  try {
    const desc = String(t.descricao ?? '').trim();
    if (!desc) { console.warn('[salvar] sem descricao'); return null; }

    const valorRaw = Number(t.valor ?? 0);
    if (!isFinite(valorRaw) || valorRaw === 0) {
      console.warn('[salvar] valor inválido:', t.valor);
      return null;
    }

    const tipo  = valorRaw < 0 ? 'despesa' : 'receita';
    const valor = Math.abs(valorRaw);

    const hoje        = new Date().toISOString().substring(0, 10);
    const data        = String(t.data ?? hoje).substring(0, 10);
    const [ano, mes]  = data.split('-');
    const competencia = `${ano}-${mes}`;

    // Meses em PT
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const periodoLabel = `${meses[Number(mes) - 1] ?? ''} ${ano}`;

    // Categoria
    const catRaw = String(t.categoria ?? 'outros').toLowerCase().trim();
    const categoria = CATS.has(catRaw) ? catRaw : 'outros';

    // Conta (nome do remetente ou fallback)
    const contaNome = nomeRemetente?.trim() || 'Geral';

    // Formato de pagamento — padrão PT (Pix/Crédito/Débito/Dinheiro)
    const fmtRaw = String(t.conta ?? t.formato ?? 'Dinheiro').trim();
    const formato = FMT[fmtRaw] ?? FMT[fmtRaw.toLowerCase()] ?? 'Dinheiro';

    // Macro — derivado da categoria se Gemini não retornar
    const macroRaw = String(t.macro ?? '').trim();
    const macro = MACRO_MAP[macroRaw.toLowerCase()] ?? macroRaw ?? CAT_MACRO[categoria] ?? 'Consumo Mensal';

    const novaT = {
      id:            crypto.randomUUID(),
      descricao:     desc,
      valor:         tipo === 'despesa' ? -valor : valor,
      data,
      competencia,
      periodoLabel,
      categoria,
      macro,
      subcategoria:  String(t.subcategoria ?? ''),
      conta:         contaNome,
      formato,
      tipo,
      status:        'rascunho',    // lançamentos do bot são rascunhos — NÃO entram no Planejador
      origem:        'whatsapp',
      fonte:         tel,
      criadoEm:      new Date().toISOString(),
      parcelaAtual:  Number(t.parcelaAtual  ?? 1),
      parcelaTotal:  Number(t.parcelaTotal  ?? 1),
    };

    // Grava em transacoesBot (rascunhos comportamentais) — separado de transacoes (extrato oficial)
    const { data: salvo, error } = await db.rpc('append_transacao_bot', {
      p_cliente_id: clienteId,
      p_transacao:  novaT,
    });

    if (error) {
      console.error('[salvar] RPC error:', error.message, '| desc:', desc, '| valor:', valor);
      return null;
    }

    console.log('[salvar] ok (bot):', desc, fmtVal(valor), tipo);
    return salvo ?? novaT;
  } catch (e: any) {
    console.error('[salvar]', e?.message);
    return null;
  }
}

// ── Fallback de confirmação (sem IA) ─────────────────────────────────────────

function confirmarFallback(salvas: any[]): string {
  if (salvas.length === 0) return '✅ Registrado no sistema B2IF!';
  if (salvas.length === 1) {
    const s = salvas[0];
    const icon = s.tipo === 'despesa' ? '📤' : '📥';
    return `${icon} ${s.tipo === 'despesa' ? 'Saída' : 'Entrada'} registrada!\n` +
           `${s.descricao} — ${fmtVal(Math.abs(s.valor))} — ${fmtData(s.data)}\n` +
           `Já aparece no sistema B2IF ✅`;
  }
  const linhas = salvas.map(s =>
    `${s.tipo === 'despesa' ? '📤' : '📥'} ${s.descricao} — ${fmtVal(Math.abs(s.valor))}`);
  return `✅ ${salvas.length} transações registradas!\n\n${linhas.join('\n')}\n\nJá aparecem no sistema B2IF ✅`;
}

// ── Parsear resultado multimodal e salvar ─────────────────────────────────────

async function parsearESalvar(
  clienteId: string,
  sessionId: string,
  tel: string,
  parsed: any,
  nomeRemetente?: string,
  mensagemOriginal?: string,
): Promise<{ ok: boolean }> {
  try {
    // Tentar salvar transações extraídas pela análise multimodal
    const lista: any[] = Array.isArray(parsed) ? parsed
      : parsed && typeof parsed === 'object' && parsed.descricao ? [parsed]
      : [];

    const salvas: any[] = [];
    for (const t of lista) {
      if (!t?.descricao || t?.valor == null) continue;
      const s = await salvarTransacao(clienteId, tel, t, nomeRemetente);
      if (s) salvas.push(s);
    }

    // Agora gera resposta conversacional com IA usando as transações salvas como contexto
    const contextoMidia = salvas.length > 0
      ? `Transações identificadas e já registradas: ${salvas.map(s =>
          `${s.descricao} ${fmtVal(Math.abs(s.valor))} (${s.tipo})`).join(', ')}`
      : 'Nenhuma transação financeira identificada na mídia enviada.';

    const msgParaIA = mensagemOriginal
      ? `${mensagemOriginal}\n\n[Sistema: ${contextoMidia}]`
      : `[Sistema: ${contextoMidia}]`;

    const { resposta } = await processarComIA(
      clienteId, sessionId, tel, msgParaIA, nomeRemetente, undefined, salvas
    );

    await enviarMsg(tel, resposta);
    await salvarMensagemBot(sessionId, resposta);
    return { ok: true };
  } catch (e: any) {
    console.error('[parsearESalvar]', e?.message);
    return { ok: false };
  }
}

// ── CÉREBRO CENTRAL: IA conversacional com histórico ─────────────────────────

async function processarComIA(
  clienteId: string,
  sessionId: string,
  tel: string,
  mensagem: string,
  nomeRemetente?: string,
  extraParts?: any[],
  transacoesPre?: any[],  // transações já salvas (mídia processada antes)
  modoCafe?: boolean,     // true = modo Café Consigo Mesmo
): Promise<{ ok: boolean; resposta: string; salvas: any[] }> {
  try {
    const hoje = new Date().toISOString().substring(0, 10);

    const [historico, ctx] = await Promise.all([
      buscarHistorico(sessionId),
      buscarContextoFinanceiro(clienteId),
    ]);

    const ctxStr = montarContextoStr(ctx);
    const quem   = nomeRemetente ?? ctx.nomeCliente ?? 'cliente';

    // Se já tem transações pré-salvas (de áudio/imagem), só pede resposta humanizada
    const modoPuro = transacoesPre !== undefined;

    // ── System prompt: normal ou Café Consigo Mesmo ───────────────────────────
    const systemPrompt = modoCafe
      ? `Você é o B2IF em modo *Café Consigo Mesmo* com ${ctx.nomeCliente || quem}.
Hoje é ${hoje}.

Este é um momento de reflexão financeira pessoal e livre — sem roteiro fixo, sem sequência obrigatória.
O cliente escolheu pausar e conversar abertamente sobre sua vida financeira, como num café entre amigos.

PERSONALIDADE NESTE MODO:
- Acolhedor, curioso e humano — não robótico nem apressado
- Tom de conversa genuína: faz perguntas abertas, escuta, aprofunda
- Pode usar mais de 5 linhas quando faz sentido (este é um modo reflexivo)
- Emoji com leveza, não excessivo
- Não precisa registrar transações aqui — foco é reflexão e insight
- Se o cliente mencionar algo para registrar, anote gentilmente mas volte à reflexão

ROTEIRO LIVRE — sugestões de temas (adapte ao que surgir naturalmente):
- Como o cliente se sente em relação ao dinheiro este mês?
- Há algo que está pesando nas finanças — uma decisão difícil, uma dívida, um sonho adiado?
- O que ele/ela mais valoriza gastar? E o que sente que desperdiça?
- Qual seria o próximo passo financeiro mais importante agora?
- Como está o equilíbrio entre viver bem hoje e construir para o futuro?

DADOS DISPONÍVEIS — use com naturalidade, não como relatório:
${ctxStr}

REGRAS:
- Retorne SEMPRE texto puro (sem JSON)
- Faça UMA pergunta reflexiva por vez — não bombardeie
- Quando sentir que o cliente chegou a uma conclusão ou insight, celebre e aprofunde
- Se o cliente quiser sair do modo café, diga: "Até a próxima! Estou aqui quando quiser conversar. ☕"
- Responda sempre em português brasileiro
- Não mencione que é IA`
      : `Você é o B2IF, assistente financeiro pessoal de ${ctx.nomeCliente || quem}.
Hoje é ${hoje}. Remetente desta mensagem: ${quem}.

Você é um assessor financeiro completo no WhatsApp — não um chatbot robótico.
Você conversa, aconselha, responde dúvidas financeiras e ajuda em decisões.

PERSONALIDADE:
- Tom amigável, direto e brasileiro — como um amigo assessor de confiança
- Nunca robótico. Cada resposta é única, adequada ao contexto
- Usa emoji com moderação (1-2 por mensagem, apenas quando natural)
- Lembra o histórico da conversa e usa para responder com coerência
- Chama o cliente pelo nome quando fizer sentido

CAPACIDADES:
- Registrar gastos e receitas que o cliente informa
- Responder: como estou no mês? onde estou gastando mais? quanto tenho de margem?
- Aconselhar em decisões: parcelar ou pagar à vista? vale a pena essa compra?
- Calcular: juros compostos, parcelas, comparações, percentuais
- Analisar: extratos, comprovantes, notas fiscais (quando enviados como imagem/áudio)
- Conversar sobre qualquer tópico financeiro pessoal

${modoPuro ? `MODO: As transações já foram registradas pelo sistema. Sua tarefa é APENAS confirmar de forma humanizada e adicionar 1-2 observações contextuais usando os dados abaixo.` : `REGRAS DE DECISÃO — retorne SEMPRE um JSON válido com esta estrutura:
{
  "acao": "salvar" | "conversar",
  "transacoes": [{"descricao":"string","valor":-25.00,"data":"YYYY-MM-DD","categoria":"string","conta":"dinheiro"}],
  "resposta": "texto que será enviado ao cliente"
}
(campo transacoes só presente quando acao=salvar)

Use acao=salvar quando o cliente claramente informar um gasto ou receita.
- valor NEGATIVO = despesa, POSITIVO = receita
- Categorias válidas: ${PROMPT_CATEGORIAS}
- Inclua na "resposta" confirmação humanizada + 1 comentário contextual

Use acao=conversar para:
- Perguntas ("como estou?", "ultrapassei o limite?", "vale parcelar?")
- Continuação da conversa ("e o uber?", "quanto falta pra fechar o mês?")
- Dúvidas financeiras, conselhos, cálculos
- Qualquer mensagem que NÃO seja claramente um novo lançamento`}

AO RESPONDER:
- Use os dados financeiros reais fornecidos — NUNCA invente valores
- Para decisões financeiras: considere saldo disponível e planejamento
- Seja direto e prático, sem enrolação
- Máximo 4-5 linhas (WhatsApp não é e-mail)
- NÃO use asteriscos para negrito — texto simples + emoji
- Responda sempre em português brasileiro
- Não mencione que é IA ou que foi programado
${modoPuro ? '- Retorne texto puro (não JSON)' : '- Retorne SEMPRE JSON válido, sem markdown ao redor'}`;

    // Monta turns do histórico de conversa
    const turns: any[] = [];

    if (historico.length === 0) {
      const parts: any[] = [{ text: `[Contexto financeiro]\n${ctxStr}\n\nMensagem: ${mensagem}` }];
      if (extraParts) parts.push(...extraParts);
      turns.push({ role: 'user', parts });
    } else {
      for (const h of historico) {
        turns.push({ role: h.role, parts: [{ text: h.text }] });
      }
      const parts: any[] = [{ text: `[Contexto atualizado]\n${ctxStr}\n\nMensagem: ${mensagem}` }];
      if (extraParts) parts.push(...extraParts);
      turns.push({ role: 'user', parts });
    }

    const txt = await geminiChamar({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: turns,
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: 600,
        thinkingConfig: { thinkingBudget: -1 },
      },
    });

    if (!txt) throw new Error('Gemini retornou vazio');

    // Modo puro (mídia pré-processada) ou modo café: resposta é texto direto, não JSON
    if (modoPuro || modoCafe) {
      const resposta = txt.trim();
      return { ok: true, resposta, salvas: transacoesPre ?? [] };
    }

    // Modo normal: Gemini retorna JSON
    const clean = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    let decisao: any = null;
    try {
      decisao = JSON.parse(clean);
    } catch {
      // JSON.parse falhou — tentar extrair campo "resposta" com regex antes de usar texto raw
      console.warn('[ia] parse falhou, tentando regex:', clean.substring(0, 120));
      const mResposta = clean.match(/"resposta"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      if (mResposta) {
        // Conseguiu extrair a resposta do JSON malformado
        const respostaExtraida = mResposta[1]
          .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
        // Tentar extrair acao também para salvar se necessário
        const mAcao = clean.match(/"acao"\s*:\s*"(\w+)"/);
        const acaoExtraida = mAcao?.[1] ?? 'conversar';
        console.warn('[ia] resposta extraída via regex, acao:', acaoExtraida);
        if (acaoExtraida === 'salvar') {
          // Tenta extrair transacoes também
          try {
            const mTrans = clean.match(/"transacoes"\s*:\s*(\[.*?\])/s);
            if (mTrans) {
              const transacoes = JSON.parse(mTrans[1]);
              decisao = { acao: 'salvar', transacoes, resposta: respostaExtraida };
            } else {
              return { ok: true, resposta: respostaExtraida, salvas: [] };
            }
          } catch {
            return { ok: true, resposta: respostaExtraida, salvas: [] };
          }
        } else {
          return { ok: true, resposta: respostaExtraida, salvas: [] };
        }
      } else {
        // Nenhum JSON reconhecível — se parece texto normal, usa como resposta
        // Mas NUNCA enviar JSON bruto ao cliente
        const pareceTxto = !clean.startsWith('{') && !clean.startsWith('[');
        if (pareceTxto) {
          console.warn('[ia] texto puro (conversa direta):', clean.substring(0, 120));
          return { ok: true, resposta: clean, salvas: [] };
        }
        // É JSON mas malformado e sem "resposta" extraível — fallback seguro
        console.error('[ia] JSON inválido sem resposta extraível, usando fallback');
        return { ok: true, resposta: 'Pode repetir? Não entendi bem.', salvas: [] };
      }
    }

    console.log('[ia] acao:', decisao?.acao, '| resposta preview:', String(decisao?.resposta ?? '').substring(0, 80));

    const resposta = String(decisao?.resposta ?? '').trim();

    if (decisao?.acao === 'salvar' && Array.isArray(decisao?.transacoes)) {
      const salvas: any[] = [];
      for (const t of decisao.transacoes) {
        if (!t?.descricao || t?.valor == null) continue;
        const s = await salvarTransacao(clienteId, tel, t, nomeRemetente);
        if (s) salvas.push(s);
        else console.error('[ia] falha ao salvar:', t.descricao);
      }
      return {
        ok: true,
        resposta: resposta || confirmarFallback(salvas),
        salvas,
      };
    }

    return {
      ok: true,
      resposta: resposta || 'Pode me dar mais detalhes?',
      salvas: [],
    };

  } catch (e: any) {
    console.error('[processarComIA]', e?.message);
    return {
      ok: false,
      resposta: '⚠️ Tive um problema interno. Tente novamente em instantes.',
      salvas: [],
    };
  }
}

// ── Processar TEXTO ───────────────────────────────────────────────────────────

async function processarTexto(
  clienteId: string,
  sessionId: string,
  tel: string,
  texto: string,
  nomeRemetente?: string,
  sessaoCafe?: { cafe_estado?: boolean; cafe_inicio?: string | null },
): Promise<{ ok: boolean; erro?: string }> {
  try {
    // ── Café Consigo Mesmo ────────────────────────────────────────────────────
    const emCafe = sessaoCafe ? cafeAtivo(sessaoCafe) : false;

    // Verificar se quer encerrar o café
    if (emCafe && isEncerrarCafe(texto)) {
      await desativarCafe(sessionId);
      const despedida = `Que bom ter conversado com você! ☕\nSempre que quiser um café consigo mesmo, é só falar.`;
      await enviarMsg(tel, despedida);
      await salvarMensagemBot(sessionId, despedida);
      console.log('[cafe] encerrado para sessao', sessionId.substring(0, 8));
      return { ok: true };
    }

    // Verificar se é um novo trigger de café (e ainda não está no modo)
    if (!emCafe && isTriggerCafe(texto)) {
      await ativarCafe(sessionId);
      const nomeCliente = nomeRemetente?.split(' ')[0] ?? 'você';
      // Busca contexto para personalizar a abertura
      const ctx = await buscarContextoFinanceiro(clienteId);
      const ctxStr = montarContextoStr(ctx);
      // Primeiro turno do café: abertura acolhedora + primeira pergunta reflexiva
      const abertura = await processarComIA(
        clienteId, sessionId, tel,
        `[Sistema: O cliente digitou "${texto}" para iniciar o modo Café Consigo Mesmo. Faça uma abertura acolhedora, breve (2-3 linhas), e inicie com UMA pergunta reflexiva sobre como ele/ela está se sentindo em relação às finanças este mês. Use o contexto financeiro disponível para personalizar.]`,
        nomeRemetente, undefined, undefined, true
      );
      console.log('[cafe] iniciado para', nomeCliente, '| sessao', sessionId.substring(0, 8));
      await enviarMsg(tel, abertura.resposta);
      await salvarMensagemBot(sessionId, abertura.resposta);
      return { ok: true };
    }

    // Modo café em andamento: renovar timestamp e processar
    // Se a mensagem parece um lançamento explícito (valor + descrição), usa fluxo normal
    // para que acao=salvar funcione — mas passa hint de que está no café
    if (emCafe) {
      await renovarCafe(sessionId);
      // Detecta padrão de lançamento explícito: número + palavra no texto
      const pareceLancamento = /\d+[,.]?\d*/.test(texto) && texto.trim().split(/\s+/).length >= 2;
      if (pareceLancamento) {
        // Processa como fluxo normal (JSON com acao=salvar/conversar)
        // mas adiciona hint para manter tom café na resposta
        const textoComHint = `${texto}\n[Dica: Estamos no modo Café Consigo Mesmo — após registrar, continue a reflexão de forma acolhedora.]`;
        const { ok, resposta, salvas } = await processarComIA(
          clienteId, sessionId, tel, textoComHint, nomeRemetente
        );
        console.log('[cafe+lanc] salvas:', salvas.length, '| resposta:', resposta.substring(0, 80));
        await enviarMsg(tel, resposta);
        await salvarMensagemBot(sessionId, resposta);
        return { ok };
      }
      // Mensagem sem valor numérico: modo café puro (texto livre, sem JSON)
      const { ok, resposta } = await processarComIA(
        clienteId, sessionId, tel, texto, nomeRemetente, undefined, undefined, true
      );
      console.log('[cafe] resposta:', resposta.substring(0, 80));
      await enviarMsg(tel, resposta);
      await salvarMensagemBot(sessionId, resposta);
      return { ok };
    }

    // ── Fluxo normal ─────────────────────────────────────────────────────────
    const { ok, resposta } = await processarComIA(
      clienteId, sessionId, tel, texto, nomeRemetente
    );
    console.log('[texto] resposta:', resposta.substring(0, 80));
    await enviarMsg(tel, resposta);
    await salvarMensagemBot(sessionId, resposta);
    return { ok };
  } catch (e: any) {
    console.error('[processarTexto]', e?.message);
    return { ok: false, erro: e?.message };
  }
}

// ── Processar ÁUDIO ───────────────────────────────────────────────────────────

async function processarAudio(
  clienteId: string,
  sessionId: string,
  tel: string,
  wmsg: any,
  nomeRemetente?: string
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const audioObj = wmsg.audio ?? wmsg.voice ?? {};
    const mediaId  = String(audioObj.id ?? '');
    const mimeType = String(audioObj.mime_type ?? 'audio/ogg; codecs=opus');
    const hoje     = new Date().toISOString().substring(0, 10);

    if (!mediaId) {
      await enviarMsg(tel, '⚠️ Não consegui processar o áudio. Tente novamente.');
      return { ok: true };
    }

    await enviarMsg(tel, '🎙️ Processando seu áudio...');

    const mediaUrl = await resolverMediaUrl(mediaId);
    if (!mediaUrl) {
      await enviarMsg(tel, '⚠️ Não consegui acessar o áudio. Tente novamente.');
      return { ok: true };
    }

    const dados = await baixarMedia(mediaUrl);
    if (!dados || dados.length === 0) {
      await enviarMsg(tel, '⚠️ Erro ao baixar o áudio. Tente novamente.');
      return { ok: true };
    }
    console.log('[audio] downloaded', dados.length, 'bytes');

    const mimeNorm = mimeType.includes('ogg')  ? 'audio/ogg'
      : mimeType.includes('mp4')               ? 'audio/mp4'
      : mimeType.includes('m4a')               ? 'audio/m4a'
      : mimeType.includes('mpeg') || mimeType.includes('mp3') ? 'audio/mpeg'
      : mimeType.includes('wav')               ? 'audio/wav'
      : mimeType.includes('flac')              ? 'audio/flac'
      : 'audio/ogg';

    const fileUri = await uploadGeminiFile(dados, mimeNorm, `audio_${Date.now()}`);
    if (!fileUri) {
      await enviarMsg(tel, '⚠️ Não consegui processar o áudio com IA. Tente enviar como texto.');
      return { ok: true };
    }

    // Extração inicial: áudio → JSON de transações
    const promptAudio = `Você é um assistente financeiro brasileiro.
Ouça este áudio e extraia TODAS as transações financeiras mencionadas.
Data de hoje: ${hoje}

Se houver transações, responda SOMENTE com JSON (sem markdown):
[{"descricao":"Uber","valor":-25.00,"data":"${hoje}","categoria":"uber","conta":"dinheiro"}]

Regras: valor NEGATIVO=despesa, POSITIVO=receita.
Se não houver transação financeira clara, responda apenas: null
Categorias válidas: ${PROMPT_CATEGORIAS}`;

    const parsed = await geminiGerar([
      { text: promptAudio },
      { file_data: { mime_type: mimeNorm, file_uri: fileUri } },
    ]);
    console.log('[audio] extracted:', JSON.stringify(parsed)?.substring(0, 100));

    // Transcrever o áudio também para contexto conversacional
    const promptTranscrever = `Transcreva exatamente o que foi dito neste áudio em português.
Responda apenas com o texto transcrito, sem comentários adicionais.`;

    const transcricao = await geminiGerar([
      { text: promptTranscrever },
      { file_data: { mime_type: mimeNorm, file_uri: fileUri } },
    ]);
    const textoAudio = transcricao
      ? `[Áudio transcrito]: ${JSON.stringify(transcricao).replace(/[[\]"]/g, '')}`
      : '[Áudio enviado]';

    // parsearESalvar agora usa processarComIA internamente para resposta humanizada
    const { ok } = await parsearESalvar(
      clienteId, sessionId, tel, parsed, nomeRemetente, textoAudio
    );
    return { ok };
  } catch (e: any) {
    console.error('[processarAudio]', e?.message);
    return { ok: false, erro: e?.message };
  }
}

// ── Processar IMAGEM ──────────────────────────────────────────────────────────

async function processarImagem(
  clienteId: string,
  sessionId: string,
  tel: string,
  wmsg: any,
  nomeRemetente?: string
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const imgObj   = wmsg.image ?? {};
    const mediaId  = String(imgObj.id ?? '');
    const mimeType = String(imgObj.mime_type ?? 'image/jpeg');
    const caption  = String(imgObj.caption ?? wmsg.caption ?? '').trim();
    const hoje     = new Date().toISOString().substring(0, 10);

    if (!mediaId) {
      await enviarMsg(tel, '⚠️ Não consegui acessar a imagem. Tente novamente.');
      return { ok: true };
    }

    await enviarMsg(tel, '📸 Analisando imagem...');

    const mediaUrl = await resolverMediaUrl(mediaId);
    if (!mediaUrl) {
      await enviarMsg(tel, '⚠️ Não consegui acessar a imagem. Tente novamente.');
      return { ok: true };
    }

    const dados = await baixarMedia(mediaUrl);
    if (!dados || dados.length === 0) {
      await enviarMsg(tel, '⚠️ Erro ao baixar a imagem. Tente novamente.');
      return { ok: true };
    }
    console.log('[imagem] downloaded', dados.length, 'bytes');

    // Converter para base64
    let base64 = '';
    const CHUNK = 8192;
    for (let i = 0; i < dados.length; i += CHUNK) {
      base64 += String.fromCharCode(...dados.subarray(i, i + CHUNK));
    }
    base64 = btoa(base64);

    const mimeNorm = mimeType.includes('png')  ? 'image/png'
      : mimeType.includes('gif')               ? 'image/gif'
      : mimeType.includes('webp')              ? 'image/webp'
      : 'image/jpeg';

    const promptImg = `Você é um assistente financeiro brasileiro analisando uma imagem (comprovante, nota fiscal, extrato, recibo ou tela).
Extraia TODAS as transações financeiras visíveis.
Data de hoje: ${hoje}${caption ? `\nContexto do cliente: ${caption}` : ''}

Se houver transações, responda SOMENTE com JSON (sem markdown):
[{"descricao":"Supermercado","valor":-150.00,"data":"${hoje}","categoria":"supermercado","conta":"dinheiro"}]

Regras: valor NEGATIVO=despesa, POSITIVO=receita.
Se não houver transação clara, responda: null
Categorias válidas: ${PROMPT_CATEGORIAS}`;

    const parsed = await geminiGerar([
      { text: promptImg },
      { inline_data: { mime_type: mimeNorm, data: base64 } },
    ]);
    console.log('[imagem] extracted:', JSON.stringify(parsed)?.substring(0, 100));

    const textoContexto = caption
      ? `[Imagem enviada com legenda: "${caption}"]`
      : '[Imagem/comprovante enviado]';

    const { ok } = await parsearESalvar(
      clienteId, sessionId, tel, parsed, nomeRemetente, textoContexto
    );
    return { ok };
  } catch (e: any) {
    console.error('[processarImagem]', e?.message);
    return { ok: false, erro: e?.message };
  }
}

// ── Salvar transação de PDF (com competência forçada e parcelas) ──────────────

async function salvarTransacaoPDF(
  clienteId: string,
  tel: string,
  t: any,
  nomeRemetente?: string,
  isFatura?: boolean,
  compFatura?: string,
): Promise<any | null> {
  try {
    const desc = String(t.descricao ?? '').trim();
    if (!desc) { console.warn('[salvarPDF] sem descricao'); return null; }

    const valorRaw = Number(t.valor ?? 0);
    if (!isFinite(valorRaw) || valorRaw === 0) {
      console.warn('[salvarPDF] valor inválido:', t.valor);
      return null;
    }

    const tipo  = valorRaw < 0 ? 'despesa' : 'receita';
    const valor = Math.abs(valorRaw);

    // Data real da transação (com ano corrigido)
    const hoje       = new Date().toISOString().substring(0, 10);
    const data       = String(t.data ?? hoje).substring(0, 10);

    // Competência: para fatura usa mês de vencimento; para extrato usa mês da data
    let competencia: string;
    if (isFatura && compFatura) {
      competencia = compFatura;
    } else {
      const [ano, mes] = data.split('-');
      competencia = `${ano}-${mes}`;
    }

    const [compAno, compMes] = competencia.split('-');
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const periodoLabel = `${meses[Number(compMes) - 1] ?? ''} ${compAno}`;

    const catRaw   = String(t.categoria ?? 'outros').toLowerCase().trim();
    const categoria = CATS.has(catRaw) ? catRaw : 'outros';
    const contaNome = nomeRemetente?.trim() || 'Geral';

    // Formato: para fatura sempre 'Crédito', para extrato resolve pelo FMT
    const fmtRawSalv = String(t.formato ?? '').trim();
    const formato = isFatura
      ? 'Crédito'
      : (FMT[fmtRawSalv] ?? FMT[fmtRawSalv.toLowerCase()] ?? 'Pix');

    // Macro — derivado da categoria se Gemini não retornar
    const macroRawSalv = String(t.macro ?? '').trim();
    const macro = MACRO_MAP[macroRawSalv.toLowerCase()] ?? macroRawSalv ?? CAT_MACRO[categoria] ?? (isFatura ? 'Consumo Mensal' : 'Consumo Mensal');

    const parcelaAtual      = Number(t.parcelaAtual      ?? 1) || 1;
    const parcelaTotal      = Number(t.parcelaTotal      ?? 1) || 1;
    const parcelasRestantes = Number(t.parcelasRestantes ?? (parcelaTotal - parcelaAtual + 1)) || 1;

    const novaT = {
      id:           crypto.randomUUID(),
      descricao:    desc,
      valor:        tipo === 'despesa' ? -valor : valor,
      data,
      competencia,
      periodoLabel,
      categoria,
      subcategoria: String(t.subcategoria ?? ''),
      conta:        contaNome,
      formato,
      macro,
      tipo,
      status:       'rascunho',   // PDFs enviados pelo WhatsApp também são rascunhos
      origem:       'whatsapp',
      subOrigem:    'pdf',
      fonte:        tel,
      criadoEm:     new Date().toISOString(),
      parcelaAtual,
      parcelaTotal,
      parcelasRestantes,
    };

    // Grava em transacoesBot (rascunhos comportamentais) — separado de transacoes (extrato oficial)
    const { data: salvo, error } = await db.rpc('append_transacao_bot', {
      p_cliente_id: clienteId,
      p_transacao:  novaT,
    });

    if (error) {
      console.error('[salvarPDF] RPC error:', error.message, '| desc:', desc);
      return null;
    }
    console.log('[salvarPDF] ok (bot):', desc, fmtVal(valor), tipo, 'comp:', competencia);
    return salvo ?? novaT;
  } catch (e: any) {
    console.error('[salvarPDF]', e?.message);
    return null;
  }
}

// ── Processar PDF (extrato bancário ou fatura de cartão) ─────────────────────

async function processarPDF(
  clienteId: string,
  sessionId: string,
  tel: string,
  wmsg: any,
  nomeRemetente?: string
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const docObj   = wmsg.document ?? {};
    const mediaId  = String(docObj.id ?? '');
    const mimeType = String(docObj.mime_type ?? 'application/pdf');
    const fileName = String(docObj.filename ?? 'extrato.pdf');
    const hoje     = new Date().toISOString().substring(0, 10);

    // Só processa PDF
    const isPDF = mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
    if (!isPDF) {
      await enviarMsg(tel,
        'Documento recebido, mas so consigo processar PDFs de extratos e faturas.\n' +
        'Para outros arquivos, use o sistema B2IF: planfinb2pessoal.netlify.app'
      );
      return { ok: true };
    }
    if (!mediaId) {
      await enviarMsg(tel, 'Nao consegui acessar o PDF. Tente novamente.');
      return { ok: true };
    }

    // ── Mensagem ÚNICA de espera — enviada apenas uma vez antes de qualquer processamento ──
    await enviarMsg(tel, '📄 Lendo seu documento, aguarde um momento...');

    // 1. Baixar o PDF
    console.log('[pdf] resolving mediaId', mediaId.substring(0, 15));
    const mediaUrl = await resolverMediaUrl(mediaId);
    if (!mediaUrl) {
      console.error('[pdf] resolverMediaUrl falhou — possível token expirado');
      await enviarMsg(tel, MSG_MANUTENCAO);
      await registrarManutencao(tel);
      return { ok: false, erro: 'resolverMediaUrl retornou null' };
    }
    const dados = await baixarMedia(mediaUrl);
    if (!dados || dados.length === 0) {
      console.error('[pdf] baixarMedia falhou — possível token expirado ou URL inválida');
      await enviarMsg(tel, MSG_MANUTENCAO);
      await registrarManutencao(tel);
      return { ok: false, erro: 'baixarMedia retornou vazio' };
    }
    console.log('[pdf] downloaded', dados.length, 'bytes');

    // 2. Upload para Gemini File API
    console.log('[pdf] uploading to Gemini...');
    const fileUri = await uploadGeminiFile(dados, 'application/pdf', fileName);
    if (!fileUri) {
      console.error('[pdf] uploadGeminiFile falhou — Gemini indisponível ou chave inválida');
      await enviarMsg(tel, MSG_MANUTENCAO);
      await registrarManutencao(tel);
      return { ok: false, erro: 'uploadGeminiFile retornou null' };
    }

    // 3. Primeira chamada: identificar tipo e metadados do documento
    const anoAtual = new Date().getFullYear();
    const promptMeta = `Voce esta analisando um documento financeiro brasileiro. Ano atual: ${anoAtual}.

Responda SOMENTE com um objeto JSON valido (sem markdown, sem texto extra, sem explicacoes).

Campos obrigatorios:
- tipo: "fatura" se for fatura de cartao de credito (palavras-chave: fatura, vencimento, fechamento, cartao, credito, limite); "extrato" se for extrato bancario (palavras-chave: extrato, conta corrente, saldo, agencia)
- vencimento: data de vencimento no formato YYYY-MM-DD (complete o ano com ${anoAtual} se nao estiver explicito); null para extratos
- fechamento: data de fechamento/corte no formato YYYY-MM-DD (complete o ano com ${anoAtual} se nao estiver explicito); null para extratos
- anoDocumento: ano do documento (ex: ${anoAtual})

ATENCAO ITAU: Faturas Itau exibem "Previsao prox. Fechamento: DD/MM/AAAA" — IGNORE esse campo completamente. Ele e a data de fechamento da PROXIMA fatura, nao da atual. Para o campo "fechamento", use a data de "Emissao" como proxy, ou deixe null se nao encontrar data de emissao explicita.

ATENCAO: Datas como "05/05" ou "01/05" sem ano devem ser completadas como "${anoAtual}-05-05" e "${anoAtual}-05-01".

Exemplos de resposta:
Extrato bancario: {"tipo":"extrato","vencimento":null,"fechamento":null,"anoDocumento":${anoAtual}}
Fatura cartao venc 05/05, fecha 01/05: {"tipo":"fatura","vencimento":"${anoAtual}-05-05","fechamento":"${anoAtual}-05-01","anoDocumento":${anoAtual}}
Fatura Itau (ignore "Previsao prox. Fechamento"), venc 05/07, emissao 03/06: {"tipo":"fatura","vencimento":"${anoAtual}-07-05","fechamento":"${anoAtual}-06-03","anoDocumento":${anoAtual}}`;

    console.log('[pdf] identifying document type...');
    const metaTxt = await geminiGerarPDFRaw(fileUri, promptMeta);
    let meta: any = {};
    if (metaTxt) {
      try {
        // Pega o maior bloco JSON válido (não o primeiro { } que pode ser aninhado)
        const matches = metaTxt.match(/\{[^{}]*\}/g);
        if (matches) {
          // Usa o maior match (mais completo)
          const melhor = matches.reduce((a, b) => a.length >= b.length ? a : b, '');
          meta = JSON.parse(melhor);
        }
      } catch { console.warn('[pdf] meta parse falhou:', metaTxt.substring(0, 200)); }
    }

    // Fallback: se tipo ainda for extrato mas o texto contiver palavras de fatura, força fatura
    let tipoDoc = String(meta?.tipo ?? 'extrato').toLowerCase().trim();
    if (tipoDoc !== 'fatura' && metaTxt) {
      const txt = metaTxt.toLowerCase();
      if (txt.includes('fatura') || txt.includes('vencimento') || txt.includes('fechamento') || txt.includes('cartao') || txt.includes('cartão')) {
        console.warn('[pdf] tipo forçado para fatura por palavras-chave no texto');
        tipoDoc = 'fatura';
      }
    }

    const isFatura      = tipoDoc === 'fatura';
    const anoDoc        = Number(meta?.anoDocumento ?? anoAtual);
    const vencStr       = String(meta?.vencimento ?? '');
    const fechaStr      = String(meta?.fechamento ?? '');

    // Mês/ano de vencimento = competência de TODOS os lançamentos da fatura
    let compFatura = '';
    if (isFatura && vencStr && vencStr.length >= 7) {
      compFatura = vencStr.substring(0, 7); // "YYYY-MM"
    }

    // Mês de corte — lançamentos com mês > mesFechamento pertencem ao ano anterior
    let mesFechamento = 0;
    let anoFechamento = anoDoc;
    if (fechaStr && fechaStr.length >= 7) {
      anoFechamento = Number(fechaStr.substring(0, 4));
      mesFechamento = Number(fechaStr.substring(5, 7));
    } else if (vencStr && vencStr.length >= 7) {
      // Se não tem fechamento, usa mês de vencimento como referência
      anoFechamento = Number(vencStr.substring(0, 4));
      mesFechamento = Number(vencStr.substring(5, 7));
    }

    console.log('[pdf] tipo:', tipoDoc, '| venc:', vencStr, '| fecha:', fechaStr, '| anoDoc:', anoDoc, '| mesFecha:', mesFechamento);

    // 4. Segunda chamada: extrair TODAS as transações
    let promptPDF: string;

    if (isFatura) {
      promptPDF = `Voce e um especialista em leitura de faturas de cartao de credito brasileiras.

FATURA DE CARTAO DE CREDITO — vencimento: ${vencStr || 'ver documento'} | fechamento/corte: ${fechaStr || 'ver documento'}

TAREFA: extraia TODOS os lancamentos de compras e creditos. Retorne APENAS o array JSON, sem markdown.

LAYOUT ITAU — ATENCAO ESPECIAL:
Faturas Itau costumam ter 2 colunas por pagina (coluna esquerda e coluna direita).
Leia PRIMEIRO todos os lancamentos da coluna ESQUERDA de cima a baixo, DEPOIS todos da coluna DIREITA de cima a baixo.
Nao leia em linha horizontal (esquerda+direita misturados). Processe coluna por coluna.
Pode haver mais de um titular (ex: "TITULAR PRINCIPAL" e "NOME DEPENDENTE") — extraia lancamentos de TODOS os titulares.
A secao "Compras parceladas - proximas faturas" e apenas informativa: NAO extraia esses lancamentos (eles serao importados nas faturas futuras).

IGNORE completamente:
- Pagamentos de fatura (ex: "Pagamento de fatura", "Pagamento recebido", "Pagto fatura")
- Totais da fatura, limites de credito, resumo
- IOF, juros, multas, encargos, saldo anterior
- Linhas de cabecalho, rodape, informacoes de conta
- Secao "Compras parceladas - proximas faturas" (lancamentos futuros)

REGRAS OBRIGATORIAS:

1. SINAL DO VALOR
   - Compras e parcelamentos: valor NEGATIVO (ex: -57.80)
   - Creditos, estornos, pagamentos recebidos: valor POSITIVO (ex: +8282.66)

2. ANO DO LANCAMENTO — REGRA CRITICA
   Data de fechamento = ${fechaStr || vencStr || 'ver documento'} | Mes de fechamento = ${mesFechamento > 0 ? mesFechamento : 'ver documento'} / ano ${anoFechamento}
   - Mes do lancamento <= mes de fechamento → ano ${anoFechamento}
   - Mes do lancamento > mes de fechamento → ano ${anoFechamento > 0 ? anoFechamento - 1 : anoDoc - 1}
   Exemplo (fecha maio/2026, mes=5): jan=2026, abr=2026, mai=2026, jun=2025, out=2025, nov=2025.
   ATENCAO: NUNCA atribua ano futuro a um lancamento. Se a data calculada for maior que o vencimento da fatura (${vencStr || 'ver documento'}), subtraia 1 ano.

3. FORMATO: use exatamente a string "Crédito" para TODAS as compras. Sem variacao.

4. DESCRICAO: copie a descricao EXATAMENTE como aparece na fatura, sem nenhuma alteracao, remocao ou abreviacao. Nao encurte, nao traduza, nao reformate. Se a fatura mostra "KIWIFY*CURSODEPYTHON", copie exatamente isso.

5. PARCELAS — REGRA CRITICA:
   Quando a descricao contiver algo como "PARC 03/04", "3/4", "3 de 4", "Parcela 3 de 4" (em qualquer posicao):
   - parcelaAtual = o numero do LADO ESQUERDO (ex: 03 → 3). E a parcela DESTA fatura.
   - parcelaTotal = o numero do LADO DIREITO (ex: 04 → 4). E o total de parcelas.
   NUNCA tente calcular diferenca nem restantes. Apenas copie os numeros literais do documento.
   Sem parcelamento: parcelaAtual=1, parcelaTotal=1.

6. CATEGORIA e MACRO: ${PROMPT_CATEGORIAS}

EXEMPLO DE SAIDA (observe parcelaAtual=3 quando o documento diz 03/04, e parcelaAtual=7 quando diz 07/10):
[
  {"descricao":"NETFLIX.COM","valor":-57.80,"data":"${anoFechamento}-02-10","categoria":"streaming","macro":"Consumo Mensal","formato":"Crédito","parcelaAtual":1,"parcelaTotal":1},
  {"descricao":"KIWIFY*CURSOPYTHON","valor":-353.02,"data":"${anoFechamento > 0 ? anoFechamento - 1 : anoDoc - 1}-02-01","categoria":"livro_curso","macro":"Consumo Mensal","formato":"Crédito","parcelaAtual":3,"parcelaTotal":4},
  {"descricao":"CASAS BAHIA TELA SMART 07/10","valor":-235.89,"data":"${anoFechamento > 0 ? anoFechamento - 1 : anoDoc - 1}-10-08","categoria":"outros","macro":"Consumo Mensal","formato":"Crédito","parcelaAtual":7,"parcelaTotal":10}
]`;
    } else {
      promptPDF = `Voce e um especialista em leitura de extratos bancarios brasileiros.

EXTRATO BANCARIO (conta corrente) — ano do documento: ${anoDoc}

TAREFA: extraia TODAS as transacoes. Retorne APENAS o array JSON, sem markdown.

IGNORE: linhas de "Saldo do dia", "Saldo Anterior", "Saldo em", cabecalho, rodape, informacoes de limite, linhas sem valor monetario.

REGRAS OBRIGATORIAS:

1. SINAL DO VALOR
   - Saidas, debitos, pagamentos, PIX enviado: valor NEGATIVO (ex: -150.00)
   - Entradas, creditos, PIX recebido, salario: valor POSITIVO (ex: +5000.00)

2. DATA: formato YYYY-MM-DD usando o ano correto do extrato (${anoDoc}).

3. FORMATO DE PAGAMENTO — use exatamente uma destas strings:
   - "Pix" para PIX enviado ou recebido, TED, DOC, transferencias
   - "Débito" para compras com cartao de debito
   - "Dinheiro" para saques e depositos em especie
   - "Boleto" para pagamentos de boleto/conta
   - "Pix" como padrao para outros debitos/creditos

4. DESCRICAO: copie a descricao EXATAMENTE como aparece no extrato, sem nenhuma alteracao, remocao ou abreviacao. Nao encurte, nao traduza, nao reformate.

5. CATEGORIA e MACRO: ${PROMPT_CATEGORIAS}

6. PARCELAS: parcelaAtual=1, parcelaTotal=1 para todas (extrato nao tem parcelamento).

EXEMPLO DE SAIDA:
[
  {"descricao":"iFood Restaurantes","valor":-45.90,"data":"${anoDoc}-03-05","categoria":"alimentacao_fora","macro":"Consumo Mensal","formato":"Débito","parcelaAtual":1,"parcelaTotal":1},
  {"descricao":"Salario Empresa X","valor":5000.00,"data":"${anoDoc}-03-05","categoria":"salario","macro":"Receitas","formato":"Pix","parcelaAtual":1,"parcelaTotal":1},
  {"descricao":"Pix enviado Joao","valor":-200.00,"data":"${anoDoc}-03-10","categoria":"entre_contas","macro":"Fluxo Interno","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}
]`;
    }

    console.log('[pdf] extracting transactions (tipo=' + tipoDoc + ')...');
    const pdfResult = await geminiGerarPDF([
      { text: promptPDF },
      { file_data: { mime_type: 'application/pdf', file_uri: fileUri } },
    ]);
    const parsed = pdfResult.data;
    const pdfTruncated = pdfResult.truncated;  // Bug #1: flag de fatura parcial
    console.log('[pdf] extracted:', Array.isArray(parsed) ? parsed.length + ' items' : String(parsed).substring(0, 80), 'truncated:', pdfTruncated);

    // Rede de segurança: remove datas futuras em faturas (nenhuma compra pode ser após o vencimento)
    if (isFatura && Array.isArray(parsed) && vencStr && vencStr.length >= 7) {
      const vencDate = new Date(vencStr);
      for (const t of parsed) {
        if (!t?.data) continue;
        const tDate = new Date(String(t.data));
        if (!isNaN(tDate.getTime()) && !isNaN(vencDate.getTime()) && tDate > vencDate) {
          // Data está no futuro em relação ao vencimento — subtrai 1 ano
          const dataCorrigida = String(t.data).replace(/^(\d{4})/, (y) => String(Number(y) - 1));
          console.warn('[pdf] data futura corrigida:', t.data, '→', dataCorrigida, '|', t.descricao?.substring(0, 30));
          t.data = dataCorrigida;
        }
      }
    }

    if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
      await enviarMsg(tel,
        'Li o PDF mas nao encontrei transacoes financeiras.\n' +
        'Verifique se e um extrato ou fatura valido e tente novamente.'
      );
      return { ok: true };
    }

    // 5. Pós-processar: corrigir anos de parcelas e salvar
    const lista: any[] = Array.isArray(parsed) ? parsed
      : parsed?.descricao ? [parsed] : [];

    const mesesPT: Record<string, string> = {
      '01':'Janeiro','02':'Fevereiro','03':'Marco','04':'Abril',
      '05':'Maio','06':'Junho','07':'Julho','08':'Agosto',
      '09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro',
    };

    const salvas: any[] = [];
    let erros = 0;

    for (const t of lista) {
      if (!t?.descricao || t?.valor == null) continue;

      // Para fatura: se o prompt já retornou o valor com sinal correto (negativo=despesa),
      // não invertemos de novo. Mas garantimos que o sinal está correto.
      // O novo prompt pede valor NEGATIVO para compras, então não precisamos inverter.
      const valorFinal = Number(t.valor);

      // Resolve formato: para fatura sempre 'Crédito', para extrato via FMT
      let fmtResolvido: string;
      if (isFatura) {
        fmtResolvido = 'Crédito';
      } else {
        const fmtGemini = String(t.formato ?? '').trim();
        fmtResolvido = FMT[fmtGemini] ?? FMT[fmtGemini.toLowerCase()] ?? 'Pix';
      }

      // Parcelas: o Gemini retorna parcelaAtual e parcelaTotal literais do PDF
      // O sistema precisa de 'parcelasRestantes' = total - atual + 1 (inclui a atual)
      const pAtual = Number(t.parcelaAtual ?? 1) || 1;
      const pTotal = Number(t.parcelaTotal ?? 1) || 1;
      const pRestantes = pTotal - pAtual + 1;

      const tFinal = {
        ...t,
        valor:        valorFinal,
        formato:      fmtResolvido,
        parcelaAtual: pAtual,
        parcelaTotal: pTotal,
        parcelasRestantes: pRestantes > 0 ? pRestantes : 1,
      };

      const s = await salvarTransacaoPDF(clienteId, tel, tFinal, nomeRemetente, isFatura, compFatura);
      if (s) salvas.push(s);
      else erros++;
    }

    console.log('[pdf] saved:', salvas.length, 'errors:', erros);

    if (salvas.length === 0) {
      await enviarMsg(tel,
        'Encontrei o PDF mas nao consegui salvar os lancamentos.\n' +
        'Tente novamente ou importe pelo sistema B2IF: planfinb2pessoal.netlify.app'
      );
      return { ok: true };
    }

    // 6. Montar resposta final
    const totalDespesas = salvas.filter(s => s.tipo === 'despesa').length;
    const totalReceitas = salvas.filter(s => s.tipo === 'receita').length;

    let periodoStr: string;
    if (isFatura && compFatura) {
      const [fAno, fMes] = compFatura.split('-');
      periodoStr = `${mesesPT[fMes] ?? fMes}/${fAno}`;
    } else {
      const datas = salvas.map(s => String(s.competencia ?? s.data ?? '').substring(0, 7)).filter(Boolean);
      const mesesUnicos = [...new Set(datas)].sort();
      if (mesesUnicos.length === 1) {
        const [ano, mes] = mesesUnicos[0].split('-');
        periodoStr = `${mesesPT[mes] ?? mes}/${ano}`;
      } else if (mesesUnicos.length > 1) {
        const [a1, m1] = mesesUnicos[0].split('-');
        const [a2, m2] = mesesUnicos[mesesUnicos.length - 1].split('-');
        periodoStr = `${mesesPT[m1] ?? m1}/${a1} a ${mesesPT[m2] ?? m2}/${a2}`;
      } else {
        periodoStr = 'periodo identificado';
      }
    }

    const tipoLabel = isFatura ? 'Fatura' : 'Extrato';
    let detalhes = '';
    if (totalDespesas > 0 && totalReceitas > 0)
      detalhes = ` (${totalDespesas} saida${totalDespesas > 1 ? 's' : ''}, ${totalReceitas} entrada${totalReceitas > 1 ? 's' : ''})`;
    else if (totalDespesas > 0)
      detalhes = ` (${totalDespesas} despesa${totalDespesas > 1 ? 's' : ''})`;
    else if (totalReceitas > 0)
      detalhes = ` (${totalReceitas} receita${totalReceitas > 1 ? 's' : ''})`;

    let resposta = `${tipoLabel} de ${periodoStr} adicionado ao sistema B2IF`;
    resposta += ` - ${salvas.length} lancamento${salvas.length > 1 ? 's' : ''} importado${salvas.length > 1 ? 's' : ''}${detalhes}`;
    if (erros > 0)
      resposta += `\n${erros} linha${erros > 1 ? 's nao puderam' : ' nao pode'} ser importada${erros > 1 ? 's' : ''}.`;
    if (pdfTruncated)  // Bug #1: avisa sobre fatura parcialmente importada
      resposta += `\n\n⚠️ Fatura parcialmente importada — o PDF e muito grande e algumas transacoes podem estar faltando. Importe tambem pelo sistema B2IF: planfinb2pessoal.netlify.app`;

    await enviarMsg(tel, resposta);
    await salvarMensagemBot(sessionId, resposta);

    // PDF processado com sucesso — verifica se este tel estava em manutenção e avisa que voltou
    await verificarEAvisarVolta(tel).catch(() => {});

    return { ok: true };

  } catch (e: any) {
    console.error('[processarPDF]', e?.message);
    await enviarMsg(tel, MSG_MANUTENCAO).catch(() => {});
    await registrarManutencao(tel).catch(() => {});
    return { ok: false, erro: e?.message };
  }
}

// ── Café Consigo Mesmo — funções de estado ────────────────────────────────────

/** Verifica se a mensagem é um trigger para entrar no modo café */
function isTriggerCafe(texto: string): boolean {
  const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return CAFE_TRIGGERS.some(trigger => {
    const tNorm = trigger.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return t.includes(tNorm);
  });
}

/** Verifica se a mensagem quer encerrar o modo café */
function isEncerrarCafe(texto: string): boolean {
  const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return CAFE_ENCERRAR.some(enc => {
    const eNorm = enc.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return t.includes(eNorm);
  });
}

/** Retorna true se a sessão está em modo café ATIVO e não expirou */
function cafeAtivo(sessao: { cafe_estado?: boolean; cafe_inicio?: string | null }): boolean {
  if (!sessao.cafe_estado) return false;
  if (!sessao.cafe_inicio) return true; // sem timestamp, assume ativo
  const inicio = new Date(sessao.cafe_inicio).getTime();
  const agora  = Date.now();
  const minutos = (agora - inicio) / 60000;
  return minutos <= CAFE_TIMEOUT_MIN;
}

/** Ativa o modo café para a sessão */
async function ativarCafe(sessaoId: string): Promise<void> {
  await db.from('bot_sessions').update({
    cafe_estado: true,
    cafe_inicio: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  }).eq('id', sessaoId);
}

/** Desativa o modo café para a sessão */
async function desativarCafe(sessaoId: string): Promise<void> {
  await db.from('bot_sessions').update({
    cafe_estado: false,
    cafe_inicio: null,
    atualizado_em: new Date().toISOString(),
  }).eq('id', sessaoId);
}

/** Renova o timestamp do café (mantém ativo com nova mensagem) */
async function renovarCafe(sessaoId: string): Promise<void> {
  await db.from('bot_sessions').update({
    cafe_inicio: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  }).eq('id', sessaoId);
}

// ── Lock em memória para evitar duplicatas de msgId dentro do mesmo processo ──
// Meta pode reenviar o POST se não receber 200 em <20 s (PDFs demoram mais)
const _processando = new Set<string>();

// ── Helpers de manutenção ────────────────────────────────────────────────────

const MSG_MANUTENCAO = '⚠️ Estou em manutenção no momento. Entre em contato com seu planejador financeiro.';
const MSG_VOLTEI     = '✅ Estou de volta! Pode contar comigo.';

/** Registra que este tel recebeu aviso de manutenção (sem duplicar). */
async function registrarManutencao(tel: string): Promise<void> {
  // Verifica se já foi avisado recentemente (últimas 2h) para não repetir
  const { data: jaAvisado } = await db
    .from('bot_queue')
    .select('id')
    .eq('telefone', tel)
    .eq('status', 'maintenance_notified')
    .gte('criado_em', new Date(Date.now() - 2 * 3600 * 1000).toISOString())
    .limit(1)
    .maybeSingle();
  if (jaAvisado) return; // já avisou nesta janela, não repete

  try {
    await db.from('bot_queue').insert({
      telefone: tel,
      tipo: 'system',
      payload: {},
      status: 'maintenance_notified',
      criado_em: new Date().toISOString(),
    });
  } catch { /* silencioso */ }
}

/** Se este tel tinha aviso de manutenção pendente, envia "voltei" e marca como resolvido. */
async function verificarEAvisarVolta(tel: string): Promise<void> {
  // Busca aviso de manutenção sem "returned" posterior para este tel
  const { data: aviso } = await db
    .from('bot_queue')
    .select('id')
    .eq('telefone', tel)
    .eq('status', 'maintenance_notified')
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!aviso) return; // nunca recebeu aviso → não precisa de "voltei"

  // Verifica se já enviou "voltei" depois desse aviso
  const { data: jaVoltou } = await db
    .from('bot_queue')
    .select('id')
    .eq('telefone', tel)
    .eq('status', 'maintenance_returned')
    .gte('criado_em', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .limit(1)
    .maybeSingle();
  if (jaVoltou) return; // já avisou que voltou

  // Envia a mensagem e registra
  await enviarMsg(tel, MSG_VOLTEI);
  try {
    await db.from('bot_queue').insert({
      telefone: tel,
      tipo: 'system',
      payload: {},
      status: 'maintenance_returned',
      criado_em: new Date().toISOString(),
    });
  } catch { /* silencioso */ }
  console.log('[manutencao] voltei enviado para', tel);
}

// ── Handler principal ─────────────────────────────────────────────────────────

serve(async (req: Request) => {

  // ── GET: verificação Meta + diagnóstico ────────────────────────────────────
  if (req.method === 'GET') {
    const url  = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const tok  = url.searchParams.get('hub.verify_token');
    const ch   = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && tok === META_VERIFY_TOKEN) {
      console.log('[GET] verify ok');
      return new Response(ch ?? '', { status: 200 });
    }
    if (url.searchParams.get('diag') === '1') {
      const d: any = {
        v: '9.5',
        meta: !!META_ACCESS_TOKEN,
        gemini: !!GEMINI_API_KEY,
        supa: !!SUPABASE_URL,
        suportes: ['texto', 'audio', 'imagem', 'documento'],
        ia: 'conversacional',
      };
      const { data: s } = await db.from('bot_sessions').select('id').eq('ativo', true).limit(5);
      d.sessions = s?.length ?? 0;
      return jsonR(d);
    }
    return new Response('ok', { status: 200 });
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  // ── Envio manual ───────────────────────────────────────────────────────────
  if (body._envio_manual === true) {
    const tel = normTel(String(body.telefone ?? ''));
    const txt = String(body.mensagem ?? '').trim();
    if (tel && txt) await enviarMsg(tel, txt);
    return jsonR({ ok: true });
  }

  // ── Admin proxy ────────────────────────────────────────────────────────────
  if (body._admin_action) {
    const adminKey = req.headers.get('X-Admin-Key') ?? '';
    if (adminKey !== SUPABASE_SERVICE_KEY || !SUPABASE_SERVICE_KEY) {
      return jsonR({ error: 'Não autorizado' }, 401);
    }

    const action = String(body._admin_action);

    if (action === 'listar_planejadores') {
      const { data: plans, error: pErr } = await db
        .from('planejadores').select('*')
        .eq('role', 'planejador').order('criado_em', { ascending: true });
      if (pErr) return jsonR({ error: pErr.message }, 400);

      const authResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      });
      const authData = authResp.ok ? await authResp.json() : { users: [] };
      const authMap  = new Map((authData.users ?? []).map((u: any) => [u.id, u]));

      const resultado = (plans ?? []).map((p: any) => ({
        ...p,
        email_confirmado: !!authMap.get(p.id)?.email_confirmed_at,
        confirmado_em: authMap.get(p.id)?.email_confirmed_at ?? null,
      }));
      return jsonR(resultado);
    }

    if (action === 'criar_planejador') {
      const { email, senha, nome } = body;
      if (!email || !senha || !nome) return jsonR({ error: 'Campos obrigatórios ausentes' }, 400);

      const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password: senha, email_confirm: true, user_metadata: { nome, role: 'planejador' } }),
      });
      const newUser = await createResp.json();
      if (!createResp.ok || newUser.error)
        return jsonR({ error: newUser.error ?? newUser.message ?? 'Erro ao criar usuário' }, 400);

      const { error: planErr } = await db.from('planejadores').insert({
        id: newUser.id, nome, email, role: 'planejador', ativo: true,
      });
      if (planErr) {
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${newUser.id}`, {
          method: 'DELETE',
          headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
        });
        return jsonR({ error: planErr.message }, 400);
      }
      return jsonR({ user_id: newUser.id, email, nome, email_confirmado: true });
    }

    if (action === 'confirmar_email') {
      const { userId } = body;
      if (!userId) return jsonR({ error: 'userId obrigatório' }, 400);
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_confirm: true }),
      });
      const updated = await resp.json();
      if (!resp.ok) return jsonR({ error: updated.message ?? 'Erro' }, 400);
      return jsonR({ ok: true, email: updated.email, confirmed_at: updated.email_confirmed_at });
    }

    if (action === 'resetar_senha_planejador') {
      const { userId, novaSenha } = body;
      if (!userId || !novaSenha) return jsonR({ error: 'userId e novaSenha obrigatórios' }, 400);
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: novaSenha }),
      });
      if (!resp.ok) { const e = await resp.json(); return jsonR({ error: e.message ?? 'Erro' }, 400); }
      return jsonR({ ok: true });
    }

    if (action === 'excluir_planejador') {
      const { userId } = body;
      if (!userId) return jsonR({ error: 'userId obrigatório' }, 400);
      await db.from('planejadores').delete().eq('id', userId);
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      });
      if (!resp.ok) { const e = await resp.json(); return jsonR({ error: e.message ?? 'Erro' }, 400); }
      return jsonR({ ok: true });
    }

    return jsonR({ error: 'Ação desconhecida' }, 400);
  }

  // ── Evento Meta WhatsApp ───────────────────────────────────────────────────
  if (body?.object !== 'whatsapp_business_account') return jsonR({ received: true });

  // IMPORTANTE: processamento SÍNCRONO — o Supabase Edge Runtime encerra a função assim
  // que o Response é retornado, então não é possível usar background tasks sem waitUntil.
  // Deduplicação de msg_id é feita pelo RPC enfileirar_mensagem no banco (idempotente).
  // O lock em memória _processando serve apenas para o caso de dois POSTs simultâneos
  // chegarem na MESMA instância antes de qualquer um chegar no banco.
  const processarEventos = async () => {
  try {
    for (const entry of (body.entry ?? [])) {
      for (const change of (entry.changes ?? [])) {
        if (change.field !== 'messages') continue;

        for (const wmsg of (change.value?.messages ?? [])) {
          const msgId   = String(wmsg.id ?? '');
          const fromNum = String(wmsg.from ?? '');
          const tipo    = String(wmsg.type ?? 'text');
          const tsMsg   = Number(wmsg.timestamp) || 0;
          const agoraS  = Math.floor(Date.now() / 1000);
          const ageMin  = Math.round((agoraS - tsMsg) / 60);

          console.log(`[msg] id=${msgId.substring(0, 20)} tipo=${tipo} de=${fromNum} age=${ageMin}min`);

          // ── Lock em memória: bloqueia duplicatas dentro do mesmo processo ──
          if (msgId && _processando.has(msgId)) {
            console.log('[msg] já em processamento (lock):', msgId.substring(0, 20));
            continue;
          }
          if (msgId) _processando.add(msgId);
          // Libera o lock após 2 min (segurança para garbage collection)
          if (msgId) setTimeout(() => _processando.delete(msgId), 120_000);

          // Ignorar mensagens do próprio bot
          if (fromNum === META_PHONE_NUMBER_ID) { console.log('[msg] skip self'); continue; }

          const tel = normTel(fromNum);
          if (!tel) { console.log('[msg] tel inválido'); continue; }

          // Descartar mensagens muito antigas
          if (tsMsg > 0 && (agoraS - tsMsg) > MAX_IDADE_HORAS * 3600) {
            console.log(`[msg] expirada ${ageMin}min`);
            try {
              await db.from('bot_queue').insert({
                telefone: tel, tipo, payload: wmsg,
                msg_id: msgId || null, status: 'skipped',
                erro: `expirada ${ageMin}min`,
                processado_em: new Date().toISOString(),
              });
            } catch { /* silencioso */ }
            continue;
          }

          // ── 1) Buscar número em cliente_telefones ──────────────────────────
          const vars = telVariantes(tel);

          let ctRow: { cliente_id: string; nome: string } | null = null;
          {
            const { data: rows, error: ctErr } = await db
              .from('cliente_telefones')
              .select('cliente_id, nome, telefone')
              .in('telefone', vars)
              .eq('ativo', true)
              .limit(1);
            if (ctErr) console.error('[msg] cliente_telefones err:', ctErr.message);
            if (rows && rows.length > 0) ctRow = rows[0];
          }

          console.log('[msg] vars:', vars.join('|'),
            '→ cliente:', ctRow?.cliente_id?.substring(0, 8) ?? 'null',
            'nome:', ctRow?.nome ?? '—');

          // ── 2) Buscar sessão ativa pelo cliente_id ─────────────────────────
          let sessao: { id: string; cliente_id: string; primeira_msg_enviada?: boolean; cafe_estado?: boolean; cafe_inicio?: string | null } | null = null;

          if (ctRow?.cliente_id) {
            // Busca sessão ativa
            const { data: s } = await db
              .from('bot_sessions')
              .select('id,cliente_id,primeira_msg_enviada,cafe_estado,cafe_inicio')
              .eq('cliente_id', ctRow.cliente_id)
              .eq('ativo', true)
              .maybeSingle();
            sessao = s ?? null;

            // ── Auto-heal: número vinculado mas sessão ausente/inativa ──────────
            // Isso acontece quando: a sessão foi desativada por engano, nunca foi
            // criada (bug raro), ou o campo ativo virou false sem o frontend saber.
            // Solução: recriar/reativar a sessão automaticamente usando o cliente_id
            // que já foi confirmado via cliente_telefones (lookup confiável).
            if (!sessao) {
              console.warn('[msg] auto-heal: cliente_telefones ok mas sem bot_session ativa para', ctRow.cliente_id.substring(0, 8));

              // Verifica se existe sessão inativa para reativar
              const { data: sessaoInativa } = await db
                .from('bot_sessions')
                .select('id,cliente_id,primeira_msg_enviada')
                .eq('cliente_id', ctRow.cliente_id)
                .maybeSingle();

              if (sessaoInativa?.id) {
                // Reativa sessão existente
                await db.from('bot_sessions')
                  .update({ ativo: true, telefone: tel, atualizado_em: new Date().toISOString() })
                  .eq('id', sessaoInativa.id);
                sessao = sessaoInativa;
                console.log('[msg] auto-heal: sessão reativada', sessaoInativa.id.substring(0, 8));
              } else {
                // Busca planejador_id do cliente (obrigatório em bot_sessions)
                const { data: clienteRow } = await db
                  .from('clientes')
                  .select('planejador_id')
                  .eq('id', ctRow.cliente_id)
                  .maybeSingle();

                if (!clienteRow?.planejador_id) {
                  console.error('[msg] auto-heal: planejador_id não encontrado para cliente', ctRow.cliente_id.substring(0, 8));
                } else {
                  // Cria nova sessão do zero
                  const { data: novaSessao, error: insErr } = await db
                    .from('bot_sessions')
                    .insert({
                      cliente_id: ctRow.cliente_id,
                      assessor_id: clienteRow.planejador_id,
                      telefone: tel,
                      ativo: true,
                      primeira_msg_enviada: false,
                      atualizado_em: new Date().toISOString(),
                    })
                    .select('id,cliente_id,primeira_msg_enviada')
                    .single();
                  if (insErr) console.error('[msg] auto-heal: erro ao criar sessão', insErr.message);
                  sessao = novaSessao ?? null;
                  console.log('[msg] auto-heal: nova sessão criada', novaSessao?.id?.substring(0, 8) ?? 'falhou');
                }
              }
            }
          } else {
            // Fallback: tenta pelo telefone direto (número não está em cliente_telefones)
            const { data: s } = await db
              .from('bot_sessions')
              .select('id,cliente_id,primeira_msg_enviada,cafe_estado,cafe_inicio')
              .eq('telefone', tel)
              .eq('ativo', true)
              .maybeSingle();
            sessao = s ?? null;
          }

          console.log('[msg] sessao:', sessao?.id?.substring(0, 8) ?? 'null');

          if (!sessao) {
            // Chegou aqui apenas se o número NÃO está em cliente_telefones (não vinculado de verdade)
            try {
              await db.from('bot_queue').insert({
                telefone: tel, tipo, payload: wmsg,
                msg_id: msgId || null, status: 'skipped',
                erro: `sem_sessao vars=${vars.join('|')}`,
                processado_em: new Date().toISOString(),
              });
            } catch { /* silencioso */ }
            console.warn('[msg] sem sessão para vars:', vars.join('|'));
            await enviarMsg(tel,
              '👋 Seu número ainda não está vinculado ao B2IF.\n' +
              'Solicite ao seu assessor que faça a vinculação.'
            );
            continue;
          }

          const nomeRemetente: string | undefined = ctRow?.nome?.trim() || undefined;
          console.log('[msg] nomeRemetente:', nomeRemetente ?? 'não encontrado');

          // ── Mensagem de boas-vindas (primeira mensagem pós-conexão) ───────────
          if (sessao.primeira_msg_enviada === false) {
            const nomeBoasVindas = nomeRemetente ? nomeRemetente.split(' ')[0] : 'você';
            const msgBoasVindas =
              `👋 Olá, ${nomeBoasVindas}! Bem-vindo(a) ao seu assistente financeiro!\n\n` +
              `Estou aqui para registrar seus lançamentos de forma simples e rápida — do jeito que for mais fácil pra você:\n\n` +
              `🎤 *Áudio* — manda um recado falado\n` +
              `📸 *Foto* — fotografe um comprovante ou nota\n` +
              `💬 *Texto* — escreva como preferir\n` +
              `📄 *PDF* — envie sua fatura ou extrato direto aqui\n\n` +
              `Pode misturar à vontade! Quanto mais detalhes, melhor a categorização.\n\n` +
              `🎯 Também te ajudo a acompanhar suas metas — tanto as individuais quanto o panorama geral. É só perguntar, tipo:\n` +
              `_"Como estão minhas metas?"_\n` +
              `_"Quanto falta para a meta de viagem?"_\n\n` +
              `Pode começar quando quiser! 🚀`;
            await enviarMsg(tel, msgBoasVindas);
            await db.from('bot_sessions')
              .update({ primeira_msg_enviada: true })
              .eq('id', sessao.id);
            console.log('[msg] boas-vindas enviada para', nomeBoasVindas);
          }

          // ── Dedup rápido por msg_id no banco (antes do RPC completo) ──────────
          // Evita reprocessar quando a Meta reenvia o mesmo msgId com QUALQUER status
          // (inclusive 'pending' — dois POSTs simultâneos para o mesmo PDF)
          if (msgId) {
            const { data: jaProcQ } = await db
              .from('bot_queue')
              .select('id, status')
              .eq('msg_id', msgId)
              .limit(1)
              .maybeSingle();
            if (jaProcQ) {
              console.log('[msg] msgId já existe no banco (status=' + jaProcQ.status + ') — skip:', msgId.substring(0, 20));
              continue;
            }
          }

          // Enfileirar
          const { data: enqData, error: qErr } = await db.rpc('enfileirar_mensagem', {
            p_session_id: sessao.id,
            p_cliente_id: sessao.cliente_id,
            p_telefone:   tel,
            p_tipo:       tipo,
            p_payload:    wmsg,
            p_msg_id:     msgId || null,
          });

          console.log('[msg] enq:', JSON.stringify(enqData), 'err:', qErr?.message ?? 'none');

          const queueId: string | null  = enqData?.id  ? String(enqData.id)  : null;
          const isNovo:  boolean         = enqData?.novo === true;

          if (!queueId) { console.log('[msg] sem queueId'); continue; }

          if (!isNovo) {
            const { data: existente } = await db
              .from('bot_queue').select('status').eq('id', queueId).maybeSingle();
            if (existente && existente.status !== 'pending') {
              console.log('[msg] duplicata já processada status=' + existente.status);
              continue;
            }
            console.log('[msg] reprocessando pendente id=' + queueId.substring(0, 8));
          } else {
            console.log('[msg] novo id=' + queueId.substring(0, 8));
          }

          // Registrar mensagem do cliente (fire-and-forget)
          (async () => {
            const { error: mErr } = await db.from('bot_messages').insert({
              session_id: sessao!.id,
              de: 'cliente', tipo,
              conteudo: tipo === 'text' ? (wmsg.text?.body ?? '') : `[${tipo}]`,
              meta: wmsg, lida: false,
            });
            if (mErr) console.error('[bot_messages]', mErr.message);
          })();

          // Atualizar timestamp da sessão (fire-and-forget)
          (async () => {
            const { error: uErr } = await db.from('bot_sessions')
              .update({ atualizado_em: new Date().toISOString() })
              .eq('id', sessao!.id);
            if (uErr) console.error('[bot_sessions upd]', uErr.message);
          })();

          // ── Processar por tipo ─────────────────────────────────────────────
          let ok   = true;
          let erro: string | null = null;

          try {
            switch (tipo) {

              case 'text': {
                const txt = String(wmsg.text?.body ?? '').trim();
                if (txt) {
                  // Antes de processar texto, verifica se voltou de manutenção
                  await verificarEAvisarVolta(tel).catch(() => {});
                  const res = await processarTexto(
                    sessao.cliente_id, sessao.id, tel, txt, nomeRemetente,
                    { cafe_estado: sessao.cafe_estado, cafe_inicio: sessao.cafe_inicio }
                  );
                  ok = res.ok; erro = res.erro ?? null;
                }
                break;
              }

              case 'audio':
              case 'voice': {
                const res = await processarAudio(
                  sessao.cliente_id, sessao.id, tel, wmsg, nomeRemetente
                );
                ok = res.ok; erro = res.erro ?? null;
                break;
              }

              case 'image': {
                const res = await processarImagem(
                  sessao.cliente_id, sessao.id, tel, wmsg, nomeRemetente
                );
                ok = res.ok; erro = res.erro ?? null;
                break;
              }

              case 'document': {
                const res = await processarPDF(
                  sessao.cliente_id, sessao.id, tel, wmsg, nomeRemetente
                );
                ok = res.ok; erro = res.erro ?? null;
                break;
              }

              case 'sticker': {
                await enviarMsg(tel, '😄 Figurinha recebida! Para registrar gastos, envie texto, foto ou áudio.');
                break;
              }

              default: {
                console.log('[msg] tipo não tratado:', tipo);
                await enviarMsg(tel,
                  `Tipo de mensagem não suportado (${tipo}).\n\n` +
                  'Envie:\n• ✏️ Texto\n• 📸 Foto\n• 🎙️ Áudio\n\nDigite ajuda para mais informações.'
                );
              }
            }
          } catch (e: any) {
            console.error('[msg] erro processamento:', e?.message);
            ok   = false;
            erro = e?.message ?? 'erro desconhecido';
          }

          // Finalizar fila
          const { error: fErr } = await db.rpc('finalizar_fila', {
            p_queue_id: queueId,
            p_status:   ok ? 'done' : 'error',
            p_erro:     erro,
          });
          if (fErr) console.error('[finalizar_fila]', fErr.message);
          console.log('[msg] finalizado', queueId.substring(0, 8), ok ? 'done' : 'error');
        }
      }
    }
  } catch (globalErr: any) {
    console.error('[GLOBAL ERROR]', globalErr?.message, globalErr?.stack?.substring(0, 400));
  }
  }; // fim processarEventos

  // Retorna 200 imediatamente para o Meta (evita reenvio por timeout de 20s)
  // EdgeRuntime.waitUntil mantém a função viva para processar PDF sem limite de 150s
  const resp = jsonR({ received: true });
  (globalThis as any).EdgeRuntime?.waitUntil(
    processarEventos().catch(e => console.error('[global]', e?.message))
  );
  return resp;
});
