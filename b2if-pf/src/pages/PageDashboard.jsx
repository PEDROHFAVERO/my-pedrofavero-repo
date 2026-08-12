import React, { useState, useMemo, useCallback } from 'react';
import { Printer } from 'lucide-react';
import { C, FONT, RADIUS } from '../design/tokens.js';
import { useApp } from '../context/AppContext.jsx';
import { Btn, Card, fmtBRL, ProgressBar } from '../components/UI.jsx';
import { GRUPOS, MESES, MESES_FULL } from '../data/categorias.js';
import { agruparPorMesCategoria, calcularParcelasFuturas, agruparDespesasPorMesConta, calcularParcelasFuturasPorConta } from '../utils/parser.js';
import { VistaAnual } from '../components/dashboard/VistaAnual.jsx';
import { VistaMensal } from '../components/dashboard/VistaMensal.jsx';
import { VistaMacro } from '../components/dashboard/VistaMacro.jsx';
import { VistaDRE } from '../components/dashboard/VistaDRE.jsx';
import { KPICard, grupoColor } from '../components/dashboard/KPICard.jsx';




// ── Abas de topo disponíveis ─────────────────────────────────────────────────
const ABAS_MACRO = [
  { id: 'geral',         label: 'Visão Geral',        grupo: null,                   cor: null },
  { id: 'receitas',      label: 'Receitas',            grupo: GRUPOS.RECEITAS,        cor: null },
  { id: 'fixas',         label: 'Desp. Essenciais',   grupo: GRUPOS.FIXAS,           cor: null },
  { id: 'consumo',       label: 'Consumo',             grupo: GRUPOS.CONSUMO,         cor: null },
  { id: 'dividas',       label: 'Dívidas',             grupo: GRUPOS.DIVIDAS,         cor: null },
  { id: 'investimentos', label: 'Investimentos',       grupo: GRUPOS.INVESTIMENTOS,   cor: null },
  { id: 'dre',           label: 'DRE',                 grupo: null,                   cor: null },
];

