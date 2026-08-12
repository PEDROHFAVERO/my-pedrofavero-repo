import { useState, useMemo, useRef } from 'react';
import { usePlanejamento } from '../hooks/usePlanejamento.js';
import { C, FONT, RADIUS } from '../design/tokens.js';
import { useApp } from '../context/AppContext.jsx';
import { Btn, Card, SectionTitle, fmtBRL, Badge, ProgressBar, Modal, Input, Select } from '../components/UI.jsx';
import { GRUPOS, MESES, MESES_FULL } from '../data/categorias.js';
import { calcularMediasHistoricas, calcularParcelasFuturas, agruparPorMesCategoria, isFaturaAnterior } from '../utils/parser.js';
import { gerarPDFProjecao } from '../utils/gerarPDFProjecao.js';
import { extrairTextoPDF } from '../utils/pdfParser.js';
import { supabase } from '../lib/supabase.js';
import { KPIBox, grupoColor } from '../components/planejador/helpers.jsx';
import { SecaoPrevistoRealizado } from '../components/planejador/SecaoPrevistoRealizado.jsx';
import { SecaoContasAPagar } from '../components/planejador/SecaoContasAPagar.jsx';
import { SecaoConciliacao } from '../components/planejador/SecaoConciliacao.jsx';
import { ModalConta } from '../components/planejador/ModalConta.jsx';
import { ModalRevisaoMetas } from '../components/planejador/ModalRevisaoMetas.jsx';

