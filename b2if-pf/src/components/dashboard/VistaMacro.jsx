/**
 * VistaMacro.jsx — Tabela hierárquica Jan→Dez com edição inline de projeções
 *
 * Features:
 *  - Clicar em valor REAL de categoria ou subcategoria → abre ModalDetalheCategoria
 *  - Clicar em célula VAZIA de subcategoria → input inline de projeção (azul itálico)
 *  - Alça de drag (canto direito do input) → replica valor nos meses seguintes sem real
 *    com ghost preview durante o drag (valores-destino em 40% opacidade)
 *  - Botão "+ Projetar categoria" → dropdown de busca entre cats do grupo sem lançamento
 *  - isDirty local → botão "Salvar projeções" no header da tabela
 *  - Salvar grava em clienteAtivo.planejamento[ano][mes][catId].projetado
 *    (mesma fonte lida por Planejador, Orçamento e Limites & Metas)
 *  - Diferença visual entre linhas de categoria (sombreadas) e subcategoria (mais suaves)
 *  - table-layout: fixed com largura fixa na coluna de nome para evitar desalinhamento
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, Plus, Save, X } from 'lucide-react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Card, fmtBRL } from '../UI.jsx';
import { GRUPOS, MESES } from '../../data/categorias.js';
import { KPICard } from './KPICard.jsx';
import { ModalDetalheCategoria } from './ModalDetalheCategoria.jsx';

// ── Célula de input inline de projeção ───────────────────────────────────────
function CelulaInput({ valor, onChange, onConfirm, onCancel, onDragStart, mesIdx }) {
  const inputRef = useRef(null);
  const [raw, setRaw] = useState(valor > 0 ? String(valor) : '');

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const confirmar = () => {
    const v = parseFloat(raw.replace(',', '.')) || 0;
    onConfirm(v);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); confirmar(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    if (e.key === 'Tab')    { e.preventDefault(); confirmar(); }
  };

  return (
    <td style={{ padding: '4px 6px', position: 'relative', background: 'rgba(96,165,250,0.08)', minWidth: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <input
          ref={inputRef}
          value={raw}
          onChange={e => { setRaw(e.target.value); onChange(parseFloat(e.target.value.replace(',', '.')) || 0); }}
          onBlur={confirmar}
          onKeyDown={handleKey}
          placeholder="0"
          style={{
            width: '100%',
            minWidth: 55,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #60A5FA',
            color: '#60A5FA',
            fontStyle: 'italic',
            fontSize: FONT.xs,
            fontFamily: "'Inter', sans-serif",
            textAlign: 'right',
            outline: 'none',
            padding: '2px 2px',
          }}
        />
        {/* Alça de drag */}
        <div
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDragStart(mesIdx); }}
          title="Arrastar para replicar nos próximos meses"
          style={{
            width: 9, height: 9,
            borderRadius: '50%',
            background: '#60A5FA',
            cursor: 'col-resize',
            flexShrink: 0,
            border: '2px solid rgba(96,165,250,0.4)',
            transition: 'transform .1s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.5)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        />
      </div>
    </td>
  );
}

