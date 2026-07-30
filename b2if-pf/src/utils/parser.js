import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ── Mapeamento de nomes da planilha → IDs internos de categoria ──────────────
// Macro names from spreadsheet → internal GRUPOS values
const MACRO_MAP = {
  'consumo':               'Consumo Mensal',
  'consumo mensal':        'Consumo Mensal',
  // v5.0: 'Despesas Essenciais' (era 'Despesas Fixas' — ambos mapeados por compatibilidade)
  'despesas essenciais':   'Despesas Essenciais',
  'essenciais':            'Despesas Essenciais',
  'despesas fixas':        'Despesas Essenciais',
  'fixas':                 'Despesas Essenciais',
  'receitas':              'Receitas',
  'receita':               'Receitas',
  'dívidas':               'Dívidas',
  'dividas':               'Dívidas',
  'investimentos':         'Investimentos',
  'investimento':          'Investimentos',
  'fluxo interno':         'Fluxo Interno',
  'interno':               'Fluxo Interno',
};

// Category names from spreadsheet → internal category IDs
// Covers accented, unaccented, slash-variants and common abbreviations
const CAT_MAP = {
  // ── Receitas ──────────────────────────────────────────────────────────────
  'salário':                  'salario',
  'salario':                  'salario',
  'férias':                    'ferias',
  'ferias':                    'ferias',
  '13º salário':               'decimo_terceiro',
  '13 salario':                'decimo_terceiro',
  'décimo terceiro':           'decimo_terceiro',
  'decimo terceiro':           'decimo_terceiro',
  'bônus/plr':                 'bonus_plr',
  'bonus/plr':                 'bonus_plr',
  'bônus':                     'bonus_plr',
  'bonus':                     'bonus_plr',
  'plr':                       'bonus_plr',
  'juros':                     'rec_investimentos',
  'dividendos':                'dividendos',
  'dividendo':                 'dividendos',
  'receitas de investimentos':  'rec_investimentos',
  'rec investimentos':          'rec_investimentos',
  'renda extra':               'renda_extra',
  'freelance / renda extra':   'renda_extra',
  'freelance/renda extra':     'renda_extra',
  'freelance renda extra':     'renda_extra',
  'freelance':                 'renda_extra',
  'aluguel recebido':          'aluguel_rec',
  'rendimentos':               'rec_investimentos',
  'rendimento':                'rec_investimentos',
  'reembolso':                 'reembolso',
  'empréstimos':               'emprestimo_rec',
  'outros recebimentos':       'renda_extra',
  'outras receitas':           'renda_extra',
  'outros rec':                'renda_extra',

  // ── Despesas Fixas ────────────────────────────────────────────────────────
  'aluguel/prestação':         'aluguel_prest',
  'aluguel prestação':         'aluguel_prest',
  'aluguel/prestacao':         'aluguel_prest',
  'moradia':                   'aluguel_prest',
  'casa / moradia':            'aluguel_prest',
  'casa/moradia':              'aluguel_prest',
  'aluguel':                   'aluguel_prest',
  'condomínio':                'condominio',
  'condominio':                'condominio',
  'energia':                   'energia',
  'contas de casa':            'energia',
  'contas':                    'energia',
  'água':                      'agua',
  'agua':                      'agua',
  'gás':                       'gas',
  'gas':                       'gas',
  'telefone':                  'telefone',
  'internet':                  'internet',
  'iptu':                      'iptu',
  'custos imóveis':             'manutencao_res',
  'custos imoveis':             'manutencao_res',
  'custos de imóvel':           'manutencao_res',
  'custos de imovel':           'manutencao_res',
  'manutenção residencial':     'manutencao_res',
  'manutencao residencial':     'manutencao_res',
  'ipva':                      'ipva',
  'funcionário':                'salario_diaria',
  'funcionario':                'salario_diaria',
  'salário/diária':             'salario_diaria',
  'salario/diaria':             'salario_diaria',
  'encargos':                  'encargos',
  'educação':                   'mensalidade_escolar',
  'educacao':                   'mensalidade_escolar',
  'faculdade/mba':              'faculdade_mba',
  'faculdade mba':              'faculdade_mba',
  'escola / faculdade':         'faculdade_mba',
  'escola/faculdade':           'faculdade_mba',
  'escola faculdade':           'faculdade_mba',
  'escola':                     'faculdade_mba',
  'educação filhos':            'mensalidade_escolar',
  'educacao filhos':            'mensalidade_escolar',
  'assinaturas':                'assinaturas',
  'seguro de vida':             'seguro_vida',
  'seguro vida':                'seguro_vida',
  'seguro de carro':            'seguro_carro',
  'seguro carro':               'seguro_carro',
  'seguro residencial':         'seguro_res',
  'seguro resid':               'seguro_res',
  'anuidade':                   'anuidade',
  'celular':                    'celular',
  'tarifas':                    'impostos',
  'tarifa':                     'impostos',
  'impostos / taxas':           'impostos',
  'impostos/taxas':             'impostos',
  'impostos':                   'impostos',
  'plano de saúde':             'saude',
  'plano de saude':             'saude',
  'plano saude':                'saude',
  'academia':                   'academia',
  'outras fixas':               'outros',
  'trabalho':                   'outros',

  // ── Consumo Mensal ────────────────────────────────────────────────────────
  'alimentação fora':         'alimentacao_fora',
  'alimentacao fora':         'alimentacao_fora',
  'alimentação fora de casa': 'alimentacao_fora',
  'supermercado':              'supermercado',
  'alimentação (mercado)':     'supermercado',
  'alimentacao (mercado)':     'supermercado',
  'alimentação mercado':       'supermercado',
  'alimentacao mercado':       'supermercado',
  'padaria / café':           'supermercado',
  'padaria/café':             'supermercado',
  'padaria cafe':             'supermercado',
  'padaria':                  'supermercado',
  'transporte':               'uber',
  'transporte / uber':        'uber',
  'transporte/uber':          'uber',
  'uber':                     'uber',
  'gasolina / combustível':   'combustivel',
  'gasolina/combustível':     'combustivel',
  'gasolina combustivel':     'combustivel',
  'gasolina':                 'combustivel',
  'combustível':              'combustivel',
  'combustivel':              'combustivel',
  'manutenção':               'manutencao',
  'manutencao':               'manutencao',
  'estacionamento':           'estacionamento',
  'aluguel de carro':         'viagem',
  'aluguel carro':            'viagem',
  'carro':                    'manutencao',
  'saúde / consulta':         'saude',
  'saúde/consulta':           'saude',
  'saude consulta':           'saude',
  'saúde':                    'saude',
  'saude':                    'saude',
  'consulta':                 'consulta',
  'drogaria / farmácia':      'farmacia',
  'drogaria/farmácia':        'farmacia',
  'drogaria farmacia':        'farmacia',
  'drogaria':                 'farmacia',
  'farmácia':                 'farmacia',
  'farmacia':                 'farmacia',
  'personal':                 'personal',
  'beleza':                   'beleza',
  'cosméticos':               'cosmeticos',
  'cosmeticos':               'cosmeticos',
  'cuidados pessoais':        'cosmeticos',
  'vestuário':                'vestuario',
  'vestuario':                'vestuario',
  'lazer':                    'lazer',
  'viagem':                   'viagem',
  'comemorações':             'comemoracoes',
  'comemoracoes':             'comemoracoes',
  'festa de aniversário':     'comemoracoes',
  'festa aniversario':        'comemoracoes',
  'clube':                    'clube',
  'papelaria':                'papelaria',
  'decoração / casa':         'manutencao_res',
  'decoração/casa':           'manutencao_res',
  'decoração casa':           'manutencao_res',
  'decoracao casa':           'manutencao_res',
  'decoração':                'manutencao_res',
  'decoracao':                'manutencao_res',
  'casa':                     'manutencao_res',
  'reforma':                  'manutencao_res',
  'compras online':           'outros',
  'compras gerais':           'outros',
  'compras':                  'outros',
  'outros consumos':          'outros',
  'outros':                   'outros',
  'não lembro':               'outros',
  'nao lembro':               'outros',
  'sem categoria':            'outros',
  'variável':                 'outros',
  'variavel':                 'outros',
  'pets':                     'pets',
  'presentes':                'presente',
  'presente':                 'presente',
  'doações':                  'doacoes',
  'doacoes':                  'doacoes',
  'doacao':                   'doacoes',
  'saque':                    'saque_fisico',
  'esporte':                  'esporte',
  'livro / curso':            'livro_curso',
  'livro/curso':              'livro_curso',
  'livro curso':              'livro_curso',
  'material escolar':         'material_didatico',
  'mensalidade escolar':      'mensalidade_escolar',
  'material didático':         'material_didatico',
  'material didatico':        'material_didatico',

  // ── Dívidas ───────────────────────────────────────────────────────────────
  'financiamento de cartão':  'fin_cartao',
  'financiamento de cartao':  'fin_cartao',
  'financiamento cartao':     'fin_cartao',
  'empréstimo':               'emprestimo',
  'emprestimo':               'emprestimo',
  'financiamento':            'emprestimo',
  'juros dívidas':            'juros_div',
  'juros dividas':            'juros_div',

  // ── Investimentos ─────────────────────────────────────────────────────────
  'investimento':             'investimento',
  'investimentos':            'investimento',
  'poupança':                 'reserva',
  'poupanca':                 'reserva',
  'reserva de emergência':    'reserva',
  'reserva emergencia':       'reserva',
  'previdência privada':      'previdencia',
  'previdência':              'previdencia',
  'previdencia':              'previdencia',
  'custódia':                 'custodia',
  'custodia':                 'custodia',
  'custos operacionais':      'custos_op',
  'iof':                      'iof',
  'ir':                       'ir',
  'perdas':                   'perdas',

  // ── Fluxo Interno → Entre contas ─────────────────────────────────────────
  'entre contas':             'entre_contas',
  'entre_contas':             'entre_contas',
  'transferências':           'entre_contas',
  'transferencias':           'entre_contas',
  'transferência':            'entre_contas',
  'transferencia':            'entre_contas',
  'recarga celular':          'entre_contas',
  'de outras pessoas':        'entre_contas',
};

