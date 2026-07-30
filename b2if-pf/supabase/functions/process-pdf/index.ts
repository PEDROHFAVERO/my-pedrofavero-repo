/**
 * process-pdf v7.2 — Prompts específicos por banco + chunking
 *
 * ARQUITETURA:
 *   1. Browser extrai texto do PDF (pdfjs-dist, ~1s)
 *   2. POST /process-pdf com { textoPDF, nomeConta, banco, tipoPDF, chunkIndex, totalChunks }
 *   3. Edge Function abre SSE response IMEDIATAMENTE
 *   4. Etapa 1: identifica tipo se não informado (~3s) → envia progress
 *   5. Etapa 2: extrai lançamentos com prompt ESPECÍFICO POR BANCO via stream
 *   6. Pós-processamento: normaliza US format (Sicoob), valida JSON, envia "result"
 *
 * Bancos com prompts dedicados:
 *   bradesco_extrato, bradesco_fatura, sicoob_extrato, sicoob_fatura,
 *   mercadopago_extrato, mercadopago_fatura, inter_extrato, inter_fatura,
 *   caixa_fatura, itau, santander, c6, sicredi, xp,
 *   nubank_extrato, nubank_fatura, bb_extrato, bb_fatura, asaas_extrato
 *
 * v7.2 vs v7.1:
 *   + bb_fatura: prompt completamente reescrito com conhecimento real do formato
 *     Ourocard Visa Infinite (múltiplos titulares, seções por tipo, DD/MM sem ano,
 *     Pagamentos/Créditos = sinal invertido, PARC NN/MM, IOF ignorado, Subtotal ignorado)
 *
 * v7.1 vs v7.0:
 *   + bb_extrato: prompt completamente reescrito com conhecimento real do formato
 *     (colunas embaralhadas, poupança vinculada automática, seções Informações
 *     Adicionais e Aplicações Financeiras ignoradas, Cashback e Clube de benefícios)
 *   + asaas_extrato: novo prompt para gateway Asaas (microtaxas por cobrança)
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
// gemini-2.5-flash-lite: sem thinking por padrão, mais rápido e barato.
// Ideal para extração estruturada de JSON (tarefa determinística, não precisa de raciocínio profundo).
// thinkingBudget=0 explícito como segurança extra para evitar qualquer thinking acidental.
const GEMINI_MODEL   = 'gemini-2.5-flash-lite';
const GEMINI_BASE    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection':   'keep-alive',
  ...CORS,
};

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── Gemini generateContent (sem stream — só para identificação rápida) ─────────
// thinkingBudget=0 desabilita o raciocínio interno do Gemini 2.5 Flash.
// Sem isso, o modelo gasta tokens de thinking desnecessários para tarefas simples.
async function geminiCall(prompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_BASE}:generateContent?key=${GEMINI_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).substring(0, 200)}`);
  const d = await res.json();
  return d?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── Gemini streamGenerateContent — retorna ReadableStream de chunks de texto ──
// thinkingBudget=0 é CRÍTICO para evitar timeout:
// O Gemini 2.5 Flash por padrão gera raciocínio interno (thinking tokens)
// que pode chegar a 30k+ chars antes do JSON, causando timeout de 60s na Edge Function.
// Com thinkingBudget=0, vai direto para o JSON de resposta.
function geminiStream(prompt: string): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      const res = await fetch(
        `${GEMINI_BASE}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 65536,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        },
      );

      if (!res.ok) {
        controller.error(new Error(`Gemini stream HTTP ${res.status}`));
        return;
      }

      const reader = res.body!.getReader();
      const dec    = new TextDecoder();
      let   buf    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });

        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const obj   = JSON.parse(raw);
            const parts = obj?.candidates?.[0]?.content?.parts ?? [];
            for (const part of parts) {
              // Ignorar partes de raciocínio interno (thought=true) do Gemini 2.5
              // Mesmo com thinkingBudget=0, filtramos por segurança
              if (part.thought === true) continue;
              const text = part.text ?? '';
              if (text) controller.enqueue(text);
            }
          } catch (_) {}
        }
      }
      controller.close();
    },
  });
}

function extrairJSON(text: string): unknown[] {
  const limpo = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const m = limpo.match(/\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) {} }

  // ── JSON Repair: array truncado (resposta cortada pelo Gemini) ──────────
  // Estratégia: encontra o início do array e tenta recuperar objetos completos
  const arrStart = limpo.indexOf('[');
  if (arrStart !== -1) {
    const partial = limpo.slice(arrStart);
    // Remove o último objeto incompleto: encontra a última ',' após '}'
    // e corta tudo depois do último objeto completo
    const lastComplete = partial.lastIndexOf('},');
    if (lastComplete !== -1) {
      const repaired = partial.slice(0, lastComplete + 1) + ']';
      try {
        const parsed = JSON.parse(repaired);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.warn(`[extrairJSON] JSON reparado: ${parsed.length} itens recuperados de resposta truncada`);
          return parsed;
        }
      } catch (_) {}
    }
    // Tenta recuperar ao menos o primeiro objeto completo
    const firstObjEnd = partial.indexOf('}');
    if (firstObjEnd !== -1) {
      const repaired = '[' + partial.slice(1, firstObjEnd + 1) + ']';
      try {
        const parsed = JSON.parse(repaired);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.warn(`[extrairJSON] JSON reparado (1 item): resposta truncada`);
          return parsed;
        }
      } catch (_) {}
    }
  }

  throw new Error(`JSON inválido. Amostra: ${limpo.substring(0, 200)}`);
}

function normFormato(f: string, isFatura: boolean): string {
  if (isFatura) return 'cartao_credito';
  const fl = (f ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (fl.includes('ted') || fl.includes('doc'))                                          return 'ted';
  if (fl.includes('pix') || fl.includes('transfer'))                                     return 'pix';
  if (fl.includes('debito') || fl.includes('debit') || fl.includes('cartao_debito'))    return 'cartao_debito';
  if (fl.includes('credito') || fl.includes('credit') || fl.includes('cartao_credito')) return 'cartao_credito';
  if (fl.includes('dinheiro') || fl.includes('especie') || fl.includes('saque'))        return 'dinheiro';
  if (fl.includes('boleto') || fl.includes('conta'))                                     return 'boleto';
  return 'pix';
}

// ── Normaliza valor em US format: "3,394.10" → 3394.10 ──────────────────────
// Sicoob fatura usa vírgula como separador de milhar e ponto como decimal
function normalizarValorUS(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const s = v.trim();
    // Detecta US format: tem vírgula E ponto, e o ponto está DEPOIS da vírgula
    // ex: "3,394.10" — vírgula em posição 1, ponto em posição 5
    const commaIdx = s.lastIndexOf(',');
    const dotIdx   = s.lastIndexOf('.');
    if (commaIdx !== -1 && dotIdx !== -1 && commaIdx < dotIdx) {
      // US format: remove vírgulas (milhar), ponto é decimal
      return parseFloat(s.replace(/,/g, ''));
    }
    // BR format: remove pontos (milhar), troca vírgula por ponto
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  return Number(v);
}

// CAT_MACRO v5.0 — APENAS IDs ativos (sem oculto:true em categorias.js)
// Macro 'Despesas Essenciais' = era 'Despesas Fixas' no v4.0
const CAT_MACRO: Record<string, string> = {
  // Receitas
  salario:'Receitas', ferias:'Receitas', decimo_terceiro:'Receitas', pro_labore:'Receitas',
  bonus_plr:'Receitas', dividendos:'Receitas', rec_investimentos:'Receitas',
  renda_extra:'Receitas', aluguel_rec:'Receitas', reembolso:'Receitas',
  emprestimo_rec:'Receitas', restituicao_irpf:'Receitas', resgates:'Receitas',
  // Despesas Essenciais (v5.0 — era 'Despesas Fixas' no v4.0)
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

const MESES_PT: Record<string, string> = {
  '01':'Janeiro','02':'Fevereiro','03':'Março','04':'Abril',
  '05':'Maio','06':'Junho','07':'Julho','08':'Agosto',
  '09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro',
};

// PROMPT_CATEGORIAS v5.1 — APENAS IDs ativos (sem oculto:true) + REGRA DE SINAL
// Macro correto: 'Despesas Essenciais' (era 'Despesas Fixas' no v4.0)
const PROMPT_CATEGORIAS = `Escolha a categoria (ID exato) e o macro correto:
Receitas → salario, ferias, decimo_terceiro, pro_labore, dividendos, rec_investimentos, renda_extra, aluguel_rec, bonus_plr, reembolso, emprestimo_rec, restituicao_irpf, resgates
Despesas Essenciais → aluguel_prest, condominio, iptu, energia, agua, gas, internet, telefone, celular, manutencao_res, saude, plano_odonto, farmacia, consulta, academia, seguro_vida, seguro_carro, seguro_res, faculdade_mba, mensalidade_escolar, material_didatico, transp_escolar, assinaturas, anuidade, impostos, ipva, passagem, combustivel, manutencao, estacionamento, lava_jato, uber, aluguel_financ_veiculo, salario_diaria, encargos, prestador, supermercado, feira, acougue
Consumo Mensal → alimentacao_fora, personal, esporte, beleza, cosmeticos, vestuario, acessorios, lazer, streaming, viagem, clube, pets, doacoes, presente, papelaria, comemoracoes, livro_curso, outros
Dívidas → fin_cartao, emprestimo, emprestimo_part, juros_div
Investimentos → reserva, investimento, previdencia, custodia, custos_op, iof, ir, perdas
Fluxo Interno → entre_contas, saque_fisico, pgto_fatura
REGRA DE SINAL (OBRIGATÓRIA): valor POSITIVO (entrada) → use SOMENTE categorias de Receitas | valor NEGATIVO (saída) → use SOMENTE categorias de Despesas Essenciais, Consumo Mensal, Dívidas, Investimentos ou Fluxo Interno | Coringa entradas: renda_extra | Coringa saídas: outros`;

// ── Fábrica de prompts específicos por banco × tipo ──────────────────────────
function buildPrompt(
  banco: string,
  isFatura: boolean,
  textoTruncado: string,
  anoDoc: number,
  anoFechamento: number,
  mesFechamento: number,
  promptCategorias: string = PROMPT_CATEGORIAS,
): string {
  // Chave composta: banco_tipo (ex: bradesco_extrato, sicoob_fatura)
  const chave = `${banco}_${isFatura ? 'fatura' : 'extrato'}`;

  // ── BRADESCO EXTRATO ────────────────────────────────────────────────────────
  if (chave === 'bradesco_extrato') {
    return `Você é especialista em extratos bancários brasileiros do Bradesco.

FORMATO DESTE EXTRATO:
- Cabeçalho de cada página: "Bradesco Celular | Data: ... | Nome: ..."
- Colunas: Data | Histórico | Docto. | Crédito (R$) | Débito (R$) | Saldo (R$)
- CADA TRANSAÇÃO OCUPA 2-3 LINHAS:
  Linha 1: Tipo da transação (ex: "PIX RECEBIDO", "PIX ENVIADO", "PAGTO ELETRON COBRANCA")
  Linha 2: Número do documento + valor crédito + valor débito + saldo (ex: "1614493  6.320,00  5.180,95")
  Linha 3 (opcional): Complemento com REM: ou DES: (ex: "REM: GR C E S LTDA - EPP 01/04")
- DATA: aparece sozinha em linha como "DD/MM/YYYY" antes de um grupo de transações do mesmo dia
- CRÉDITO = entrada (valor positivo), DÉBITO = saída (valor negativo)

REGRAS:
1. VALOR: coluna Crédito → positivo. Coluna Débito → negativo.
2. DATA: formato YYYY-MM-DD. Ano ${anoDoc}.
3. DESCRICAO: combine tipo + complemento. Ex: "PIX RECEBIDO - REM: GR C E S LTDA"
4. FORMATO: "Pix" para PIX, "Boleto" para PAGTO ELETRON COBRANCA, "Debito" para demais.
5. PARCELAS: parcelaAtual=1, parcelaTotal=1 para todas.
6. ${promptCategorias}

IGNORAR COMPLETAMENTE:
- "COD. LANC. 0" (linha de saldo inicial)
- "ENCARGOS LIMITE DE CRED", "IOF S/ UTILIZACAO LIMITE" (encargos de cheque especial)
- "RENTAB.INVEST FACILCRED" (rendimento de investimento automático)
- "TARIFA BANCARIA", "CESTA EXCLUS. MAX" (tarifas)
- "BLOQUEI-ORDEM JUDICIAL", "DESBLOQUEI-ORDEM JUDICIAL" (bloqueios judiciais)
- Linhas que começam com "REM:", "DES:", "FAV:" (são complementos, não transações)
- Linhas com somente saldo ou total
- "SALDO ANTERIOR", "Folha:", "Total"

Retorne APENAS o array JSON:
[{"descricao":"PIX RECEBIDO - GR C E S LTDA","valor":6320.00,"data":"${anoDoc}-04-01","categoria":"renda_extra","macro":"Receitas","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO BRADESCO:
${textoTruncado}`;
  }

  // ── BRADESCO FATURA ─────────────────────────────────────────────────────────
  if (chave === 'bradesco_fatura') {
    return `Você é especialista em faturas de cartão de crédito Bradesco (Visa Signature/Platinum).

FORMATO DESTA FATURA:
- Cabeçalho com código de barras longo na primeira linha (ignorar)
- Resumo: "Total da fatura R$ X.XXX,XX | Vencimento DD/MM/YYYY"
- Tabela de lançamentos: "Data  Histórico de Lançamentos  Cidade  US$  R$"
- DATA: DD/MM (sem ano). Ano de referência: ${anoFechamento}, mês de fechamento: ${mesFechamento}.
  Se mês da compra > mês de fechamento, a compra é do ano ${anoFechamento - 1}.
- VALOR: coluna final em R$. Valores com sufixo "-" ou entre parênteses = crédito/pagamento (positivo no sistema).
- PARCELAS: aparecem na descrição como "01/02", "03/05", ou "PARC=NxDESC" ou "Parcela N/M"

REGRAS:
1. VALOR: compras NEGATIVO, pagamentos/créditos/estornos POSITIVO.
2. Pagamentos identificados por "PAGTO ANTECIPADO", "OBRIGADO PELO PAGAMENTO", valores com sufixo "-"
3. FORMATO: sempre "Credito" (fatura de cartão).
4. DESCRICAO: copie exatamente, incluindo parcela se houver.
5. PARCELAS: extraia "parcelaAtual" e "parcelaTotal" de "01/02" → atual=1, total=2.
6. ${promptCategorias}

IGNORAR:
- Cabeçalho (código de barras, limites, taxas)
- Resumo da fatura (Saldo anterior, Créditos/Pagamentos, Total)
- Seção "Taxas mensais" e tabelas de taxas
- "Total parcelados para próximas faturas"
- Linhas de rodapé com informações bancárias

Retorne APENAS o array JSON:
[{"descricao":"VX CASE GOIANIA","valor":-349.00,"data":"${anoFechamento}-06-03","categoria":"outros","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DA FATURA BRADESCO:
${textoTruncado}`;
  }

  // ── SICOOB EXTRATO ──────────────────────────────────────────────────────────
  if (chave === 'sicoob_extrato') {
    return `Você é especialista em extratos de conta corrente do Sicoob (cooperativa de crédito).

FORMATO DESTE EXTRATO:
- Cabeçalho: "EXTRATO CONTA CORRENTE | PERÍODO: DD/MM/YYYY - DD/MM/YYYY"
- CADA TRANSAÇÃO PODE OCUPAR MÚLTIPLAS LINHAS:
  Linha 1: "DD/MM  HISTORICO  VALOR[C|D]"  (ex: "03/06  PIX RECEB.OUTRA IF  200,00C")
  Linhas seguintes: detalhes opcionais (Recebimento Pix, nome, CPF mascarado, DOC:)
- SUFIXO DO VALOR: "C" = Crédito (entrada positiva), "D" = Débito (saída negativa)
- DATA: formato DD/MM sem ano. Use o ano do período indicado no cabeçalho: ${anoDoc}.

TIPOS DE TRANSAÇÃO E FORMATO:
- "PIX RECEB.OUTRA IF" / "TRANSF.RECEB-PIX SI" → Pix recebido → positivo → formato "Pix"
- "PIX EMIT.OUTRA IF" / "DB.TR.C.DIF.TIT.INT" / "TRANSF. PIX SICOOB" → Pix enviado → negativo → formato "Pix"
- "PIX.EMIT.OUT IF-MSM" → Pix para si mesmo → negativo → formato "Pix" → categoria "entre_contas"
- "DEB PACOTE SERVIÇOS" / "TARIFA" / "CESTA DE RELACIONAMENTO" → impostos/taxas → negativo → "impostos"
- "DÉB.TRANSF.POU.INTE" / "DEB.PARC.SUBS/INTEG" → débitos internos → negativo → "entre_contas"
- "DÉB.CONV.DEM.EMPRES" → débito de fatura de cartão → negativo → "fin_cartao"
- "DÉB. CONV. SEGUROS" → seguro → negativo → "seguro_vida"
- "LIQUIDACAO BOLETO" / "PAGAMENTO PIX" → pagamentos → negativo → "boleto"
- "RECEBIMENTO PIX" → receita → positivo → "Pix"
- "CHQ CMP INTEGRADA" → cheque → negativo → "outros"

REGRAS:
1. VALOR: sufixo "C" → positivo, sufixo "D" → negativo.
2. DATA: YYYY-MM-DD usando ano ${anoDoc}.
3. DESCRICAO: combine histórico + nome do favorecido/remetente quando disponível.
4. ${promptCategorias}
5. PARCELAS: parcelaAtual=1, parcelaTotal=1.

IGNORAR:
- "SALDO DO DIA", "SALDO ANTERIOR", "SALDO BLOQ.*"
- Linhas com apenas CPF mascarado (***.**.*-**)
- Linhas com apenas "DOC.:", "REM.:", "FAV.:"
- "CRÉD LIBER JUDICIAL" (bloqueio judicial liberado)
- Linhas de resumo final (SALDO DISPONÍVEL, CHEQUE ESPECIAL, etc.)

Retorne APENAS o array JSON:
[{"descricao":"PIX RECEBIDO - GUILHERME NEVES VAZ MACIEL SOUTO","valor":200.00,"data":"${anoDoc}-06-03","categoria":"renda_extra","macro":"Receitas","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO SICOOB:
${textoTruncado}`;
  }

  // ── SICOOB FATURA ───────────────────────────────────────────────────────────
  if (chave === 'sicoob_fatura') {
    return `Você é especialista em faturas de cartão de crédito do Sicoob.

ATENÇÃO — FORMATO DE NÚMEROS AMERICANO:
Esta fatura usa vírgula como separador de milhar e PONTO como decimal.
EXEMPLOS: "3,394.10" = R$ 3394,10 | "546.61" = R$ 546,61 | "15,000.00" = R$ 15000,00
Converta TODOS os valores para número decimal antes de retornar (ex: 3394.10, 546.61).

FORMATO DA FATURA:
- Período: "REF DD MMM A DD MMM" (ex: "REF 12 MAI A 12 JUN")
- Vencimento: "VENCIMENTO DD MMM YYYY"
- Lançamentos podem estar em tabela com colunas "Data e hora | Compra | Descrição | Parcela | Valor"
- DATA: formato "DD/mmm" ou "DD/mmm AAAA". Use ano de vencimento: ${anoFechamento}.
  Se mês da compra > mês de fechamento (${mesFechamento}), use ano ${anoFechamento - 1}.

REGRAS:
1. VALOR: compras NEGATIVO, pagamentos/créditos POSITIVO. Usar número decimal (ex: -1323.86).
2. FORMATO: sempre "Credito".
3. DESCRICAO: copie exatamente.
4. PARCELAS: "02/03" → parcelaAtual=2, parcelaTotal=3. Sem parcela → 1/1.
5. "Anuidade Diferenc" → categoria "anuidade", macro "Despesas Essenciais".
6. "Pagamento" (linha de pagamento da fatura anterior) → POSITIVO → categoria "fin_cartao".
7. ${promptCategorias}

IGNORAR:
- Totais da fatura, limites, taxas e encargos financeiros
- "PAGAMENTO MÍNIMO", "ENCARGOS NO CASO DE PAGAMENTO MÍNIMO"
- Seções de tarifas de serviços e instruções

Retorne APENAS o array JSON:
[{"descricao":"Jim Com Gislaine A","valor":-568.10,"data":"${anoFechamento}-03-24","categoria":"outros","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":2,"parcelaTotal":3}]

TEXTO DA FATURA SICOOB:
${textoTruncado}`;
  }

  // ── MERCADO PAGO EXTRATO ────────────────────────────────────────────────────
  if (chave === 'mercadopago_extrato') {
    return `Você é especialista em extratos de conta do Mercado Pago.

FORMATO DESTE EXTRATO:
- Colunas: Data | Descrição | ID da operação | Valor | Saldo
- DATA: formato DD-MM-YYYY (com hífens). Ex: "01-06-2026" → data "2026-06-01".
- VALOR: sempre positivo na coluna. Determine o tipo pela DESCRIÇÃO:
  → RECEITA (positivo): "Pix recebido", "Venda de criptomoedas", "Reembolso"
  → DESPESA (negativo): "Pagamento Cartão de crédito", "Pagamento de parcela Empréstimos"
  → IGNORAR completamente: "Rendimentos" (rendimento diário da conta)
- Descrições podem quebrar em 2 linhas (nome do destinatário na linha de baixo)

REGRAS:
1. VALOR: entradas POSITIVO, saídas NEGATIVO.
2. DATA: converta DD-MM-YYYY para YYYY-MM-DD.
3. FORMATO: "Pix" para Pix recebido/enviado; "Boleto" para pagamento de parcela.
4. ID DA OPERAÇÃO: ignorar completamente (não incluir na descrição).
5. DESCRICAO: use somente o tipo de transação + nome. Ex: "Pix recebido - GUILHERME NEVES VAZ"
6. ${promptCategorias}
7. PARCELAS: parcelaAtual=1, parcelaTotal=1.

IGNORAR COMPLETAMENTE:
- Qualquer linha com "Rendimentos" (são rendimentos diários de ~R$0,05)
- "Reembolso Bloqueio por ordem judicial"
- Linhas de cabeçalho e rodapé

Retorne APENAS o array JSON:
[{"descricao":"Pix recebido - GUILHERME NEVES VAZ MACIEL SOUTO","valor":3900.00,"data":"2026-06-04","categoria":"renda_extra","macro":"Receitas","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO MERCADO PAGO:
${textoTruncado}`;
  }

  // ── MERCADO PAGO FATURA ─────────────────────────────────────────────────────
  if (chave === 'mercadopago_fatura') {
    return `Você é especialista em faturas de cartão de crédito Mercado Pago.

FORMATO DESTA FATURA:
- Resumo: "Total a pagar R$ X.XXX,XX | Vence em DD/MM/YYYY"
- Pode haver múltiplos cartões com seção "Cartão Visa [************XXXX]"
- Cada transação: "DD/MM  DESCRIÇÃO  [Parcela N de M]  R$ VALOR"
- DATA: formato DD/MM sem ano. Referência: ano ${anoFechamento}, mês fechamento ${mesFechamento}.
  Se mês da compra > mês fechamento, use ano ${anoFechamento - 1}.
- PARCELAS: descritas como "Parcela N de M" na coluna de movimentação

REGRAS:
1. VALOR: compras NEGATIVO, créditos/pagamentos POSITIVO.
2. Linhas de "Pagamento da fatura" → POSITIVO → categoria "fin_cartao" → INCLUIR.
3. "Crédito concedido" → POSITIVO → categoria "reembolso" → INCLUIR.
4. FORMATO: sempre "Credito".
5. PARCELAS: "Parcela 5 de 5" → parcelaAtual=5, parcelaTotal=5.
6. ${promptCategorias}

IGNORAR:
- Cabeçalho com totais, limite, vencimento
- Opções de parcelamento de fatura
- Texto descritivo do app

Retorne APENAS o array JSON:
[{"descricao":"MERCADOLIVRE*MERCADOLIVRE","valor":-322.81,"data":"${anoFechamento}-01-07","categoria":"outros","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":5,"parcelaTotal":5}]

TEXTO DA FATURA MERCADO PAGO:
${textoTruncado}`;
  }

  // ── INTER EXTRATO ───────────────────────────────────────────────────────────
  if (chave === 'inter_extrato') {
    return `Você é especialista em extratos de conta corrente do Banco Inter.

FORMATO DESTE EXTRATO:
- CABEÇALHO DE DIA: "DD de Mês de AAAA  Saldo do dia: R$ X,XX  Valor  Saldo por transação"
  Ex: "18 de Fevereiro de 2026  Saldo do dia: R$ 2,80  Valor  Saldo por transação"
- CADA TRANSAÇÃO tem formato: 'Tipo: "Cp:CNPJ-Nome Beneficiario"  VALOR  SALDO'
  Ex: 'Pix enviado: "Cp :10573521-Moises Victor de Oliveira"  -R$ 150,00  -R$ 147,20'
- DATA: use a data do cabeçalho de dia acima da transação. Formato YYYY-MM-DD.
- VALOR: já tem sinal no texto. "-R$" = saída (negativo), "R$" sem hífen = entrada (positivo).
- MESES em português: Janeiro=01, Fevereiro=02, Março=03, Abril=04, Maio=05, Junho=06,
  Julho=07, Agosto=08, Setembro=09, Outubro=10, Novembro=11, Dezembro=12.

TIPOS E CATEGORIAS:
- "Pix enviado" → negativo → "Pix" → categoria depende do destino
- "Pix recebido" → positivo → "Pix"
- "Salario recebido - Portabilidade" → positivo → "salario"
- "Pagamento efetuado: Pagamento fatura cartao Inter" → negativo → "fin_cartao"
- "Compra no debito" / "Compra Meio De Transporte" → negativo → "cartao_debito"
- "Aplicacao: CDB" → negativo → "investimento"
- "Resgate: CDB" → positivo → "investimento"
- "Credito liberado: Pix no credito" → IGNORAR (é liberação de limite, não transação real)

REGRAS:
1. DATA: use a data do grupo (cabeçalho "DD de Mês de AAAA"). Formato YYYY-MM-DD.
2. DESCRICAO: use o tipo + nome limpo. Ex: "Pix enviado - Moises Victor de Oliveira E Silva"
   Remova o "Cp :CNPJ-" do início do beneficiário.
3. VALOR: use o primeiro valor da linha (não o saldo). Negativo = saída, positivo = entrada.
4. PARCELAS: parcelaAtual=1, parcelaTotal=1.
5. ${promptCategorias}

IGNORAR COMPLETAMENTE:
- "Credito liberado: Pix no credito" (liberação de crédito, não movimentação real)
- "Saldo do dia", "Saldo total", "Saldo disponível"
- Cabeçalho com nome, CPF, agência, conta
- Linha de rodapé "Fale com a gente SAC..."

Retorne APENAS o array JSON:
[{"descricao":"Pix enviado - Moises Victor de Oliveira E Silva","valor":-150.00,"data":"2026-02-18","categoria":"outros","macro":"Consumo Mensal","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO INTER:
${textoTruncado}`;
  }

  // ── INTER FATURA ────────────────────────────────────────────────────────────
  if (chave === 'inter_fatura') {
    return `Você é especialista em faturas de cartão de crédito do Banco Inter.

FORMATO DESTA FATURA:
- Pode conter múltiplos cartões: "CARTÃO XXXX****XXXX" como cabeçalho de seção
- Cada transação: "DD de mês. AAAA  Descrição  [Beneficiário]  R$ Valor"
  Ex: "30 de nov. 2025  SHOPEE *MavieTxtil (Parcela 06 de 07)  - R$ 69,66"
  Ex: "18 de mar. 2026  PIX CRED PARCELADO (Parcela 02 de 04) EI SILVA LEAND  R$ 177,24"
- DATA: "DD de mês. AAAA" — converta para YYYY-MM-DD.
  Meses: jan=01, fev=02, mar=03, abr=04, mai=05, jun=06,
         jul=07, ago=08, set=09, out=10, nov=11, dez=12.
- VALOR: precedido de "- R$" = saída (negativo). "R$" sem hífen = positivo (crédito/PIX parcelado).
- PARCELAS: "(Parcela NN de MM)" na descrição → parcelaAtual=NN, parcelaTotal=MM.

REGRAS:
1. VALOR: compras NEGATIVO, créditos POSITIVO.
2. "PIX CRED PARCELADO" → é uma compra parcelada via Pix → tratar como compra (negativo).
3. FORMATO: sempre "Credito".
4. DESCRICAO: copie exatamente sem o "- R$" final.
5. Inclua TODOS os cartões presentes na fatura.
6. ${promptCategorias}

IGNORAR COMPLETAMENTE:
- "IOF CREDITO PARCELADO" (IOF isolado)
- "ROTATIVO SALDO FINANCIA", "ENCARGOS ROTATIVO" (encargos financeiros)
- "IOF" quando aparece isolado como linha
- Cabeçalho da fatura, totais, pontos Loop
- Linha "Despesas do mês R$ X", "Valor antecipado", "Fatura atual"

Retorne APENAS o array JSON:
[{"descricao":"SHOPEE *MavieTxtil (Parcela 06 de 07)","valor":-69.66,"data":"2025-11-30","categoria":"outros","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":6,"parcelaTotal":7}]

TEXTO DA FATURA INTER:
${textoTruncado}`;
  }

  // ── CAIXA FATURA ────────────────────────────────────────────────────────────
  if (chave === 'caixa_fatura') {
    return `Você é especialista em faturas de cartão de crédito da Caixa Econômica Federal (cartões Elo, Visa).

FORMATO DESTA FATURA:
- Seções distintas: ANUIDADE | COMPRAS | COMPRAS PARCELADAS
- Cada transação: "DD/MM  Descrição  [Cidade/País]  [Valor U$$]  [Cotação]  Crédito/Débito"
- SUFIXO: "D" = Débito (compra, negativo no sistema), "C" = Crédito (pagamento, positivo).
- PARCELAS: indicadas como "07 DE 10" na coluna "Valor U$$" (ou adjacente à descrição).
  Ex: "LABORATORIO CEDRO  07 DE 10  SAO LUIS  24,00D" → parcela 7 de 10.
- DATA: formato DD/MM sem ano. Referência: ano ${anoFechamento}, mês fechamento ${mesFechamento}.
  Se mês da compra > mês fechamento, use ano ${anoFechamento - 1}.

REGRAS:
1. VALOR: sufixo "D" → negativo (compra), sufixo "C" → positivo (crédito/pagamento).
2. FORMATO: sempre "Credito".
3. DESCRICAO: nome do estabelecimento. Exclua cidade e sufixo D/C.
4. PARCELAS: extraia de "NN DE MM" → parcelaAtual=NN, parcelaTotal=MM.
5. ANUIDADE: categoria "anuidade", macro "Despesas Essenciais". Incluir se valor > 0.
6. Pagamentos identificados por "OBRIGADO PELO PAGAMENTO" ou "TOTAL DA FATURA ANTERIOR" com "C".
7. ${promptCategorias}

IGNORAR:
- "TOTAL DA FATURA ANTERIOR" (saldo anterior, não é transação)
- "AJUSTE CRED PARC S/ JUROS" (ajustes automáticos de centavos)
- Cabeçalho e rodapé da fatura, tabela de pontos

Retorne APENAS o array JSON:
[{"descricao":"Uber UBER TRIP","valor":-19.92,"data":"${anoFechamento}-12-11","categoria":"uber","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DA FATURA CAIXA:
${textoTruncado}`;
  }

  // ── ITAÚ (extrato e fatura) ─────────────────────────────────────────────────
  if (banco === 'itau' && !isFatura) {
    return `Você é especialista em extratos bancários do Itaú.

FORMATO DESTE EXTRATO:
- Colunas: data | lançamentos | valor (R$) | saldo (R$)
- DATA: DD/MM/YYYY
- VALOR: pode ser negativo (débito) ou positivo (crédito) — o sinal já está no valor.
- Lançamentos podem vir em duas colunas lado a lado na mesma página.

REGRAS:
1. VALOR: negativo = saída, positivo = entrada.
2. DATA: YYYY-MM-DD, ano ${anoDoc}.
3. FORMATO: "Pix" para transferências, "Boleto" para pagamentos, "Debito" para débitos gerais.
4. DESCRICAO: copie exatamente.
5. PARCELAS: parcelaAtual=1, parcelaTotal=1.
6. ${promptCategorias}

IGNORAR: saldo anterior, saldo do dia, cabeçalho, rodapé, linhas sem valor.

Retorne APENAS o array JSON:
[{"descricao":"SMART SUPERMERCADO","valor":-80.63,"data":"${anoDoc}-05-18","categoria":"supermercado","macro":"Consumo Mensal","formato":"Debito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO ITAÚ:
${textoTruncado}`;
  }

  if (banco === 'itau' && isFatura) {
    return `Você é especialista em faturas de cartão de crédito Itaú (Platinum, Visa Infinite).

FORMATO DESTA FATURA:
- Duas colunas de lançamentos lado a lado na mesma página.
- Cada lançamento: "DD/MM  ESTABELECIMENTO  [Parcela X/Y]  VALOR"
- DATA: DD/MM sem ano. Referência: ano ${anoFechamento}, mês fechamento ${mesFechamento}.
  Se mês da compra > mês fechamento, use ano ${anoFechamento - 1}.
- Seção "Pagamentos efetuados": pagamentos com valores precedidos de "-" → POSITIVO (receita).
- Estornos: valores precedidos de "-" → POSITIVO.
- Parcelas: "01/03" na descrição → parcelaAtual=1, parcelaTotal=3.

REGRAS:
1. VALOR: compras NEGATIVO, pagamentos/estornos POSITIVO.
2. FORMATO: "Credito".
3. DESCRICAO: copie exatamente.
4. Inclua lançamentos de AMBAS as colunas (titular + adicionais se houver).
5. ${promptCategorias}

IGNORAR: resumo da fatura, total, limites, opções de parcelamento, texto legal.

Retorne APENAS o array JSON:
[{"descricao":"SMART SUPERMERCADO","valor":-80.63,"data":"${anoFechamento}-05-18","categoria":"supermercado","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DA FATURA ITAÚ:
${textoTruncado}`;
  }

  // ── SANTANDER (extrato e fatura) ────────────────────────────────────────────
  if (banco === 'santander' && !isFatura) {
    return `Você é especialista em extratos bancários do Santander (Extrato Consolidado Inteligente).

FORMATO DESTE EXTRATO:
- Começa com texto de segurança/avisos (páginas 1-2) → IGNORAR COMPLETAMENTE.
- Transações começam na seção "Conta Corrente | Movimentação".
- Formato: "DD/MM  Descrição  [Nº Documento]  Movimento (R$)  Saldo (R$)"
- Pode haver múltiplas transações por data, cada uma em linha própria.
- VALOR: valores com sufixo "-" ou entre parênteses = saída (negativo). Sem sufixo = entrada.
  Ex: "PIX ENVIADO - 45,00-" → saída -45,00. "PIX RECEBIDO - 100,00" → entrada +100,00.
- "LIQUIDADO DE VENCIMENTO" = salário/pagamento → positivo.
- "MENSALIDADE DE SEGURO" → negativo → "seguro_vida".
- "COMPRA CARTAO DEB MC" → negativo → "cartao_debito".
- "PAGAMENTO CARTAO CREDITO BCE" → negativo → "fin_cartao".
- "TRANSFERENCIA PROGRAMADA" → negativo → "entre_contas".
- "REMUNERACAO APLICACAO AUTOMATICA" → IGNORAR (rendimento automático de ~R$0,01).

REGRAS:
1. VALOR: negativo = saída, positivo = entrada. Remova sufixo "-".
2. DATA: DD/MM → YYYY-MM-DD, ano ${anoDoc}.
3. DESCRICAO: use tipo + nome do beneficiário/remetente quando disponível.
4. FORMATO: "Pix", "Debito", "Boleto" conforme tipo.
5. PARCELAS: parcelaAtual=1, parcelaTotal=1.
6. ${promptCategorias}

IGNORAR COMPLETAMENTE:
- Páginas de texto de segurança e avisos (tudo antes de "Conta Corrente | Movimentação")
- "REMUNERACAO APLICACAO AUTOMATICA" (rendimento automático)
- "SALDO EM DD/MM", "Saldos por Período" (tabela de saldos)
- "Créditos Contratados" e demais tabelas de produtos

Retorne APENAS o array JSON:
[{"descricao":"PIX ENVIADO - Bruna Marcelina Martins","valor":-45.00,"data":"${anoDoc}-12-01","categoria":"outros","macro":"Consumo Mensal","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO SANTANDER:
${textoTruncado}`;
  }

  if (banco === 'santander' && isFatura) {
    return `Você é especialista em faturas de cartão de crédito Santander (Unlimited, GOL Smiles, Visa, Mastercard).

═══════════════════════════════════════════════════════════
ESTRUTURA DESTA FATURA SANTANDER — LEIA COM MÁXIMA ATENÇÃO
═══════════════════════════════════════════════════════════

── COLUNA "Compra" (cabeçalho das tabelas) ──────────────────
As tabelas de lançamentos têm o cabeçalho:
  "Compra  Data  Descrição  Parcela  R$  US$"
O campo "Compra" exibe um NÚMERO DE CARTÃO (1, 2, 3...) ou fica vazio.
Esse número identifica QUAL CARTÃO do titular efetuou a compra.
⛔ ESTE NÚMERO NÃO É PARCELA. NÃO É parcelaAtual. IGNORE COMPLETAMENTE.

Exemplos de linhas com o número de cartão:
  "  3     30/04 MILA CONSTRUCOES      11/12    658,86"
   → cartão 3, data 30/04, descrição "MILA CONSTRUCOES", parcela REAL = 11/12, valor 658,86
  "  2     29/03 PP *MOVEISALVIN M     12/12     86,66"
   → cartão 2, data 29/03, descrição "PP *MOVEISALVIN M", parcela REAL = 12/12, valor 86,66
  "  3     11/02 VICTORHUGOBIATODA              300,00"
   → cartão 3, data 11/02, descrição "VICTORHUGOBIATODA", SEM parcela (= 1/1), valor 300,00

── PARCELA REAL ────────────────────────────────────────────
A parcela REAL aparece DEPOIS da Descrição, no formato "PP/TT" (ex: "11/12", "02/03").
Se não houver "PP/TT" após a descrição → parcelaAtual=1, parcelaTotal=1.

── LAYOUT DUAS COLUNAS ─────────────────────────────────────
Linhas longas contêm DUAS transações lado a lado (coluna esquerda + coluna direita).
Você DEVE extrair AMBAS as transações de cada linha dupla.
Exemplo: "  3  30/04 MILA CONSTRUCOES  11/12  658,86    3  14/02 VILLA BRASILEIRA SUP  138,90"
→ Transação 1: 30/04, MILA CONSTRUCOES, parcela 11/12, valor -658,86
→ Transação 2: 14/02, VILLA BRASILEIRA SUP, parcela 1/1, valor -138,90

── SEÇÕES ──────────────────────────────────────────────────
- "Pagamento e Demais Créditos": POSITIVO → categoria "fin_cartao"
- "Parcelamentos": compras parceladas (extraia PP/TT do campo Parcela)
- "Despesas": compras à vista (sem parcela na coluna Parcela → 1/1)
- "Detalhamento da Fatura": seção adicional com mais lançamentos

── MÚLTIPLOS CARTÕES ───────────────────────────────────────
A fatura pode conter seções de cartões adicionais marcadas com "@ NOME - XXXX".
Extraia lançamentos de TODAS as seções.

── DATA ────────────────────────────────────────────────────
DD/MM sem ano. Mês fechamento = ${mesFechamento}, ano = ${anoFechamento}.
Se mês da compra > ${mesFechamento} → ano = ${anoFechamento - 1}. Senão → ano = ${anoFechamento}.

REGRAS:
1. VALOR: compras/despesas NEGATIVO; pagamentos/créditos POSITIVO.
2. FORMATO: sempre "Credito".
3. DESCRICAO: copie exatamente, SEM o número do cartão inicial (1, 2, 3).
4. PARCELAS: use o "PP/TT" do campo Parcela. Se ausente → parcelaAtual=1, parcelaTotal=1.
5. ${promptCategorias}

IGNORAR: cabeçalho, totais, resumo, texto legal, IOF isolado, encargos,
"ANUIDADE DIFERENCIADA R$0,00", saldo anterior, tabela Juros/CET.

EXEMPLO DE SAÍDA CORRETO:
[{"descricao":"MILA CONSTRUCOES","valor":-658.86,"data":"${anoFechamento - 1}-04-30","categoria":"manutencao_res","macro":"Despesas Essenciais","formato":"Credito","parcelaAtual":11,"parcelaTotal":12},
{"descricao":"VILLA BRASILEIRA SUP","valor":-138.90,"data":"${anoFechamento}-02-14","categoria":"supermercado","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":1,"parcelaTotal":1},
{"descricao":"VICTORHUGOBIATODA","valor":-300.00,"data":"${anoFechamento}-02-11","categoria":"outros","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":1,"parcelaTotal":1},
{"descricao":"PAGAMENTO DE FATURA-INTERNET","valor":13382.23,"data":"${anoFechamento}-02-20","categoria":"fin_cartao","macro":"Fluxo Interno","formato":"Credito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DA FATURA SANTANDER:
${textoTruncado}`;
  }

  // ── C6 BANK (extrato e fatura) ──────────────────────────────────────────────
  if (banco === 'c6' && !isFatura) {
    return `Você é especialista em extratos do C6 Bank.

FORMATO DESTE EXTRATO:
- Agrupado por mês: "Mês AAAA (DD/MM/AAAA - DD/MM/AAAA) Entradas: R$ X | Saídas: R$ X"
- Cada transação: "Data lançamento  Data contábil  Tipo  Descrição  Valor"
  Exemplo: "22/04  22/04  Outros gastos  C6TAG ESTACIONAMENTO  -R$ 19,50"
- DATA: DD/MM/AAAA (com ano) na coluna "Data lançamento".
- VALOR: já vem com sinal. "-R$" = saída (negativo), "R$" = entrada (positivo).
- "Entrada PIX" = receita positiva. "Outros gastos" = despesa negativa.
- "Saldo do dia DD/MM/AA R$ X" → IGNORAR (não é transação).

REGRAS:
1. VALOR: use o valor exato com sinal.
2. DATA: YYYY-MM-DD.
3. DESCRICAO: use o nome da descrição (ex: "C6TAG ESTACIONAMENTO", "Pix recebido de X").
4. FORMATO: "Pix" para Entrada PIX; "Debito" para Outros gastos.
5. PARCELAS: parcelaAtual=1, parcelaTotal=1.
6. ${promptCategorias}

IGNORAR: "Saldo do dia", cabeçalho, rodapé, totais de entradas/saídas.

Retorne APENAS o array JSON:
[{"descricao":"C6TAG ESTACIONAMENTO","valor":-19.50,"data":"2026-04-22","categoria":"estacionamento","macro":"Consumo Mensal","formato":"Debito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO C6 BANK:
${textoTruncado}`;
  }

  if (banco === 'c6' && isFatura) {
    return `Você é especialista em faturas de cartão de crédito C6 Bank (Platinum).

FORMATO DESTA FATURA:
- Seção "Transações do cartão principal" com sub-seções por cartão virtual/físico.
- Cada transação: "DD mmm  DESCRIÇÃO  [- Parcela X/Y]  VALOR"
  Exemplo: "20 fev  OTICAS DINIZ - Parcela 5/6  391,66"
  Exemplo: "28 mai  PETZ ASA NORTE  12,60"
- DATA: "DD mmm" → converta para YYYY-MM-DD. Referência: ano ${anoFechamento}.
  Meses: jan=01, fev=02, mar=03, abr=04, mai=05, jun=06,
         jul=07, ago=08, set=09, out=10, nov=11, dez=12.
  Se mês da compra > mês fechamento (${mesFechamento}), use ano ${anoFechamento - 1}.
- PARCELAS: "Parcela 5/6" → parcelaAtual=5, parcelaTotal=6.
- Todos os valores são positivos no texto — todas são compras (negativo no sistema).

REGRAS:
1. VALOR: SEMPRE negativo (todas são compras).
2. FORMATO: "Credito".
3. DESCRICAO: copie exatamente incluindo parcela se houver.
4. Inclua transações de TODOS os cartões virtuais/físicos da fatura.
5. ${promptCategorias}

IGNORAR: opções de pagamento, taxas, resumo, totais por cartão, texto explicativo.

Retorne APENAS o array JSON:
[{"descricao":"OTICAS DINIZ - Parcela 5/6","valor":-391.66,"data":"${anoFechamento}-02-20","categoria":"saude","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":5,"parcelaTotal":6}]

TEXTO DA FATURA C6 BANK:
${textoTruncado}`;
  }

  // ── SICREDI (extrato e fatura) ──────────────────────────────────────────────
  if (banco === 'sicredi' && !isFatura) {
    return `Você é especialista em extratos de conta do Sicredi (cooperativa de crédito).

FORMATO DESTE EXTRATO:
- Colunas: Data | Descrição | Documento | Valor (R$) | Saldo (R$)
- DATA: DD/MM/YYYY
- VALOR: negativo = saída (já tem o sinal "-"). Positivo = entrada.
- Tipos comuns: PAGAMENTO PIX, RECEBIMENTO PIX, COMPRA DEBITO MASTER, LIQUIDACAO BOLETO,
  IOF BASICO, IOF ADICIONAL, JUROS UTILIZ.CH.ESPECIAL, CESTA DE RELACIONAMENTO,
  SEGURO PRESTAMISTA, TRANSF ENTRE CONTAS, DEB TRANSF CC/PP, PAGTO FATURA MASTER.

REGRAS:
1. VALOR: negativo = saída, positivo = entrada.
2. DATA: YYYY-MM-DD, ano ${anoDoc}.
3. DESCRICAO: combine tipo + nome do destinatário/remetente quando disponível.
4. FORMATO: "Pix" para PIX; "Boleto" para LIQUIDACAO BOLETO; "Debito" para COMPRA DEBITO MASTER.
5. PARCELAS: parcelaAtual=1, parcelaTotal=1.
6. ${promptCategorias}
7. "PAGTO FATURA MASTER" → "fin_cartao". "IOF BASICO" / "IOF ADICIONAL" → "iof".
   "JUROS UTILIZ.CH.ESPECIAL" → "juros_div". "CESTA DE RELACIONAMENTO" → "impostos". "SEGURO PRESTAMISTA" → "seguro_vida".
   "TRANSF ENTRE CONTAS" / "DEB TRANSF CC/PP" → "entre_contas".

IGNORAR: "SALDO ANTERIOR", saldo da conta, limite cheque especial, rodapé.

Retorne APENAS o array JSON:
[{"descricao":"PAGAMENTO PIX - Valmir Pereira da Silv","valor":-100.00,"data":"${anoDoc}-05-04","categoria":"outros","macro":"Consumo Mensal","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO SICREDI:
${textoTruncado}`;
  }

  if (banco === 'sicredi' && isFatura) {
    return `Você é especialista em faturas de cartão de crédito Sicredi (Mastercard Platinum).

FORMATO DESTA FATURA:
- Seção "Transações" com sub-seção por cartão (ex: "Cartão Bruno B M O Silva (final 2128)")
- Cada transação: "DD/mmm HH:MM  [Presencial/Online]  Descrição  [Parcela NN/MM]  R$ VALOR"
  Exemplo: "04/mai 23:21  Anuidade Diferenc  11/12  2128  R$ 20,00"
  Exemplo: "24/mar 21:54  Presencial  Jim Com Gislaine A  02/03  R$ 568,10"
  Exemplo: "15/abr 22:13  Pagamento  017099401  -R$ 1.323,86"
- DATA: "DD/mmm" → YYYY-MM-DD. Referência: ano ${anoFechamento}.
  Meses: jan=01, fev=02, mar=03, abr=04, mai=05, jun=06,
         jul=07, ago=08, set=09, out=10, nov=11, dez=12.
  Se mês > mês fechamento (${mesFechamento}), use ano ${anoFechamento - 1}.
- PARCELAS: "02/03" na transação → parcelaAtual=2, parcelaTotal=3.
  "11/12  2128" → parcela 11/12 (o "2128" é o número do cartão, ignorar).
- "Pagamento" com "-R$" → positivo → "fin_cartao".
- "Anuidade Diferenc" → negativo → "anuidade".

REGRAS:
1. VALOR: compras NEGATIVO, pagamentos (com "-R$") POSITIVO.
2. FORMATO: "Credito".
3. DESCRICAO: copie exatamente.
4. ${promptCategorias}

IGNORAR: cabeçalho, resumo, opções de pagamento, encargos, rodapé.

Retorne APENAS o array JSON:
[{"descricao":"Jim Com Gislaine A","valor":-568.10,"data":"${anoFechamento}-03-24","categoria":"outros","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":2,"parcelaTotal":3}]

TEXTO DA FATURA SICREDI:
${textoTruncado}`;
  }

  // ── XP FATURA ───────────────────────────────────────────────────────────────
  if (banco === 'xp' && isFatura) {
    return `Você é especialista em faturas de cartão de crédito XP (Visa Infinite One).

FORMATO DESTA FATURA:
- Pode haver múltiplos cartões com sub-seção "PEDRO SASSI - XXXX****XXXX"
- Cada transação: "DD/MM/YY  Descrição  VALOR"
  Exemplo: "10/08/25  SUA ACADEMIA  133,08"
  Exemplo: "04/08/25  Pagamentos Validos Normais  -133,08"
- DATA: DD/MM/YY com ano de 2 dígitos → converta para YYYY-MM-DD (século 20XX).
- "Pagamentos Validos Normais" → POSITIVO → "fin_cartao".

REGRAS:
1. VALOR: compras NEGATIVO, pagamentos POSITIVO.
2. FORMATO: "Credito".
3. DESCRICAO: copie exatamente.
4. PARCELAS: parcelaAtual=1, parcelaTotal=1 (a menos que especificado).
5. ${promptCategorias}

IGNORAR: cabeçalho, totais, boleto, instruções de pagamento.

Retorne APENAS o array JSON:
[{"descricao":"SUA ACADEMIA","valor":-133.08,"data":"2025-08-10","categoria":"academia","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DA FATURA XP:
${textoTruncado}`;
  }

  // ── NUBANK EXTRATO ──────────────────────────────────────────────────────────
  if (chave === 'nubank_extrato') {
    return `Você é especialista em extratos de conta corrente Nubank (Nu Pagamentos S.A.).

FORMATO DO TEXTO PRÉ-PROCESSADO:
O texto já foi pré-processado pelo sistema: cada linha começa com a data no formato "YYYY-MM-DD  " seguida da transação.
A data já está convertida e não precisa de inferência — use exatamente como aparece no início de cada linha.

ESTRUTURA DE CADA LINHA:
  YYYY-MM-DD  TIPO_TRANSACAO  DESCRICAO  VALOR_BR

Exemplos reais do extrato:
  2026-05-01  Transferência recebida pelo Pix KM FISIO BANCO INTER 200,00
  2026-05-01  Transferência enviada pelo Pix Raquel Cristina da Silva Pereira CAIXA ECONOMICA FEDERAL 210,00
  2026-05-03  Compra no débito PADOCA 44,78
  2026-05-03  Transferência enviada pelo Pix PAROQUIA NOSSA SENHORA DO LAGO 42,81
  2026-05-04  Transferência recebida pelo Pix KM FISIO BANCO INTER 300,00
  2026-05-08  Transferência enviada pelo Pix NEOENERGIA BRASILIA 88,14
  2026-05-10  Transferência recebida pelo Pix KM FISIO BANCO INTER 4.100,00
  2026-05-12  Pagamento de fatura 9.186,65
  2026-05-13  Pagamento de boleto efetuado EASYPLAN ADMINISTRADORA DE BEN 482,01
  2026-05-13  Transferência Recebida Kauanne Mendes Antunes BANCO BTG PACTUAL 3.000,00
  2026-05-20  Pagamento de boleto efetuado SEFAZ DISTRITO FEDER 218,45

REGRAS DE EXTRAÇÃO:
1. DATA: use exatamente o valor YYYY-MM-DD do início da linha — nunca infira.
2. VALOR: o número com vírgula ao final da linha (formato BR). Converta para float: "4.100,00" → 4100.00
3. SINAL (positivo/negativo) determinado pelo TIPO:
   → POSITIVO (receita, valor > 0):
     "Transferência recebida pelo Pix", "Transferência Recebida", "Depósito recebido", "Rendimento"
   → NEGATIVO (despesa, valor < 0):
     "Transferência enviada pelo Pix", "Compra no débito", "Pagamento de fatura",
     "Pagamento de boleto efetuado", "Saque", "Tarifa", "IOF"
4. DESCRICAO: extraia o nome limpo do destinatário/remetente/estabelecimento:
   - Para Pix recebido: "Pix Recebido - NOME" (nome antes do banco/CPF/CNPJ)
   - Para Pix enviado: "Pix Enviado - NOME"
   - Para compra débito: "Compra Débito - NOME_LOJA"
   - Para pagamento de fatura Nubank: "Pagamento de fatura Nubank"
   - Para boleto: "Boleto - CREDOR"
   - Para transferência recebida (sem "pelo Pix"): "Transferência Recebida - NOME"
5. FORMATO: "Pix" para transferências Pix, "Debito" para compras no débito, "Boleto" para boletos e faturas.
6. PARCELAS: parcelaAtual=1, parcelaTotal=1 (extrato nunca tem parcelamento).
7. ${promptCategorias}

IGNORAR: linhas sem valor numérico no final, linhas com apenas agência/conta bancária.

Retorne APENAS o array JSON sem markdown, sem explicações:
[{"descricao":"Pix Recebido - KM FISIO","valor":200.00,"data":"2026-05-01","categoria":"renda_extra","macro":"Receitas","formato":"Pix","parcelaAtual":1,"parcelaTotal":1},{"descricao":"Pix Enviado - Raquel Cristina da Silva Pereira","valor":-210.00,"data":"2026-05-01","categoria":"outros","macro":"Consumo Mensal","formato":"Pix","parcelaAtual":1,"parcelaTotal":1},{"descricao":"Compra Débito - PADOCA","valor":-44.78,"data":"2026-05-03","categoria":"alimentacao","macro":"Despesas Essenciais","formato":"Debito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO PRÉ-PROCESSADO DO EXTRATO NUBANK:
${textoTruncado}`;
  }

  // ── NUBANK FATURA ────────────────────────────────────────────────────────────
  // banco='nubank_fatura' → chave='nubank_fatura_fatura'; também aceita 'nubank_fatura' por segurança
  if (banco === 'nubank_fatura' || chave === 'nubank_fatura') {
    return `Você é especialista em faturas de cartão de crédito Nubank (roxinho).

FORMATO DESTA FATURA:
- Página 1: resumo com total, data de vencimento e período vigente — NÃO contém transações.
- Páginas 2-3: informações de pagamento, opções de parcelamento de fatura — IGNORAR.
- Página 4: "RESUMO DA FATURA ATUAL" e "PRÓXIMAS FATURAS" — IGNORAR.
- Páginas 5-7: seção "TRANSAÇÕES" com os lançamentos reais — EXTRAIR DAQUI.
- Última entrada: seção "Pagamentos" com pagamento da fatura anterior — IGNORAR (é fluxo interno).

FORMATO DAS TRANSAÇÕES (páginas 5-7):
  "DD MMM  ••••NNNN  DESCRICAO_DA_COMPRA  R$ VALOR"
  ou com parcela:
  "DD MMM  ••••NNNN  DESCRICAO - Parcela N/M  R$ VALOR"
  Exemplos reais:
  "06 MAI  •••• 1386  Amazon Prime - Parcela 5/12  R$ 13,90"
  "06 MAI  •••• 7473  Atacadao Dia A Dia  R$ 193,60"
  "07 MAI  •••• 7473  Comando Auto Pecas - Parcela 1/3  R$ 532,34"

CAMPOS:
- DATA: "DD MMM" — mês em PT-BR: JAN FEV MAR ABR MAI JUN JUL AGO SET OUT NOV DEZ.
  Período vigente: ${mesFechamento > 0 ? `${String(mesFechamento).padStart(2,'0')}/${anoFechamento}` : 'ver doc'}.
  Lançamentos com mês ≤ mês de fechamento (${mesFechamento}) → ano ${anoFechamento}.
  Lançamentos com mês > mês de fechamento (${mesFechamento}) → ano ${anoFechamento - 1}.
- CARTÃO: "••••NNNN" — ignorar para a extração (não incluir na descricao).
- DESCRICAO: nome da loja exatamente como aparece, SEM o sufixo de parcela.
  Ex: "Amazon Prime - Parcela 5/12" → descricao = "Amazon Prime"
  Ex: "Atacadao Dia A Dia" → descricao = "Atacadao Dia A Dia"
  Ex: "Comando Auto Pecas - Parcela 1/3" → descricao = "Comando Auto Pecas"
- PARCELAS: extraia de "- Parcela N/M" → parcelaAtual=N, parcelaTotal=M. Sem parcela → 1/1.
- VALOR: sempre NEGATIVO (são compras/débitos no cartão).
  "R$ 13,90" → -13.90  |  "R$ 193,60" → -193.60  |  "R$ 532,34" → -532.34

REGRAS:
1. VALOR: sempre NEGATIVO. Todas as linhas da seção TRANSAÇÕES são compras.
2. FORMATO: sempre "Credito".
3. DESCRICAO: nome da loja sem sufixo de parcela, sem número do cartão.
4. PARCELAS: extrair de "- Parcela N/M" quando presente.
5. ${promptCategorias}

IGNORAR COMPLETAMENTE:
- Cabeçalho de cada página: "KAUANNE MENDES ANTUNES", "FATURA 15 JUN 2026", "EMISSÃO E ENVIO"
- Subtítulo da seção: "DE 06 MAI A 06 JUN" e "TRANSAÇÕES"
- Sub-cabeçalho de titular: "Kauanne M Antunes  R$ 9.366,53" (total do titular — não é transação)
- Seção "Pagamentos": "12 MAI  Pagamento em 12 MAI  −R$ 9.186,65" (é fluxo interno)
- Textos legais, CNPJ, SAC, rodapés
- Páginas 1-4 inteiras (não têm transações)

Retorne APENAS o array JSON:
[{"descricao":"Amazon Prime","valor":-13.90,"data":"${anoFechamento}-05-06","categoria":"assinaturas","macro":"Despesas Essenciais","formato":"Credito","parcelaAtual":5,"parcelaTotal":12},{"descricao":"Atacadao Dia A Dia","valor":-193.60,"data":"${anoFechamento}-05-06","categoria":"supermercado","macro":"Despesas Essenciais","formato":"Credito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DA FATURA NUBANK:
${textoTruncado}`;
  }

  // ── BANCO DO BRASIL EXTRATO ─────────────────────────────────────────────────
  if (banco === 'bb' && !isFatura) {
    return `Você é especialista em extratos de conta corrente do Banco do Brasil (BB).

════════════════════════════════════════════════════════════════
ESTRUTURA REAL DO EXTRATO BB — LEIA COM MÁXIMA ATENÇÃO
════════════════════════════════════════════════════════════════

O PDF do BB tem colunas (Dia | Lote | Documento | Histórico | Valor) que o
extrator de texto EMBARALHA: datas, números de lote/doc e o histórico aparecem
em linhas separadas sem ordem fixa. Veja como interpretar:

── COMO IDENTIFICAR UMA TRANSAÇÃO REAL ──────────────────────────
Uma transação real é identificada pelo tipo de lançamento (linha com o NOME
do tipo) + uma linha de detalhe (DD/MM HH:MM FAVORECIDO) + um valor X,XX (-) ou X,XX (+).

TIPOS DE TRANSAÇÃO QUE DEVEM SER EXTRAÍDOS:
  "Pix - Recebido"             → entrada  → POSITIVO  → formato "Pix"
  "Pix - Enviado"              → saída    → NEGATIVO  → formato "Pix"
  "Compra com Cartão"          → saída    → NEGATIVO  → formato "Debito"
  "Pagto cartão crédito"       → saída    → NEGATIVO  → formato "Boleto"
  "TED"                        → conf. sinal → formato "Transferencia"
  "DOC"                        → conf. sinal → formato "Transferencia"
  "Saque"                      → saída    → NEGATIVO  → formato "Dinheiro"
  "Tarifa"                     → saída    → NEGATIVO  → formato "Boleto"
  "Cashback automático cc"     → entrada  → POSITIVO  → formato "Pix" → categoria "reembolso"
  "Clube de beneficios MM/AAAA"→ saída    → NEGATIVO  → formato "Boleto" → categoria "assinaturas"

── COMO EXTRAIR DATA E DESCRIÇÃO ────────────────────────────────
A data real da transação está na linha de detalhe, no formato DD/MM HH:MM, ex:
  "Pix - Enviado"
  "24/06 09:43 BRUNO SILVA NASCIMENTO"    ← use DD/MM daqui + ano ${anoDoc}
  "2.968,11 (-)"

Para "Compra com Cartão", a data também fica no detalhe:
  "Compra com Cartão"
  "06/06 07:54 CASCOL COMBUSTIVEIS"       ← data = 06/06/${anoDoc}
  "57,00 (-)"

Para "Cashback Automático" a data vem da linha do cabeçalho do grupo (DD/MM/YYYY):
  linha: "10/06/2026"  → data = 10/06/${anoDoc}

SINAL DO VALOR:
  X,XX (+) → POSITIVO   (entrada na conta)
  X,XX (-) → NEGATIVO   (saída da conta)

── DESCRIÇÃO A RETORNAR ─────────────────────────────────────────
Combine tipo + favorecido de forma limpa:
  "Pix - Recebido" + "05/06 16:01 53888331000176 ALPHA PATRI" → "Pix Recebido - ALPHA PATRI"
  "Pix - Enviado"  + "26/06 09:43 BRUNO SILVA NASCIMENTO"     → "Pix Enviado - BRUNO SILVA NASCIMENTO"
  "Compra com Cartão" + "06/06 07:54 CASCOL COMBUSTIVEIS"     → "Compra Débito - CASCOL COMBUSTIVEIS"
  "Pagto cartão crédito"                                       → "Pagamento Fatura Cartão"
  "Cashback Automático"                                        → "Cashback Automático BB"
  "Clube de beneficios 06/2026"                               → "Clube de Benefícios BB 06/2026"
Remova: CPF/CNPJ (sequências de 11-14 dígitos), hora HH:MM, prefixos "A " antes de nomes.

════════════════════════════════════════════════════════════════
IGNORAR COMPLETAMENTE — NÃO EXTRAIR COMO TRANSAÇÃO:
════════════════════════════════════════════════════════════════
As linhas/seções abaixo NÃO são movimentações da conta. NUNCA as inclua:

LINHAS INTERNAS DE CONTROLE (sem valor financeiro real):
  - "Saldo Anterior"          → é o saldo inicial, não uma transação
  - "Saldo do dia"            → é o saldo acumulado do dia
  - "SALDO"                   → saldo final do extrato
  - "Movimento do Dia"        → subtotal informativo
  - "Poupança (var.51)"       → rótulo da conta poupança vinculada
  - Números de lote (5-6 dígitos) e documento sozinhos
  - Cabeçalho (Agência, Conta, Período, "Lançamentos", "Dia", "Lote", "Documento", "Histórico", "Valor")
  - Cabeçalho repetido a cada página

MOVIMENTAÇÕES DE POUPANÇA VINCULADA (são aplicações automáticas, não gastos):
  - "Resgate Poupança" com "Poupança (var.51)" → é resgate automático de poupança, IGNORAR
  - "Aplicação Poupança" com "Poupança (var.51)" → é aplicação automática de poupança, IGNORAR
  Justificativa: o BB move dinheiro automaticamente entre CC e poupança vinculada —
  isso não representa entrada ou saída real de dinheiro da titular.

SEÇÕES DO RODAPÉ (últimas páginas do extrato BB):
  - Tudo que aparece após "Informações Adicionais" → PARAR DE EXTRAIR
  - "Informações Adicionais" e seu conteúdo (Invest. Resgate Autom., Saldo, Juros *, IOF *,
    Data de Debito de Juros, Data de Debito de IOF, CREDITO BB-MELHOR OFERTA*, SALDO EM CONTA-SALARIO)
  - "Aplicações Financeiras" e seu conteúdo (POUPANCA RESG. AUTOMATICO, Total Aplicações Financeiras)
  - "* Saldos por dia Base", "Sujeitos a confirmação no momento da contratação"
  ATENÇÃO: os valores como "64.178,00 (+)", "126,57", "4,84 (+)" que aparecem nessas seções
  são saldos e projeções — NÃO são transações reais. Não os inclua.

REGRAS FINAIS:
1. VALOR: use exatamente o valor numérico com sinal correto. Ex: "2.968,11 (-)" → -2968.11
2. DATA: use DD/MM do detalhe da transação + ano ${anoDoc}. Formato YYYY-MM-DD.
3. FORMATO: "Pix" para Pix; "Debito" para compras cartão débito; "Boleto" para pagamentos e tarifas;
   "Dinheiro" para saques; "Transferencia" para TED/DOC.
4. PARCELAS: parcelaAtual=1, parcelaTotal=1 para todas.
5. ${promptCategorias}

EXEMPLO DE SAÍDA CORRETO:
[
  {"descricao":"Pix Recebido - ALPHA PATRI","valor":10000.00,"data":"${anoDoc}-06-05","categoria":"renda_extra","macro":"Receitas","formato":"Pix","parcelaAtual":1,"parcelaTotal":1},
  {"descricao":"Compra Débito - CASCOL COMBUSTIVEIS","valor":-57.00,"data":"${anoDoc}-06-06","categoria":"combustivel","macro":"Despesas Essenciais","formato":"Debito","parcelaAtual":1,"parcelaTotal":1},
  {"descricao":"Pix Enviado - BRUNO SILVA NASCIMENTO","valor":-2968.11,"data":"${anoDoc}-06-26","categoria":"outros","macro":"Consumo Mensal","formato":"Pix","parcelaAtual":1,"parcelaTotal":1},
  {"descricao":"Pagamento Fatura Cartão","valor":-4171.14,"data":"${anoDoc}-06-08","categoria":"pgto_fatura","macro":"Fluxo Interno","formato":"Boleto","parcelaAtual":1,"parcelaTotal":1},
  {"descricao":"Cashback Automático BB","valor":30.83,"data":"${anoDoc}-06-10","categoria":"reembolso","macro":"Receitas","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}
]

TEXTO DO EXTRATO BB:
${textoTruncado}`;
  }

  // ── BANCO DO BRASIL FATURA ────────────────────────────────────────────────────
  if (banco === 'bb' && isFatura) {
    return `Você é especialista em faturas de cartão Ourocard Visa Infinite (Banco do Brasil).

ESTRUTURA REAL DA FATURA:
A fatura está organizada por TITULAR (pode ter múltiplos cartões adicionais) e dentro de cada titular por SEÇÃO:
  - "NOME DO TITULAR (Cartão XXXX)"   → cabeçalho de bloco, NÃO é transação
  - "SALDO FATURA ANTERIOR"           → IGNORAR
  - "Pagamentos/Créditos"             → seção: valor no PDF é NEGATIVO (ex: R$ -11.346,08) → sistema: POSITIVO
  - "Serviços"                        → compras/assinaturas → NEGATIVO
  - "Restaurantes"                    → compras → NEGATIVO
  - "Supermercados"                   → compras → NEGATIVO
  - "Vestuário"                       → compras → NEGATIVO
  - "Viagens"                         → compras → NEGATIVO
  - "Saúde"                           → compras → NEGATIVO
  - "Outros lançamentos"              → compras e tarifas → ver regras abaixo
  - "Compras parceladas"              → compras parceladas → NEGATIVO
  - "Subtotal"                        → IGNORAR
  - "Total da Fatura"                 → IGNORAR

FORMATO DE CADA LINHA DE TRANSAÇÃO:
  DD/MM   DESCRIÇÃO   [CIDADE]   [PAÍS]   R$ VALOR
Exemplos reais:
  26/05   NETFLIX.COM   SAO PAULO   BR   R$ 57,80
  05/06   PGTO DEBITO CONTA 3475 000001238 200   BR   R$ -11.346,08
  13/06   OPENAI *CHATGPT SUBSCR   OPENAI.COM   CA   R$ 107,07
  03/09   PG *LI EFG SH PARC 10/10   SAO PAULO   BR   R$ 109,90

LINHAS AUXILIARES (NÃO são transações — IGNORAR):
  - "*** XX,XX DOLAR AMERICANO"        → nota de câmbio, ignorar
  - "Cotação do Dólar de DD/MM: R$ X"  → informação de cotação, ignorar
  - Linha de código de barras / QR Code
  - Textos de encargos, limites, pontos Livelo, parcelamento da fatura
  - Páginas 1-2 (cabeçalho, resumo, opções de pagamento, informações complementares)
  - Página 5 (Fale conosco, Central de Atendimento)

REGRAS DE VALOR:
1. Seção "Pagamentos/Créditos": valor no PDF tem sinal negativo (R$ -11.346,08) → sistema: POSITIVO (+11346.08) → categoria padrão "fin_cartao"
2. Todos os demais lançamentos (compras): valor no PDF é positivo (R$ 57,80) → sistema: NEGATIVO (-57.80)
3. Seção "Outros lançamentos":
   - "IOF - COMPRA NO EXTERIOR" → IGNORAR completamente (não incluir no JSON)
   - "ANUIDADE DIFERENCIADA TIT-PARC NN/MM" → NEGATIVO → "tarifas_bancarias"
   - "ANUIDADE DIFERENCIADA ADC-PARC NN/MM" → NEGATIVO → "tarifas_bancarias"
   - Demais → NEGATIVO → categorizar normalmente

REGRAS DE DATA:
- Datas na fatura são DD/MM sem ano
- Fatura fechou em: ${anoFechamento}-${String(mesFechamento).padStart(2, '0')}-24
- Lançamento com mês ≤ ${mesFechamento} → ano ${anoFechamento}
- Lançamento com mês > ${mesFechamento} → ano ${anoFechamento - 1} (ex: 26/05 com fechamento em junho → ${anoFechamento})
  Atenção: maio (05) ≤ junho (06) → ${anoFechamento}; setembro (09) > junho (06) → ${anoFechamento - 1}

REGRAS DE PARCELAS:
- "PARC 10/10" na descrição → parcelaAtual=10, parcelaTotal=10
- "PARC 03/05" na descrição → parcelaAtual=3, parcelaTotal=5
- "PARC 01/06" na descrição → parcelaAtual=1, parcelaTotal=6
- Sem PARC → parcelaAtual=1, parcelaTotal=1
- Mantenha "PARC NN/MM" na descrição original

MÚLTIPLOS TITULARES:
- Extraia lançamentos de TODOS os titulares (principal + adicionais)
- Ex: "Albert F M Il Pak (Cartão 8096)" e "Rachel F G Horst (Cartão 6306)"
- Não crie campo titular; apenas extraia as transações normalmente

FORMATO DO OBJETO: sempre "Credito"

${promptCategorias}

Retorne APENAS o array JSON sem markdown:
[{"descricao":"NETFLIX.COM SAO PAULO","valor":-57.80,"data":"${anoFechamento}-05-26","categoria":"assinaturas","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":1,"parcelaTotal":1},
{"descricao":"PGTO DEBITO CONTA 3475 000001238 200","valor":11346.08,"data":"${anoFechamento}-06-05","categoria":"fin_cartao","macro":"Financeiro","formato":"Credito","parcelaAtual":1,"parcelaTotal":1},
{"descricao":"PG *LI EFG SH PARC 10/10 SAO PAULO","valor":-109.90,"data":"${anoFechamento - 1}-09-03","categoria":"outros","macro":"Outros","formato":"Credito","parcelaAtual":10,"parcelaTotal":10}]

TEXTO DA FATURA OUROCARD BB:
${textoTruncado}`;
  }

  // ── BTG PACTUAL (extrato e fatura) ──────────────────────────────────────────
  // NOTA: Prompts provisórios baseados no formato padrão BTG conhecido.
  // Para refinar, forneça um trecho real de extrato/fatura BTG.
  if (banco === 'btg' && !isFatura) {
    return `Você é especialista em extratos bancários do BTG Pactual.

FORMATO TÍPICO DO EXTRATO BTG:
- Cabeçalho: "BTG Pactual | Extrato de conta | Período: DD/MM/AAAA a DD/MM/AAAA"
- Cada transação: "DD/MM/AAAA  Descrição  VALOR"
  Ou: "DD/MM/AAAA  Tipo (Pix, TED, Compra)  Nome/Descrição  VALOR"
- VALOR: negativo = saída (débito), positivo = entrada (crédito).
- DATA: DD/MM/AAAA → converta para YYYY-MM-DD.

TIPOS COMUNS:
- "Pix recebido" / "Transferência recebida" → positivo
- "Pix enviado" / "Transferência enviada" → negativo
- "Compra no débito" → negativo → "cartao_debito"
- "Pagamento de fatura" → negativo → "fin_cartao"
- "Tarifa" / "IOF" → negativo → "impostos"
- "Rendimento" / "CDB" / "Resgate" → conforme sinal

REGRAS:
1. VALOR: entradas POSITIVO, saídas NEGATIVO.
2. DATA: YYYY-MM-DD, ano ${anoDoc}.
3. FORMATO: "Pix" para Pix; "Debito" para compras débito; "Boleto" para pagamentos.
4. DESCRICAO: combine tipo + nome. Copie exatamente.
5. PARCELAS: parcelaAtual=1, parcelaTotal=1.
6. ${promptCategorias}

IGNORAR: saldo do dia, saldo anterior, cabeçalho, rodapé, totais.

Retorne APENAS o array JSON:
[{"descricao":"Pix recebido - João Silva","valor":1500.00,"data":"${anoDoc}-03-05","categoria":"renda_extra","macro":"Receitas","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO BTG PACTUAL:
${textoTruncado}`;
  }

  if (banco === 'btg' && isFatura) {
    return `Você é especialista em faturas de cartão de crédito BTG Pactual.

FORMATO TÍPICO DA FATURA BTG:
- Cada lançamento: "DD/MM  DESCRIÇÃO  [Parcela X/Y]  VALOR"
- DATA: DD/MM sem ano. Referência: ano ${anoFechamento}, mês fechamento ${mesFechamento}.
  Se mês da compra > mês fechamento, use ano ${anoFechamento - 1}.
- VALOR: compras são positivos no extrato → use NEGATIVO. Créditos/estornos → POSITIVO.
- PARCELAS: formato "X/Y" ou "Parcela X de Y" na descrição.

REGRAS:
1. VALOR: compras NEGATIVO, créditos/pagamentos POSITIVO.
2. FORMATO: "Credito".
3. DESCRICAO: copie exatamente.
4. PARCELAS: extraia de "X/Y" → parcelaAtual=X, parcelaTotal=Y.
5. ${promptCategorias}

IGNORAR: cabeçalho, totais, limites, encargos, resumo da fatura.

Retorne APENAS o array JSON:
[{"descricao":"SUPERMERCADO EXTRA","valor":-150.00,"data":"${anoFechamento}-03-05","categoria":"supermercado","macro":"Despesas Essenciais","formato":"Credito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DA FATURA BTG PACTUAL:
${textoTruncado}`;
  }

  // ── NEON (extrato e fatura) ──────────────────────────────────────────────────
  // NOTA: Prompt provisório. Para refinar, forneça um trecho real de extrato Neon.
  if (banco === 'neon' && !isFatura) {
    return `Você é especialista em extratos bancários do Neon.

FORMATO TÍPICO DO EXTRATO NEON:
- Transações listadas por data, geralmente com campos: Data | Descrição | Valor
- DATA: DD/MM/AAAA ou DD/MM — use ano ${anoDoc}.
- VALOR: negativo = saída, positivo = entrada.
- Tipos: Pix enviado/recebido, Compra débito, Pagamento de conta, Transferência.

REGRAS:
1. VALOR: entradas POSITIVO, saídas NEGATIVO.
2. DATA: YYYY-MM-DD.
3. FORMATO: "Pix", "Debito", "Boleto". Padrão: "Pix".
4. DESCRICAO: copie exatamente.
5. PARCELAS: parcelaAtual=1, parcelaTotal=1.
6. ${promptCategorias}

IGNORAR: saldo, cabeçalho, rodapé, totais.

Retorne APENAS o array JSON:
[{"descricao":"Pix enviado - Maria Silva","valor":-80.00,"data":"${anoDoc}-04-10","categoria":"outros","macro":"Consumo Mensal","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO NEON:
${textoTruncado}`;
  }

  if (banco === 'neon' && isFatura) {
    return `Você é especialista em faturas de cartão de crédito Neon (Mastercard).

FORMATO TÍPICO DA FATURA NEON:
- Cada lançamento: "DD/MM  DESCRIÇÃO  VALOR"
- DATA: DD/MM sem ano. Referência: ano ${anoFechamento}, mês fechamento ${mesFechamento}.
  Se mês da compra > mês fechamento, use ano ${anoFechamento - 1}.
- VALOR: compras positivas no texto → use NEGATIVO. Pagamentos → POSITIVO.
- PARCELAS: formato "PARC X/Y" ou "X/Y" na descrição.

REGRAS:
1. VALOR: compras NEGATIVO, pagamentos POSITIVO.
2. FORMATO: "Credito".
3. DESCRICAO: copie exatamente.
4. PARCELAS: extraia de "PARC X/Y" → parcelaAtual=X, parcelaTotal=Y.
5. ${promptCategorias}

IGNORAR: cabeçalho, totais, limites, encargos.

Retorne APENAS o array JSON:
[{"descricao":"IFOOD","valor":-35.90,"data":"${anoFechamento}-05-12","categoria":"alimentacao_fora","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DA FATURA NEON:
${textoTruncado}`;
  }

  // ── BANCO SAFRA (extrato e fatura) ───────────────────────────────────────────
  // NOTA: Prompt provisório. Para refinar, forneça um trecho real de extrato Safra.
  if (banco === 'safra' && !isFatura) {
    return `Você é especialista em extratos bancários do Banco Safra.

FORMATO TÍPICO DO EXTRATO SAFRA:
- Colunas: Data | Histórico | Valor | Saldo
- DATA: DD/MM/AAAA → converta para YYYY-MM-DD. Ano ${anoDoc}.
- VALOR: débitos aparecem com sinal negativo ou na coluna "Débito"; créditos positivos.
- Tipos: Pix, TED, DOC, Compra débito, Pagamento boleto, Tarifa.

REGRAS:
1. VALOR: entradas POSITIVO, saídas NEGATIVO.
2. DATA: YYYY-MM-DD, ano ${anoDoc}.
3. FORMATO: "Pix", "Debito", "Boleto", "Transferencia". Padrão: "Pix".
4. DESCRICAO: combine tipo + nome do beneficiário.
5. PARCELAS: parcelaAtual=1, parcelaTotal=1.
6. ${promptCategorias}

IGNORAR: "SALDO ANTERIOR", saldo do dia, cabeçalho, rodapé, limites.

Retorne APENAS o array JSON:
[{"descricao":"Pix recebido - Empresa XPTO","valor":3000.00,"data":"${anoDoc}-06-01","categoria":"salario","macro":"Receitas","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO SAFRA:
${textoTruncado}`;
  }

  if (banco === 'safra' && isFatura) {
    return `Você é especialista em faturas de cartão de crédito Banco Safra (Visa/Mastercard).

FORMATO TÍPICO DA FATURA SAFRA:
- Cada lançamento: "DD/MM  DESCRIÇÃO  [Parcela X/Y]  VALOR"
- DATA: DD/MM sem ano. Referência: ano ${anoFechamento}, mês fechamento ${mesFechamento}.
  Se mês da compra > mês fechamento, use ano ${anoFechamento - 1}.
- VALOR: compras positivas no texto → use NEGATIVO. Pagamentos → POSITIVO.

REGRAS:
1. VALOR: compras NEGATIVO, pagamentos/estornos POSITIVO.
2. FORMATO: "Credito".
3. DESCRICAO: copie exatamente.
4. PARCELAS: extraia "X/Y" ou "Parcela X/Y" → parcelaAtual=X, parcelaTotal=Y.
5. ${promptCategorias}

IGNORAR: totais, resumo, taxas, encargos, opções de parcelamento de fatura.

Retorne APENAS o array JSON:
[{"descricao":"RESTAURANTE XPTO","valor":-89.90,"data":"${anoFechamento}-04-15","categoria":"alimentacao_fora","macro":"Consumo Mensal","formato":"Credito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DA FATURA SAFRA:
${textoTruncado}`;
  }

  // ── ASAAS EXTRATO ────────────────────────────────────────────────────────────
  // Asaas é um gateway de pagamentos (não banco tradicional). O extrato lista
  // cobranças recebidas via boleto/PIX/cartão e as respectivas taxas do serviço.
  if (banco === 'asaas') {
    return `Você é especialista em extratos de conta do Asaas (gateway de pagamentos brasileiro).

FORMATO DESTE EXTRATO ASAAS:
- Cabeçalho: CNPJ + Razão Social, Agência/Conta, Período do extrato
- Cada transação ocupa normalmente 2 linhas (às vezes 3):
  Linha 1: Data  (DD/MM/YYYY)
  Linha 2: Descrição completa da movimentação
  Linha 3: Valor (R$ ±X,XX)

TIPOS DE MOVIMENTAÇÃO E SINAL:
RECEITAS (valor POSITIVO — dinheiro entrando na conta Asaas):
  "Cobrança recebida - fatura nr. XXXXXXX NOME_CLIENTE"   → positivo → categoria "renda_extra"
  "Saldo recebido"                                         → positivo → categoria "renda_extra"
  "Transferência recebida"                                 → positivo → categoria "renda_extra"

DESPESAS/CUSTOS (valor NEGATIVO — taxas debitadas pelo Asaas):
  "Taxa do Pix - fatura nr. XXXXXXX NOME_CLIENTE"                        → negativo → categoria "custos_op" → macro "Investimentos"
  "Taxa de boleto - fatura nr. XXXXXXX NOME_CLIENTE"                     → negativo → categoria "custos_op"
  "Taxa de mensageria - fatura nr. XXXXXXX NOME_CLIENTE"                  → negativo → categoria "custos_op"
  "Taxa de notificação por WhatsApp da cobrança XXXXXXX NOME_CLIENTE"    → negativo → categoria "custos_op"
  "Taxa de notificação por WhatsApp - fatura nr. XXXXXXX NOME_CLIENTE"   → negativo → categoria "custos_op"
  "Transferência"                                                          → negativo → categoria "entre_contas" → macro "Fluxo Interno"

REGRAS:
1. VALOR: entradas (cobranças recebidas, saldo, transferência recebida) POSITIVO.
   Taxas e transferências saindo NEGATIVO.
   O sinal já vem no texto como "R$ -X,XX" (negativo) ou "R$ X,XX" (positivo).
2. DATA: formato YYYY-MM-DD. Converter de DD/MM/YYYY.
3. DESCRICAO: use o texto da movimentação de forma concisa:
   - "Cobrança recebida - fatura nr. 757057651 Cíntia Resende" → "Cobrança recebida - Cíntia Resende"
   - "Taxa do Pix - fatura nr. 757057651 Cíntia Resende" → "Taxa do Pix - Cíntia Resende"
   - "Taxa de notificação por WhatsApp da cobrança 757057651 Cíntia Resende" → "Taxa WhatsApp - Cíntia Resende"
   - "Taxa de mensageria - fatura nr. 757057651 Cíntia Resende" → "Taxa de mensageria - Cíntia Resende"
   Simplifique: remova números de fatura (IDs numéricos), mantenha o nome do cliente.
4. FORMATO: "Pix" para taxas do Pix e saldo recebido; "Boleto" para taxa de boleto; "Pix" como padrão.
5. PARCELAS: parcelaAtual=1, parcelaTotal=1 para todas (gateway não tem parcelamento).
6. ${promptCategorias}
   Atenção especial: custos_op é categoria de Investimentos (custos operacionais do negócio).

IGNORAR COMPLETAMENTE:
- Cabeçalho do extrato (CNPJ, razão social, agência, conta, período)
- "Saldo inicial do período" e "Saldo final do período"
- "Extrato gerado em DD/MM/YYYY às HH:MM:SS"
- Linhas vazias ou de separação

EXEMPLO DE SAÍDA:
[
  {"descricao":"Cobrança recebida - Cíntia Resende","valor":397.00,"data":"${anoDoc}-03-09","categoria":"renda_extra","macro":"Receitas","formato":"Pix","parcelaAtual":1,"parcelaTotal":1},
  {"descricao":"Taxa do Pix - Cíntia Resende","valor":-0.99,"data":"${anoDoc}-03-09","categoria":"custos_op","macro":"Investimentos","formato":"Pix","parcelaAtual":1,"parcelaTotal":1},
  {"descricao":"Taxa WhatsApp - Cíntia Resende","valor":-0.55,"data":"${anoDoc}-03-04","categoria":"custos_op","macro":"Investimentos","formato":"Pix","parcelaAtual":1,"parcelaTotal":1}
]

TEXTO DO EXTRATO ASAAS:
${textoTruncado}`;
  }

  // ── PROMPT GENÉRICO (fallback para bancos sem prompt específico) ─────────────
  if (isFatura) {
    return `Você é especialista em faturas de cartão de crédito brasileiras.
Extraia TODOS os lançamentos do texto abaixo. Retorne APENAS array JSON puro, sem markdown.

IGNORE: totais, limites, resumo, IOF isolado, juros, encargos, saldo anterior, opções de parcelamento de fatura.

REGRAS:
1. VALOR: compras NEGATIVO, estornos/créditos POSITIVO.
2. ANO: mês fechamento=${mesFechamento > 0 ? mesFechamento : 'ver doc'}/ano ${anoFechamento}. Lançamentos ≤ mês fechamento → ${anoFechamento}. Lançamentos > mês fechamento → ${anoFechamento - 1}.
3. FORMATO: sempre "Credito".
4. DESCRICAO: copie exatamente como aparece.
5. PARCELAS: "PARC 03/04" → parcelaAtual=3, parcelaTotal=4. Sem parcelamento → 1/1.
6. ${promptCategorias}

Retorne APENAS o array JSON:
[{"descricao":"NETFLIX.COM","valor":-57.80,"data":"${anoFechamento}-02-10","categoria":"assinaturas","macro":"Despesas Essenciais","formato":"Credito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DA FATURA:
${textoTruncado}`;
  }

  // Genérico extrato
  return `Você é especialista em extratos bancários brasileiros.
Extraia TODAS as transações do texto abaixo. Retorne APENAS array JSON puro, sem markdown.

IGNORE: saldo do dia, saldo anterior, cabeçalho, rodapé, linhas sem valor.

REGRAS:
1. VALOR: saídas NEGATIVO, entradas POSITIVO.
2. DATA: formato YYYY-MM-DD, ano ${anoDoc}.
3. FORMATO: "Pix", "Debito", "Dinheiro", "Boleto". Padrão: "Pix".
4. DESCRICAO: copie exatamente.
5. ${promptCategorias}
6. PARCELAS: parcelaAtual=1, parcelaTotal=1 para todas.

Retorne APENAS o array JSON:
[{"descricao":"iFood *Rest","valor":-45.90,"data":"${anoDoc}-03-05","categoria":"alimentacao_fora","macro":"Consumo Mensal","formato":"Debito","parcelaAtual":1,"parcelaTotal":1}]

TEXTO DO EXTRATO:
${textoTruncado}`;
}

// ── Handler principal ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST')
    return new Response(JSON.stringify({ ok: false, erro: 'Método não permitido' }), { status: 405, headers: CORS });

  if (!GEMINI_API_KEY)
    return new Response(JSON.stringify({ ok: false, erro: 'GEMINI_API_KEY não configurado' }), { status: 500, headers: CORS });

  let textoPDF: string, nomeConta: string, tipoPDFBody: string, banco: string;
  let chunkIndex: number, totalChunks: number;
  let nomeCliente: string, nomesFamilia: string[];
  let historicoCategorizacoes: Array<{padrao: string, categoria_id: string, freq: number}>;
  try {
    const body  = await req.json();
    textoPDF    = body.textoPDF;
    nomeConta   = body.nomeConta    ?? 'Importado';
    tipoPDFBody = body.tipoPDF      ?? '';
    banco       = body.banco        ?? 'generico';
    chunkIndex  = Number(body.chunkIndex  ?? 0);
    totalChunks = Number(body.totalChunks ?? 1);
    nomeCliente  = body.nomeCliente  ?? '';
    nomesFamilia = Array.isArray(body.nomesFamilia) ? body.nomesFamilia : [];
    historicoCategorizacoes = Array.isArray(body.historicoCategorizacoes) ? body.historicoCategorizacoes : [];
    if (!textoPDF || textoPDF.trim().length < 50)
      throw new Error('textoPDF obrigatório e deve ter pelo menos 50 caracteres');
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, erro: e?.message }), { status: 400, headers: CORS });
  }

  // ── Constrói instrução de Fluxo Interno contextualizada ─────────────────────
  // Se temos o nome do cliente/família, enriquecemos o critério de Fluxo Interno
  // para evitar classificar transferências a terceiros como internas.
  const nomesConhecidos = [nomeCliente, ...nomesFamilia].filter(Boolean);
  const instrucaoFluxoInterno = nomesConhecidos.length > 0
    ? `Fluxo Interno → entre_contas, saque_fisico, pgto_fatura — ATENÇÃO: classifique como Fluxo Interno SOMENTE transferências entre contas do próprio titular (${nomesConhecidos.join(', ')}) ou pagamentos da própria fatura de cartão. Transferências para outras pessoas ou empresas NÃO são Fluxo Interno.`
    : `Fluxo Interno → entre_contas, saque_fisico, pgto_fatura`;

  // Substitui a linha de Fluxo Interno no PROMPT_CATEGORIAS desta requisição
  const PROMPT_CATEGORIAS_REQ = PROMPT_CATEGORIAS.replace(
    /Fluxo Interno → entre_contas, saque_fisico, pgto_fatura/,
    instrucaoFluxoInterno
  );

  // ── Bloco de histórico de categorizações (memória do cliente) ────────────────
  // Injetado no prompt logo após a taxonomia. O Gemini usa esses pares
  // (descrição_normalizada → categoria_id) como referência prioritária —
  // se a transação nova for similar a um padrão, usa aquela categoria.
  const blocoHistorico = historicoCategorizacoes.length > 0
    ? `

HISTÓRICO DE CATEGORIZAÇÕES DESTE CLIENTE (memória — use como referência prioritária):
Se a descrição da transação for muito similar a um padrão abaixo, use aquela categoria_id.
Similaridade de 70%+ com um padrão → use aquele categoria_id diretamente.
${historicoCategorizacoes.map(h => `"${h.padrao}" → ${h.categoria_id}`).join('\n')}`
    : '';

  // PROMPT_CATEGORIAS_FINAL combina a taxonomia + histórico do cliente
  const PROMPT_CATEGORIAS_FINAL = PROMPT_CATEGORIAS_REQ + blocoHistorico;

  if (historicoCategorizacoes.length > 0) {
    console.log(`[v7] histórico: ${historicoCategorizacoes.length} padrões de categorização injetados no prompt`);
  }

  // Texto já vem truncado/segmentado pelo browser (processPdf.service.js)
  const textoTruncado = textoPDF;
  const chunkLabel    = totalChunks > 1 ? ` [chunk ${chunkIndex + 1}/${totalChunks}]` : '';
  console.log(`[v7] banco: ${banco}, nomeConta: ${nomeConta}, texto: ${textoTruncado.length} chars, tipo: ${tipoPDFBody || 'auto'}${chunkLabel}`);

  // ── Cria o ReadableStream SSE que enviamos ao browser ─────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      function send(event: string, data: unknown) {
        controller.enqueue(enc.encode(sseEvent(event, data)));
      }

      try {
        // ── Etapa 1: Identificação do tipo ────────────────────────────────
        let tipoDoc = 'extrato', vencStr = '', fechaStr = '', anoDoc = new Date().getFullYear();

        const tipoDefinidoUsuario = tipoPDFBody === 'fatura' || tipoPDFBody === 'extrato';

        if (tipoDefinidoUsuario) {
          tipoDoc = tipoPDFBody;
          if (tipoDoc === 'fatura') {
            send('progress', { msg: `Fatura de cartão${chunkLabel} — extraindo datas de vencimento…` });
            const promptDatas = `Analise este trecho de fatura de cartão de crédito e retorne APENAS JSON (sem markdown):
{"vencimento":"YYYY-MM-DD","fechamento":"YYYY-MM-DD","anoDocumento":${anoDoc}}
Se não encontrar as datas, retorne null para elas.

Trecho:
${textoTruncado.substring(0, 1500)}`;
            try {
              const datasTexto = await geminiCall(promptDatas);
              const limpo = datasTexto.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
              const m = limpo.match(/\{[\s\S]*?\}/);
              if (m) {
                const meta = JSON.parse(m[0]);
                vencStr  = meta.vencimento ?? '';
                fechaStr = meta.fechamento ?? '';
                anoDoc   = Number(meta.anoDocumento) || anoDoc;
              }
            } catch (_) { /* datas opcionais */ }
          } else {
            send('progress', { msg: `Extrato bancário${chunkLabel} — extraindo lançamentos…` });
          }
          console.log(`[v7] tipo definido pelo usuário: ${tipoDoc}`);
        } else {
          send('progress', { msg: `Identificando tipo do documento${chunkLabel}…` });
          const promptId = `Analise este documento financeiro e retorne APENAS JSON (sem markdown):
{"tipo":"fatura","vencimento":"YYYY-MM-DD","fechamento":"YYYY-MM-DD","anoDocumento":${anoDoc}}
ou
{"tipo":"extrato","vencimento":null,"fechamento":null,"anoDocumento":${anoDoc}}

Documento:
${textoTruncado.substring(0, 2000)}`;

          const idTexto = await geminiCall(promptId);
          try {
            const limpo = idTexto.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const m = limpo.match(/\{[\s\S]*?\}/);
            if (m) {
              const meta = JSON.parse(m[0]);
              tipoDoc  = meta.tipo === 'fatura' ? 'fatura' : 'extrato';
              vencStr  = meta.vencimento ?? '';
              fechaStr = meta.fechamento ?? '';
              anoDoc   = Number(meta.anoDocumento) || anoDoc;
            }
          } catch (_) {}
          console.log(`[v7] tipo identificado pela IA: ${tipoDoc}`);
        }

        const isFatura = tipoDoc === 'fatura';
        let anoFechamento = anoDoc, mesFechamento = 0;
        if (isFatura) {
          const ref = fechaStr || vencStr;
          if (ref && ref.length >= 7) {
            anoFechamento = Number(ref.substring(0, 4));
            mesFechamento = Number(ref.substring(5, 7));
          }
          // ── Aviso crítico: datas não encontradas → ano das transações pode estar errado ──
          // mesFechamento=0 significa que a extração de datas falhou silenciosamente.
          // Nesse caso buildPrompt recebe mesFechamento=0 e as datas de compra ficam
          // com ano potencialmente errado. Logamos e avisamos via SSE.
          if (mesFechamento === 0) {
            console.warn(`[v7] ⚠️ ATENÇÃO: fatura sem mês de fechamento detectado (mesFechamento=0). banco: ${banco}, vencStr: "${vencStr}", fechaStr: "${fechaStr}". Datas das transações podem ter ano incorreto.`);
            send('progress', { msg: `⚠️ Data de vencimento não identificada — datas das transações podem precisar de revisão manual.` });
          }
        }

        let compFatura = '';
        if (isFatura && vencStr && vencStr.length >= 7) {
          compFatura = vencStr.substring(0, 7);
        }

        send('progress', { msg: `${isFatura ? '💳 Fatura de cartão' : '🏦 Extrato bancário'} — extraindo lançamentos${chunkLabel}…` });
        console.log(`[v7] tipoDoc: ${tipoDoc}, banco: ${banco}, compFatura: ${compFatura}${chunkLabel}`);

        // ── Etapa 2: Extração via streamGenerateContent ──────────────────
        const promptPDF = buildPrompt(banco, isFatura, textoTruncado, anoDoc, anoFechamento, mesFechamento, PROMPT_CATEGORIAS_FINAL);

        const geminiReader = geminiStream(promptPDF).getReader();
        let   fullText     = '';
        let   chunkCount   = 0;

        while (true) {
          const { done, value } = await geminiReader.read();
          if (done) break;
          fullText += value;
          chunkCount++;
          if (chunkCount % 2 === 0 || fullText.length < 500) {
            send('progress', { msg: `Extraindo lançamentos${chunkLabel}… (${fullText.length} chars)` });
          }
        }

        console.log(`[v7] stream concluído: ${fullText.length} chars, ${chunkCount} chunks${chunkLabel}`);
        send('progress', { msg: `Processando lançamentos${chunkLabel}…` });

        // ── Etapa 3: Pós-processamento ──────────────────────────────────
        let lista: unknown[];
        try {
          lista = extrairJSON(fullText);
        } catch (e: any) {
          send('error', { ok: false, erro: `Falha ao extrair transações: ${e?.message}` });
          controller.close();
          return;
        }

        if (!lista || lista.length === 0) {
          send('error', { ok: false, erro: 'Nenhuma transação encontrada.' });
          controller.close();
          return;
        }

        const hoje = new Date().toISOString().substring(0, 10);

        // Flag para normalização de valores US format (Sicoob fatura)
        const usarNormUS = banco === 'sicoob' && isFatura;

        const transacoes = (lista as any[])
          .filter((t) => t?.descricao && t?.valor != null)
          .map((t) => {
            const valorRaw   = usarNormUS ? normalizarValorUS(t.valor) : Number(t.valor);
            const valor      = Math.abs(valorRaw);
            const data       = String(t.data ?? hoje).substring(0, 10);
            const pAtual     = Number(t.parcelaAtual ?? 1) || 1;
            const pTotal     = Number(t.parcelaTotal ?? 1) || 1;
            const pRestantes = Math.max(1, pTotal - pAtual + 1);
            const formato    = normFormato(t.formato ?? '', isFatura);
            const catRaw     = String(t.categoria ?? 'outros');
            // Macro: prioriza CAT_MACRO (fonte de verdade v5.0), fallback ao que Gemini retornou
            const macroRaw   = CAT_MACRO[catRaw] ?? String(t.macro ?? 'Consumo Mensal');
            // Tipo: Fluxo Interno → neutro; positivo → receita; negativo → despesa
            const FLUXO_INTERNO = new Set(['entre_contas','saque_fisico','pgto_fatura']);
            const tipo = FLUXO_INTERNO.has(catRaw) ? 'neutro'
                       : valorRaw < 0              ? 'despesa'
                       :                             'receita';
            // === COERÊNCIA TIPO ↔ CATEGORIA (Fix A — guard determinístico) ===
            // Gemini pode errar: atribuir categoria de Receitas a uma saída e vice-versa.
            // O sinal do valor é árbitro final — corrige categoria e macro se necessário.
            let cat   = catRaw;
            let macro = macroRaw;
            if (tipo === 'despesa' && macro === 'Receitas') {
              cat   = 'outros';          // coringa de saídas
              macro = 'Consumo Mensal';
            } else if (tipo === 'receita' && macro !== 'Receitas' && macro !== 'Fluxo Interno') {
              cat   = 'renda_extra';     // coringa de entradas
              macro = 'Receitas';
            }

            let competencia: string;
            if (isFatura && compFatura) {
              competencia = compFatura;
            } else {
              const ps = data.split('-');
              competencia = `${ps[0]}-${ps[1]}`;
            }
            const [cAno, cMes] = competencia.split('-');
            const periodoLabel = `${MESES_PT[cMes] ?? cMes} ${cAno}`;
            const parcelamento = pTotal > 1 ? `Parcela ${pAtual}/${pTotal}` : null;

            return {
              id:          crypto.randomUUID(),
              descricao:   String(t.descricao).trim(),
              valor:       tipo === 'despesa' ? -valor : valor,
              data, competencia, periodoLabel,
              categoria: cat, grupoImportado: macro, macro, formato, tipo,
              parcelaAtual: pAtual, parcelaTotal: pTotal, parcelasRestantes: pRestantes,
              parcelamento, conta: nomeConta, status: 'pendente',
            };
          });

        console.log(`[v7] ✅ ${transacoes.length} transações${chunkLabel}`);
        send('result', { ok: true, tipoDoc, compFatura, vencimento: vencStr, transacoes });

      } catch (e: any) {
        console.error('[v7] erro:', e?.message);
        send('error', { ok: false, erro: e?.message ?? 'Erro interno' });
      }

      controller.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
});
