/**
 * ThemeContext.jsx — Dark / Light theme toggle
 *
 * Injeta CSS custom properties no :root do documento.
 * Persiste preferência em localStorage ('b2if-theme').
 * Exporta: ThemeProvider, useTheme
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DARK_VARS, LIGHT_VARS } from '../design/tokens.js';

const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} });

function applyVars(vars) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('b2if-theme') || 'dark'; }
    catch { return 'dark'; }
  });

  // Aplica vars imediatamente ao montar e ao trocar tema
  useEffect(() => {
    applyVars(theme === 'dark' ? DARK_VARS : LIGHT_VARS);
    document.documentElement.setAttribute('data-theme', theme);
    // Atualiza body background para evitar flash
    document.body.style.background = theme === 'dark' ? '#0D1117' : '#F0F4F8';
    document.body.style.color      = theme === 'dark' ? '#E8EDF5' : '#0F172A';
    try { localStorage.setItem('b2if-theme', theme); } catch {}
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