// ── Modo de visualização ──────────────────────────────────────────────────────
export default function PageDashboard() {
  const { clienteAtivo, setClienteAtivo, setPaginaAtual, modoLeitura, periodoAtivo, setPeriodoAtivo, criarVersaoSeNecessario } = useApp();
  // aba: 'geral' | 'receitas' | 'fixas' | 'consumo' | 'dividas' | 'investimentos'
  // mesesSelecionados: Set de índices (0-11). Set vazio = visão anual.
  const [aba, setAba] = useState('geral');
  const [mesesSelecionados, setMesesSelecionados] = useState(new Set());
  const [filtroConta, setFiltroConta] = useState('');

  // Toggle de mês: adiciona se não está, remove se já está
  // Quando seleciona UM único mês, sincroniza o período global
  const toggleMes = (i) => {
    setMesesSelecionados(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      // Sincroniza período global quando apenas 1 mês está selecionado
      if (next.size === 1) setPeriodoAtivo([...next][0]);
      return next;
    });
  };

  // Limpa seleção → volta para visão anual
  const limparMeses = () => setMesesSelecionados(new Set());

  const modoMultiMes = aba === 'geral' && mesesSelecionados.size > 0;
  // Compatibilidade: mesAtivo agora é null quando anual, ou o primeiro selecionado (para props legados)
  const mes = mesesSelecionados.size === 1 ? [...mesesSelecionados][0] : null;

  if (!clienteAtivo) return null;
  const { transacoes, categorias: _todasCats, planejamento, anoAtivo, contas } = clienteAtivo;
  // Subcategorias (folhas) vs categorias intermediárias (nível 2)
  const categorias = _todasCats.filter(c => !c.isCategoria);
  const categoriasNivel2 = _todasCats.filter(c => c.isCategoria === true);
  const anoStr = String(anoAtivo);
  const planAno = planejamento?.[anoStr] || {};

  // mesAtivo: usado internamente — null quando anual, índice quando single-mês
  const mesAtivo = modoMultiMes ? [...mesesSelecionados][0] : null;

  // ── Filtra transações por conta ────────────────────────────────────────────
  const transacoesFiltradas = useMemo(() =>
    filtroConta ? transacoes.filter(t => t.conta === filtroConta) : transacoes,
  [transacoes, filtroConta]);

  const realizadoPorMes = useMemo(() =>
    agruparPorMesCategoria(transacoesFiltradas, anoAtivo),
  [transacoesFiltradas, anoAtivo]);

  const parcelasFuturas = useMemo(() =>
    calcularParcelasFuturas(transacoes, categorias, anoAtivo),
  [transacoes, categorias, anoAtivo]);

  const grupos = [GRUPOS.RECEITAS, GRUPOS.FIXAS, GRUPOS.CONSUMO, GRUPOS.DIVIDAS, GRUPOS.INVESTIMENTOS];

  // ── Totais de um grupo num mês específico ──────────────────────────────────
  function totaisGrupo(grupo, mes) {
    const cats = categorias.filter(c => c.grupo === grupo && !c.isCategoria);
    const real = realizadoPorMes[mes] || {};
    const plan = planAno[mes] || {};
    const parc = parcelasFuturas[mes] || {};
    const isReceita = grupo === GRUPOS.RECEITAS;
    let projetado = 0, realizado = 0, parcelas = 0;
    for (const c of cats) {
      projetado += plan[c.id]?.projetado || 0;
      realizado += isReceita ? (real[c.id]?.receita || 0) : (real[c.id]?.despesa || 0);
      parcelas  += parc[c.id] || plan[c.id]?.parcelas || 0;
    }
    return { projetado, realizado, parcelas };
  }

  // ── Dados por mês (para tabela anual e gráfico) ───────────────────────────
  const dadosMensais = useMemo(() => MESES.map((m, i) => {
    const rec  = totaisGrupo(GRUPOS.RECEITAS, i);
    const desp = grupos.slice(1).reduce((s, g) => {
      const t = totaisGrupo(g, i);
      return { projetado: s.projetado + t.projetado, realizado: s.realizado + t.realizado, parcelas: s.parcelas + t.parcelas };
    }, { projetado: 0, realizado: 0, parcelas: 0 });
    const temReal = rec.realizado > 0 || desp.realizado > 0;
    return {
      mes: m, mesFull: MESES_FULL[i], idx: i,
      recReal: rec.realizado,   recProj: rec.projetado,
      despReal: desp.realizado, despProj: desp.projetado,
      saldoReal: rec.realizado - desp.realizado,
      saldoProj: rec.projetado - desp.projetado,
      temReal,
    };
  }), [realizadoPorMes, planAno, parcelasFuturas, categorias]);

  // ── Totais anuais acumulados ───────────────────────────────────────────────
  const totaisAnuais = useMemo(() => dadosMensais.reduce((acc, d) => ({
    recReal:   acc.recReal   + d.recReal,
    recProj:   acc.recProj   + d.recProj,
    despReal:  acc.despReal  + d.despReal,
    despProj:  acc.despProj  + d.despProj,
    saldoReal: acc.saldoReal + d.saldoReal,
    saldoProj: acc.saldoProj + d.saldoProj,
  }), { recReal: 0, recProj: 0, despReal: 0, despProj: 0, saldoReal: 0, saldoProj: 0 }),
  [dadosMensais]);

  // ── Dados multi-mês: soma todos os meses selecionados ───────────────────
  // planMes: soma dos projetados dos meses selecionados por catId
  const planMes = useMemo(() => {
    if (!modoMultiMes) return {};
    const acc = {};
    for (const i of mesesSelecionados) {
      const p = planAno[i] || {};
      for (const [catId, val] of Object.entries(p)) {
        if (!acc[catId]) acc[catId] = { projetado: 0, parcelas: 0 };
        acc[catId].projetado += val?.projetado || 0;
        acc[catId].parcelas  += val?.parcelas  || 0;
      }
    }
    return acc;
  }, [modoMultiMes, mesesSelecionados, planAno]);

  // realizadoMes: soma dos realizados dos meses selecionados por catId
  const realizadoMes = useMemo(() => {
    if (!modoMultiMes) return {};
    const acc = {};
    for (const i of mesesSelecionados) {
      const r = realizadoPorMes[i] || {};
      for (const [catId, val] of Object.entries(r)) {
        if (!acc[catId]) acc[catId] = { receita: 0, despesa: 0 };
        acc[catId].receita  += val?.receita  || 0;
        acc[catId].despesa  += val?.despesa  || 0;
      }
    }
    return acc;
  }, [modoMultiMes, mesesSelecionados, realizadoPorMes]);

  // parcelasMes: soma das parcelas dos meses selecionados por catId
  const parcelasMes = useMemo(() => {
    if (!modoMultiMes) return {};
    const acc = {};
    for (const i of mesesSelecionados) {
      const p = parcelasFuturas[i] || {};
      for (const [catId, val] of Object.entries(p)) {
        acc[catId] = (acc[catId] || 0) + val;
      }
    }
    return acc;
  }, [modoMultiMes, mesesSelecionados, parcelasFuturas]);

  // totaisGrupoMulti: soma dos totais de grupo nos meses selecionados
  const totaisGrupoMulti = useCallback((grupo) => {
    if (!modoMultiMes) return { realizado: 0, projetado: 0, parcelas: 0 };
    return [...mesesSelecionados].reduce((acc, i) => {
      const t = totaisGrupo(grupo, i);
      return { realizado: acc.realizado + t.realizado, projetado: acc.projetado + t.projetado, parcelas: acc.parcelas + t.parcelas };
    }, { realizado: 0, projetado: 0, parcelas: 0 });
  }, [modoMultiMes, mesesSelecionados, totaisGrupo]);

  const recMes  = modoMultiMes ? totaisGrupoMulti(GRUPOS.RECEITAS) : { realizado: 0, projetado: 0, parcelas: 0 };
  const despMes = modoMultiMes
    ? grupos.slice(1).reduce((s, g) => { const t = totaisGrupoMulti(g); return { projetado: s.projetado + t.projetado, realizado: s.realizado + t.realizado, parcelas: s.parcelas + t.parcelas }; }, { projetado: 0, realizado: 0, parcelas: 0 })
    : { realizado: 0, projetado: 0, parcelas: 0 };

  const saldoRealizado = recMes.realizado - despMes.realizado;
  const saldoProjetado = recMes.projetado - despMes.projetado;
  const taxaPoupanca   = recMes.realizado > 0 ? ((recMes.realizado - despMes.realizado) / recMes.realizado * 100) : 0;

  const totalParcelasMes = Object.values(parcelasMes).reduce((s, v) => s + v, 0);
  const totalParcelasFut = Array.from({ length: 12 }, (_, i) =>
    Object.values(parcelasFuturas[i] || {}).reduce((s, v) => s + v, 0));

  const maxBarValue = Math.max(...dadosMensais.map(d => Math.max(d.recReal, d.despReal)), 1);

  // ── onSalvarProjecao: persiste novoPlanAno + cria versão no histórico ────────
  const onSalvarProjecao = useCallback((novoPlanAno) => {
    const planAtual = clienteAtivo.planejamento || {};
    const novoCliente = {
      ...clienteAtivo,
      planejamento: { ...planAtual, [anoStr]: novoPlanAno },
    };
    setClienteAtivo(novoCliente);
    // Cria versão imediata no histórico ao salvar projeção.
    // Motivo 'projecao' nunca é bloqueado por hash igual — garante snapshot mesmo
    // que o usuário salve a projeção sem ter feito outras mudanças antes.
    criarVersaoSeNecessario?.(novoCliente, 'projecao');
  }, [clienteAtivo, setClienteAtivo, anoStr, criarVersaoSeNecessario]);

  // ── Dados por conta para o gráfico de gastos por conta ────────────────────
  const despesasPorMesConta = useMemo(() =>
    agruparDespesasPorMesConta(transacoesFiltradas, anoAtivo),
  [transacoesFiltradas, anoAtivo]);

  const parcelasFuturasPorConta = useMemo(() =>
    calcularParcelasFuturasPorConta(transacoes, anoAtivo),
  [transacoes, anoAtivo]);

  // Projetado total por mês (do planejamento) para o modo Projetado
  const projetadoPorMes = useMemo(() =>
    MESES.map((_, i) => {
      return grupos.slice(1).reduce((s, g) => s + totaisGrupo(g, i).projetado, 0);
    }),
  [planAno, categorias]);

  // ── Subheader label ────────────────────────────────────────────────────────
  const abaLabel = ABAS_MACRO.find(a => a.id === aba)?.label || 'Visão Geral';
  const subLabel = aba === 'geral'
    ? (modoMultiMes
        ? `${clienteAtivo.nome} · ${
            [...mesesSelecionados].sort((a,b)=>a-b).map(i => MESES[i]).join(', ')
          } ${anoAtivo}`
        : `${clienteAtivo.nome} · Visão Anual ${anoAtivo}`)
    : `${clienteAtivo.nome} · ${abaLabel} ${anoAtivo}`;

  return (
    <div className="mb-page" style={{ padding: '28px 32px', maxWidth: 1500, margin: '0 auto' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: FONT.xl, fontWeight: 800, color: C.text }}>Dashboard</div>
          <div style={{ fontSize: FONT.sm, color: C.textMuted }}>{subLabel}</div>
        </div>
        <div className="mb-header-actions" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filtroConta} onChange={e => setFiltroConta(e.target.value)}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, padding: '8px 12px', color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none' }}>
            <option value="">Todas as contas</option>
            {contas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
          <Btn variant="ghost" size="sm" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Printer size={14} /> Imprimir PDF</Btn>
        </div>
      </div>

      {/* ── Barra de abas principal ───────────────────────────────────────── */}
      <div className="mb-abas-macro" style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: `2px solid ${C.border}`, paddingBottom: 0, overflowX: 'auto' }}>
        {ABAS_MACRO.map(a => {
          const ativo = aba === a.id;
          const corAba = a.id === 'geral'         ? C.brand
            : a.id === 'receitas'      ? C.rec
            : a.id === 'fixas'         ? C.grupoFixas
            : a.id === 'consumo'       ? C.grupoConsumo
            : a.id === 'dividas'       ? C.grupoDividas
            : a.id === 'dre'           ? C.brand
            : C.grupoInvestimentos;
          return (
            <button key={a.id} onClick={() => { setAba(a.id); limparMeses(); }} style={{
              padding: '9px 18px',
              background: 'transparent',
              color: ativo ? corAba : C.textMuted,
              fontWeight: ativo ? 700 : 500,
              fontSize: FONT.sm,
              cursor: 'pointer',
              fontFamily: "'Inter',sans-serif",
              border: 'none',
              borderBottom: ativo ? `3px solid ${corAba}` : '3px solid transparent',
              marginBottom: -2,
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}>{a.label}</button>
          );
        })}
      </div>

      {/* ── Navegação de meses (só na aba Visão Geral, não na DRE) ─────────── */}
      {aba === 'geral' && (
        <div style={{ display: 'flex', gap: 5, marginBottom: 28, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Botão Ano */}
          <button onClick={limparMeses} style={{
            padding: '7px 16px', borderRadius: RADIUS.md,
            background: !modoMultiMes ? C.brand : C.card,
            color: !modoMultiMes ? C.bg : C.text,
            fontWeight: !modoMultiMes ? 800 : 600,
            fontSize: FONT.sm, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
            border: `1px solid ${!modoMultiMes ? C.brand : C.border}`,
            letterSpacing: '0.04em',
          }}>Ano</button>

          {/* Divisor */}
          <div style={{ width: 1, height: 24, background: C.border, margin: '0 4px' }} />

          {/* Botões de mês — toggle multi-seleção */}
          {MESES.map((m, i) => {
            const d = dadosMensais[i];
            const ativo = mesesSelecionados.has(i);
            return (
              <button key={i} onClick={() => toggleMes(i)} style={{
                padding: '7px 13px', borderRadius: RADIUS.md,
                background: ativo ? C.brand : C.card,
                color: ativo ? C.bg : d.temReal ? (d.saldoReal >= 0 ? C.rec : C.desp) : C.textMuted,
                fontWeight: ativo ? 700 : 500,
                fontSize: FONT.sm, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                border: `1px solid ${ativo ? C.brand : d.temReal ? (d.saldoReal >= 0 ? C.rec + '50' : C.desp + '50') : C.border}`,
                outline: ativo ? `2px solid ${C.brand}55` : 'none',
                outlineOffset: 1,
              }}>{m}</button>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: VISÃO GERAL — ANUAL
      ══════════════════════════════════════════════════════════════════════ */}
      {aba === 'geral' && !modoMultiMes && (
        <VistaAnual
          dadosMensais={dadosMensais}
          totaisAnuais={totaisAnuais}
          maxBarValue={maxBarValue}
          onMesClick={i => toggleMes(i)}
          anoAtivo={anoAtivo}
          totaisGrupo={totaisGrupo}
          grupos={grupos}
          contas={contas}
          despesasPorMesConta={despesasPorMesConta}
          parcelasFuturasPorConta={parcelasFuturasPorConta}
          projetadoPorMes={projetadoPorMes}
          totalParcelasFut={totalParcelasFut}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABA: VISÃO GERAL — MENSAL
      ══════════════════════════════════════════════════════════════════════ */}
      {modoMultiMes && (
        <VistaMensal
          mesAtivo={mesAtivo}
          mesesSelecionados={mesesSelecionados}
          grupos={grupos}
          totaisGrupo={totaisGrupoMulti}
          categorias={categorias}
          recMes={recMes} despMes={despMes}
          saldoRealizado={saldoRealizado} saldoProjetado={saldoProjetado}
          taxaPoupanca={taxaPoupanca}
          totalParcelasMes={totalParcelasMes}
          totalParcelasFut={totalParcelasFut}
          dadosMensais={dadosMensais}
          maxBarValue={maxBarValue}
          planMes={planMes} realizadoMes={realizadoMes} parcelasMes={parcelasMes}
          categoriasNivel2={categoriasNivel2}
          onMesClick={i => toggleMes(i)}
          vistaAtiva={mes}
          transacoesFiltradas={transacoesFiltradas}
          setClienteAtivo={setClienteAtivo}
          clienteAtivo={clienteAtivo}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ABAS DE MACRO: Receitas | Despesas Essenciais | Consumo | Dívidas | Invest.
      ══════════════════════════════════════════════════════════════════════ */}
      {/* DRE */}
      {aba === 'dre' && (
        <VistaDRE
          categorias={categorias}
          categoriasNivel2={categoriasNivel2}
          planAno={planAno}
          realizadoPorMes={realizadoPorMes}
          parcelasFuturas={parcelasFuturas}
          anoAtivo={anoAtivo}
          onSalvarProjecao={onSalvarProjecao}
          transacoesFiltradas={transacoesFiltradas}
          setClienteAtivo={setClienteAtivo}
          clienteAtivo={clienteAtivo}
          modoLeitura={modoLeitura}
        />
      )}

      {/* Abas de grupo macro (Receitas / Essenciais / Consumo / Dívidas / Invest.) */}
      {aba !== 'geral' && aba !== 'dre' && (() => {
        const abaInfo = ABAS_MACRO.find(a => a.id === aba);
        return (
          <VistaMacro
            grupo={abaInfo.grupo}
            label={abaInfo.label}
            dadosMensais={dadosMensais}
            totaisGrupo={totaisGrupo}
            categorias={categorias}
            categoriasNivel2={categoriasNivel2}
            planAno={planAno}
            realizadoPorMes={realizadoPorMes}
            parcelasFuturas={parcelasFuturas}
            anoAtivo={anoAtivo}
            todasCategorias={_todasCats}
            onSalvarProjecao={onSalvarProjecao}
            transacoesFiltradas={transacoesFiltradas}
            setClienteAtivo={setClienteAtivo}
            clienteAtivo={clienteAtivo}
            modoLeitura={modoLeitura}
          />
        );
      })()}
    </div>
  );
}
