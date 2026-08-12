/**
 * useExport.js — Hook de exportação de transações (CSV, XLSX, PDF)
 *
 * Extraído de PageCategorizador.jsx (Fase 2 — Strangler Fig)
 *
 * Deps externas: xlsx, jspdf, jspdf-autotable
 * Recebe: { transacoes, categorias completas, nomeCliente }
 * Retorna: { exportarCSV, exportarXLSX, exportarPDF, mesesCompetenciaDisponiveis }
 */
import { useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function useExport({ transacoes, _categorias, nomeCliente }) {
  // Map id→cat COMPLETO (inclui intermediárias)
  const catPorIdCompleto = useMemo(() => {
    const m = new Map();
    for (const c of _categorias) m.set(c.id, c);
    return m;
  }, [_categorias]);

  // ── Helpers internos ───────────────────────────────────────────────────

  /** Resolve mês de competência de uma transação → "YYYY-MM" */
  function competenciaDe(t) {
    if (t.competencia) return t.competencia.slice(0, 7);
    if (t.periodoLabel) {
      const mesesAbrev = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      const [nomMes, ano] = t.periodoLabel.split('/');
      const idxMes = mesesAbrev.indexOf((nomMes || '').toLowerCase());
      if (idxMes >= 0 && ano) return `${ano}-${String(idxMes + 1).padStart(2, '0')}`;
    }
    if (t.data) return t.data.slice(0, 7);
    return null;
  }

  /** Resolve nome da categoria e subcategoria a partir de t.categoria (id de subcat) */
  function resolverNomesCat(t) {
    const subcat = catPorIdCompleto.get(t.categoria);
    const subcatNome = subcat?.nome || '';
    const catIntermId = subcat?.categoria;
    const catInterm = catIntermId ? catPorIdCompleto.get(catIntermId) : null;
    const catNome = catInterm?.nome || subcat?.grupo || '';
    return { catNome, subcatNome };
  }

  /** Formata data ISO "YYYY-MM-DD" → "DD/MM/YYYY"  (ou "YYYY-MM" → "MM/YYYY") */
  function formatarData(iso) {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 2) return `${parts[1]}/${parts[0]}`;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }

  /** Filtra transações pelo intervalo de competência inicio..fim ("YYYY-MM") + conta opcional */
  function filtrarPorIntervalo(inicio, fim, contasSel = new Set()) {
    return transacoes.filter(t => {
      const comp = competenciaDe(t);
      if (!comp) return false;
      if (comp < inicio || comp > fim) return false;
      if (contasSel && contasSel.size > 0 && !contasSel.has(t.conta || '')) return false;
      return true;
    });
  }

  // ── Meses de competência disponíveis (para seletor de range) ───────────
  const mesesCompetenciaDisponiveis = useMemo(() => {
    const set = new Set();
    for (const t of transacoes) {
      const m = competenciaDe(t);
      if (m) set.add(m);
    }
    return [...set].sort();
  }, [transacoes]);

  // ── Exportar CSV ────────────────────────────────────────────────────────
  function exportarCSV(inicio, fim, contasSel = new Set()) {
    const lista = filtrarPorIntervalo(inicio, fim, contasSel);
    const header = 'Data,Descrição,Valor,Tipo,Categoria,Subcategoria,Conta,Parcela Atual,Parcela Total\n';
    const linhas = lista.map(t => {
      const { catNome, subcatNome } = resolverNomesCat(t);
      return [
        t.data,
        `"${(t.descricao||'').replace(/"/g, '""')}"`,
        t.valor.toFixed(2),
        t.tipo || '',
        `"${catNome.replace(/"/g,'""')}"`,
        `"${subcatNome.replace(/"/g,'""')}"`,
        `"${(t.conta||'').replace(/"/g,'""')}"`,
        t.parcelaAtual || '',
        t.parcelaTotal || '',
      ].join(',');
    }).join('\n');
    const blob = new Blob(['\uFEFF' + header + linhas], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `b2if_${nomeCliente.replace(/\s/g,'_')}_transacoes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Exportar XLSX Padrão MD ─────────────────────────────────────────────
  // Template: B=Data(dd/mm/yyyy), C=Valor(num), D=Descrição, E=Conta,
  //           H=Categoria, I=Subcategoria, P=Data Competência(dd/mm/yyyy)
  async function exportarXLSX(inicio, fim, contasSel = new Set()) {
    const lista = filtrarPorIntervalo(inicio, fim, contasSel);
    let wb;
    try {
      const resp = await fetch('/modelo-xls-meudinheiro.xls');
      const buf  = await resp.arrayBuffer();
      wb = XLSX.read(buf, { type: 'array', cellStyles: true });
    } catch {
      wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['','Data','Valor','Descrição','Conta','','','Categoria','Subcategoria','','','','','','','Data Competência','Tags']
      ]), 'Lançamentos');
    }

    const sheetName = wb.SheetNames[0];
    const ws        = wb.Sheets[sheetName];
    const startRow  = 1;

    lista.forEach((t, i) => {
      const row = startRow + i;
      const { catNome, subcatNome } = resolverNomesCat(t);
      const dataFmt  = formatarData(t.data);
      const compFmt  = t.competencia
        ? formatarData(t.competencia.length === 7 ? t.competencia + '-01' : t.competencia)
        : dataFmt;
      const valor    = Number(t.valor);

      const setCel = (col, v, tp) => {
        const addr = XLSX.utils.encode_cell({ r: row, c: col });
        ws[addr] = { v, t: tp };
      };
      setCel(1,  dataFmt,         's');
      setCel(2,  valor,           'n');
      setCel(3,  t.descricao||'', 's');
      setCel(4,  t.conta||'',     's');
      setCel(7,  catNome,         's');
      setCel(8,  subcatNome,      's');
      setCel(15, compFmt,         's');
    });

    const endRow = startRow + lista.length - 1;
    ws['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: endRow, c: 16 });

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob  = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = `b2if_${nomeCliente.replace(/\s/g,'_')}_padrao_md.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Exportar PDF ────────────────────────────────────────────────────────
  function exportarPDF(inicio, fim, contasSel = new Set()) {
    const lista = filtrarPorIntervalo(inicio, fim, contasSel);
    const doc   = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    doc.setFontSize(13);
    doc.text(`Transações — ${nomeCliente}`, 40, 36);
    doc.setFontSize(9);
    doc.text(`Período: ${formatarData(inicio)} a ${formatarData(fim)}  |  ${lista.length} lançamentos`, 40, 52);

    const rows = lista.map(t => {
      const { catNome, subcatNome } = resolverNomesCat(t);
      const v    = t.valor;
      const vFmt = (v >= 0 ? '' : '-') + 'R$ ' +
        Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return [formatarData(t.data), t.descricao || '', vFmt, t.conta || '', catNome, subcatNome];
    });

    autoTable(doc, {
      startY: 64,
      head: [['Data', 'Descrição', 'Valor', 'Conta', 'Categoria', 'Subcategoria']],
      body: rows,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 72, halign: 'right' },
        3: { cellWidth: 80 },
        4: { cellWidth: 90 },
        5: { cellWidth: 90 },
      },
    });

    doc.save(`b2if_${nomeCliente.replace(/\s/g,'_')}_transacoes.pdf`);
  }

  return {
    exportarCSV,
    exportarXLSX,
    exportarPDF,
    mesesCompetenciaDisponiveis,
  };
}
