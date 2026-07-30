import { C, FONT, RADIUS } from '../../../design/tokens.js';
import { Card } from '../../UI.jsx';
import { MESES } from '../../../data/categorias.js';

// ══════════════════════════════════════════════════════════════════════════════
// GraficoParcelamentos — barras horizontais mostrando parcelas comprometidas
// Props:
//   totalParcelasFut — array[12] com valor comprometido por mês
//   anoAtivo         — number
// ══════════════════════════════════════════════════════════════════════════════
export function GraficoParcelamentos({ totalParcelasFut, anoAtivo }) {
  const max    = Math.max(1, ...totalParcelasFut.map(v => v || 0));
  const fmtVal = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card padding="20px 24px" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 4 }}>
        Parcelamentos
      </div>
      <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 16 }}>
        Valores já comprometidos em parcelamentos
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {MESES.map((mes, i) => {
          const val = totalParcelasFut[i] || 0;
          const pct = Math.max(0, (val / max) * 100);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, fontSize: FONT.xs, color: C.textMuted, fontWeight: 500, flexShrink: 0 }}>
                {mes}
              </div>
              <div style={{ flex: 1, height: 8, background: C.border, borderRadius: RADIUS.full, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: val > 0 ? '#A78BFA' : 'transparent',
                  borderRadius: RADIUS.full, transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ width: 90, textAlign: 'right', fontSize: FONT.xs, color: val > 0 ? '#A78BFA' : C.textMuted, fontWeight: 600, flexShrink: 0 }}>
                {val > 0 ? fmtVal(val) : '—'}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
