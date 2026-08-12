import { useState, useEffect, useMemo, useRef } from 'react';
import { C, FONT, RADIUS } from '../design/tokens.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';

// ── Constantes ────────────────────────────────────────────────────────────────

const AREAS = [
  'Ingestão de Dados',
  'Acompanhamento em Tempo Real',
  'Gamificação e Progresso',
  'IA Integrada',
  'Google Workspace',
  'Infraestrutura',
];

const AREA_PREFIX = {
  'Ingestão de Dados':            'E1',
  'Acompanhamento em Tempo Real': 'E2',
  'Gamificação e Progresso':      'E3',
  'IA Integrada':                 'E4',
  'Google Workspace':             'E5',
  'Infraestrutura':               'E6',
};

const SPRINTS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', '—'];

const COLUNAS = [
  { id: 'backlog',   label: 'Backlog',       icon: '📋', desc: 'Aguardando priorização' },
  { id: 'progresso', label: 'Em Progresso',  icon: '🔄', desc: 'Em desenvolvimento'    },
  { id: 'concluido', label: 'Concluído',     icon: '✅', desc: 'Implementado e entregue'},
];

const PRIOR_COLOR = { alta: '#F87171', media: '#FBBF24', baixa: '#22D3A0' };
const PRIOR_ORDER = { alta: 0, media: 1, baixa: 2 };
const ESFORCO_COLOR = { baixo: '#22D3A0', medio: '#60A5FA', alto: '#F87171' };
const ESFORCO_LABEL = { baixo: '⚡ Baixo', medio: '⚙️ Médio', alto: '🔥 Alto' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`;
}

function gerarItemId(itens, area) {
  const prefix = AREA_PREFIX[area] || 'OTH';
  const existentes = itens
    .filter(i => (i.item_id || '').startsWith(prefix + '-'))
    .map(i => parseInt((i.item_id || '').split('-')[1] || '0', 10))
    .filter(n => !isNaN(n));
  const max = existentes.length > 0 ? Math.max(...existentes) : 0;
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

function classificarAutomatico(titulo, descricao) {
  const txt = `${titulo} ${descricao || ''}`.toLowerCase();

  // Área — alinhada com os Épicos do Backlog B2IF
  let area = 'Ingestão de Dados';
  if (/ia|assistente|inteligência artificial|chat|gpt|gemini|claude|transcrição|whisper|ocr/.test(txt))
    area = 'IA Integrada';
  else if (/google|gmail|drive|calendar|meet|workspace|agenda|e-mail/.test(txt))
    area = 'Google Workspace';
  else if (/infra|deploy|servidor|ci|pipeline|ambiente|produção|lgpd|segurança|sentry|backup|supabase|netlify|cloudflare/.test(txt))
    area = 'Infraestrutura';
  else if (/whatsapp|bot|cupom|áudio|notificação|alerta|pwa|mobile|tempo real/.test(txt))
    area = 'Acompanhamento em Tempo Real';
  else if (/gamif|score|conquista|objetivo|meta|simulador|aposentadoria|relatório pós|engajamento/.test(txt))
    area = 'Gamificação e Progresso';
  else if (/extrato|pdf|csv|upload|importar|banco|open finance|parser|ocr|planilha|formato/.test(txt))
    area = 'Ingestão de Dados';

  // Prioridade
  let prioridade = 'media';
  if (/p0|crítico|bloqueando|urgente|crash|não funciona|imediato/.test(txt)) prioridade = 'alta';
  else if (/p3|futuro|longo prazo|nice to have|visão/.test(txt)) prioridade = 'baixa';

  // Esforço
  const palavrasTitulo = titulo.trim().split(/\s+/).length;
  let esforco = 'medio';
  if (palavrasTitulo <= 5 && !descricao?.trim()) esforco = 'baixo';
  else if ((descricao || '').length > 50) esforco = 'alto';

  return { area, prioridade, esforco };
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ label, color, bg, style = {} }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px',
      borderRadius: RADIUS.full,
      background: bg || color + '22',
      color: color,
      border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
      ...style,
    }}>{label}</span>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, width = '600px', children }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: C.card, borderRadius: RADIUS.lg, width: '100%', maxWidth: width,
        border: `1px solid ${C.border}`, maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: FONT.base, color: C.text }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.textMuted,
            fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
          }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

// ── ModalItem (Criar / Editar) ────────────────────────────────────────────────

function ModalItem({ open, onClose, item, itens, onSalvar, defaultStatus = 'backlog' }) {
  const [aba, setAba] = useState('basico');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [itemId, setItemId] = useState('');
  const [status, setStatus] = useState(defaultStatus);
  const [area, setArea] = useState('');
  const [prioridade, setPrioridade] = useState('media');
  const [esforco, setEsforco] = useState('medio');
  const [sprint, setSprint] = useState('—');
  const [oQue, setOQue] = useState('');
  const [porQue, setPorQue] = useState('');
  const [como, setComo] = useState('');
  const [classMsg, setClassMsg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const tituloRef = useRef(null);

  const isEdit = !!item;

  useEffect(() => {
    if (open) {
      if (item) {
        setTitulo(item.titulo || '');
        setDescricao(item.descricao || '');
        setItemId(item.item_id || '');
        setStatus(item.status || 'backlog');
        setArea(item.area || '');
        setPrioridade(item.prioridade || 'media');
        setEsforco(item.esforco || 'medio');
        setSprint(item.sprint || '—');
        setOQue(item.o_que || '');
        setPorQue(item.por_que || '');
        setComo(item.como || '');
      } else {
        setTitulo(''); setDescricao(''); setItemId('');
        setStatus(defaultStatus); setArea(''); setPrioridade('media');
        setEsforco('medio'); setSprint('—'); setOQue(''); setPorQue(''); setComo('');
      }
      setAba('basico'); setClassMsg(''); setErro('');
      setTimeout(() => tituloRef.current?.focus(), 80);
    }
  }, [open, item, defaultStatus]);

  function handleClassificar() {
    if (!titulo.trim()) { setErro('Preencha o título antes de classificar.'); return; }
    const r = classificarAutomatico(titulo, descricao);
    setArea(r.area); setPrioridade(r.prioridade); setEsforco(r.esforco);
    if (!itemId && !item) setItemId(gerarItemId(itens, r.area));
    setClassMsg(`Classificado como ${r.area} • Prioridade ${r.prioridade} • Esforço ${r.esforco}`);
    setErro('');
    setAba('detalhes');
  }

  // Gera item_id ao trocar de aba se estiver vazio
  function handleAba(a) {
    if (a === 'detalhes' && !itemId && !item && area) setItemId(gerarItemId(itens, area));
    if (a === 'detalhes' && !itemId && !item && !area) setItemId(gerarItemId(itens, 'Outro'));
    setAba(a);
  }

  async function handleSalvar() {
    if (!titulo.trim()) { setErro('Título é obrigatório.'); setAba('basico'); return; }
    setSalvando(true); setErro('');
    try {
      const payload = {
        titulo: titulo.trim(), descricao: descricao.trim() || null,
        item_id: itemId.trim() || null,
        status, area: area || null, prioridade, esforco,
        sprint: sprint || '—',
        o_que: oQue.trim() || null,
        por_que: porQue.trim() || null,
        como: como.trim() || null,
      };
      await onSalvar(payload, item?.id);
      onClose();
    } catch (e) { setErro(e.message || 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  }

  const inp = {
    width: '100%', boxSizing: 'border-box',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: RADIUS.sm, padding: '8px 10px',
    color: C.text, fontSize: FONT.sm,
    fontFamily: "'Inter',sans-serif", outline: 'none',
  };
  const lbl = { fontSize: FONT.xs, color: C.textMuted, fontWeight: 600, display: 'block', marginBottom: 4 };
  const row = { marginBottom: 14 };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Demanda' : 'Nova Demanda'} width="640px">
      <div style={{ padding: '0 20px' }}>
        {/* Abas */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 20, marginTop: 16 }}>
          {['basico', 'detalhes'].map(a => (
            <button key={a} onClick={() => handleAba(a)} style={{
              padding: '8px 20px', border: 'none', borderBottom: aba === a ? `2px solid ${C.brand}` : '2px solid transparent',
              background: 'none', color: aba === a ? C.brand : C.textMuted,
              fontWeight: aba === a ? 700 : 500, fontSize: FONT.sm,
              fontFamily: "'Inter',sans-serif", cursor: 'pointer',
            }}>{a === 'basico' ? 'Básico' : 'Detalhes'}</button>
          ))}
        </div>

        {erro && (
          <div style={{ background: '#F8717122', border: '1px solid #F8717144', borderRadius: RADIUS.sm, padding: '8px 12px', fontSize: FONT.xs, color: '#F87171', marginBottom: 14 }}>
            {erro}
          </div>
        )}

        {/* Aba Básico */}
        {aba === 'basico' && (
          <div>
            <div style={row}>
              <label style={lbl}>Título *</label>
              <input ref={tituloRef} value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="Descreva a demanda em uma linha..." style={inp}
                onKeyDown={e => e.key === 'Enter' && handleClassificar()} />
            </div>
            <div style={row}>
              <label style={lbl}>Descrição</label>
              <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                placeholder="Contexto adicional (opcional)..."
                rows={4} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              <button onClick={handleClassificar} style={{
                background: C.brand + '18', border: `1px solid ${C.brand}55`,
                borderRadius: RADIUS.sm, padding: '8px 16px', color: C.brand,
                fontSize: FONT.sm, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Inter',sans-serif",
              }}><Bot size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />Classificar automaticamente</button>
              {classMsg && (
                <span style={{ fontSize: FONT.xs, color: C.brand, flex: 1 }}>✓ {classMsg}</span>
              )}
            </div>
          </div>
        )}

        {/* Aba Detalhes */}
        {aba === 'detalhes' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>ID</label>
                <input value={itemId} onChange={e => setItemId(e.target.value)}
                  placeholder="EXT-01" style={inp} />
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
                  <option value="backlog">Backlog</option>
                  <option value="progresso">Em Progresso</option>
                  <option value="concluido">Concluído</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Área</label>
                <select value={area} onChange={e => {
                  setArea(e.target.value);
                  if (!itemId && !item) setItemId(gerarItemId(itens, e.target.value));
                }} style={inp}>
                  <option value="">— Área —</option>
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Prioridade</label>
                <select value={prioridade} onChange={e => setPrioridade(e.target.value)} style={inp}>
                  <option value="alta">🔴 Alta</option>
                  <option value="media">🟡 Média</option>
                  <option value="baixa">🟢 Baixa</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Esforço</label>
                <select value={esforco} onChange={e => setEsforco(e.target.value)} style={inp}>
                  <option value="baixo">⚡ Baixo</option>
                  <option value="medio">⚙️ Médio</option>
                  <option value="alto">🔥 Alto</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Sprint</label>
                <select value={sprint} onChange={e => setSprint(e.target.value)} style={inp}>
                  {SPRINTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={row}>
              <label style={lbl}>O que deve ser implementado</label>
              <textarea value={oQue} onChange={e => setOQue(e.target.value)}
                placeholder="Descreva o que será feito..." rows={3}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
            <div style={row}>
              <label style={lbl}>Por que — valor para o usuário</label>
              <textarea value={porQue} onChange={e => setPorQue(e.target.value)}
                placeholder="Qual problema resolve / benefício entregue..." rows={2}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
            <div style={row}>
              <label style={lbl}>Como — abordagem técnica</label>
              <textarea value={como} onChange={e => setComo(e.target.value)}
                placeholder="Sugestão técnica de implementação..." rows={2}
                style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <button onClick={handleSalvar} disabled={salvando} style={{
                background: C.brand, color: C.bg, border: 'none',
                borderRadius: RADIUS.md, padding: '9px 20px',
                fontSize: FONT.sm, fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter',sans-serif", opacity: salvando ? 0.6 : 1,
              }}>{salvando ? 'Salvando...' : '💾 Salvar'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div style={{
        borderTop: `1px solid ${C.border}`, padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
          padding: '8px 16px', color: C.textMuted, fontSize: FONT.sm,
          fontFamily: "'Inter',sans-serif", cursor: 'pointer',
        }}>Cancelar</button>
        <button onClick={handleSalvar} disabled={salvando} style={{
          background: C.brand, color: C.bg, border: 'none',
          borderRadius: RADIUS.md, padding: '9px 20px',
          fontSize: FONT.sm, fontWeight: 700,
          fontFamily: "'Inter',sans-serif", cursor: salvando ? 'not-allowed' : 'pointer',
          opacity: salvando ? 0.6 : 1,
        }}>{salvando ? 'Salvando...' : isEdit ? '✅ Salvar alterações' : '➕ Adicionar ao Backlog'}</button>
      </div>
    </Modal>
  );
}

// ── KanbanCard ────────────────────────────────────────────────────────────────

function KanbanCard({ item, onEditar, onExcluir, onMover, onDragStart }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detOpen, setDetOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const pc = PRIOR_COLOR[item.prioridade] || C.textMuted;
  const outrasCol = COLUNAS.filter(c => c.id !== item.status);
  const temDetalhes = item.o_que || item.por_que || item.como;

  return (
    <div
      draggable
      onDragStart={e => { onDragStart(item); setDragging(true); e.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={() => setDragging(false)}
      style={{
        background: C.card, borderRadius: RADIUS.md,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${pc}`,
        padding: '12px 14px', marginBottom: 10,
        position: 'relative', userSelect: 'none',
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
        transform: dragging ? 'rotate(2deg)' : 'none',
        transition: 'opacity .15s, transform .15s',
      }}>
      {/* Header card */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {item.item_id && (
            <span style={{
              fontFamily: 'monospace', fontSize: 11, color: pc, fontWeight: 700,
              background: pc + '18', padding: '1px 7px', borderRadius: RADIUS.sm,
            }}>{item.item_id}</span>
          )}
          <Badge label={item.prioridade === 'alta' ? '🔴 Alta' : item.prioridade === 'media' ? '🟡 Média' : '🟢 Baixa'}
            color={pc} />
          {item.sprint && item.sprint !== '—' && (
            <Badge label={item.sprint} color={C.info} />
          )}
        </div>
        {/* Menu ⋯ */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button onClick={() => setMenuOpen(v => !v)} style={{
            background: 'none', border: 'none', color: C.textMuted,
            fontSize: 18, cursor: 'pointer', lineHeight: 1,
            padding: '0 4px', borderRadius: RADIUS.sm,
          }}>⋯</button>
          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', zIndex: 200,
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: RADIUS.md, minWidth: 170, padding: '4px 0',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <MenuItem onClick={() => { setMenuOpen(false); onEditar(item); }}>✏️ Editar</MenuItem>
              {outrasCol.map(c => (
                <MenuItem key={c.id} onClick={() => { setMenuOpen(false); onMover(item, c.id); }}>
                  {c.icon} Mover para {c.label}
                </MenuItem>
              ))}
              <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
              <MenuItem onClick={() => { setMenuOpen(false); onExcluir(item); }} color="#F87171">
                🗑️ Excluir
              </MenuItem>
            </div>
          )}
        </div>
      </div>

      {/* Título */}
      <div style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text, marginBottom: 6, lineHeight: 1.4 }}>
        {item.titulo}
      </div>

      {/* Descrição (2 linhas) */}
      {item.descricao && (
        <div style={{
          fontSize: FONT.xs, color: C.textMuted, marginBottom: 8, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{item.descricao}</div>
      )}

      {/* Acordeão de detalhes */}
      {temDetalhes && (
        <div style={{ marginBottom: 8 }}>
          <button onClick={() => setDetOpen(v => !v)} style={{
            background: 'none', border: 'none', color: C.brand, fontSize: FONT.xs,
            cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontWeight: 600, padding: 0,
          }}>
            {detOpen ? '▼ Ocultar detalhes' : '▶ Ver detalhes'}
          </button>
          {detOpen && (
            <div style={{
              marginTop: 8, padding: '10px 12px', background: C.bg,
              borderRadius: RADIUS.sm, border: `1px solid ${C.border}`,
              fontSize: FONT.xs, lineHeight: 1.6,
            }}>
              {item.o_que && <><strong style={{ color: C.text }}>O que:</strong> <span style={{ color: C.textMuted }}>{item.o_que}</span><br /></>}
              {item.por_que && <><strong style={{ color: C.text }}>Por que:</strong> <span style={{ color: C.textMuted }}>{item.por_que}</span><br /></>}
              {item.como && <><strong style={{ color: C.text }}>Como:</strong> <span style={{ color: C.textMuted }}>{item.como}</span></>}
            </div>
          )}
        </div>
      )}

      {/* Rodapé card */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {item.area && <Badge label={item.area} color={C.info} />}
          <Badge label={ESFORCO_LABEL[item.esforco] || item.esforco} color={ESFORCO_COLOR[item.esforco] || C.textMuted} />
        </div>
        <span style={{ fontSize: 10, color: C.textDim }}>{fmtData(item.created_at)}</span>
      </div>
    </div>
  );
}

function MenuItem({ onClick, color, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '8px 14px', background: hover ? C.border + '44' : 'none',
        border: 'none', color: color || C.text, fontSize: FONT.xs,
        cursor: 'pointer', fontFamily: "'Inter',sans-serif",
      }}>{children}</button>
  );
}

