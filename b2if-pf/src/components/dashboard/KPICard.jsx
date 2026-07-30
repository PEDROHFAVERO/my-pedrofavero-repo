/**
 * KPICard.jsx — Card de indicador de desempenho (KPI)
 * Visual moderno: número grande com glow, label uppercase, tint de fundo sutil.
 */
import { C, FONT, RADIUS } from '../../design/tokens.js';

export function KPICard({ label, value, sub, color }) {
  const glowColor = color ? `${color}28` : 'transparent';
  const tintBg    = color ? `${color}0C` : 'transparent';

  return (
    <div style={{
      background: `linear-gradient(135deg, var(--c-card) 60%, ${tintBg})`,
      border: '1px solid var(--c-border)',
      borderRadius: RADIUS.lg,
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Borda superior colorida */}
      {color && (
        <div style={{
          position: 'absolute', top: 0, left: '16px', right: '16px',
          height: 2, borderRadius: '0 0 2px 2px',
          background: color,
          boxShadow: `0 2px 8px ${color}60`,
          opacity: 0.7,
        }} />
      )}

      {/* Label */}
      <div style={{
        fontSize: FONT.xs,
        color: 'var(--c-text-muted)',
        marginBottom: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
      }}>
        {label}
      </div>

      {/* Valor principal */}
      <div style={{
        fontSize: FONT.xxl,
        fontWeight: 800,
        color: color || 'var(--c-text)',
        lineHeight: 1,
        marginBottom: sub ? 8 : 0,
        textShadow: `0 0 24px ${glowColor}`,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>

      {/* Subtítulo */}
      {sub && (
        <div style={{
          fontSize: FONT.xs,
          color: 'var(--c-text-dim)',
          lineHeight: 1.4,
        }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/**
 * Mapeia um grupo de despesa para sua cor de destaque.
 */
export function grupoColor(grupo) {
  const map = {
    'Receitas':         C.rec,
    'Despesas Essenciais': C.desp,
    'Consumo Mensal':   C.warn,
    'Dívidas':          '#C084FC',
    'Investimentos':    C.info,
    'Fluxo Interno':    'var(--c-text-muted)',
  };
  return map[grupo] || 'var(--c-text-muted)';
}
