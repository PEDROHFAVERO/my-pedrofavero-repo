/**
 * usePlanejamento.js — Hook de operações de planejamento financeiro
 *
 * Extrai a lógica de mutação do planejamento de PagePlanejador.jsx,
 * centralizando todas as operações que escrevem em clienteAtivo.planejamento.
 *
 * Responsabilidades:
 *  - inicializarComMedias / inicializarManual
 *  - replicarAteDezembroEFechar
 *  - limparMesesSelecionados / limparGrupoMes
 *  - atualizarLimite
 *  - salvarConta / removerConta (contasAPagar CRUD)
 *  - calcTotaisGrupo / calcTotaisCategoria (cálculos derivados)
 *
 * Padrão: Strangler Fig — o componente pai continua funcionando enquanto
 * as funções são progressivamente movidas para cá.
 */
import { useCallback, useMemo } from 'react';

/**
 * @param {Object} params
 * @param {import('../types/domain.js').ClienteAtivo} params.clienteAtivo
 * @param {function} params.setClienteAtivo
 * @param {number} params.mesAtivo     — índice 0-11
 * @param {Object} params.parcelasFuturas — { [mesIdx]: { [catId]: number } }
 */
export function usePlanejamento({ clienteAtivo, setClienteAtivo, mesAtivo, parcelasFuturas = {} }) {
  const { planejamento, categorias: _categorias, anoAtivo, contasAPagar: _contasAPagar } = clienteAtivo ?? {};
  const contasAPagar = _contasAPagar || [];
  const categorias = (_categorias || []).filter(c => !c.isCategoria && !c.oculto);
  const categoriasNivel2 = (_categorias || []).filter(c => c.isCategoria === true);

  const anoStr = String(anoAtivo);
  const planAno = planejamento?.[anoStr] || {};
  const planMes = planAno[mesAtivo] || {};

  // ── Helpers internos ────────────────────────────────────────────────────────

  /** Persiste novo estado do planejamento para o ano ativo.
   *  BUG3 FIX: usa callback form do setState para nunca ter closure stale.
   *  Antes: setClienteAtivo({ ...clienteAtivo, ... }) → capturava clienteAtivo
   *  do closure no momento da criação da função, perdendo edições concorrentes.
   *  Agora: setClienteAtivo(prev => ({ ...prev, ... })) → sempre usa o estado
   *  mais recente disponível no momento da execução.
   */
  function _setPlanAno(novoPlanAno) {
    setClienteAtivo(prev => ({
      ...prev,
      planejamento: {
        ...(prev?.planejamento ?? {}),
        [String(prev?.anoAtivo ?? anoStr)]: novoPlanAno,
      },
    }));
  }

  // ── Inicialização de mês ────────────────────────────────────────────────────

  /**
   * Inicializa o mês ativo com médias históricas calculadas.
   * @param {Object} medias — { [catId]: number }
   * @param {function} [onDone] — callback pós-inicialização (ex: fechar modal)
   */
  const inicializarComMedias = useCallback((medias = {}, onDone) => {
    const novoPlan = JSON.parse(JSON.stringify(planAno));
    if (!novoPlan[mesAtivo]) novoPlan[mesAtivo] = {};
    for (const cat of categorias) {
      novoPlan[mesAtivo][cat.id] = {
        projetado: Math.round(medias[cat.id] || 0),
        parcelas: parcelasFuturas[mesAtivo]?.[cat.id] || 0,
      };
    }
    _setPlanAno(novoPlan);
    onDone?.();
  }, [clienteAtivo, mesAtivo, categorias, parcelasFuturas, planAno]);

  /**
   * Inicializa o mês ativo com zeros (entrada manual).
   * @param {function} [onDone]
   */
  const inicializarManual = useCallback((onDone) => {
    const novoPlan = JSON.parse(JSON.stringify(planAno));
    if (!novoPlan[mesAtivo]) novoPlan[mesAtivo] = {};
    for (const cat of categorias) {
      novoPlan[mesAtivo][cat.id] = {
        projetado: 0,
        parcelas: parcelasFuturas[mesAtivo]?.[cat.id] || 0,
      };
    }
    _setPlanAno(novoPlan);
    onDone?.();
  }, [clienteAtivo, mesAtivo, categorias, parcelasFuturas, planAno]);

  // ── Replicação ──────────────────────────────────────────────────────────────

  /**
   * Copia os valores projetados do mês ativo para todos os meses seguintes até Dezembro.
   * @param {function} [onDone]
   */
  const replicarAteDezembroEFechar = useCallback((onDone) => {
    const novoPlan = JSON.parse(JSON.stringify(planAno));
    const origem = novoPlan[mesAtivo] || {};
    for (let m = mesAtivo + 1; m < 12; m++) {
      if (!novoPlan[m]) novoPlan[m] = {};
      for (const cat of categorias) {
        const projetadoOrigem = origem[cat.id]?.projetado ?? 0;
        if (!novoPlan[m][cat.id]) {
          novoPlan[m][cat.id] = { projetado: 0, parcelas: parcelasFuturas[m]?.[cat.id] || 0 };
        }
        novoPlan[m][cat.id].projetado = projetadoOrigem;
      }
    }
    _setPlanAno(novoPlan);
    onDone?.();
  }, [clienteAtivo, mesAtivo, categorias, parcelasFuturas, planAno]);

  // ── Limpeza ─────────────────────────────────────────────────────────────────

  /**
   * Remove a projeção de um conjunto de meses (índices 0-11).
   * @param {Set<number>} mesesParaLimpar
   * @param {function} [onDone]
   */
  const limparMesesSelecionados = useCallback((mesesParaLimpar, onDone) => {
    const novoPlan = JSON.parse(JSON.stringify(planAno));
    for (const mesIdx of mesesParaLimpar) {
      delete novoPlan[mesIdx];
    }
    _setPlanAno(novoPlan);
    onDone?.();
  }, [clienteAtivo, planAno]);

  /**
   * Zera os valores projetados de todas as categorias de um grupo no mês ativo.
   * @param {string} grupo — ex: GRUPOS.FIXAS
   * @param {function} [onDone]
   */
  const limparGrupoMes = useCallback((grupo, onDone) => {
    const cats = categorias.filter(c => c.grupo === grupo);
    const novoPlan = JSON.parse(JSON.stringify(planAno));
    if (!novoPlan[mesAtivo]) novoPlan[mesAtivo] = {};
    for (const cat of cats) {
      if (novoPlan[mesAtivo][cat.id]) {
        novoPlan[mesAtivo][cat.id].projetado = 0;
      }
    }
    _setPlanAno(novoPlan);
    onDone?.();
  }, [clienteAtivo, mesAtivo, categorias, planAno]);

  // ── Edição de limite ────────────────────────────────────────────────────────

  /**
   * Atualiza o valor projetado de uma categoria num mês específico.
   * @param {number} mes   — índice 0-11
   * @param {string} catId
   * @param {number|string} valor
   */
  const atualizarLimite = useCallback((mes, catId, valor) => {
    const novoPlan = JSON.parse(JSON.stringify(planAno));
    if (!novoPlan[mes]) novoPlan[mes] = {};
    if (!novoPlan[mes][catId]) novoPlan[mes][catId] = { projetado: 0, parcelas: 0 };
    novoPlan[mes][catId].projetado = parseFloat(valor) || 0;
    _setPlanAno(novoPlan);
  }, [clienteAtivo, planAno]);

  // ── Contas a Pagar CRUD ─────────────────────────────────────────────────────

  /**
   * Cria ou atualiza uma conta a pagar.
   * @param {import('../types/domain.js').ContaAPagar} conta
   * @param {function} [onDone]
   */
  const salvarConta = useCallback((conta, onDone) => {
    // BUG3 FIX: callback form evita closure stale
    setClienteAtivo(prev => {
      const lista = [...(prev?.contasAPagar ?? [])];
      const idx = lista.findIndex(c => c.id === conta.id);
      if (idx >= 0) lista[idx] = conta;
      else lista.push(conta);
      return { ...prev, contasAPagar: lista };
    });
    onDone?.();
  }, [setClienteAtivo]);

  /**
   * Remove uma conta a pagar pelo ID.
   * @param {string} id
   * @param {function} [onDone]
   */
  const removerConta = useCallback((id, onDone) => {
    // BUG3 FIX: callback form evita closure stale
    setClienteAtivo(prev => ({
      ...prev,
      contasAPagar: (prev?.contasAPagar ?? []).filter(c => c.id !== id),
    }));
    onDone?.();
  }, [setClienteAtivo]);

  // ── Cálculos derivados ──────────────────────────────────────────────────────

  /**
   * Totais (projetado, realizado, parcelas) de todas as categorias de um grupo no mês ativo.
   * @param {string} grupo
   * @param {Object} realizadoMes — { [catId]: { despesa, receita } }
   * @param {Object} parcelasMes  — { [catId]: number }
   */
  const calcTotaisGrupo = useCallback((grupo, realizadoMes = {}, parcelasMes = {}) => {
    const cats = categorias.filter(c => c.grupo === grupo);
    let projetado = 0, realizado = 0, parcelas = 0;
    for (const c of cats) {
      projetado += planMes[c.id]?.projetado || 0;
      realizado += (realizadoMes[c.id]?.despesa || 0) + (realizadoMes[c.id]?.receita || 0);
      parcelas  += parcelasMes[c.id] || planMes[c.id]?.parcelas || 0;
    }
    return { projetado, realizado, parcelas };
  }, [categorias, planMes]);

  /**
   * Totais de uma categoria intermediária (nível 2) no mês ativo.
   * @param {string} cat2Id
   * @param {Object} realizadoMes
   * @param {Object} parcelasMes
   */
  const calcTotaisCategoria = useCallback((cat2Id, realizadoMes = {}, parcelasMes = {}) => {
    const subs = categorias.filter(c => c.categoria === cat2Id);
    const isReceita = subs[0]?.tipo === 'receita';
    let projetado = 0, realizado = 0, parcelas = 0;
    for (const c of subs) {
      projetado += planMes[c.id]?.projetado || 0;
      realizado += isReceita
        ? (realizadoMes[c.id]?.receita || 0)
        : (realizadoMes[c.id]?.despesa || 0);
      parcelas  += parcelasMes[c.id] || planMes[c.id]?.parcelas || 0;
    }
    return { projetado, realizado, parcelas, isReceita };
  }, [categorias, planMes]);

  // ── Valores expostos ────────────────────────────────────────────────────────

  return {
    // Estado derivado
    planAno,
    planMes,
    categorias,
    categoriasNivel2,
    contasAPagar,

    // Mutações
    inicializarComMedias,
    inicializarManual,
    replicarAteDezembroEFechar,
    limparMesesSelecionados,
    limparGrupoMes,
    atualizarLimite,
    salvarConta,
    removerConta,

    // Cálculos
    calcTotaisGrupo,
    calcTotaisCategoria,
  };
}
