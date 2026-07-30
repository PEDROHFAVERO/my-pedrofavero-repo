/**
 * UI.jsx — Design System Components
 * Visual moderno: border-radius maior, hierarquia tipográfica, tema dual (dark/light)
 */
import { useState } from 'react';
import { X, AlertTriangle, FolderOpen } from 'lucide-react';
import { C, RADIUS, SHADOW, FONT } from '../design/tokens.js';

// ── Button ─────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, style, type = 'button', icon }) {
  const [hov, setHov] = useState(false);
  const variants = {
    primary:  { background: C.brand,      color: 'var(--c-bg)',   border: 'none' },
    danger:   { background: C.red,        color: '#fff',           border: 'none' },
    ghost:    { background: hov ? 'var(--sidebar-item-hover)' : 'transparent', color: 'var(--c-text)', border: '1px solid var(--c-border)' },
    outline:  { background: hov ? `${C.brand}18` : 'transparent',  color: C.brand, border: `1px solid ${C.brand}` },
    muted:    { background: 'var(--c-card)', color: 'var(--c-text-muted)', border: '1px solid var(--c-border)' },
  };
  const sizes = {
    sm: { padding: '5px 12px', fontSize: FONT.sm,  borderRadius: RADIUS.sm },
    md: { padding: '9px 18px', fontSize: FONT.base, borderRadius: RADIUS.md },
    lg: { padding: '12px 28px', fontSize: FONT.lg,  borderRadius: RADIUS.md },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...variants[variant],
        ...sizes[size],
        fontFamily: FONT.family,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        transition: 'all 0.18s ease',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style, padding = '20px', onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={onClick ? () => setHov(true) : undefined}
      onMouseLeave={onClick ? () => setHov(false) : undefined}
      style={{
        background: 'var(--c-card)',
        border: '1px solid var(--c-border)',
        borderRadius: RADIUS.lg,
        padding,
        boxShadow: hov && onClick ? '0 4px 24px rgba(0,0,0,0.25)' : SHADOW.card,
        cursor: onClick ? 'pointer' : 'default',
        borderColor: hov && onClick ? C.brand : 'var(--c-border)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease',
        background: hov && onClick ? 'var(--c-card-hover)' : 'var(--c-card)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = '480px' }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--c-card)',
        border: '1px solid var(--c-border)',
        borderRadius: RADIUS.xl,
        padding: '28px',
        width, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: SHADOW.modal,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <span style={{ fontSize: FONT.xl, fontWeight: 700, color: 'var(--c-text)' }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--c-border)',
              borderRadius: RADIUS.sm, color: 'var(--c-text-muted)',
              cursor: 'pointer', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color = C.brand, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px',
      borderRadius: RADIUS.full,
      fontSize: FONT.xs,
      fontWeight: 600,
      color,
      background: bg || color + '20',
      border: `1px solid ${color}30`,
    }}>{children}</span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
// Hierarquia: label (pequeno, muted) → value (grande, colorido, glow) → sub (xs, dim)
export function KPICard({ label, value, color = 'var(--c-text)', sub, icon }) {
  const glowColor = color !== 'var(--c-text)' ? `${color}30` : 'transparent';
  return (
    <Card padding="18px 20px">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: FONT.xs, color: 'var(--c-text-muted)',
            marginBottom: '8px', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {label}
          </div>
          <div style={{
            fontSize: FONT.xxl, fontWeight: 800, color,
            lineHeight: 1, marginBottom: 6,
            textShadow: `0 0 20px ${glowColor}`,
          }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: FONT.xs, color: 'var(--c-text-dim)', lineHeight: 1.4 }}>
              {sub}
            </div>
          )}
        </div>
        {icon && (
          <div style={{
            width: 38, height: 38,
            background: `${color}15`,
            border: `1px solid ${color}25`,
            borderRadius: RADIUS.md,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            marginLeft: 10,
          }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ label, value, onChange, placeholder, type = 'text', style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      {label && <label style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', fontWeight: 600 }}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'var(--c-bg)',
          border: '1px solid var(--c-border)',
          borderRadius: RADIUS.md,
          padding: '10px 14px',
          color: 'var(--c-text)',
          fontSize: FONT.base,
          fontFamily: FONT.family,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          transition: 'border-color 0.18s',
        }}
        onFocus={e => e.target.style.borderColor = C.brand}
        onBlur={e => e.target.style.borderColor = 'var(--c-border)'}
      />
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ label, value, onChange, options, style, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      {label && <label style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', fontWeight: 600 }}>{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--c-bg)',
          border: '1px solid var(--c-border)',
          borderRadius: RADIUS.md,
          padding: '10px 14px',
          color: value ? 'var(--c-text)' : 'var(--c-text-dim)',
          fontSize: FONT.base,
          fontFamily: FONT.family,
          outline: 'none',
          width: '100%',
          cursor: 'pointer',
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: '3px',
      background: 'var(--c-bg)',
      borderRadius: RADIUS.md,
      padding: '4px',
      border: '1px solid var(--c-border)',
    }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1,
            padding: '8px 14px',
            borderRadius: RADIUS.sm,
            border: 'none',
            background: active === t.id ? 'var(--c-card)' : 'transparent',
            color: active === t.id ? C.brand : 'var(--c-text-muted)',
            fontWeight: active === t.id ? 700 : 500,
            fontSize: FONT.sm,
            cursor: 'pointer',
            fontFamily: FONT.family,
            transition: 'all 0.18s',
            whiteSpace: 'nowrap',
            boxShadow: active === t.id ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
          }}
        >
          {t.icon && <span style={{ marginRight: 5, display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Section Title ─────────────────────────────────────────────────────────────
export function SectionTitle({ title, sub, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
      <div>
        <div style={{ fontSize: FONT.lg, fontWeight: 700, color: 'var(--c-text)' }}>{title}</div>
        {sub && <div style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', marginTop: '4px' }}>{sub}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Budget Progress Bar ───────────────────────────────────────────────────────
export function ProgressBar({ real = 0, parcelas = 0, max = 0, height = 6, isReceita = false,
  value, color }) {

  const v    = real !== 0 ? real : (value ?? 0);
  const parc = parcelas ?? 0;
  const total = v + parc;

  const semOrcamento = max <= 0;
  const pctReal  = semOrcamento ? 0 : Math.min(100, (v     / max) * 100);
  const pctTotal = semOrcamento ? 0 : Math.min(100, (total / max) * 100);
  const overflow = !semOrcamento && total > max;

  const pctParaCor = semOrcamento ? 0 : (total / max) * 100;
  let fillColor;
  if (color) {
    fillColor = color;
  } else if (semOrcamento) {
    fillColor = 'var(--c-border-light)';
  } else if (isReceita) {
    fillColor = pctParaCor >= 100 ? C.rec : pctParaCor >= 60 ? C.info : '#60A5FA';
  } else {
    fillColor = pctParaCor >= 100 ? '#F87171'
              : pctParaCor >= 95  ? '#F97316'
              : pctParaCor >= 80  ? '#FBBF24'
              : '#4ADE80';
  }

  const parcColor = 'rgba(192, 132, 252, 0.55)';

  return (
    <div style={{
      position: 'relative',
      background: semOrcamento ? 'var(--c-bg-mid)' : 'var(--c-bg)',
      borderRadius: RADIUS.full,
      height,
      overflow: 'hidden',
      border: `1px solid ${overflow ? '#F8717160' : 'var(--c-border)'}`,
      boxShadow: overflow ? '0 0 0 1px #F8717130' : 'none',
      transition: 'box-shadow 0.3s',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0,
        width: `${pctReal}%`, height: '100%',
        background: fillColor,
        borderRadius: RADIUS.full,
        transition: 'width 0.4s cubic-bezier(.4,0,.2,1)',
      }} />
      {parc > 0 && !semOrcamento && (
        <div style={{
          position: 'absolute', left: `${pctReal}%`, top: 0,
          width: `${Math.min(pctTotal - pctReal, 100 - pctReal)}%`, height: '100%',
          background: parcColor,
          transition: 'width 0.4s cubic-bezier(.4,0,.2,1), left 0.4s cubic-bezier(.4,0,.2,1)',
        }} />
      )}
      {!semOrcamento && (
        <div style={{
          position: 'absolute', left: 'calc(100% - 1px)', top: 0,
          width: 1, height: '100%',
          background: 'var(--c-border)',
          opacity: 0.4,
        }} />
      )}
    </div>
  );
}

// ── Formata valor em BRL ──────────────────────────────────────────────────────
export function fmtBRL(v = 0) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function fmtNum(v = 0, casas = 0) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function Empty({ icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--c-text-muted)' }}>
      <div style={{
        width: 56, height: 56,
        background: 'var(--c-bg-mid)',
        border: '1px solid var(--c-border)',
        borderRadius: RADIUS.xl,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        {icon || <FolderOpen size={22} color="var(--c-text-dim)" />}
      </div>
      {title && <div style={{ fontSize: FONT.base, fontWeight: 600, marginBottom: '6px', color: 'var(--c-text)' }}>{title}</div>}
      {sub && <div style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)' }}>{sub}</div>}
    </div>
  );
}

// ── Tooltip simples ───────────────────────────────────────────────────────────
export function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--c-card)', color: 'var(--c-text)',
          padding: '6px 12px',
          border: '1px solid var(--c-border)',
          borderRadius: RADIUS.md, fontSize: FONT.xs, whiteSpace: 'nowrap',
          zIndex: 100, pointerEvents: 'none', boxShadow: SHADOW.card,
        }}>{text}</div>
      )}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <div style={{
        width: 32, height: 32,
        border: `3px solid var(--c-border)`,
        borderTopColor: C.brand,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── StatusDot — substitui emojis de semáforo (⚪🟢🟡🔴) ──────────────────────
export function StatusDot({ status }) {
  const colors = {
    ok:      '#4ADE80',
    warn:    '#FBBF24',
    danger:  '#F87171',
    neutral: 'var(--c-text-dim)',
    info:    '#60A5FA',
  };
  const color = colors[status] || colors.neutral;
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      background: color,
      boxShadow: status !== 'neutral' ? `0 0 6px ${color}80` : 'none',
      flexShrink: 0,
    }} />
  );
}

// ── PageHeader — cabeçalho padronizado de página ──────────────────────────────
export function PageHeader({ title, sub, actions, style }) {
  return (
    <div style={{
      padding: '28px 32px 20px',
      borderBottom: '1px solid var(--c-border)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      ...style,
    }}>
      <div>
        <h1 style={{
          fontSize: FONT.xl, fontWeight: 800,
          color: 'var(--c-text)', lineHeight: 1.2, margin: 0,
        }}>{title}</h1>
        {sub && (
          <p style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', marginTop: 4, margin: 0 }}>
            {sub}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
