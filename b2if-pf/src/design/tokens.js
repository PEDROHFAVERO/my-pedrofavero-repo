// Design System Tokens — Dual Theme (dark / light)
// Todas as cores são lidas de CSS custom properties injetadas pelo ThemeContext.
// Compatibilidade: C.xxx continua funcionando em todo o codebase.
import { BRAND_COLOR, BRAND_COLOR_DARK, BRAND_COLOR_LIGHT } from '../lib/appConfig.js';

// ── Lê do CSS var com fallback (para SSR / primeiros frames) ─────────────────
const v = (name, fallback) =>
  typeof document !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
    : fallback;

// ── C proxy: lê dinamicamente em tempo de render ─────────────────────────────
// Usando um Proxy permite que os componentes recebam o valor certo quando
// o tema muda, sem precisar re-importar o módulo.
export const C = new Proxy({}, {
  get(_, key) {
    const map = {
      bg:           'var(--c-bg)',
      bgMid:        'var(--c-bg-mid)',
      card:         'var(--c-card)',
      cardHover:    'var(--c-card-hover)',
      border:       'var(--c-border)',
      borderLight:  'var(--c-border-light)',
      text:         'var(--c-text)',
      textMuted:    'var(--c-text-muted)',
      textDim:      'var(--c-text-dim)',
      brand:        BRAND_COLOR,
      brandDark:    BRAND_COLOR_DARK,
      brandLight:   BRAND_COLOR_LIGHT,
      rec:          '#22D3A0',
      recBg:        'var(--c-rec-bg)',
      desp:         '#F87171',
      despBg:       'var(--c-desp-bg)',
      warn:         '#FBBF24',
      warnBg:       'var(--c-warn-bg)',
      info:         '#60A5FA',
      infoBg:       'var(--c-info-bg)',
      green:        '#22C55E',
      greenBg:      'var(--c-green-bg)',
      yellow:       '#EAB308',
      yellowBg:     'var(--c-yellow-bg)',
      red:          '#EF4444',
      redBg:        'var(--c-red-bg)',
      grupoReceitas:     '#22D3A0',
      grupoFixas:        '#F87171',
      grupoConsumo:      '#FBBF24',
      grupoDividas:      '#C084FC',
      grupoInvestimentos:'#60A5FA',
      white:        '#FFFFFF',
      black:        '#000000',
      overlay:      'rgba(0,0,0,0.65)',
      // glow helpers
      glowBrand:    `0 0 20px ${BRAND_COLOR}40`,
      glowRec:      '0 0 16px rgba(34,211,160,0.3)',
      glowDesp:     '0 0 16px rgba(248,113,113,0.3)',
      glowInfo:     '0 0 16px rgba(96,165,250,0.3)',
    };
    return map[key] ?? `var(--c-${key})`;
  }
});

export const RADIUS = {
  sm:   '8px',
  md:   '12px',
  lg:   '16px',
  xl:   '20px',
  xxl:  '24px',
  full: '9999px',
};

export const SHADOW = {
  card:  '0 2px 16px rgba(0,0,0,0.35)',
  modal: '0 16px 56px rgba(0,0,0,0.6)',
  glow:  `0 0 24px ${BRAND_COLOR}25`,
  sm:    '0 1px 4px rgba(0,0,0,0.2)',
};

export const FONT = {
  family: "'Inter', system-ui, -apple-system, sans-serif",
  xs:   '11px',
  sm:   '12px',
  md:   '13px',
  base: '14px',
  lg:   '16px',
  xl:   '20px',
  xxl:  '26px',
  h1:   '32px',
};

// ── Tema Dark (default) ───────────────────────────────────────────────────────
export const DARK_VARS = {
  '--c-bg':           '#0D1117',
  '--c-bg-mid':       '#111827',
  '--c-card':         '#161B27',
  '--c-card-hover':   '#1C2333',
  '--c-border':       'rgba(255,255,255,0.07)',
  '--c-border-light': 'rgba(255,255,255,0.12)',
  '--c-text':         '#E8EDF5',
  '--c-text-muted':   '#7A90B0',
  '--c-text-dim':     '#4A6080',
  '--c-rec-bg':       '#0D2E25',
  '--c-desp-bg':      '#2E1515',
  '--c-warn-bg':      '#2E2510',
  '--c-info-bg':      '#0F1E35',
  '--c-green-bg':     '#0A2E1A',
  '--c-yellow-bg':    '#2A2000',
  '--c-red-bg':       '#2E0A0A',
  '--sidebar-bg':     '#0D1117',
  '--sidebar-border': 'rgba(255,255,255,0.07)',
  '--sidebar-item-hover': 'rgba(255,255,255,0.05)',
  '--sidebar-item-active': 'rgba(59,130,246,0.15)',
  '--scrollbar-track': '#0D1117',
  '--scrollbar-thumb': 'rgba(255,255,255,0.1)',
  '--scrollbar-thumb-hover': 'rgba(255,255,255,0.18)',
};

// ── Tema Light ─────────────────────────────────────────────────────────────────
export const LIGHT_VARS = {
  '--c-bg':           '#F0F4F8',
  '--c-bg-mid':       '#E8EDF4',
  '--c-card':         '#FFFFFF',
  '--c-card-hover':   '#F8FAFC',
  '--c-border':       'rgba(0,0,0,0.08)',
  '--c-border-light': 'rgba(0,0,0,0.14)',
  '--c-text':         '#0F172A',
  '--c-text-muted':   '#64748B',
  '--c-text-dim':     '#94A3B8',
  '--c-rec-bg':       '#DCFCE7',
  '--c-desp-bg':      '#FEE2E2',
  '--c-warn-bg':      '#FEF9C3',
  '--c-info-bg':      '#DBEAFE',
  '--c-green-bg':     '#DCFCE7',
  '--c-yellow-bg':    '#FEF9C3',
  '--c-red-bg':       '#FEE2E2',
  '--sidebar-bg':     '#FFFFFF',
  '--sidebar-border': 'rgba(0,0,0,0.08)',
  '--sidebar-item-hover': 'rgba(0,0,0,0.04)',
  '--sidebar-item-active': 'rgba(59,130,246,0.1)',
  '--scrollbar-track': '#F0F4F8',
  '--scrollbar-thumb': 'rgba(0,0,0,0.12)',
  '--scrollbar-thumb-hover': 'rgba(0,0,0,0.22)',
};
