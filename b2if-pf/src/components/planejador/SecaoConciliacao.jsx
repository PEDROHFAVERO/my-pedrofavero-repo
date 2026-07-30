/**
 * SecaoConciliacao.jsx — Aba de Conciliação de Compromissos Fixos
 *
 * Extraído de PagePlanejador.jsx (Fase 2 — Strangler Fig)
 * Props: contasAPagar, categorias, transacoes, mesAtivo, anoAtivo, MESES_FULL
 */
import { CheckCircle2, Clock } from 'lucide-react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Card, fmtBRL } from '../UI.jsx';
import { KPIBox } from './helpers.jsx';

export function SecaoConciliacao({ contasAPagar, categorias, transacoes, mesAtivo, anoAtivo, MESES_FULL }) {
  const subcats = categorias.filter(c => !c.isCategoria);
  const anoMes = `${anoAtivo}-${String(mesAtivo + 1).padStart(2, '0')}`;
  const ativas = contasAPagar.filter(c => c.ativo !== false);

  // Para cada conta, verifica se há transação oficial no mês com a categoriaId da conta
  const linhas = ativas.map(conta => {
    const txs = (transacoes || []).filter(t => {
      const comp = String(t.competencia ?? '').slice(0, 7);
      return comp === anoMes && t.categoriaId === conta.categoriaId;
    });
    const pago = txs.length > 0;
    const valorPago = txs.reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0);
    const valorPrevisto = parseFloat(conta.valor) || 0;
    const diff = valorPago - valorPrevisto;
    const nomeCat = subcats.find(c => c.id === conta.categoriaId)?.nome || conta.categoriaId || '—';
    return { ...conta, pago, valorPago, valorPrevisto, diff, nomeCat, txCount: txs.length };
  });

  const totalPrevisto = linhas.reduce((s, l) => s + l.valorPrevisto, 0);
  const totalPago = linhas.reduce((s, l) => s + l.valorPago, 0);
  const pagas = linhas.filter(l => l.pago).length;

  if (ativas.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: FONT.sm }}>
          Cadastre compromissos fixos na aba <strong>Compromissos Fixos</strong> para habilitar a conciliação.
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPIBox label="Compromissos" value={`${ativas.length}`} color={C.text} />
        <KPIBox label="Pagos" value={`${pagas} / ${ativas.length}`} color={C.rec} />
        <KPIBox label="Total Previsto" value={fmtBRL(totalPrevisto)} color={C.desp} />
        <KPIBox label="Total Pago" value={fmtBRL(totalPago)} color={totalPago >= totalPrevisto ? C.rec : C.warn} />
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 130px 130px 110px 90px', gap: 8, padding: '8px 14px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
          {['Compromisso', 'Dia', 'Categoria', 'Previsto', 'Pago', 'Status'].map((h, i) => (
            <span key={i} style={{ fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>

        {linhas.map((l, idx) => {
          const statusLabel = l.pago ? 'Pago' : 'Pendente';
          const statusCor   = l.pago ? C.rec : C.desp;
          const statusIcon  = l.pago ? <CheckCircle2 size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} /> : <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />;
          return (
            <div key={l.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 100px 130px 130px 110px 90px', gap: 8,
              padding: '10px 14px', borderTop: idx > 0 ? `1px solid ${C.border}22` : 'none',
              background: idx % 2 === 0 ? 'transparent' : C.bg + '44',
              alignItems: 'center',
            }}>
              <div>
                <span style={{ fontSize: FONT.sm, fontWeight: 600, color: C.text }}>{l.nome}</span>
                {l.txCount > 1 && <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 6 }}>({l.txCount} txs)</span>}
              </div>
              <span style={{ fontSize: FONT.sm, color: C.textMuted }}>Dia {l.diaVencimento}</span>
              <span style={{ fontSize: FONT.xs, color: C.textMuted }}>{l.nomeCat}</span>
              <span style={{ fontSize: FONT.sm, fontWeight: 600, color: C.desp, textAlign: 'right' }}>{fmtBRL(l.valorPrevisto)}</span>
              <span style={{ fontSize: FONT.sm, fontWeight: 600, color: l.pago ? C.rec : C.textDim, textAlign: 'right' }}>
                {l.pago ? fmtBRL(l.valorPago) : '—'}
              </span>
              <span style={{ fontSize: FONT.sm, fontWeight: 700, color: statusCor, textAlign: 'right' }}>
                {statusIcon}{statusLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Rodapé informativo */}
      <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 12, lineHeight: 1.6 }}>
        ℹ️ Conciliação verifica se existe transação oficial (extrato importado) com a mesma categoria do compromisso em <strong style={{ color: C.text }}>{MESES_FULL[mesAtivo]}/{anoAtivo}</strong>.
        Apenas Despesas Essenciais cadastradas são conciliadas.
      </div>
    </div>
  );
}