// ── Modal "+ Projetar categoria" ──────────────────────────────────────────────
function ModalProjetarCategoria({ catsDisponiveis, onSelecionar, onFechar }) {
  const [busca, setBusca] = useState('');
  const filtradas = useMemo(() =>
    catsDisponiveis.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase())),
    [catsDisponiveis, busca]
  );
  const overlayRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onFechar]);

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onFechar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: C.card, borderRadius: RADIUS.lg,
        border: `1px solid ${C.border}`,
        width: 420, maxHeight: '65vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: FONT.base, color: C.text }}>Projetar categoria</span>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '12px 20px 8px', flexShrink: 0 }}>
          <input
            autoFocus
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar subcategoria..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: RADIUS.md, padding: '8px 12px',
              color: C.text, fontSize: FONT.sm,
              fontFamily: "'Inter', sans-serif", outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px' }}>
          {filtradas.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.textMuted, fontSize: FONT.sm }}>
              Nenhuma subcategoria disponível
            </div>
          ) : filtradas.map(c => (
            <button
              key={c.id}
              onClick={() => onSelecionar(c)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px', borderRadius: RADIUS.md,
                background: 'transparent', border: 'none',
                color: C.text, fontSize: FONT.sm, cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'background .12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.border + '44'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 500 }}>{c.nome}</div>
              {c.nomeCategoriaPai && (
                <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 1 }}>{c.nomeCategoriaPai}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VistaMacro principal
// ══════════════════════════════════════════════════════════════════════════════
export function VistaMacro({
  grupo, label, dadosMensais,
  totaisGrupo,
  categorias,          // subcategorias (folhas)
  categoriasNivel2,    // categorias intermediárias
  planAno,             // planejamento[ano]
  realizadoPorMes,
  parcelasFuturas,
  anoAtivo,
  todasCategorias,     // _todasCats completo (para o modal de "+ projetar")
  onSalvarProjecao,    // fn(novosPlanAno) — persiste no cliente
  transacoesFiltradas, // para o ModalDetalheCategoria
  setClienteAtivo,     // para o ModalDetalheCategoria
  clienteAtivo,        // para o ModalDetalheCategoria
  modoLeitura,
}) {
  const isReceita = grupo === GRUPOS.RECEITAS;

  // ── Estado expandir/colapsar ──────────────────────────────────────────────
  const [expandidas, setExpandidas] = useState(new Set());
  const toggleExp = (id) => setExpandidas(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // ── Projeções locais (edit buffer) ────────────────────────────────────────
  const [projecoesLocais, setProjecoesLocais] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  // ── Célula em edição ──────────────────────────────────────────────────────
  const [editando, setEditando] = useState(null); // null | { catId, mesIdx }

  // ── Drag state ────────────────────────────────────────────────────────────
  const [drag, setDrag] = useState(null); // { catId, fromMes, currentMes }
  const dragRef = useRef(null);

  // ── Categorias extras projetadas ─────────────────────────────────────────
  const [catsExtras, setCatsExtras] = useState([]);

  // ── Modais ────────────────────────────────────────────────────────────────
  const [modalDetalhe, setModalDetalhe]         = useState(null); // { cat2Id, cat2Nome, mesIdx, isSub, subId }
  const [showModalProjetar, setShowModalProjetar] = useState(false);

  const corGrupo = grupo === GRUPOS.RECEITAS      ? C.rec
    : grupo === GRUPOS.FIXAS         ? C.grupoFixas
    : grupo === GRUPOS.CONSUMO       ? C.grupoConsumo
    : grupo === GRUPOS.DIVIDAS       ? C.grupoDividas
    : grupo === GRUPOS.INVESTIMENTOS ? C.grupoInvestimentos
    : C.textMuted;

  const cats     = useMemo(() => categorias.filter(c => c.grupo === grupo), [categorias, grupo]);
  const cats2All = useMemo(() => (categoriasNivel2 || []).filter(c => c.grupo === grupo), [categoriasNivel2, grupo]);
  const orfas    = useMemo(() => cats.filter(c => !c.categoria), [cats]);

  // ── planAno efetivo = planAno + projeções locais ──────────────────────────
  const planAnoEfetivo = useMemo(() => {
    const clone = JSON.parse(JSON.stringify(planAno));
    for (const [mesStr, catsMap] of Object.entries(projecoesLocais)) {
      const mi = Number(mesStr);
      if (!clone[mi]) clone[mi] = {};
      for (const [catId, val] of Object.entries(catsMap)) {
        if (!clone[mi][catId]) clone[mi][catId] = { projetado: 0, parcelas: 0 };
        clone[mi][catId].projetado = val;
      }
    }
    return clone;
  }, [planAno, projecoesLocais]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const totaisAno = useMemo(() => {
    let real = 0, proj = 0, parc = 0;
    for (let i = 0; i < 12; i++) {
      const t = totaisGrupo(grupo, i);
      real += t.realizado; proj += t.projetado; parc += t.parcelas;
    }
    return { real, proj, parc };
  }, [grupo, totaisGrupo]);

  const { execPct, esperadoPct, ritmoPct } = useMemo(() => {
    const mesesReais = dadosMensais.filter(d => d.temReal).length;
    if (mesesReais === 0 || totaisAno.proj === 0) return { execPct: null, esperadoPct: null, ritmoPct: null };
    const execPct     = totaisAno.real / totaisAno.proj * 100;
    const esperadoPct = mesesReais / 12 * 100;
    const ritmoPct    = execPct / esperadoPct * 100;
    return { execPct, esperadoPct, ritmoPct };
  }, [dadosMensais, totaisAno]);

  // ── getDadosSub ───────────────────────────────────────────────────────────
  const getDadosSub = useCallback((catId, mi) => {
    const planMes = planAnoEfetivo[mi] || {};
    const realMes = realizadoPorMes[mi] || {};
    const parcMes = parcelasFuturas[mi] || {};
    const real = isReceita ? (realMes[catId]?.receita || 0) : (realMes[catId]?.despesa || 0);
    const proj = planMes[catId]?.projetado || 0;
    const parc = parcMes[catId] || planMes[catId]?.parcelas || 0;
    // temReal: TRUE só se ESTA subcategoria tem lançamento neste mês
    const temReal = real > 0;
    return { real, proj, parc, temReal };
  }, [isReceita, planAnoEfetivo, realizadoPorMes, parcelasFuturas]);

  const totaisPorSub = useMemo(() => {
    const allCats = [...cats, ...catsExtras.filter(c => c.grupo === grupo)];
    const map = {};
    for (const cat of allCats) {
      let real = 0, proj = 0, parc = 0;
      for (let i = 0; i < 12; i++) {
        const d = getDadosSub(cat.id, i);
        real += d.real; proj += d.proj; parc += d.parc;
      }
      map[cat.id] = { real, proj, parc };
    }
    return map;
  }, [cats, catsExtras, grupo, getDadosSub]);

  const totaisPorCat2 = useMemo(() => {
    const map = {};
    for (const cat2 of cats2All) {
      const subs = cats.filter(c => c.categoria === cat2.id);
      let real = 0, proj = 0, parc = 0;
      for (const s of subs) {
        real += totaisPorSub[s.id]?.real || 0;
        proj += totaisPorSub[s.id]?.proj || 0;
        parc += totaisPorSub[s.id]?.parc || 0;
      }
      map[cat2.id] = { real, proj, parc };
    }
    return map;
  }, [cats2All, cats, totaisPorSub]);

  const cats2 = useMemo(() =>
    [...cats2All].sort((a, b) => (totaisPorCat2[b.id]?.real || 0) - (totaisPorCat2[a.id]?.real || 0)),
  [cats2All, totaisPorCat2]);

  const expandirTudo  = useCallback(() => setExpandidas(new Set(cats2.map(c => c.id))), [cats2]);
  const colapsarTudo  = useCallback(() => setExpandidas(new Set()), []);
  const algumExpandido = cats2.some(c => expandidas.has(c.id));

  const linhasOrdenadas = useMemo(() => {
    const extrasDoGrupo = catsExtras.filter(c => c.grupo === grupo);
    return [
      ...cats2.map(c => ({ tipo: 'cat2', item: c, real: totaisPorCat2[c.id]?.real || 0 })),
      ...orfas.map(c => ({ tipo: 'orfa', item: c, real: totaisPorSub[c.id]?.real  || 0 })),
      ...extrasDoGrupo.map(c => ({ tipo: 'extra', item: c, real: 0 })),
    ].sort((a, b) => b.real - a.real);
  }, [cats2, orfas, catsExtras, grupo, totaisPorCat2, totaisPorSub]);

  const totaisMensCat2 = useCallback((cat2Id, mi) => {
    const subs = cats.filter(c => c.categoria === cat2Id);
    let real = 0, proj = 0, parc = 0;
    subs.forEach(s => { const d = getDadosSub(s.id, mi); real += d.real; proj += d.proj; parc += d.parc; });
    const temReal = real > 0;
    return { real, proj, parc, temReal };
  }, [cats, getDadosSub]);

  // ── Edição inline ─────────────────────────────────────────────────────────
  const abrirEdicao = useCallback((catId, mesIdx) => {
    if (modoLeitura) return;
    setEditando({ catId, mesIdx });
  }, [modoLeitura]);

  const confirmarEdicao = useCallback((catId, mesIdx, valor) => {
    setProjecoesLocais(prev => {
      const clone = { ...prev };
      if (!clone[mesIdx]) clone[mesIdx] = {};
      clone[mesIdx] = { ...clone[mesIdx], [catId]: valor };
      return clone;
    });
    setIsDirty(true);
    setEditando(null);
  }, []);

  const cancelarEdicao = useCallback(() => setEditando(null), []);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const iniciarDrag = useCallback((catId, fromMes) => {
    setDrag({ catId, fromMes, currentMes: fromMes });
    dragRef.current = { catId, fromMes, currentMes: fromMes };
  }, []);

  useEffect(() => {
    if (!drag) return;

    const handleMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const td = el?.closest('[data-mes-idx]');
      if (td) {
        const mi = Number(td.dataset.mesIdx);
        if (mi >= drag.fromMes) {
          dragRef.current = { ...dragRef.current, currentMes: mi };
          setDrag(prev => ({ ...prev, currentMes: mi }));
        }
      }
    };

    const handleUp = () => {
      if (dragRef.current) {
        const { catId, fromMes, currentMes } = dragRef.current;
        const valorOrigem = projecoesLocais[fromMes]?.[catId]
          ?? planAnoEfetivo[fromMes]?.[catId]?.projetado
          ?? 0;

        if (valorOrigem > 0 && currentMes > fromMes) {
          setProjecoesLocais(prev => {
            const clone = { ...prev };
            for (let m = fromMes + 1; m <= currentMes; m++) {
              const d = getDadosSub(catId, m);
              if (!d.temReal) {
                if (!clone[m]) clone[m] = {};
                clone[m] = { ...clone[m], [catId]: valorOrigem };
              }
            }
            return clone;
          });
          setIsDirty(true);
        }
      }
      setDrag(null);
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [drag, projecoesLocais, planAnoEfetivo, getDadosSub]);

  // ── Salvar projeções ──────────────────────────────────────────────────────
  const handleSalvar = useCallback(() => {
    if (!onSalvarProjecao || !isDirty) return;
    const novoPlan = JSON.parse(JSON.stringify(planAno));
    for (const [mesStr, catsMap] of Object.entries(projecoesLocais)) {
      const mi = Number(mesStr);
      if (!novoPlan[mi]) novoPlan[mi] = {};
      for (const [catId, val] of Object.entries(catsMap)) {
        if (!novoPlan[mi][catId]) novoPlan[mi][catId] = { projetado: 0, parcelas: 0 };
        novoPlan[mi][catId].projetado = val;
      }
    }
    onSalvarProjecao(novoPlan);
    setProjecoesLocais({});
    setIsDirty(false);
  }, [onSalvarProjecao, isDirty, projecoesLocais, planAno]);

  const handleDescartar = useCallback(() => {
    setProjecoesLocais({});
    setIsDirty(false);
    setEditando(null);
  }, []);

  // ── Categorias disponíveis para projetar ──────────────────────────────────
  // Mostra subcats do grupo que NÃO têm dados na tabela (real=0 E proj=0)
  // e ainda não foram adicionadas como extras manualmente
  const catsParaProjetar = useMemo(() => {
    if (!todasCategorias) return [];
    // IDs que JÁ APARECEM na tabela (têm real ou proj > 0)
    const idsNaTabela = new Set(
      [...cats, ...catsExtras].filter(c => {
        const t = totaisPorSub[c.id];
        return t && (t.real > 0 || t.proj > 0);
      }).map(c => c.id)
    );
    const idsExtras = new Set(catsExtras.map(c => c.id));
    return todasCategorias
      .filter(c => !c.isCategoria && c.grupo === grupo && !idsNaTabela.has(c.id) && !idsExtras.has(c.id))
      .map(c => {
        const pai = todasCategorias.find(p => p.id === c.categoria);
        return { ...c, nomeCategoriaPai: pai?.nome || '' };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [todasCategorias, cats, catsExtras, grupo, totaisPorSub]);

  const adicionarCatExtra = useCallback((cat) => {
    setCatsExtras(prev => [...prev, cat]);
    setShowModalProjetar(false);
  }, []);

  // ── Modal de detalhe ──────────────────────────────────────────────────────
  const abrirModalCat2 = useCallback((cat2Id, cat2Nome, mesIdx) => {
    setModalDetalhe({ cat2Id, cat2Nome, mesIdx, subFiltroId: null });
  }, []);

  // Para subcategoria: passa cat2Id do pai + subFiltroId para pré-filtrar
  const abrirModalSub = useCallback((sub, mesIdx) => {
    const cat2 = (categoriasNivel2 || []).find(c => c.id === sub.categoria);
    setModalDetalhe({
      cat2Id:     cat2?.id   || sub.id,
      cat2Nome:   cat2?.nome || sub.nome,
      mesIdx,
      subFiltroId: sub.id,
    });
  }, [categoriasNivel2]);

  // ── Estilos ───────────────────────────────────────────────────────────────
  const thS = {
    padding: '9px 10px', textAlign: 'right', color: C.textMuted,
    fontWeight: 600, fontSize: FONT.xs, borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
  };

  // Largura fixa para coluna de nome — evita desalinhamento ao expandir
  const COL_NOME_W = 220;

  // ── Renderiza célula de subcategoria (com edição/drag/ghost) ─────────────
  const renderCelulaSub = useCallback((catId, mi, onClickReal) => {
    const d = getDadosSub(catId, mi);
    const isEditandoEsta = editando?.catId === catId && editando?.mesIdx === mi;

    // Ghost preview durante drag: meses que seriam preenchidos
    const isDragGhost = drag
      && drag.catId === catId
      && mi > drag.fromMes
      && mi <= drag.currentMes
      && !d.temReal;

    // Valor de drag (para mostrar no ghost)
    const valorDrag = drag
      ? (projecoesLocais[drag.fromMes]?.[drag.catId]
          ?? planAnoEfetivo[drag.fromMes]?.[drag.catId]?.projetado
          ?? 0)
      : 0;

    if (isEditandoEsta) {
      const valorAtual = projecoesLocais[mi]?.[catId] ?? d.proj;
      return (
        <CelulaInput
          key={mi}
          valor={valorAtual}
          mesIdx={mi}
          onChange={() => {}}
          onConfirm={(v) => confirmarEdicao(catId, mi, v)}
          onCancel={cancelarEdicao}
          onDragStart={(fromMes) => iniciarDrag(catId, fromMes)}
        />
      );
    }

    // Ghost preview — mostra valor com opacidade 40%
    if (isDragGhost) {
      return (
        <td
          key={mi}
          data-mes-idx={mi}
          style={{
            padding: '6px 8px', textAlign: 'right',
            background: 'rgba(96,165,250,0.10)',
            minWidth: 88,
          }}
        >
          <div style={{ color: '#60A5FA', fontStyle: 'italic', opacity: 0.45, fontSize: '0.72rem' }}>
            {valorDrag > 0 ? fmtBRL(valorDrag) : '—'}
          </div>
        </td>
      );
    }

    // Célula com projeção local (não salva ainda)
    const projLocal = projecoesLocais[mi]?.[catId];
    const realVal   = d.real;
    const projVal   = projLocal !== undefined ? projLocal : d.proj;
    const parcVal   = d.parc;
    const isEmpty   = realVal === 0 && projVal === 0 && parcVal === 0;

    // Clique: se tem real → modal; se não tem → editar projeção
    const handleClick = !modoLeitura
      ? (d.temReal
          ? () => onClickReal?.()
          : () => abrirEdicao(catId, mi))
      : undefined;

    return (
      <td
        key={mi}
        data-mes-idx={mi}
        style={{ padding: 0, minWidth: 88 }}
      >
        <div
          style={{
            padding: '6px 8px',
            textAlign: 'right',
            cursor: handleClick ? 'pointer' : 'default',
            transition: 'background .1s',
          }}
          onClick={handleClick}
          title={handleClick
            ? (d.temReal ? 'Ver lançamentos' : 'Clique para adicionar projeção')
            : undefined}
          onMouseEnter={e => { if (handleClick) e.currentTarget.style.background = d.temReal ? corGrupo + '10' : 'rgba(96,165,250,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          {isEmpty ? (
            <span style={{ color: C.textDim }}>—</span>
          ) : (
            <>
              <div style={{
                color: d.temReal ? corGrupo : '#60A5FA',
                fontWeight: d.temReal ? 600 : 400,
                fontStyle: d.temReal ? 'normal' : 'italic',
                textDecoration: d.temReal ? 'underline dotted' : 'none',
                textDecorationColor: corGrupo + '55',
                whiteSpace: 'nowrap',
              }}>
                {fmtBRL(d.temReal ? realVal : projVal)}
              </div>
              {/* Projetado abaixo do real (comparativo) */}
              {d.temReal && projVal > 0 && Math.abs(realVal - projVal) > 0.5 && (
                <div style={{ color: C.textDim, fontSize: '0.80em', fontStyle: 'italic', whiteSpace: 'nowrap' }}>{fmtBRL(projVal)}</div>
              )}
              {/* Parcelas */}
              {!d.temReal && parcVal > 0 && (
                <div style={{ color: '#C084FC', fontSize: '0.80em', whiteSpace: 'nowrap' }}>{fmtBRL(parcVal)}</div>
              )}
            </>
          )}
        </div>
      </td>
    );
  }, [getDadosSub, editando, projecoesLocais, drag, planAnoEfetivo, corGrupo, modoLeitura, abrirEdicao, confirmarEdicao, cancelarEdicao, iniciarDrag]);

  return (
    <>
      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="mb-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <KPICard label={`${label} — Realizado`} value={fmtBRL(totaisAno.real)} color={corGrupo}
          sub={`Proj: ${fmtBRL(totaisAno.proj)}`} />
        <KPICard label="Execução Orçamentária"
          value={execPct !== null ? `${execPct.toFixed(1)}%` : '—'}
          color={ritmoPct === null ? C.textMuted : ritmoPct > 115 ? C.desp : ritmoPct >= 92 ? C.rec : ritmoPct >= 80 ? C.yellow : C.desp}
          sub={ritmoPct === null ? 'Sem projeção'
            : `Esperado: ${esperadoPct.toFixed(1)}% · ${
                ritmoPct > 115 ? 'Acima do ritmo'
              : ritmoPct >= 92 ? 'No ritmo previsto'
              : ritmoPct >= 80 ? 'Levemente abaixo'
              : 'Abaixo do ritmo'}`} />
        <KPICard label="Média Mensal (Realizado)"
          value={fmtBRL(totaisAno.real / Math.max(dadosMensais.filter(d => d.temReal).length, 1))}
          color={corGrupo} sub={`${dadosMensais.filter(d => d.temReal).length} meses realizados`} />
        {totaisAno.parc > 0
          ? <KPICard label="Parcelas Futuras" value={fmtBRL(totaisAno.parc)} color="#C084FC" sub="comprometido em parcelamentos" />
          : <KPICard label="Projeção Anual"   value={fmtBRL(totaisAno.proj)} color={C.textMuted} sub="total orçado no ano" />
        }
      </div>

      {/* ── Tabela ────────────────────────────────────────────────────────── */}
      <Card padding="0" style={{ marginBottom: 20, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text }}>{label} — {anoAtivo}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: FONT.xs, color: C.textMuted }}>
              <span><span style={{ color: corGrupo, fontWeight: 700 }}>■</span> Realizado</span>
              <span><span style={{ color: '#60A5FA', fontStyle: 'italic' }}>■</span> Projeção</span>
            </div>
            {cats2.length > 0 && (
              <button onClick={algumExpandido ? colapsarTudo : expandirTudo}
                style={{ fontSize: FONT.xs, color: corGrupo, background: 'transparent', border: `1px solid ${corGrupo}44`, borderRadius: RADIUS.sm, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                {algumExpandido ? '⊖ Colapsar tudo' : '⊕ Expandir tudo'}
              </button>
            )}
            {!modoLeitura && (
              <button
                onClick={() => setShowModalProjetar(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: FONT.xs, color: '#60A5FA',
                  background: 'rgba(96,165,250,0.08)',
                  border: '1px solid rgba(96,165,250,0.25)',
                  borderRadius: RADIUS.sm, padding: '3px 10px',
                  cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(96,165,250,0.08)'}
              >
                <Plus size={11} /> Projetar categoria
              </button>
            )}
            {isDirty && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleDescartar} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: FONT.xs, color: C.textMuted, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                  <X size={11} /> Descartar
                </button>
                <button onClick={handleSalvar} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: FONT.xs, color: '#fff', background: C.brand, border: 'none', borderRadius: RADIUS.sm, padding: '3px 12px', cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontWeight: 700, boxShadow: `0 0 0 2px ${C.brand}44` }}>
                  <Save size={11} /> Salvar projeções
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabela com layout fixo para evitar desalinhamento */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', tableLayout: 'fixed', minWidth: 1100 }}>
            <colgroup>
              <col style={{ width: COL_NOME_W }} />
              {MESES.map((_, i) => <col key={i} style={{ width: 88 }} />)}
              <col style={{ width: 96 }} />
            </colgroup>
            <thead>
              <tr style={{ background: C.bg }}>
                <th style={{ ...thS, textAlign: 'left', paddingLeft: 14, fontSize: '0.70rem' }}>Categoria / Subcategoria</th>
                {MESES.map((m, i) => (
                  <th key={i} style={{ ...thS, color: dadosMensais[i].temReal ? C.text : C.textMuted, fontSize: '0.70rem' }}>{m}</th>
                ))}
                <th style={{ ...thS, color: corGrupo, fontSize: '0.70rem' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {linhasOrdenadas.map(({ tipo, item }) => {

                // ── Linha cat2 (categoria nível 2) ─────────────────────────
                if (tipo === 'cat2') {
                  const cat2     = item;
                  const t2       = totaisPorCat2[cat2.id] || { real: 0, proj: 0, parc: 0 };
                  if (t2.real === 0 && t2.proj === 0 && t2.parc === 0) return null;
                  const expanded = expandidas.has(cat2.id);
                  const subs     = cats.filter(c => c.categoria === cat2.id);

                  // Fundo levemente sombreado para linhas de categoria
                  const bgCat2 = corGrupo + '0C';

                  return (
                    <React.Fragment key={cat2.id}>
                      <tr
                        style={{ borderBottom: `1px solid ${C.border}22`, background: bgCat2 }}
                        onMouseEnter={e => e.currentTarget.style.background = corGrupo + '18'}
                        onMouseLeave={e => e.currentTarget.style.background = bgCat2}
                      >
                        {/* Nome — clique expande */}
                        <td
                          style={{ padding: '9px 10px 9px 14px', cursor: 'pointer', overflow: 'hidden' }}
                          onClick={() => toggleExp(cat2.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ChevronRight size={10} color={corGrupo} style={{ flexShrink: 0, transition: 'transform .15s', transform: expanded ? 'rotate(90deg)' : 'none' }} />
                            <span style={{ fontWeight: 700, color: C.text, fontSize: FONT.xs, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat2.nome}</span>
                            <span style={{ fontSize: 9, color: C.textDim, background: corGrupo + '1A', borderRadius: 8, padding: '1px 5px', flexShrink: 0 }}>{subs.length}</span>
                          </div>
                        </td>
                        {/* Células de mês */}
                        {MESES.map((_, mi) => {
                          const d = totaisMensCat2(cat2.id, mi);
                          const temRealCat2 = d.temReal && d.real > 0;
                          return (
                            <td
                              key={mi}
                              data-mes-idx={mi}
                              style={{ padding: '6px 8px', textAlign: 'right', minWidth: 80, whiteSpace: 'nowrap' }}
                              onClick={() => temRealCat2
                                ? abrirModalCat2(cat2.id, cat2.nome, mi)
                                : toggleExp(cat2.id)}
                              title={temRealCat2 ? 'Ver lançamentos' : undefined}
                            >
                              {d.real > 0 || d.proj > 0 ? (
                                <div style={{
                                  color: d.temReal ? corGrupo : '#60A5FA',
                                  fontWeight: d.temReal ? 700 : 500,
                                  fontStyle: d.temReal ? 'normal' : 'italic',
                                  cursor: temRealCat2 ? 'pointer' : 'default',
                                  textDecoration: temRealCat2 ? 'underline dotted' : 'none',
                                  textDecorationColor: corGrupo + '60',
                                  fontSize: FONT.xs,
                                }}>
                                  {fmtBRL(d.temReal ? d.real : d.proj)}
                                </div>
                              ) : (
                                <span style={{ color: C.textDim, fontSize: FONT.xs }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: t2.real > 0 ? 700 : 500, color: t2.real > 0 ? corGrupo : '#60A5FA', fontStyle: t2.real > 0 ? 'normal' : 'italic', borderLeft: `1px solid ${C.border}30`, fontSize: FONT.xs, whiteSpace: 'nowrap' }}>
                          {fmtBRL(t2.real || t2.proj)}
                        </td>
                      </tr>

                      {/* Subcategorias — visual mais suave */}
                      {expanded && subs.map(sub => {
                        const ts = totaisPorSub[sub.id] || { real: 0, proj: 0, parc: 0 };
                        const temProjecaoLocal = Object.values(projecoesLocais).some(m => m[sub.id] !== undefined);
                        if (ts.real === 0 && ts.proj === 0 && ts.parc === 0 && !temProjecaoLocal) return null;
                        return (
                          <tr
                            key={sub.id}
                            style={{ borderBottom: `1px solid ${C.border}0E`, background: 'transparent' }}
                            onMouseEnter={e => e.currentTarget.style.background = C.brand + '07'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '7px 10px 7px 28px', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ color: C.textDim, fontSize: 10, flexShrink: 0 }}>└</span>
                                <span style={{ color: C.textMuted, fontWeight: 400, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.nome}</span>
                              </div>
                            </td>
                            {MESES.map((_, mi) => renderCelulaSub(
                              sub.id, mi,
                              // onClickReal para sub: abre modal com filtro na sub
                              () => abrirModalSub(sub, mi, categorias)
                            ))}
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 500, color: ts.real > 0 ? corGrupo : '#60A5FA', fontStyle: ts.real > 0 ? 'normal' : 'italic', borderLeft: `1px solid ${C.border}28`, opacity: 0.85, fontSize: '0.78rem' }}>
                              {fmtBRL(ts.real || ts.proj)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                }

                // ── Linha órfã (subcategoria sem cat2 pai) ─────────────────
                if (tipo === 'orfa') {
                  const cat = item;
                  const ts  = totaisPorSub[cat.id] || { real: 0, proj: 0, parc: 0 };
                  const temProjecaoLocal = Object.values(projecoesLocais).some(m => m[cat.id] !== undefined);
                  if (ts.real === 0 && ts.proj === 0 && ts.parc === 0 && !temProjecaoLocal) return null;
                  return (
                    <tr key={cat.id}
                      style={{ borderBottom: `1px solid ${C.border}14`, background: corGrupo + '0A' }}
                      onMouseEnter={e => e.currentTarget.style.background = corGrupo + '14'}
                      onMouseLeave={e => e.currentTarget.style.background = corGrupo + '0A'}
                    >
                      <td style={{ padding: '9px 10px 9px 14px', color: C.text, fontWeight: 600, overflow: 'hidden', fontSize: FONT.xs }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{cat.nome}</span>
                      </td>
                      {MESES.map((_, mi) => renderCelulaSub(cat.id, mi, () => {
                        // órfã sem cat2: usamos o próprio catId como "cat2Id"
                        setModalDetalhe({ cat2Id: cat.id, cat2Nome: cat.nome, mesIdx: mi });
                      }))}
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: ts.real > 0 ? 700 : 400, color: ts.real > 0 ? corGrupo : '#60A5FA', fontStyle: ts.real > 0 ? 'normal' : 'italic', borderLeft: `1px solid ${C.border}30`, whiteSpace: 'nowrap' }}>
                        {fmtBRL(ts.real || ts.proj)}
                      </td>
                    </tr>
                  );
                }

                // ── Linha extra (projeção manual) ──────────────────────────
                if (tipo === 'extra') {
                  const cat = item;
                  const ts  = totaisPorSub[cat.id] || { real: 0, proj: 0, parc: 0 };
                  return (
                    <tr key={cat.id}
                      style={{ borderBottom: `1px solid ${C.border}14`, background: 'rgba(96,165,250,0.03)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(96,165,250,0.07)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(96,165,250,0.03)'}
                    >
                      <td style={{ padding: '9px 10px 9px 14px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: C.text, fontWeight: 500, fontSize: FONT.xs, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.nome}</span>
                          <span style={{ fontSize: 9, color: '#60A5FA', background: 'rgba(96,165,250,0.12)', borderRadius: 8, padding: '1px 5px', fontStyle: 'italic', flexShrink: 0 }}>proj</span>
                          <button
                            onClick={() => setCatsExtras(prev => prev.filter(c => c.id !== cat.id))}
                            style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 11, flexShrink: 0 }}
                            title="Remover linha de projeção"
                          >✕</button>
                        </div>
                      </td>
                      {MESES.map((_, mi) => renderCelulaSub(cat.id, mi, undefined))}
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 400, color: '#60A5FA', fontStyle: 'italic', borderLeft: `1px solid ${C.border}30`, whiteSpace: 'nowrap' }}>
                        {ts.proj > 0 ? fmtBRL(ts.proj) : '—'}
                      </td>
                    </tr>
                  );
                }

                return null;
              })}
            </tbody>

            {/* Total */}
            <tfoot>
              <tr style={{ background: corGrupo + '14', borderTop: `2px solid ${corGrupo}30` }}>
                <td style={{ padding: '10px 8px 10px 14px', fontWeight: 800, color: C.text, fontSize: '0.78rem' }}>TOTAL</td>
                {MESES.map((_, mi) => {
                  const t = totaisGrupo(grupo, mi);
                  const d = dadosMensais[mi];
                  const projLocal = Object.entries(projecoesLocais[mi] || {}).reduce((s, [, v]) => s + v, 0);
                  const v = d.temReal ? t.realizado : (t.projetado + projLocal);
                  return (
                    <td key={mi} data-mes-idx={mi} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: d.temReal ? corGrupo : '#60A5FA', fontStyle: d.temReal ? 'normal' : 'italic', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {v > 0 ? fmtBRL(v) : '—'}
                    </td>
                  );
                })}
                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: totaisAno.real > 0 ? corGrupo : '#60A5FA', fontStyle: totaisAno.real > 0 ? 'normal' : 'italic', fontSize: '0.78rem', borderLeft: `1px solid ${C.border}30`, whiteSpace: 'nowrap' }}>
                  {fmtBRL(totaisAno.real || totaisAno.proj)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* ── Modal de detalhe ──────────────────────────────────────────────── */}
      {modalDetalhe && transacoesFiltradas && (
        <ModalDetalheCategoria
          cat2Id={modalDetalhe.cat2Id}
          cat2Nome={modalDetalhe.cat2Nome}
          tipo={isReceita ? 'receita' : 'despesa'}
          mesesSelecionados={new Set([modalDetalhe.mesIdx])}
          mesesLabel={MESES[modalDetalhe.mesIdx]}
          transacoesFiltradas={transacoesFiltradas}
          categorias={categorias}
          categoriasNivel2={categoriasNivel2}
          clienteAtivo={clienteAtivo}
          setClienteAtivo={setClienteAtivo}
          subFiltroInicial={modalDetalhe.subFiltroId || ''}
          onClose={() => setModalDetalhe(null)}
        />
      )}

      {/* ── Modal "+ Projetar categoria" ───────────────────────────────────── */}
      {showModalProjetar && (
        <ModalProjetarCategoria
          catsDisponiveis={catsParaProjetar}
          onSelecionar={adicionarCatExtra}
          onFechar={() => setShowModalProjetar(false)}
        />
      )}
    </>
  );
}
