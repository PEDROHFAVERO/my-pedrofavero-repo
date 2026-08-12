import { useState, useMemo } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn, Modal, Input, Select } from '../UI.jsx';
import { GRUPOS } from '../../data/categorias.js';

function EditarTransacaoModal({ t, todasCategorias, onSave, onClose }) {
  const [form, setForm] = useState({ ...t });

  // Map id→cat COMPLETO (com intermediárias)
  const catMap = useMemo(() => {
    const m = new Map();
    for (const c of todasCategorias) m.set(c.id, c);
    return m;
  }, [todasCategorias]);

  // Intermediárias por grupo
  const intermsModal = useMemo(() => {
    const mapa = {};
    for (const g of Object.values(GRUPOS)) mapa[g] = [];
    for (const c of todasCategorias) {
      if (c.isCategoria) {
        if (!mapa[c.grupo]) mapa[c.grupo] = [];
        mapa[c.grupo].push(c);
      }
    }
    return mapa;
  }, [todasCategorias]);

  // Subcats por intermediária
  const subcatsPorInterm = useMemo(() => {
    const mapa = {};
    for (const c of todasCategorias) {
      if (!c.isCategoria && c.categoria) {
        if (!mapa[c.categoria]) mapa[c.categoria] = [];
        mapa[c.categoria].push(c);
      }
    }
    return mapa;
  }, [todasCategorias]);

  // Estado: macro selecionado (derivado da categoria atual)
  const subcatAtual  = catMap.get(form.categoria);
  const grupoInicial = subcatAtual?.grupo || '';
  const [macroSel, setMacroSel] = useState(grupoInicial);

  // Subcats sem pai (legado) no grupo selecionado
  const semPaiDoGrupo = useMemo(
    () => todasCategorias.filter(c => !c.isCategoria && !c.categoria && (macroSel ? c.grupo === macroSel : true)),
    [todasCategorias, macroSel]
  );

  const inputSel = (ativo) => ({
    background: C.bg, border: `1px solid ${ativo ? C.brand : C.border}`,
    borderRadius: RADIUS.sm, padding: '8px 12px',
    color: ativo ? C.brand : C.textMuted,
    fontSize: FONT.sm, fontFamily: "'Inter',sans-serif",
    fontWeight: ativo ? 700 : 400, outline: 'none', width: '100%', boxSizing: 'border-box',
  });

  return (
    <Modal open title="Editar Transação (completo)" onClose={onClose} width="540px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input label="Descrição" value={form.descricao} onChange={v => setForm(p => ({ ...p, descricao: v }))} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Data de Compra" value={form.data || ''} onChange={v => setForm(p => ({ ...p, data: v }))} type="date" />
          <div>
            <label style={{ fontSize: FONT.xs, color: C.textMuted, display: 'block', marginBottom: 5 }}>Competência</label>
            <input type="month" value={form.competencia || ''} onChange={e => setForm(p => ({ ...p, competencia: e.target.value }))}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '8px 12px', color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Valor (R$)" value={String(form.valor)} onChange={v => setForm(p => ({ ...p, valor: parseFloat(v) || 0 }))} type="number" />
          <Select label="Tipo" value={form.tipo} onChange={v => setForm(p => ({ ...p, tipo: v }))}
            options={[{ value: 'receita', label: 'Receita' }, { value: 'despesa', label: 'Despesa' }, { value: 'neutro', label: 'Neutro' }]} />
        </div>

        {/* ── Categoria: Macro + select hierárquico com optgroup ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          {/* Col 1: Macro Grupo */}
          <div>
            <label style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600, display: 'block', marginBottom: 5 }}>Macro</label>
            <select value={macroSel}
              onChange={e => { setMacroSel(e.target.value); setForm(p => ({ ...p, categoria: null })); }}
              style={inputSel(macroSel)}>
              <option value="">— todos —</option>
              {Object.values(GRUPOS).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          {/* Col 2: Categoria com optgroup por intermediária */}
          <div>
            <label style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600, display: 'block', marginBottom: 5 }}>Categoria</label>
            <select value={form.categoria || ''}
              onChange={e => setForm(p => ({ ...p, categoria: e.target.value || null }))}
              style={inputSel(form.categoria)}>
              <option value="">— sem categoria —</option>
              {(intermsModal[macroSel] || []).map(interm => {
                const subs = subcatsPorInterm[interm.id] || [];
                if (subs.length === 0) return null;
                return (
                  <optgroup key={interm.id} label={interm.nome}>
                    {subs.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </optgroup>
                );
              })}
              {semPaiDoGrupo.length > 0 && (
                <optgroup label="Outros">
                  {semPaiDoGrupo.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </optgroup>
              )}
            </select>
          </div>
        </div>
        {/* Confirmação visual da seleção */}
        {form.categoria && (() => {
          const sub = catMap.get(form.categoria);
          const pai = sub?.categoria ? catMap.get(sub.categoria) : null;
          return sub ? (
            <div style={{ fontSize: FONT.xs, color: C.brand, fontWeight: 600, marginTop: -6 }}>
              ✓ {sub.grupo}{pai ? ` › ${pai.nome}` : ''} › {sub.nome}
            </div>
          ) : null;
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Conta" value={form.conta || ''} onChange={v => setForm(p => ({ ...p, conta: v }))} />
          <Select label="Formato" value={form.formato || ''} onChange={v => setForm(p => ({ ...p, formato: v }))}
            options={[
              { value: '', label: '— selecione —' },
              { value: 'Pix',     label: 'Pix' },
              { value: 'Débito',  label: 'Débito' },
              { value: 'Crédito', label: 'Crédito' },
              { value: 'Dinheiro',label: 'Dinheiro' },
            ]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Período (label)" value={form.periodoLabel || ''} onChange={v => setForm(p => ({ ...p, periodoLabel: v }))} placeholder="Ex: Dez/2024" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Parcela atual" value={String(form.parcelaAtual || '')} onChange={v => setForm(p => ({ ...p, parcelaAtual: parseInt(v) || null }))} type="number" />
          <Input label="Total de parcelas" value={String(form.parcelaTotal || '')} onChange={v => setForm(p => ({ ...p, parcelaTotal: parseInt(v) || null }))} type="number" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={() => onSave(form)}>Salvar</Btn>
      </div>
    </Modal>
  );
}


export { EditarTransacaoModal };
