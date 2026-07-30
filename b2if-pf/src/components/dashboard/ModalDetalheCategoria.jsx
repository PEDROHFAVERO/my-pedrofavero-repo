/**
 * ModalDetalheCategoria.jsx
 *
 * Modal full-screen com lista de transações de uma categoria (nível 2),
 * busca por descrição, filtro por subcategoria e re-categorização inline
 * (Macro → Categoria Nível 2 → Subcategoria).
 *
 * Extraído de VistaMensal.jsx (linhas 179–648).
 *
 * @module ModalDetalheCategoria
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { fmtBRL } from '../UI.jsx';
import { GRUPOS } from '../../data/categorias.js';
import { CORES_CAT } from './graficos/coresCat.js';

export function ModalDetalheCategoria({
  cat2Id, cat2Nome, tipo, mesesSelecionados, mesesLabel,
  transacoesFiltradas, categorias, categoriasNivel2,
  clienteAtivo, setClienteAtivo, onClose,
  subFiltroInicial,   // opcional: pré-filtra em uma subcategoria específica
}) {
  const [busca,      setBusca]    = useState('');
  const [filtroSub,  setFiltroSub] = useState(subFiltroInicial || '');
  const [editadas,   setEditadas]  = useState({});
  const [salvando,   setSalvando]  = useState(false);
  const [tooltip,    setTooltip]   = useState(null); // { text, x, y }
  const overlayRef = useRef(null);

  // ── Fechar ao clicar no overlay ──────────────────────────────────────────
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  // ── Fechar com Esc ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Subcategorias filhas do cat2 clicado ─────────────────────────────────
  const subcatsFilhas = useMemo(
    () => categorias.filter(c => c.categoria === cat2Id),
    [categorias, cat2Id]
  );
  const subcatsFilhasIds = useMemo(
    () => new Set(subcatsFilhas.map(c => c.id)),
    [subcatsFilhas]
  );

  // ── Filtrar transações: pertence a uma das subcats filhas E está no período ─
  const transacoesDaCat = useMemo(() => {
    return transacoesFiltradas.filter(t => {
      if (!subcatsFilhasIds.has(t.categoria)) return false;
      if (mesesSelecionados && mesesSelecionados.size > 0) {
        const periodoStr = t.competencia || (t.data ? t.data.slice(0, 7) : null);
        if (!periodoStr) return false;
        const mesNum = parseInt(periodoStr.split('-')[1], 10) - 1; // 0-based
        if (!mesesSelecionados.has(mesNum)) return false;
      }
      return true;
    }).sort((a, b) => {
      const da = a.data || a.competencia || '';
      const db = b.data || b.competencia || '';
      return db.localeCompare(da); // mais recente primeiro
    });
  }, [transacoesFiltradas, subcatsFilhasIds, mesesSelecionados]);

  // ── Subcategorias únicas presentes nas transações (para o filtro do header) ─
  const subcatsPresentes = useMemo(() => {
    const mapa = {};
    for (const t of transacoesDaCat) {
      const cat = categorias.find(c => c.id === t.categoria);
      if (cat && !mapa[cat.id]) mapa[cat.id] = cat.nome;
    }
    return Object.entries(mapa).sort((a, b) => a[1].localeCompare(b[1]));
  }, [transacoesDaCat, categorias]);

  // ── Filtro de busca + subcategoria ───────────────────────────────────────
  const transacoesVisiveis = useMemo(() => {
    return transacoesDaCat.filter(t => {
      if (filtroSub && t.categoria !== filtroSub) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        if (!(t.descricao || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [transacoesDaCat, busca, filtroSub]);

  // ── Total visível ────────────────────────────────────────────────────────
  const totalVisivel = useMemo(() =>
    transacoesVisiveis.reduce((s, t) => s + Math.abs(t.valor), 0),
    [transacoesVisiveis]
  );

  // ── Listas para os dropdowns ─────────────────────────────────────────────
  const macrosDisponiveis = useMemo(() =>
    Object.values(GRUPOS).filter(g => g !== GRUPOS.INTERNO),
    []
  );

  const getCat2PorMacro = useCallback((macro) =>
    categoriasNivel2.filter(c => c.grupo === macro),
    [categoriasNivel2]
  );

  const getSubcatsPorCat2 = useCallback((cat2Id) =>
    categorias.filter(c => c.categoria === cat2Id),
    [categorias]
  );

  // ── Helpers de lookup ────────────────────────────────────────────────────
  const getCat2DaSub = useCallback((subcatId) =>
    categorias.find(c => c.id === subcatId)?.categoria || null,
    [categorias]
  );

  const getMacroDeSubcat = useCallback((subcatId) => {
    const cat = categorias.find(c => c.id === subcatId);
    return cat?.grupo || '';
  }, [categorias]);

  // ── Estado efetivo de cada linha ─────────────────────────────────────────
  const getEstado = (t) => {
    const over = editadas[t.id] || {};
    const subId   = over.subcat !== undefined ? over.subcat  : (t.categoria || '');
    const cat2Eff = over.cat2   !== undefined ? over.cat2    : getCat2DaSub(t.categoria);
    const macro   = over.macro  !== undefined ? over.macro   : getMacroDeSubcat(t.categoria);
    return { macro, cat2Id: cat2Eff, subId };
  };

  const setLinha = (tId, campo, valor) => {
    setEditadas(prev => {
      const linha = { ...(prev[tId] || {}) };
      if (campo === 'macro') {
        linha.macro  = valor;
        linha.cat2   = '';
        linha.subcat = '';
      } else if (campo === 'cat2') {
        linha.cat2   = valor;
        linha.subcat = '';
      } else {
        linha[campo] = valor;
      }
      return { ...prev, [tId]: linha };
    });
  };

  const temAlteracoes = Object.keys(editadas).length > 0;

  // ── Salvar ───────────────────────────────────────────────────────────────
  const handleSalvar = () => {
    if (!temAlteracoes) return;
    setSalvando(true);
    const novasTransacoes = (clienteAtivo.transacoes || []).map(t => {
      const over = editadas[t.id];
      if (!over) return t;
      const novaSubcat = over.subcat || t.categoria;
      return { ...t, categoria: novaSubcat };
    });
    setClienteAtivo({ ...clienteAtivo, transacoes: novasTransacoes });
    setSalvando(false);
    setEditadas({});
    onClose();
  };

  // ── Estilos ───────────────────────────────────────────────────────────────
  const corCat2 = CORES_CAT[cat2Id] || C.brand;

  const thS = {
    padding: '10px 12px', fontSize: FONT.xs, color: C.textMuted,
    fontWeight: 600, textAlign: 'left', borderBottom: `1px solid ${C.border}`,
    background: C.bg, position: 'sticky', top: 0, zIndex: 2,
    whiteSpace: 'nowrap',
  };
  const tdS = {
    padding: '8px 12px', fontSize: FONT.xs, color: C.text,
    borderBottom: `1px solid ${C.border}22`, verticalAlign: 'middle',
  };
  const selectS = {
    background: C.card, border: `1px solid ${C.border}`,
    borderRadius: RADIUS.sm, color: C.text, fontSize: FONT.xs,
    padding: '4px 6px', fontFamily: "'Inter', sans-serif",
    cursor: 'pointer', outline: 'none', width: '100%',
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: C.card, borderRadius: RADIUS.lg,
        border: `1px solid ${C.border}`,
        width: '100%', maxWidth: 1000,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{
          padding: '18px 24px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${C.border}`, flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: corCat2 }} />
              <span style={{ fontWeight: 700, fontSize: FONT.lg, color: C.text }}>{cat2Nome}</span>
              <span style={{
                fontSize: FONT.xs, fontWeight: 600, color: corCat2,
                background: corCat2 + '18', border: `1px solid ${corCat2}44`,
                borderRadius: RADIUS.sm, padding: '2px 8px',
              }}>
                {fmtBRL(totalVisivel)}
              </span>
            </div>
            <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 4 }}>
              {transacoesVisiveis.length} transaç{transacoesVisiveis.length === 1 ? 'ão' : 'ões'} · {mesesLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
              color: C.textMuted, fontSize: 18, width: 34, height: 34,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'monospace',
            }}
          >✕</button>
        </div>

        {/* ── Busca ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '14px 24px 0', flexShrink: 0 }}>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔍  Pesquisar por descrição..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: RADIUS.md, padding: '9px 14px',
              color: C.text, fontSize: FONT.sm,
              fontFamily: "'Inter', sans-serif", outline: 'none',
            }}
          />
        </div>

        {/* ── Tabela ────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {transacoesVisiveis.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: C.textDim, fontSize: FONT.sm }}>
              Nenhuma transação encontrada
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thS, width: 90  }}>Data</th>
                  <th style={{ ...thS             }}>Descrição</th>
                  <th style={{ ...thS, width: 140 }}>Macro</th>
                  <th style={{ ...thS, width: 160 }}>Categoria</th>
                  <th style={{ ...thS, width: 180 }}>
                    <select
                      value={filtroSub}
                      onChange={e => setFiltroSub(e.target.value)}
                      style={{
                        background: filtroSub ? C.brand + '22' : C.bg,
                        border: `1px solid ${filtroSub ? C.brand : C.border}`,
                        borderRadius: RADIUS.sm, color: filtroSub ? C.brand : C.textMuted,
                        fontSize: FONT.xs, padding: '4px 8px',
                        fontFamily: "'Inter', sans-serif",
                        cursor: 'pointer', outline: 'none', width: '100%',
                        fontWeight: filtroSub ? 700 : 400,
                      }}
                    >
                      <option value="">Subcategoria ▾</option>
                      {subcatsPresentes.map(([id, nome]) => (
                        <option key={id} value={id}>{nome}</option>
                      ))}
                    </select>
                  </th>
                  <th style={{ ...thS, width: 100, textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {transacoesVisiveis.map(t => {
                  const { macro, cat2Id: cat2Atual, subId } = getEstado(t);
                  const cat2Options   = getCat2PorMacro(macro);
                  const subcatOptions = cat2Atual ? getSubcatsPorCat2(cat2Atual) : [];
                  const foiEditada    = !!editadas[t.id];
                  const dataFmt = t.data
                    ? t.data.slice(0, 10).split('-').reverse().join('/')
                    : (t.competencia || '—');

                  const isParcela  = t.parcelaTotal > 1;
                  const corParcela = '#C084FC';

                  return (
                    <tr
                      key={t.id}
                      style={{ background: foiEditada ? C.brand + '0a' : 'transparent' }}
                    >
                      {/* Data */}
                      <td style={{ ...tdS, color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                        {dataFmt}
                      </td>

                      {/* Descrição com tooltip */}
                      <td style={{ ...tdS, maxWidth: 220, position: 'relative' }}>
                        <span
                          onMouseEnter={e => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({ text: t.descricao || '—', x: rect.left, y: rect.bottom + 6 });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                          style={{
                            display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', cursor: 'default',
                            color: isParcela ? corParcela : C.text,
                          }}
                        >
                          {t.descricao || '—'}
                          {isParcela && (
                            <span style={{
                              marginLeft: 6, fontSize: 10, fontWeight: 700,
                              color: corParcela, background: corParcela + '1a',
                              border: `1px solid ${corParcela}55`,
                              borderRadius: 4, padding: '1px 5px',
                              letterSpacing: '0.03em', verticalAlign: 'middle',
                            }}>
                              {t.parcelaAtual}/{t.parcelaTotal}
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Macro */}
                      <td style={tdS}>
                        <select
                          value={macro}
                          onChange={e => setLinha(t.id, 'macro', e.target.value)}
                          style={selectS}
                        >
                          {macrosDisponiveis.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </td>

                      {/* Categoria (nível 2) */}
                      <td style={tdS}>
                        <select
                          value={cat2Atual || ''}
                          onChange={e => setLinha(t.id, 'cat2', e.target.value)}
                          style={selectS}
                        >
                          <option value="">— selecione —</option>
                          {cat2Options.map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </td>

                      {/* Subcategoria (nível 3) */}
                      <td style={tdS}>
                        <select
                          value={subId || ''}
                          onChange={e => setLinha(t.id, 'subcat', e.target.value)}
                          disabled={!cat2Atual}
                          style={{ ...selectS, opacity: cat2Atual ? 1 : 0.45 }}
                        >
                          <option value="">— selecione —</option>
                          {subcatOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </td>

                      {/* Valor */}
                      <td style={{
                        ...tdS, textAlign: 'right', fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        color: isParcela ? corParcela : (t.tipo === 'receita' ? C.rec : C.desp),
                      }}>
                        {fmtBRL(Math.abs(t.valor))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 24px', borderTop: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: C.card,
        }}>
          <span style={{ fontSize: FONT.xs, color: C.textDim }}>
            {temAlteracoes
              ? `${Object.keys(editadas).length} linha${Object.keys(editadas).length > 1 ? 's' : ''} com alterações pendentes`
              : 'Clique no nome de uma categoria/subcategoria para editar'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: RADIUS.md, padding: '8px 18px',
                color: C.textMuted, fontSize: FONT.xs, cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}
            >Fechar</button>
            {temAlteracoes && (
              <button
                onClick={handleSalvar}
                disabled={salvando}
                style={{
                  background: C.brand, border: 'none',
                  borderRadius: RADIUS.md, padding: '8px 22px',
                  color: '#fff', fontSize: FONT.xs, fontWeight: 700,
                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                  opacity: salvando ? 0.6 : 1,
                  transition: 'opacity .15s',
                }}
              >
                {salvando ? 'Salvando...' : '💾 Salvar alterações'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tooltip de descrição completa ─────────────────────────────── */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(tooltip.x, window.innerWidth - 360),
            top: tooltip.y,
            zIndex: 2000,
            background: '#1a1d23',
            border: `1px solid ${C.border}`,
            borderRadius: RADIUS.md,
            padding: '8px 12px',
            maxWidth: 340,
            fontSize: FONT.xs,
            color: C.text,
            lineHeight: 1.5,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
            wordBreak: 'break-word',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