// ── KanbanColuna ──────────────────────────────────────────────────────────────

function KanbanColuna({ coluna, itens, onEditar, onExcluir, onMover, onNovoNesta, onDragStart, onDrop, colunaHeight }) {
  const [dragOver, setDragOver] = useState(false);
  const sorted = [...itens].sort((a, b) => (PRIOR_ORDER[a.prioridade] ?? 1) - (PRIOR_ORDER[b.prioridade] ?? 1));
  const cor = coluna.id === 'backlog' ? C.textMuted : coluna.id === 'progresso' ? '#FBBF24' : '#22D3A0';

  return (
    <div style={{
      flex: '1 1 0', minWidth: 280,
      display: 'flex', flexDirection: 'column',
      height: colunaHeight,
    }}>
      {/* Header coluna */}
      <div style={{
        padding: '10px 14px', background: cor + '12',
        border: `1px solid ${cor}30`, borderRadius: `${RADIUS.md} ${RADIUS.md} 0 0`,
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 16 }}>{coluna.icon}</span>
        <span style={{ fontWeight: 700, fontSize: FONT.sm, color: C.text, flex: 1 }}>{coluna.label}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: cor,
          background: cor + '20', padding: '1px 8px', borderRadius: RADIUS.full,
        }}>{itens.length}</span>
      </div>

      {/* Área de drop + cards com scroll independente */}
      <div
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
        onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(coluna.id); }}
        style={{
          flex: 1, overflowY: 'auto', padding: '10px',
          background: dragOver ? cor + '18' : cor + '06',
          border: `1px solid ${dragOver ? cor : cor + '20'}`,
          borderTop: 'none', borderRadius: `0 0 ${RADIUS.md} ${RADIUS.md}`,
          transition: 'background .15s, border-color .15s',
          outline: dragOver ? `2px dashed ${cor}` : 'none',
          outlineOffset: -2,
        }}
      >
        {sorted.map(item => (
          <KanbanCard key={item.id} item={item}
            onEditar={onEditar} onExcluir={onExcluir} onMover={onMover}
            onDragStart={onDragStart} />
        ))}
        {itens.length === 0 && !dragOver && (
          <div style={{
            textAlign: 'center', padding: '32px 12px',
            color: C.textDim, fontSize: FONT.xs,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            Nenhum item aqui
          </div>
        )}
        {dragOver && (
          <div style={{
            textAlign: 'center', padding: '24px 12px',
            color: cor, fontSize: FONT.xs, fontWeight: 700,
            border: `2px dashed ${cor}`, borderRadius: RADIUS.md,
            marginBottom: 8,
          }}>Soltar aqui</div>
        )}
        {/* Botão Adicionar rápido */}
        <button onClick={() => onNovoNesta(coluna.id)} style={{
          width: '100%', background: 'none',
          border: `1px dashed ${cor}40`, borderRadius: RADIUS.sm,
          padding: '8px', color: C.textDim, fontSize: FONT.xs,
          cursor: 'pointer', fontFamily: "'Inter',sans-serif",
          marginTop: 4, transition: 'all .15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = cor; e.currentTarget.style.color = cor; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = cor + '40'; e.currentTarget.style.color = C.textDim; }}
        >+ Adicionar aqui</button>
      </div>
    </div>
  );
}

// ── ViewLista ─────────────────────────────────────────────────────────────────

function ViewLista({ itens, onEditar, onExcluir }) {
  if (itens.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: C.textMuted }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <div style={{ fontSize: FONT.base, fontWeight: 600 }}>Nenhum item encontrado</div>
        <div style={{ fontSize: FONT.sm, marginTop: 4 }}>Tente limpar os filtros</div>
      </div>
    );
  }

  const thStyle = {
    padding: '10px 12px', textAlign: 'left', fontSize: 10,
    color: C.textDim, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.06em', whiteSpace: 'nowrap',
    borderBottom: `1px solid ${C.border}`,
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONT.sm }}>
        <thead>
          <tr style={{ background: C.card }}>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>Título</th>
            <th style={thStyle}>Área</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Prioridade</th>
            <th style={thStyle}>Esforço</th>
            <th style={thStyle}>Sprint</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, idx) => {
            const colStatus = COLUNAS.find(c => c.id === item.status);
            const pc = PRIOR_COLOR[item.prioridade] || C.textMuted;
            const ec = ESFORCO_COLOR[item.esforco] || C.textMuted;
            const [hover, setHover] = useState(false);
            return (
              <tr key={item.id}
                onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
                style={{
                  background: hover ? C.cardHover : idx % 2 === 0 ? 'transparent' : C.bg + '88',
                  transition: 'background .1s',
                }}>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}18` }}>
                  {item.item_id ? (
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: pc, fontWeight: 700 }}>
                      {item.item_id}
                    </span>
                  ) : <span style={{ color: C.textDim }}>—</span>}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}18`, maxWidth: 300 }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>{item.titulo}</span>
                  {item.descricao && (
                    <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                      {item.descricao}
                    </div>
                  )}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}18` }}>
                  {item.area ? <Badge label={item.area} color={C.info} /> : <span style={{ color: C.textDim }}>—</span>}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}18` }}>
                  {colStatus && <Badge label={colStatus.icon + ' ' + colStatus.label}
                    color={colStatus.id === 'concluido' ? '#22D3A0' : colStatus.id === 'progresso' ? '#FBBF24' : C.textMuted} />}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}18` }}>
                  <Badge label={item.prioridade === 'alta' ? '🔴 Alta' : item.prioridade === 'media' ? '🟡 Média' : '🟢 Baixa'}
                    color={pc} />
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}18` }}>
                  <Badge label={ESFORCO_LABEL[item.esforco] || item.esforco} color={ec} />
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}18` }}>
                  <span style={{ color: item.sprint && item.sprint !== '—' ? C.text : C.textDim }}>
                    {item.sprint || '—'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}18`, textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button onClick={() => onEditar(item)} title="Editar" style={{
                      background: C.brand + '18', border: `1px solid ${C.brand}44`,
                      borderRadius: RADIUS.sm, padding: '4px 8px', cursor: 'pointer',
                      fontSize: 13, color: C.brand,
                    }}>✏️</button>
                    <button onClick={() => onExcluir(item)} title="Excluir" style={{
                      background: '#F8717118', border: '1px solid #F8717144',
                      borderRadius: RADIUS.sm, padding: '4px 8px', cursor: 'pointer',
                      fontSize: 13, color: '#F87171',
                    }}>🗑️</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── PageBacklog (componente principal) ────────────────────────────────────────

