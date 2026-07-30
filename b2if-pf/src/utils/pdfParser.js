import * as pdfjsLib from 'pdfjs-dist';

// Usa o worker local (copiado para /public) — evita bloqueio de CDN externa
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ── Extrai linhas estruturadas de um PDF ──────────────────────────────────────
// Retorna array de linhas, cada linha é array de campos (itens do mesmo Y)
export async function extrairLinhasPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const todasLinhas = []; // [ [ {texto, x, y}, ... ], ... ]

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const itens = content.items
      .map(item => ({
        texto: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
      }))
      .filter(item => item.texto.trim() !== '');

    // Agrupa por Y com tolerância de 3px
    const linhas = {};
    for (const item of itens) {
      const yKey = Math.round(item.y / 3) * 3;
      if (!linhas[yKey]) linhas[yKey] = [];
      linhas[yKey].push(item);
    }

    // Ordena por Y decrescente (PDF tem Y de baixo pra cima)
    Object.entries(linhas)
      .sort(([a], [b]) => Number(b) - Number(a))
      .forEach(([, its]) => {
        const sorted = its.sort((a, b) => a.x - b.x);
        todasLinhas.push(sorted);
      });
  }

  return todasLinhas;
}

// ── Extrai texto bruto de um PDF (para exibição / debug) ─────────────────────
export async function extrairTextoPDF(file) {
  const linhas = await extrairLinhasPDF(file);
  return linhas.map(campos => campos.map(c => c.texto).join('  ')).join('\n');
}

// ── Detecta banco pelo conteúdo do PDF ───────────────────────────────────────
// Exportada para que usePDFProcessing possa passá-la à Edge Function
//
// IMPORTANTE — Convenção de IDs retornados:
//   Bancos que têm extrato E fatura retornam o mesmo ID base (ex: 'bb', 'itau').
//   A distinção extrato/fatura é feita pelo campo tipoPDF passado pelo usuário.
//   IDs:
//     'bb'           → Banco do Brasil (extrato ou fatura Ourocard)
//     'nubank'       → Nubank extrato
//     'nubank_fatura'→ Nubank fatura (detecção pela palavra 'fatura' no doc)
//     'itau'         → Itaú (extrato e fatura)
//     'bradesco'     → Bradesco (extrato e fatura)
//     'inter'        → Banco Inter (extrato e fatura)
//     'santander'    → Santander (extrato e fatura)
//     'c6'           → C6 Bank (extrato e fatura)
//     'caixa'        → Caixa Econômica (extrato e fatura)
//     'sicoob'       → Sicoob (extrato e fatura)
//     'sicredi'      → Sicredi (extrato e fatura)
//     'xp'           → XP Investimentos (extrato e fatura)
//     'mercadopago'  → Mercado Pago (extrato e fatura)
//     'picpay'       → PicPay
  //     'pagbank'      → PagBank / PagSeguro
  //     'btg'          → BTG Pactual (extrato e fatura)
  //     'neon'         → Neon
  //     'safra'        → Banco Safra (extrato e fatura)
  //     'asaas'        → Asaas (gateway de pagamentos, extrato de conta)
  //     'fatura_generica' → fatura sem banco identificado
  //     'generico'     → fallback
