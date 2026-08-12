import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { DARK_VARS } from './design/tokens.js'
import './mobile.css'

// ── Aplica tema dark por padrão (antes do primeiro render — evita flash) ───────
const savedTheme = (() => { try { return localStorage.getItem('b2if-theme') || 'dark'; } catch { return 'dark'; } })();
const root = document.documentElement;

// Injeta vars iniciais do tema salvo
import('./design/tokens.js').then(({ DARK_VARS, LIGHT_VARS }) => {
  const vars = savedTheme === 'light' ? LIGHT_VARS : DARK_VARS;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
});

// ── Estilos globais ────────────────────────────────────────────────────────────
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--c-bg, #0D1117);
    color: var(--c-text, #E8EDF5);
    font-family: 'Inter', system-ui, sans-serif;
    transition: background 0.25s ease, color 0.25s ease;
  }

  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--scrollbar-track, #0D1117); }
  ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, rgba(255,255,255,0.1)); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover, rgba(255,255,255,0.18)); }

  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }

  /* Animação pulse para o dot de salvando */
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.8); }
  }

  /* Sidebar transition helper */
  .sidebar-content {
    transition: margin-left 0.25s cubic-bezier(0.4,0,0.2,1);
  }

  @media print {
    body { background: white !important; color: black !important; }
    .no-print { display: none !important; }
  }

  /* Light theme — body background + scrollbar override */
  [data-theme="light"] body {
    background: #F0F4F8;
    color: #0F172A;
  }
`;
document.head.appendChild(style);

// ── Fonte Inter via Google Fonts ───────────────────────────────────────────────
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap';
document.head.appendChild(link);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registra o Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
