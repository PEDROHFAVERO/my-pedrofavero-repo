import { useState, useEffect, useRef } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, padding: '12px 16px' }}>
      <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: FONT.xl, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function TipoBadge({ tipo }) {
  const map = { receita: [C.rec, C.recBg, 'Receita'], despesa: [C.desp, C.despBg, 'Despesa'], neutro: [C.textMuted, C.card, 'Neutro'] };
  const [color, bg, label] = map[tipo] || map.neutro;
  return <Badge color={color} bg={bg}>{label}</Badge>;
}

function MiniBtn({ children, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
      width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: danger ? C.red : C.textMuted, fontSize: 11,
    }}>{children}</button>
  );
}

function grupoColor(grupo) {
  const map = {
    'Receitas': C.rec,
    'Despesas Essenciais': C.desp,
    'Consumo Mensal': C.warn,
    'Dívidas': '#C084FC',
    'Investimentos': C.info,
    'Fluxo Interno': C.textMuted,
  };
  return map[grupo] || C.textMuted;
}

// Normaliza formato: aceita IDs internos OU strings PT legadas (banco antigo)
// Ex: 'Crédito' → 'cartao_credito' | 'Pix' → 'pix' | 'cartao_credito' → 'cartao_credito'
const FORMATO_NORM = {
  // IDs internos (passthrough)
  pix: 'pix', cartao_debito: 'cartao_debito', cartao_credito: 'cartao_credito',
  dinheiro: 'dinheiro', boleto: 'boleto', ted: 'ted',
  // Strings PT legadas (compatibilidade com dados antigos no Supabase)
  'Pix': 'pix', 'Crédito': 'cartao_credito', 'Débito': 'cartao_debito',
  'Dinheiro': 'dinheiro', 'Boleto': 'boleto', 'TED/DOC': 'ted',
  // Variantes sem acento
  'Credito': 'cartao_credito', 'Debito': 'cartao_debito',
};
function normalizarFormato(f) {
  return FORMATO_NORM[f] || f || null;
}
const FORMATO_LABEL = {
  pix:            'Pix',
  cartao_debito:  'Débito',
  cartao_credito: 'Crédito',
  dinheiro:       'Dinheiro',
  boleto:         'Boleto',
  ted:            'TED/DOC',
};
function formatoColor(formato) {
  const f = normalizarFormato(formato);
  const map = {
    pix:            '#00BFFF',
    cartao_debito:  '#A78BFA',
    cartao_credito: '#F97316',
    dinheiro:       '#4ADE80',
    boleto:         '#FBBF24',
    ted:            '#60A5FA',
  };
  return map[f] || C.textMuted;
}

// ── Modal com campo de nome (Nova Categoria / Nova Subcategoria) ──────────────
function ModalFormNome({ titulo, descricao, onConfirmar, onCancelar }) {
  const [nome, setNome] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const confirmar = () => {
    const n = nome.trim();
    if (!n) return;
    onConfirmar(n);
  };

  return (
    <Modal open title={titulo} onClose={onCancelar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {descricao && (
          <div style={{ fontSize: FONT.sm, color: C.textMuted }}>{descricao}</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: FONT.sm, color: C.textMuted, fontWeight: 500 }}>Nome</label>
          <input
            ref={inputRef}
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') onCancelar(); }}
            placeholder="Ex: Alimentação, Transporte..."
            style={{
              background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: RADIUS.md, padding: '9px 12px',
              color: C.text, fontSize: FONT.base,
              fontFamily: "'Inter',sans-serif",
              outline: 'none', width: '100%', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={onCancelar}>Cancelar</Btn>
          <Btn onClick={confirmar} disabled={!nome.trim()}>Criar</Btn>
        </div>
      </div>
    </Modal>
  );
}


export { StatBox, TipoBadge, MiniBtn, grupoColor, normalizarFormato, formatoColor, ModalFormNome };