//
// Estratégia: cada banco usa múltiplos indicadores de alta especificidade
// para evitar colisões (ex: 'bradesco' numa descrição de PIX).
export function detectarBanco(texto) {
  const t = texto.toLowerCase();

  // ── Banco do Brasil / Ourocard ─────────────────────────────────────────────
  // Retorna 'bb' (não 'bb_fatura') para que buildPrompt e CHUNK_CONFIG
  // funcionem corretamente com o ID base.
  if (
    t.includes('ourocard') ||
    t.includes('banco do brasil') ||
    (t.includes('bb.com.br') && (t.includes('fatura') || t.includes('extrato'))) ||
    (t.includes('bb.com.br') && t.includes('cartão'))
  ) return 'bb';

  // ── Nubank ─────────────────────────────────────────────────────────────────
  // ATENÇÃO: extratos Nubank contêm "Pagamento de fatura" como TRANSAÇÃO NORMAL
  // (pagamento da fatura do cartão de crédito). Usar apenas 'fatura' como indicador
  // causaria falso positivo — todo extrato seria classificado como nubank_fatura.
  //
  // Indicadores exclusivos de FATURA de cartão Nubank (não aparecem em extrato):
  //   - 'nubank.com.br/fatura'  → URL de pagamento na fatura
  //   - 'fatura de crédito'     → cabeçalho exclusivo da fatura
  //   - 'cartão nubank'         → identificador de cartão
  //   - 'limite do cartão'      → campo de limite da fatura
  //   - 'pagamento mínimo'      → campo exclusivo da fatura de cartão
  //   - 'valor mínimo'          → idem
  //   - vencimento + ••••NNNN  → fatura tem número do cartão mascarado + vencimento
  if (t.includes('nubank') && (
    t.includes('nubank.com.br/fatura') ||
    t.includes('fatura de crédito') ||
    t.includes('cartão nubank') ||
    t.includes('limite do cartão') ||
    t.includes('pagamento mínimo') ||
    t.includes('valor mínimo') ||
    (t.includes('vencimento') && t.includes('••••'))
  )) return 'nubank_fatura';
  if (t.includes('nubank')) return 'nubank';

  // ── Itaú ───────────────────────────────────────────────────────────────────
  // Usar domínio ou nome completo para evitar falso positivo em "Itaú Unibanco"
  // mencionado em outro banco
  if (
    t.includes('itaú unibanco') ||
    t.includes('itau unibanco') ||
    t.includes('itau.com.br') ||
    t.includes('itaú.com.br') ||
    (t.includes('itaú') && (t.includes('extrato') || t.includes('fatura') || t.includes('platinum') || t.includes('infinite'))) ||
    (t.includes('itau') && (t.includes('extrato') || t.includes('fatura') || t.includes('platinum') || t.includes('infinite')))
  ) return 'itau';

  // ── Bradesco ───────────────────────────────────────────────────────────────
  // Usar domínio ou contexto financeiro para evitar falso positivo
  if (
    t.includes('bradesco.com.br') ||
    t.includes('banco bradesco') ||
    (t.includes('bradesco') && (t.includes('extrato') || t.includes('fatura') || t.includes('visa') || t.includes('mastercard') || t.includes('celular')))
  ) return 'bradesco';

  // ── Banco Inter ────────────────────────────────────────────────────────────
  if (
    t.includes('bancointer') ||
    t.includes('banco inter') ||
    t.includes('inter.com.br') ||
    (t.includes('inter') && (t.includes('extrato') || t.includes('fatura') || t.includes('conta corrente')))
  ) return 'inter';

  // ── Santander ──────────────────────────────────────────────────────────────
  if (
    t.includes('santander.com.br') ||
    t.includes('banco santander') ||
    (t.includes('santander') && (t.includes('extrato') || t.includes('fatura') || t.includes('unlimited') || t.includes('smiles')))
  ) return 'santander';

  // ── C6 Bank ────────────────────────────────────────────────────────────────
  if (
    t.includes('c6 bank') ||
    t.includes('c6bank') ||
    t.includes('c6.com.br') ||
    t.includes('c6 platinum') ||
    t.includes('c6 tag') ||
    t.includes('c6 carbon')
  ) return 'c6';

  // ── Caixa Econômica Federal ────────────────────────────────────────────────
  if (
    t.includes('caixa econômica') ||
    t.includes('caixa economica') ||
    t.includes('caixa.gov.br') ||
    t.includes('cartões caixa') ||
    t.includes('cartoes caixa') ||
    t.includes('0800 726 0101') || // SAC Caixa
    t.includes('0800 1040104')
  ) return 'caixa';

  // ── Sicoob ─────────────────────────────────────────────────────────────────
  if (t.includes('sicoob')) return 'sicoob';

  // ── Sicredi ────────────────────────────────────────────────────────────────
  if (t.includes('sicredi')) return 'sicredi';

  // ── BTG Pactual ────────────────────────────────────────────────────────────
  if (
    t.includes('btg pactual') ||
    t.includes('btgpactual') ||
    t.includes('banco btg') ||
    t.includes('btg.com.br') ||
    (t.includes('btg') && (t.includes('extrato') || t.includes('fatura') || t.includes('conta')))
  ) return 'btg';

  // ── Neon ───────────────────────────────────────────────────────────────────
  if (
    t.includes('banco neon') ||
    t.includes('neon pagamentos') ||
    t.includes('neon.com.br') ||
    (t.includes('neon') && (t.includes('extrato') || t.includes('fatura') || t.includes('conta')))
  ) return 'neon';

  // ── Banco Safra ────────────────────────────────────────────────────────────
  if (
    t.includes('banco safra') ||
    t.includes('safra.com.br') ||
    (t.includes('safra') && (t.includes('extrato') || t.includes('fatura') || t.includes('conta')))
  ) return 'safra';

  // ── XP Investimentos ───────────────────────────────────────────────────────
  if (
    t.includes('xp investimentos') ||
    t.includes('xp inc') ||
    t.includes('banco xp') ||
    t.includes('xp.com.br') ||
    t.includes('cartão xp') ||
    t.includes('cartao xp')
  ) return 'xp';

  // ── Mercado Pago ───────────────────────────────────────────────────────────
  if (t.includes('mercado pago') || t.includes('mercadopago')) return 'mercadopago';

  // ── PicPay ─────────────────────────────────────────────────────────────────
  if (t.includes('picpay')) return 'picpay';

  // ── PagBank / PagSeguro ────────────────────────────────────────────────────
  if (t.includes('pagbank') || t.includes('pagseguro')) return 'pagbank';

  // ── Asaas ──────────────────────────────────────────────────────────────────
  // Identificadores de alta especificidade: domínio, texto do extrato e tipos
  // de transação exclusivos do Asaas (gateway de pagamentos, não banco tradicional)
  if (
    t.includes('asaas') ||
    t.includes('asaas.com') ||
    t.includes('cobrança recebida - fatura nr.') ||
    t.includes('taxa do pix - fatura nr.') ||
    t.includes('taxa de boleto - fatura nr.') ||
    t.includes('taxa de mensageria - fatura nr.') ||
    t.includes('taxa de notificação por whatsapp')
  ) return 'asaas';

  // ── Fatura genérica (sem banco identificado) ───────────────────────────────
  if (t.includes('fatura') && (t.includes('vencimento') || t.includes('compras'))) return 'fatura_generica';

  return 'generico';
}

// ── Normaliza data para YYYY-MM-DD ────────────────────────────────────────────
// anoRef  = ano do vencimento da fatura (ex: 2026)
// mesVenc = mês do vencimento 1-12 (ex: 1 para janeiro)
//
// Regra de ano para datas sem ano explícito (formato DD/MM de fatura de cartão):
//   Se o mês da compra > mês do vencimento → a compra é do ano anterior.
//   Ex: fatura vence em Jan/2026 (mesVenc=1), compra em 28/12 → ano = 2025.
//   Isso cobre o ciclo de fatura que começa em dezembro do ano anterior.
function normData(raw = '', anoRef, mesVenc) {
  const s = raw.trim();
  // DD/MM/YYYY ou DD/MM/YY — ano já explícito, usa direto
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m1) {
    const ano = m1[3].length === 2 ? '20' + m1[3] : m1[3];
    return `${ano}-${m1[2]}-${m1[1]}`;
  }
  // DD/MM (fatura de cartão — sem ano)
  const m2 = s.match(/^(\d{2})\/(\d{2})$/);
  if (m2) {
    const dia = m2[1];
    const mes = parseInt(m2[2], 10);
    let ano = anoRef || new Date().getFullYear();
    // Se mesVenc está definido e o mês da compra é POSTERIOR ao mês de vencimento,
    // a compra pertence ao ano anterior ao da fatura.
    if (mesVenc && mes > mesVenc) {
      ano = ano - 1;
    }
    return `${ano}-${String(mes).padStart(2,'0')}-${dia}`;
  }
  // DD-MM-YYYY
  const m3 = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m3) return `${m3[3]}-${m3[2]}-${m3[1]}`;
  // YYYY-MM-DD já ok
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

