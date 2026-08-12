/**
 * PageFluxoWhatsapp.jsx
 * Página dedicada aos lançamentos vindos do WhatsApp (transacoesBot).
 * Três abas:
 *   1. Lançamentos   — tabela editável dos rascunhos do bot, sem importação
 *   2. Limites & Metas — progresso do planejamento do mês via transacoesBot
 *   3. Comparativo   — transacoesBot vs transacoes oficiais por categoria
 */

import { useState, useMemo, useCallback } from 'react';
import {
  MessageCircle, Download, Pencil, Trash2, Check, X,
  TrendingUp, BarChart2, ChevronDown, ChevronUp, Search,
  AlertTriangle, CheckCircle2, Info,
} from 'lucide-react';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens.js';
import { useApp } from '../context/AppContext.jsx';
import { Btn, Card, fmtBRL, Modal, Input, Select, Empty } from '../components/UI.jsx';
import { GRUPOS } from '../data/categorias.js';
import { gerarId } from '../utils/clienteStorage.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_NOME  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmtData(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}

function fmtCompetencia(comp) {
  if (!comp) return '—';
  const [y, m] = String(comp).split('-');
  const idx = parseInt(m, 10) - 1;
  return `${MESES_LABEL[idx] ?? m}/${y}`;
}

/** Retorna lista de competências únicas ordenadas desc (mais recente primeiro) */
function mesesDisponiveisDeBot(txBot) {
  const set = new Set(txBot.map(t => t.competencia).filter(Boolean));
  return [...set].sort((a, b) => b.localeCompare(a));
}

/** Agrupa transacoesBot por categoria, somando valores absolutos */
function somarPorCategoria(txBot) {
  const mapa = {};
  for (const t of txBot) {
    if (t.tipo !== 'despesa') continue;
    const cat = t.categoria || 'outros';
    mapa[cat] = (mapa[cat] ?? 0) + Math.abs(Number(t.valor ?? 0));
  }
  return mapa;
}

