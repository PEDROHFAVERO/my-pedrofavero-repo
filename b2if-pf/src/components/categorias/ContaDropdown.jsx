import { useState, useRef, useEffect } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';

// ── ContaDropdown ────────────────────────────────────────────────────────────
// Dropdown customizado com checkboxes para seleção múltipla de contas
function ContaDropdown({ contasNomes, contasSel, onToggle, onLimpar }) {
  const [aberto, setAberto] = useState(false);
  const wrapRef = useRef(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAberto(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  const label = contasSel.size === 0
    ? 'Todas as contas'
    : contasSel.size === 1
      ? [...contasSel][0]
      : `${contasSel.size} contas selecionadas`;

  const ativa = contasSel.size > 0;

  return (
    <div style={{ marginBottom: 16, position: 'relative' }} ref={wrapRef}>
      <div style={{ fontSize: FONT.xs, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Contas</div>

      {/* Trigger — mesmo estilo visual dos selects de competência */}
      <button
        onClick={() => setAberto(v => !v)}
        style={{
          width: '100%', padding: '9px 12px', borderRadius: RADIUS.md,
          border: `1px solid ${ativa ? C.brand : C.border}`,
          background: ativa ? C.brand + '12' : C.bg,
          color: ativa ? C.brand : C.text,
          fontSize: FONT.sm, fontFamily: "'Inter',sans-serif",
          cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontWeight: ativa ? 600 : 400,
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 8 }}>{aberto ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown panel */}
      {aberto && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: RADIUS.md, zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {/* Linha "Todas" / Limpar */}
          <div
            onClick={onLimpar}
            style={{
              padding: '9px 14px', cursor: 'pointer', fontSize: FONT.sm,
              fontFamily: "'Inter',sans-serif", borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 10,
              color: contasSel.size === 0 ? C.brand : C.textMuted,
              background: contasSel.size === 0 ? C.brand + '10' : 'transparent',
              fontWeight: contasSel.size === 0 ? 700 : 400,
            }}
          >
            <span style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
              border: `2px solid ${contasSel.size === 0 ? C.brand : C.border}`,
              background: contasSel.size === 0 ? C.brand : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {contasSel.size === 0 && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
            </span>
            Todas as contas
          </div>

          {/* Itens */}
          {contasNomes.map(nome => {
            const sel = contasSel.has(nome);
            return (
              <div
                key={nome}
                onClick={() => onToggle(nome)}
                style={{
                  padding: '9px 14px', cursor: 'pointer', fontSize: FONT.sm,
                  fontFamily: "'Inter',sans-serif",
                  display: 'flex', alignItems: 'center', gap: 10,
                  color: sel ? C.brand : C.text,
                  background: sel ? C.brand + '10' : 'transparent',
                  fontWeight: sel ? 600 : 400,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${sel ? C.brand : C.border}`,
                  background: sel ? C.brand : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {sel && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
                </span>
                {nome}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


export { ContaDropdown };
