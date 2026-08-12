/**
 * SecaoPrevistoRealizado.jsx — Aba Previsto × Realizado do Planejador
 *
 * Extraído de PagePlanejador.jsx (Fase 2 — Strangler Fig)
 * Props: categorias, categoriasNivel2, planMes, realizadoMes, parcelasMes,
 *        gruposExibir, mesAtivo, anoAtivo, temProjecao
 */
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Card, fmtBRL } from '../UI.jsx';
import { grupoColor } from './helpers.jsx';

export function SecaoPrevistoRealizado({ categorias, categoriasNivel2, planMes, realizadoMes, parcelasMes, gruposExibir, mesAtivo, anoAtivo, temProjecao }) {
  if (!temProjecao) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: FONT.sm }}>
          Inicialize a projeção na aba Planejamento para ver o comparativo.
        </div>
      </Card>
    );
  }

  // Monta linhas por grupo → categoria nível2
  const linhas = [];
  for (const grupo of gruposExibir) {
    const cats2 = categoriasNivel2.filter(c => c.grupo === grupo);
    const subs = categorias.filter(c => c.grupo === grupo);
    const isReceita = grupo === 'Receitas';
    const cor = grupoColor(grupo);

    // Totais do grupo
    let gpPrev = 0, gpCompr = 0, gpReal = 0;
    for (const s of subs) {
      gpPrev  += planMes[s.id]?.projetado || 0;
      gpCompr += parcelasMes[s.id] || planMes[s.id]?.parcelas || 0;
      gpReal  += isReceita ? (realizadoMes[s.id]?.receita || 0) : (realizadoMes[s.id]?.despesa || 0);
    }
    linhas.push({ tipo: 'grupo', grupo, cor, prev: gpPrev, compr: gpCompr, real: gpReal, isReceita });

    // Linhas por categoria nível2
    for (const cat2 of cats2.sort((a,b) => a.nome.localeCompare(b.nome,'pt'))) {
      const subsC = subs.filter(s => s.categoria === cat2.id);
      if (!subsC.length) continue;
      let prev = 0, compr = 0, real = 0;
      for (const s of subsC) {
        prev  += planMes[s.id]?.projetado || 0;
        compr += parcelasMes[s.id] || planMes[s.id]?.parcelas || 0;
        real  += isReceita ? (realizadoMes[s.id]?.receita || 0) : (realizadoMes[s.id]?.despesa || 0);
      }
      if (prev === 0 && compr === 0 && real === 0) continue;
      linhas.push({ tipo: 'cat2', nome: cat2.nome, cor, prev, compr, real, isReceita });
    }
  }

  function pctStr(real, prev) {
    if (!prev) return real > 0 ? '>100%' : '—';
    return (real / prev * 100).toFixed(0) + '%';
  }
  function pctCor(real, prev, isReceita) {
    if (!prev) return C.textMuted;
    const p = real / prev;
    if (isReceita) return p >= 1 ? C.rec : p >= 0.8 ? C.warn : C.desp;
    return p >= 1 ? C.desp : p >= 0.85 ? C.warn : C.rec;
  }

  return (
    <div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: 'hidden' }}>
        {/* Cabeçalho */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 120px 70px', gap: 8, padding: '10px 16px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
          {['Categoria', 'Previsto', 'Comprometido', 'Realizado', 'Diferença', '%'].map((h, i) => (
            <span key={i} style={{ fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>

        {linhas.map((l, idx) => {
          const diff = l.isReceita ? (l.real - l.prev) : (l.prev - l.real - l.compr);
          const diffLabel = l.prev > 0 || l.real > 0 ? fmtBRL(diff) : '—';
          const diffCor = diff >= 0 ? C.rec : C.desp;
          const isGrupo = l.tipo === 'grupo';

          return (
            <div key={idx} style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 120px 120px 120px 70px', gap: 8,
              padding: isGrupo ? '10px 16px' : '8px 16px 8px 28px',
              background: isGrupo ? (l.cor + '12') : (idx % 2 === 0 ? 'transparent' : C.bg + '44'),
              borderTop: `1px solid ${l.cor}${isGrupo ? '35' : '18'}`,
            }}>
              <span style={{ fontSize: FONT.sm, fontWeight: isGrupo ? 700 : 500, color: isGrupo ? l.cor : C.text }}>
                {isGrupo ? l.grupo : l.nome}
              </span>
              <span style={{ fontSize: FONT.sm, textAlign: 'right', color: C.text, fontWeight: isGrupo ? 700 : 400 }}>
                {l.prev > 0 ? fmtBRL(l.prev) : '—'}
              </span>
              <span style={{ fontSize: FONT.sm, textAlign: 'right', color: l.compr > 0 ? '#C084FC' : C.textDim, fontWeight: l.compr > 0 ? 600 : 400 }}>
                {l.compr > 0 ? fmtBRL(l.compr) : '—'}
              </span>
              <span style={{ fontSize: FONT.sm, textAlign: 'right', color: l.real > 0 ? (l.isReceita ? C.rec : C.desp) : C.textDim, fontWeight: l.real > 0 ? 600 : 400 }}>
                {l.real > 0 ? fmtBRL(l.real) : '—'}
              </span>
              <span style={{ fontSize: FONT.sm, textAlign: 'right', fontWeight: isGrupo ? 700 : 600, color: (l.prev > 0 || l.real > 0) ? diffCor : C.textDim }}>
                {diffLabel}
              </span>
              <span style={{ fontSize: FONT.sm, textAlign: 'right', fontWeight: 700, color: pctCor(l.real, l.prev, l.isReceita) }}>
                {pctStr(l.real, l.prev)}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 12, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <span>📝 <strong style={{ color: C.text }}>Previsto</strong> = meta do mês</span>
        <span>💜 <strong style={{ color: '#C084FC' }}>Comprometido</strong> = parcelas futuras</span>
        <span>💰 <strong style={{ color: C.text }}>Diferença</strong> = sobra (despesas: previsto − compr − realizado)</span>
      </div>
    </div>
  );
}
