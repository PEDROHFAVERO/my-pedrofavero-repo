import { useState, useMemo, useRef, useCallback } from 'react';
import { C, FONT, RADIUS } from '../../../design/tokens.js';
import { Card } from '../../UI.jsx';
import { MESES, MESES_FULL } from '../../../data/categorias.js';

const CORES_CONTA = [
  '#60A5FA', '#F472B6', '#34D399', '#FBBF24',
  '#A78BFA', '#F87171', '#38BDF8', '#FB923C',
];

// ══════════════════════════════════════════════════════════════════════════════
// GraficoContasMensais — barras empilhadas de gastos por conta
// Props:
//   contas                   — array de contas
//   despesasPorMesConta      — map[mesIdx][conta] → valor
//   parcelasFuturasPorConta  — map[mesIdx][conta] → valor
//   projetadoPorMes          — array[12]
//   dadosMensais             — array[12]
//   onMesClick               — fn(mesIdx)
//   anoAtivo                 — number
// ══════════════════════════════════════════════════════════════════════════════
export function GraficoContasMensais({ contas, despesasPorMesConta, parcelasFuturasPorConta, projetadoPorMes, dadosMensais, onMesClick, anoAtivo }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  const nomesContas = useMemo(() => {
    const totais = {};
    for (let m = 0; m < 12; m++) {
      const mes = despesasPorMesConta[m] || {};
      for (const [conta, v] of Object.entries(mes)) {
        totais[conta] = (totais[conta] || 0) + v;
      }
    }
    return Object.keys(totais).sort((a, b) => totais[b] - totais[a]);
  }, [despesasPorMesConta]);

  const corConta = useMemo(() => {
    const map = {};
    nomesContas.forEach((n, i) => { map[n] = CORES_CONTA[i % CORES_CONTA.length]; });
    return map;
  }, [nomesContas]);

  const dadosMes = useMemo(() => MESES.map((_, i) => {
    const real = despesasPorMesConta[i] || {};
    const parc = parcelasFuturasPorConta[i] || {};
    const segmentos = {};
    for (const [c, v] of Object.entries(real)) segmentos[c] = (segmentos[c] || 0) + v;
    for (const [c, v] of Object.entries(parc))  segmentos[c] = (segmentos[c] || 0) + v;
    const totalColorido = Object.values(segmentos).reduce((s, v) => s + v, 0);
    const proj = projetadoPorMes[i] || 0;
    return { segmentos, totalColorido, proj };
  }), [despesasPorMesConta, parcelasFuturasPorConta, projetadoPorMes]);

  const maxVal = useMemo(() =>
    Math.max(...dadosMes.map(d => Math.max(d.totalColorido, d.proj)), 1) * 1.08,
  [dadosMes]);

  const W = 1000, H = 260;
  const PAD = { top: 16, right: 32, bottom: 52, left: 76 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW   = chartW / 12;
  const barPad = barW * 0.16;

  const xOf  = i => PAD.left + i * barW;
  const yOf  = v => PAD.top + chartH - (v / maxVal) * chartH;
  const hOf  = v => Math.max(0, (v / maxVal) * chartH);

  const gridVals = useMemo(() => {
    const count = 4;
    return Array.from({ length: count }, (_, k) => (maxVal / count) * (k + 1));
  }, [maxVal]);

  const fmtSemCentavos = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');

  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX  = ((e.clientX - rect.left) / rect.width) * W;
    const mesIdx = Math.max(0, Math.min(11, Math.floor((svgX - PAD.left) / barW)));
    const d = dadosMes[mesIdx];
    if (!d || (d.totalColorido === 0 && d.proj === 0)) { setTooltip(null); return; }
    setTooltip({
      ttX: (e.clientX - rect.left) / rect.width,
      ttY: (e.clientY - rect.top)  / rect.height,
      mesIdx, segmentos: d.segmentos, totalColorido: d.totalColorido, proj: d.proj,
    });
  }, [dadosMes]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);
  const handleClick      = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect   = svg.getBoundingClientRect();
    const svgX   = ((e.clientX - rect.left) / rect.width) * W;
    const mesIdx = Math.max(0, Math.min(11, Math.floor((svgX - PAD.left) / barW)));
    onMesClick(mesIdx);
  }, [onMesClick]);

  return (
    <Card padding="20px 24px" style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text }}>
          Gastos por Conta — {anoAtivo}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        {nomesContas.map(n => (
          <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: FONT.xs }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: corConta[n], display: 'inline-block' }} />
            <span style={{ color: C.textMuted }}>{n}</span>
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: FONT.xs }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: C.textDim, opacity: 0.35, display: 'inline-block' }} />
          <span style={{ color: C.textDim, fontStyle: 'italic' }}>Projetado</span>
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
          onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleClick}>

          {gridVals.map((v, k) => (
            <text key={k} x={PAD.left - 8} y={yOf(v) + 4} textAnchor="end"
              fill={C.textDim} fontSize="9" fontFamily="Inter,sans-serif">
              {v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v.toFixed(0)}
            </text>
          ))}
          <line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH}
            stroke={C.border} strokeWidth="0.8" opacity="0.5" />

          {dadosMes.map((d, i) => {
            const x      = xOf(i) + barPad;
            const w      = barW - barPad * 2;
            const baseY  = PAD.top + chartH;
            const hProj  = hOf(d.proj);
            const segOrdem = nomesContas.filter(n => (d.segmentos[n] || 0) > 0);
            let yAcum = baseY;
            return (
              <g key={i}>
                {hProj > 0 && (
                  <rect x={x} y={baseY - hProj} width={w} height={hProj}
                    fill={C.text} opacity={0.1} rx="3" />
                )}
                {segOrdem.map((conta, si) => {
                  const v = d.segmentos[conta] || 0;
                  if (v <= 0) return null;
                  const h    = hOf(v);
                  yAcum -= h;
                  const isTop = si === segOrdem.length - 1;
                  return (
                    <rect key={conta} x={x} y={yAcum} width={w} height={h}
                      fill={corConta[conta]} opacity={0.88}
                      rx={isTop ? '3' : '0'}
                      style={{ transition: 'opacity 0.15s' }} />
                  );
                })}
              </g>
            );
          })}

          {dadosMes.map((d, i) => {
            const cx    = xOf(i) + barW / 2;
            const total = d.totalColorido;
            return (
              <g key={i}>
                <text x={cx} y={PAD.top + chartH + 14} textAnchor="middle"
                  fill={C.textDim} fontSize="10" fontFamily="Inter,sans-serif">
                  {MESES[i]}
                </text>
                {total > 0 && (
                  <text x={cx} y={PAD.top + chartH + 28} textAnchor="middle"
                    fill={C.textMuted} fontSize="8.5" fontFamily="Inter,sans-serif" fontWeight="600">
                    {fmtSemCentavos(total)}
                  </text>
                )}
              </g>
            );
          })}

          {tooltip && (
            <line x1={xOf(tooltip.mesIdx) + barW / 2} y1={PAD.top}
              x2={xOf(tooltip.mesIdx) + barW / 2} y2={PAD.top + chartH}
              stroke={C.brand} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
          )}
        </svg>

        {tooltip && (() => {
          const left  = tooltip.ttX > 0.72 ? 'auto' : `${tooltip.ttX * 100}%`;
          const right = tooltip.ttX > 0.72 ? `${(1 - tooltip.ttX) * 100}%` : 'auto';
          return (
            <div style={{
              position: 'absolute', top: `${Math.min(tooltip.ttY * 100, 50)}%`,
              left, right, transform: tooltip.ttX > 0.72 ? 'translateX(0)' : 'translateX(10px)',
              background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.md,
              padding: '10px 14px', pointerEvents: 'none', zIndex: 10, minWidth: 200,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text, marginBottom: 8 }}>
                {MESES_FULL[tooltip.mesIdx]}
              </div>
              {nomesContas.filter(n => (tooltip.segmentos[n] || 0) > 0).map(n => (
                <div key={n} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: FONT.xs, color: C.textMuted }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: corConta[n], display: 'inline-block' }} />
                    {n}
                  </span>
                  <span style={{ fontSize: FONT.xs, fontWeight: 700, color: corConta[n] }}>
                    {fmtSemCentavos(tooltip.segmentos[n])}
                  </span>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600 }}>Total realizado</span>
                <span style={{ fontSize: FONT.xs, fontWeight: 800, color: C.text }}>{fmtSemCentavos(tooltip.totalColorido)}</span>
              </div>
              {tooltip.proj > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: FONT.xs, color: C.textDim, fontStyle: 'italic' }}>Projetado</span>
                  <span style={{ fontSize: FONT.xs, color: C.textDim, fontStyle: 'italic' }}>{fmtSemCentavos(tooltip.proj)}</span>
                </div>
              )}
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 6, textAlign: 'center' }}>clique para abrir o mês</div>
            </div>
          );
        })()}
      </div>
    </Card>
  );
}
