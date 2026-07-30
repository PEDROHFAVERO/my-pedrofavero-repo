/**
 * AbaInvestimentos.jsx — Aba de objetivos de investimento
 *
 * Conceito novo: objetivos de investimento mensais criados/salvos no Supabase.
 * Cada objetivo tem:
 *   - nome, meta_mensal (aporte projetado)
 *   - sub-alocações (opcionais)
 * Mostra progresso: realizado vs meta (mesma lógica de barra que AbaOrcamento)
 *
 * Botão ✏️ abre ModalObjetivos para criar/editar objetivos.
 *
 * Tabela Supabase: investment_objectives
 *   id, planejador_id, cliente_id, nome, meta_mensal, descricao, ativo, created_at
 */
import { useState, useEffect, useMemo } from 'react';
import { Pencil, Plus, Trash2, Target, ChevronDown, ChevronRight, X } from 'lucide-react';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens.js';
import { ProgressBar, fmtBRL, Btn, Empty, Spinner } from '../UI.jsx';
import { supabase } from '../../lib/supabase.js';
import { GRUPOS } from '../../data/categorias.js';

// ── Helper: cor da barra de investimentos ─────────────────────────────────────
function corBarraInvest(pct) {
  // Para investimentos: mais é melhor — lógica similar a receitas
  if (pct >= 100) return '#4ADE80';
  if (pct >= 60)  return '#FBBF24';
  return '#F87171';
}