// ── Normaliza valor numérico ──────────────────────────────────────────────────
function normValor(raw = '') {
  const s = raw.toString().trim().replace(/\s/g, '');
  const neg = s.startsWith('-') || s.includes('- ');
  const limpo = s.replace(/R\$\s?/g, '').replace(/-/g, '').replace(/\./g, '').replace(',', '.');
  const v = parseFloat(limpo);
  return { valor: isNaN(v) ? null : Math.abs(v), negativo: neg };
}

// ── Detecta parcelas ──────────────────────────────────────────────────────────
function detectParcela(desc = '') {
  // PARC 08/12, PARC 03/05, parc 01/04, etc.
  const p1 = desc.match(/PARC\s+(\d{1,2})\/(\d{1,2})/i);
  if (p1) {
    const atual = parseInt(p1[1]), total = parseInt(p1[2]);
    if (total > 1 && atual <= total) return { atual, total };
  }
  // Formato 2/6 solto
  const p2 = desc.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (p2) {
    const atual = parseInt(p2[1]), total = parseInt(p2[2]);
    if (total > 1 && total <= 48 && atual <= total) return { atual, total };
  }
  return { atual: null, total: null };
}

// ── ID único ──────────────────────────────────────────────────────────────────
// ── Competência = mês de vencimento da fatura ──────────────────────────────────
// Toda transação que aparece numa fatura tem competência igual ao mês de vencimento
// dessa fatura, independente de ser parcela 1/12 ou 12/12.
// Ex: fatura Jan/2026 → todas as transações têm competência 2026-01
function calcularCompetencia(anoVenc, mesVenc) {
  if (!anoVenc || !mesVenc) return null;
  return `${anoVenc}-${String(mesVenc).padStart(2, '0')}`;
}

let _idCounter = 0;
function uid() { return `t_${Date.now()}_${_idCounter++}`; }

// ──────────────────────────────────────────────────────────────────────────────
// PARSER BB / OUROCARD / VISA INFINITE (e faturas similares de cartão BR)
//
// O formato de fatura BB pode vir de duas formas:
//   1) Linha completa: DD/MM  DESCRIÇÃO  [CIDADE]  BR  R$ VALOR
//   2) Linha sem "BR": DD/MM  DESCRIÇÃO  R$ VALOR  (ou valor ao final sem prefixo R$)
//
// Seção "Pagamentos/Créditos": itens com valor NEGATIVO → receita (pagamento da fatura)
// Todas as demais seções: itens com valor POSITIVO → despesa (compras)
//
// IMPORTANTE: o pagamento total da fatura aparece como valor negativo na seção
// Pagamentos/Créditos. As compras individuais aparecem como valores positivos
// nas demais seções. Ambos devem ser capturados.
// ──────────────────────────────────────────────────────────────────────────────
function parsarFaturaCartaoBR(texto, nomeBanco) {
  const transacoes = [];
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);

  // ── Extrai mês e ano de vencimento da fatura ───────────────────────────────
  // Estratégia 1: busca "Vencimento" ou "vencimento" com data a seguir
  // Estratégia 2: busca "Datas fatura" ou "Próxima fatura"
  // Estratégia 3: primeira data DD/MM/YYYY encontrada no texto
  let anoRef  = new Date().getFullYear();
  let mesVenc = null; // 1-12

  // Padrão genérico para encontrar qualquer data DD/MM/YYYY no texto
  const todasDatas = [...texto.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];

  // Tenta primeiro: próximo de "vencimento" (qualquer caixa)
  const idxVenc = texto.search(/vencimento/i);
  if (idxVenc !== -1) {
    // Pega os 200 chars após a palavra vencimento
    const trecho = texto.slice(idxVenc, idxVenc + 200);
    const m = trecho.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      anoRef  = parseInt(m[3]);
      mesVenc = parseInt(m[2], 10);
    }
  }

  // Se não achou via vencimento, tenta palavras-chave da fatura
  if (!mesVenc) {
    const marcadores = [/próxima fatura/i, /data de pagamento/i, /datas fatura/i, /fecha(?:mento)?/i];
    for (const re of marcadores) {
      const idx = texto.search(re);
      if (idx !== -1) {
        const trecho = texto.slice(idx, idx + 200);
        const m = trecho.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) { anoRef = parseInt(m[3]); mesVenc = parseInt(m[2], 10); break; }
      }
    }
  }

  // Fallback: primeira data completa do documento
  if (!mesVenc && todasDatas.length > 0) {
    anoRef  = parseInt(todasDatas[0][3]);
    mesVenc = parseInt(todasDatas[0][2], 10);
  }

  // Seções que indicam que os lançamentos são créditos/pagamentos
  const secoesCredito = new Set([
    'pagamentos/créditos', 'pagamentos/creditos', 'créditos', 'creditos',
    'pagamentos e créditos', 'pagamentos e creditos',
  ]);

  // Seções que devem ser IGNORADAS (totais, saldos, cabeçalhos)
  const secoesIgnorar = new Set([
    'subtotal', 'total da fatura', 'informações complementares',
    'compras nacionais', 'compras internacionais', 'tarifas, encargos e multas',
    'saldo parcelado em faturas futuras', 'resumo da fatura', 'encargos financeiros',
    'datas fatura', 'limite do cartão', 'pontos livelo', 'fale conosco',
    'opções de pagamento', 'informacoes complementares',
  ]);

  // ── Padrões de lançamento ──────────────────────────────────────────────────
  // Padrão 1 (com BR): DD/MM  DESC  [CIDADE]  BR  R$ VALOR
  const RE_COM_BR = /^(\d{2}\/\d{2})\s{1,}(.+?)\s{2,}(?:\w[\w\s]*\s{2,})?BR\s{2,}R?\$?\s*([-\s]?[\d.]+,\d{2})\s*$/;
  const RE_COM_BR2 = /^(\d{2}\/\d{2})\s{1,}(.+?)\s+BR\s+R?\$?\s*([-\s]?[\d.]+,\d{2})\s*$/;

  // Padrão 2 (com R$, sem BR): DD/MM  DESC  R$ VALOR
  const RE_COM_RS = /^(\d{2}\/\d{2})\s{1,}(.+?)\s+R\$\s*([-\s]?[\d.]+,\d{2})\s*$/;

  // Padrão 3 (valor numérico direto no final): DD/MM  DESC  -?999,99
  const RE_VALOR_FINAL = /^(\d{2}\/\d{2})\s{1,}(.+?)\s{2,}([-]?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

  // Padrão 4 (flexível – último recurso): DD/MM ... qualquer coisa ... valor
  const RE_FLEX = /^(\d{2}\/\d{2})\s+(.+?)\s+([-]?\s*[\d.]+,\d{2})\s*$/;

  let secaoAtual = '';
  let isSecaoCredito = false;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];

    // ── Ignora linhas de rodapé/cabeçalho ─────────────────────────────
    if (/^Página\s+\d+\/\d+$/i.test(linha)) continue;
    if (/^Albert\s+F\s+M|^Rachel\s+F|^\(Cartão\s+\d+\)/i.test(linha)) continue;
    if (/^Data\s+Descri/i.test(linha)) continue;
    if (/^SALDO FATURA ANTERIOR/i.test(linha)) continue;
    // Ignora linha de total de pagamento (tem "Total" mas não começa com data)
    if (/^total\s+pag/i.test(linha) && !/^\d{2}\/\d{2}/.test(linha)) continue;

    // ── Detecta cabeçalho de seção ─────────────────────────────────────
    if (!/^\d{2}\/\d{2}/.test(linha) && linha.length < 80) {
      const chave = linha.toLowerCase().trim();

      // Remove parênteses e caracteres especiais para comparação
      const chaveNorm = chave.replace(/[()]/g, '').trim();

      if (secoesIgnorar.has(chaveNorm) || secoesIgnorar.has(chave)) {
        secaoAtual = '__ignorar__';
        continue;
      }
      if (/\(Cartão\s+\d+\)/i.test(linha)) { secaoAtual = ''; continue; }

      // Verifica se é seção de crédito
      if (secoesCredito.has(chave) || secoesCredito.has(chaveNorm)) {
        secaoAtual = chave;
        isSecaoCredito = true;
        continue;
      }

      // Se linha não tem data e não tem R$, pode ser cabeçalho de seção
      if (!/R\$/.test(linha)) {
        secaoAtual = chave;
        isSecaoCredito = false;
        continue;
      }
    }

    if (secaoAtual === '__ignorar__') continue;

    // ── Tenta fazer match da linha de lançamento ───────────────────────
    let match =
      linha.match(RE_COM_BR)     ||
      linha.match(RE_COM_BR2)    ||
      linha.match(RE_COM_RS)     ||
      linha.match(RE_VALOR_FINAL)||
      linha.match(RE_FLEX);

    if (!match) continue;

    const dataRaw   = match[1];
    const descricao = match[2].trim();
    const valorRaw  = match[3];

    // Ignora linhas cuja descrição é apenas "Total" ou "Subtotal"
    if (/^(total|subtotal|pagamento m[íi]nimo|encargo|saldo)\b/i.test(descricao)) continue;

    const data = normData(dataRaw, anoRef, mesVenc);
    if (!data) continue;

    const { valor, negativo } = normValor(valorRaw);
    if (valor === null || valor === 0) continue;

    // ── Lógica de tipo ─────────────────────────────────────────────────
    // Seção Pagamentos/Créditos: itens são receitas (pagamentos realizados)
    // Valor negativo em QUALQUER seção: também receita
    // Demais: despesa
    const tipo = (isSecaoCredito || negativo) ? 'receita' : 'despesa';

    // Parcelas
    const { atual, total } = detectParcela(descricao);
    // Competência: mês em que esta parcela é cobrada nesta fatura
    const competencia = calcularCompetencia(anoRef, mesVenc);

    transacoes.push({
      id: uid(),
      data,
      descricao,
      valor,
      tipo,
      categoria: null,
      subcategoria: '',
      conta: nomeBanco,
      competencia,
      parcelaAtual: atual,
      parcelaTotal: total,
      status: 'pendente',
    });
  }

  return transacoes;
}

