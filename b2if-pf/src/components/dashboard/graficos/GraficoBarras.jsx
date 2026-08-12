import { useState, useMemo } from 'react';
import { C, FONT, RADIUS } from '../../../design/tokens.js';
import { Card } from '../../UI.jsx';
import { MESES } from '../../../data/categorias.js';

// ══════════════════════════════════════════════════════════════════════════════
// GraficoBarras — Receitas x Despesas (barras duplas por mês, com projetado)
// Props:
//   dadosMensais     — array[12]
//   maxBarValue      — number
//   onMesClick       — fn(mesIdx)
//   anoAtivo         — number
//   projetadoPorMes  — array[12]
//   totalParcelasFut — array[12]
// ══════════════════════════════════════════════════════════════════════════════
export function GraficoBarras({ dadosMensais, maxBarValue, onMesClick, anoAtivo, projetadoPorMes, totalParcelasFut }) {
  const [hoveredBar, setHoveredBar] = useState(null);

  const saldoAcumulado = useMemo(() => {
    let acc = 0;
    return dadosMensais.map((d, i) => {
      const saldoMes = d.temReal
        ? d.saldoReal
        : (d.recProj || 0) - (projetadoPorMes?.[i] || 0);
      acc += saldoMes;
      return acc;
    });
  }, [dadosMensais, projetadoPorMes]);

  const escalaMax = useMemo(() => {
    let m = 1;
    dadosMensais.forEach((d, i) => {
      m = Math.max(m,
        d.recReal, d.despReal,
        projetadoPorMes ? projetadoPorMes[i] || 0 : 0,
        d.recProj || 0,
        totalParcelasFut ? totalParcelasFut[i] || 0 : 0,
      );
    });
    return m * 1.08;
  }, [dadosMensais, projetadoPorMes, totalParcelasFut]);

  const BAR_H = 140;
  const fmtSemCentavos = v => 'R$ ' + Math.round(Math.abs(v)).toLocaleString('pt-BR');

  const TT = ({ color, children }) => (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
      background: C.card, border: `1px solid ${color}66`, borderRadius: RADIUS.sm,
      padding: '5px 10px', fontSize: FONT.sm, color, fontWeight: 700,
      whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 20,
      boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
    }}>
      {children}
    </div>
  );

  return (
    <Card padding="20px 24px" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text }}>Receitas x Despesas</div>
        <div style={{ display: 'flex', gap: 14, fontSize: FONT.xs, color: C.textMuted }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, background: C.rec, borderRadius: 2, display: 'inline-block' }} />Receitas
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, background: C.desp, borderRadius: 2, display: 'inline-block' }} />Despesas
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, background: C.text, borderRadius: 2, display: 'inline-block', opacity: 0.15 }} />Projetado
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {dadosMensais.map((d, i) => {
          const parcFut  = totalParcelasFut?.[i] || 0;
          const recProj  = d.recProj || 0;
          const despProj = projetadoPorMes?.[i] || 0;
          const acum     = saldoAcumulado[i];
          const hov      = hoveredBar?.mesIdx === i;

          const hRecProj  = Math.max(0, (recProj       / escalaMax) * BAR_H);
          const hRecReal  = Math.max(0, ((d.recReal  || 0) / escalaMax) * BAR_H);
          const hDespProj = Math.max(0, (despProj      / escalaMax) * BAR_H);
          const hDespReal = Math.max(0, ((d.despReal || 0) / escalaMax) * BAR_H);
          const hParcFut  = Math.max(0, (parcFut       / escalaMax) * BAR_H);

          return (
            <div key={i} onClick={() => onMesClick(i)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>

              <div style={{ width: '100%', height: BAR_H, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 2 }}>

                {/* Coluna Receitas */}
                <div style={{ width: '46%', height: BAR_H, position: 'relative' }}>
                  {hRecProj > 0 && (
                    <div onMouseEnter={() => setHoveredBar({ mesIdx: i, side: 'recProj' })}
                         onMouseLeave={() => setHoveredBar(null)}
                         style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: hRecProj,
                           background: C.rec, opacity: hov && hoveredBar?.side === 'recProj' ? 0.45 : 0.28,
                           borderRadius: '3px 3px 0 0', zIndex: 0, cursor: 'pointer', transition: 'opacity 0.15s' }}>
                      {hov && hoveredBar?.side === 'recProj' && <TT color={C.rec}>{fmtSemCentavos(recProj)}</TT>}
                    </div>
                  )}
                  {d.temReal && hRecReal > 0 && (
                    <div onMouseEnter={() => setHoveredBar({ mesIdx: i, side: 'rec' })}
                         onMouseLeave={() => setHoveredBar(null)}
                         style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: hRecReal,
                           background: C.rec, opacity: hov && hoveredBar?.side === 'rec' ? 1 : 0.85,
                           borderRadius: '3px 3px 0 0', zIndex: 1, transition: 'opacity 0.15s' }}>
                      {hov && hoveredBar?.side === 'rec' && <TT color={C.rec}>{fmtSemCentavos(d.recReal)}</TT>}
                      {hRecProj > 0 && hRecReal > hRecProj && (
                        <div onMouseEnter={() => setHoveredBar({ mesIdx: i, side: 'recMarca' })}
                             onMouseLeave={() => setHoveredBar(null)}
                             style={{ position: 'absolute', left: 0, right: 0, bottom: hRecProj,
                               height: 2, background: 'rgba(255,255,255,0.80)', zIndex: 3, cursor: 'crosshair' }}>
                          {hov && hoveredBar?.side === 'recMarca' && <TT color={C.rec}>Proj: {fmtSemCentavos(recProj)}</TT>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Coluna Despesas */}
                <div style={{ width: '46%', height: BAR_H, position: 'relative' }}>
                  {hDespProj > 0 && (
                    <div onMouseEnter={() => setHoveredBar({ mesIdx: i, side: 'despProj' })}
                         onMouseLeave={() => setHoveredBar(null)}
                         style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: hDespProj,
                           background: C.desp, opacity: hov && hoveredBar?.side === 'despProj' ? 0.45 : 0.28,
                           borderRadius: '3px 3px 0 0', zIndex: 0, cursor: 'pointer', transition: 'opacity 0.15s' }}>
                      {hov && hoveredBar?.side === 'despProj' && <TT color={C.desp}>{fmtSemCentavos(despProj)}</TT>}
                    </div>
                  )}
                  {!d.temReal && hParcFut > 0 && (
                    <div onMouseEnter={() => setHoveredBar({ mesIdx: i, side: 'parc' })}
                         onMouseLeave={() => setHoveredBar(null)}
                         style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: hParcFut,
                           background: C.desp, opacity: hov && hoveredBar?.side === 'parc' ? 1 : 0.85,
                           borderRadius: '3px 3px 0 0', zIndex: 1, transition: 'opacity 0.15s' }}>
                      {hov && hoveredBar?.side === 'parc' && <TT color={C.desp}>{fmtSemCentavos(parcFut)}</TT>}
                    </div>
                  )}
                  {d.temReal && hDespReal > 0 && (
                    <div onMouseEnter={() => setHoveredBar({ mesIdx: i, side: 'desp' })}
                         onMouseLeave={() => setHoveredBar(null)}
                         style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: hDespReal,
                           background: C.desp, opacity: hov && hoveredBar?.side === 'desp' ? 1 : 0.85,
                           borderRadius: '3px 3px 0 0', zIndex: 1, transition: 'opacity 0.15s' }}>
                      {hov && hoveredBar?.side === 'desp' && <TT color={C.desp}>{fmtSemCentavos(d.despReal)}</TT>}
                      {hDespProj > 0 && hDespReal > hDespProj && (
                        <div onMouseEnter={() => setHoveredBar({ mesIdx: i, side: 'despMarca' })}
                             onMouseLeave={() => setHoveredBar(null)}
                             style={{ position: 'absolute', left: 0, right: 0, bottom: hDespProj,
                               height: 2, background: 'rgba(255,255,255,0.80)', zIndex: 3, cursor: 'crosshair' }}>
                          {hov && hoveredBar?.side === 'despMarca' && <TT color={C.desp}>Proj: {fmtSemCentavos(despProj)}</TT>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 500, marginTop: 4, minHeight: 16 }}>{d.mes}</div>

              {(() => {
                const saldo  = d.temReal ? d.saldoReal : (d.recProj || 0) - (projetadoPorMes?.[i] || 0);
                const isProj = !d.temReal;
                const cor    = saldo > 0 ? C.rec : saldo < 0 ? C.desp : C.textMuted;
                return (
                  <div style={{ fontSize: FONT.sm, color: isProj ? cor + 'AA' : cor, fontWeight: 600, lineHeight: 1.4, fontStyle: isProj ? 'italic' : 'normal', minHeight: 18 }}>
                    {saldo !== 0
                      ? (saldo > 0 ? '+' : '') + 'R$ ' + Math.round(Math.abs(saldo)).toLocaleString('pt-BR')
                      : <span style={{ color: C.textMuted }}>—</span>}
                  </div>
                );
              })()}

              {(() => {
                const isProj = !d.temReal;
                const cor    = acum > 0 ? C.rec : acum < 0 ? C.desp : C.textMuted;
                return (
                  <div style={{ fontSize: FONT.sm, color: isProj ? cor + 'AA' : cor, fontWeight: 600, lineHeight: 1.4, fontStyle: isProj ? 'italic' : 'normal', minHeight: 18 }}>
                    {acum !== 0 ? (acum > 0 ? '+' : '') + 'R$ ' + Math.round(Math.abs(acum)).toLocaleString('pt-BR') : '—'}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