// ── Modal de criação/edição de objetivo ───────────────────────────────────────
function ModalObjetivo({ open, onClose, objetivo, onSalvar, onExcluir }) {
  const [nome, setNome] = useState('');
  const [metaMensal, setMetaMensal] = useState('');
  const [descricao, setDescricao] = useState('');

  useEffect(() => {
    if (open) {
      setNome(objetivo?.nome || '');
      setMetaMensal(objetivo?.meta_mensal > 0 ? String(objetivo.meta_mensal) : '');
      setDescricao(objetivo?.descricao || '');
    }
  }, [open, objetivo]);

  const handleSalvar = () => {
    const meta = parseFloat(metaMensal.replace(',', '.')) || 0;
    onSalvar({ ...objetivo, nome: nome.trim(), meta_mensal: meta, descricao: descricao.trim() });
  };

  if (!open) return null;

  const isEditar = !!objetivo?.id;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--c-card)',
        border: '1px solid var(--c-border)',
        borderRadius: RADIUS.xl,
        padding: '28px',
        width: '480px',
        maxWidth: '96vw',
        boxShadow: SHADOW.modal,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: FONT.xl, fontWeight: 800, color: 'var(--c-text)' }}>
            {isEditar ? 'Editar Objetivo' : 'Novo Objetivo de Investimento'}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--c-border)', borderRadius: RADIUS.sm,
              color: 'var(--c-text-muted)', cursor: 'pointer', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Nome do objetivo *
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Reserva de Emergência, Tesouro Direto..."
              style={{
                width: '100%', background: 'var(--c-bg)', border: '1px solid var(--c-border)',
                borderRadius: RADIUS.md, padding: '10px 14px', color: 'var(--c-text)',
                fontSize: FONT.base, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--c-brand, #00B8A9)'}
              onBlur={e => e.target.style.borderColor = 'var(--c-border)'}
            />
          </div>

          <div>
            <label style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Aporte mensal projetado (R$)
            </label>
            <input
              type="text"
              value={metaMensal}
              onChange={e => setMetaMensal(e.target.value.replace(/[^0-9,.]/g, ''))}
              placeholder="0,00"
              style={{
                width: '100%', background: 'var(--c-bg)', border: '1px solid var(--c-border)',
                borderRadius: RADIUS.md, padding: '10px 14px', color: 'var(--c-text)',
                fontSize: FONT.base, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box', textAlign: 'right',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--c-brand, #00B8A9)'}
              onBlur={e => e.target.style.borderColor = 'var(--c-border)'}
            />
          </div>

          <div>
            <label style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Descrição (opcional)
            </label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Detalhes sobre este objetivo de investimento..."
              rows={3}
              style={{
                width: '100%', background: 'var(--c-bg)', border: '1px solid var(--c-border)',
                borderRadius: RADIUS.md, padding: '10px 14px', color: 'var(--c-text)',
                fontSize: FONT.base, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box', resize: 'vertical',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--c-brand, #00B8A9)'}
              onBlur={e => e.target.style.borderColor = 'var(--c-border)'}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 24 }}>
          <div>
            {isEditar && (
              <Btn
                onClick={() => onExcluir(objetivo.id)}
                variant="danger"
                size="sm"
                icon={<Trash2 size={14} />}
              >
                Excluir
              </Btn>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={onClose} variant="ghost" size="sm">Cancelar</Btn>
            <Btn
              onClick={handleSalvar}
              variant="primary"
              size="sm"
              disabled={!nome.trim()}
            >
              {isEditar ? 'Salvar' : 'Criar objetivo'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Linha de objetivo ─────────────────────────────────────────────────────────
function LinhaObjetivo({ obj, realizado, onEditar }) {
  const meta = obj.meta_mensal || 0;
  const pct = meta > 0 ? (realizado / meta) * 100 : (realizado > 0 ? 999 : 0);
  const cor = corBarraInvest(pct);
  const aRealizar = Math.max(meta - realizado, 0);
  const excedente = Math.max(realizado - meta, 0);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 130px 120px 110px 110px 180px 40px',
      gap: 0,
      padding: '10px 16px',
      borderBottom: '1px solid var(--c-border)',
      alignItems: 'center',
      background: 'var(--c-card)',
    }}>
      {/* Nome */}
      <div>
        <div style={{ fontSize: FONT.base, fontWeight: 600, color: 'var(--c-text)' }}>
          {obj.nome}
        </div>
        {obj.descricao && (
          <div style={{ fontSize: FONT.xs, color: 'var(--c-text-dim)', marginTop: 2 }}>
            {obj.descricao}
          </div>
        )}
      </div>

      {/* Meta */}
      <span style={{ fontSize: FONT.base, fontWeight: 700, color: 'var(--c-text)', textAlign: 'right', paddingRight: 16 }}>
        {meta > 0 ? fmtBRL(meta) : <span style={{ color: 'var(--c-text-dim)', fontWeight: 400 }}>—</span>}
      </span>

      {/* Realizado */}
      <span style={{
        fontSize: FONT.base,
        color: realizado > 0 ? 'var(--c-text)' : 'var(--c-text-dim)',
        textAlign: 'right', paddingRight: 16, fontWeight: realizado > 0 ? 700 : 400,
      }}>
        {realizado > 0 ? fmtBRL(realizado) : '—'}
      </span>

      {/* A Realizar */}
      <span style={{
        fontSize: FONT.base,
        color: aRealizar > 0 ? '#60A5FA' : 'var(--c-text-dim)',
        textAlign: 'right', paddingRight: 16,
      }}>
        {aRealizar > 0 ? fmtBRL(aRealizar) : '—'}
      </span>

      {/* Excedente */}
      <span style={{
        fontSize: FONT.base,
        color: excedente > 0 ? '#F87171' : 'var(--c-text-dim)',
        textAlign: 'right', paddingRight: 16,
      }}>
        {excedente > 0 ? fmtBRL(excedente) : '—'}
      </span>

      {/* Barra */}
      <div style={{ paddingRight: 8 }}>
        <ProgressBar value={realizado} max={meta} height={7} isReceita={true} color={meta > 0 ? cor : undefined} />
        {meta > 0 && (
          <div style={{ fontSize: '10px', color: 'var(--c-text-dim)', marginTop: 2, textAlign: 'right' }}>
            {pct > 999 ? '>100' : pct.toFixed(0)}%
          </div>
        )}
      </div>

      {/* Botão editar */}
      <button
        onClick={() => onEditar(obj)}
        style={{
          background: 'none', border: '1px solid var(--c-border)', borderRadius: RADIUS.sm,
          color: 'var(--c-text-muted)', cursor: 'pointer',
          width: 30, height: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-border-light)'; e.currentTarget.style.color = 'var(--c-text)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text-muted)'; }}
        title="Editar objetivo"
      >
        <Pencil size={13} />
      </button>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function AbaInvestimentos({
  mes,
  anoStr,
  clienteId,
  planejadorId,
  realizadoPorMes,
}) {
  const [objetivos, setObjetivos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalObj, setModalObj] = useState(null); // null | { open, objetivo }

  // Carrega objetivos do Supabase
  useEffect(() => {
    if (!clienteId) { setCarregando(false); return; }
    setCarregando(true);
    supabase
      .from('investment_objectives')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setObjetivos(data);
        setCarregando(false);
      });
  }, [clienteId]);

  // Realizado de investimentos (subcategorias do grupo Investimentos)
  const realizadoInvestTotal = useMemo(() => {
    const r = realizadoPorMes?.[mes] || {};
    // Subcategorias do grupo investimentos
    const SUBS_INVEST = ['investimento', 'previdencia', 'reserva', 'custodia', 'custos_op', 'iof', 'ir', 'perdas'];
    return SUBS_INVEST.reduce((acc, id) => acc + (r[id] || 0), 0);
  }, [realizadoPorMes, mes]);

  const totalMeta = useMemo(() => objetivos.reduce((acc, o) => acc + (o.meta_mensal || 0), 0), [objetivos]);

  const salvarObjetivo = async (obj) => {
    if (obj.id) {
      // Atualizar
      const { data, error } = await supabase
        .from('investment_objectives')
        .update({ nome: obj.nome, meta_mensal: obj.meta_mensal, descricao: obj.descricao })
        .eq('id', obj.id)
        .select()
        .single();
      if (!error && data) {
        setObjetivos(prev => prev.map(o => o.id === data.id ? data : o));
      }
    } else {
      // Criar
      const { data, error } = await supabase
        .from('investment_objectives')
        .insert({ nome: obj.nome, meta_mensal: obj.meta_mensal, descricao: obj.descricao, cliente_id: clienteId, planejador_id: planejadorId, ativo: true })
        .select()
        .single();
      if (!error && data) {
        setObjetivos(prev => [...prev, data]);
      }
    }
    setModalObj(null);
  };

  const excluirObjetivo = async (id) => {
    if (!window.confirm('Excluir este objetivo de investimento?')) return;
    const { error } = await supabase
      .from('investment_objectives')
      .update({ ativo: false })
      .eq('id', id);
    if (!error) {
      setObjetivos(prev => prev.filter(o => o.id !== id));
    }
    setModalObj(null);
  };

  if (carregando) return <Spinner />;

  return (
    <div style={{ position: 'relative' }}>
      {/* Cabeçalho */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 130px 120px 110px 110px 180px 40px',
        gap: 0,
        padding: '8px 16px',
        background: 'var(--c-bg-mid)',
        borderBottom: '1px solid var(--c-border)',
        borderTop: '1px solid var(--c-border)',
        position: 'sticky', top: 0, zIndex: 2,
      }}>
        {['Objetivo', 'Meta Mensal', 'Realizado', 'A Realizar', 'Excedente', 'Progresso', ''].map((col, i) => (
          <span key={i} style={{
            fontSize: FONT.xs, color: 'var(--c-text-muted)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            textAlign: i === 0 || i === 6 ? 'left' : 'right',
            paddingRight: i > 0 && i < 6 ? 16 : 0,
          }}>
            {col}
          </span>
        ))}
      </div>

      {/* Lista de objetivos */}
      {objetivos.length === 0 ? (
        <div style={{ padding: '40px 24px' }}>
          <Empty
            icon={<Target size={22} color="var(--c-text-dim)" />}
            title="Nenhum objetivo cadastrado"
            sub='Clique no botão "+" abaixo para criar objetivos de investimento para este cliente.'
          />
        </div>
      ) : (
        objetivos.map(obj => (
          <LinhaObjetivo
            key={obj.id}
            obj={obj}
            realizado={0} // TODO: linkar com realizadoPorMes quando houver rastreamento por objetivo
            onEditar={(o) => setModalObj({ open: true, objetivo: o })}
          />
        ))
      )}

      {/* Total */}
      {objetivos.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 130px 120px 110px 110px 180px 40px',
          gap: 0,
          padding: '12px 16px',
          background: 'var(--c-bg-mid)',
          borderTop: '2px solid var(--c-border-light)',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: FONT.base, fontWeight: 800, color: 'var(--c-text)' }}>
            Total Investimentos
          </span>
          <span style={{ fontSize: FONT.base, fontWeight: 800, color: 'var(--c-text)', textAlign: 'right', paddingRight: 16 }}>
            {totalMeta > 0 ? fmtBRL(totalMeta) : '—'}
          </span>
          <span style={{ fontSize: FONT.base, fontWeight: 700, color: 'var(--c-text)', textAlign: 'right', paddingRight: 16 }}>
            {realizadoInvestTotal > 0 ? fmtBRL(realizadoInvestTotal) : '—'}
          </span>
          <span style={{ fontSize: FONT.base, color: 'var(--c-text-dim)', textAlign: 'right', paddingRight: 16 }}>—</span>
          <span style={{ fontSize: FONT.base, color: 'var(--c-text-dim)', textAlign: 'right', paddingRight: 16 }}>—</span>
          <div style={{ paddingRight: 8 }}>
            <ProgressBar value={realizadoInvestTotal} max={totalMeta} height={8} isReceita={true} />
          </div>
          <div />
        </div>
      )}

      {/* Botão de novo objetivo — rodapé do card */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--c-border)', background: 'var(--c-bg-mid)' }}>
        <button
          onClick={() => setModalObj({ open: true, objetivo: null })}
          title="Novo objetivo de investimento"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 20px',
            borderRadius: RADIUS.md,
            background: 'var(--c-brand, #00B8A9)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: FONT.sm,
            fontWeight: 700,
            fontFamily: 'inherit',
            boxShadow: '0 2px 8px rgba(0,184,169,0.35)',
            transition: 'opacity 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          <Plus size={14} />
          Novo objetivo
        </button>
      </div>

      {/* Modal de objetivo */}
      <ModalObjetivo
        open={modalObj?.open || false}
        onClose={() => setModalObj(null)}
        objetivo={modalObj?.objetivo || null}
        onSalvar={salvarObjetivo}
        onExcluir={excluirObjetivo}
      />
    </div>
  );
}
