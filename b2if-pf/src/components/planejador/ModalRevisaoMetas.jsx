/**
 * ModalRevisaoMetas.jsx — Modal de revisão de metas importadas do PDF "Meu Dinheiro"
 *
 * Extraído de PagePlanejador.jsx (Fase 2 — Strangler Fig)
 * Props: dados ({ meses, itens }), categorias, anoAtivo, planejamento, onConfirmar, onCancelar
 */
import { useState } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn, fmtBRL } from '../UI.jsx';
import { GRUPOS } from '../../data/categorias.js';

export function ModalRevisaoMetas({ dados, categorias, anoAtivo, planejamento, onConfirmar, onCancelar }) {
  const { meses, itens: itensIniciais } = dados;

  // Meses selecionados — por padrão todos
  const [mesesSel, setMesesSel] = useState(() => new Set(meses));

  // Estado editável dos itens
  const [itens, setItens] = useState(() =>
    itensIniciais.map(it => ({ ...it, catIdFinal: it.catIdSugerido, macroFinal: it.macroSugerido }))
  );

  // Categorias para os selects (só subcategorias)
  const subcats = categorias.filter(c => !c.isCategoria);
  const catsPorMacro = {};
  for (const g of Object.values(GRUPOS)) catsPorMacro[g] = [];
  for (const c of subcats) {
    if (catsPorMacro[c.grupo]) catsPorMacro[c.grupo].push(c);
  }

  // Detectar meses com projeção existente
  const anoStr = String(anoAtivo);
  const planAno = planejamento?.[anoStr] || {};
  const mesesComProjecao = meses.filter(mes => {
    const [, mm] = mes.split('-');
    return planAno[parseInt(mm, 10) - 1] && Object.keys(planAno[parseInt(mm, 10) - 1] || {}).length > 0;
  });

  // Itens que precisam de atenção (sem mapeamento confirmado)
  const itensMapeados = itens.filter(it => it.status === 'mapeado' && it.catIdFinal);
  const itensRevisar  = itens.filter(it => it.status !== 'mapeado' || !it.catIdFinal);

  // Helpers
  function setItemCat(idx, catId) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, catIdFinal: catId || null } : it));
  }
  function setItemMacro(idx, macro) {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, macroFinal: macro, catIdFinal: null } : it));
  }
  function toggleMes(mes) {
    setMesesSel(prev => {
      const next = new Set(prev);
      next.has(mes) ? next.delete(mes) : next.add(mes);
      return next;
    });
  }

  // Meses label
  const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  function labelMes(mesStr) {
    const [ano, mm] = mesStr.split('-');
    return `${MESES_ABREV[parseInt(mm,10)-1]}/${ano.slice(2)}`;
  }

  // Confirmar — calcula novas categorias a criar
  function handleConfirmar() {
    const novasCategorias = [];
    for (const it of itens) {
      if (!it.catIdFinal && it.criarNova && it.nomeNova?.trim()) {
        const newId = 'custom_' + it.nomeNova.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') + '_' + Date.now();
        it.catIdFinal = newId;
        novasCategorias.push({
          id: newId,
          nome: it.nomeNova.trim(),
          grupo: it.macroFinal || 'Consumo Mensal',
          tipo: it.tipo === 'receita' ? 'receita' : 'despesa',
          isCategoria: false,
          categoria: null,
        });
      }
    }
    onConfirmar({
      itensFinal: itens.filter(it => it.catIdFinal),
      mesesSelecionados: [...mesesSel],
      novasCategorias,
    });
  }

  const selStyle = {
    background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
    padding: '4px 8px', color: C.text, fontSize: FONT.xs,
    fontFamily: "'Inter',sans-serif", outline: 'none', width: '100%',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9998,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto', padding: '40px 16px',
    }}>
      <div style={{ background: C.card, borderRadius: RADIUS.lg, width: '100%', maxWidth: 860, border: `1px solid ${C.border}` }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: FONT.lg, color: C.text }}>📄 Revisão de Metas — Meu Dinheiro</div>
            <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 2 }}>{itens.length} categorias detectadas · {meses.length} meses</div>
          </div>
          <button onClick={onCancelar} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Seção 1 — Período detectado */}
          <div style={{ background: C.bg, borderRadius: RADIUS.md, padding: '14px 16px', border: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 700, fontSize: FONT.sm, color: C.text, marginBottom: 10 }}>
              📅 Período detectado — selecione os meses para importar
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {meses.map(mes => {
                const sel = mesesSel.has(mes);
                const temProj = mesesComProjecao.includes(mes);
                return (
                  <button key={mes} onClick={() => toggleMes(mes)} style={{
                    padding: '6px 14px', borderRadius: RADIUS.sm, border: `2px solid ${sel ? C.brand : C.border}`,
                    background: sel ? C.brand + '20' : C.card, color: sel ? C.brand : C.textMuted,
                    fontWeight: sel ? 700 : 400, fontSize: FONT.xs, cursor: 'pointer',
                    fontFamily: "'Inter',sans-serif", position: 'relative',
                  }}>
                    {labelMes(mes)}
                    {temProj && <span style={{ fontSize: 8, color: C.warn, position: 'absolute', top: 2, right: 4 }}>●</span>}
                  </button>
                );
              })}
            </div>
            {mesesComProjecao.length > 0 && (
              <div style={{ fontSize: FONT.xs, color: C.warn, marginTop: 8 }}>
                ⚠️ Meses com ● já possuem projeção — importar irá sobrescrever os valores existentes.
              </div>
            )}
          </div>

          {/* Seção 2 — Mapeamentos confirmados */}
          {itensMapeados.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: FONT.sm, color: C.rec, marginBottom: 8 }}>
                ✅ Mapeamentos confirmados pelo Gemini ({itensMapeados.length})
              </div>
              <div style={{ background: C.bg, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONT.xs }}>
                  <thead>
                    <tr style={{ background: C.rec + '10', borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: C.textMuted, fontWeight: 600 }}>Categoria (Meu Dinheiro)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: C.textMuted, fontWeight: 600 }}>Mapeado para</th>
                      {[...mesesSel].sort().map(m => (
                        <th key={m} style={{ padding: '8px 8px', textAlign: 'right', color: C.textMuted, fontWeight: 600 }}>{labelMes(m)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itensMapeados.map((it, idx) => {
                      const cat = subcats.find(c => c.id === it.catIdFinal);
                      return (
                        <tr key={idx} style={{ borderTop: idx > 0 ? `1px solid ${C.border}22` : 'none', background: idx % 2 === 0 ? 'transparent' : C.bg + '55' }}>
                          <td style={{ padding: '7px 12px', color: C.textMuted }}>{it.nomeMD}</td>
                          <td style={{ padding: '7px 12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ color: C.rec, fontWeight: 600 }}>{cat?.nome || it.nomeSugerido}</span>
                              <span style={{ color: C.textDim, fontSize: 10 }}>{cat?.grupo || it.macroFinal}</span>
                            </div>
                          </td>
                          {[...mesesSel].sort().map(m => (
                            <td key={m} style={{ padding: '7px 8px', textAlign: 'right', color: C.text, fontWeight: 500 }}>
                              {it.metas?.[m] ? fmtBRL(Math.abs(it.metas[m])) : <span style={{ color: C.textDim }}>—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Seção 3 — Precisam de atenção */}
          {itensRevisar.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: FONT.sm, color: C.warn, marginBottom: 8 }}>
                ⚠️ Precisam de atenção ({itensRevisar.length}) — escolha onde encaixar ou crie uma nova categoria
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itensRevisar.map((it) => {
                  const globalIdx = itens.findIndex(x => x === it);
                  return (
                    <div key={globalIdx} style={{
                      background: C.bg, borderRadius: RADIUS.md, padding: '12px 14px',
                      border: `1px solid ${C.warn}44`, display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <span style={{ fontWeight: 700, color: C.text, fontSize: FONT.sm }}>{it.nomeMD}</span>
                          <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 8 }}>
                            {[...mesesSel].sort().filter(m => it.metas?.[m]).map(m => `${labelMes(m)}: ${fmtBRL(Math.abs(it.metas[m]))}`).join(' · ')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {/* Toggle criar nova */}
                          <button
                            onClick={() => setItens(prev => prev.map((x, i) => i === globalIdx ? { ...x, criarNova: !x.criarNova, catIdFinal: null } : x))}
                            style={{
                              fontSize: FONT.xs, padding: '4px 10px', borderRadius: RADIUS.sm, cursor: 'pointer',
                              background: it.criarNova ? '#7C3AED20' : C.card,
                              border: `1px solid ${it.criarNova ? '#7C3AED' : C.border}`,
                              color: it.criarNova ? '#7C3AED' : C.textMuted,
                              fontFamily: "'Inter',sans-serif",
                            }}
                          >
                            {it.criarNova ? '✦ Criar nova' : '+ Criar nova categoria'}
                          </button>
                        </div>
                      </div>

                      {it.criarNova ? (
                        /* Criar nova categoria */
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input
                            placeholder="Nome da nova categoria"
                            value={it.nomeNova || ''}
                            onChange={e => setItens(prev => prev.map((x, i) => i === globalIdx ? { ...x, nomeNova: e.target.value } : x))}
                            style={{ ...selStyle, width: 220 }}
                          />
                          <select value={it.macroFinal || ''} onChange={e => setItemMacro(globalIdx, e.target.value)} style={{ ...selStyle, width: 180 }}>
                            <option value="">— Macro —</option>
                            {Object.values(GRUPOS).map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <span style={{ fontSize: FONT.xs, color: C.textMuted }}>Será criada como subcategoria órfã no macro selecionado.</span>
                        </div>
                      ) : (
                        /* Mapear para existente */
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <select value={it.macroFinal || ''} onChange={e => setItemMacro(globalIdx, e.target.value)} style={{ ...selStyle, width: 180 }}>
                            <option value="">— Macro —</option>
                            {Object.values(GRUPOS).map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                          <select value={it.catIdFinal || ''} onChange={e => setItemCat(globalIdx, e.target.value)} style={{ ...selStyle, width: 220 }} disabled={!it.macroFinal}>
                            <option value="">— Categoria —</option>
                            {(catsPorMacro[it.macroFinal] || []).map(c => (
                              <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setItens(prev => prev.map((x, i) => i === globalIdx ? { ...x, catIdFinal: null, macroFinal: null, ignorar: true } : x))}
                            style={{ fontSize: FONT.xs, padding: '4px 10px', borderRadius: RADIUS.sm, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: "'Inter',sans-serif" }}
                          >
                            Ignorar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: FONT.xs, color: C.textMuted }}>
              {mesesSel.size} mese{mesesSel.size !== 1 ? 's' : ''} selecionado{mesesSel.size !== 1 ? 's' : ''} ·{' '}
              {itens.filter(it => it.catIdFinal || (it.criarNova && it.nomeNova?.trim())).length} de {itens.length} categorias mapeadas
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" onClick={onCancelar}>Cancelar</Btn>
              <Btn
                onClick={handleConfirmar}
                disabled={mesesSel.size === 0}
                style={{ opacity: mesesSel.size === 0 ? 0.45 : 1 }}
              >
                ✅ Confirmar e Importar
              </Btn>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