export default function PageBacklog({ onVoltar }) {
  const { sessao } = useAuth();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Drag and drop
  const dragItem = useRef(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [defaultStatus, setDefaultStatus] = useState('backlog');

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroPrior, setFiltroPrior] = useState('');
  const [view, setView] = useState('kanban'); // 'kanban' | 'lista'

  // Carregar itens
  async function carregar() {
    setCarregando(true); setErro('');
    try {
      const { data, error } = await supabase
        .from('backlog_items')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItens(data || []);
    } catch (e) { setErro(e.message || 'Erro ao carregar backlog.'); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  // Salvar (criar ou editar)
  async function handleSalvar(payload, id) {
    if (id) {
      // Editar
      const { error } = await supabase.from('backlog_items').update(payload).eq('id', id);
      if (error) throw error;
      setItens(prev => prev.map(i => i.id === id ? { ...i, ...payload } : i));
    } else {
      // Criar
      const { data, error } = await supabase
        .from('backlog_items')
        .insert({ ...payload, criado_por: sessao?.perfil?.nome || sessao?.user?.email })
        .select().single();
      if (error) throw error;
      setItens(prev => [data, ...prev]);
    }
  }

  // Excluir
  async function handleExcluir(item) {
    if (!window.confirm(`Excluir "${item.titulo}"?\n\nEssa ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('backlog_items').delete().eq('id', item.id);
    if (error) { setErro(error.message); return; }
    setItens(prev => prev.filter(i => i.id !== item.id));
  }

  // Mover entre colunas
  async function handleMover(item, novoStatus) {
    if (item.status === novoStatus) return;
    const { error } = await supabase.from('backlog_items').update({ status: novoStatus }).eq('id', item.id);
    if (error) { setErro(error.message); return; }
    setItens(prev => prev.map(i => i.id === item.id ? { ...i, status: novoStatus } : i));
  }

  // Drag handlers
  function handleDragStart(item) { dragItem.current = item; }
  function handleDrop(novoStatus) {
    if (dragItem.current) {
      handleMover(dragItem.current, novoStatus);
      dragItem.current = null;
    }
  }

  function abrirEditar(item) { setItemEditando(item); setDefaultStatus(item.status); setModalOpen(true); }
  function abrirNovo(status = 'backlog') { setItemEditando(null); setDefaultStatus(status); setModalOpen(true); }

  // Filtros
  const itensFiltrados = useMemo(() => {
    const buscaLow = busca.toLowerCase();
    return itens.filter(i => {
      if (busca && !`${i.titulo} ${i.item_id || ''} ${i.descricao || ''}`.toLowerCase().includes(buscaLow)) return false;
      if (filtroArea && i.area !== filtroArea) return false;
      if (filtroPrior && i.prioridade !== filtroPrior) return false;
      return true;
    });
  }, [itens, busca, filtroArea, filtroPrior]);

  const temFiltro = busca || filtroArea || filtroPrior;

  // Stats
  const stats = useMemo(() => ({
    total: itens.length,
    backlog: itens.filter(i => i.status === 'backlog').length,
    progresso: itens.filter(i => i.status === 'progresso').length,
    concluido: itens.filter(i => i.status === 'concluido').length,
    alta: itens.filter(i => i.prioridade === 'alta').length,
  }), [itens]);

  const inp = {
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: RADIUS.sm, padding: '7px 12px',
    color: C.text, fontSize: FONT.sm,
    fontFamily: "'Inter',sans-serif", outline: 'none',
  };

  // Altura das colunas Kanban = 100vh - header(52) - padding-top(20) - titulo(56) - stats(80) - filtros(52) - gaps
  const KANBAN_COL_HEIGHT = 'calc(100vh - 52px - 20px - 56px - 80px - 52px - 48px)';

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: C.bg, fontFamily: "'Inter',system-ui,sans-serif", color: C.text, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: '0 32px', flexShrink: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', alignItems: 'center', height: 52, gap: 16 }}>
          <button onClick={onVoltar} style={{
            background: 'none', border: `1px solid ${C.border}`,
            borderRadius: RADIUS.sm, padding: '4px 12px',
            color: C.textMuted, fontSize: FONT.xs, cursor: 'pointer',
            fontFamily: "'Inter',sans-serif",
          }}>← Voltar</button>
          <span style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text }}>📋 Backlog de Produto</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => abrirNovo()} style={{
            background: C.brand, color: C.bg, border: 'none',
            borderRadius: RADIUS.md, padding: '8px 18px',
            fontSize: FONT.sm, fontWeight: 700,
            fontFamily: "'Inter',sans-serif", cursor: 'pointer',
          }}>+ Nova Demanda</button>
        </div>
      </div>

      {/* Corpo com scroll apenas para lista; kanban é fixed-height */}
      <div style={{ flex: 1, overflowY: view === 'lista' ? 'auto' : 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 1300, width: '100%', margin: '0 auto', padding: '20px 32px 0', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        {/* Título */}
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <div style={{ fontSize: FONT.xl, fontWeight: 800 }}>Backlog de Produto</div>
          <div style={{ fontSize: FONT.sm, color: C.textMuted, marginTop: 3 }}>
            Gerencie demandas, user stories e melhorias do sistema B2IF
          </div>
        </div>

        {/* Erro */}
        {erro && (
          <div style={{
            background: '#F8717118', border: '1px solid #F8717144',
            borderRadius: RADIUS.sm, padding: '10px 14px',
            fontSize: FONT.xs, color: '#F87171', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between',
          }}>
            {erro}
            <button onClick={() => setErro('')} style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        )}

        {/* Cards de stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16, flexShrink: 0 }}>
          {[
            { label: 'Total', value: stats.total, color: C.brand },
            { label: 'Backlog', value: stats.backlog, color: C.textMuted },
            { label: 'Em Progresso', value: stats.progresso, color: '#FBBF24' },
            { label: 'Concluído', value: stats.concluido, color: '#22D3A0' },
            { label: 'Alta Prioridade', value: stats.alta, color: '#F87171' },
          ].map(s => (
            <div key={s.label} style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: RADIUS.md, padding: '14px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Barra de filtros */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          marginBottom: 16, flexWrap: 'wrap', flexShrink: 0,
        }}>
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar por título, ID ou descrição..."
            style={{ ...inp, minWidth: 260, flex: 1 }} />
          <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)} style={inp}>
            <option value="">Todas as áreas</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroPrior} onChange={e => setFiltroPrior(e.target.value)} style={inp}>
            <option value="">Todas as prioridades</option>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Média</option>
            <option value="baixa">🟢 Baixa</option>
          </select>
          {temFiltro && (
            <button onClick={() => { setBusca(''); setFiltroArea(''); setFiltroPrior(''); }} style={{
              background: '#F8717118', border: '1px solid #F8717144',
              borderRadius: RADIUS.sm, padding: '7px 14px',
              color: '#F87171', fontSize: FONT.xs, cursor: 'pointer',
              fontFamily: "'Inter',sans-serif", fontWeight: 600,
            }}>✕ Limpar</button>
          )}
          {/* Toggle view */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {['kanban', 'lista'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '7px 14px', borderRadius: RADIUS.sm,
                border: `1px solid ${view === v ? C.brand : C.border}`,
                background: view === v ? C.brand + '18' : 'none',
                color: view === v ? C.brand : C.textMuted,
                fontSize: FONT.xs, fontWeight: view === v ? 700 : 400,
                cursor: 'pointer', fontFamily: "'Inter',sans-serif",
              }}>{v === 'kanban' ? '🗂 Kanban' : '📄 Lista'}</button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        {carregando ? (
          <div style={{ textAlign: 'center', padding: '60px', color: C.textMuted, flexShrink: 0 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div>Carregando backlog...</div>
          </div>
        ) : view === 'kanban' ? (
          <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, paddingBottom: 20 }}>
            {COLUNAS.map(col => (
              <KanbanColuna key={col.id} coluna={col}
                itens={itensFiltrados.filter(i => i.status === col.id)}
                onEditar={abrirEditar} onExcluir={handleExcluir}
                onMover={handleMover} onNovoNesta={abrirNovo}
                onDragStart={handleDragStart} onDrop={handleDrop}
                colunaHeight="100%" />
            ))}
          </div>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: 32 }}>
            <ViewLista itens={itensFiltrados} onEditar={abrirEditar} onExcluir={handleExcluir} />
          </div>
        )}

      </div>
      </div>

      {/* Modal */}
      <ModalItem
        open={modalOpen} onClose={() => setModalOpen(false)}
        item={itemEditando} itens={itens}
        onSalvar={handleSalvar} defaultStatus={defaultStatus}
      />
    </div>
  );
}
