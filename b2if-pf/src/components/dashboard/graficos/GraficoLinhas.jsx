import { useState, useMemo, useRef, useCallback } from 'react';
import { C, FONT, RADIUS } from '../../../design/tokens.js';
import { Card, fmtBRL } from '../../UI.jsx';
import { MESES, MESES_FULL } from '../../../data/categorias.js';

// ══════════════════════════════════════════════════════════════════════════════
// GraficoLinhas — Evolução Financeira (polyline SVG por grupo)
// Props:
//   seriesData   — array de { grupo, cor, label, pontos: [{v, isProj, mesIdx}] }
//   dadosMensais — array[12]
//   onMesClick   — fn(mesIdx)
//   anoAtivo     — number
// ══════════════════════════════════════════════════════════════════════════════
export function GraficoLinhas({ seriesData, dadosMensais, onMesClick, anoAtivo }) {
  const [tooltip, setTooltip] = useState(null);

  const W = 1000, H = 320;
  const PAD = { top: 28, right: 32, bottom: 40, left: 76 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top  - PAD.bottom;

  const maxVal = useMemo(() => {
    let m = 0;
    seriesData.forEach(s => s.pontos.forEach(p => { if (p.v !== null && p.v > m) m = p.v; }));
    return m > 0 ? m * 1.25 : 1000;
  }, [seriesData]);

  const xOf = i => PAD.left + (i / 11) * chartW;
  const yOf = v => PAD.top  + chartH - (v / maxVal) * chartH;

  function buildSegments(pontos) {
    const segments = [];
    let seg = [];
    pontos.forEach(p => {
      if (p.v !== null) { seg.push(p); }
      else { if (seg.length >= 1) segments.push([...seg]); seg = []; }
    });
    if (seg.length >= 1) segments.push(seg);
    return segments;
  }

  const gridLines = useMemo(() => {
    const count = 4;
    return Array.from({ length: count + 1 }, (_, k) => {
      const v = (maxVal / count) * k;
      return { v, y: yOf(v) };
    });
  }, [maxVal]);

  const svgRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect  = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const svgX   = (e.clientX - rect.left) * scaleX;
    const mesIdx = Math.max(0, Math.min(11, Math.round(((svgX - PAD.left) / chartW) * 11)));
    const itens  = seriesData
      .map(s => ({ label: s.label, cor: s.cor, valor: s.pontos[mesIdx].v, isProj: s.pontos[mesIdx].isProj }))
      .filter(it => it.valor !== null);
    if (!itens.length) { setTooltip(null); return; }
    setTooltip({
      ttX: (e.clientX - rect.left) / rect.width,
      ttY: (e.clientY - rect.top)  / rect.height,
      mesIdx, itens,
    });
  }, [seriesData]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);
  const handleClick      = useCallback(() => {
    if (tooltip) onMesClick(tooltip.mesIdx);
  }, [tooltip, onMesClick]);

  return (
    <Card padding="20px 24px" style={{ marginBottom: 0 }}>
      <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 4 }}>
        Evolução Financeira — {anoAtivo}
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 14 }}>
        {seriesData.map(s => (
          <span key={s.grupo} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: FONT.xs, color: C.textMuted }}>
            <span style={{ width: 22, height: 3, background: s.cor, borderRadius: 2, display: 'inline-block' }} />
            <span style={{ color: s.cor, fontWeight: 600 }}>{s.label}</span>
          </span>
        ))}
      </div>

      <div className="mb-chart-area" style={{ position: 'relative' }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair', minHeight: 200 }}
          onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleClick}>

          {gridLines.map(({ v, y }, k) => k === 0 ? null : (
            <text key={k} x={PAD.left - 8} y={y + 4} textAnchor="end"
              fill={C.textDim} fontSize="9" fontFamily="Inter,sans-serif">
              {v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v.toFixed(0)}
            </text>
          ))}

          <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH}
            stroke={C.border} strokeWidth="0.8" opacity="0.5" />

          {MESES.map((m, i) => (
            <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle"
              fill={C.textDim} fontSize="10" fontFamily="Inter,sans-serif">{m}</text>
          ))}

          {seriesData.map(s => {
            const segments = buildSegments(s.pontos);
            return (
              <g key={s.grupo}>
                {segments.map((seg, si) => {
                  const subSegs = [];
                  let cur = [], curProj = seg[0].isProj;
                  seg.forEach(p => {
                    if (p.isProj !== curProj) {
                      cur.push(p);
                      subSegs.push({ pts: [...cur], isProj: curProj });
                      cur = [cur[cur.length - 1]];
                      curProj = p.isProj;
                    } else { cur.push(p); }
                  });
                  if (cur.length) subSegs.push({ pts: cur, isProj: curProj });

                  return subSegs.map((ss, ssi) => {
                    if (ss.pts.length < 2) {
                      const p = ss.pts[0];
                      return <circle key={`${si}-${ssi}`} cx={xOf(p.mesIdx)} cy={yOf(p.v)} r="2.5" fill={s.cor} opacity={ss.isProj ? 0.55 : 0.9} />;
                    }
                    const pts = ss.pts.map(p => `${xOf(p.mesIdx)},${yOf(p.v)}`).join(' ');
                    return (
                      <polyline key={`${si}-${ssi}`} points={pts} fill="none" stroke={s.cor}
                        strokeWidth="1.5" strokeDasharray={ss.isProj ? '5 4' : 'none'}
                        opacity={ss.isProj ? 0.6 : 1} strokeLinejoin="round" strokeLinecap="round" />
                    );
                  });
                })}
                {s.pontos.map((p, i) => p.v === null ? null : (
                  <circle key={i} cx={xOf(i)} cy={yOf(p.v)} r="2.5"
                    fill={p.isProj ? C.bg : s.cor} stroke={s.cor} strokeWidth="1.2"
                    opacity={p.isProj ? 0.6 : 0.9} />
                ))}
              </g>
            );
          })}

          {tooltip && (
            <line x1={xOf(tooltip.mesIdx)} y1={PAD.top} x2={xOf(tooltip.mesIdx)} y2={PAD.top + chartH}
              stroke={C.brand} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
          )}
        </svg>

        {tooltip && (() => {
          const left  = tooltip.ttX > 0.75 ? 'auto' : `${tooltip.ttX * 100}%`;
          const right = tooltip.ttX > 0.75 ? `${(1 - tooltip.ttX) * 100}%` : 'auto';
          return (
            <div style={{
              position: 'absolute', top: `${Math.min(tooltip.ttY * 100, 60)}%`,
              left, right, transform: tooltip.ttX > 0.75 ? 'translateX(0)' : 'translateX(8px)',
              background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.md,
              padding: '10px 14px', pointerEvents: 'none', zIndex: 10, minWidth: 180,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                {MESES_FULL[tooltip.mesIdx]}
              </div>
              {tooltip.itens.map(it => (
                <div key={it.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: FONT.xs, color: it.cor }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.cor, display: 'inline-block' }} />
                    {it.label}
                    {it.isProj && <span style={{ color: C.textDim, fontStyle: 'italic' }}> proj.</span>}
                  </span>
                  <span style={{ fontSize: FONT.xs, fontWeight: 700, color: it.cor }}>{fmtBRL(it.valor)}</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 6, textAlign: 'center' }}>clique para abrir o mês</div>
            </div>
          );
        })()}
      </div>
    </Card>
  );
}
