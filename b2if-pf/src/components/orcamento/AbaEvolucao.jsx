/**
 * AbaEvolucao.jsx — Tabela de evolução temporal do orçamento
 *
 * Hierarquia 3 níveis: Macro (Grupo) → Categoria (nível 2) → Subcategoria
 * Cada nível Macro exibe sublinhas: Meta e Realizado
 * Colunas: Nome | [meses dinâmicos] | Média | Total
 * Colunas NÃO fixas — usuário rola horizontalmente
 *
 * Controles:
 *   - Intervalo: Mensal / Trimestral / Semestral / Anual
 *   - Mês início
 *   - Período (1–12 meses)
 *   - Botão "Carregar"
 *
 * Export: Excel/CSV e PDF (portrait, com cabeçalho: nome do cliente + período)
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, Download, FileText } from 'lucide-react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { fmtBRL, Btn, Empty } from '../UI.jsx';
import { GRUPOS, CATEGORIAS_PADRAO, MESES, MESES_FULL } from '../../data/categorias.js';

// ── Configuração de grupos para tabela ────────────────────────────────────────
const GRUPOS_EVOLUCAO = [
  { id: GRUPOS.RECEITAS,      label: 'Receitas',         cor: '#22D3A0' },
  { id: GRUPOS.FIXAS,         label: 'Despesas Essenciais', cor: '#F87171' },
  { id: GRUPOS.CONSUMO,       label: 'Consumo Mensal',   cor: '#FBBF24' },
  { id: GRUPOS.DIVIDAS,       label: 'Dívidas',          cor: '#C084FC' },
  { id: GRUPOS.INVESTIMENTOS, label: 'Investimentos',    cor: '#60A5FA' },
];

// ── Helper: gerar lista de colunas (meses) ────────────────────────────────────
function gerarColunas(mesInicio, anoInicio, periodo, intervalo) {
  const cols = [];
  let m = mesInicio;
  let a = anoInicio;
  const step = intervalo === 'Trimestral' ? 3 : intervalo === 'Semestral' ? 6 : intervalo === 'Anual' ? 12 : 1;

  for (let i = 0; i < periodo; i++) {
    cols.push({ mes: m, ano: a, label: `${MESES[m]}/${String(a).slice(2)}` });
    m += step;
    while (m >= 12) { m -= 12; a += 1; }
  }
  return cols;
}

// ── Helper: busca valor realizado de um conjunto de subcategorias ─────────────
function somarRealizado(subcatIds, realizadoPorMesAno, mes, ano) {
  const anoStr = String(ano);
  const r = realizadoPorMesAno?.[anoStr]?.[mes] || {};
  return subcatIds.reduce((acc, id) => acc + (r[id] || 0), 0);
}

// ── Helper: busca meta de um conjunto de subcategorias ───────────────────────
function somarMeta(subcatIds, planejamento, mes, ano) {
  const anoStr = String(ano);
  const planMes = planejamento?.[anoStr]?.[mes] || {};
  return subcatIds.reduce((acc, id) => acc + (planMes[id]?.projetado || 0), 0);
}

// ── Célula de valor ───────────────────────────────────────────────────────────
function Celula({ valor, isMeta, dim }) {
  const color = dim
    ? 'var(--c-text-dim)'
    : isMeta
      ? 'var(--c-text-muted)'
      : valor > 0 ? 'var(--c-text)' : 'var(--c-text-dim)';
  return (
    <td style={{
      padding: '5px 10px',
      textAlign: 'right',
      fontSize: FONT.xs,
      fontWeight: dim ? 400 : isMeta ? 500 : 600,
      color,
      whiteSpace: 'nowrap',
      borderRight: '1px solid var(--c-border)',
    }}>
      {valor > 0 ? fmtBRL(valor) : '—'}
    </td>
  );
}

// ── Linha de subcategoria ─────────────────────────────────────────────────────
function LinhaSubcatEvol({ sub, colunas, planejamento, realizadoPorMesAno }) {
  const vals = colunas.map(col => ({
    meta:      somarMeta([sub.id], planejamento, col.mes, col.ano),
    realizado: somarRealizado([sub.id], realizadoPorMesAno, col.mes, col.ano),
  }));

  const totalMeta = vals.reduce((a, v) => a + v.meta, 0);
  const totalReal = vals.reduce((a, v) => a + v.realizado, 0);
  const mediaMeta = colunas.length > 0 ? totalMeta / colunas.length : 0;
  const mediaReal = colunas.length > 0 ? totalReal / colunas.length : 0;

  const temDados = totalMeta > 0 || totalReal > 0;
  if (!temDados) return null;

  return (
    <>
      {/* Meta */}
      <tr style={{ background: 'var(--c-bg)' }}>
        <td style={{
          padding: '4px 8px 4px 48px',
          fontSize: FONT.xs,
          color: 'var(--c-text-muted)',
          whiteSpace: 'nowrap',
          borderRight: '1px solid var(--c-border)',
          fontStyle: 'italic',
        }}>
          {sub.nome} — Meta
        </td>
        {vals.map((v, i) => <Celula key={i} valor={v.meta} isMeta dim={v.meta === 0} />)}
        <Celula valor={mediaMeta} isMeta />
        <Celula valor={totalMeta} isMeta />
      </tr>
      {/* Realizado */}
      <tr style={{ background: 'var(--c-bg)' }}>
        <td style={{
          padding: '4px 8px 4px 48px',
          fontSize: FONT.xs,
          color: 'var(--c-text-dim)',
          whiteSpace: 'nowrap',
          borderRight: '1px solid var(--c-border)',
          fontStyle: 'italic',
        }}>
          {sub.nome} — Realizado
        </td>
        {vals.map((v, i) => <Celula key={i} valor={v.realizado} dim={v.realizado === 0} />)}
        <Celula valor={mediaReal} />
        <Celula valor={totalReal} />
      </tr>
    </>
  );
}

