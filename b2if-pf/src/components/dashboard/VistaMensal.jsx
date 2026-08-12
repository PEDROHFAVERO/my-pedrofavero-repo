/**
 * VistaMensal.jsx — Vista Mensal do Dashboard Financeiro
 *
 * Contém apenas o componente VistaMensal.
 * Sub-componentes extraídos para arquivos dedicados:
 *   - GraficoBarrasCategorias → graficos/GraficoBarrasCategorias.jsx
 *   - ModalDetalheCategoria   → ModalDetalheCategoria.jsx
 *
 * @module VistaMensal
 */
import { CheckCircle2, AlertTriangle, MapPin } from 'lucide-react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { fmtBRL, Card, ProgressBar } from '../UI.jsx';
import { GRUPOS, MESES, MESES_FULL } from '../../data/categorias.js';
import { KPICard, grupoColor } from './KPICard.jsx';
import { GraficoBarrasCategorias } from './graficos/GraficoBarrasCategorias.jsx';

function VistaMensal({
  mesAtivo, mesesSelecionados, grupos, totaisGrupo, categorias, categoriasNivel2,
  recMes, despMes, saldoRealizado, saldoProjetado, taxaPoupanca,
  totalParcelasMes, totalParcelasFut,
  dadosMensais, maxBarValue,
  planMes, realizadoMes, parcelasMes,
  onMesClick, vistaAtiva,
  transacoesFiltradas, setClienteAtivo, clienteAtivo,
}) {
  // Label dinâmico: único mês ou múltiplos
  const mesesLabel = mesesSelecionados && mesesSelecionados.size > 1
    ? [...mesesSelecionados].sort((a, b) => a - b).map(i => MESES[i]).join(', ')
    : mesAtivo !== null ? MESES_FULL[mesAtivo] : '';

  return (
    <>
      {/* ── KPIs mensais ─────────────────────────────────────────────────── */}
      <div className="mb-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
        <KPICard label="Receitas"        value={fmtBRL(recMes.realizado)}  sub={`Proj: ${fmtBRL(recMes.projetado)}`}  color={C.rec} />
        <KPICard label="Despesas"        value={fmtBRL(despMes.realizado)} sub={`Proj: ${fmtBRL(despMes.projetado)}`} color={C.desp} />
        <KPICard label="Saldo do Período" value={fmtBRL(saldoRealizado)}   sub={`Proj: ${fmtBRL(saldoProjetado)}`}   color={saldoRealizado >= 0 ? C.rec : C.desp} />
        <KPICard label="Taxa de Economia" value={`${taxaPoupanca.toFixed(1)}%`} sub={taxaPoupanca >= 10 ? 'Meta atingida' : 'Abaixo de 10%'} color={taxaPoupanca >= 10 ? C.green : C.yellow} />
        <KPICard label="Parcelas do Mês" value={fmtBRL(totalParcelasMes)} sub="comprometido em parcelamentos"        color="#C084FC" />
      </div>

      {/* ── Gráfico de barras por categoria (nível 2) ────────────────────── */}
      <GraficoBarrasCategorias
        realizadoMes={realizadoMes}
        parcelasMes={parcelasMes}
        categoriasNivel2={categoriasNivel2}
        categorias={categorias}
        mesesLabel={mesesLabel}
        transacoesFiltradas={transacoesFiltradas}
        mesesSelecionados={mesesSelecionados}
        setClienteAtivo={setClienteAtivo}
        clienteAtivo={clienteAtivo}
      />

      <div className="mb-grid-main" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>
        {/* ── Realizado vs Projetado ──────────────────────────────────────── */}
        <Card padding="20px">
          <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 16 }}>
            Realizado vs. Projetado — {mesesLabel}
          </div>
          {grupos.map(grupo => {
            const t = totaisGrupo(grupo, mesAtivo);
            const isReceita      = grupo === GRUPOS.RECEITAS;
            const isInvestimento = grupo === GRUPOS.INVESTIMENTOS;
            const isBomPassar    = isReceita || isInvestimento;
            const temProj = t.projetado > 0;
            const temReal = (t.realizado + t.parcelas) > 0;
            const pct = temProj ? (t.realizado / t.projetado) * 100 : 100;
            const pctCor = !temProj
              ? (isReceita ? C.rec : C.desp)
              : pct >= 100 ? (isBomPassar ? C.info : C.desp)
              : C.rec;
            return (
              <div key={grupo} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: FONT.sm, fontWeight: 600, color: C.text }}>{grupo}</span>
                  <div style={{ display: 'flex', gap: 14, fontSize: FONT.xs, color: C.textMuted }}>
                    {t.parcelas > 0 && <span style={{ color: '#C084FC' }}>Parcelas: {fmtBRL(t.parcelas)}</span>}
                    <span>Real: <strong style={{ color: isReceita ? C.rec : C.desp }}>{fmtBRL(t.realizado)}</strong></span>
                    <span>Proj: <strong style={{ color: C.text }}>{fmtBRL(t.projetado)}</strong></span>
                    <span style={{ minWidth: 36, textAlign: 'right', fontWeight: pct >= 100 ? 700 : 500, color: pctCor }}>
                      {temProj ? `${pct.toFixed(0)}%` : '—'}
                    </span>
                  </div>
                </div>
                {(temProj || temReal) && (
                  <ProgressBar
                    value={temProj ? t.realizado + t.parcelas : 1}
                    max={temProj ? t.projetado : 1}
                    height={7}
                    color={pctCor}
                  />
                )}
              </div>
            );
          })}
        </Card>

        {/* ── Endividamento Futuro ─────────────────────────────────────────── */}
        <Card padding="20px">
          <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 4 }}>Endividamento Futuro</div>
          <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 16 }}>Valores já comprometidos em parcelamentos</div>
          {MESES.map((m, i) => {
            const total = totalParcelasFut[i];
            const maxP  = Math.max(...totalParcelasFut, 1);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 28, fontSize: FONT.xs, color: vistaAtiva === i ? C.brand : C.textMuted, fontWeight: vistaAtiva === i ? 700 : 400 }}>{m}</span>
                <div style={{ flex: 1, background: C.bg, borderRadius: RADIUS.full, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${(total / maxP) * 100}%`, height: '100%', background: total > 0 ? '#C084FC' : C.border, borderRadius: RADIUS.full }} />
                </div>
                <span style={{ fontSize: FONT.xs, color: total > 0 ? '#C084FC' : C.textDim, width: 70, textAlign: 'right', fontWeight: total > 0 ? 600 : 400 }}>
                  {total > 0 ? fmtBRL(total) : '—'}
                </span>
              </div>
            );
          })}
        </Card>
      </div>

      {/* ── Detalhamento por categoria ───────────────────────────────────── */}
      <div className="mb-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {grupos.map(grupo => {
          const cats = categorias.filter(c => c.grupo === grupo);
          const isReceita = grupo === GRUPOS.RECEITAS;
          const catsComDados = cats.filter(c => {
            const r = realizadoMes[c.id];
            const p = planMes[c.id]?.projetado || 0;
            return (r?.despesa || r?.receita || 0) > 0 || p > 0;
          });
          if (!catsComDados.length) return null;
          return (
            <Card key={grupo} padding="18px 20px">
              <div style={{ fontWeight: 700, color: grupoColor(grupo), fontSize: FONT.sm, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {grupo}
              </div>
              {catsComDados.map(cat => {
                const proj = planMes[cat.id]?.projetado || 0;
                const parc = parcelasMes[cat.id] || planMes[cat.id]?.parcelas || 0;
                const real = isReceita ? (realizadoMes[cat.id]?.receita || 0) : (realizadoMes[cat.id]?.despesa || 0);
                const temProj    = proj > 0;
                const temReal    = (real + parc) > 0;
                const pct        = temProj ? ((real + parc) / proj) * 100 : 100;
                const isBomPassar = isReceita || grupo === GRUPOS.INVESTIMENTOS;
                const pctCor = !temProj
                  ? (isReceita ? C.rec : C.desp)
                  : pct >= 100 ? (isBomPassar ? C.info : C.desp)
                  : C.rec;
                const dotColor = !temProj ? null : pct >= 100 ? (isBomPassar ? C.info : C.desp) : C.rec;
                return (
                  <div key={cat.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: FONT.xs, color: C.text }}>{cat.nome}</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: FONT.xs }}>
                        {parc > 0 && <span style={{ color: '#C084FC', display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> {fmtBRL(parc)}</span>}
                        <span style={{ color: isReceita ? C.rec : C.desp, fontWeight: 600 }}>{fmtBRL(real)}</span>
                        {proj > 0 && <span style={{ color: C.textMuted }}>/ {fmtBRL(proj)}</span>}
                        {proj > 0 && dotColor && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block', flexShrink: 0 }} />}
                      </div>
                    </div>
                    {(temProj || temReal) && (
                      <ProgressBar
                        value={temProj ? real + parc : 1}
                        max={temProj ? proj : 1}
                        height={4}
                        color={pctCor}
                      />
                    )}
                  </div>
                );
              })}
            </Card>
          );
        })}
      </div>
    </>
  );
}

export { VistaMensal };