// ── Parse XLSM/XLSX da planilha B2IF ─────────────────────────────────────────
// Colunas esperadas (novo formato):
//   Conta | Competência | Data | Valor | Descrição | Parcelamentos | Formato | Macro | Categoria
// Formato legado (sem Competência/Parcelamentos) também suportado.
export async function parseXLSM(file) {
  const buffer = await file.arrayBuffer();
  // cellDates:true  → células de data viram JS Date
  // raw:true        → números ficam como number (sem formatação de string)
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  // Seleciona a planilha com dados: prefere 'plan2', 'transações', 'dados', 'transacoes'
  // Se não encontrar nenhuma, usa a primeira sheet com mais de 1 linha
  const sheetNamesLower = wb.SheetNames.map(n => n.trim().toLowerCase());
  const preferred = ['lançamentos', 'lancamentos', 'plan2', 'transações', 'transacoes', 'dados', 'planilha', 'transacoes b2if'];
  let wsName = null;
  for (const pref of preferred) {
    const idx = sheetNamesLower.indexOf(pref);
    if (idx !== -1) { wsName = wb.SheetNames[idx]; break; }
  }
  if (!wsName) {
    // Fallback: primeira sheet que tenha pelo menos 2 linhas de dados
    for (const name of wb.SheetNames) {
      const testRows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });
      if (testRows.length > 0) { wsName = name; break; }
    }
  }
  if (!wsName) wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];

  // raw:true garante que Date cells → Date e number cells → number
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

  // ── Debug: log column names for troubleshooting ──────────────────────────────
  if (rows.length > 0) {
    const colNames = Object.keys(rows[0]);
    console.log('[parseXLSM] Colunas detectadas:', colNames);
    const normCols = colNames.map(k => k.trim().toLowerCase());
    console.log('[parseXLSM] Colunas normalizadas:', normCols);
    const temParc = normCols.some(c => c.startsWith('parc'));
    console.log('[parseXLSM] Tem coluna parcelamentos?', temParc, '| coluna encontrada:', normCols.find(c => c.startsWith('parc')) || 'nenhuma');
    if (temParc) {
      const colParc = normCols.find(c => c.startsWith('parc'));
      const origKey = colNames[normCols.indexOf(colParc)];
      const parcRows = rows.filter(r => r[origKey] != null && r[origKey] !== '');
      console.log('[parseXLSM] Linhas com parcelamentos preenchido:', parcRows.length, '| chave original:', origKey);
    }
  }

  // ── Pré-scan: ano dominante do arquivo (para competência sem ano explícito) ──
  // Usa o ano mais recente encontrado na coluna Data para evitar que
  // parcelas de 2025 lançadas na fatura de Jan/2026 fiquem em 2025-01.
  const _yearCounts = {};
  for (const _row of rows) {
    const _r = {};
    for (const [k, v] of Object.entries(_row)) _r[k.trim().toLowerCase()] = v;
    const _d = _r['data'] ?? null;
    let _yr = null;
    if (_d instanceof Date) _yr = _d.getUTCFullYear();
    else if (typeof _d === 'number' && _d > 1000) {
      const _i = XLSX.SSF.parse_date_code(_d); if (_i) _yr = _i.y;
    } else if (typeof _d === 'string' && _d.trim()) {
      const _m = _d.match(/(\d{4})/); if (_m) _yr = parseInt(_m[1]);
    }
    if (_yr && _yr > 2000) _yearCounts[_yr] = (_yearCounts[_yr] || 0) + 1;
  }
  const _anoReferencia = Object.keys(_yearCounts).length > 0
    ? parseInt(Object.entries(_yearCounts).sort((a, b) => b[1] - a[1])[0][0])
    : new Date().getFullYear();

  const transacoes = [];
  let counter = 0;

  for (const row of rows) {
    // Normaliza chaves (trim + lowercase para lookup case-insensitive)
    const r = {};
    for (const [k, v] of Object.entries(row)) {
      r[k.trim().toLowerCase()] = v;
    }

    const contaRaw      = r['conta']                            ?? '';
    const compRaw       = r['competência'] ?? r['competencia']  ?? null; // nova coluna
    const dataRaw       = r['data']                            ?? null;
    const valorRaw      = r['valor']                           ?? null;
    const descRaw       = r['descrição']  ?? r['descricao']    ?? '';
    // Suporta 'parcelamentos', 'parcelas', 'parc.', ou qualquer coluna começando com 'parc'
    const _parcelKey   = Object.keys(r).find(k => k.startsWith('parc'));
    const parcelasRaw  = r['parcelamentos'] ?? r['parcelas'] ?? r['parc.'] ?? (_parcelKey ? r[_parcelKey] : null); // nova coluna
    const formatoRaw    = r['formato']                         ?? '';
    const macroRaw      = r['macro']      ?? r['macros']       ?? '';
    const catRaw        = r['categoria']                       ?? '';

    // Pula linhas completamente vazias
    if (!descRaw && valorRaw === null) continue;

    // ── Parse data ──────────────────────────────────────────────────────────
    let dataFmt = null;
    if (dataRaw instanceof Date) {
      // cellDates:true → JS Date (UTC midnight) — MUST use UTC methods to avoid
      // timezone off-by-one (e.g. UTC-3: 2025-06-09T00:00Z → local 2025-06-08)
      const y = dataRaw.getUTCFullYear();
      const m = String(dataRaw.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dataRaw.getUTCDate()).padStart(2, '0');
      dataFmt = `${y}-${m}-${d}`;
    } else if (typeof dataRaw === 'number' && dataRaw > 1000) {
      // Serial numérico do Excel (fallback quando cellDates não processou)
      const info = XLSX.SSF.parse_date_code(dataRaw);
      if (info) {
        dataFmt = `${info.y}-${String(info.m).padStart(2,'0')}-${String(info.d).padStart(2,'0')}`;
      }
    } else if (typeof dataRaw === 'string' && dataRaw.trim()) {
      const ds = dataRaw.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(ds)) {
        // ISO string ("2025-06-09" ou "2025-06-09T00:00:00.000Z")
        dataFmt = ds.slice(0, 10);
      } else if (/^(\d{2})\/(\d{2})\/(\d{4})/.test(ds)) {
        const [, d, m, y] = ds.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        dataFmt = `${y}-${m}-${d}`;
      }
    }

    // ── Parse valor ─────────────────────────────────────────────────────────
    // raw:true garante que valorRaw é number diretamente (ex: -110, 2000)
    let valorNum = 0;
    if (typeof valorRaw === 'number') {
      valorNum = valorRaw;
    } else if (valorRaw !== null && valorRaw !== '') {
      // Fallback para string: remove tudo exceto dígitos, ponto, vírgula e sinal
      const clean = String(valorRaw).replace(/[^\d.,-]/g, '');
      // Se tem vírgula como separador decimal (ex: "2.000,00") → converte
      if (/\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean)) {
        valorNum = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
      } else {
        valorNum = parseFloat(clean.replace(',', '.'));
      }
      if (isNaN(valorNum)) valorNum = 0;
    }

    const valor = Math.abs(valorNum);

    // Mapeia Macro
    const macroKey = macroRaw.toString().trim().toLowerCase();
    const grupoMapeado = MACRO_MAP[macroKey] || (macroRaw.toString().trim() || '');

    // Mapeia Categoria → ID interno
    const catKey  = catRaw.toString().trim().toLowerCase();
    const catNome = catRaw.toString().trim(); // nome original da planilha
    const catId   = CAT_MAP[catKey] || null;

    // Tipo: Fluxo Interno → neutro; positivo → receita; negativo → despesa
    const FLUXO_INTERNO_IDS = new Set(['entre_contas','saque_fisico','pgto_fatura','entre contas','transferencia','transferência']);
    const isFluxoInterno = FLUXO_INTERNO_IDS.has(catKey) || grupoMapeado === 'Fluxo Interno';
    const tipo = isFluxoInterno ? 'neutro' : valorNum >= 0 ? 'receita' : 'despesa';
    // Se a planilha trouxe um nome de categoria mas não existe no mapa → marca como desconhecida
    const catDesconhecida = catNome && !catId ? catNome : null;

    // ── Parse Competência ────────────────────────────────────────────────────
    // Pode vir como nome do mês em PT ("Janeiro"), YYYY-MM ou Date
    let competencia = null;
    if (compRaw) {
      const cs = compRaw instanceof Date
        ? `${compRaw.getFullYear()}-${String(compRaw.getMonth()+1).padStart(2,'0')}`
        : compRaw.toString().trim();
      // Já em YYYY-MM
      if (/^\d{4}-\d{2}$/.test(cs)) {
        competencia = cs;
      } else {
        // Nome do mês em PT + ano opcional (ex: "Janeiro", "Janeiro/2026", "Jan/26")
        const MESES_PT = {
          'janeiro':'01','fevereiro':'02','março':'03','marco':'03',
          'abril':'04','maio':'05','junho':'06','julho':'07',
          'agosto':'08','setembro':'09','outubro':'10',
          'novembro':'11','dezembro':'12',
          'jan':'01','fev':'02','mar':'03','abr':'04','mai':'05','jun':'06',
          'jul':'07','ago':'08','set':'09','out':'10','nov':'11','dez':'12',
        };
        const lower = cs.toLowerCase().replace(/[^a-záàâãéêíóôõúç\/0-9]/g,'');
        // Tenta extrair ano (4 dígitos ou 2 dígitos)
        const anoMatch = cs.match(/(\d{4})/) || cs.match(/(\d{2})$/);
        let anoFmt = null;
        if (anoMatch) {
          // Ano explícito no campo competência → respeita
          anoFmt = anoMatch[1].length === 2 ? `20${anoMatch[1]}` : anoMatch[1];
        } else {
          // Sem ano explícito → usa o ano mais recente do arquivo
          // (ex: Janeiro → 2026, mesmo que a data de compra seja 2025)
          anoFmt = String(_anoReferencia);
        }
        // Encontra o mês
        for (const [nome, num] of Object.entries(MESES_PT)) {
          if (lower.startsWith(nome)) {
            competencia = `${anoFmt || new Date().getFullYear()}-${num}`;
            break;
          }
        }
      }
    }
    // Fallback: se não há coluna competência, deriva da data de compra
    if (!competencia && dataFmt) competencia = dataFmt.slice(0, 7);

    // ── Parse Parcelamentos ──────────────────────────────────────────────────
    // Coluna "Parcelamentos" = número de parcelas restantes incluindo a atual
    // Ex: 4 → parcelaAtual=1, parcelaTotal=4
    let parcelaAtual = null;
    let parcelaTotal = null;
    if (parcelasRaw !== null && parcelasRaw !== '') {
      const n = typeof parcelasRaw === 'number' ? parcelasRaw : parseInt(String(parcelasRaw).trim());
      if (!isNaN(n) && n > 0) {
        parcelaAtual = 1;
        parcelaTotal = n;
      }
    }

    // ── PeriodoLabel ─────────────────────────────────────────────────────────
    const ns = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const periodoLabel = competencia
      ? (() => { const [y, m] = competencia.split('-'); return `${ns[parseInt(m,10)-1]}/${y}`; })()
      : '';

    transacoes.push({
      id:                    `t_${Date.now()}_${counter++}`,
      data:                  dataFmt,
      competencia,
      descricao:             descRaw.toString().trim(),
      valor,
      tipo,
      formato:               formatoRaw.toString().trim(),
      categoria:             catId,          // null se desconhecida ou vazia
      categoriaXLSM:         catNome || null,
      categoriaDesconhecida: catDesconhecida,
      grupoImportado:        grupoMapeado,
      subcategoria:          '',
      conta:                 contaRaw.toString().trim(),
      parcelaAtual,
      parcelaTotal,
      periodoLabel,
      status: catId ? 'categorizado' : 'pendente',
    });
  }

  // Conta principal = nome mais frequente na coluna Conta, ou nome do arquivo
  const contaFreq = {};
  for (const t of transacoes) if (t.conta) contaFreq[t.conta] = (contaFreq[t.conta] || 0) + 1;
  const contaPrincipal = Object.entries(contaFreq).sort((a,b) => b[1]-a[1])[0]?.[0]
    || file.name.replace(/\.(xlsx|xlsm)$/i, '');

  return { transacoes, banco: contaPrincipal, nomeConta: contaPrincipal };
}