// ──────────────────────────────────────────────────────────────────────────────
// PARSER ESTRUTURADO – usa posições X/Y para faturas BB Visa Infinite
// Abordagem: extrai itens por coluna (data ≈ x<120, desc ≈ 120<x<500, valor ≈ x>500)
// ──────────────────────────────────────────────────────────────────────────────
async function parsarFaturaCartaoBBEstruturado(file, nomeBanco) {
  let linhasEstruturadas;
  try {
    linhasEstruturadas = await extrairLinhasPDF(file);
  } catch {
    return [];
  }

  // Reconstrói texto completo a partir das linhas estruturadas para busca de datas
  // (corrige bug: variável 'texto' não existe neste escopo)
  const textoReconstruido = linhasEstruturadas
    .map(linha => linha.map(c => c.texto).join('  '))
    .join('\n');

  const transacoes = [];
  // ── Extrai mês e ano de vencimento da fatura (mesmo logic do parsarFaturaCartaoBR) ─
  let anoRef  = new Date().getFullYear();
  let mesVenc  = null; // 1-12
  const todasDatas2 = [...textoReconstruido.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
  const idxVenc2 = textoReconstruido.search(/vencimento/i);
  if (idxVenc2 !== -1) {
    const trecho = textoReconstruido.slice(idxVenc2, idxVenc2 + 200);
    const m = trecho.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) { anoRef = parseInt(m[3]); mesVenc = parseInt(m[2], 10); }
  }
  if (!mesVenc) {
    for (const re of [/próxima fatura/i, /data de pagamento/i, /datas fatura/i, /fecha(?:mento)?/i]) {
      const idx = textoReconstruido.search(re);
      if (idx !== -1) {
        const trecho = textoReconstruido.slice(idx, idx + 200);
        const m = trecho.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) { anoRef = parseInt(m[3]); mesVenc = parseInt(m[2], 10); break; }
      }
    }
  }
  if (!mesVenc && todasDatas2.length > 0) {
    anoRef  = parseInt(todasDatas2[0][3]);
    mesVenc = parseInt(todasDatas2[0][2], 10);
  }

  let isSecaoCredito = false;
  const secoesCredito = new Set([
    'pagamentos/créditos', 'pagamentos/creditos', 'créditos', 'creditos',
    'pagamentos e créditos', 'pagamentos e creditos',
  ]);
  const secoesIgnorar = new Set([
    'subtotal', 'total da fatura', 'resumo da fatura', 'encargos financeiros',
    'informações complementares', 'informacoes complementares',
    'opções de pagamento', 'compras nacionais', 'compras internacionais',
    'tarifas, encargos e multas', 'saldo parcelado em faturas futuras',
  ]);

  for (const linha of linhasEstruturadas) {
    // Texto completo da linha
    const textoLinha = linha.map(c => c.texto).join(' ').trim();

    // Detecta ano e mês de referência (vencimento) na própria linha
    const mVencLinha = textoLinha.match(/[Vv]encimento\s+(\d{2})\/(\d{2})\/(\d{4})/);
    if (mVencLinha) {
      anoRef  = parseInt(mVencLinha[3]);
      mesVenc = parseInt(mVencLinha[2], 10);
    }

    // Detecta seção (linha sem data e sem valor monetário)
    const temData = /^\d{2}\/\d{2}/.test(textoLinha);
    const temValor = /[\d.]+,\d{2}/.test(textoLinha);

    if (!temData && textoLinha.length < 80 && textoLinha.length > 2) {
      const chave = textoLinha.toLowerCase().trim().replace(/[()]/g, '');
      if (secoesIgnorar.has(chave)) { isSecaoCredito = false; continue; }
      if (secoesCredito.has(chave)) { isSecaoCredito = true; continue; }
      if (!temValor) { isSecaoCredito = false; continue; }
    }

    if (!temData || !temValor) continue;

    // Separa campos por posição X
    // Coluna data: x < 100
    // Coluna descricao: 100 <= x < 480
    // Coluna valor: x >= 480
    const camposData  = linha.filter(c => c.x < 100);
    const camposDesc  = linha.filter(c => c.x >= 100 && c.x < 480);
    const camposValor = linha.filter(c => c.x >= 480);

    if (!camposData.length || !camposValor.length) continue;

    const dataRaw   = camposData.map(c => c.texto).join('').trim();
    const descricao = camposDesc.map(c => c.texto).join(' ').trim();
    const valorRaw  = camposValor.map(c => c.texto).join('').trim();

    // Valida data DD/MM
    if (!/^\d{2}\/\d{2}/.test(dataRaw)) continue;

    // Ignora totais
    if (/^(total|subtotal|pagamento m[íi]nimo|encargo|saldo)\b/i.test(descricao)) continue;

    const data = normData(dataRaw.slice(0, 5), anoRef, mesVenc);
    if (!data) continue;

    const { valor, negativo } = normValor(valorRaw);
    if (valor === null || valor === 0) continue;

    const tipo = (isSecaoCredito || negativo) ? 'receita' : 'despesa';
    const { atual, total } = detectParcela(descricao);
    const competencia = calcularCompetencia(anoRef, mesVenc);

    transacoes.push({
      id: uid(),
      data,
      descricao,
      valor,
      tipo,
      categoria: null,
      subcategoria: '',
      conta: nomeBanco,
      competencia,
      parcelaAtual: atual,
      parcelaTotal: total,
      status: 'pendente',
    });
  }

  return transacoes;
}

