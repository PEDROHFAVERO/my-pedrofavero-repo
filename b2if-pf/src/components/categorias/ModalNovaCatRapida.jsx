import { useState } from 'react';
import { FolderOpen, Tag } from 'lucide-react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn, Input } from '../UI.jsx';
import { GRUPOS } from '../../data/categorias.js';
import { gerarId } from '../../utils/clienteStorage.js';

// ── ModalNovaCatRapida ───────────────────────────────────────────────────────
// Permite criar Categoria+Subcategoria ou só Subcategoria sem sair da tela
function ModalNovaCatRapida({ grupos, catIntermediarias, onCriarCategoriaComSubcat, onCriarSubcat, onClose }) {
  const [tipo, setTipo] = useState(null); // null | 'categoria' | 'subcategoria'
  const [macro, setMacro] = useState('');
  const [catPaiId, setCatPaiId] = useState('');
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [nomeSubcat, setNomeSubcat] = useState('');

  // Categorias intermediárias disponíveis para a macro selecionada
  const catsDisponiveis = macro ? (catIntermediarias[macro] || []) : [];

  // Tipo da macro (receita ou despesa) — inferido pelo grupo
  const GRUPOS_TIPO = {
    'Receitas': 'receita',
    'Despesas Essenciais': 'despesa',
    'Despesas Variáveis': 'despesa',
    'Despesas Eventuais': 'despesa',
    'Investimentos': 'investimento',
    'Transferências': 'transferencia',
  };
  const tipo_macro = GRUPOS_TIPO[macro] || 'despesa';

  // Validação
  const validoCategoria = tipo === 'categoria' && macro && nomeCategoria.trim() && nomeSubcat.trim();
  const validoSubcat = tipo === 'subcategoria' && macro && catPaiId && nomeSubcat.trim();
  const valido = validoCategoria || validoSubcat;

  function handleSalvar() {
    if (!valido) return;
    if (tipo === 'categoria') {
      onCriarCategoriaComSubcat(nomeCategoria.trim(), nomeSubcat.trim(), macro, tipo_macro);
    } else {
      const catPai = catsDisponiveis.find(c => c.id === catPaiId);
      onCriarSubcat(nomeSubcat.trim(), catPaiId, macro, catPai?.tipo || tipo_macro);
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: RADIUS.md,
    border: `1px solid ${C.border}`, background: C.bg,
    color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif",
    outline: 'none', boxSizing: 'border-box',
  };
  const selectStyle = { ...inputStyle, cursor: 'pointer' };
  const labelStyle = { fontSize: FONT.xs, fontWeight: 600, color: C.textMuted, marginBottom: 4 };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.xl, padding: '32px 36px', minWidth: 420, maxWidth: 500, width: '100%' }}>

        {/* Título */}
        <div style={{ fontSize: FONT.lg, fontWeight: 800, color: C.text, marginBottom: 4 }}>Nova Categoria</div>
        <div style={{ fontSize: FONT.sm, color: C.textMuted, marginBottom: 24 }}>
          O que deseja criar?
        </div>

        {/* Seleção do tipo — dois cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          {[
            { v: 'categoria',    icon: <FolderOpen size={22} />, title: 'Categoria',    desc: 'Nova categoria + subcategoria' },
            { v: 'subcategoria', icon: <Tag size={22} />,        title: 'Subcategoria', desc: 'Numa categoria já existente'  },
          ].map(op => {
            const sel = tipo === op.v;
            return (
              <button
                key={op.v}
                onClick={() => { setTipo(op.v); setMacro(''); setCatPaiId(''); setNomeCategoria(''); setNomeSubcat(''); }}
                style={{
                  flex: 1, padding: '14px 12px', borderRadius: RADIUS.md, cursor: 'pointer',
                  border: `2px solid ${sel ? C.brand : C.border}`,
                  background: sel ? C.brand + '15' : 'transparent',
                  textAlign: 'center', transition: 'all 0.15s', fontFamily: "'Inter',sans-serif",
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{op.icon}</div>
                <div style={{ fontSize: FONT.sm, fontWeight: 700, color: sel ? C.brand : C.text }}>{op.title}</div>
                <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 2 }}>{op.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Campos — só aparecem depois de escolher o tipo */}
        {tipo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Macro */}
            <div>
              <div style={labelStyle}>Macro</div>
              <select value={macro} onChange={e => { setMacro(e.target.value); setCatPaiId(''); }} style={selectStyle}>
                <option value="">— Selecione a macro —</option>
                {grupos.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Categoria pai — só para Subcategoria */}
            {tipo === 'subcategoria' && macro && (
              <div>
                <div style={labelStyle}>Categoria</div>
                {catsDisponiveis.length > 0 ? (
                  <select value={catPaiId} onChange={e => setCatPaiId(e.target.value)} style={selectStyle}>
                    <option value="">— Selecione a categoria —</option>
                    {catsDisponiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                ) : (
                  <div style={{ padding: '9px 12px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: C.bg, fontSize: FONT.sm, color: C.textMuted }}>
                    Nenhuma categoria em "{macro}". Crie uma primeiro.
                  </div>
                )}
              </div>
            )}

            {/* Nome da nova Categoria — só para o tipo "categoria" */}
            {tipo === 'categoria' && macro && (
              <div>
                <div style={labelStyle}>Nome da categoria</div>
                <input
                  value={nomeCategoria}
                  onChange={e => setNomeCategoria(e.target.value)}
                  placeholder="Ex: Alimentação, Transporte..."
                  style={inputStyle}
                  autoFocus
                />
              </div>
            )}

            {/* Nome da subcategoria — aparece quando macro (e catPai se for subcategoria) estão preenchidos */}
            {tipo === 'categoria' && macro && (
              <div>
                <div style={labelStyle}>Nome da subcategoria</div>
                <input
                  value={nomeSubcat}
                  onChange={e => setNomeSubcat(e.target.value)}
                  placeholder="Ex: Restaurante, Supermercado..."
                  style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && valido && handleSalvar()}
                />
              </div>
            )}
            {tipo === 'subcategoria' && catPaiId && (
              <div>
                <div style={labelStyle}>Nome da subcategoria</div>
                <input
                  value={nomeSubcat}
                  onChange={e => setNomeSubcat(e.target.value)}
                  placeholder="Ex: Restaurante, Supermercado..."
                  style={inputStyle}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && valido && handleSalvar()}
                />
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 28 }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 18px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, fontWeight: 600, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            disabled={!valido}
            onClick={handleSalvar}
            style={{
              padding: '9px 22px', borderRadius: RADIUS.md, border: 'none',
              background: valido ? C.brand : C.border,
              color: valido ? '#fff' : C.textMuted,
              fontWeight: 700, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif",
              cursor: valido ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}


export { ModalNovaCatRapida };
