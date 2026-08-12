/**
 * gerarPDFProjecao.js
 * Gera o PDF de Projeção Orçamentária para o cliente levar para casa,
 * revisar com a família e trazer os ajustes na próxima sessão.
 *
 * Paleta: Azul escuro #062836 | Ciano #329193 | Branco #ffffff
 *
 * IMPORTANTE: jsPDF com a fonte Helvetica built-in NÃO suporta emojis Unicode
 * nem muitos caracteres especiais. Todo o texto usa apenas ASCII/Latin-1.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GRUPOS, MESES_FULL } from '../data/categorias.js';
import { APP_NAME, LOGO_URL } from '../lib/appConfig.js';

// ── Paleta de cores ──────────────────────────────────────────────────────────
const COR = {
  azul:        [6,   40,  54],
  ciano:       [50, 145, 147],
  cianoCl:     [80, 175, 177],
  cianoFundo:  [229, 245, 245],
  branco:      [255, 255, 255],
  cinzaClaro:  [240, 244, 247],
  cinzaMedio:  [180, 196, 206],
  cinzaTexto:  [90,  110, 125],
  preto:       [15,  25,  35],
  vermelho:    [180,  40,  40],
  vermelhoBg:  [255, 230, 230],
  alertaBg:    [255, 243, 230],
  alertaBorda: [200, 100,  20],
  alertaTexto: [100,  50,   0],
  okBg:        [219, 240, 240],
  okTexto:     [6,   40,  54],
};

const GRUPO_SHADE = {
  [GRUPOS.RECEITAS]:      [6,  40,  54],
  [GRUPOS.FIXAS]:         [8,  60,  80],
  [GRUPOS.CONSUMO]:       [12, 75,  95],
  [GRUPOS.DIVIDAS]:       [16, 90, 110],
  [GRUPOS.INVESTIMENTOS]: [20,110, 130],
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtBRL(v) {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function carregarLogo() {
  try {
    const resp = await fetch(LOGO_URL);
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function dimensoesImagem(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = base64;
  });
}

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export async function gerarPDFProjecao({ cliente, mesAtivo, planAno, realizadoPorMes, parcelasFuturas, ocultarSemLancamento = false }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW      = doc.internal.pageSize.getWidth();    // 210
  const PH      = doc.internal.pageSize.getHeight();   // 297
  const MARGEM  = 10;
  const CONT    = PW - MARGEM * 2;                     // 190
  const Y_START = 24;   // logo abaixo do cabeçalho
  const Y_END   = PH - 14; // margem acima do rodapé

  const categorias = cliente.categorias || [];
  const anoAtivo   = cliente.anoAtivo   || new Date().getFullYear();
  const nomeMes    = MESES_FULL[mesAtivo] || '';
  const planMes    = (planAno || {})[mesAtivo] || {};
  const realMes    = (realizadoPorMes || {})[mesAtivo] || {};
  const parcMes    = (parcelasFuturas || {})[mesAtivo] || {};

  const logoData = await carregarLogo();
  let logoDims   = { w: 1, h: 1 };
  if (logoData) logoDims = await dimensoesImagem(logoData);

  const GRUPOS_DESP  = [GRUPOS.FIXAS, GRUPOS.CONSUMO, GRUPOS.DIVIDAS, GRUPOS.INVESTIMENTOS];
  const GRUPOS_ORDEM = [GRUPOS.RECEITAS, ...GRUPOS_DESP];

  // ── Cálculos gerais ──────────────────────────────────────────────────────
  function totaisGrupo(grupo) {
    const cats  = categorias.filter(c => c.grupo === grupo);
    const isRec = grupo === GRUPOS.RECEITAS;
    let projetado = 0, realizado = 0, parcelas = 0;
    for (const c of cats) {
      projetado += planMes[c.id]?.projetado || 0;
      realizado += isRec
        ? (realMes[c.id]?.receita || 0)
        : (realMes[c.id]?.despesa || 0);
      parcelas  += parcMes[c.id] || planMes[c.id]?.parcelas || 0;
    }
    return { projetado, realizado, parcelas };
  }

  const totRec  = totaisGrupo(GRUPOS.RECEITAS);
  const totDesp = GRUPOS_DESP.reduce((acc, g) => {
    const t = totaisGrupo(g);
    return { projetado: acc.projetado + t.projetado, realizado: acc.realizado + t.realizado };
  }, { projetado: 0, realizado: 0 });

  const saldoProj = totRec.projetado - totDesp.projetado;
  const corte     = saldoProj < 0 ? Math.abs(saldoProj) : 0;

  // ── Cabeçalho ───────────────────────────────────────────────────────────
  function cabecalho(paginaNum) {
    const H = 20;
    doc.setFillColor(...COR.azul);
    doc.rect(0, 0, PW, H, 'F');
    doc.setFillColor(...COR.ciano);
    doc.rect(0, H - 2, PW, 2, 'F');

    if (logoData) {
      const lh    = 14;
      const ratio = logoDims.w / logoDims.h;
      const lw    = lh * ratio;
      const lx    = MARGEM;
      const ly    = (H - lh) / 2;
      try { doc.addImage(logoData, 'PNG', lx, ly, lw, lh); } catch {}
      const tx = lx + lw + 4;
      doc.setFont('helvetica', 'bold');   doc.setFontSize(12);
      doc.setTextColor(...COR.branco);
      doc.text(APP_NAME + ' - Projecao Orcamentaria', tx, 8.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.setTextColor(...COR.cianoCl);
      doc.text(cliente.nome, tx, 14);
    } else {
      doc.setFont('helvetica', 'bold');   doc.setFontSize(12);
      doc.setTextColor(...COR.branco);
      doc.text(APP_NAME + ' - Projecao Orcamentaria', MARGEM, 8.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.setTextColor(...COR.cianoCl);
      doc.text(cliente.nome, MARGEM, 14);
    }

    doc.setFont('helvetica', 'bold');   doc.setFontSize(9);
    doc.setTextColor(...COR.ciano);
    doc.text(nomeMes.toUpperCase() + ' / ' + anoAtivo, PW - MARGEM, 9, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(...COR.cinzaTexto);
    doc.text(
      'Pagina ' + paginaNum + '  -  Gerado em ' + new Date().toLocaleDateString('pt-BR'),
      PW - MARGEM, 15, { align: 'right' }
    );
  }

  // ── Rodapé ───────────────────────────────────────────────────────────────
  function rodape() {
    doc.setFillColor(...COR.azul);
    doc.rect(0, PH - 10, PW, 10, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...COR.cianoCl);
    doc.setFont('helvetica', 'italic');
    doc.text(
      'Revise este orcamento com sua familia e traga os novos valores na proxima sessao com seu planejador.',
      PW / 2, PH - 5.5, { align: 'center' }
    );
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COR.cinzaMedio);
    doc.text('Documento Confidencial', PW / 2, PH - 1.5, { align: 'center' });
  }

  // ── Nova página helper ────────────────────────────────────────────────────
  let pgNum = 1;
  function novaPagina() {
    doc.addPage();
    pgNum++;
    cabecalho(pgNum);
    rodape();
    return Y_START;
  }

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA 1+ '-' RESUMO + TABELAS
  // ════════════════════════════════════════════════════════════════════════
  cabecalho(pgNum);
  rodape();
  let y = Y_START;

  // Badge do mês
  doc.setFillColor(...COR.ciano);
  doc.roundedRect(MARGEM, y, CONT, 10, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.setTextColor(...COR.branco);
  doc.text('Projecao para ' + nomeMes.toUpperCase() + ' / ' + anoAtivo, PW / 2, y + 6.8, { align: 'center' });
  y += 13;

  // KPI cards
  const CARD_W = CONT / 3 - 2;
  const CARD_H = 22;
  const kpis = [
    { label: 'Receita Projetada', valor: fmtBRL(totRec.projetado) },
    { label: 'Despesa Projetada', valor: fmtBRL(totDesp.projetado) },
    { label: 'Saldo Projetado',   valor: fmtBRL(saldoProj) },
  ];
  kpis.forEach((k, i) => {
    const kx = MARGEM + i * (CARD_W + 3);
    doc.setFillColor(...COR.cinzaClaro);
    doc.setDrawColor(...COR.ciano);     doc.setLineWidth(0.4);
    doc.roundedRect(kx, y, CARD_W, CARD_H, 2, 2, 'FD');
    doc.setFillColor(...COR.azul);
    doc.roundedRect(kx, y, CARD_W, 5, 2, 2, 'F');
    doc.rect(kx, y + 3, CARD_W, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
    doc.setTextColor(...COR.cianoCl);
    doc.text(k.label.toUpperCase(), kx + CARD_W / 2, y + 3.5, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.setTextColor(...(i === 2 ? (saldoProj >= 0 ? COR.ciano : COR.vermelho) : COR.azul));
    doc.text(k.valor, kx + CARD_W / 2, y + 16, { align: 'center' });
  });
  y += CARD_H + 4;

  // ── Alerta / status ───────────────────────────────────────────────────────
  // Sem emojis: usa texto ASCII puro + faixa lateral colorida para destaque visual
  if (corte > 0) {
    const alertaMsg = 'ATENCAO: Para fechar o orcamento no zero, e preciso reduzir '
      + fmtBRL(corte) + ' no total das despesas.';
    const alertaLinhas = doc.setFont('helvetica', 'bold') && doc.setFontSize(8) &&
      doc.splitTextToSize(alertaMsg, CONT - 18);
    const ALERTA_H = Math.max(12, alertaLinhas.length * 4.8 + 7);
    doc.setFillColor(...COR.alertaBg);
    doc.setDrawColor(...COR.alertaBorda); doc.setLineWidth(0.6);
    doc.roundedRect(MARGEM, y, CONT, ALERTA_H, 2, 2, 'FD');
    // Faixa lateral esquerda laranja
    doc.setFillColor(...COR.alertaBorda);
    doc.roundedRect(MARGEM, y, 3, ALERTA_H, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.setTextColor(...COR.alertaTexto);
    const alertaY0 = y + (ALERTA_H - alertaLinhas.length * 4.5) / 2 + 4;
    doc.text(alertaLinhas, MARGEM + 8, alertaY0);
    y += ALERTA_H + 3;
  } else {
    const ALERTA_H = 11;
    doc.setFillColor(...COR.okBg);
    doc.setDrawColor(...COR.ciano); doc.setLineWidth(0.6);
    doc.roundedRect(MARGEM, y, CONT, ALERTA_H, 2, 2, 'FD');
    // Faixa lateral esquerda ciano
    doc.setFillColor(...COR.ciano);
    doc.roundedRect(MARGEM, y, 3, ALERTA_H, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.setTextColor(...COR.okTexto);
    doc.text(
      'Orcamento equilibrado! Receita cobre todas as despesas projetadas.',
      MARGEM + 8, y + ALERTA_H / 2 + 1.5
    );
    y += ALERTA_H + 3;
  }

  // Instrução
  doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5);
  doc.setTextColor(...COR.cinzaTexto);
  doc.text(
    'Use a coluna "Novo Valor" para anotar os ajustes que voce e sua familia decidirem fazer.',
    MARGEM, y + 4
  );
  y += 8;

  // ── Tabelas por grupo ────────────────────────────────────────────────────
  const COL_W = { cat: 50, proj: 28, cons: 26, real: 26, saldo: 26, novo: 34 };

  for (const grupo of GRUPOS_ORDEM) {
    const catsAll = categorias.filter(c => {
      if (c.grupo !== grupo) return false;
      if (!ocultarSemLancamento) return true;
      const isRec = grupo === GRUPOS.RECEITAS;
      const proj  = planMes[c.id]?.projetado || 0;
      const real  = isRec ? (realMes[c.id]?.receita || 0) : (realMes[c.id]?.despesa || 0);
      const parc  = parcMes[c.id] || planMes[c.id]?.parcelas || 0;
      return proj > 0 || real > 0 || parc > 0;
    });
    if (catsAll.length === 0) continue;

    const totais = totaisGrupo(grupo);
    const isRec  = grupo === GRUPOS.RECEITAS;
    const shade  = GRUPO_SHADE[grupo] || COR.azul;

    if (y > Y_END - 40) y = novaPagina();

    // Cabeçalho do grupo
    doc.setFillColor(...shade);
    doc.roundedRect(MARGEM, y, CONT, 8.5, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.setTextColor(...COR.branco);
    doc.text(grupo, MARGEM + 5, y + 5.8);
    doc.text('Total projetado: ' + fmtBRL(totais.projetado), MARGEM + CONT - 4, y + 5.8, { align: 'right' });
    y += 9;

    const saldoMap = new Map();
    const dataRows = catsAll.map((c, idx) => {
      const proj  = planMes[c.id]?.projetado || 0;
      const cons  = parcMes[c.id] || planMes[c.id]?.parcelas || 0;
      const real  = isRec
        ? (realMes[c.id]?.receita || 0)
        : (realMes[c.id]?.despesa || 0);
      const saldo = proj - cons - real;
      saldoMap.set(idx, saldo);
      return [
        c.nome,
        proj  > 0 ? fmtBRL(proj)  : '-',
        cons  > 0 ? fmtBRL(cons)  : '-',
        real  > 0 ? fmtBRL(real)  : '-',
        proj  > 0 ? fmtBRL(saldo) : '-',
        '',
      ];
    });

    const idxTotal   = dataRows.length;
    const saldoTotal = totais.projetado - totais.parcelas - totais.realizado;
    const totalRow   = [
      { content: 'TOTAL',                   styles: { fontStyle: 'bold', textColor: COR.branco, fillColor: shade } },
      { content: fmtBRL(totais.projetado),   styles: { fontStyle: 'bold', textColor: COR.branco, fillColor: shade } },
      { content: totais.parcelas  > 0 ? fmtBRL(totais.parcelas)  : '-', styles: { fontStyle: 'bold', textColor: COR.branco, fillColor: shade } },
      { content: totais.realizado > 0 ? fmtBRL(totais.realizado) : '-', styles: { fontStyle: 'bold', textColor: COR.branco, fillColor: shade } },
      { content: fmtBRL(saldoTotal), styles: { fontStyle: 'bold', textColor: saldoTotal < 0 ? [255,180,180] : COR.branco, fillColor: shade } },
      { content: '', styles: { fillColor: shade } },
    ];

    autoTable(doc, {
      startY:     y,
      margin:     { left: MARGEM, right: MARGEM },
      tableWidth: CONT,
      head: [['Categoria', 'Projetado', 'Consumido', 'Realizado', 'Saldo', 'Novo Valor']],
      body: [...dataRows, totalRow],
      theme: 'grid',
      styles:     { fontSize: 7.5, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, textColor: COR.preto, lineColor: COR.cinzaMedio, lineWidth: 0.2, overflow: 'linebreak' },
      headStyles: { fillColor: COR.azul, textColor: COR.branco, fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
      columnStyles: {
        0: { halign: 'left',   cellWidth: COL_W.cat   },
        1: { halign: 'right',  cellWidth: COL_W.proj  },
        2: { halign: 'right',  cellWidth: COL_W.cons  },
        3: { halign: 'right',  cellWidth: COL_W.real  },
        4: { halign: 'right',  cellWidth: COL_W.saldo },
        5: { halign: 'center', cellWidth: COL_W.novo, fillColor: COR.cianoFundo, lineColor: COR.ciano, lineWidth: 0.4 },
      },
      alternateRowStyles: { fillColor: COR.cinzaClaro },
      didParseCell(data) {
        if (data.section !== 'body') return;
        const isTotal = data.row.index === idxTotal;
        if (data.column.index === 5 && !isTotal) {
          data.cell.styles.fillColor = COR.cianoFundo;
          data.cell.styles.lineColor = COR.ciano;
          data.cell.styles.lineWidth = 0.4;
        }
        if (data.column.index === 4 && !isTotal) {
          const sv = saldoMap.get(data.row.index);
          if (sv !== undefined && sv < 0) {
            data.cell.styles.textColor = COR.vermelho;
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = COR.vermelhoBg;
          }
        }
      },
      didDrawPage(data) {
        if (data.pageNumber > 1) {
          const actualPg = doc.internal.getCurrentPageInfo().pageNumber;
          pgNum = actualPg;
          cabecalho(actualPg);
          rodape();
        }
      },
    });

    y = doc.lastAutoTable.finalY + 5;
  }

  // Mini bloco de próximos passos (ao final das tabelas)
  if (y < Y_END - 28) {
    const BH = corte > 0 ? 26 : 21;
    if (y + BH < Y_END) {
      doc.setFillColor(...COR.cianoFundo);
      doc.setDrawColor(...COR.ciano); doc.setLineWidth(0.6);
      doc.roundedRect(MARGEM, y, CONT, BH, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
      doc.setTextColor(...COR.azul);
      doc.text('Proximos passos', MARGEM + 5, y + 6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(...COR.preto);
      doc.text('1. Revise este orcamento com sua familia.', MARGEM + 5, y + 12);
      doc.text('2. Preencha a coluna "Novo Valor" com os ajustes decididos.', MARGEM + 5, y + 18);
      if (corte > 0) {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...COR.vermelho);
        doc.text('3. Meta de corte para zerar o orcamento: ' + fmtBRL(corte), MARGEM + 5, y + 24);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA GUIA A '-' Título + Seção 1 (cards) + Seção 2 (equação)
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pgNum++;
  cabecalho(pgNum);
  rodape();
  let g = Y_START;

  // Faixa título
  doc.setFillColor(...COR.azul);
  doc.roundedRect(MARGEM, g, CONT, 13, 2, 2, 'F');
  doc.setFillColor(...COR.ciano);
  doc.roundedRect(MARGEM, g + 10, CONT, 3, 1, 1, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.setTextColor(...COR.branco);
  doc.text('Como entender e usar este documento', PW / 2, g + 8.5, { align: 'center' });
  g += 17;

  // Subtítulo
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.setTextColor(...COR.cinzaTexto);
  doc.text(
    'Este guia explica o significado de cada coluna e como voce deve usar o documento em casa.',
    PW / 2, g, { align: 'center' }
  );
  g += 9;

  // ── SEÇÃO 1 '-' O que significa cada coluna? ───────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(...COR.azul);
  doc.text('1.  O que significa cada coluna?', MARGEM, g);
  doc.setDrawColor(...COR.ciano); doc.setLineWidth(1.2);
  doc.line(MARGEM, g + 2, MARGEM + 65, g + 2);
  g += 8;

  // 5 cards '-' icone é um circulo colorido com sigla (sem emoji)
  const colunas = [
    {
      nome: 'PROJETADO',  sigla: 'P',  cor: COR.azul,
      desc: 'O valor que voce e seu planejador combinaram gastar nessa categoria no mes.',
      ex:   'Ex.: R$ 2.000 para Alimentacao',
    },
    {
      nome: 'CONSUMIDO',  sigla: 'C',  cor: [8, 80, 100],
      desc: 'Parcelas ja comprometidas (cartao, financiamento). Valor reservado automaticamente.',
      ex:   'Ex.: R$ 350 em parcelas de eletrodomestico',
    },
    {
      nome: 'REALIZADO',  sigla: 'R',  cor: [12, 90, 110],
      desc: 'O que ja foi efetivamente gasto ou recebido nesse mes ate hoje.',
      ex:   'Ex.: R$ 800 ja gastos em Supermercado',
    },
    {
      nome: 'SALDO',      sigla: 'S',  cor: [16, 100, 120],
      desc: 'Quanto ainda sobra: Projetado - Consumido - Realizado. Em VERMELHO = estouro do limite.',
      ex:   'Ex.: R$ 2.000 - R$ 350 - R$ 800 = R$ 850',
    },
    {
      nome: 'NOVO VALOR', sigla: 'N',  cor: COR.ciano,
      desc: 'Espaco para anotar um novo valor projetado, caso decida ajustar o orcamento em casa.',
      ex:   'Ex.: escreva R$ 1.500 para reduzir o gasto',
    },
  ];

  const defW  = CONT / colunas.length; // ~38mm por card
  const DEF_H = 48;

  colunas.forEach((col, i) => {
    const cx = MARGEM + i * defW;

    // Fundo do card
    doc.setFillColor(...COR.cinzaClaro);
    doc.setDrawColor(...COR.cinzaMedio); doc.setLineWidth(0.3);
    doc.roundedRect(cx + 0.5, g, defW - 1.5, DEF_H, 2, 2, 'FD');

    // Faixa colorida no topo
    doc.setFillColor(...col.cor);
    doc.roundedRect(cx + 0.5, g, defW - 1.5, 10, 2, 2, 'F');
    doc.rect(cx + 0.5, g + 7, defW - 1.5, 3, 'F');

    // Nome da coluna no cabeçalho
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
    doc.setTextColor(...COR.branco);
    doc.text(col.nome, cx + defW / 2, g + 6.5, { align: 'center' });

    // Icone: circulo colorido com sigla (substituindo emoji)
    const icX = cx + defW / 2;
    const icY = g + 20;
    doc.setFillColor(...col.cor);
    doc.circle(icX, icY, 5.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.setTextColor(...COR.branco);
    doc.text(col.sigla, icX, icY + 1.6, { align: 'center' });

    // Descrição
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
    doc.setTextColor(...COR.preto);
    const dLines = doc.splitTextToSize(col.desc, defW - 5);
    doc.text(dLines, cx + 2, g + 29);

    // Exemplo em itálico
    doc.setFont('helvetica', 'italic'); doc.setFontSize(5.8);
    doc.setTextColor(...COR.ciano);
    const eLines = doc.splitTextToSize(col.ex, defW - 5);
    doc.text(eLines, cx + 2, g + 41);
  });
  g += DEF_H + 10;

  // ── SEÇÃO 2 '-' Como o Saldo é calculado? ──────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(...COR.azul);
  doc.text('2.  Como o Saldo e calculado?', MARGEM, g);
  doc.setDrawColor(...COR.ciano); doc.setLineWidth(1.2);
  doc.line(MARGEM, g + 2, MARGEM + 60, g + 2);
  g += 8;

  // Equação visual: blocos coloridos com texto ASCII
  const EQ_H  = 16;
  const blocos = [
    { txt: 'PROJETADO', cor: COR.azul,      sub: 'o que foi planejado' },
    { txt: '-',         cor: null,          sub: null },
    { txt: 'CONSUMIDO', cor: [8, 80, 100],  sub: 'parcelas fixadas' },
    { txt: '-',         cor: null,          sub: null },
    { txt: 'REALIZADO', cor: [12, 90, 110], sub: 'gasto ate hoje' },
    { txt: '=',         cor: null,          sub: null },
    { txt: 'SALDO',     cor: COR.ciano,     sub: 'disponivel' },
  ];
  const bLargs = [37, 8, 37, 8, 37, 8, 37];
  const bEsp   = 2;
  const bTot   = bLargs.reduce((a, b) => a + b, 0) + bEsp * (bLargs.length - 1);
  let   bx     = MARGEM + (CONT - bTot) / 2;

  blocos.forEach((b, i) => {
    const bw = bLargs[i];
    if (b.cor) {
      doc.setFillColor(...b.cor);
      doc.roundedRect(bx, g, bw, EQ_H, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.setTextColor(...COR.branco);
      doc.text(b.txt, bx + bw / 2, g + 6, { align: 'center' });
      if (b.sub) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5);
        doc.text(doc.splitTextToSize(b.sub, bw - 2), bx + bw / 2, g + 11, { align: 'center' });
      }
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.setTextColor(...COR.azul);
      doc.text(b.txt, bx + bw / 2, g + EQ_H / 2 + 3, { align: 'center' });
    }
    bx += bw + bEsp;
  });
  g += EQ_H + 5;

  // Box vermelho '-' explica o que significa saldo negativo (sem emoji, texto ASCII)
  const vermMsg    = 'Saldo em VERMELHO significa que o gasto ja ultrapassou o valor planejado para essa categoria.';
  const vermLinhas = doc.setFont('helvetica', 'bold') && doc.setFontSize(8) &&
    doc.splitTextToSize(vermMsg, CONT - 20);
  const VERM_H = Math.max(12, vermLinhas.length * 4.8 + 7);
  doc.setFillColor(...COR.vermelhoBg);
  doc.setDrawColor(...COR.vermelho); doc.setLineWidth(0.5);
  doc.roundedRect(MARGEM, g, CONT, VERM_H, 2, 2, 'FD');
  doc.setFillColor(...COR.vermelho);
  doc.roundedRect(MARGEM, g, 3, VERM_H, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.setTextColor(...COR.vermelho);
  const vermY0 = g + (VERM_H - vermLinhas.length * 4.5) / 2 + 4;
  doc.text(vermLinhas, MARGEM + 8, vermY0);
  g += VERM_H + 5;

  // ════════════════════════════════════════════════════════════════════════
  // PÁGINA GUIA B '-' Seção 3 (exemplos) + Seção 4 (passo a passo)
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pgNum++;
  cabecalho(pgNum);
  rodape();
  g = Y_START + 4; // margem extra para não colar no cabeçalho

  // ── SEÇÃO 3 ───────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(...COR.azul);
  doc.text('3.  Como usar a coluna "Novo Valor"?', MARGEM, g);
  doc.setDrawColor(...COR.ciano); doc.setLineWidth(1.2);
  doc.line(MARGEM, g + 2, MARGEM + 70, g + 2);
  g += 9;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(...COR.preto);
  const textoSec3 =
    'Se o orcamento esta negativo, decida com a familia quais categorias podem gastar menos. ' +
    'Escreva a mao o novo valor na coluna "Novo Valor" e traga o documento na proxima sessao.';
  const sec3Lines = doc.splitTextToSize(textoSec3, CONT);
  doc.text(sec3Lines, MARGEM, g);
  g += sec3Lines.length * 4.5 + 5;

  // Rótulo ANTES
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.setTextColor(...COR.cinzaTexto);
  doc.text('ANTES - orcamento negativo em R$ 500:', MARGEM, g);
  g += 4;

  // Tabela ANTES
  autoTable(doc, {
    startY:     g,
    margin:     { left: MARGEM, right: MARGEM },
    tableWidth: CONT,
    head: [['Categoria', 'Projetado', 'Consumido', 'Realizado', 'Saldo', 'Novo Valor']],
    body: [
      ['Lazer',       'R$ 1.200', '-',      'R$ 600', { content: 'R$ 600',   styles: { textColor: COR.preto } }, ''],
      ['Alimentacao', 'R$ 2.000', 'R$ 350', 'R$ 800', { content: 'R$ 850',   styles: { textColor: COR.preto } }, ''],
      ['Academia',    'R$ 200',   '-',      'R$ 200', { content: 'R$ 0',     styles: { textColor: COR.preto } }, ''],
      ['Streaming',   'R$ 250',   '-',      'R$ 400', { content: '-R$ 150',  styles: { textColor: COR.vermelho, fontStyle: 'bold', fillColor: COR.vermelhoBg } }, ''],
    ],
    theme: 'grid',
    styles:     { fontSize: 7.5, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, textColor: COR.preto, lineColor: COR.cinzaMedio, lineWidth: 0.2 },
    headStyles: { fillColor: COR.azul, textColor: COR.branco, fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
    columnStyles: {
      0: { halign: 'left',   cellWidth: COL_W.cat  },
      1: { halign: 'right',  cellWidth: COL_W.proj },
      2: { halign: 'right',  cellWidth: COL_W.cons },
      3: { halign: 'right',  cellWidth: COL_W.real },
      4: { halign: 'right',  cellWidth: COL_W.saldo },
      5: { halign: 'center', cellWidth: COL_W.novo, fillColor: COR.cianoFundo, lineColor: COR.ciano, lineWidth: 0.4 },
    },
    alternateRowStyles: { fillColor: COR.cinzaClaro },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.fillColor = COR.cianoFundo;
        data.cell.styles.lineColor = COR.ciano;
      }
    },
  });
  g = doc.lastAutoTable.finalY + 5;

  // Separador de transição (texto simples, sem seta emoji)
  doc.setFillColor(...COR.cianoFundo);
  doc.setDrawColor(...COR.ciano); doc.setLineWidth(0.4);
  doc.roundedRect(MARGEM, g, CONT, 8, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.setTextColor(...COR.azul);
  doc.text('Apos decidir os ajustes em familia, o documento fica assim:', MARGEM + CONT / 2, g + 5.2, { align: 'center' });
  g += 11;

  // Tabela DEPOIS
  autoTable(doc, {
    startY:     g,
    margin:     { left: MARGEM, right: MARGEM },
    tableWidth: CONT,
    head: [['Categoria', 'Projetado', 'Consumido', 'Realizado', 'Saldo', 'Novo Valor']],
    body: [
      ['Lazer',       'R$ 1.200', '-',      'R$ 600', 'R$ 600',
        { content: 'R$ 800',   styles: { fontStyle: 'bold', textColor: COR.azul, fillColor: [210, 240, 240] } }],
      ['Alimentacao', 'R$ 2.000', 'R$ 350', 'R$ 800', 'R$ 850',
        { content: 'R$ 1.700', styles: { fontStyle: 'bold', textColor: COR.azul, fillColor: [210, 240, 240] } }],
      ['Academia',    'R$ 200',   '-',      'R$ 200', 'R$ 0',   ''],
      ['Streaming',   'R$ 250',   '-',      'R$ 400',
        { content: '-R$ 150',  styles: { textColor: COR.vermelho, fontStyle: 'bold', fillColor: COR.vermelhoBg } },
        { content: 'R$ 300',   styles: { fontStyle: 'bold', textColor: COR.azul, fillColor: [210, 240, 240] } }],
    ],
    theme: 'grid',
    styles:     { fontSize: 7.5, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, textColor: COR.preto, lineColor: COR.cinzaMedio, lineWidth: 0.2 },
    headStyles: { fillColor: COR.azul, textColor: COR.branco, fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 } },
    columnStyles: {
      0: { halign: 'left',   cellWidth: COL_W.cat  },
      1: { halign: 'right',  cellWidth: COL_W.proj },
      2: { halign: 'right',  cellWidth: COL_W.cons },
      3: { halign: 'right',  cellWidth: COL_W.real },
      4: { halign: 'right',  cellWidth: COL_W.saldo },
      5: { halign: 'center', cellWidth: COL_W.novo, fillColor: COR.cianoFundo, lineColor: COR.ciano, lineWidth: 0.4 },
    },
    alternateRowStyles: { fillColor: COR.cinzaClaro },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 5) {
        if (!data.cell.raw || (typeof data.cell.raw === 'string' && data.cell.raw === '')) {
          data.cell.styles.fillColor = COR.cianoFundo;
        }
        data.cell.styles.lineColor = COR.ciano;
        data.cell.styles.lineWidth = 0.4;
      }
    },
  });
  g = doc.lastAutoTable.finalY + 5;

  // Callout explicativo
  const CALLOUT_H = 18;
  doc.setFillColor(...COR.cianoFundo);
  doc.setDrawColor(...COR.ciano); doc.setLineWidth(0.6);
  doc.roundedRect(MARGEM, g, CONT, CALLOUT_H, 2, 2, 'FD');
  doc.setFillColor(...COR.ciano);
  doc.roundedRect(MARGEM, g, 3, CALLOUT_H, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.setTextColor(...COR.azul);
  doc.text('O que acontece com o "Novo Valor"?', MARGEM + 7, g + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  doc.setTextColor(...COR.preto);
  const calloutTxt =
    'Na proxima sessao, seu planejador insere os "Novos Valores" no sistema como novo Projetado de cada ' +
    'categoria. O Saldo e recalculado automaticamente, ajustando o orcamento ate fechar proximo de zero.';
  doc.text(doc.splitTextToSize(calloutTxt, CONT - 12), MARGEM + 7, g + 12);
  g += CALLOUT_H + 10;

  // ── SEÇÃO 4 '-' Passo a passo ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(...COR.azul);
  doc.text('4.  O que fazer agora - passo a passo', MARGEM, g);
  doc.setDrawColor(...COR.ciano); doc.setLineWidth(1.2);
  doc.line(MARGEM, g + 2, MARGEM + 72, g + 2);
  g += 8;

  const passos = [
    {
      num: '1', cor: COR.azul,
      titulo: 'Leia o resumo do topo',
      desc: 'Veja Receita, Despesa e Saldo Projetado. Saldo em vermelho = precisa cortar despesas.',
    },
    {
      num: '2', cor: [8, 60, 80],
      titulo: 'Percorra os grupos com a familia',
      desc: 'Analise cada linha. Saldo em vermelho = estouro. Pergunte: "o que podemos reduzir aqui?"',
    },
    {
      num: '3', cor: [12, 80, 100],
      titulo: 'Escreva os ajustes em "Novo Valor"',
      desc: 'Para cada categoria que quer ajustar, escreva o novo valor. Foque no que mais impacta.',
    },
    {
      num: '4', cor: COR.ciano,
      titulo: 'Traga na proxima sessao',
      desc: 'Seu planejador insere os novos valores e recalcula ate o orcamento fechar no zero.',
    },
  ];

  const PASSO_H = 18;
  const PASSO_W = (CONT - 6) / 2;

  passos.forEach((p, i) => {
    const col2 = i % 2;
    const row2 = Math.floor(i / 2);
    const px   = MARGEM + col2 * (PASSO_W + 6);
    const py   = g + row2 * (PASSO_H + 4);

    doc.setFillColor(...COR.cinzaClaro);
    doc.setDrawColor(...p.cor); doc.setLineWidth(0.4);
    doc.roundedRect(px, py, PASSO_W, PASSO_H, 2, 2, 'FD');

    // Badge circular com número
    doc.setFillColor(...p.cor);
    doc.circle(px + 9, py + PASSO_H / 2, 5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.setTextColor(...COR.branco);
    doc.text(p.num, px + 9, py + PASSO_H / 2 + 1.7, { align: 'center' });

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.setTextColor(...p.cor);
    doc.text(p.titulo, px + 18, py + 6.5);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    doc.setTextColor(...COR.preto);
    doc.text(doc.splitTextToSize(p.desc, PASSO_W - 21), px + 18, py + 11.5);
  });

  // ── Salva ────────────────────────────────────────────────────────────────
  const appSlug = APP_NAME.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const fname   = appSlug + '_Projecao_' + cliente.nome.replace(/\s+/g, '_') + '_' + nomeMes + '_' + anoAtivo + '.pdf';
  doc.save(fname);
}