export default function PagePlanejador() {
  const { clienteAtivo, setClienteAtivo, setPaginaAtual, modoLeitura, periodoAtivo, setPeriodoAtivo } = useApp();
  const mesAtivo = periodoAtivo;
  const setMesAtivo = setPeriodoAtivo;
  const [modalInicializar, setModalInicializar] = useState(false);
  const [modalSalvar, setModalSalvar] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  // Categorias expandidas (accordion): Set de IDs de categoria-nível2
  const [expandidas, setExpandidas] = useState(new Set());
  const [confirmLimpar, setConfirmLimpar] = useState(null);
  const [modalLimparMeses, setModalLimparMeses] = useState(false);
  const [mesesParaLimpar, setMesesParaLimpar] = useState(new Set());
  const [ocultarSemLancamento, setOcultarSemLancamento] = useState(false);
  // ── Importação PDF Metas ──
  const inputPdfRef = useRef(null);
  const [importandoPDF, setImportandoPDF] = useState(false);
  const [importProgressMsg, setImportProgressMsg] = useState('');
  const [importErro, setImportErro] = useState(null);
  const [modalRevisaoMetas, setModalRevisaoMetas] = useState(null); // { meses, itens }
  // ── Abas do Planejador ──
  const [abaAtiva, setAbaAtiva] = useState('planejamento'); // 'planejamento' | 'previsto-realizado' | 'contas' | 'conciliacao'
  // ── Contas a Pagar (CRUD) ──
  const [modalConta, setModalConta] = useState(null); // null | { modo: 'novo'|'editar', conta: {...} }
  const [confirmRemoverConta, setConfirmRemoverConta] = useState(null); // id da conta

  if (!clienteAtivo) return null;
  const { transacoes, categorias: _categorias, planejamento, anoAtivo, contasAPagar: _contasAPagar } = clienteAtivo;
  const contasAPagar = _contasAPagar || [];
  // Apenas subcategorias (exclui categorias intermediárias isCategoria:true)
  const categorias = _categorias.filter(c => !c.isCategoria && !c.oculto);
  // Todas as categorias intermediárias (nível 2)
  const categoriasNivel2 = _categorias.filter(c => c.isCategoria === true);

  const anoStr = String(anoAtivo);
  const planAno = planejamento?.[anoStr] || {};

  // ── Hook de planejamento (Fase 2 — Strangler Fig) ─────────────────────
  // parcelasFuturas ainda não computadas aqui; será passado após useMemo abaixo.
  // Usamos o hook depois do useMemo de parcelasFuturas.

  // ── Calcula médias históricas ─────────────────────────────────────────
  const medias = useMemo(() =>
    calcularMediasHistoricas(transacoes, categorias, anoAtivo),
  [transacoes, categorias, anoAtivo]);

  // ── Agrupa realizado por mês/categoria ────────────────────────────────
  // Exclui transações de fatura do mês anterior (compra em mês X com
  // competência em mês X+1 e parcelaTotal ≤ 1) para não inflar o realizado
  // do Planejador com gastos que pertencem ao período anterior.
  const transacoesSemFaturaAnterior = useMemo(() =>
    (transacoes || []).filter(t => !isFaturaAnterior(t)),
  [transacoes]);

  const realizadoPorMes = useMemo(() =>
    agruparPorMesCategoria(transacoesSemFaturaAnterior, anoAtivo),
  [transacoesSemFaturaAnterior, anoAtivo]);

  // ── Parcelas futuras comprometidas ────────────────────────────────────
  const parcelasFuturas = useMemo(() =>
    calcularParcelasFuturas(transacoes, categorias, anoAtivo),
  [transacoes, categorias, anoAtivo]);

  // ── usePlanejamento hook (Fase 2 — Strangler Fig) ────────────────────
  const plan = usePlanejamento({ clienteAtivo, setClienteAtivo, mesAtivo, parcelasFuturas });

  // ── Dados do mês ativo ────────────────────────────────────────────────
  const planMes = plan.planMes;
  const realizadoMes = realizadoPorMes[mesAtivo] || {};
  const parcelasMes = parcelasFuturas[mesAtivo] || {};

  const temProjecao = planAno[mesAtivo] != null && Object.keys(planAno[mesAtivo] || {}).length > 0;

  // ── Toggle accordion ─────────────────────────────────────────────────
  function toggleExpandida(catId) {
    setExpandidas(prev => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  }

  function expandirTudo(grupo) {
    const ids = categoriasNivel2.filter(c => c.grupo === grupo).map(c => c.id);
    setExpandidas(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });
  }

  function colapsarTudo(grupo) {
    const ids = new Set(categoriasNivel2.filter(c => c.grupo === grupo).map(c => c.id));
    setExpandidas(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
  }

  // ── Importar PDF de Metas do Meu Dinheiro ────────────────────────────────
  // Gemini agora roda server-side via Edge Function process-pdf
  async function handleImportarPDFMetas(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setModalInicializar(false);
    setImportErro(null);
    setImportandoPDF(true);
    setImportProgressMsg('Extraindo texto do PDF...');
    try {
      const textoPDF = await extrairTextoPDF(file);
      if (!textoPDF || textoPDF.length < 50) throw new Error('PDF sem texto selecionável. Tente um PDF gerado digitalmente.');

      setImportProgressMsg('Enviando para o servidor (Gemini)...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/process-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          textoPDF,
          nomeConta: 'Metas MD',
          modo: 'metas',
          categorias: clienteAtivo.categorias,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Erro do servidor: ${res.status} — ${txt}`);
      }

      // Lê SSE até evento 'result'
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let resultado = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event:')) { eventType = line.slice(6).trim(); }
          else if (line.startsWith('data:')) {
            const raw = line.slice(5).trim();
            if (eventType === 'progress') {
              try { const d = JSON.parse(raw); setImportProgressMsg(d.message || raw); } catch { setImportProgressMsg(raw); }
            } else if (eventType === 'result') {
              try { resultado = JSON.parse(raw); } catch { throw new Error('Resposta inválida do servidor.'); }
            } else if (eventType === 'error') {
              let msg = raw; try { msg = JSON.parse(raw).error || raw; } catch { /* ok */ } throw new Error(msg);
            }
          }
        }
        if (resultado) break;
      }
      if (!resultado) throw new Error('Servidor não retornou resultado.');
      setModalRevisaoMetas(resultado);
    } catch (err) {
      setImportErro(err.message || 'Erro desconhecido ao processar PDF.');
    } finally {
      setImportandoPDF(false);
      setImportProgressMsg('');
    }
  }

  // ── Confirmar importação de metas após revisão ────────────────────────────
  function confirmarImportacaoMetas({ itensFinal, mesesSelecionados, novasCategorias }) {
    // 1. Criar categorias novas (se houver)
    let categoriasAtualizadas = [...clienteAtivo.categorias];
    for (const nova of novasCategorias) {
      if (!categoriasAtualizadas.find(c => c.id === nova.id)) {
        categoriasAtualizadas.push(nova);
      }
    }

    // 2. Gravar metas no planejamento
    const novoPlan = JSON.parse(JSON.stringify(planejamento || {}));
    const anoStr2 = String(anoAtivo);
    if (!novoPlan[anoStr2]) novoPlan[anoStr2] = {};

    for (const mes of mesesSelecionados) {
      // mes formato 'YYYY-MM' → índice 0-11
      const [, mmStr] = mes.split('-');
      const mesIdx = parseInt(mmStr, 10) - 1;
      if (!novoPlan[anoStr2][mesIdx]) novoPlan[anoStr2][mesIdx] = {};

      for (const item of itensFinal) {
        if (!item.catIdFinal) continue;
        const valorMes = Math.abs(item.metas?.[mes] || 0);
        if (valorMes === 0) continue;
        if (!novoPlan[anoStr2][mesIdx][item.catIdFinal]) {
          novoPlan[anoStr2][mesIdx][item.catIdFinal] = { projetado: 0, parcelas: 0 };
        }
        novoPlan[anoStr2][mesIdx][item.catIdFinal].projetado = valorMes;
      }
    }

    setClienteAtivo({
      ...clienteAtivo,
      categorias: categoriasAtualizadas,
      planejamento: novoPlan,
    });
    setModalRevisaoMetas(null);
    // Navegar para o primeiro mês importado
    if (mesesSelecionados.length > 0) {
      const [, mmStr] = mesesSelecionados[0].split('-');
      setMesAtivo(parseInt(mmStr, 10) - 1);
    }
    setExpandidas(new Set(
      categoriasAtualizadas.filter(c => c.isCategoria).map(c => c.id)
    ));
  }

  // ── Delegações ao usePlanejamento hook ───────────────────────────────
  // As funções abaixo delegam para o hook, passando os callbacks
  // que fecham os modais locais (efeito colateral de UI).

  function inicializarComMedias() {
    plan.inicializarComMedias(medias, () => {
      setModalInicializar(false);
      setExpandidas(new Set(plan.categoriasNivel2.map(c => c.id)));
    });
  }

  function inicializarManual() {
    plan.inicializarManual(() => {
      setModalInicializar(false);
      setExpandidas(new Set(plan.categoriasNivel2.map(c => c.id)));
    });
  }

  function replicarAteDezembroEFechar() {
    plan.replicarAteDezembroEFechar(() => setModalSalvar(false));
  }

  function limparMesesSelecionados() {
    plan.limparMesesSelecionados(mesesParaLimpar, () => {
      setModalLimparMeses(false);
      setMesesParaLimpar(new Set());
    });
  }

  function limparGrupoMes(grupo) {
    plan.limparGrupoMes(grupo, () => setConfirmLimpar(null));
  }

  const atualizarLimite = plan.atualizarLimite;

  function salvarConta(conta) {
    plan.salvarConta(conta, () => setModalConta(null));
  }

  function removerConta(id) {
    plan.removerConta(id, () => setConfirmRemoverConta(null));
  }

  // ── Status de conciliação de uma conta no mês ativo ───────────────────
  function statusConta(conta) {
    const hoje = new Date();
    const anoMes = `${anoAtivo}-${String(mesAtivo + 1).padStart(2, '0')}`;
    // pago = tem transação oficial na categoria desta conta no mês
    const pago = (transacoes || []).some(t => {
      const comp = String(t.competencia ?? '').slice(0, 7);
      return comp === anoMes && t.categoriaId === conta.categoriaId;
    });
    if (pago) return { label: 'Pago', cor: C.rec, emoji: '' };
    // calcular dias para vencer (dentro do mês ativo)
    const diaVenc = parseInt(conta.diaVencimento, 10);
    const dataVenc = new Date(anoAtivo, mesAtivo, diaVenc);
    const diffMs = dataVenc - hoje;
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDias < 0) return { label: `Vencido há ${Math.abs(diffDias)}d`, cor: C.desp, emoji: '' };
    if (diffDias <= 3) return { label: `Vence em ${diffDias}d`, cor: C.warn, emoji: '' };
    return { label: `Dia ${diaVenc}`, cor: C.textMuted, emoji: '' };
  }

  // ── Totais delegados ao hook (passam realizadoMes/parcelasMes do closure) ──
  function calcTotaisGrupo(grupo) {
    return plan.calcTotaisGrupo(grupo, realizadoMes, parcelasMes);
  }

  function calcTotaisCategoria(cat2Id) {
    return plan.calcTotaisCategoria(cat2Id, realizadoMes, parcelasMes);
  }

  const gruposExibir = [GRUPOS.RECEITAS, GRUPOS.FIXAS, GRUPOS.CONSUMO, GRUPOS.DIVIDAS, GRUPOS.INVESTIMENTOS];

  const totalReceitas = calcTotaisGrupo(GRUPOS.RECEITAS).realizado;
  const totalDespesas = gruposExibir.slice(1).reduce((s, g) => s + calcTotaisGrupo(g).realizado, 0);
  const saldoMes = totalReceitas - totalDespesas;

  const totalReceitasProj = calcTotaisGrupo(GRUPOS.RECEITAS).projetado;
  const totalDespesasProj = gruposExibir.slice(1).reduce((s, g) => s + calcTotaisGrupo(g).projetado, 0);
  const saldoProj = totalReceitasProj - totalDespesasProj;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1500, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: FONT.xl, fontWeight: 800, color: C.text }}>Planejador Financeiro</div>
          <div style={{ fontSize: FONT.sm, color: C.textMuted }}>{clienteAtivo.nome} · {anoAtivo}</div>
        </div>
        {/* Botões header */}
        {!modoLeitura && (() => {
          const btn = (onClick, label, variant = 'primary', disabled = false, extraStyle = {}) => {
            const isPrimary  = variant === 'primary';
            const isDanger   = variant === 'danger';
            const isOutline  = variant === 'outline';
            const base = {
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 16px', borderRadius: RADIUS.md,
              fontWeight: 600, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif",
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'all .15s',
              opacity: disabled ? 0.4 : 1,
              whiteSpace: 'nowrap',
            };
            const variantStyle = isPrimary
              ? { background: C.brand, color: C.bg, border: `1px solid ${C.brand}` }
              : isDanger
              ? { background: 'transparent', color: C.desp, border: `1px solid ${C.desp}55` }
              : { background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}` };
            return (
              <button onClick={disabled ? undefined : onClick} disabled={disabled}
                style={{ ...base, ...variantStyle, ...extraStyle }}>
                {label}
              </button>
            );
          };

          const semProjecaoAnual = Object.keys(planAno).length === 0;

          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {btn(() => setModalInicializar(true), '🚀 Iniciar Projeção')}
              {btn(
                () => setModalSalvar(true),
                '💾 Salvar Projeção',
                'outline',
                !temProjecao
              )}
              {btn(
                async () => {
                  setGerandoPDF(true);
                  try {
                    await gerarPDFProjecao({ cliente: clienteAtivo, mesAtivo, planAno, realizadoPorMes, parcelasFuturas, ocultarSemLancamento });
                  } catch (e) {
                    console.error('Erro ao gerar PDF:', e);
                    alert('Erro ao gerar PDF. Verifique o console.');
                  } finally { setGerandoPDF(false); }
                },
                gerandoPDF ? '⏳ Gerando...' : '📄 Gerar PDF',
                'outline',
                !temProjecao || gerandoPDF
              )}
              {btn(
                () => { setMesesParaLimpar(new Set()); setModalLimparMeses(true); },
                '🗑 Excluir Projeções',
                'danger',
                semProjecaoAnual
              )}
              {/* Toggle ocultar sem lançamento — ocupa as 2 colunas */}
              {temProjecao && (
                <button
                  onClick={() => setOcultarSemLancamento(v => !v)}
                  style={{
                    gridColumn: '1 / -1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    padding: '6px 14px', borderRadius: RADIUS.md,
                    background: ocultarSemLancamento ? C.brand + '15' : 'transparent',
                    border: `1px solid ${ocultarSemLancamento ? C.brand + '88' : C.border}`,
                    color: ocultarSemLancamento ? C.brand : C.textMuted,
                    fontSize: FONT.xs, fontWeight: ocultarSemLancamento ? 700 : 400,
                    fontFamily: "'Inter',sans-serif", cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  {ocultarSemLancamento ? '👁 Mostrando apenas com lançamentos' : '👁 Ocultar categorias sem lançamentos'}
                </button>
              )}
            </div>
          );
        })()}
      </div>

      {/* Seletor de mês */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {MESES.map((m, i) => (
          <button key={i} onClick={() => setMesAtivo(i)}
            style={{
              padding: '7px 14px', borderRadius: RADIUS.md, border: 'none',
              background: mesAtivo === i ? C.brand : C.card,
              color: mesAtivo === i ? C.bg : C.textMuted,
              fontWeight: mesAtivo === i ? 700 : 500,
              fontSize: FONT.sm, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
              border: `1px solid ${mesAtivo === i ? C.brand : C.border}`,
            }}
          >{m}</button>
        ))}
      </div>

      {/* KPIs do mês */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        <KPIBox label="Receitas Projetadas" value={fmtBRL(totalReceitasProj)} color={C.rec} />
        <KPIBox label="Despesas Projetadas" value={fmtBRL(totalDespesasProj)} color={C.desp} />
        <KPIBox label="Saldo Projetado" value={fmtBRL(saldoProj)} color={saldoProj >= 0 ? C.rec : C.desp} />
        <KPIBox label="Saldo Realizado" value={fmtBRL(saldoMes)} color={saldoMes >= 0 ? C.rec : C.desp} />
      </div>

      {/* ── Navegação por abas ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {[
          { id: 'planejamento',       label: '📊 Planejamento' },
          { id: 'previsto-realizado', label: '📈 Previsto vs Realizado' },
          { id: 'contas',             label: `📋 Compromissos Fixos${contasAPagar.length > 0 ? ` (${contasAPagar.length})` : ''}` },
          { id: 'conciliacao',        label: '🔍 Conciliação' },
        ].map(aba => (
          <button key={aba.id} onClick={() => setAbaAtiva(aba.id)} style={{
            padding: '9px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: "'Inter',sans-serif", fontSize: FONT.sm, fontWeight: abaAtiva === aba.id ? 700 : 500,
            color: abaAtiva === aba.id ? C.brand : C.textMuted,
            borderBottom: abaAtiva === aba.id ? `2px solid ${C.brand}` : '2px solid transparent',
            marginBottom: -1, transition: 'all .15s', whiteSpace: 'nowrap',
          }}>
            {aba.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ABA: Previsto vs Realizado                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'previsto-realizado' && (
        <SecaoPrevistoRealizado
          categorias={categorias}
          categoriasNivel2={categoriasNivel2}
          planMes={planMes}
          realizadoMes={realizadoMes}
          parcelasMes={parcelasMes}
          gruposExibir={gruposExibir}
          mesAtivo={mesAtivo}
          anoAtivo={anoAtivo}
          temProjecao={temProjecao}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ABA: Compromissos Fixos                                           */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'contas' && (
        <SecaoContasAPagar
          contasAPagar={contasAPagar}
          categorias={clienteAtivo.categorias}
          modoLeitura={modoLeitura}
          statusConta={statusConta}
          onAdicionar={() => setModalConta({ modo: 'novo', conta: { id: 'cap_' + Date.now(), nome: '', valor: '', diaVencimento: '', categoriaId: '', observacao: '', ativo: true } })}
          onEditar={conta => setModalConta({ modo: 'editar', conta: { ...conta } })}
          onRemover={id => setConfirmRemoverConta(id)}
          mesAtivo={mesAtivo}
          MESES_FULL={MESES_FULL}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ABA: Conciliação                                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'conciliacao' && (
        <SecaoConciliacao
          contasAPagar={contasAPagar}
          categorias={clienteAtivo.categorias}
          transacoes={transacoes}
          mesAtivo={mesAtivo}
          anoAtivo={anoAtivo}
          MESES_FULL={MESES_FULL}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ABA: Planejamento (original)                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {abaAtiva === 'planejamento' && !temProjecao && (
        <Card>
          <div style={{ textAlign: 'center', padding: '48px', color: C.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: FONT.lg, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              Projeção não inicializada
            </div>
            <div style={{ fontSize: FONT.sm, marginBottom: 20 }}>
              {transacoes.length > 0
                ? `Clique em "Iniciar Projeção" para preencher ${MESES_FULL[mesAtivo]} automaticamente com a média do histórico, ou construir manualmente.`
                : 'Importe transações no Fluxo Financeiro primeiro, ou inicialize manualmente.'}
            </div>
            {!modoLeitura && <Btn onClick={() => setModalInicializar(true)}>🚀 Iniciar Projeção</Btn>}
          </div>
        </Card>
      )}
      {abaAtiva === 'planejamento' && temProjecao && (
        <>{
        gruposExibir.map(grupo => {
          const cats = categorias.filter(c => c.grupo === grupo);
          if (!cats.length) return null;
          const totais = calcTotaisGrupo(grupo);
          const isReceita = grupo === GRUPOS.RECEITAS;
          const cor = grupoColor(grupo);

          // Categorias nível 2 deste grupo
          const cats2 = categoriasNivel2
            .filter(c => {
              if (c.grupo !== grupo) return false;
              if (!ocultarSemLancamento) return true;
              // oculta se nenhuma sub tem projetado, realizado ou parcelas
              const subs = cats.filter(s => s.categoria === c.id);
              return subs.some(s => {
                const proj = planMes[s.id]?.projetado || 0;
                const real = (realizadoMes[s.id]?.despesa || 0) + (realizadoMes[s.id]?.receita || 0);
                const parc = parcelasMes[s.id] || planMes[s.id]?.parcelas || 0;
                return proj > 0 || real > 0 || parc > 0;
              });
            })
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

          // Subcategorias órfãs (sem categoria nível 2) deste grupo
          const subcatsOrfas = cats
            .filter(c => {
              if (c.categoria) return false;
              if (!ocultarSemLancamento) return true;
              const proj = planMes[c.id]?.projetado || 0;
              const real = (realizadoMes[c.id]?.despesa || 0) + (realizadoMes[c.id]?.receita || 0);
              const parc = parcelasMes[c.id] || planMes[c.id]?.parcelas || 0;
              return proj > 0 || real > 0 || parc > 0;
            })
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

          // Se ocultarSemLancamento e grupo inteiro vazio, pula o grupo
          if (ocultarSemLancamento && cats2.length === 0 && subcatsOrfas.length === 0) return null;

          const temCats2 = cats2.length > 0;
          const algumExpandido = cats2.some(c => expandidas.has(c.id));

          return (
            <div key={grupo} style={{ marginBottom: 20 }}>
              {/* ── Header do Macro ── */}
              <div style={{
                background: cor + '15',
                border: `1px solid ${cor}40`,
                borderRadius: `${RADIUS.md} ${RADIUS.md} 0 0`,
                padding: '10px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontWeight: 700, color: cor, fontSize: FONT.base }}>{grupo}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: FONT.sm }}>
                  <span style={{ color: C.textMuted }}>Projetado: <strong style={{ color: C.text }}>{fmtBRL(totais.projetado)}</strong></span>
                  <span style={{ color: C.textMuted }}>Realizado: <strong style={{ color: isReceita ? C.rec : C.desp }}>{fmtBRL(totais.realizado)}</strong></span>
                  {totais.parcelas > 0 && (
                    <span style={{ color: C.textMuted }}>Parcelas: <strong style={{ color: '#C084FC' }}>{fmtBRL(totais.parcelas)}</strong></span>
                  )}
                  {/* Expandir / Colapsar tudo */}
                  {temCats2 && (
                    <button
                      onClick={() => algumExpandido ? colapsarTudo(grupo) : expandirTudo(grupo)}
                      style={{ fontSize: FONT.xs, color: cor, background: 'transparent', border: `1px solid ${cor}44`, borderRadius: RADIUS.sm, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Inter',sans-serif", opacity: 0.7, transition: 'opacity .15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
                    >
                      {algumExpandido ? '⊖ Colapsar' : '⊕ Expandir'}
                    </button>
                  )}
                  {/* Limpar grupo */}
                  {!modoLeitura && temProjecao && (
                    confirmLimpar === grupo ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: FONT.xs, color: C.textMuted }}>Zerar {MESES[mesAtivo]}?</span>
                        <button onClick={() => limparGrupoMes(grupo)} style={{ fontSize: FONT.xs, fontWeight: 700, color: C.red, background: C.red + '18', border: `1px solid ${C.red}55`, borderRadius: RADIUS.sm, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Confirmar</button>
                        <button onClick={() => setConfirmLimpar(null)} style={{ fontSize: FONT.xs, color: C.textMuted, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '3px 8px', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmLimpar(grupo)} style={{ fontSize: FONT.xs, color: cor, background: 'transparent', border: `1px solid ${cor}44`, borderRadius: RADIUS.sm, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Inter',sans-serif", opacity: 0.6, transition: 'opacity .15s' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.6}>🗑 Limpar</button>
                    )
                  )}
                </div>
              </div>

              {/* ── Corpo: categorias nível 2 + subcategorias ── */}
              <div style={{ background: C.card, border: `1px solid ${cor}40`, borderTop: 'none', borderRadius: `0 0 ${RADIUS.md} ${RADIUS.md}`, overflow: 'hidden' }}>

                {/* Cabeçalho de colunas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 130px 130px 120px 36px', gap: 8, padding: '6px 16px', background: cor + '08', borderBottom: `1px solid ${cor}20` }}>
                  <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Categoria / Subcategoria</span>
                  <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Projetado</span>
                  <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Parcelas</span>
                  <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Realizado</span>
                  <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Livre</span>
                  <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Progresso</span>
                  <span />
                </div>

                {/* Categorias nível 2 */}
                {cats2.map((cat2, idx2) => {
                  const subs = cats.filter(c => c.categoria === cat2.id)
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
                  if (!subs.length) return null;
                  const totCat = calcTotaisCategoria(cat2.id);
                  const expanded = expandidas.has(cat2.id);
                  const livreCat = totCat.projetado - totCat.parcelas - totCat.realizado;
                  const pctCat = totCat.projetado > 0 ? ((totCat.realizado + totCat.parcelas) / totCat.projetado) * 100 : 0;

                  return (
                    <div key={cat2.id} style={{ borderTop: idx2 > 0 || subcatsOrfas.length === 0 ? `1px solid ${cor}15` : 'none' }}>
                      {/* Linha da categoria nível 2 (clicável para expandir) */}
                      <div
                        onClick={() => toggleExpandida(cat2.id)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 130px 130px 130px 130px 120px 36px',
                          alignItems: 'center', gap: 8,
                          padding: '11px 16px',
                          background: cor + '0A',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background .12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = cor + '16'}
                        onMouseLeave={e => e.currentTarget.style.background = cor + '0A'}
                      >
                        {/* Nome da categoria + seta */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{
                            fontSize: 11, color: cor, display: 'inline-block',
                            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform .15s',
                            minWidth: 12,
                          }}>▶</span>
                          <span style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text }}>{cat2.nome}</span>
                          <span style={{ fontSize: 10, color: C.textDim, background: cor + '18', borderRadius: 10, padding: '1px 7px' }}>
                            {subs.length} subcat{subs.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Total projetado da categoria */}
                        <span style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text, textAlign: 'right' }}>
                          {totCat.projetado > 0 ? fmtBRL(totCat.projetado) : <span style={{ color: C.textDim }}>—</span>}
                        </span>

                        {/* Parcelas */}
                        <span style={{ fontSize: FONT.sm, color: totCat.parcelas > 0 ? '#C084FC' : C.textDim, fontWeight: totCat.parcelas > 0 ? 600 : 400, textAlign: 'right' }}>
                          {totCat.parcelas > 0 ? fmtBRL(totCat.parcelas) : '—'}
                        </span>

                        {/* Realizado */}
                        <span style={{ fontSize: FONT.sm, fontWeight: 600, color: totCat.isReceita ? C.rec : C.desp, textAlign: 'right' }}>
                          {totCat.realizado > 0 ? fmtBRL(totCat.realizado) : '—'}
                        </span>

                        {/* Livre */}
                        <span style={{ fontSize: FONT.sm, fontWeight: 600, color: livreCat >= 0 ? C.green : C.red, textAlign: 'right' }}>
                          {totCat.projetado > 0 ? fmtBRL(livreCat) : '—'}
                        </span>

                        {/* Barra */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <ProgressBar value={totCat.realizado + totCat.parcelas} max={totCat.projetado} height={5} />
                        </div>

                        {/* Semáforo */}
                        <span style={{ fontSize: 13, textAlign: 'center' }}>
                          {totCat.projetado === 0 ? '⚪' : pctCat >= 100 ? '🔴' : pctCat >= 85 ? '🟡' : '🟢'}
                        </span>
                      </div>

                      {/* Subcategorias (colapsáveis) */}
                      {expanded && subs.map((sub, idxSub) => {
                        const proj = planMes[sub.id]?.projetado || 0;
                        const parc = parcelasMes[sub.id] || planMes[sub.id]?.parcelas || 0;
                        const real = totCat.isReceita
                          ? (realizadoMes[sub.id]?.receita || 0)
                          : (realizadoMes[sub.id]?.despesa || 0);
                        const livre = proj - parc - real;
                        const pct = proj > 0 ? ((real + parc) / proj) * 100 : 0;

                        return (
                          <div key={sub.id} style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 130px 130px 130px 130px 120px 36px',
                            alignItems: 'center', gap: 8,
                            padding: '8px 16px 8px 36px',
                            borderTop: `1px solid ${C.border}18`,
                            background: idxSub % 2 === 0 ? 'transparent' : C.bg + '55',
                            transition: 'background .1s',
                          }}
                            onMouseEnter={e => e.currentTarget.style.background = cor + '05'}
                            onMouseLeave={e => e.currentTarget.style.background = idxSub % 2 === 0 ? 'transparent' : C.bg + '55'}
                          >
                            {/* Nome subcategoria */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: C.textDim, fontSize: 10 }}>└</span>
                              <span style={{ fontSize: FONT.sm, color: C.textMuted, fontWeight: 500 }}>{sub.nome}</span>
                            </div>

                            {/* Projetado editável */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              {modoLeitura ? (
                                <span style={{ fontSize: FONT.sm, color: C.text, textAlign: 'right' }}>{fmtBRL(proj)}</span>
                              ) : (
                                <input
                                  type="number"
                                  value={proj || ''}
                                  onChange={e => atualizarLimite(mesAtivo, sub.id, e.target.value)}
                                  placeholder="0"
                                  style={{
                                    width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                                    borderRadius: RADIUS.sm, padding: '4px 8px', color: C.text,
                                    fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none',
                                    textAlign: 'right',
                                  }}
                                  onFocus={e => e.target.style.borderColor = cor}
                                  onBlur={e => e.target.style.borderColor = C.border}
                                />
                              )}
                            </div>

                            {/* Parcelas */}
                            <span style={{ fontSize: FONT.sm, color: parc > 0 ? '#C084FC' : C.textDim, fontWeight: parc > 0 ? 600 : 400, textAlign: 'right' }}>
                              {parc > 0 ? fmtBRL(parc) : '—'}
                            </span>

                            {/* Realizado */}
                            <span style={{ fontSize: FONT.sm, fontWeight: 600, color: totCat.isReceita ? C.rec : C.desp, textAlign: 'right' }}>
                              {real > 0 ? fmtBRL(real) : '—'}
                            </span>

                            {/* Livre */}
                            <span style={{ fontSize: FONT.sm, fontWeight: 600, color: livre >= 0 ? C.green : C.red, textAlign: 'right' }}>
                              {proj > 0 ? fmtBRL(livre) : '—'}
                            </span>

                            {/* Barra */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <ProgressBar value={real + parc} max={proj} height={4} />
                            </div>

                            {/* Semáforo */}
                            <span style={{ fontSize: 12, textAlign: 'center' }}>
                              {proj === 0 ? '⚪' : pct >= 100 ? '🔴' : pct >= 85 ? '🟡' : '🟢'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Subcategorias órfãs (sem categoria nível 2) */}
                {subcatsOrfas.length > 0 && (
                  <>
                    {cats2.length > 0 && (
                      <div style={{ padding: '5px 16px', background: C.bg, borderTop: `1px solid ${cor}15` }}>
                        <span style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic' }}>Sem categoria definida</span>
                      </div>
                    )}
                    {subcatsOrfas.map((cat, idx) => {
                      const proj = planMes[cat.id]?.projetado || 0;
                      const parc = parcelasMes[cat.id] || planMes[cat.id]?.parcelas || 0;
                      const real = isReceita
                        ? (realizadoMes[cat.id]?.receita || 0)
                        : (realizadoMes[cat.id]?.despesa || 0);
                      const livre = proj - parc - real;
                      const pct = proj > 0 ? ((real + parc) / proj) * 100 : 0;

                      return (
                        <div key={cat.id} style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 130px 130px 130px 130px 120px 36px',
                          alignItems: 'center', gap: 8,
                          padding: '10px 16px',
                          borderTop: `1px solid ${C.border}25`,
                          background: idx % 2 === 0 ? 'transparent' : C.bg + '44',
                        }}>
                          <span style={{ fontSize: FONT.sm, color: C.text, fontWeight: 500 }}>{cat.nome}</span>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            {modoLeitura ? (
                              <span style={{ fontSize: FONT.sm, color: C.text }}>{fmtBRL(proj)}</span>
                            ) : (
                              <input
                                type="number"
                                value={proj || ''}
                                onChange={e => atualizarLimite(mesAtivo, cat.id, e.target.value)}
                                placeholder="0"
                                style={{
                                  width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                                  borderRadius: RADIUS.sm, padding: '5px 8px', color: C.text,
                                  fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none', textAlign: 'right',
                                }}
                                onFocus={e => e.target.style.borderColor = cor}
                                onBlur={e => e.target.style.borderColor = C.border}
                              />
                            )}
                          </div>

                          <span style={{ fontSize: FONT.sm, color: parc > 0 ? '#C084FC' : C.textDim, fontWeight: parc > 0 ? 600 : 400, textAlign: 'right' }}>
                            {parc > 0 ? fmtBRL(parc) : '—'}
                          </span>
                          <span style={{ fontSize: FONT.sm, fontWeight: 600, color: isReceita ? C.rec : C.desp, textAlign: 'right' }}>
                            {real > 0 ? fmtBRL(real) : '—'}
                          </span>
                          <span style={{ fontSize: FONT.sm, fontWeight: 600, color: livre >= 0 ? C.green : C.red, textAlign: 'right' }}>
                            {proj > 0 ? fmtBRL(livre) : '—'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <ProgressBar value={real + parc} max={proj} height={5} />
                          </div>
                          <span style={{ fontSize: 14, textAlign: 'center' }}>
                            {proj === 0 ? '⚪' : pct >= 100 ? '🔴' : pct >= 85 ? '🟡' : '🟢'}
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          );
        })}</>
      )}

      {/* Legenda — só na aba planejamento */}
      {abaAtiva === 'planejamento' && temProjecao && (
        <div style={{ display: 'flex', gap: 20, marginTop: 20, fontSize: FONT.xs, color: C.textMuted, flexWrap: 'wrap' }}>
          <span>📝 <strong style={{ color: C.text }}>Projetado</strong> = limite por subcategoria</span>
          <span>💜 <strong style={{ color: '#C084FC' }}>Parcelas</strong> = já comprometido em parcelamentos</span>
          <span>💸 <strong style={{ color: C.desp }}>Realizado</strong> = efetivamente gasto</span>
          <span>✅ <strong style={{ color: C.green }}>Livre</strong> = projetado − parcelas − realizado</span>
          <span style={{ color: C.textDim }}>▶ Clique na categoria para expandir/colapsar subcategorias</span>
        </div>
      )}

      {/* Modal — escolha do tipo de projeção */}
      <Modal open={modalInicializar} onClose={() => setModalInicializar(false)} title="Iniciar Projeção" width="500px">
        <div style={{ color: C.textMuted, fontSize: FONT.sm, marginBottom: 20 }}>
          Escolha como deseja construir a projeção de <strong style={{ color: C.text }}>{MESES_FULL[mesAtivo]}/{anoAtivo}</strong>:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <button
            onClick={transacoes.length > 0 ? inicializarComMedias : undefined}
            disabled={transacoes.length === 0}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              background: transacoes.length > 0 ? C.brand + '15' : C.bg,
              border: `2px solid ${transacoes.length > 0 ? C.brand : C.border}`,
              borderRadius: RADIUS.md, padding: '16px 18px',
              cursor: transacoes.length > 0 ? 'pointer' : 'not-allowed',
              opacity: transacoes.length === 0 ? 0.45 : 1,
              textAlign: 'left', width: '100%', fontFamily: "'Inter',sans-serif",
            }}
          >
            <span style={{ fontSize: 28, lineHeight: 1 }}>⚡</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: FONT.base, color: C.text, marginBottom: 4 }}>Usar Médias Históricas</div>
              <div style={{ fontSize: FONT.xs, color: C.textMuted, lineHeight: 1.5 }}>
                {transacoes.length > 0
                  ? `Projeção preenchida automaticamente com a média dos ${transacoes.length} lançamentos importados. Ajuste depois por subcategoria.`
                  : 'Nenhuma transação importada ainda.'}
              </div>
              {transacoes.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {Object.entries(medias).slice(0, 5).map(([catId, media]) => {
                    const cat = clienteAtivo.categorias.find(c => c.id === catId);
                    return cat ? (
                      <span key={catId} style={{ fontSize: 10, background: C.brand + '22', color: C.brand, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                        {cat.nome}: {fmtBRL(media)}
                      </span>
                    ) : null;
                  })}
                  {Object.keys(medias).length > 5 && (
                    <span style={{ fontSize: 10, color: C.textMuted }}>+{Object.keys(medias).length - 5} mais...</span>
                  )}
                </div>
              )}
            </div>
          </button>

          <button
            onClick={inicializarManual}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              background: C.bg, border: `2px solid ${C.border}`,
              borderRadius: RADIUS.md, padding: '16px 18px',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              fontFamily: "'Inter',sans-serif",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.textMuted}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            <span style={{ fontSize: 28, lineHeight: 1 }}>✏️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: FONT.base, color: C.text, marginBottom: 4 }}>Construir Manualmente</div>
              <div style={{ fontSize: FONT.xs, color: C.textMuted, lineHeight: 1.5 }}>
                Valores zerados. Preencha cada subcategoria no seu ritmo.
              </div>
            </div>
          </button>

          {/* Opção 3: Importar PDF do Meu Dinheiro */}
          <button
            onClick={() => inputPdfRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              background: '#7C3AED' + '12', border: `2px solid #7C3AED`,
              borderRadius: RADIUS.md, padding: '16px 18px',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              fontFamily: "'Inter',sans-serif",
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#7C3AED22'}
            onMouseLeave={e => e.currentTarget.style.background = '#7C3AED12'}
          >
            <span style={{ fontSize: 28, lineHeight: 1 }}>📄</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: FONT.base, color: C.text, marginBottom: 4 }}>Importar PDF — Meu Dinheiro</div>
              <div style={{ fontSize: FONT.xs, color: C.textMuted, lineHeight: 1.5 }}>
                Lê o relatório de metas exportado do Meu Dinheiro e preenche o planejador automaticamente. O Gemini mapeia as categorias para o sistema B2IF.
              </div>
            </div>
          </button>
          <input ref={inputPdfRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleImportarPDFMetas} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="ghost" onClick={() => setModalInicializar(false)}>Cancelar</Btn>
        </div>
      </Modal>

      {/* Modal — limpar meses */}
      <Modal open={modalLimparMeses} onClose={() => setModalLimparMeses(false)} title="Limpar Projeção por Mês" width="420px">
        <div style={{ color: C.textMuted, fontSize: FONT.sm, marginBottom: 16, lineHeight: 1.6 }}>
          Selecione os meses que deseja apagar completamente a projeção:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {MESES.map((nomeMes, i) => {
            const temDados = planAno[i] != null && Object.keys(planAno[i] || {}).length > 0;
            if (!temDados) return null;
            const sel = mesesParaLimpar.has(i);
            return (
              <button key={i} onClick={() => {
                setMesesParaLimpar(prev => {
                  const next = new Set(prev);
                  next.has(i) ? next.delete(i) : next.add(i);
                  return next;
                });
              }} style={{
                padding: '7px 16px', borderRadius: RADIUS.sm, cursor: 'pointer',
                fontFamily: "'Inter',sans-serif", fontSize: FONT.sm, fontWeight: sel ? 700 : 400,
                border: `2px solid ${sel ? C.desp : C.border}`,
                background: sel ? C.desp + '18' : C.card,
                color: sel ? C.desp : C.textMuted,
                transition: 'all .12s',
              }}>
                {nomeMes}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={() => {
            const todos = new Set(MESES.map((_, i) => i).filter(i => planAno[i] != null && Object.keys(planAno[i] || {}).length > 0));
            setMesesParaLimpar(todos);
          }} style={{ fontSize: FONT.xs, color: C.textMuted, background: 'none', border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
            Selecionar todos
          </button>
          <button onClick={() => setMesesParaLimpar(new Set())} style={{ fontSize: FONT.xs, color: C.textMuted, background: 'none', border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '3px 10px', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
            Limpar seleção
          </button>
        </div>
        {mesesParaLimpar.size > 0 && (
          <div style={{ background: C.desp + '12', border: `1px solid ${C.desp}44`, borderRadius: RADIUS.sm, padding: '10px 14px', marginBottom: 16, fontSize: FONT.xs, color: C.desp }}>
            ⚠️ Isso vai apagar toda a projeção de {mesesParaLimpar.size} mês{mesesParaLimpar.size > 1 ? 'es' : ''}: {[...mesesParaLimpar].sort((a,b)=>a-b).map(i => MESES[i]).join(', ')}. Essa ação não pode ser desfeita.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="ghost" onClick={() => setModalLimparMeses(false)}>Cancelar</Btn>
          <Btn
            onClick={limparMesesSelecionados}
            disabled={mesesParaLimpar.size === 0}
            style={{ background: mesesParaLimpar.size > 0 ? C.desp : C.border, opacity: mesesParaLimpar.size === 0 ? 0.45 : 1 }}
          >
            🗑 Apagar {mesesParaLimpar.size > 0 ? `${mesesParaLimpar.size} mês${mesesParaLimpar.size > 1 ? 'es' : ''}` : ''}
          </Btn>
        </div>
      </Modal>

      {/* Loading overlay — processando PDF de metas */}
      {importandoPDF && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.card, borderRadius: RADIUS.lg, padding: '36px 48px', textAlign: 'center', maxWidth: 400 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🤖</div>
            <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 8 }}>Gemini analisando...</div>
            <div style={{ fontSize: FONT.sm, color: C.textMuted }}>{importProgressMsg}</div>
          </div>
        </div>
      )}

      {/* Erro PDF */}
      {importErro && (
        <Modal open={!!importErro} onClose={() => setImportErro(null)} title="Erro ao importar PDF" width="420px">
          <div style={{ color: C.desp, fontSize: FONT.sm, marginBottom: 20, lineHeight: 1.6 }}>{importErro}</div>
          <Btn onClick={() => setImportErro(null)}>Fechar</Btn>
        </Modal>
      )}

      {/* Modal de revisão de metas */}
      {modalRevisaoMetas && (
        <ModalRevisaoMetas
          dados={modalRevisaoMetas}
          categorias={clienteAtivo.categorias}
          anoAtivo={anoAtivo}
          planejamento={planejamento}
          onConfirmar={confirmarImportacaoMetas}
          onCancelar={() => setModalRevisaoMetas(null)}
        />
      )}

      {/* Modal — Conta a Pagar (adicionar/editar) */}
      {modalConta && (
        <ModalConta
          conta={modalConta.conta}
          modo={modalConta.modo}
          categorias={clienteAtivo.categorias}
          onSalvar={salvarConta}
          onCancelar={() => setModalConta(null)}
        />
      )}

      {/* Confirm — remover conta */}
      {confirmRemoverConta && (
        <Modal open={!!confirmRemoverConta} onClose={() => setConfirmRemoverConta(null)} title="Remover Compromisso" width="380px">
          <div style={{ color: C.textMuted, fontSize: FONT.sm, marginBottom: 20, lineHeight: 1.6 }}>
            Tem certeza que deseja remover este compromisso? Essa ação não pode ser desfeita.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="ghost" onClick={() => setConfirmRemoverConta(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => removerConta(confirmRemoverConta)}>🗑 Remover</Btn>
          </div>
        </Modal>
      )}

      {/* Modal — salvar / replicar */}
      <Modal open={modalSalvar} onClose={() => setModalSalvar(false)} title="Salvar Projeção" width="420px">
        <div style={{ color: C.textMuted, fontSize: FONT.sm, marginBottom: 24, lineHeight: 1.6 }}>
          Deseja replicar os valores projetados de{' '}
          <strong style={{ color: C.text }}>{MESES_FULL[mesAtivo]}</strong> para os próximos meses também?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <Btn onClick={replicarAteDezembroEFechar} disabled={mesAtivo === 11} style={{ opacity: mesAtivo === 11 ? 0.4 : 1, width: '100%' }}>
            ✅ Sim, replicar até Dezembro
          </Btn>
          <Btn variant="ghost" style={{ width: '100%' }} onClick={() => setModalSalvar(false)}>
            ❌ Não, salvar só este mês
          </Btn>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button onClick={() => setModalSalvar(false)} style={{ fontSize: FONT.xs, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Cancelar</button>
        </div>
      </Modal>

      {/* SaveBar global em App.jsx — não duplicar aqui */}
    </div>
  );
}

