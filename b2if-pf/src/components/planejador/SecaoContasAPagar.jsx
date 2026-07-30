/**
 * SecaoContasAPagar.jsx — Lista e CRUD de Compromissos Fixos do Planejador
 *
 * Extraído de PagePlanejador.jsx (Fase 2 — Strangler Fig)
 * Props: contasAPagar, categorias, modoLeitura, statusConta,
 *        onAdicionar, onEditar, onRemover, mesAtivo, MESES_FULL
 */
import { Pencil, Trash2, CheckCircle2, ClipboardList } from 'lucide-react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn, Card, fmtBRL } from '../UI.jsx';

export function SecaoContasAPagar({ contasAPagar, categorias, modoLeitura, statusConta, onAdicionar, onEditar, onRemover, mesAtivo, MESES_FULL }) {
  const subcats = categorias.filter(c => !c.isCategoria && !c.oculto);
  const ativas = contasAPagar.filter(c => c.ativo !== false);
  const inativas = contasAPagar.filter(c => c.ativo === false);
  const totalPrevisto = contasAPagar.filter(c => c.ativo !== false).reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);

  function nomeCat(catId) {
    return subcats.find(c => c.id === catId)?.nome || catId || '—';
  }

  function renderLista(lista, titulo, cor) {
    if (!lista.length) return null;
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: FONT.sm, color: cor, marginBottom: 10 }}>{titulo}</div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px 160px 200px 80px', gap: 8, padding: '8px 14px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
            {['Nome', 'Valor', 'Dia', 'Categoria', 'Status (mês ativo)', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 1 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          {lista.map((c, idx) => {
            const st = statusConta(c);
            return (
              <div key={c.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 110px 80px 160px 200px 80px', gap: 8,
                padding: '10px 14px', borderTop: idx > 0 ? `1px solid ${C.border}22` : 'none',
                background: idx % 2 === 0 ? 'transparent' : C.bg + '44',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontSize: FONT.sm, fontWeight: 600, color: C.text }}>{c.nome}</span>
                  {c.observacao && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{c.observacao}</div>}
                </div>
                <span style={{ fontSize: FONT.sm, fontWeight: 700, color: C.desp, textAlign: 'right' }}>
                  {c.valor ? fmtBRL(parseFloat(c.valor)) : '—'}
                </span>
                <span style={{ fontSize: FONT.sm, color: C.textMuted, textAlign: 'left' }}>
                  Dia {c.diaVencimento}
                </span>
                <span style={{ fontSize: FONT.xs, color: C.textMuted }}>{nomeCat(c.categoriaId)}</span>
                <span style={{ fontSize: FONT.xs, fontWeight: 600, color: st.cor }}>
                  {st.emoji} {st.label}
                </span>
                {!modoLeitura ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => onEditar(c)} style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', borderRadius: RADIUS.sm, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: "'Inter',sans-serif" }}><Pencil size={11} /></button>
                    <button onClick={() => onRemover(c.id)} style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', borderRadius: RADIUS.sm, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.desp}44`, color: C.desp, fontFamily: "'Inter',sans-serif" }}><Trash2 size={11} /></button>
                  </div>
                ) : <span />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header da seção */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text }}>Compromissos Fixos</div>
          <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 2 }}>
            {ativas.length} ativo{ativas.length !== 1 ? 's' : ''} · Total: <strong style={{ color: C.desp }}>{fmtBRL(totalPrevisto)}</strong>/mês
          </div>
        </div>
        {!modoLeitura && (
          <Btn onClick={onAdicionar} size="sm">+ Adicionar Compromisso</Btn>
        )}
      </div>

      {contasAPagar.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><ClipboardList size={36} color={C.textMuted} /></div>
            <div style={{ fontSize: FONT.base, fontWeight: 600, color: C.text, marginBottom: 8 }}>Nenhum compromisso cadastrado</div>
            <div style={{ fontSize: FONT.sm, marginBottom: 16 }}>Cadastre as contas fixas do cliente (aluguel, plano de saúde, seguros, etc.)</div>
            {!modoLeitura && <Btn onClick={onAdicionar}>+ Adicionar Compromisso</Btn>}
          </div>
        </Card>
      ) : (
        <>
          {renderLista(ativas, `Ativos (${ativas.length})`, C.text)}
          {renderLista(inativas, `Inativos (${inativas.length})`, C.textMuted)}
        </>
      )}
    </div>
  );
}