// ──────────────────────────────────────────────────────────────────────────────
// PARSER NUBANK FATURA
// Formato: DD MMM  DESCRIÇÃO  VALOR (sem "BR")
// ──────────────────────────────────────────────────────────────────────────────
function parsarNubankFatura(texto, nomeBanco) {
  const transacoes = [];
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);

  // Nubank: extrai vencimento com estratégias múltiplas
  let anoRef  = new Date().getFullYear();
  let mesVenc = null;
  const todasDatasN = [...texto.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
  const idxVencN = texto.search(/vencimento/i);
  if (idxVencN !== -1) {
    const trecho = texto.slice(idxVencN, idxVencN + 200);
    const m = trecho.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) { anoRef = parseInt(m[3]); mesVenc = parseInt(m[2], 10); }
  }
  if (!mesVenc && todasDatasN.length > 0) {
    anoRef  = parseInt(todasDatasN[0][3]);
    mesVenc = parseInt(todasDatasN[0][2], 10);
  }

  const mesesAbrev = { jan:'01',fev:'02',mar:'03',abr:'04',mai:'05',jun:'06',jul:'07',ago:'08',set:'09',out:'10',nov:'11',dez:'12' };

  const RE_NUBANK = /^(\d{2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(.+?)\s+([-]?\s*R?\$?\s*[\d.]+,\d{2})\s*$/i;

  for (const linha of linhas) {
    const m = linha.match(RE_NUBANK);
    if (!m) continue;

    const dia = m[1].padStart(2,'0');
    const mesNum = parseInt(mesesAbrev[m[2].toLowerCase()] || '1', 10);
    // Aplica mesma regra: se mês da compra > mês do vencimento → ano anterior
    let ano = anoRef;
    if (mesVenc && mesNum > mesVenc) ano = anoRef - 1;
    const data = `${ano}-${String(mesNum).padStart(2,'0')}-${dia}`;
    const descricao = m[3].trim();
    const { valor, negativo } = normValor(m[4]);
    if (!valor) continue;

    const tipo = negativo ? 'receita' : 'despesa';
    const { atual, total } = detectParcela(descricao);

    const competencia = calcularCompetencia(anoRef, mesVenc);
    transacoes.push({ id: uid(), data, descricao, valor, tipo, categoria: null, subcategoria: '', conta: nomeBanco, competencia, parcelaAtual: atual, parcelaTotal: total, status: 'pendente' });
  }

  return transacoes;
}

// ──────────────────────────────────────────────────────────────────────────────
// PARSER ESTRUTURADO — NUBANK EXTRATO (coordenadas X/Y reais do pdfjs)
//
// Lógica baseada no formato real observado no extrato Nubank (Nu Pagamentos S.A.):
//   • 8 páginas para ~54 transações de 1 mês
//   • Cada página tem cabeçalho repetido (nome, CPF, período) → ignorado
//   • Linha de data: começa em x≈57, formato "DD MMM YYYY" → define data do grupo
//   • Linha de transação: começa em x≈120, termina com valor numérico à direita (x>400)
//   • Linha de continuação (banco/agência): começa em x≈260 → ignorada para transações
//   • Tipo determinado pelo PREFIXO da linha:
//       "Transferência recebida" / "Transferência Recebida" → receita
//       tudo mais → despesa
//
// Retorna texto estruturado limpo para o Gemini, não as transações finais
// (o Gemini faz a categorização e normalização de nomes).
// ──────────────────────────────────────────────────────────────────────────────
export async function extrairTextoNubankExtrato(file) {
  const MESES = { jan:1, fev:2, mar:3, abr:4, mai:5, jun:6, jul:7, ago:8, set:9, out:10, nov:11, dez:12 };

  // ── Filtros de cabeçalho/rodapé — NÃO inclui "total de entradas/saídas" aqui!
  // ATENÇÃO: pdfjs agrupa "DD MMM YYYY  Total de entradas + X" na MESMA linha Y.
  // Se filtrarmos "total de entradas" nesse passo, a data é perdida e ZERO transações
  // são extraídas. A data é capturada ANTES do filtro de "total" no loop abaixo.
  const SKIP_FOOTER_RE = /tem alguma d[úu]vida|metropolitanas|caso a solu[çc][aã]o|dispon[íi]veis em|extrato gerado|nu financeira|cnpj:|asseguramos|n[aã]o nos respons|o saldo l[íi]quido|fale com a ouvidoria|atendimento 24h/i;
  const SKIP_HEADER_RE = /^(kauanne|cpf\s|ag[eê]ncia\s|conta\s+\d|01 de\s+(maio|jan|fev|mar|abr|jun|jul|ago|set|out|nov|dez)|31 de\s+|valores em r\$|saldo\s+(inicial|final|l[íi]quido)|rendimento\s+l[íi]quido|movimenta[çc][oõ]es)/i;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const linhasEstruturadas = []; // { y_abs, x0, texto_da_linha }
  let pageOffsetY = 0;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Agrupa itens por Y (tolerância ±3px dentro da mesma página)
    const byY = {};
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      const x = Math.round(item.transform[4]);
      if (!byY[y]) byY[y] = [];
      byY[y].push({ x, texto: item.str.trim() });
    }

    // Ordena Y decrescente (pdfjs: Y cresce de baixo para cima)
    const ysSorted = Object.keys(byY).map(Number).sort((a, b) => b - a);
    for (const y of ysSorted) {
      const itens = byY[y].sort((a, b) => a.x - b.x);
      const x0 = itens[0].x;
      const textoCru = itens.map(i => i.texto).join(' ');

      // Ignora rodapés e cabeçalhos do extrato
      if (SKIP_FOOTER_RE.test(textoCru)) continue;
      if (SKIP_HEADER_RE.test(textoCru)) continue;
      // Ignora número de página "N de 8" e horário
      if (/^\d+\s+de\s+\d+$/.test(textoCru.trim())) continue;
      if (/às \d+:\d+/.test(textoCru)) continue;
      // Ignora nome/CPF do correntista no cabeçalho
      if (/•{3}\.\d{3}\.\d{3}-••/.test(textoCru) && x0 > 300) continue;

      linhasEstruturadas.push({ y: pageOffsetY + (1000 - y), x0, texto: textoCru });
    }
    pageOffsetY += 1200; // separa páginas no espaço Y absoluto
  }

  // Ordena tudo por Y absoluto (leitura top→bottom, página por página)
  linhasEstruturadas.sort((a, b) => a.y - b.y);

  // ── Reconstrói texto estruturado linha a linha ─────────────────────────────
  //
  // FORMATO REAL DO PDF NUBANK EXTRATO (descoberto com pdfplumber):
  //
  //   LINHA TIPO 1 — Data+Total (x0 < 80):
  //     "01 MAI 2026 Total de entradas + 200,00"
  //     "03 MAI 2026 Total de saídas - 87,59"
  //     pdfjs combina data e subtotal do dia na MESMA linha Y → devemos extrair
  //     apenas a data e ignorar o resto (o total do dia não é uma transação).
  //
  //   LINHA TIPO 2 — Transação (x0 80–200):
  //     "Transferência recebida pelo Pix KM FISIO BANCO INTER 200,00"
  //     "Compra no débito PADOCA 44,78"
  //     "Pagamento de boleto efetuado EASYPLAN 482,01"
  //
  //   LINHA TIPO 3 — Continuação/banco (x0 > 200):
  //     "(0077) Agência: 1 Conta: 31603047-3"
  //     → ignorar (dado bancário, não é transação)
  //
  //   LINHA TIPO 4 — Sub-total do dia solto (x0 ~ 120):
  //     "Total de saídas - 87,59" (sem data na frente)
  //     → ignorar

  let dataAtual = '';
  const linhasTexto = [];

  for (const { x0, texto } of linhasEstruturadas) {
    // ── TIPO 1: Linha de data (x0 < 80) ──────────────────────────────────────
    // Pode começar com "DD MMM YYYY" e CONTINUAR com "Total de entradas/saídas + VALOR"
    // na mesma linha — extraímos apenas a data e ignoramos o resto.
    if (x0 < 80) {
      const mData = texto.match(/^(\d{2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(20\d\d)/i);
      if (mData) {
        const dia = mData[1];
        const mes = String(MESES[mData[2].toLowerCase()]).padStart(2, '0');
        const ano = mData[3];
        dataAtual = `${ano}-${mes}-${dia}`;
      }
      continue; // linha de data OU header da página — nunca emitir
    }

    if (!dataAtual) continue; // antes do primeiro dia → pula

    // ── TIPO 3: Linha de continuação bancária (x0 > 200) ─────────────────────
    if (x0 > 200) continue;

    // ── TIPO 4: Sub-total do dia sem data (x0 ~ 120) ─────────────────────────
    if (/^total de (entradas|sa[íi]das)/i.test(texto)) continue;

    // ── TIPO 2: Linha de transação ────────────────────────────────────────────
    // Limpa artefatos de CPF/CNPJ mascarados que ficam no meio do texto
    const textoLimpo = texto
      .replace(/\s*-\s*•{3}\.\d{3}\.\d{3}-••\s*-?\s*/g, ' ') // CPF mascarado
      .replace(/\s*•{3}\.\d{3}\.\d{3}-••\s*-?\s*/g, ' ')      // CPF mascarado (sem traço)
      .replace(/\s*-\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\s*-?\s*/g, ' ') // CNPJ
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (textoLimpo.length < 5) continue;

    linhasTexto.push(`${dataAtual}  ${textoLimpo}`);
  }

  return linhasTexto.join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// PARSER GENÉRICO (extrato de conta corrente)
// Tenta detectar: DATA  DESCRIÇÃO  VALOR  [C/D]
// ──────────────────────────────────────────────────────────────────────────────
function parsarGenerico(texto, nomeBanco) {
  const transacoes = [];
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  let anoRef = new Date().getFullYear();
  const mAno = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (mAno) anoRef = parseInt(mAno[3]);

  const SKIP = /total|saldo|limite|vencimento|período|extrato|banco|agência|conta|cliente|cpf|cnpj|sac\s|ouvidoria|fatura|resumo|pagamento mínimo/i;

  for (const linha of linhas) {
    if (linha.length < 10) continue;
    if (SKIP.test(linha)) continue;

    // Padrão: DD/MM/YYYY ... R$ VALOR [C|D]?
    const m = linha.match(/(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+R?\$?\s*([-]?[\d.]+,\d{2})\s*([CD])?/);
    if (!m) continue;

    const data = normData(m[1], anoRef);
    if (!data) continue;
    const descricao = m[2].trim();
    const { valor, negativo } = normValor(m[3]);
    if (!valor) continue;

    const sufixo = (m[4] || '').toUpperCase();
    let tipo = 'despesa';
    if (sufixo === 'C') tipo = 'receita';
    else if (sufixo === 'D') tipo = 'despesa';
    else if (negativo) tipo = 'receita';
    else if (/receb|crédit|salário|rend/i.test(descricao)) tipo = 'receita';

    const { atual, total } = detectParcela(descricao);
    transacoes.push({ id: uid(), data, descricao, valor, tipo, categoria: null, subcategoria: '', conta: nomeBanco, parcelaAtual: atual, parcelaTotal: total, status: 'pendente' });
  }

  return transacoes;
}

// ──────────────────────────────────────────────────────────────────────────────
// PARSER FATURA ITAÚ — layout de 2 colunas (coordenadas X/Y reais do pdfjs)
//
// A fatura Itaú usa layout de 2 colunas na mesma página:
//   • Coluna ESQUERDA (x < 340): "Pagamentos efetuados" → receita (pagamentos)
//   • Coluna DIREITA  (x ≥ 340): "Lançamentos: compras e saques" → despesa
//
// O parser de texto plano (parsarFaturaCartaoBR) mistura as colunas porque a
// extração linear coloca elementos da mesma linha Y numa única string — o
// pagamento e o lançamento aparecem concatenados e o tipo fica errado.
//
// Estratégia:
//   1. Para cada linha Y, separar elementos por coluna (x < 340 vs x ≥ 340)
//   2. Processar cada coluna independentemente
//   3. Coluna esquerda: data x≈133, desc x≈161-310, valor x≈300-340
//      Coluna direita:  data x≈340-360, desc x≈370-520, valor x≈520+
// ──────────────────────────────────────────────────────────────────────────────
async function parsarFaturaItau(file, nomeBanco) {
  let linhasEstruturadas;
  try {
    linhasEstruturadas = await extrairLinhasPDF(file);
  } catch {
    return [];
  }

  const textoReconstruido = linhasEstruturadas
    .map(linha => linha.map(c => c.texto).join('  '))
    .join('\n');

  // Extrai ano/mês de vencimento
  let anoRef  = new Date().getFullYear();
  let mesVenc = null;
  const idxVenc = textoReconstruido.search(/vencimento/i);
  if (idxVenc !== -1) {
    const trecho = textoReconstruido.slice(idxVenc, idxVenc + 200);
    const m = trecho.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) { anoRef = parseInt(m[3]); mesVenc = parseInt(m[2], 10); }
  }
  if (!mesVenc) {
    const todasDatas = [...textoReconstruido.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
    if (todasDatas.length > 0) {
      anoRef  = parseInt(todasDatas[0][3]);
      mesVenc = parseInt(todasDatas[0][2], 10);
    }
  }

  const transacoes = [];

  // Agrupa campos por Y (com tolerância ±4px) para juntar itens da mesma linha
  const linhasPorY = {};
  for (const linha of linhasEstruturadas) {
    for (const campo of linha) {
      const yKey = Math.round(campo.y / 4) * 4;
      if (!linhasPorY[yKey]) linhasPorY[yKey] = [];
      linhasPorY[yKey].push(campo);
    }
  }

  const ysOrdenados = Object.keys(linhasPorY).map(Number).sort((a, b) => b - a);

  // Seções que indicam pagamentos (coluna esquerda da fatura Itaú)
  // Neste layout, a coluna esquerda SEMPRE é pagamentos — mas usamos
  // a heurística de valor negativo para confirmar
  const IGNORAR_RE = /^(total|subtotal|data\s+estabelec|valor\s+em|limite\s+total|limite\s+dispon|encargo|saldo\s+financ|lançamento[s]?\s+no\s+cart|próxima\s+fatura|demais\s+faturas|total\s+para\s+próx|compras\s+parceladas|lançamentos:\s+produtos|lançamentos\s+produtos)/i;

  for (const y of ysOrdenados) {
    const campos = linhasPorY[y].sort((a, b) => a.x - b.x);

    // Separa em coluna esquerda (pagamentos) e direita (lançamentos)
    // Divisor: x = 340 (baseado na análise do PDF real)
    const colEsq = campos.filter(c => c.x < 340);
    const colDir = campos.filter(c => c.x >= 340);

    // Função auxiliar para extrair uma transação de um conjunto de campos
    // isCredito = true → tipo será 'receita' se valor positivo (pagamento da fatura)
    const extrairTransacao = (cols, isCredito) => {
      if (!cols.length) return;

      // Primeiro campo: deve ser data DD/MM
      const primeiroTexto = cols[0].texto.trim();
      if (!/^\d{2}\/\d{2}$/.test(primeiroTexto)) return;

      // Último campo com valor numérico
      const camposValor = cols.filter(c => /^-?[\d.]+,\d{2}$/.test(c.texto.trim()));
      if (!camposValor.length) return;

      const valorRaw = camposValor[camposValor.length - 1].texto.trim();
      const xValor   = camposValor[camposValor.length - 1].x;

      // Campos de descrição: entre o primeiro (data) e o último valor
      const camposDesc = cols.filter(c =>
        c.x > cols[0].x &&
        c.x < xValor &&
        !/^\d{2}\/\d{2}$/.test(c.texto.trim()) &&
        !/^-?[\d.]+,\d{2}$/.test(c.texto.trim())
      );

      const descricao = camposDesc.map(c => c.texto).join(' ').trim();
      if (!descricao) return;

      // Ignora linhas de totais/cabeçalhos
      if (IGNORAR_RE.test(descricao)) return;
      if (/^(total|subtotal|pagamento\s+m[íi]nimo|encargo|saldo)\b/i.test(descricao)) return;

      const data = normData(primeiroTexto, anoRef, mesVenc);
      if (!data) return;

      const { valor, negativo } = normValor(valorRaw);
      if (!valor || valor === 0) return;

      // Coluna esquerda (pagamentos): valor negativo → receita (pagamento efetuado)
      // Coluna direita (lançamentos): despesa (compras)
      // Valores negativos em qualquer coluna (ex: estornos) → receita
      const tipo = (isCredito && !negativo) ? 'receita' : negativo ? 'receita' : 'despesa';

      const { atual, total } = detectParcela(descricao);
      const competencia = calcularCompetencia(anoRef, mesVenc);

      transacoes.push({
        id: uid(),
        data,
        descricao,
        valor,
        tipo,
        categoria: null,
        subcategoria: '',
        conta: nomeBanco,
        competencia,
        parcelaAtual: atual,
        parcelaTotal: total,
        status: 'pendente',
      });
    };

    // Processa coluna esquerda como pagamentos (receita)
    extrairTransacao(colEsq, true);
    // Processa coluna direita como lançamentos (despesa)
    extrairTransacao(colDir, false);
  }

  return transacoes;
}

// ── Entrada principal: parseia PDF ────────────────────────────────────────────
export async function parsePDF(file, nomeContaOverride = '') {
  const texto = await extrairTextoPDF(file);
  const banco = detectarBanco(texto);
  const nomeConta = nomeContaOverride || nomeDisplay(banco, file.name);

  let transacoes = [];

  switch (banco) {
    case 'bb':
    case 'fatura_generica': {
      // Tenta parser por texto primeiro
      transacoes = parsarFaturaCartaoBR(texto, nomeConta);

      // Se capturou poucos itens (só o pagamento total, sem as compras),
      // tenta o parser estruturado baseado em coordenadas X/Y
      if (transacoes.length < 3) {
        const estruturado = await parsarFaturaCartaoBBEstruturado(file, nomeConta);
        if (estruturado.length > transacoes.length) {
          transacoes = estruturado;
        }
      }
      break;
    }
    case 'itau': {
      // Fatura Itaú usa layout de 2 colunas — parser dedicado que separa
      // coluna de pagamentos (esquerda = receita) de lançamentos (direita = despesa).
      // O parser de texto plano (parsarFaturaCartaoBR) mistura as colunas e
      // gera tipo incorreto para todos os lançamentos.
      transacoes = await parsarFaturaItau(file, nomeConta);

      // Fallback: se o parser estruturado capturou poucos itens, tenta texto plano
      if (transacoes.length < 3) {
        const textual = parsarFaturaCartaoBR(texto, nomeConta);
        if (textual.length > transacoes.length) transacoes = textual;
      }
      break;
    }
    case 'nubank_fatura':
      transacoes = parsarNubankFatura(texto, nomeConta); break;
    case 'nubank':
      // Nubank extrato: o parser genérico não funciona pois o formato é
      // orientado a "grupos de dia" sem datas em cada linha individual.
      // extrairTextoNubankExtrato() gera texto estruturado com coordenadas X/Y
      // que é passado ao Gemini via processPdf.service.js.
      // Aqui retornamos vazio — o texto correto será extraído no service antes
      // de chamar a Edge Function (via campo textoPDF já pré-processado).
      transacoes = []; break;
    default:
      // Tenta fatura primeiro, depois genérico
      transacoes = parsarFaturaCartaoBR(texto, nomeConta);
      if (transacoes.length < 3) {
        transacoes = parsarGenerico(texto, nomeConta);
      }
      if (transacoes.length < 3) {
        const estruturado = await parsarFaturaCartaoBBEstruturado(file, nomeConta);
        if (estruturado.length > transacoes.length) {
          transacoes = estruturado;
        }
      }
      break;
  }

  // Remove duplicatas exatas
  const seen = new Set();
  transacoes = transacoes.filter(t => {
    const key = `${t.data}|${t.descricao}|${t.valor}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Garante nome da conta em todas
  transacoes = transacoes.map(t => ({ ...t, conta: nomeConta }));

  return { transacoes, banco: nomeBancoLabel(banco), textoOriginal: texto };
}

function nomeDisplay(banco, nomeArquivo = '') {
  const mapa = {
    bb: 'BB Ourocard', itau: 'Itaú', bradesco: 'Bradesco',
    inter: 'Inter', santander: 'Santander', c6: 'C6 Bank', caixa: 'Caixa',
    sicoob: 'Sicoob', sicredi: 'Sicredi', xp: 'XP', mercadopago: 'Mercado Pago',
    picpay: 'PicPay', pagbank: 'PagBank', nubank: 'Nubank', nubank_fatura: 'Nubank',
    btg: 'BTG Pactual', neon: 'Neon', safra: 'Banco Safra',
    fatura_generica: 'Cartão',
  };
  return mapa[banco] || nomeArquivo.replace(/\.pdf$/i, '');
}

function nomeBancoLabel(banco) {
  const mapa = {
    bb: 'Banco do Brasil', nubank_fatura: 'Nubank', nubank: 'Nubank',
    itau: 'Itaú', bradesco: 'Bradesco', inter: 'Inter', santander: 'Santander',
    c6: 'C6 Bank', caixa: 'Caixa', sicoob: 'Sicoob', sicredi: 'Sicredi',
    xp: 'XP Investimentos', mercadopago: 'Mercado Pago', picpay: 'PicPay',
    pagbank: 'PagBank', btg: 'BTG Pactual', neon: 'Neon', safra: 'Banco Safra',
    fatura_generica: 'Cartão (genérico)',
  };
  return mapa[banco] || banco;
}
