import { useMemo } from 'react';
import { C, FONT } from '../../design/tokens.js';
import { fmtBRL, Card } from '../UI.jsx';
import { GRUPOS, MESES, MESES_FULL } from '../../data/categorias.js';
import { KPICard } from './KPICard.jsx';
import { GraficoBarras }        from './graficos/GraficoBarras.jsx';
import { GraficoParcelamentos } from './graficos/GraficoParcelamentos.jsx';
import { GraficoContasMensais } from './graficos/GraficoContasMensais.jsx';
import { GraficoLinhas }        from './graficos/GraficoLinhas.jsx';

// ══════════════════════════════════════════════════════════════════════════════
// VistaAnual — Visão anual do Dashboard (aba "Visão Geral" sem mês selecionado)
// Props:
//   dadosMensais             — array[12]
//   totaisAnuais             — { recReal, recProj, despReal, despProj, saldoReal, saldoProj }
//   maxBarValue              — number
//   onMesClick               — fn(mesIdx)
//   anoAtivo                 — number
//   totaisGrupo              — fn(grupo, mesIdx) → { realizado, projetado, parcelas }
//   grupos                   — array de GRUPOS.*
//   contas                   — array
//   despesasPorMesConta      — map
//   parcelasFuturasPorConta  — map
//   projetadoPorMes          — array[12]
//   totalParcelasFut         — array[12]
// ══════════════════════════════════════════════════════════════════════════════
export function VistaAnual({
  dadosMensais, totaisAnuais, maxBarValue, onMesClick, anoAtivo,
  totaisGrupo, grupos, contas,
  despesasPorMesConta, parcelasFuturasPorConta,
  projetadoPorMes, totalParcelasFut,
}) {
  const mesesComReal = dadosMensais.filter(d => d.temReal).length;

  // ── Séries para o gráfico de linhas ──────────────────────────────────────
  const SERIES = useMemo(() => [
    { grupo: GRUPOS.RECEITAS,      cor: C.grupoReceitas,      label: 'Receitas'       },
    { grupo: GRUPOS.FIXAS,         cor: C.grupoFixas,         label: 'Despesas Essenciais' },
    { grupo: GRUPOS.CONSUMO,       cor: C.grupoConsumo,       label: 'Consumo'        },
    { grupo: GRUPOS.DIVIDAS,       cor: C.grupoDividas,       label: 'Dívidas'        },
    { grupo: GRUPOS.INVESTIMENTOS, cor: C.grupoInvestimentos, label: 'Investimentos'  },
  ], []);

  const seriesData = useMemo(() => SERIES.map(s => ({
    ...s,
    pontos: MESES.map((_, i) => {
      const t      = totaisGrupo(s.grupo, i);
      const temReal = dadosMensais[i].temReal;
      const v      = temReal ? t.realizado : (t.projetado > 0 ? t.projetado : null);
      return { v, isProj: !temReal && t.projetado > 0, mesIdx: i };
    }),
  })), [totaisGrupo, dadosMensais, SERIES]);

  // ── Helpers da tabela Fluxo Mensal ───────────────────────────────────────
  const MACROS = [
    { grupo: GRUPOS.FIXAS,        label: 'Desp. Fixas', cor: C.grupoFixas        },
    { grupo: GRUPOS.CONSUMO,      label: 'Consumo',     cor: C.grupoConsumo      },
    { grupo: GRUPOS.DIVIDAS,      label: 'Dívidas',     cor: C.grupoDividas      },
    { grupo: GRUPOS.INVESTIMENTOS,label: 'Invest.',     cor: C.grupoInvestimentos},
  ];

  const totalsMacroReal = MACROS.map(m =>
    dadosMensais.reduce((acc, d, i) => acc + (d.temReal ? totaisGrupo(m.grupo, i).realizado : 0), 0));
  const totalsMacroTodo = MACROS.map(m =>
    dadosMensais.reduce((acc, d, i) => {
      const t = totaisGrupo(m.grupo, i);
      return acc + (d.temReal ? t.realizado : t.projetado);
    }, 0));

  const totalSaldoReal = totaisAnuais.saldoReal;
  const totalSaldoTodo = dadosMensais.reduce((acc, d) => acc + (d.temReal ? d.saldoReal : d.saldoProj), 0);
  const totalRecReal   = totaisAnuais.recReal;
  const totalRecTodo   = dadosMensais.reduce((acc, d) => acc + (d.temReal ? d.recReal : d.recProj), 0);

  const Pct = ({ valor, base }) => {
    if (!base || base < 1 || !valor) return null;
    const p = Math.round(valor / base * 100);
    if (!p) return null;
    return (
      <span style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 500, marginLeft: 6, opacity: 0.75 }}>
        {(valor < 0 ? '-' : '') + Math.abs(p) + '%'}
      </span>
    );
  };

  const TotalCell = ({ real, todo, cor }) => (
    <td style={{ padding: '13px 12px', textAlign: 'right', verticalAlign: 'middle' }}>
      <div style={{ fontWeight: 800, color: cor, fontSize: FONT.sm }}>{fmtBRL(real)}</div>
      {Math.abs(todo - real) > 0.5 && (
        <div style={{ fontWeight: 500, color: C.textMuted, fontSize: FONT.sm, fontStyle: 'italic', marginTop: 2, opacity: 0.7 }}>
          {fmtBRL(todo)}
        </div>
      )}
    </td>
  );

  const thStyle = (center) => ({
    padding: '10px 12px', textAlign: center ? 'center' : 'right',
    color: C.textMuted, fontWeight: 600, fontSize: FONT.xs,
    borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
  });

  return (
    <>
      {/* ── KPIs anuais ──────────────────────────────────────────────────── */}
      <div className="mb-grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
        <KPICard label="Receitas no Ano"    value={fmtBRL(totaisAnuais.recReal)}  sub={`Proj: ${fmtBRL(totaisAnuais.recProj)}`}  color={C.rec} />
        <KPICard label="Despesas no Ano"    value={fmtBRL(totaisAnuais.despReal)} sub={`Proj: ${fmtBRL(totaisAnuais.despProj)}`} color={C.desp} />
        <KPICard label="Saldo Acumulado"    value={fmtBRL(totaisAnuais.saldoReal)} sub={`Proj: ${fmtBRL(totaisAnuais.saldoProj)}`}
          color={totaisAnuais.saldoReal >= 0 ? C.rec : C.desp} />
        <KPICard label="Média Mensal (Saldo)"
          value={fmtBRL(mesesComReal > 0 ? totaisAnuais.saldoReal / mesesComReal : 0)}
          sub={`${mesesComReal} meses realizados`}
          color={totaisAnuais.saldoReal >= 0 ? C.rec : C.desp} />
        <KPICard label="Taxa de Economia"
          value={totaisAnuais.recReal > 0 ? `${((totaisAnuais.saldoReal / totaisAnuais.recReal) * 100).toFixed(1)}%` : '—'}
          sub={totaisAnuais.recReal > 0 && (totaisAnuais.saldoReal / totaisAnuais.recReal) >= 0.1 ? 'Meta atingida' : 'Abaixo de 10%'}
          color={totaisAnuais.recReal > 0 && (totaisAnuais.saldoReal / totaisAnuais.recReal) >= 0.1 ? C.green : C.yellow} />
      </div>

      {/* ── Gráfico de Linhas + Parcelamentos (lado a lado) ──────────────── */}
      <div className="mb-grid-main" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 20 }}>
        <GraficoLinhas seriesData={seriesData} dadosMensais={dadosMensais} onMesClick={onMesClick} anoAtivo={anoAtivo} />
        <GraficoParcelamentos totalParcelasFut={totalParcelasFut} anoAtivo={anoAtivo} />
      </div>

      {/* ── Gráfico de Barras ────────────────────────────────────────────── */}
      <GraficoBarras dadosMensais={dadosMensais} maxBarValue={maxBarValue} onMesClick={onMesClick}
        anoAtivo={anoAtivo} projetadoPorMes={projetadoPorMes} totalParcelasFut={totalParcelasFut} />

      {/* ── Gráfico de Gastos por Conta ──────────────────────────────────── */}
      <GraficoContasMensais contas={contas} despesasPorMesConta={despesasPorMesConta}
        parcelasFuturasPorConta={parcelasFuturasPorConta} projetadoPorMes={projetadoPorMes}
        dadosMensais={dadosMensais} onMesClick={onMesClick} anoAtivo={anoAtivo} />

      {/* ── Tabela Fluxo Mensal ───────────────────────────────────────────── */}
      <Card padding="0" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text }}>Fluxo Mensal</div>
          <div style={{ fontSize: FONT.xs, color: C.textMuted }}>Clique em um mês para ver o detalhe</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONT.sm }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ ...thStyle(false), textAlign: 'left' }}>Mês</th>
              <th style={thStyle(false)}>Receitas</th>
              {MACROS.map(m => <th key={m.grupo} style={{ ...thStyle(false), color: m.cor }}>{m.label}</th>)}
              <th style={thStyle(false)}>Saldo</th>
              <th style={thStyle(true)}>Status</th>
            </tr>
          </thead>
          <tbody>
            {dadosMensais.map((d, i) => {
              const isProj     = !d.temReal;
              const statusIcon = d.temReal ? (d.saldoReal >= 0 ? '✓' : '✕') : (d.recProj > 0 || d.despProj > 0 ? 'proj.' : '—');
              const recBase    = d.temReal ? d.recReal : d.recProj;
              const macroVals  = MACROS.map(m => {
                const t = totaisGrupo(m.grupo, i);
                return { v: d.temReal ? t.realizado : t.projetado };
              });
              const saldo    = d.temReal ? d.saldoReal : d.saldoProj;
              const saldoCor = saldo >= 0 ? C.rec : C.desp;
              return (
                <tr key={i} onClick={() => onMesClick(i)}
                  style={{ borderBottom: `1px solid ${C.border}20`, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.brand + '12'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '11px 12px', fontWeight: d.temReal ? 700 : 500, color: d.temReal ? C.text : C.textMuted }}>
                    {d.mesFull}
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: d.temReal ? 600 : 400, fontStyle: isProj ? 'italic' : 'normal', color: d.temReal ? C.rec : C.textMuted }}>
                    {d.temReal ? fmtBRL(d.recReal) : (d.recProj > 0 ? fmtBRL(d.recProj) : '—')}
                  </td>
                  {macroVals.map((mv, mi) => (
                    <td key={mi} style={{ padding: '11px 12px', textAlign: 'right', fontWeight: d.temReal ? 600 : 400, fontStyle: isProj ? 'italic' : 'normal', color: mv.v > 0 ? (d.temReal ? MACROS[mi].cor : C.textMuted) : C.textDim }}>
                      {mv.v > 0 ? <>{fmtBRL(mv.v)}<Pct valor={mv.v} base={recBase} /></> : '—'}
                    </td>
                  ))}
                  <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, fontStyle: isProj ? 'italic' : 'normal', color: isProj ? C.textMuted : saldoCor }}>
                    {saldo !== 0 ? <>{fmtBRL(saldo)}<Pct valor={saldo} base={recBase} /></> : '—'}
                  </td>
                  <td style={{ padding: '11px 12px', textAlign: 'center', fontSize: FONT.base }}>
                    {statusIcon}
                    {isProj && <span style={{ fontSize: FONT.xs, color: C.textMuted, marginLeft: 4 }}>proj.</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: C.brand + '14', borderTop: `2px solid ${C.brand}30` }}>
              <td style={{ padding: '13px 12px', fontWeight: 800, color: C.text, fontSize: FONT.sm }}>TOTAL</td>
              <TotalCell real={totalRecReal} todo={totalRecTodo} cor={C.rec} />
              {MACROS.map((m, mi) => (
                <TotalCell key={mi} real={totalsMacroReal[mi]} todo={totalsMacroTodo[mi]} cor={m.cor} />
              ))}
              <TotalCell real={totalSaldoReal} todo={totalSaldoTodo} cor={totalSaldoReal >= 0 ? C.rec : C.desp} />
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>
    </>
  );
}