// ── Linha de categoria nível 2 ────────────────────────────────────────────────
function LinhaCategoria2Evol({ cat, subcats, colunas, planejamento, realizadoPorMesAno, expandida, onToggle }) {
  const colTotais = colunas.map(col => {
    const ids = subcats.map(s => s.id);
    return {
      meta:      somarMeta(ids, planejamento, col.mes, col.ano),
      realizado: somarRealizado(ids, realizadoPorMesAno, col.mes, col.ano),
    };
  });

  const totalMeta = colTotais.reduce((a, v) => a + v.meta, 0);
  const totalReal = colTotais.reduce((a, v) => a + v.realizado, 0);
  const mediaMeta = colunas.length > 0 ? totalMeta / colunas.length : 0;
  const mediaReal = colunas.length > 0 ? totalReal / colunas.length : 0;

  const temDados = totalMeta > 0 || totalReal > 0;
  if (!temDados) return null;

  return (
    <>
      {/* Meta da categoria */}
      <tr
        onClick={onToggle}
        style={{ background: 'var(--c-bg-mid)', cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-card-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--c-bg-mid)'}
      >
        <td style={{
          padding: '6px 8px 6px 24px',
          fontSize: FONT.sm,
          fontWeight: 600,
          color: 'var(--c-text)',
          whiteSpace: 'nowrap',
          borderRight: '1px solid var(--c-border)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {expandida ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {cat.nome} — Meta
          </span>
        </td>
        {colTotais.map((v, i) => <Celula key={i} valor={v.meta} isMeta dim={v.meta === 0} />)}
        <Celula valor={mediaMeta} isMeta />
        <Celula valor={totalMeta} isMeta />
      </tr>
      {/* Realizado da categoria */}
      <tr
        onClick={onToggle}
        style={{ background: 'var(--c-bg-mid)', cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-card-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--c-bg-mid)'}
      >
        <td style={{
          padding: '6px 8px 6px 24px',
          fontSize: FONT.sm,
          color: 'var(--c-text-muted)',
          whiteSpace: 'nowrap',
          borderRight: '1px solid var(--c-border)',
        }}>
          <span style={{ paddingLeft: 18 }}>{cat.nome} — Realizado</span>
        </td>
        {colTotais.map((v, i) => <Celula key={i} valor={v.realizado} dim={v.realizado === 0} />)}
        <Celula valor={mediaReal} />
        <Celula valor={totalReal} />
      </tr>

      {/* Subcategorias */}
      {expandida && subcats.map(sub => (
        <LinhaSubcatEvol
          key={sub.id}
          sub={sub}
          colunas={colunas}
          planejamento={planejamento}
          realizadoPorMesAno={realizadoPorMesAno}
        />
      ))}
    </>
  );
}

// ── Linha de grupo (Macro) ────────────────────────────────────────────────────
function LinhaGrupo({ grupo, catsNivel2, subcatsPorCat, colunas, planejamento, realizadoPorMesAno, expandido, onToggle, cor }) {
  const [expandidasCat, setExpandidasCat] = useState(new Set());

  const colTotais = colunas.map(col => {
    let meta = 0, realizado = 0;
    for (const cat of catsNivel2) {
      for (const sub of subcatsPorCat[cat.id] || []) {
        meta      += somarMeta([sub.id], planejamento, col.mes, col.ano);
        realizado += somarRealizado([sub.id], realizadoPorMesAno, col.mes, col.ano);
      }
    }
    return { meta, realizado };
  });

  const totalMeta = colTotais.reduce((a, v) => a + v.meta, 0);
  const totalReal = colTotais.reduce((a, v) => a + v.realizado, 0);
  const mediaMeta = colunas.length > 0 ? totalMeta / colunas.length : 0;
  const mediaReal = colunas.length > 0 ? totalReal / colunas.length : 0;

  const temDados = totalMeta > 0 || totalReal > 0;

  const toggleCat = (id) => {
    setExpandidasCat(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* Cabeçalho do grupo */}
      <tr onClick={onToggle} style={{ cursor: 'pointer', background: 'var(--c-card)' }}>
        <td style={{
          padding: '9px 8px 9px 12px',
          fontSize: FONT.base,
          fontWeight: 800,
          color: cor,
          whiteSpace: 'nowrap',
          borderRight: '1px solid var(--c-border)',
          borderTop: '2px solid var(--c-border-light)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {grupo.label}
          </span>
        </td>
        {colTotais.map((v, i) => (
          <td key={i} style={{
            padding: '9px 10px',
            textAlign: 'right',
            fontSize: FONT.sm,
            fontWeight: 700,
            color: cor,
            whiteSpace: 'nowrap',
            borderRight: '1px solid var(--c-border)',
            borderTop: '2px solid var(--c-border-light)',
          }}>
            {v.meta > 0 || v.realizado > 0 ? (
              <div>
                <div style={{ color: 'var(--c-text-muted)', fontSize: FONT.xs, fontWeight: 500 }}>
                  {v.meta > 0 ? fmtBRL(v.meta) : '—'}
                </div>
                <div style={{ color: cor }}>
                  {v.realizado > 0 ? fmtBRL(v.realizado) : '—'}
                </div>
              </div>
            ) : (
              <span style={{ color: 'var(--c-text-dim)' }}>—</span>
            )}
          </td>
        ))}
        {/* Média */}
        <td style={{
          padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap',
          borderRight: '1px solid var(--c-border)',
          borderTop: '2px solid var(--c-border-light)',
        }}>
          {(mediaMeta > 0 || mediaReal > 0) && (
            <div>
              <div style={{ color: 'var(--c-text-muted)', fontSize: FONT.xs, fontWeight: 500 }}>{fmtBRL(mediaMeta)}</div>
              <div style={{ color: cor, fontSize: FONT.sm, fontWeight: 700 }}>{fmtBRL(mediaReal)}</div>
            </div>
          )}
        </td>
        {/* Total */}
        <td style={{
          padding: '9px 10px', textAlign: 'right', whiteSpace: 'nowrap',
          borderTop: '2px solid var(--c-border-light)',
        }}>
          {(totalMeta > 0 || totalReal > 0) && (
            <div>
              <div style={{ color: 'var(--c-text-muted)', fontSize: FONT.xs, fontWeight: 500 }}>{fmtBRL(totalMeta)}</div>
              <div style={{ color: cor, fontSize: FONT.sm, fontWeight: 700 }}>{fmtBRL(totalReal)}</div>
            </div>
          )}
        </td>
      </tr>

      {/* Categorias filhas */}
      {expandido && catsNivel2.map(cat => (
        <LinhaCategoria2Evol
          key={cat.id}
          cat={cat}
          subcats={subcatsPorCat[cat.id] || []}
          colunas={colunas}
          planejamento={planejamento}
          realizadoPorMesAno={realizadoPorMesAno}
          expandida={expandidasCat.has(cat.id)}
          onToggle={() => toggleCat(cat.id)}
        />
      ))}
    </>
  );
}

// ── Exportar CSV ──────────────────────────────────────────────────────────────
function exportCSV(colunas, grupos, catsNivel2PorGrupo, subcatsPorCat, planejamento, realizadoPorMesAno, clienteNome, periodoLabel) {
  const rows = [];
  // Cabeçalho
  rows.push([`Cliente: ${clienteNome}`, `Período: ${periodoLabel}`]);
  rows.push([]);
  const headerRow = ['Nível', 'Nome', 'Tipo', ...colunas.map(c => c.label), 'Média', 'Total'];
  rows.push(headerRow);

  for (const grupo of grupos) {
    const cats = catsNivel2PorGrupo[grupo.id] || [];
    // Linha do grupo
    const gmeta = colunas.map(c => {
      let v = 0;
      for (const cat of cats) for (const sub of subcatsPorCat[cat.id] || []) v += somarMeta([sub.id], planejamento, c.mes, c.ano);
      return v;
    });
    const greal = colunas.map(c => {
      let v = 0;
      for (const cat of cats) for (const sub of subcatsPorCat[cat.id] || []) v += somarRealizado([sub.id], realizadoPorMesAno, c.mes, c.ano);
      return v;
    });
    const gmTot = gmeta.reduce((a, b) => a + b, 0);
    const grTot = greal.reduce((a, b) => a + b, 0);

    rows.push(['Grupo', grupo.label, 'Meta', ...gmeta.map(v => v.toFixed(2)), (gmTot / colunas.length).toFixed(2), gmTot.toFixed(2)]);
    rows.push(['Grupo', grupo.label, 'Realizado', ...greal.map(v => v.toFixed(2)), (grTot / colunas.length).toFixed(2), grTot.toFixed(2)]);

    for (const cat of cats) {
      const subs = subcatsPorCat[cat.id] || [];
      const ids = subs.map(s => s.id);
      const cmeta = colunas.map(c => somarMeta(ids, planejamento, c.mes, c.ano));
      const creal = colunas.map(c => somarRealizado(ids, realizadoPorMesAno, c.mes, c.ano));
      const cmTot = cmeta.reduce((a, b) => a + b, 0);
      const crTot = creal.reduce((a, b) => a + b, 0);

      rows.push(['Categoria', cat.nome, 'Meta', ...cmeta.map(v => v.toFixed(2)), (cmTot / colunas.length).toFixed(2), cmTot.toFixed(2)]);
      rows.push(['Categoria', cat.nome, 'Realizado', ...creal.map(v => v.toFixed(2)), (crTot / colunas.length).toFixed(2), crTot.toFixed(2)]);

      for (const sub of subs) {
        const smeta = colunas.map(c => somarMeta([sub.id], planejamento, c.mes, c.ano));
        const sreal = colunas.map(c => somarRealizado([sub.id], realizadoPorMesAno, c.mes, c.ano));
        const smTot = smeta.reduce((a, b) => a + b, 0);
        const srTot = sreal.reduce((a, b) => a + b, 0);
        if (smTot === 0 && srTot === 0) continue;
        rows.push(['Subcat.', sub.nome, 'Meta', ...smeta.map(v => v.toFixed(2)), (smTot / colunas.length).toFixed(2), smTot.toFixed(2)]);
        rows.push(['Subcat.', sub.nome, 'Realizado', ...sreal.map(v => v.toFixed(2)), (srTot / colunas.length).toFixed(2), srTot.toFixed(2)]);
      }
    }
  }

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `evolucao_${clienteNome}_${periodoLabel.replace(/\s/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Exportar PDF ──────────────────────────────────────────────────────────────
async function exportPDF(colunas, grupos, catsNivel2PorGrupo, subcatsPorCat, planejamento, realizadoPorMesAno, clienteNome, periodoLabel) {
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Cabeçalho
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Evolução Orçamentária', pageW / 2, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Cliente: ${clienteNome}`, 14, 22);
  doc.text(`Período: ${periodoLabel}`, 14, 28);

  // Tabela
  const head = [['Nível', 'Nome', 'Tipo', ...colunas.map(c => c.label), 'Média', 'Total']];
  const body = [];

  for (const grupo of grupos) {
    const cats = catsNivel2PorGrupo[grupo.id] || [];
    const gmeta = colunas.map(c => {
      let v = 0;
      for (const cat of cats) for (const sub of subcatsPorCat[cat.id] || []) v += somarMeta([sub.id], planejamento, c.mes, c.ano);
      return v;
    });
    const greal = colunas.map(c => {
      let v = 0;
      for (const cat of cats) for (const sub of subcatsPorCat[cat.id] || []) v += somarRealizado([sub.id], realizadoPorMesAno, c.mes, c.ano);
      return v;
    });
    const gmTot = gmeta.reduce((a, b) => a + b, 0);
    const grTot = greal.reduce((a, b) => a + b, 0);
    const fmt = v => v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—';

    body.push([grupo.label, '', 'Meta', ...gmeta.map(fmt), fmt(gmTot / colunas.length), fmt(gmTot)]);
    body.push([grupo.label, '', 'Realizado', ...greal.map(fmt), fmt(grTot / colunas.length), fmt(grTot)]);

    for (const cat of cats) {
      const subs = subcatsPorCat[cat.id] || [];
      const ids = subs.map(s => s.id);
      const cmeta = colunas.map(c => somarMeta(ids, planejamento, c.mes, c.ano));
      const creal = colunas.map(c => somarRealizado(ids, realizadoPorMesAno, c.mes, c.ano));
      const cmTot = cmeta.reduce((a, b) => a + b, 0);
      const crTot = creal.reduce((a, b) => a + b, 0);

      body.push(['', cat.nome, 'Meta', ...cmeta.map(fmt), fmt(cmTot / colunas.length), fmt(cmTot)]);
      body.push(['', cat.nome, 'Realizado', ...creal.map(fmt), fmt(crTot / colunas.length), fmt(crTot)]);
    }
  }

  autoTable(doc, {
    head,
    body,
    startY: 34,
    styles: { fontSize: 6, cellPadding: 1.5, halign: 'right' },
    headStyles: { fillColor: [22, 27, 39], textColor: [232, 237, 245], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 20 },
      1: { halign: 'left', cellWidth: 28 },
      2: { halign: 'center', cellWidth: 14 },
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`evolucao_${clienteNome}_${periodoLabel.replace(/\s/g, '_')}.pdf`);
}

// ── Componente principal ───────────────────────────────────────────────────────
export function AbaEvolucao({
  planejamento,
  realizadoPorAnoMes: realizadoPorMesAno,    // { [anoStr]: { [mes]: { [catId]: valor } } }
  categorias,
  clienteNome,
}) {
  // Controles
  const [intervalo, setIntervalo] = useState('Mensal');
  const [mesInicio, setMesInicio] = useState(new Date().getMonth());
  const [anoInicio, setAnoInicio] = useState(new Date().getFullYear());
  const [periodo, setPeriodo]     = useState(6);
  const [carregado, setCarregado] = useState(false);

  // Grupos expandidos
  const [expandidos, setExpandidos] = useState(new Set(GRUPOS_EVOLUCAO.map(g => g.id)));

  const colunas = useMemo(() =>
    carregado ? gerarColunas(mesInicio, anoInicio, periodo, intervalo) : [],
    [carregado, mesInicio, anoInicio, periodo, intervalo]
  );

  const cats = categorias || CATEGORIAS_PADRAO;

  const catsNivel2PorGrupo = useMemo(() => {
    const map = {};
    for (const g of GRUPOS_EVOLUCAO) {
      map[g.id] = cats.filter(c => c.isCategoria === true && c.grupo === g.id && !c.oculto);
    }
    return map;
  }, [cats]);

  const subcatsPorCat = useMemo(() => {
    const map = {};
    for (const g of GRUPOS_EVOLUCAO) {
      for (const cat of catsNivel2PorGrupo[g.id]) {
        map[cat.id] = cats.filter(s => !s.isCategoria && s.grupo === g.id && !s.oculto && s.categoria === cat.id);
      }
    }
    return map;
  }, [cats, catsNivel2PorGrupo]);

  const periodoLabel = useMemo(() => {
    if (colunas.length === 0) return '';
    const first = colunas[0];
    const last  = colunas[colunas.length - 1];
    return `${MESES_FULL[first.mes]}/${first.ano} – ${MESES_FULL[last.mes]}/${last.ano}`;
  }, [colunas]);

  const toggleGrupo = (id) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const anoAtualSistema = new Date().getFullYear();
  const anos = [];
  for (let a = anoAtualSistema - 3; a <= anoAtualSistema + 2; a++) anos.push(a);

  const handleExportCSV = () => {
    exportCSV(colunas, GRUPOS_EVOLUCAO, catsNivel2PorGrupo, subcatsPorCat, planejamento, realizadoPorMesAno, clienteNome || 'Cliente', periodoLabel);
  };

  const handleExportPDF = () => {
    exportPDF(colunas, GRUPOS_EVOLUCAO, catsNivel2PorGrupo, subcatsPorCat, planejamento, realizadoPorMesAno, clienteNome || 'Cliente', periodoLabel);
  };

  return (
    <div>
      {/* Controles */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap',
        padding: '16px',
        background: 'var(--c-bg-mid)',
        borderBottom: '1px solid var(--c-border)',
      }}>
        {/* Intervalo */}
        <div>
          <label style={{ fontSize: FONT.xs, color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
            Intervalo
          </label>
          <select
            value={intervalo}
            onChange={e => setIntervalo(e.target.value)}
            style={{
              background: 'var(--c-bg)', border: '1px solid var(--c-border)',
              borderRadius: RADIUS.md, padding: '8px 12px', color: 'var(--c-text)',
              fontSize: FONT.sm, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
            }}
          >
            {['Mensal','Trimestral','Semestral','Anual'].map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {/* Mês início */}
        <div>
          <label style={{ fontSize: FONT.xs, color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
            Mês início
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={mesInicio}
              onChange={e => setMesInicio(Number(e.target.value))}
              style={{
                background: 'var(--c-bg)', border: '1px solid var(--c-border)',
                borderRadius: RADIUS.md, padding: '8px 12px', color: 'var(--c-text)',
                fontSize: FONT.sm, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
              }}
            >
              {MESES_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select
              value={anoInicio}
              onChange={e => setAnoInicio(Number(e.target.value))}
              style={{
                background: 'var(--c-bg)', border: '1px solid var(--c-border)',
                borderRadius: RADIUS.md, padding: '8px 12px', color: 'var(--c-text)',
                fontSize: FONT.sm, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
              }}
            >
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Período */}
        <div>
          <label style={{ fontSize: FONT.xs, color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
            Período ({periodo} {periodo === 1 ? 'coluna' : 'colunas'})
          </label>
          <input
            type="range"
            min={1} max={12}
            value={periodo}
            onChange={e => setPeriodo(Number(e.target.value))}
            style={{ width: 140, cursor: 'pointer', accentColor: 'var(--c-brand, #00B8A9)' }}
          />
        </div>

        {/* Botão Carregar */}
        <Btn
          onClick={() => setCarregado(true)}
          variant="primary"
          size="sm"
        >
          Carregar
        </Btn>

        {/* Export (só quando carregado) */}
        {carregado && colunas.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Btn onClick={handleExportCSV} variant="ghost" size="sm" icon={<Download size={14} />}>
              CSV
            </Btn>
            <Btn onClick={handleExportPDF} variant="ghost" size="sm" icon={<FileText size={14} />}>
              PDF
            </Btn>
          </div>
        )}
      </div>

      {/* Tabela */}
      {!carregado ? (
        <div style={{ padding: 40 }}>
          <Empty title="Configure e carregue" sub="Selecione o intervalo, mês de início e período, depois clique em Carregar." />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            minWidth: `${200 + colunas.length * 110 + 220}px`,
          }}>
            <thead>
              <tr style={{ background: 'var(--c-bg-mid)', position: 'sticky', top: 0, zIndex: 3 }}>
                <th style={{
                  padding: '8px 12px', textAlign: 'left',
                  fontSize: FONT.xs, fontWeight: 700, color: 'var(--c-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  borderRight: '1px solid var(--c-border)',
                  minWidth: 200, whiteSpace: 'nowrap',
                }}>
                  Categoria
                </th>
                {colunas.map((col, i) => (
                  <th key={i} style={{
                    padding: '8px 10px', textAlign: 'center',
                    fontSize: FONT.xs, fontWeight: 700, color: 'var(--c-text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    borderRight: '1px solid var(--c-border)',
                    minWidth: 100, whiteSpace: 'nowrap',
                  }}>
                    {col.label}
                  </th>
                ))}
                <th style={{
                  padding: '8px 10px', textAlign: 'right',
                  fontSize: FONT.xs, fontWeight: 700, color: 'var(--c-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  borderRight: '1px solid var(--c-border)',
                  minWidth: 100, whiteSpace: 'nowrap',
                }}>
                  Média
                </th>
                <th style={{
                  padding: '8px 10px', textAlign: 'right',
                  fontSize: FONT.xs, fontWeight: 700, color: 'var(--c-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  minWidth: 100, whiteSpace: 'nowrap',
                }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {GRUPOS_EVOLUCAO.map(grupo => (
                <LinhaGrupo
                  key={grupo.id}
                  grupo={grupo}
                  catsNivel2={catsNivel2PorGrupo[grupo.id] || []}
                  subcatsPorCat={subcatsPorCat}
                  colunas={colunas}
                  planejamento={planejamento}
                  realizadoPorMesAno={realizadoPorMesAno}
                  expandido={expandidos.has(grupo.id)}
                  onToggle={() => toggleGrupo(grupo.id)}
                  cor={grupo.cor}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