// ── Detecta layout do CSV bancário ───────────────────────────────────────────
const LAYOUTS = [
  // Nubank cartão
  { banco: 'Nubank', detect: h => h.includes('date') && h.includes('title') && h.includes('amount'),
    map: r => ({ data: r.date, descricao: r.title, valor: parseFloat((r.amount||'0').replace(',','.')), tipo: parseFloat((r.amount||'0').replace(',','.')) < 0 ? 'despesa' : 'receita' }) },
  // Nubank conta (extrato)
  { banco: 'Nubank Conta', detect: h => h.includes('data') && h.includes('descrição') && h.includes('valor'),
    map: r => ({ data: r['data'], descricao: r['descrição'], valor: Math.abs(parseFloat((r['valor']||'0').replace(',','.'))), tipo: parseFloat((r['valor']||'0').replace(',','.')) < 0 ? 'despesa' : 'receita' }) },
  // Itaú
  { banco: 'Itaú', detect: h => h.includes('lançamento') || (h.includes('data') && h.includes('histórico') && h.includes('valor')),
    map: r => {
      const v = parseFloat((r['Valor'] || r['valor'] || '0').replace('.','').replace(',','.'));
      return { data: r['Data'] || r['data'], descricao: r['Histórico'] || r['histórico'] || r['Lançamento'] || '', valor: Math.abs(v), tipo: v < 0 ? 'despesa' : 'receita' };
    }},
  // Bradesco
  { banco: 'Bradesco', detect: h => h.includes('data mov.') || h.includes('descricao') || h.includes('descrição') && h.includes('valor (r$)'),
    map: r => {
      const vraw = r['Valor (R$)'] || r['valor (r$)'] || r['Valor'] || '0';
      const v = parseFloat(vraw.replace('.','').replace(',','.'));
      return { data: r['Data Mov.'] || r['Data'], descricao: r['Descrição'] || r['descrição'] || r['descricao'] || '', valor: Math.abs(v), tipo: v < 0 ? 'despesa' : 'receita' };
    }},
  // Inter
  { banco: 'Inter', detect: h => h.includes('data/hora') || (h.includes('data') && h.includes('categoria') && h.includes('tipo') && h.includes('valor')),
    map: r => {
      const v = parseFloat((r['Valor'] || r['valor'] || '0').replace(',','.'));
      const tipo = (r['Tipo']||r['tipo']||'').toLowerCase().includes('entrada') ? 'receita' : 'despesa';
      return { data: r['Data/Hora'] || r['Data'] || r['data'], descricao: r['Descrição'] || r['descrição'] || r['Título'] || '', valor: Math.abs(v), tipo };
    }},
  // C6
  { banco: 'C6', detect: h => h.includes('data de lançamento') || h.includes('identificador'),
    map: r => {
      const v = parseFloat((r['Valor (em R$)'] || r['Valor'] || '0').replace(',','.'));
      return { data: r['Data de Lançamento'] || r['Data'], descricao: r['Descrição'] || r['Estabelecimento'] || '', valor: Math.abs(v), tipo: v < 0 ? 'despesa' : 'receita' };
    }},
  // Genérico (fallback)
  { banco: 'Genérico', detect: () => true,
    map: r => {
      const keys = Object.keys(r);
      const dataKey = keys.find(k => /data|date/i.test(k)) || keys[0];
      const descKey = keys.find(k => /desc|histor|titulo|title|lançamento|lancamento/i.test(k)) || keys[1];
      const valKey  = keys.find(k => /valor|value|amount/i.test(k)) || keys[2];
      const v = parseFloat((r[valKey]||'0').toString().replace(/[^\d,.-]/g,'').replace(',','.'));
      return { data: r[dataKey]||'', descricao: r[descKey]||'', valor: Math.abs(v), tipo: v < 0 ? 'despesa' : 'receita' };
    }},
];

