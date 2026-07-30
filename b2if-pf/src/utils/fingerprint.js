/**
 * fingerprint.js — Detecção profissional de parcelamentos já lançados
 *
 * PROBLEMA ORIGINAL:
 *   O algoritmo antigo comparava apenas descrição + valor, sem considerar
 *   o número da parcela. Isso causava falsos negativos (parcela 3/12 de
 *   "COBASI" não era identificada como duplicata de parcela 1/12 "COBASI"
 *   já existente) e falsos positivos (duas compras diferentes com mesmo
 *   nome e valor eram colapsadas).
 *
 * ARQUITETURA v2.0 — 5 critérios em cascata:
 *
 *   Critério A — Parcelamento EXATO (mais forte):
 *     Mesma descricaoNorm + mesmo valor + mesma parcelaAtual/parcelaTotal.
 *     → Se encontrado: DUPLICATA CERTA (mesma parcela reimportada).
 *
 *   Critério B — Mesma série de parcelamento (médio):
 *     Mesma descricaoNorm + valor dentro de ±2% + parcelaTotal igual
 *     + parcelaAtual DIFERENTE (outra parcela da mesma compra).
 *     → Se encontrado: DUPLICATA PROVÁVEL (parcela futura já projetada).
 *
 *   Critério C — Transação à vista idêntica (forte):
 *     parcelaTotal === 1 + mesma descricaoNorm + mesmo valor + mesma data.
 *     → Se encontrado: DUPLICATA CERTA (mesmo dia, mesma loja, mesmo valor).
 *
 *   Critério D — Transação à vista mesma semana (fraco/aviso):
 *     parcelaTotal === 1 + mesma descricaoNorm + mesmo valor +
 *     data dentro de 7 dias.
 *     → Marca como _duplicataSugerida (aviso amarelo, não desmarca auto).
 *
 *   Critério E — Parcelamento por fingerprint base (fallback):
 *     Mesma descricaoNorm (20 chars) + mesmo valor + parcelaAtual > 1 +
 *     qualquer parcelaTotal existente > 1.
 *     → Comportamento original melhorado (mantém compatibilidade).
 *
 * NORMALIZAÇÃO DA DESCRIÇÃO:
 *   - Remove sufixos de parcela: "PARC 3/10", "03/10", "- 3 DE 10"
 *   - Remove caracteres especiais
 *   - Lowercase, trim, trunca em 30 chars (mais que os 20 originais para
 *     reduzir falsos positivos em descrições longas)
 *   - Remove palavras-ruído do Gemini: BR, SP, RJ, etc.
 */

// ── Constantes ────────────────────────────────────────────────────────────────
const VALOR_TOLERANCIA = 0.02;   // ±2% para comparações de valor (variação de IOF)
const DIFF_DATA_DUPLICATA_DIAS = 0; // mesma data → duplicata certa (Critério C)
const DIFF_DATA_SUGESTAO_DIAS  = 7; // até 7 dias → duplicata sugerida (Critério D)

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normaliza a descrição de uma transação para comparação.
 * Remove indicadores de parcela, chars especiais, ruídos de OCR/Gemini.
 */