/** Retorna nome legível de uma categoria pelo id */
function nomeCat(catId, allCats) {
  const found = allCats.find(c => c.id === catId && !c.isCategoria);
  if (found) return found.nome;
  // fallback: capitaliza o id
  return catId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/** Cor da barra de progresso */
function corProgresso(pct) {
  if (pct >= 100) return '#EF4444'; // vermelho
  if (pct >= 80)  return '#F59E0B'; // amarelo
  return '#22C55E';                 // verde
}

// ── Exportar CSV das transacoesBot ────────────────────────────────────────────

function exportarBotCSV(txBot, nomeCliente) {
  const header = ['Cliente','Data','Valor','Descrição','Tipo','Macro','Categoria'];
  const rows = txBot.map(t => {
    // Resolve macro a partir da categoria
    const macro = t.grupo ?? '';
    return [
      t.portador ?? '',
      t.data ?? '',
      String(Math.abs(Number(t.valor ?? 0)).toFixed(2)).replace('.', ','),
      `"${(t.descricao ?? '').replace(/"/g, '""')}"`,
      t.tipo ?? '',
      macro,
      t.categoria ?? '',
    ];
  });
  const csv = [header, ...rows].map(r => r.join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fluxo-whatsapp-${nomeCliente ?? 'cliente'}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

/** Barra de abas */
function AbaTabs({ aba, setAba }) {
  const tabs = [
    { id: 'lancamentos',  label: 'Lançamentos',    Icon: MessageCircle },
    { id: 'metas',        label: 'Limites & Metas', Icon: TrendingUp },
    { id: 'comparativo',  label: 'Comparativo',    Icon: BarChart2 },
  ];
  return (
    <div style={{
      display: 'flex', gap: 4,
      background: 'var(--c-bg)',
      border: '1px solid var(--c-border)',
      borderRadius: RADIUS.md,
      padding: 4,
      width: 'fit-content',
    }}>
      {tabs.map(({ id, label, Icon }) => {
        const ativo = aba === id;
        return (
          <button
            key={id}
            onClick={() => setAba(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 18px',
              border: 'none',
              borderRadius: RADIUS.sm,
              cursor: 'pointer',
              fontFamily: FONT.family,
              fontSize: FONT.sm,
              fontWeight: ativo ? 700 : 500,
              background: ativo ? '#25D366' : 'transparent',
              color: ativo ? '#fff' : C.textMuted,
              transition: 'all 0.15s',
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Seletor de mês */
function SeletorMes({ meses, valor, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {label && <span style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600 }}>{label}</span>}
      <select
        value={valor}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'var(--c-card)',
          border: `1px solid ${valor ? '#25D366' : C.border}`,
          borderRadius: RADIUS.md,
          padding: '6px 10px',
          color: valor ? '#25D366' : C.text,
          fontSize: FONT.sm,
          fontFamily: FONT.family,
          outline: 'none',
          fontWeight: valor ? 700 : 400,
          cursor: 'pointer',
        }}
      >
        <option value="">Todos os períodos</option>
        {meses.map(m => {
          const [y, mo] = m.split('-');
          return <option key={m} value={m}>{MESES_LABEL[parseInt(mo,10)-1]}/{y}</option>;
        })}
      </select>
    </div>
  );
}

// ── Modal de edição de transação bot ─────────────────────────────────────────

function ModalEditarBot({ t, allCategorias, nucleoFamiliar, onSave, onClose }) {
  const [form, setForm] = useState({ ...t });

  const intermsModal = useMemo(() => {
    const mapa = {};
    for (const g of Object.values(GRUPOS)) mapa[g] = [];
    for (const c of allCategorias) {
      if (c.isCategoria) {
        if (!mapa[c.grupo]) mapa[c.grupo] = [];
        mapa[c.grupo].push(c);
      }
    }
    return mapa;
  }, [allCategorias]);

  const subcatsPorInterm = useMemo(() => {
    const mapa = {};
    for (const c of allCategorias) {
      if (!c.isCategoria && c.categoria) {
        if (!mapa[c.categoria]) mapa[c.categoria] = [];
        mapa[c.categoria].push(c);
      }
    }
    return mapa;
  }, [allCategorias]);

  const subcatAtual = allCategorias.find(c => c.id === form.categoria);
  const grupoInicial = subcatAtual?.grupo || '';
  const [macroSel, setMacroSel] = useState(grupoInicial);

  const inputStyle = (ativo) => ({
    background: 'var(--c-bg)',
    border: `1px solid ${ativo ? '#25D366' : C.border}`,
    borderRadius: RADIUS.sm,
    padding: '8px 12px',
    color: ativo ? '#25D366' : C.text,
    fontSize: FONT.sm,
    fontFamily: FONT.family,
    fontWeight: ativo ? 700 : 400,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  });

  return (
    <Modal open title="Editar Lançamento WhatsApp" onClose={onClose} width="540px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Cliente (portador) — só aparece se há núcleo familiar */}
        {nucleoFamiliar.length > 0 && (
          <div>
            <label style={{ fontSize: FONT.xs, color: C.textMuted, display: 'block', marginBottom: 5, fontWeight: 600 }}>Cliente</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {nucleoFamiliar.map(p => {
                const sel = form.portador === p.nome;
                return (
                  <button key={p.id}
                    onClick={() => setForm(prev => ({ ...prev, portador: sel ? '' : p.nome }))}
                    style={{
                      padding: '6px 14px', borderRadius: RADIUS.full, cursor: 'pointer',
                      border: `2px solid ${sel ? '#25D366' : C.border}`,
                      background: sel ? 'rgba(37,211,102,0.12)' : 'var(--c-bg)',
                      color: sel ? '#25D366' : C.text,
                      fontWeight: sel ? 700 : 500, fontSize: FONT.sm,
                      fontFamily: FONT.family, transition: 'all 0.15s',
                    }}>{p.nome}</button>
                );
              })}
              {form.portador && (
                <button onClick={() => setForm(p => ({ ...p, portador: '' }))}
                  style={{ padding: '6px 10px', borderRadius: RADIUS.full, cursor: 'pointer', border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, fontSize: FONT.xs, fontFamily: FONT.family }}
                >✕ Limpar</button>
              )}
            </div>
          </div>
        )}
        <Input label="Descrição" value={form.descricao ?? ''} onChange={v => setForm(p => ({ ...p, descricao: v }))} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Data" value={form.data ?? ''} onChange={v => setForm(p => ({ ...p, data: v }))} type="date" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, gridColumn: 'span 1' }}>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label="Valor (R$)" value={String(Math.abs(form.valor ?? 0))} onChange={v => {
            const n = parseFloat(String(v).replace(',', '.')) || 0;
            setForm(p => ({ ...p, valor: p.tipo === 'despesa' ? -n : n }));
          }} type="number" />
          <Select label="Tipo" value={form.tipo ?? 'despesa'} onChange={v => {
            const n = Math.abs(Number(form.valor ?? 0));
            setForm(p => ({ ...p, tipo: v, valor: v === 'despesa' ? -n : n }));
          }} options={[{ value: 'despesa', label: 'Despesa' }, { value: 'receita', label: 'Receita' }]} />
        </div>

        {/* Categoria hierárquica */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600, display: 'block', marginBottom: 5 }}>Macro</label>
            <select value={macroSel} onChange={e => { setMacroSel(e.target.value); setForm(p => ({ ...p, categoria: null })); }}
              style={inputStyle(!!macroSel)}>
              <option value="">— todos —</option>
              {Object.values(GRUPOS).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600, display: 'block', marginBottom: 5 }}>Categoria</label>
            <select value={form.categoria ?? ''} onChange={e => setForm(p => ({ ...p, categoria: e.target.value || null }))}
              style={inputStyle(!!form.categoria)}>
              <option value="">— sem categoria —</option>
              {(intermsModal[macroSel] || []).map(interm => {
                const subs = subcatsPorInterm[interm.id] || [];
                if (!subs.length) return null;
                return (
                  <optgroup key={interm.id} label={interm.nome}>
                    {subs.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </optgroup>
                );
              })}
              {!macroSel && allCategorias.filter(c => !c.isCategoria).map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>


      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn
          onClick={() => onSave(form)}
          style={{ background: '#25D366', color: '#fff', border: 'none' }}
          disabled={!form.descricao?.trim()}
        >Salvar</Btn>
      </div>
    </Modal>
  );
}

// ── Aba 1: Lançamentos WhatsApp ───────────────────────────────────────────────

function AbaLancamentos({ txBot, allCategorias, mesFiltro, setMesFiltro, mesesDisp, onEditar, onDeletar, onExportar }) {
  const [busca, setBusca] = useState('');

  const txFiltradas = useMemo(() => {
    let lista = mesFiltro
      ? txBot.filter(t => t.competencia === mesFiltro)
      : txBot;
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter(t =>
        (t.descricao ?? '').toLowerCase().includes(q) ||
        (t.categoria ?? '').toLowerCase().includes(q) ||
        (t.conta ?? '').toLowerCase().includes(q)
      );
    }
    return [...lista].sort((a, b) => String(b.criadoEm ?? b.data ?? '').localeCompare(String(a.criadoEm ?? a.data ?? '')));
  }, [txBot, mesFiltro, busca]);

  const totalDespesas = txFiltradas.filter(t => t.tipo === 'despesa').reduce((s, t) => s + Math.abs(Number(t.valor ?? 0)), 0);
  const totalReceitas = txFiltradas.filter(t => t.tipo === 'receita').reduce((s, t) => s + Math.abs(Number(t.valor ?? 0)), 0);

  return (
    <div>
      {/* Barra superior */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <SeletorMes meses={mesesDisp} valor={mesFiltro} onChange={setMesFiltro} label="Mês:" />

        {/* Busca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--c-card)', border: `1px solid ${C.border}`, borderRadius: RADIUS.md, padding: '5px 10px', flex: 1, minWidth: 180, maxWidth: 320 }}>
          <Search size={13} color={C.textMuted} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar descrição, categoria..."
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: FONT.sm, color: C.text, fontFamily: FONT.family, flex: 1 }}
          />
          {busca && <button onClick={() => setBusca('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex' }}><X size={12} /></button>}
        </div>

        {/* Exportar */}
        <Btn variant="ghost" icon={<Download size={14} />} onClick={onExportar} style={{ marginLeft: 'auto' }}>
          Exportar CSV
        </Btn>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total de lançamentos', value: txFiltradas.length, color: C.info },
          { label: 'Total despesas', value: fmtBRL(totalDespesas), color: C.desp },
          { label: 'Total receitas', value: fmtBRL(totalReceitas), color: C.rec },
        ].map(({ label, value, color }) => (
          <Card key={label} padding="14px 18px">
            <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: FONT.lg, fontWeight: 700, color }}>{value}</div>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      {txFiltradas.length === 0 ? (
        <Empty
          icon={<MessageCircle size={40} color="#25D366" />}
          title="Nenhum lançamento encontrado"
          sub={mesFiltro ? `Sem lançamentos via WhatsApp em ${fmtCompetencia(mesFiltro)}.` : 'Sem lançamentos via WhatsApp ainda.'}
        />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONT.sm, fontFamily: FONT.family }}>
            <thead>
              <tr style={{ borderBottom: `2px solid var(--c-border)`, background: 'var(--c-bg)' }}>
                {['Cliente','Data','Valor','Descrição','Tipo','Macro','Categoria','Ações'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: FONT.xs, color: C.textMuted, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txFiltradas.map((t, i) => {
                const isDesp = t.tipo === 'despesa';
                // Resolve macro e categoria
                const subcatObj = allCategorias.find(c => c.id === t.categoria && !c.isCategoria);
                const macroNome = subcatObj?.grupo ?? '';
                const catNome   = nomeCat(t.categoria ?? '', allCategorias);
                return (
                  <tr key={t.id ?? i}
                    style={{ borderBottom: `1px solid var(--c-border)`, transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--c-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Cliente (portador) */}
                    <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                      {t.portador
                        ? <span style={{ fontSize: FONT.xs, fontWeight: 700, color: '#25D366', background: 'rgba(37,211,102,0.12)', padding: '2px 8px', borderRadius: 10 }}>{t.portador}</span>
                        : <span style={{ color: C.textMuted, fontSize: FONT.xs }}>—</span>
                      }
                    </td>
                    {/* Data */}
                    <td style={{ padding: '9px 10px', color: C.textMuted, whiteSpace: 'nowrap', fontSize: FONT.xs }}>{fmtData(t.data)}</td>
                    {/* Valor */}
                    <td style={{ padding: '9px 10px', fontWeight: 700, color: isDesp ? C.desp : C.rec, whiteSpace: 'nowrap' }}>
                      {isDesp ? '−' : '+'}{fmtBRL(Math.abs(Number(t.valor ?? 0)))}
                    </td>
                    {/* Descrição */}
                    <td style={{ padding: '9px 10px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.descricao}>{t.descricao ?? '—'}</td>
                    {/* Tipo */}
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: RADIUS.full, fontSize: FONT.xs, fontWeight: 700,
                        background: isDesp ? 'var(--c-desp-bg)' : 'var(--c-rec-bg)',
                        color: isDesp ? C.desp : C.rec,
                      }}>{isDesp ? 'Despesa' : 'Receita'}</span>
                    </td>
                    {/* Macro */}
                    <td style={{ padding: '9px 10px', color: C.textMuted, whiteSpace: 'nowrap', fontSize: FONT.xs, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {macroNome || <span style={{ color: C.textDim }}>—</span>}
                    </td>
                    {/* Categoria */}
                    <td style={{ padding: '9px 10px', color: C.text, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={catNome}>
                      {catNome || <span style={{ color: C.textMuted }}>—</span>}
                    </td>
                    {/* Ações */}
                    <td style={{ padding: '9px 10px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => onEditar(t)}
                          title="Editar"
                          style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: RADIUS.sm, padding: '4px 8px', cursor: 'pointer', color: C.info, display: 'flex', alignItems: 'center' }}
                        ><Pencil size={12} /></button>
                        <button
                          onClick={() => onDeletar(t.id)}
                          title="Excluir"
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: RADIUS.sm, padding: '4px 8px', cursor: 'pointer', color: C.red, display: 'flex', alignItems: 'center' }}
                        ><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: FONT.xs, color: C.textMuted, textAlign: 'right' }}>
            {txFiltradas.length} lançamento{txFiltradas.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba 2: Limites & Metas ────────────────────────────────────────────────────

function AbaMetas({ txBot, planejamento, allCategorias, anoAtivo }) {
  const mesAtualN = new Date().getMonth(); // 0-based
  const [mesSel, setMesSel] = useState(mesAtualN);

  const mesesOpts = MESES_NOME.map((nome, i) => ({ value: i, label: nome }));

  // planMes: { [catId]: { projetado: number } }
  const anoStr = String(anoAtivo ?? new Date().getFullYear());
  const planMes = (planejamento?.[anoStr]?.[mesSel]) ?? {};

  // Filtra txBot pelo mês/ano selecionados
  const competSel = `${anoStr}-${String(mesSel + 1).padStart(2, '0')}`;
  const txMes = txBot.filter(t => t.competencia === competSel && t.tipo === 'despesa');
  const gastoBot = somarPorCategoria(txMes);

  // Monta linhas: todas as categorias que têm projetado > 0 (independente de gasto)
  const linhas = Object.entries(planMes)
    .map(([catId, v]) => ({
      catId,
      nome: nomeCat(catId, allCategorias),
      projetado: Number(v?.projetado ?? 0),
      realizado: gastoBot[catId] ?? 0,
    }))
    .filter(l => l.projetado > 0)
    .sort((a, b) => {
      // Ordena: estouro primeiro, depois % maior
      const pctA = a.realizado / a.projetado;
      const pctB = b.realizado / b.projetado;
      return pctB - pctA;
    });

  const totalProjetado = linhas.reduce((s, l) => s + l.projetado, 0);
  const totalRealizado = linhas.reduce((s, l) => s + l.realizado, 0);
  const totalPct = totalProjetado > 0 ? Math.round((totalRealizado / totalProjetado) * 100) : 0;

  return (
    <div>
      {/* Seletor de mês */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <span style={{ fontSize: FONT.sm, color: C.textMuted, fontWeight: 600 }}>Mês de referência:</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MESES_LABEL.map((ml, i) => (
            <button
              key={i}
              onClick={() => setMesSel(i)}
              style={{
                padding: '5px 12px',
                borderRadius: RADIUS.full,
                border: mesSel === i ? '1px solid #25D366' : `1px solid ${C.border}`,
                background: mesSel === i ? 'rgba(37,211,102,0.15)' : 'transparent',
                color: mesSel === i ? '#25D366' : C.textMuted,
                fontSize: FONT.xs,
                fontWeight: mesSel === i ? 700 : 400,
                cursor: 'pointer',
                fontFamily: FONT.family,
              }}
            >{ml}</button>
          ))}
        </div>
      </div>

      {/* KPI total */}
      {linhas.length > 0 && (
        <Card padding="16px 20px" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600 }}>TOTAL DO MÊS (via WhatsApp)</div>
              <div style={{ fontSize: FONT.lg, fontWeight: 700, color: corProgresso(totalPct), marginTop: 2 }}>
                {fmtBRL(totalRealizado)} <span style={{ fontSize: FONT.sm, color: C.textMuted, fontWeight: 400 }}>de {fmtBRL(totalProjetado)}</span>
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: corProgresso(totalPct) }}>
              {totalPct}%
            </div>
          </div>
          {/* Barra total */}
          <div style={{ height: 8, background: 'var(--c-border)', borderRadius: RADIUS.full, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(totalPct, 100)}%`, background: corProgresso(totalPct), borderRadius: RADIUS.full, transition: 'width 0.4s ease' }} />
          </div>
        </Card>
      )}

      {linhas.length === 0 ? (
        <Empty
          icon={<TrendingUp size={40} color="#25D366" />}
          title="Sem metas definidas para este mês"
          sub={`Configure o orçamento de ${MESES_NOME[mesSel]} na página Orçamento para ver o acompanhamento aqui.`}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {linhas.map(l => {
            const pct = l.projetado > 0 ? Math.min((l.realizado / l.projetado) * 100, 100) : 0;
            const pctReal = l.projetado > 0 ? Math.round((l.realizado / l.projetado) * 100) : 0;
            const diferenca = l.projetado - l.realizado;
            const cor = corProgresso(pctReal);
            const estourou = l.realizado > l.projetado;

            return (
              <Card key={l.catId} padding="14px 18px">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome}</span>
                      {estourou && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: FONT.xs, color: '#EF4444', fontWeight: 700, flexShrink: 0 }}>
                          <AlertTriangle size={11} /> Estourou
                        </span>
                      )}
                      {!estourou && pctReal >= 80 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: FONT.xs, color: '#F59E0B', fontWeight: 700, flexShrink: 0 }}>
                          <AlertTriangle size={11} /> Quase no limite
                        </span>
                      )}
                      {!estourou && pctReal < 80 && l.realizado > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: FONT.xs, color: '#22C55E', fontWeight: 600, flexShrink: 0 }}>
                          <CheckCircle2 size={11} /> OK
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 2 }}>
                      Realizado: <strong style={{ color: cor }}>{fmtBRL(l.realizado)}</strong> de <strong>{fmtBRL(l.projetado)}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: FONT.base, fontWeight: 800, color: cor }}>{pctReal}%</div>
                    <div style={{ fontSize: FONT.xs, color: estourou ? C.desp : C.rec, fontWeight: 600 }}>
                      {estourou ? `+${fmtBRL(Math.abs(diferenca))} acima` : `${fmtBRL(diferenca)} restante`}
                    </div>
                  </div>
                </div>
                {/* Barra de progresso */}
                <div style={{ height: 7, background: 'var(--c-border)', borderRadius: RADIUS.full, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: RADIUS.full, transition: 'width 0.4s ease' }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Aba 3: Comparativo WhatsApp vs Oficial ────────────────────────────────────

function AbaComparativo({ txBot, txOficial, allCategorias }) {
  const mesesBot     = mesesDisponiveisDeBot(txBot);
  const mesesOficial = mesesDisponiveisDeBot(txOficial.filter(t => t.tipo === 'despesa'));
  const mesesUnion   = [...new Set([...mesesBot, ...mesesOficial])].sort((a, b) => b.localeCompare(a));

  const [mesSel, setMesSel] = useState(mesesUnion[0] ?? '');

  const botMes = useMemo(() =>
    txBot.filter(t => t.competencia === mesSel && t.tipo === 'despesa'),
    [txBot, mesSel]
  );
  const oficialMes = useMemo(() =>
    txOficial.filter(t => t.competencia === mesSel && t.tipo === 'despesa'),
    [txOficial, mesSel]
  );

  const gastoBot     = somarPorCategoria(botMes);
  const gastoOficial = somarPorCategoria(oficialMes);

  // União de todas as categorias que aparecem em qualquer um dos dois
  const todasCats = [...new Set([...Object.keys(gastoBot), ...Object.keys(gastoOficial)])];

  const linhas = todasCats.map(catId => {
    const wpp = gastoBot[catId] ?? 0;
    const oficial = gastoOficial[catId] ?? 0;
    const cobertura = oficial > 0 ? Math.round((wpp / oficial) * 100) : (wpp > 0 ? 999 : 0);
    return { catId, nome: nomeCat(catId, allCategorias), wpp, oficial, cobertura };
  }).sort((a, b) => b.oficial - a.oficial);

  const totalWpp     = linhas.reduce((s, l) => s + l.wpp, 0);
  const totalOficial = linhas.reduce((s, l) => s + l.oficial, 0);
  const coberturaGeral = totalOficial > 0 ? Math.round((totalWpp / totalOficial) * 100) : 0;

  const corCobertura = (pct) => {
    if (pct === 0) return C.textMuted;
    if (pct >= 90) return '#22C55E';
    if (pct >= 60) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div>
      {/* Seletor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <SeletorMes meses={mesesUnion} valor={mesSel} onChange={setMesSel} label="Período:" />

        {/* Legenda */}
        <div style={{ display: 'flex', gap: 16, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {[
            { color: '#25D366', label: 'WhatsApp (rascunho)' },
            { color: C.info,    label: 'Oficial (extrato)' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FONT.xs, color: C.textMuted }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* KPI cobertura geral */}
      {mesSel && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total via WhatsApp', value: fmtBRL(totalWpp),     color: '#25D366' },
            { label: 'Total Oficial',       value: fmtBRL(totalOficial), color: C.info },
            {
              label: 'Cobertura Geral',
              value: `${Math.min(coberturaGeral, 999)}%`,
              color: corCobertura(coberturaGeral),
              sub: coberturaGeral >= 100 ? 'Excelente rastreamento!' : coberturaGeral >= 60 ? 'Rastreamento parcial' : 'Baixo rastreamento',
            },
          ].map(({ label, value, color, sub }) => (
            <Card key={label} padding="14px 18px">
              <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: FONT.lg, fontWeight: 700, color }}>{value}</div>
              {sub && <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 3 }}>{sub}</div>}
            </Card>
          ))}
        </div>
      )}

      {/* Nota explicativa */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '10px 14px', borderRadius: RADIUS.md,
        background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.15)',
        marginBottom: 20, fontSize: FONT.xs, color: C.textMuted, lineHeight: 1.5,
      }}>
        <Info size={14} color={C.info} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong style={{ color: C.text }}>Como interpretar:</strong> "WhatsApp" são os gastos que o cliente registrou pelo bot (rascunhos comportamentais).
          "Oficial" são os lançamentos importados via extrato bancário pelo planejador.
          Cobertura alta = cliente está rastreando bem seus gastos no dia a dia.
        </span>
      </div>

      {/* Tabela */}
      {!mesSel ? (
        <Empty
          icon={<BarChart2 size={40} color="#25D366" />}
          title="Selecione um período"
          sub="Escolha o mês acima para ver o comparativo."
        />
      ) : linhas.length === 0 ? (
        <Empty
          icon={<BarChart2 size={40} color="#25D366" />}
          title="Nenhum dado para este período"
          sub="Sem lançamentos WhatsApp ou oficiais no período selecionado."
        />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONT.sm, fontFamily: FONT.family }}>
            <thead>
              <tr style={{ borderBottom: `2px solid var(--c-border)` }}>
                {['Categoria','Via WhatsApp','Oficial (Extrato)','Cobertura %','Barra'].map((h, i) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: i >= 1 ? 'right' : 'left', fontSize: FONT.xs, color: C.textMuted, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const cor = corCobertura(l.cobertura);
                const pctBarra = Math.min(l.cobertura, 100);
                return (
                  <tr key={l.catId}
                    style={{ borderBottom: `1px solid var(--c-border)` }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--c-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: C.text }}>{l.nome}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#25D366', fontWeight: 600 }}>
                      {l.wpp > 0 ? fmtBRL(l.wpp) : <span style={{ color: C.textMuted }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: C.info, fontWeight: 600 }}>
                      {l.oficial > 0 ? fmtBRL(l.oficial) : <span style={{ color: C.textMuted }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{ fontWeight: 800, color: cor, fontSize: FONT.base }}>
                        {l.cobertura >= 999 ? '∞' : `${l.cobertura}%`}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: 120 }}>
                      <div style={{ height: 6, background: 'var(--c-border)', borderRadius: RADIUS.full, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pctBarra}%`, background: cor, borderRadius: RADIUS.full, transition: 'width 0.4s' }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Linha de totais */}
            <tfoot>
              <tr style={{ borderTop: `2px solid var(--c-border)`, background: 'var(--c-card)' }}>
                <td style={{ padding: '10px 12px', fontWeight: 800, color: C.text }}>TOTAL</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#25D366' }}>{fmtBRL(totalWpp)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: C.info }}>{fmtBRL(totalOficial)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: corCobertura(coberturaGeral) }}>{coberturaGeral}%</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ height: 6, background: 'var(--c-border)', borderRadius: RADIUS.full, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(coberturaGeral, 100)}%`, background: corCobertura(coberturaGeral), borderRadius: RADIUS.full }} />
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PageFluxoWhatsapp() {
  const { clienteAtivo, setClienteAtivo, modoLeitura } = useApp();
  const [aba, setAba] = useState('lancamentos');
  const [mesFiltro, setMesFiltro] = useState('');
  const [modalEditar, setModalEditar] = useState(null); // transação sendo editada
  const [confirmDelete, setConfirmDelete] = useState(null); // id para confirmar exclusão

  if (!clienteAtivo) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--c-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Empty title="Nenhum cliente selecionado" sub="Selecione um cliente no Hub para acessar o Fluxo WhatsApp." />
      </div>
    );
  }

  const txBot          = clienteAtivo.transacoesBot   ?? [];
  const txOficial      = clienteAtivo.transacoes       ?? [];
  const allCats        = clienteAtivo.categorias       ?? [];
  const planej         = clienteAtivo.planejamento     ?? {};
  const anoAtivo       = clienteAtivo.anoAtivo         ?? new Date().getFullYear();
  const nucleoFamiliar = clienteAtivo.nucleoFamiliar   ?? [];
  const mesesDisp      = mesesDisponiveisDeBot(txBot);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleEditar = useCallback((t) => {
    if (modoLeitura) return;
    setModalEditar(t);
  }, [modoLeitura]);

  const handleSalvarEdicao = useCallback((tEditada) => {
    if (modoLeitura) return;
    const novaLista = txBot.map(t => t.id === tEditada.id ? { ...t, ...tEditada } : t);
    setClienteAtivo({ ...clienteAtivo, transacoesBot: novaLista });
    setModalEditar(null);
  }, [clienteAtivo, txBot, modoLeitura, setClienteAtivo]);

  const handleDeletar = useCallback((id) => {
    if (modoLeitura) return;
    setConfirmDelete(id);
  }, [modoLeitura]);

  const confirmarDelete = useCallback(() => {
    if (!confirmDelete) return;
    const novaLista = txBot.filter(t => t.id !== confirmDelete);
    setClienteAtivo({ ...clienteAtivo, transacoesBot: novaLista });
    setConfirmDelete(null);
  }, [clienteAtivo, txBot, confirmDelete, setClienteAtivo]);

  const handleExportar = useCallback(() => {
    const lista = mesFiltro ? txBot.filter(t => t.competencia === mesFiltro) : txBot;
    exportarBotCSV(lista, clienteAtivo.nome);
  }, [txBot, mesFiltro, clienteAtivo.nome]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--c-bg)',
      fontFamily: FONT.family,
      padding: '32px 32px 80px',
    }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>

        {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: RADIUS.md,
              background: 'rgba(37,211,102,0.15)',
              border: '1px solid rgba(37,211,102,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <MessageCircle size={22} color="#25D366" />
            </div>
            <div>
              <h1 style={{ fontSize: FONT.xl, fontWeight: 800, color: 'var(--c-text)', margin: 0, lineHeight: 1.2 }}>
                Fluxo WhatsApp
              </h1>
              <p style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', margin: '4px 0 0', lineHeight: 1.4 }}>
                Lançamentos enviados pelo cliente via bot · <strong style={{ color: '#25D366' }}>{txBot.length}</strong> registros
              </p>
            </div>
          </div>

          {/* Badge cliente */}
          <div style={{
            padding: '8px 16px', borderRadius: RADIUS.full,
            background: 'rgba(37,211,102,0.08)',
            border: '1px solid rgba(37,211,102,0.2)',
            fontSize: FONT.sm, color: '#25D366', fontWeight: 700,
          }}>
            {clienteAtivo.nome}
          </div>
        </div>

        {/* ── Abas ───────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <AbaTabs aba={aba} setAba={setAba} />
        </div>

        {/* ── Conteúdo ────────────────────────────────────────────────────────── */}
        <Card padding="24px">
          {aba === 'lancamentos' && (
            <AbaLancamentos
              txBot={txBot}
              allCategorias={allCats}
              mesFiltro={mesFiltro}
              setMesFiltro={setMesFiltro}
              mesesDisp={mesesDisp}
              onEditar={handleEditar}
              onDeletar={handleDeletar}
              onExportar={handleExportar}
            />
          )}
          {aba === 'metas' && (
            <AbaMetas
              txBot={txBot}
              planejamento={planej}
              allCategorias={allCats}
              anoAtivo={anoAtivo}
            />
          )}
          {aba === 'comparativo' && (
            <AbaComparativo
              txBot={txBot}
              txOficial={txOficial}
              allCategorias={allCats}
            />
          )}
        </Card>
      </div>

      {/* ── Modal de edição ──────────────────────────────────────────────────── */}
      {modalEditar && (
        <ModalEditarBot
          t={modalEditar}
          allCategorias={allCats}
          nucleoFamiliar={nucleoFamiliar}
          onSave={handleSalvarEdicao}
          onClose={() => setModalEditar(null)}
        />
      )}

      {/* ── Confirm delete ────────────────────────────────────────────────────── */}
      {confirmDelete && (
        <Modal open title="Excluir lançamento" onClose={() => setConfirmDelete(null)} width="400px">
          <p style={{ color: C.textMuted, fontSize: FONT.sm, lineHeight: 1.6, margin: 0 }}>
            Tem certeza que deseja excluir este lançamento do WhatsApp? Esta ação não pode ser desfeita.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={confirmarDelete}>Excluir</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