// ── Parse CSV bancário ────────────────────────────────────────────────────────
export function parseCSV(text, nomeArquivo = '') {
  // tenta detectar separador
  const sep = text.includes(';') ? ';' : ',';
  const result = Papa.parse(text, {
    header: true,
    delimiter: sep,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase(),
  });

  if (!result.data?.length) return { transacoes: [], banco: 'Desconhecido' };

  const headers = result.meta.fields || [];
  const headersStr = headers.join(' ');
  const layout = LAYOUTS.find(l => l.detect(headersStr)) || LAYOUTS[LAYOUTS.length - 1];

  const transacoes = result.data
    .filter(r => Object.values(r).some(v => v && v.toString().trim()))
    .map((r, i) => {
      try {
        const base = layout.map(r);
        return {
          id: `t_${Date.now()}_${i}`,
          data: normalizarData(base.data),
          descricao: (base.descricao || '').trim(),
          valor: isNaN(base.valor) ? 0 : base.valor,
          tipo: base.tipo || 'despesa',
          categoria: null,
          subcategoria: '',
          conta: nomeArquivo,
          parcelaAtual: detectarParcela(base.descricao).atual,
          parcelaTotal: detectarParcela(base.descricao).total,
          status: 'pendente', // pendente | categorizado | ignorado
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter(t => t.valor > 0 && t.data);

  return { transacoes, banco: layout.banco };
}

// ── Detecta parcelas na descrição ─────────────────────────────────────────────
export function detectarParcela(descricao = '') {
  // padrões: "2/6", "02/06", "parc 2 de 6", "parcela 2/6"
  const patterns = [
    /(\d{1,2})\s*\/\s*(\d{1,2})/,
    /parc(?:ela)?\s+(\d{1,2})\s+de\s+(\d{1,2})/i,
  ];
  for (const p of patterns) {
    const m = descricao.match(p);
    if (m) {
      const atual = parseInt(m[1]);
      const total = parseInt(m[2]);
      if (total > 1 && atual <= total) return { atual, total };
    }
  }
  return { atual: null, total: null };
}

// ── Normaliza data para YYYY-MM-DD ────────────────────────────────────────────
function normalizarData(raw = '') {
  if (!raw) return null;
  const s = raw.toString().trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  // DD/MM/YY
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (m2) return `20${m2[3]}-${m2[2]}-${m2[1]}`;
  // MM/DD/YYYY
  const m3 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m3) return `${m3[3]}-${m3[1]}-${m3[2]}`;

  return null;
}

// ── Auto-categorização ────────────────────────────────────────────────────────
export function autoCategorizar(transacoes, regras, tipo = null) {
  const regrasOrdenadas = [...regras].sort((a, b) => a.prioridade - b.prioridade);

  return transacoes.map(t => {
    // 1. Se veio da planilha XLSM com categoria reconhecida → mantém (prioridade máxima)
    if (t.categoria && t.categoriaXLSM) return t;
    // 2. Se tem categoria desconhecida → não sobrescreve com regras, aguarda resolução manual
    if (t.categoriaDesconhecida) return t;
    // 3. Já categorizado por outro meio → mantém
    if (t.categoria) return t;
    // 4. Aplica regras do sistema
    const desc = (t.descricao || '').toLowerCase();
    for (const r of regrasOrdenadas) {
      if (desc.includes(r.keyword.toLowerCase())) {
        return { ...t, categoria: r.categoria, status: 'categorizado' };
      }
    }
    return t;
  });
}

// ── Projeção de parcelas futuras ──────────────────────────────────────────────
export function calcularParcelasFuturas(transacoes, categorias, anoAtivo) {
  /**
   * Para cada transação que tem parcelamento (parcelaAtual, parcelaTotal, categoria),
   * projeta os meses restantes e retorna:
   * { [mes_idx]: { [catId]: valor_comprometido } }
   *
   * CORREÇÕES:
   * 1. Usa Math.abs(t.valor) — despesas têm valor negativo, o gráfico espera positivo
   * 2. Usa t.competencia como base do mês (quando disponível) — para faturas de cartão,
   *    a competência é o mês do vencimento (ex: abr/2026), não o mês da compra (ex: dez/2025).
   *    Projetar a partir da competência garante que as parcelas seguintes caiam nos meses certos.
   */
  const mesesComprometidos = {}; // 0-11

  for (const t of transacoes) {
    // Só processa transações realmente parceladas (parcelaTotal > 1 e ainda há próximas)
    if (!t.parcelaTotal || t.parcelaTotal <= 1) continue;
    if (!t.parcelaAtual || t.parcelaAtual >= t.parcelaTotal) continue;
    if (!t.categoria) continue;

    // Base do mês: usa competência (mês do orçamento) quando disponível,
    // senão usa a data da compra. Garante projeção correta para faturas.
    const periodoBase = t.competencia || (t.data ? t.data.slice(0, 7) : null);
    if (!periodoBase) continue;

    const [anoBaseStr, mesBaseStr] = periodoBase.split('-');
    const anoBase = parseInt(anoBaseStr, 10);
    const mesBase = parseInt(mesBaseStr, 10) - 1; // 0-based

    // Valor absoluto: parcelas comprometidas são sempre positivas no gráfico
    const valorParcela = Math.abs(t.valor);

    const restantes = t.parcelaTotal - t.parcelaAtual;
    // i=0 → mês base (parcela atual, já no mês de competência)
    // i=1..restantes → parcelas futuras
    for (let i = 0; i <= restantes; i++) {
      const totalMeses = mesBase + i;
      const anoAlvo = anoBase + Math.floor(totalMeses / 12);
      const mesAlvo = totalMeses % 12;

      if (anoAlvo !== anoAtivo) continue; // só projeta no ano ativo

      if (!mesesComprometidos[mesAlvo]) mesesComprometidos[mesAlvo] = {};
      const cat = t.categoria;
      mesesComprometidos[mesAlvo][cat] = (mesesComprometidos[mesAlvo][cat] || 0) + valorParcela;
    }
  }

  return mesesComprometidos;
}

// ── Agrupa despesas por mês/conta ────────────────────────────────────────────
// Retorna { [mes_0based]: { [nomeConta]: valorDespesa } }
// Usa competência quando disponível; fallback para data de compra.
export function agruparDespesasPorMesConta(transacoes, anoAtivo) {
  const resultado = {};
  for (const t of transacoes) {
    if (t.tipo !== 'despesa') continue;
    // Usa competência (YYYY-MM) ou deriva da data de compra
    const periodoStr = t.competencia || (t.data ? t.data.slice(0, 7) : null);
    if (!periodoStr) continue;
    const [anoStr, mesStr] = periodoStr.split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10) - 1; // 0-based
    if (ano !== anoAtivo) continue;
    const conta = t.conta || 'Sem conta';
    if (!resultado[mes]) resultado[mes] = {};
    resultado[mes][conta] = (resultado[mes][conta] || 0) + Math.abs(t.valor);
  }
  return resultado;
}

// ── Projeta parcelas futuras por mês/conta ────────────────────────────────────
// Retorna { [mes_0based]: { [nomeConta]: valorParcelas } }
export function calcularParcelasFuturasPorConta(transacoes, anoAtivo) {
  // Mesmas correções de calcularParcelasFuturas:
  // 1. Math.abs(t.valor) — despesas são negativas, gráfico espera positivo
  // 2. usa competencia como base do mês quando disponível
  const resultado = {};
  for (const t of transacoes) {
    if (!t.parcelaTotal || t.parcelaTotal <= 1) continue;
    if (!t.parcelaAtual || t.parcelaAtual >= t.parcelaTotal) continue;

    const periodoBase = t.competencia || (t.data ? t.data.slice(0, 7) : null);
    if (!periodoBase) continue;

    const [anoBaseStr, mesBaseStr] = periodoBase.split('-');
    const anoBase = parseInt(anoBaseStr, 10);
    const mesBase = parseInt(mesBaseStr, 10) - 1; // 0-based
    const valorParcela = Math.abs(t.valor);
    const restantes = t.parcelaTotal - t.parcelaAtual;
    const conta = t.conta || 'Sem conta';

    // i=0 → mês base (parcela atual); i=1..restantes → parcelas futuras
    for (let i = 0; i <= restantes; i++) {
      const totalMeses = mesBase + i;
      const anoAlvo = anoBase + Math.floor(totalMeses / 12);
      const mesAlvo = totalMeses % 12;
      if (anoAlvo !== anoAtivo) continue;
      if (!resultado[mesAlvo]) resultado[mesAlvo] = {};
      resultado[mesAlvo][conta] = (resultado[mesAlvo][conta] || 0) + valorParcela;
    }
  }
  return resultado;
}

// ── Agrupa transações por mês/categoria ──────────────────────────────────────
// Usa competência (YYYY-MM) quando disponível; fallback para data de compra.
export function agruparPorMesCategoria(transacoes, anoAtivo) {
  const resultado = {}; // { [mes_0based]: { [catId]: { receita, despesa } } }

  for (const t of transacoes) {
    // Usa competência (YYYY-MM) ou deriva da data de compra
    const periodoStr = t.competencia || (t.data ? t.data.slice(0, 7) : null);
    if (!periodoStr) continue;
    const [anoStr, mesStr] = periodoStr.split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10) - 1; // 0-based
    if (ano !== anoAtivo) continue;

    if (!resultado[mes]) resultado[mes] = {};
    if (!resultado[mes][t.categoria || '__sem_categoria__']) {
      resultado[mes][t.categoria || '__sem_categoria__'] = { receita: 0, despesa: 0 };
    }

    if (t.tipo === 'receita') {
      resultado[mes][t.categoria || '__sem_categoria__'].receita += Math.abs(t.valor);
    } else if (t.tipo === 'despesa') {
      // Sempre positivo: despesas chegam com valor negativo do Gemini/CSV,
      // mas o dashboard precisa de magnitudes positivas para calcular %/barras
      resultado[mes][t.categoria || '__sem_categoria__'].despesa += Math.abs(t.valor);
    }
  }

  return resultado;
}

// ── Calcula médias históricas por categoria ───────────────────────────────────
// Usa competência quando disponível; fallback para data de compra.
export function calcularMediasHistoricas(transacoes, categorias, anoAtivo) {
  const mesAtual = new Date().getMonth();
  const mesesComDados = {};

  for (const t of transacoes) {
    if (!t.categoria) continue;
    const periodoStr = t.competencia || (t.data ? t.data.slice(0, 7) : null);
    if (!periodoStr) continue;
    const [anoStr, mesStr] = periodoStr.split('-');
    if (parseInt(anoStr, 10) !== anoAtivo) continue;
    const mes = parseInt(mesStr, 10) - 1;
    if (mes >= mesAtual) continue;
    mesesComDados[mes] = true;
  }

  const qtdMeses = Object.keys(mesesComDados).length || 1;
  const totais = {};

  for (const t of transacoes) {
    if (!t.categoria) continue;
    const periodoStr = t.competencia || (t.data ? t.data.slice(0, 7) : null);
    if (!periodoStr) continue;
    const [anoStr, mesStr] = periodoStr.split('-');
    if (parseInt(anoStr, 10) !== anoAtivo) continue;
    const mes = parseInt(mesStr, 10) - 1;
    if (mes >= mesAtual) continue;
    if (t.tipo === 'neutro') continue;

    if (!totais[t.categoria]) totais[t.categoria] = 0;
    totais[t.categoria] += t.valor;
  }

  const medias = {};
  for (const catId in totais) {
    medias[catId] = totais[catId] / qtdMeses;
  }

  return medias;
}

// ── Detecta se uma transação é de fatura de mês anterior ─────────────────────
// Retorna true quando a data da compra está em mês diferente da competência.
// Exemplo: compra em Abr/2026 com competencia Mai/2026 (vencimento da fatura).
// Parcelas futuras (parcelaTotal > 1) são EXCLUÍDAS desta detecção — elas
// já têm competência correta gerada pelo calcularParcelasFuturas e não devem
// ser ignoradas no Planejador.
export function isFaturaAnterior(t) {
  if (!t.data || !t.competencia) return false;
  // Parcelas: parcelaTotal > 1 → é parcelamento futuro, não fatura anterior
  if ((t.parcelaTotal ?? 1) > 1) return false;
  const mesData = t.data.slice(0, 7);        // ex: "2026-04"
  const mesComp = t.competencia.slice(0, 7); // ex: "2026-05"
  return mesData !== mesComp;
}