export function normalizarDescricao(desc = '') {
  return (desc || '')
    // Remove padrões de parcela: "PARC 3/10", "03/10", "- 3 DE 10", "3/10"
    .replace(/\s*[-–]?\s*PARC\w*\s+\d{1,2}[/\s]\w*\d{1,2}/gi, '')
    .replace(/\s+\d{1,2}\s+DE\s+\d{1,2}/gi, '')
    .replace(/\s+\d{1,2}[/\\]\d{1,2}(\s|$)/gi, ' ')
    // Remove sufixos de estado e ruído no final
    .replace(/\s+(BR|SP|RJ|MG|RS|SC|PR|BA|CE|GO|DF|PE|AM)\s*$/gi, '')
    // Remove chars especiais, mantém letras/números/espaços
    .replace(/[^a-z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .substring(0, 30);
}

/**
 * Converte data YYYY-MM-DD para timestamp numérico (dias desde epoch).
 * Retorna null se inválida.
 */
function dataToDias(dataStr = '') {
  if (!dataStr || dataStr.length < 10) return null;
  const d = new Date(dataStr + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / (1000 * 60 * 60 * 24));
}

/**
 * Verifica se dois valores estão dentro da tolerância percentual.
 */
function valoresSimilares(v1, v2, tolerancia = VALOR_TOLERANCIA) {
  const a = Math.abs(Number(v1) || 0);
  const b = Math.abs(Number(v2) || 0);
  if (a === 0 && b === 0) return true;
  if (a === 0 || b === 0) return false;
  return Math.abs(a - b) / Math.max(a, b) <= tolerancia;
}

/**
 * Gera fingerprint legado (compatibilidade com código antigo).
 * Mantido para não quebrar chamadas externas.
 */
export function gerarFingerprint(t) {
  const descNorm = normalizarDescricao(t.descricao).substring(0, 20);
  const valor = Math.abs(Number(t.valor || 0)).toFixed(2);
  return `${descNorm}|${valor}`;
}

// ── Motor principal de detecção ───────────────────────────────────────────────

/**
 * Resultado da detecção para uma transação nova.
 * @typedef {Object} ResultadoDeteccao
 * @property {boolean} duplicata          - Desmarca automaticamente (certeza alta)
 * @property {boolean} duplicataSugerida  - Aviso visual mas mantém marcado
 * @property {'A'|'B'|'C'|'D'|'E'|null} criterio  - Critério que ativou
 * @property {string}  [motivo]           - Descrição humana do motivo
 */

/**
 * Verifica se uma transação nova é duplicata em relação ao conjunto de existentes.
 *
 * @param {object} nova - Transação nova
 * @param {Map<string,object[]>} indicePorDesc - Índice das existentes por descricaoNorm
 * @returns {ResultadoDeteccao}
 */
function verificarDuplicata(nova, indicePorDesc) {
  const descNova  = normalizarDescricao(nova.descricao);
  const valorNovo = Math.abs(Number(nova.valor) || 0);
  const pAtualNova = Number(nova.parcelaAtual  || 1);
  const pTotalNova = Number(nova.parcelaTotal  || 1);
  const dataNova  = dataToDias(nova.data);

  const candidatas = indicePorDesc.get(descNova) || [];

  for (const ex of candidatas) {
    const valorEx  = Math.abs(Number(ex.valor) || 0);
    const pAtualEx = Number(ex.parcelaAtual  || 1);
    const pTotalEx = Number(ex.parcelaTotal  || 1);
    const dataEx   = dataToDias(ex.data);

    // ── Critério A: Parcelamento exato (mesma parcela reimportada) ───────────
    if (
      pTotalNova > 1 &&
      pTotalEx   > 1 &&
      pAtualNova === pAtualEx &&
      pTotalNova === pTotalEx &&
      valoresSimilares(valorNovo, valorEx, 0.01) // tolerância mais apertada: 1%
    ) {
      return {
        duplicata: true,
        duplicataSugerida: false,
        criterio: 'A',
        motivo: `Parcela ${pAtualNova}/${pTotalNova} idêntica já existe (${ex.descricao?.substring(0,30)}, R$${valorEx.toFixed(2)})`,
      };
    }

    // ── Critério B: Outra parcela da mesma série ─────────────────────────────
    if (
      pTotalNova > 1 &&
      pTotalEx   > 1 &&
      pTotalNova === pTotalEx &&
      pAtualNova !== pAtualEx &&
      valoresSimilares(valorNovo, valorEx, VALOR_TOLERANCIA)
    ) {
      return {
        duplicata: true,
        duplicataSugerida: false,
        criterio: 'B',
        motivo: `Parcela ${pAtualNova}/${pTotalNova} de série já lançada (parcela ${pAtualEx}/${pTotalEx} já existe — ${ex.descricao?.substring(0,30)})`,
      };
    }

    // ── Critério C: Transação à vista — mesma data ───────────────────────────
    if (
      pTotalNova <= 1 &&
      pTotalEx   <= 1 &&
      valoresSimilares(valorNovo, valorEx, 0.005) && // 0.5% — quase exato
      dataNova !== null &&
      dataEx   !== null &&
      Math.abs(dataNova - dataEx) <= DIFF_DATA_DUPLICATA_DIAS
    ) {
      return {
        duplicata: true,
        duplicataSugerida: false,
        criterio: 'C',
        motivo: `Transação à vista idêntica na mesma data (${ex.data}, R$${valorEx.toFixed(2)})`,
      };
    }

    // ── Critério D: Transação à vista — mesma semana (sugestão) ─────────────
    if (
      pTotalNova <= 1 &&
      pTotalEx   <= 1 &&
      valoresSimilares(valorNovo, valorEx, 0.005) &&
      dataNova !== null &&
      dataEx   !== null &&
      Math.abs(dataNova - dataEx) <= DIFF_DATA_SUGESTAO_DIAS
    ) {
      return {
        duplicata: false,
        duplicataSugerida: true,
        criterio: 'D',
        motivo: `Possível duplicata: mesma loja/valor em datas próximas (${ex.data} vs ${nova.data})`,
      };
    }
  }

  // ── Critério E: Fallback — fingerprint base (parcela futura genérica) ──────
  // Compatibilidade com lógica original: parcelaAtual > 1 + fingerprint match
  if (pAtualNova > 1) {
    const fpNova = gerarFingerprint(nova);
    const todasExistentes = [...indicePorDesc.values()].flat();
    for (const ex of todasExistentes) {
      if (
        (ex.parcelasRestantes || ex.parcelaTotal || 1) > 1 &&
        gerarFingerprint(ex) === fpNova
      ) {
        return {
          duplicata: true,
          duplicataSugerida: false,
          criterio: 'E',
          motivo: `Parcela futura já projetada pelo sistema (fingerprint match)`,
        };
      }
    }
  }

  return { duplicata: false, duplicataSugerida: false, criterio: null };
}

/**
 * Constrói índice invertido: descricaoNorm → [transações] para busca eficiente O(1).
 *
 * @param {object[]} transacoes
 * @returns {Map<string, object[]>}
 */
function construirIndice(transacoes) {
  const indice = new Map();
  for (const t of transacoes) {
    const key = normalizarDescricao(t.descricao);
    if (!indice.has(key)) indice.set(key, []);
    indice.get(key).push(t);
  }
  return indice;
}

/**
 * Marca transações novas como duplicatas usando os 5 critérios em cascata.
 *
 * Cada transação recebe:
 *   - _duplicata: boolean          → desmarca automaticamente no modal
 *   - _duplicataSugerida: boolean  → aviso visual amarelo, mantém marcado
 *   - _duplicataCriterio: string   → qual critério detectou (para debugging)
 *   - _duplicataMotivo: string     → descrição legível do motivo
 *   - _selecionado: boolean        → false se _duplicata, true caso contrário
 *
 * @param {object[]} novasTransacoes
 * @param {object[]} transacoesExistentes
 * @returns {object[]}
 */
export function marcarDuplicatas(novasTransacoes, transacoesExistentes) {
  const existentes = transacoesExistentes || [];

  // Índice invertido das existentes para busca O(1)
  const indice = construirIndice(existentes);

  // Índice das NOVAS já processadas (para detectar duplicatas dentro do mesmo lote)
  // Ex: o mesmo parcelamento aparece duas vezes no mesmo PDF
  const indiceNovas = new Map();

  return novasTransacoes.map(t => {
    // 1. Verifica contra existentes
    let resultado = verificarDuplicata(t, indice);

    // 2. Se não encontrou, verifica contra novas já processadas neste lote
    if (!resultado.duplicata && !resultado.duplicataSugerida) {
      resultado = verificarDuplicata(t, indiceNovas);
      // Duplicata dentro do lote: marca como sugerida (não automática),
      // pois pode ser parcelamento legítimo com mesma descrição/valor
      if (resultado.duplicata) {
        resultado = { ...resultado, duplicata: false, duplicataSugerida: true };
      }
    }

    // Adiciona esta transação ao índice de novas APÓS a verificação
    const keyNova = normalizarDescricao(t.descricao);
    if (!indiceNovas.has(keyNova)) indiceNovas.set(keyNova, []);
    indiceNovas.get(keyNova).push(t);

    return {
      ...t,
      _duplicata:          resultado.duplicata,
      _duplicataSugerida:  resultado.duplicataSugerida,
      _duplicataCriterio:  resultado.criterio,
      _duplicataMotivo:    resultado.motivo,
      _selecionado:        !resultado.duplicata,
    };
  });
}

/**
 * Retorna estatísticas da detecção para debugging/logging.
 *
 * @param {object[]} transacoesComMarca
 * @returns {{ total: number, duplicatas: number, sugeridas: number, porCriterio: object }}
 */
export function estatisticasDeteccao(transacoesComMarca) {
  const stats = { total: 0, duplicatas: 0, sugeridas: 0, porCriterio: { A:0,B:0,C:0,D:0,E:0 } };
  for (const t of transacoesComMarca) {
    stats.total++;
    if (t._duplicata)         { stats.duplicatas++; stats.porCriterio[t._duplicataCriterio]++; }
    if (t._duplicataSugerida) { stats.sugeridas++;  stats.porCriterio[t._duplicataCriterio]++; }
  }
  return stats;
}
