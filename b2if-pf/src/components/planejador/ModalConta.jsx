/**
 * ModalConta.jsx — Modal de criação/edição de Compromisso Fixo
 *
 * Extraído de PagePlanejador.jsx (Fase 2 — Strangler Fig)
 * Props: conta (initial), modo ('novo'|'editar'), categorias, onSalvar, onCancelar
 */
import { useState } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn, Modal } from '../UI.jsx';

export function ModalConta({ conta: contaInicial, modo, categorias, onSalvar, onCancelar }) {
  const [conta, setConta] = useState({ ...contaInicial });
  const subcats = categorias.filter(c => !c.isCategoria && !c.oculto && c.grupo === 'Despesas Essenciais');

  function set(campo, valor) {
    setConta(prev => ({ ...prev, [campo]: valor }));
  }

  function handleSalvar() {
    if (!conta.nome?.trim()) { alert('Informe o nome do compromisso.'); return; }
    if (!conta.valor || isNaN(parseFloat(conta.valor))) { alert('Informe um valor válido.'); return; }
    if (!conta.diaVencimento || isNaN(parseInt(conta.diaVencimento, 10))) { alert('Informe o dia de vencimento.'); return; }
    onSalvar({
      ...conta,
      valor: parseFloat(conta.valor),
      diaVencimento: parseInt(conta.diaVencimento, 10),
      ativo: conta.ativo !== false,
    });
  }

  const inputStyle = {
    width: '100%', background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: RADIUS.sm, padding: '8px 12px', color: C.text,
    fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <Modal
      open={true}
      onClose={onCancelar}
      title={modo === 'novo' ? '+ Novo Compromisso Fixo' : '✏️ Editar Compromisso'}
      width="480px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Nome */}
        <div>
          <label style={{ fontSize: FONT.xs, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4 }}>Nome *</label>
          <input style={inputStyle} placeholder="Ex: Aluguel, Plano de Saúde..." value={conta.nome || ''} onChange={e => set('nome', e.target.value)} />
        </div>

        {/* Valor + Dia */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: FONT.xs, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4 }}>Valor (R$) *</label>
            <input style={inputStyle} type="number" min="0" step="0.01" placeholder="0,00" value={conta.valor || ''} onChange={e => set('valor', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: FONT.xs, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4 }}>Dia de Vencimento *</label>
            <input style={inputStyle} type="number" min="1" max="31" placeholder="Ex: 10" value={conta.diaVencimento || ''} onChange={e => set('diaVencimento', e.target.value)} />
          </div>
        </div>

        {/* Categoria */}
        <div>
          <label style={{ fontSize: FONT.xs, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4 }}>Categoria (Despesas Essenciais)</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={conta.categoriaId || ''}
            onChange={e => set('categoriaId', e.target.value)}
          >
            <option value="">— Selecione uma categoria —</option>
            {subcats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <div style={{ fontSize: FONT.xs, color: C.textDim, marginTop: 4 }}>
            Usada para conciliação: o sistema verifica se há transação com esta categoria no extrato do mês.
          </div>
        </div>

        {/* Observação */}
        <div>
          <label style={{ fontSize: FONT.xs, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4 }}>Observação</label>
          <input style={inputStyle} placeholder="Ex: Contrato n° 123, vence todo dia 10..." value={conta.observacao || ''} onChange={e => set('observacao', e.target.value)} />
        </div>

        {/* Toggle ativo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => set('ativo', !conta.ativo)}
            style={{
              width: 42, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: conta.ativo !== false ? C.rec : C.border,
              position: 'relative', transition: 'background .2s',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: conta.ativo !== false ? 21 : 3,
              width: 18, height: 18, borderRadius: '50%', background: C.white,
              transition: 'left .2s', display: 'block',
            }} />
          </button>
          <span style={{ fontSize: FONT.sm, color: C.text, fontWeight: 500 }}>
            {conta.ativo !== false ? 'Ativo — aparece na conciliação' : 'Inativo — oculto da conciliação'}
          </span>
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
          <Btn variant="ghost" onClick={onCancelar}>Cancelar</Btn>
          <Btn onClick={handleSalvar}>
            {modo === 'novo' ? '+ Adicionar' : '💾 Salvar'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
