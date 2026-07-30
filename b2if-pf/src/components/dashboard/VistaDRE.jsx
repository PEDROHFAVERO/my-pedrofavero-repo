/**
 * VistaDRE.jsx — Demonstrativo de Resultado de Exercício (DRE) de Finanças Pessoais
 *
 * Visão consolidada de todos os grupos (Receitas, Essenciais, Consumo, Dívidas, Investimentos)
 * com a linha de Resultado final (Receitas - Total Despesas) por mês.
 *
 * Comportamento:
 *  - Grupos expansíveis (accordion) → categorias nível 2 expansíveis → subcategorias
 *  - Células com valor REAL → clica → ModalDetalheCategoria (categoria e subcategoria)
 *  - Células com valor PROJETADO → clica → input inline editável
 *  - Drag-to-replicate com ghost preview durante o drag
 *  - Salvar persiste no mesmo planejamento[ano][mes][catId].projetado
 *  - Linha de Resultado: Receitas - (Essenciais + Consumo + Dívidas + Investimentos)
 *  - Colunas Jan→Dez fixas
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Save, X } from 'lucide-react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Card, fmtBRL } from '../UI.jsx';
import { GRUPOS, MESES } from '../../data/categorias.js';
import { ModalDetalheCategoria } from './ModalDetalheCategoria.jsx';

// ── Constantes de grupos na ordem da DRE ──────────────────────────────────────
const GRUPOS_DRE = [
  { key: GRUPOS.RECEITAS,      label: 'Receitas',               tipo: 'receita',  cor: null }, // cor via C.rec
  { key: GRUPOS.FIXAS,         label: 'Despesas Essenciais',    tipo: 'despesa',  cor: null },
  { key: GRUPOS.CONSUMO,       label: 'Consumo Mensal',         tipo: 'despesa',  cor: null },
  { key: GRUPOS.DIVIDAS,       label: 'Dívidas',                tipo: 'despesa',  cor: null },
  { key: GRUPOS.INVESTIMENTOS, label: 'Investimentos',          tipo: 'despesa',  cor: null },
];

function corDoGrupo(grupo) {
  if (grupo === GRUPOS.RECEITAS)      return C.rec;
  if (grupo === GRUPOS.FIXAS)         return C.grupoFixas;
  if (grupo === GRUPOS.CONSUMO)       return C.grupoConsumo;
  if (grupo === GRUPOS.DIVIDAS)       return C.grupoDividas;
  if (grupo === GRUPOS.INVESTIMENTOS) return C.grupoInvestimentos;
  return C.textMuted;
}

// ── Célula de input inline ────────────────────────────────────────────────────
function CelulaInput({ valor, onConfirm, onCancel, onDragStart, mesIdx }) {
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
    <td style={{ padding: '4px 6px', background: 'rgba(96,165,250,0.08)', minWidth: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <input
          ref={inputRef}
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={confirmar}
          onKeyDown={handleKey}
          placeholder="0"
          style={{
            width: '100%', minWidth: 55,
            background: 'transparent',
            border: 'none', borderBottom: '1px solid #60A5FA',
            color: '#60A5FA', fontStyle: 'italic',
            fontSize: FONT.xs, fontFamily: "'Inter', sans-serif",
            textAlign: 'right', outline: 'none', padding: '2px',
          }}
        />
        <div
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onDragStart(mesIdx); }}
          title="Arrastar para replicar nos próximos meses"
          style={{
            width: 9, height: 9, borderRadius: '50%',
            background: '#60A5FA', cursor: 'col-resize', flexShrink: 0,
            border: '2px solid rgba(96,165,250,0.4)', transition: 'transform .1s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.5)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        />
      </div>
    </td>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VistaDRE principal
// ══════════════════════════════════════════════════════════════════════════════
export function VistaDRE({
  categorias,           // subcategorias (folhas)
  categoriasNivel2,     // categorias intermediárias
  planAno,              // planejamento[ano]
  realizadoPorMes,
  parcelasFuturas,
  anoAtivo,
  onSalvarProjecao,
  transacoesFiltradas,
  setClienteAtivo,
  clienteAtivo,
  modoLeitura,
}) {
  // ── Estado de expansão: grupos e cats2 ────────────────────────────────────
  // gruposExp: Set de chaves de grupo (ex: 'Receitas')
  const [gruposExp, setGruposExp]   = useState(new Set(GRUPOS_DRE.map(g => g.key)));
  // cats2Exp: Set de cat2.id
  const [cats2Exp, setCats2Exp]     = useState(new Set());

  const toggleGrupo = (key) => setGruposExp(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const toggleCat2 = (id) => setCats2Exp(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // ── Projeções locais (edit buffer) ────────────────────────────────────────
  const [projecoesLocais, setProjecoesLocais] = useState({});
  const [isDirty, setIsDirty]                 = useState(false);
  const [editando, setEditando]               = useState(null); // { catId, mesIdx }
  const [drag, setDrag]                       = useState(null); // { catId, fromMes, currentMes }
  const dragRef                               = useRef(null);

  // ── Modal de detalhe ──────────────────────────────────────────────────────
  const [modalDetalhe, setModalDetalhe] = useState(null);

  // ── planAno efetivo ───────────────────────────────────────────────────────
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

  // ── Helpers de dado ───────────────────────────────────────────────────────
  const getDadosSub = useCallback((catId, mi, isReceita) => {
    const planMes = planAnoEfetivo[mi] || {};
    const realMes = realizadoPorMes[mi] || {};
    const parcMes = parcelasFuturas[mi] || {};
    const real = isReceita ? (realMes[catId]?.receita || 0) : (realMes[catId]?.despesa || 0);
    const proj = planMes[catId]?.projetado || 0;
    const parc = parcMes[catId] || planMes[catId]?.parcelas || 0;
    const temReal = real > 0;
    return { real, proj, parc, temReal };
  }, [planAnoEfetivo, realizadoPorMes, parcelasFuturas]);

  // Totais de grupo por mês
  const getTotaisGrupoMes = useCallback((grupoKey, mi) => {
    const isReceita = grupoKey === GRUPOS.RECEITAS;
    const cats = categorias.filter(c => c.grupo === grupoKey && !c.isCategoria);
    let real = 0, proj = 0;
    for (const c of cats) {
      const d = getDadosSub(c.id, mi, isReceita);
      real += d.real; proj += d.proj;
    }
    return { real, proj };
  }, [categorias, getDadosSub]);

  // Totais de cat2 por mês
  const getTotaisCat2Mes = useCallback((cat2Id, mi, isReceita) => {
    const subs = categorias.filter(c => c.categoria === cat2Id);
    let real = 0, proj = 0;
    for (const s of subs) {
      const d = getDadosSub(s.id, mi, isReceita);
      real += d.real; proj += d.proj;
    }
    return { real, proj, temReal: real > 0 };
  }, [categorias, getDadosSub]);

  // ── Edição inline ─────────────────────────────────────────────────────────
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

  const iniciarDrag = useCallback((catId, fromMes) => {
    setDrag({ catId, fromMes, currentMes: fromMes });
    dragRef.current = { catId, fromMes, currentMes: fromMes };
  }, []);

  useEffect(() => {
    if (!drag) return;
    const handleMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const td = el?.closest('[data-dre-mes]');
      if (td) {
        const mi = Number(td.dataset.dreMes);
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
          // Determina isReceita do catId
          const cat = categorias.find(c => c.id === catId);
          const isReceita = cat?.grupo === GRUPOS.RECEITAS;
          setProjecoesLocais(prev => {
            const clone = { ...prev };
            for (let m = fromMes + 1; m <= currentMes; m++) {
              const d = getDadosSub(catId, m, isReceita);
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
  }, [drag, projecoesLocais, planAnoEfetivo, getDadosSub, categorias]);

  // ── Salvar ────────────────────────────────────────────────────────────────
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

  // ── Totais anuais por grupo (para coluna Total) ───────────────────────────
  const totaisGrupoAno = useMemo(() => {
    const map = {};
    for (const g of GRUPOS_DRE) {
      const isReceita = g.key === GRUPOS.RECEITAS;
      const cats = categorias.filter(c => c.grupo === g.key && !c.isCategoria);
      let real = 0, proj = 0;
      for (let mi = 0; mi < 12; mi++) {
        const t = getTotaisGrupoMes(g.key, mi);
        real += t.real; proj += t.proj;
      }
      map[g.key] = { real, proj };
    }
    return map;
  }, [categorias, getTotaisGrupoMes]);

  // ── Resultado por mês: receitas, despesas e saldo ────────────────────────
  const receitasPorMes = useMemo(() => {
    return MESES.map((_, mi) => {
      const rec = getTotaisGrupoMes(GRUPOS.RECEITAS, mi);
      return rec.real > 0 ? rec.real : rec.proj;
    });
  }, [getTotaisGrupoMes]);

  const despesasPorMesDRE = useMemo(() => {
    const despGrupos = GRUPOS_DRE.filter(g => g.key !== GRUPOS.RECEITAS);
    return MESES.map((_, mi) => {
      let totalDesp = 0;
      for (const g of despGrupos) {
        const t = getTotaisGrupoMes(g.key, mi);
        totalDesp += t.real > 0 ? t.real : t.proj;
      }
      return totalDesp;
    });
  }, [getTotaisGrupoMes]);

  const resultadoPorMes = useMemo(() =>
    receitasPorMes.map((rec, mi) => rec - despesasPorMesDRE[mi]),
  [receitasPorMes, despesasPorMesDRE]);

  const resultadoAnual      = useMemo(() => resultadoPorMes.reduce((s, v) => s + v, 0), [resultadoPorMes]);
  const totalReceitasAnual  = useMemo(() => receitasPorMes.reduce((s, v) => s + v, 0), [receitasPorMes]);
  const totalDespesasAnual  = useMemo(() => despesasPorMesDRE.reduce((s, v) => s + v, 0), [despesasPorMesDRE]);

  // ── Estilos ───────────────────────────────────────────────────────────────
  const COL_NOME_W = 230;
  const thS = {
    padding: '9px 10px', textAlign: 'right', color: C.textMuted,
    fontWeight: 600, fontSize: FONT.xs, borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
  };

  // ── Renderiza célula de subcategoria ──────────────────────────────────────
  const renderCelulaSub = useCallback((catId, mi, isReceita, onClickReal) => {
    const d        = getDadosSub(catId, mi, isReceita);
    const isEd     = editando?.catId === catId && editando?.mesIdx === mi;
    const projLocal = projecoesLocais[mi]?.[catId];

    const isDragGhost = drag
      && drag.catId === catId
      && mi > drag.fromMes
      && mi <= drag.currentMes
      && !d.temReal;

    const valorDrag = drag
      ? (projecoesLocais[drag.fromMes]?.[drag.catId]
          ?? planAnoEfetivo[drag.fromMes]?.[drag.catId]?.projetado
          ?? 0)
      : 0;

    if (isEd) {
      const valorAtual = projLocal ?? d.proj;
      return (
        <CelulaInput
          key={mi}
          valor={valorAtual}
          mesIdx={mi}
          onConfirm={v => confirmarEdicao(catId, mi, v)}
          onCancel={cancelarEdicao}
          onDragStart={fromMes => iniciarDrag(catId, fromMes)}
        />
      );
    }

    if (isDragGhost) {
      return (
        <td key={mi} data-dre-mes={mi} style={{ padding: '6px 8px', textAlign: 'right', background: 'rgba(96,165,250,0.09)', minWidth: 88 }}>
          <div style={{ color: '#60A5FA', fontStyle: 'italic', opacity: 0.42 }}>
            {valorDrag > 0 ? fmtBRL(valorDrag) : '—'}
          </div>
        </td>
      );
    }

    const realVal  = d.real;
    const projVal  = projLocal !== undefined ? projLocal : d.proj;
    const isEmpty  = realVal === 0 && projVal === 0;

    const handleClick = !modoLeitura
      ? (d.temReal ? onClickReal : () => setEditando({ catId, mesIdx: mi }))
      : undefined;

    return (
      <td
        key={mi}
        data-dre-mes={mi}
        style={{ padding: 0, minWidth: 88 }}
      >
        <div
          style={{ padding: '6px 8px', textAlign: 'right', cursor: handleClick ? 'pointer' : 'default', transition: 'background .1s' }}
          onClick={handleClick}
          title={handleClick ? (d.temReal ? 'Ver lançamentos' : 'Clique para adicionar projeção') : undefined}
          onMouseEnter={e => { if (handleClick) e.currentTarget.style.background = d.temReal ? 'rgba(0,0,0,0.05)' : 'rgba(96,165,250,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          {isEmpty ? (
            <span style={{ color: C.textDim }}>—</span>
          ) : (
            <>
              <div style={{
                color: d.temReal ? 'inherit' : '#60A5FA',
                fontStyle: d.temReal ? 'normal' : 'italic',
                textDecoration: d.temReal ? 'underline dotted' : 'none',
                textDecorationColor: 'rgba(0,0,0,0.25)',
                whiteSpace: 'nowrap',
              }}>
                {fmtBRL(d.temReal ? realVal : projVal)}
              </div>
              {d.temReal && projVal > 0 && Math.abs(realVal - projVal) > 0.5 && (
                <div style={{ color: C.textDim, fontSize: '0.80em', fontStyle: 'italic' }}>{fmtBRL(projVal)}</div>
              )}
            </>
          )}
        </div>
      </td>
    );
  }, [getDadosSub, editando, projecoesLocais, drag, planAnoEfetivo, modoLeitura, confirmarEdicao, cancelarEdicao, iniciarDrag]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Card padding="0" style={{ marginBottom: 20, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text }}>DRE — Finanças Pessoais {anoAtivo}</div>
            <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 2 }}>Demonstrativo de Resultado · Jan → Dez</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: FONT.xs, color: C.textMuted }}>
              <span><span style={{ color: C.rec, fontWeight: 700 }}>■</span> Realizado</span>
              <span><span style={{ color: '#60A5FA', fontStyle: 'italic' }}>■</span> Projeção</span>
            </div>
            {isDirty && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleDescartar} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: FONT.xs, color: C.textMuted, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
                  <X size={11} /> Descartar
                </button>
                <button onClick={handleSalvar} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: FONT.xs, color: '#fff', background: C.brand, border: 'none', borderRadius: RADIUS.sm, padding: '3px 12px', cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontWeight: 700 }}>
                  <Save size={11} /> Salvar projeções
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabela DRE */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', tableLayout: 'fixed', minWidth: 1100 }}>
            <colgroup>
              <col style={{ width: COL_NOME_W }} />
              {MESES.map((_, i) => <col key={i} style={{ width: 88 }} />)}
              <col style={{ width: 96 }} />
            </colgroup>
            <thead>
              <tr style={{ background: C.bg }}>
                <th style={{ ...thS, textAlign: 'left', paddingLeft: 14, fontSize: '0.70rem' }}>Categoria</th>
                {MESES.map((m, i) => (
                  <th key={i} style={{ ...thS, fontSize: '0.70rem' }}>{m}</th>
                ))}
                <th style={{ ...thS, color: C.text, fontSize: '0.70rem' }}>Total</th>
              </tr>
            </thead>

            <tbody>
              {GRUPOS_DRE.map((grupoInfo, gi) => {
                const cor        = corDoGrupo(grupoInfo.key);
                const isReceita  = grupoInfo.key === GRUPOS.RECEITAS;
                const grupoExpd  = gruposExp.has(grupoInfo.key);
                const cats2Grupo = (categoriasNivel2 || []).filter(c => c.grupo === grupoInfo.key);
                const totAno     = totaisGrupoAno[grupoInfo.key] || { real: 0, proj: 0 };

                // Separador visual entre grupos (exceto o primeiro)
                const separador = gi > 0 ? (
                  <tr key={`sep-${grupoInfo.key}`}>
                    <td colSpan={14} style={{ padding: 0, height: 6, background: C.bg, borderTop: `1px solid ${C.border}30` }} />
                  </tr>
                ) : null;

                // Linha de total do grupo
                const linhaGrupo = (
                  <tr
                    key={`grupo-${grupoInfo.key}`}
                    style={{ background: cor + '14', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = cor + '22'}
                    onMouseLeave={e => e.currentTarget.style.background = cor + '14'}
                    onClick={() => toggleGrupo(grupoInfo.key)}
                  >
                    <td style={{ padding: '11px 10px 11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {grupoExpd
                          ? <ChevronDown size={12} color={cor} style={{ flexShrink: 0 }} />
                          : <ChevronRight size={12} color={cor} style={{ flexShrink: 0 }} />
                        }
                        <span style={{ fontWeight: 800, color: cor, fontSize: FONT.sm, letterSpacing: '0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {grupoInfo.label.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    {MESES.map((_, mi) => {
                      const t = getTotaisGrupoMes(grupoInfo.key, mi);
                      const v = t.real > 0 ? t.real : t.proj;
                      const isReal = t.real > 0;
                      return (
                        <td key={mi} data-dre-mes={mi} style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 700, color: isReal ? cor : '#60A5FA', fontStyle: isReal ? 'normal' : 'italic', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {v > 0 ? fmtBRL(v) : <span style={{ color: C.textDim, fontWeight: 400 }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: 800, color: totAno.real > 0 ? cor : '#60A5FA', fontStyle: totAno.real > 0 ? 'normal' : 'italic', fontSize: '0.78rem', borderLeft: `2px solid ${cor}30`, whiteSpace: 'nowrap' }}>
                      {fmtBRL(totAno.real || totAno.proj)}
                    </td>
                  </tr>
                );

                // Linhas internas (categorias nível 2 + subcategorias)
                const linhasInternas = !grupoExpd ? [] : cats2Grupo.map(cat2 => {
                  const cat2Expd = cats2Exp.has(cat2.id);
                  const subs     = categorias.filter(c => c.categoria === cat2.id);
                  // Totais anuais da cat2
                  let cat2Real = 0, cat2Proj = 0;
                  for (let mi = 0; mi < 12; mi++) {
                    const t = getTotaisCat2Mes(cat2.id, mi, isReceita);
                    cat2Real += t.real; cat2Proj += t.proj;
                  }
                  if (cat2Real === 0 && cat2Proj === 0) return null;

                  return (
                    <React.Fragment key={cat2.id}>
                      {/* Linha cat2 */}
                      <tr
                        style={{ background: cor + '08', borderBottom: `1px solid ${C.border}1A` }}
                        onMouseEnter={e => e.currentTarget.style.background = cor + '14'}
                        onMouseLeave={e => e.currentTarget.style.background = cor + '08'}
                      >
                        <td
                          style={{ padding: '8px 10px 8px 28px', cursor: 'pointer', overflow: 'hidden' }}
                          onClick={() => toggleCat2(cat2.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <ChevronRight size={9} color={cor} style={{ flexShrink: 0, transition: 'transform .15s', transform: cat2Expd ? 'rotate(90deg)' : 'none' }} />
                            <span style={{ fontWeight: 700, color: C.text, fontSize: FONT.xs, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat2.nome}</span>
                            <span style={{ fontSize: 9, color: C.textDim, background: cor + '18', borderRadius: 8, padding: '1px 5px', flexShrink: 0 }}>{subs.length}</span>
                          </div>
                        </td>
                        {MESES.map((_, mi) => {
                          const t = getTotaisCat2Mes(cat2.id, mi, isReceita);
                          const v = t.temReal ? t.real : t.proj;
                          const handleClick = t.temReal
                            ? () => setModalDetalhe({ cat2Id: cat2.id, cat2Nome: cat2.nome, mesIdx: mi })
                            : () => toggleCat2(cat2.id);
                          return (
                            <td
                              key={mi}
                              data-dre-mes={mi}
                              style={{ padding: '6px 8px', textAlign: 'right', cursor: 'pointer', minWidth: 88 }}
                              onClick={handleClick}
                              title={t.temReal ? 'Ver lançamentos' : undefined}
                            >
                              {v > 0 ? (
                                <div style={{
                                  color: t.temReal ? cor : '#60A5FA',
                                  fontWeight: t.temReal ? 700 : 500,
                                  fontStyle: t.temReal ? 'normal' : 'italic',
                                  textDecoration: t.temReal ? 'underline dotted' : 'none',
                                  textDecorationColor: cor + '50',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {fmtBRL(v)}
                                </div>
                              ) : (
                                <span style={{ color: C.textDim }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: cat2Real > 0 ? cor : '#60A5FA', fontStyle: cat2Real > 0 ? 'normal' : 'italic', borderLeft: `1px solid ${C.border}28`, whiteSpace: 'nowrap' }}>
                          {fmtBRL(cat2Real || cat2Proj)}
                        </td>
                      </tr>

                      {/* Subcategorias */}
                      {cat2Expd && subs.map(sub => {
                        let subReal = 0, subProj = 0;
                        for (let mi = 0; mi < 12; mi++) {
                          const d = getDadosSub(sub.id, mi, isReceita);
                          subReal += d.real; subProj += d.proj;
                        }
                        const temProjecaoLocal = Object.values(projecoesLocais).some(m => m[sub.id] !== undefined);
                        if (subReal === 0 && subProj === 0 && !temProjecaoLocal) return null;
                        return (
                          <tr
                            key={sub.id}
                            style={{ background: 'transparent', borderBottom: `1px solid ${C.border}0C` }}
                            onMouseEnter={e => e.currentTarget.style.background = C.brand + '06'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '6px 10px 6px 44px', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ color: C.textDim, fontSize: 10, flexShrink: 0 }}>└</span>
                                <span style={{ color: C.textMuted, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.nome}</span>
                              </div>
                            </td>
                            {MESES.map((_, mi) => renderCelulaSub(
                              sub.id, mi, isReceita,
                              () => setModalDetalhe({ cat2Id: cat2.id, cat2Nome: cat2.nome, mesIdx: mi, subFiltroId: sub.id })
                            ))}
                            <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 500, color: subReal > 0 ? cor : '#60A5FA', fontStyle: subReal > 0 ? 'normal' : 'italic', borderLeft: `1px solid ${C.border}22`, opacity: 0.85, whiteSpace: 'nowrap' }}>
                              {fmtBRL(subReal || subProj)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                }).filter(Boolean);

                return (
                  <React.Fragment key={grupoInfo.key}>
                    {separador}
                    {linhaGrupo}
                    {linhasInternas}
                  </React.Fragment>
                );
              })}

              {/* ── Linhas de Resultado: Total Receitas | Total Gastos | Saldo Final ── */}
              <tr>
                <td colSpan={14} style={{ padding: 0, height: 8, background: C.bg, borderTop: `2px solid ${C.border}40` }} />
              </tr>

              {/* Sub-linha 1: Total Receitas */}
              <tr style={{ background: `${C.rec}06` }}>
                <td style={{ padding: '10px 10px 10px 14px', borderLeft: `3px solid ${C.rec}` }}>
                  <div style={{ fontWeight: 700, color: C.rec, fontSize: FONT.xs, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total Receitas</div>
                </td>
                {receitasPorMes.map((val, mi) => (
                  <td key={mi} style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', color: val !== 0 ? C.rec : C.textDim }}>
                    {val !== 0 ? fmtBRL(val) : <span style={{ fontWeight: 400 }}>—</span>}
                  </td>
                ))}
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, fontSize: FONT.sm, borderLeft: `2px solid ${C.border}40`, color: C.rec }}>
                  {totalReceitasAnual !== 0 ? fmtBRL(totalReceitasAnual) : '—'}
                </td>
              </tr>

              {/* Sub-linha 2: Total Gastos */}
              <tr style={{ background: `${C.desp}06` }}>
                <td style={{ padding: '10px 10px 10px 14px', borderLeft: `3px solid ${C.desp}` }}>
                  <div style={{ fontWeight: 700, color: C.desp, fontSize: FONT.xs, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total Gastos</div>
                </td>
                {despesasPorMesDRE.map((val, mi) => (
                  <td key={mi} style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap', color: val !== 0 ? C.desp : C.textDim }}>
                    {val !== 0 ? fmtBRL(val) : <span style={{ fontWeight: 400 }}>—</span>}
                  </td>
                ))}
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, fontSize: FONT.sm, borderLeft: `2px solid ${C.border}40`, color: C.desp }}>
                  {totalDespesasAnual !== 0 ? fmtBRL(totalDespesasAnual) : '—'}
                </td>
              </tr>

              {/* Sub-linha 3: Saldo Final (destaque) */}
              <tr style={{ background: C.bg }}>
                <td style={{ padding: '12px 10px 14px 14px', borderLeft: `3px solid ${C.brand}`, borderTop: `1px solid ${C.border}40` }}>
                  <div style={{ fontWeight: 800, color: C.text, fontSize: FONT.sm, letterSpacing: '0.02em' }}>SALDO FINAL</div>
                  <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 2 }}>Receitas − Despesas</div>
                </td>
                {resultadoPorMes.map((val, mi) => {
                  const positivo = val >= 0;
                  const cor = positivo ? C.rec : C.desp;
                  return (
                    <td key={mi} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: '0.78rem', whiteSpace: 'nowrap', borderTop: `1px solid ${C.border}40` }}>
                      <div style={{ color: val !== 0 ? cor : C.textDim, fontStyle: 'normal' }}>
                        {val !== 0 ? fmtBRL(val) : <span style={{ fontWeight: 400 }}>—</span>}
                      </div>
                      {val !== 0 && (
                        <div style={{ marginTop: 3, height: 3, borderRadius: 2, background: cor + '30', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(Math.abs(val) / 10000 * 100, 100)}%`, background: cor, borderRadius: 2 }} />
                        </div>
                      )}
                    </td>
                  );
                })}
                <td style={{ padding: '14px 10px', textAlign: 'right', fontWeight: 800, fontSize: FONT.base, borderLeft: `2px solid ${C.border}40`, borderTop: `1px solid ${C.border}40` }}>
                  <div style={{ color: resultadoAnual >= 0 ? C.rec : C.desp }}>
                    {fmtBRL(resultadoAnual)}
                  </div>
                  <div style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 400, marginTop: 2 }}>
                    {resultadoAnual >= 0 ? '✓ Superávit' : '⚠ Déficit'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modal de detalhe ──────────────────────────────────────────────── */}
      {modalDetalhe && transacoesFiltradas && (
        <ModalDetalheCategoria
          cat2Id={modalDetalhe.cat2Id}
          cat2Nome={modalDetalhe.cat2Nome}
          tipo={
            (categoriasNivel2 || []).find(c => c.id === modalDetalhe.cat2Id)?.grupo === GRUPOS.RECEITAS
              ? 'receita' : 'despesa'
          }
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
    </>
  );
}
