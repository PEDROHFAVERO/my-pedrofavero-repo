/**
 * helpers.jsx — Componentes helpers locais do Planejador
 *
 * Extraído de PagePlanejador.jsx (Fase 2 — Strangler Fig)
 * Exports: KPIBox, grupoColor
 */
import { C, FONT, RADIUS } from '../../design/tokens.js';

export function KPIBox({ label, value, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, padding: '14px 18px' }}>
      <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: FONT.xl, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export function grupoColor(grupo) {
  const map = {
    'Receitas':        C.rec,
    'Despesas Essenciais': C.desp,
    'Consumo Mensal':  C.warn,
    'Dívidas':         '#C084FC',
    'Investimentos':   C.info,
    'Fluxo Interno':   C.textMuted,
  };
  return map[grupo] || C.textMuted;
}
