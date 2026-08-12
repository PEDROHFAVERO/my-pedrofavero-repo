/**
 * useFiltros.js — Hook de filtros e transações filtradas
 *
 * Encapsula todo o estado de filtros + computed derivations:
 * - Estado: filtroStatus, filtroConta, filtroCategoria, filtroFormato,
 *           filtroTempo, filtroMes, filtroOrigem, busca, filtrosColuna,
 *           lockedIds, macroTemp, aprendizadoOk, selecionados
 * - Computed: valoresColuna, valoresCascata, categoriasCascata,
 *             transacoesFiltradas, semCategoria, comCategoria,
 *             totalCategorizados, saldoFiltrado, mesesDisponiveis, transComRegra
 * - Actions: setFiltroMes (sincroniza periodoAtivo), setFiltroCol, removerFiltro,
 *            limparTodosFiltros, atualizarLista, temFiltroAtivo
 * - Helpers: extrairKeyword, temRegraParaTransacao
 */

import { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { PARC_VAZIO } from '../components/tables/ColFilter.jsx';
import { normalizarFormato } from '../components/categorias/helpers.jsx';

// Normaliza macro legado: 'Despesas Fixas' foi renomeado para 'Despesas Essenciais' no v5.0
// Transações importadas antes da correção podem ter grupoImportado='Despesas Fixas'
function normalizarMacro(m) {
  return m === 'Despesas Fixas' ? 'Despesas Essenciais' : m;
}

/**
 * @param {Object} params
 * @param {Array}  params.transacoes
 * @param {Array}  params.regras
 * @param {Array}  params.categorias     — filtradas (sem isCategoria, sem oculto)
 * @param {Map}    params.catPorId       — Map id → categoria (de useCategorias)
 */
export function useFiltros({ transacoes, regras, categorias, catPorId }) {
  const { periodoAtivo, setPeriodoAtivo } = useApp();

  // ── Filter state ───────────────────────────────────────────────────────────
  const [filtroStatus,    setFiltroStatus]    = useState('todos');
  const [filtroConta,     setFiltroConta]     = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroFormato,   setFiltroFormato]   = useState('');
  const [filtroTempo,     setFiltroTempo]     = useState('competencia'); // competencia | data
  const [filtroMes,       setFiltroMesLocal]  = useState('');
  const [filtroOrigem,    setFiltroOrigem]    = useState('');
  const [busca,           setBusca]           = useState('');
  const [macroTemp,       setMacroTemp]       = useState({});
  const [aprendizadoOk,   setAprendizadoOk]   = useState({});
  const [selecionados,    setSelecionados]    = useState(new Set());
  const [lockedIds,       setLockedIds]       = useState(new Set());
  const [ordemValor,      setOrdemValor]      = useState(null); // null | 'desc' | 'asc'

  /** Filtros por coluna (multi-select, tipo Excel) */
  const [filtrosColuna, setFiltrosColuna] = useState({
    portador:  new Set(),
    conta:     new Set(),
    formato:   new Set(),
    macro:     new Set(),
    categoria: new Set(),
    parcela:   new Set(),
  });

  /** Setter de coluna individual */
  function setFiltroCol(col, nextSet) {
    setFiltrosColuna(prev => ({ ...prev, [col]: nextSet }));
  }

  // ── setFiltroMes: sincroniza periodoAtivo global ───────────────────────────
  const setFiltroMes = (v) => {
    setFiltroMesLocal(v);
    if (v) {
      const partes = v.split('-');
      if (partes.length === 2) {
        const mesIdx = parseInt(partes[1], 10) - 1;
        if (mesIdx >= 0 && mesIdx <= 11) setPeriodoAtivo(mesIdx);
      }
    }
  };

  // ── Sincroniza filtroMes quando periodoAtivo muda externamente ─────────────
  const prevPeriodo = useRef(periodoAtivo);
  useEffect(() => {
    if (prevPeriodo.current !== periodoAtivo) {
      prevPeriodo.current = periodoAtivo;
      if (filtroMes) {
        const anoAtual = filtroMes.split('-')[0];
        const novoMes = String(periodoAtivo + 1).padStart(2, '0');
        setFiltroMesLocal(`${anoAtual}-${novoMes}`);
      }
    }
  }, [periodoAtivo]);

  // ── temFiltroAtivo ─────────────────────────────────────────────────────────
  function temFiltroAtivo() {
    return (
      filtroStatus !== 'todos' ||
      filtroConta !== '' ||
      filtroCategoria !== '' ||
      filtroFormato !== '' ||
      filtroMes !== '' ||
      filtroOrigem !== '' ||
      busca !== '' ||
      Object.values(filtrosColuna).some(s => s.size > 0)
    );
  }

  // ── Computed: valoresColuna ────────────────────────────────────────────────
  const valoresColuna = useMemo(() => ({
    portador:  new Set(transacoes.map(t => t.portador).filter(Boolean)),
    conta:     new Set(transacoes.map(t => t.conta).filter(Boolean)),
    formato:   new Set(transacoes.map(t => t.formato).filter(Boolean)),
    macro:     new Set(transacoes.map(t => {
      const cat = catPorId.get(t.categoria);
      return macroTemp[t.id] !== undefined ? macroTemp[t.id] : normalizarMacro(cat?.grupo || t.grupoImportado || '');
    }).filter(Boolean)),
    categoria: new Set(transacoes.map(t => t.categoria).filter(Boolean)),
    parcela:   new Set(transacoes.map(t =>
      (t.parcelaTotal != null && t.parcelaTotal > 1) ? String(t.parcelaTotal) : PARC_VAZIO
    )),
  }), [transacoes, categorias, macroTemp, catPorId]);

  // ── filtrarSem: aplica todos os filtros exceto o indicado (cascata) ────────
  function filtrarSem(excluir, ts) {
    return ts.filter(t => {
      if (excluir !== 'status' && filtroStatus !== 'todos') {
        const temCat = !!(t.categoria && t.categoria !== '');
        if (filtroStatus === 'pendente'     &&  temCat) return false;
        if (filtroStatus === 'categorizado' && !temCat) return false;
      }
      if (excluir !== 'conta'     && filtroConta     && t.conta !== filtroConta) return false;
      if (excluir !== 'categoria' && filtroCategoria && t.categoria !== filtroCategoria) return false;
      if (excluir !== 'formato'   && filtroFormato   && normalizarFormato(t.formato) !== filtroFormato) return false;
      if (excluir !== 'portadorCol' && filtrosColuna.portador.size > 0 && !filtrosColuna.portador.has(t.portador || '')) return false;
      if (excluir !== 'contaCol'    && filtrosColuna.conta.size > 0    && !filtrosColuna.conta.has(t.conta || '')) return false;
      if (excluir !== 'formatoCol'  && filtrosColuna.formato.size > 0  && !filtrosColuna.formato.has(normalizarFormato(t.formato) || '')) return false;
      if (excluir !== 'macroCol') {
        if (filtrosColuna.macro.size > 0) {
          const cat = catPorId.get(t.categoria);
          const m = macroTemp[t.id] !== undefined ? macroTemp[t.id] : normalizarMacro(cat?.grupo || t.grupoImportado || '');
          if (!filtrosColuna.macro.has(m)) return false;
        }
      }
      if (excluir !== 'categoriaCol' && filtrosColuna.categoria.size > 0 && !filtrosColuna.categoria.has(t.categoria || '')) return false;
      return true;
    });
  }

  // ── Computed: valoresCascata ───────────────────────────────────────────────
  const valoresCascata = useMemo(() => {
    const getMacro = t => {
      const cat = catPorId.get(t.categoria);
      return macroTemp[t.id] !== undefined ? macroTemp[t.id] : normalizarMacro(cat?.grupo || t.grupoImportado || '');
    };
    const tsPortadorCol = filtrarSem('portadorCol', transacoes);
    const tsConta      = filtrarSem('conta',       transacoes);
    const tsFormato    = filtrarSem('formato',      transacoes);
    const tsContaCol   = filtrarSem('contaCol',     transacoes);
    const tsFormatoCol = filtrarSem('formatoCol',   transacoes);
    const tsMacroCol   = filtrarSem('macroCol',     transacoes);
    const tsCatCol     = filtrarSem('categoriaCol', transacoes);
    return {
      portadorCol:  new Set(tsPortadorCol.map(t => t.portador).filter(Boolean)),
      contas:       [...new Set(tsConta.map(t => t.conta).filter(Boolean))].sort(),
      formatos:     [...new Set(tsFormato.map(t => normalizarFormato(t.formato)).filter(Boolean))].sort(),
      contaCol:     new Set(tsContaCol.map(t => t.conta).filter(Boolean)),
      formatoCol:   new Set(tsFormatoCol.map(t => normalizarFormato(t.formato)).filter(Boolean)),
      macroCol:     new Set(tsMacroCol.map(getMacro).filter(Boolean)),
      categoriaCol: new Set(tsCatCol.map(t => t.categoria).filter(Boolean)),
      parcela:      valoresColuna.parcela,
    };
  }, [transacoes, filtroStatus, filtroConta, filtroCategoria, filtroFormato,
      filtrosColuna, macroTemp, catPorId, valoresColuna.parcela]);

  // ── Computed: categoriasCascata ────────────────────────────────────────────
  const categoriasCascata = useMemo(() => {
    if (filtrosColuna.macro.size > 0) {
      return categorias.filter(c => filtrosColuna.macro.has(c.grupo));
    }
    return categorias;
  }, [categorias, filtrosColuna.macro]);

  // ── Computed: transacoesFiltradas (+ lockedIds) ────────────────────────────
  const transacoesFiltradas = useMemo(() => {
    // ignorarFiltrosCategoria=true quando a transação está travada (lockedIds):
    // evita que a transação suma da lista ao mudar macro (que zera categoria temporariamente)
    // ou ao aplicar filtro de coluna "Categorias" enquanto a edição ainda está em curso.
    function passaNosFiltros(t, ignorarFiltrosCategoria = false) {
      if (filtroStatus !== 'todos') {
        const temCat = !!(t.categoria && t.categoria !== '');
        if (filtroStatus === 'pendente'     &&  temCat) return false;
        if (filtroStatus === 'categorizado' && !temCat) return false;
      }
      if (filtroConta     && t.conta !== filtroConta) return false;
      // filtroCategoria (chip) e filtrosColuna.categoria (coluna) ignorados quando travada:
      // a categoria fica null temporariamente enquanto o usuário ainda está escolhendo
      if (!ignorarFiltrosCategoria && filtroCategoria && t.categoria !== filtroCategoria) return false;
      if (filtroFormato   && normalizarFormato(t.formato) !== filtroFormato) return false;
      if (busca && !(t.descricao || '').toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroOrigem === 'whatsapp' && t.origem !== 'whatsapp') return false;
      if (filtroOrigem === 'desktop'  && t.origem === 'whatsapp') return false;
      if (filtrosColuna.portador.size > 0  && !filtrosColuna.portador.has(t.portador || '')) return false;
      if (filtrosColuna.conta.size > 0     && !filtrosColuna.conta.has(t.conta || '')) return false;
      if (filtrosColuna.formato.size > 0   && !filtrosColuna.formato.has(normalizarFormato(t.formato) || '')) return false;
      // Filtro de macro e de categoria da coluna ignorados quando travada:
      // - macro: evita que suma quando a nova macro não está no filtro ativo
      // - categoria: a categoria fica null ao trocar macro, então sumiria imediatamente
      if (!ignorarFiltrosCategoria && filtrosColuna.macro.size > 0) {
        const cat = catPorId.get(t.categoria);
        const macroResolvido = macroTemp[t.id] !== undefined ? macroTemp[t.id] : normalizarMacro(cat?.grupo || t.grupoImportado || '');
        if (!filtrosColuna.macro.has(macroResolvido)) return false;
      }
      if (!ignorarFiltrosCategoria && filtrosColuna.categoria.size > 0 && !filtrosColuna.categoria.has(t.categoria || '')) return false;
      if (filtrosColuna.parcela.size > 0) {
        const chave = (t.parcelaTotal != null && t.parcelaTotal > 1) ? String(t.parcelaTotal) : PARC_VAZIO;
        if (!filtrosColuna.parcela.has(chave)) return false;
      }
      if (filtroMes) {
        if (filtroTempo === 'competencia') {
          let periodoEfetivo = t.competencia || null;
          if (!periodoEfetivo && t.periodoLabel) {
            const mesesAbrev = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
            const [nomMes, ano] = t.periodoLabel.split('/');
            const idxMes = mesesAbrev.indexOf((nomMes || '').toLowerCase());
            if (idxMes >= 0 && ano) periodoEfetivo = `${ano}-${String(idxMes + 1).padStart(2, '0')}`;
          }
          if (!periodoEfetivo && t.data) periodoEfetivo = t.data.slice(0, 7);
          if (!periodoEfetivo) return false;
          return periodoEfetivo === filtroMes || periodoEfetivo.startsWith(filtroMes);
        } else {
          return (t.data || '').startsWith(filtroMes);
        }
      }
      return true;
    }

    let resultado;
    if (lockedIds.size === 0) {
      resultado = transacoes.filter(t => passaNosFiltros(t));
    } else {
      // Com lockedIds: mantém a transação travada na posição que ela ocupava,
      // ignorando filtros de macro E categoria — a categoria fica null temporariamente
      // ao trocar macro, e o usuário ainda precisa escolher a nova categoria.
      resultado = [];
      for (const t of transacoes) {
        if (lockedIds.has(t.id)) {
          // Travada: ignora filtro de macro E de categoria (chip e coluna)
          if (passaNosFiltros(t, /* ignorarFiltrosCategoria= */ true)) {
            resultado.push(t);
          }
        } else {
          if (passaNosFiltros(t)) {
            resultado.push(t);
          }
        }
      }
    }

    // Ordenação por valor (sobrepõe a ordem natural por data do banco)
    // null = ordem padrão (data), 'desc' = maior→menor, 'asc' = menor→maior
    if (ordemValor === 'desc') {
      resultado = [...resultado].sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
    } else if (ordemValor === 'asc') {
      resultado = [...resultado].sort((a, b) => Math.abs(a.valor) - Math.abs(b.valor));
    }

    return resultado;
  }, [transacoes, lockedIds, filtroStatus, filtroConta, filtroCategoria, filtroFormato,
      busca, filtroMes, filtroTempo, filtrosColuna, macroTemp, catPorId, filtroOrigem, ordemValor]);

  // ── Computed: contadores e saldo ───────────────────────────────────────────
  const { semCategoria, comCategoria } = useMemo(() => {
    let sem = 0, com = 0;
    for (const t of transacoesFiltradas) {
      if (t.categoria && t.categoria !== '') com++; else sem++;
    }
    return { semCategoria: sem, comCategoria: com };
  }, [transacoesFiltradas]);

  const { totalCategorizados } = useMemo(() => {
    let cat = 0;
    for (const t of transacoes) {
      if (t.categoria && t.categoria !== '') cat++;
    }
    return { totalCategorizados: cat };
  }, [transacoes]);

  const saldoFiltrado = useMemo(() => {
    let saldo = 0;
    for (const t of transacoesFiltradas) saldo += t.valor;
    return saldo;
  }, [transacoesFiltradas]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set();
    for (const t of transacoes) {
      if (filtroTempo === 'competencia') {
        const comp = t.competencia || (t.data ? t.data.slice(0, 7) : null);
        if (comp) set.add(comp);
      } else {
        if (t.data) set.add(t.data.slice(0, 7));
      }
    }
    return [...set].sort();
  }, [transacoes, filtroTempo]);

  // ── Computed: transComRegra ────────────────────────────────────────────────
  const transComRegra = useMemo(() => {
    const keywords = regras.filter(r => r.keyword).map(r => r.keyword.toLowerCase());
    const set = new Set();
    for (const t of transacoes) {
      const desc = (t.descricao || '').toLowerCase();
      if (keywords.some(k => desc.includes(k))) set.add(t.id);
    }
    return set;
  }, [transacoes, regras]);

  // ── Actions ────────────────────────────────────────────────────────────────
  function atualizarLista() {
    setLockedIds(new Set());
  }

  function removerFiltro(qual) {
    if (qual === 'status')        setFiltroStatus('todos');
    if (qual === 'conta')         setFiltroConta('');
    if (qual === 'categoria')     setFiltroCategoria('');
    if (qual === 'formato')       setFiltroFormato('');
    if (qual === 'mes')           setFiltroMesLocal('');
    if (qual === 'origem')        setFiltroOrigem('');
    if (qual === 'busca')         setBusca('');
    if (qual === 'col_conta')     setFiltrosColuna(p => ({ ...p, conta:     new Set() }));
    if (qual === 'col_formato')   setFiltrosColuna(p => ({ ...p, formato:   new Set() }));
    if (qual === 'col_macro')     setFiltrosColuna(p => ({ ...p, macro:     new Set() }));
    if (qual === 'col_categoria') setFiltrosColuna(p => ({ ...p, categoria: new Set() }));
    if (qual === 'col_parcela')   setFiltrosColuna(p => ({ ...p, parcela:   new Set() }));
  }

  function limparTodosFiltros() {
    setFiltroStatus('todos');
    setFiltroConta('');
    setFiltroCategoria('');
    setFiltroFormato('');
    setFiltroMesLocal('');
    setFiltroOrigem('');
    setBusca('');
    setFiltrosColuna({ portador: new Set(), conta: new Set(), formato: new Set(), macro: new Set(), categoria: new Set(), parcela: new Set() });
    setLockedIds(new Set());
  }

  // ── Helpers: auto-categorização ───────────────────────────────────────────
  function extrairKeyword(descricao = '') {
    const limpo = descricao.trim()
      .replace(/\s*PARC\s+\d{1,2}\/\d{1,2}/gi, '')
      .replace(/\s+\d{1,2}\/\d{1,2}$/g, '')
      .replace(/\s+(BR|SP|RJ|MG|RS|SC|PR|BA|CE|GO|DF)$/gi, '')
      .replace(/\s+[A-Z]{2}\s*$/g, '')
      .trim();
    return limpo.split(/\s+/).filter(Boolean).slice(0, 3).join(' ').slice(0, 30).toLowerCase();
  }

  function temRegraParaTransacao(t) {
    const desc = (t.descricao || '').toLowerCase();
    return regras.some(r => r.keyword && desc.includes(r.keyword.toLowerCase()));
  }

  return {
    // Filter state
    filtroStatus, setFiltroStatus,
    filtroConta, setFiltroConta,
    filtroCategoria, setFiltroCategoria,
    filtroFormato, setFiltroFormato,
    filtroTempo, setFiltroTempo,
    filtroMes, setFiltroMes, setFiltroMesLocal,
    filtroOrigem, setFiltroOrigem,
    busca, setBusca,
    macroTemp, setMacroTemp,
    aprendizadoOk, setAprendizadoOk,
    selecionados, setSelecionados,
    lockedIds, setLockedIds,
    ordemValor, setOrdemValor,
    filtrosColuna, setFiltrosColuna, setFiltroCol,
    // Computed
    valoresColuna,
    valoresCascata,
    categoriasCascata,
    transacoesFiltradas,
    semCategoria,
    comCategoria,
    totalCategorizados,
    saldoFiltrado,
    mesesDisponiveis,
    transComRegra,
    // Actions
    temFiltroAtivo,
    atualizarLista,
    removerFiltro,
    limparTodosFiltros,
    // Helpers
    extrairKeyword,
    temRegraParaTransacao,
  };
}
