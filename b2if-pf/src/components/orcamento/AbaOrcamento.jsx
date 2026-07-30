/**
 * AbaOrcamento.jsx — Aba de orçamento por grupo (Receitas / Fixas / Consumo / Dívidas)
 *
 * Estrutura: Macro → Categoria (nível 2, expansível) → Subcategoria (nível 3)
 * Colunas: Meta | Realizado | A Realizar | Excedente
 * Barra de progresso: verde < 80%, amarelo 80–100%, vermelho > 100%
 *   (lógica invertida para Receitas)
 * Botão flutuante ✏️ (bottom-right) abre ModalMetas
 */
import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens.js';
import { ProgressBar, fmtBRL, Empty } from '../UI.jsx';
import { GRUPOS, CATEGORIAS_PADRAO } from '../../data/categorias.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Determina a cor da barra de progresso baseada em % e se é receita
 * isReceita=true: verde quando > 100% (recebeu mais que a meta), vermelho quando < 60%
 * isReceita=false: verde < 80%, amarelo 80–100%, vermelho > 100%
 */
function corBarra(pct, isReceita) {
  if (isReceita) {
    if (pct >= 100) return '#4ADE80';  // recebeu tudo ou mais — ótimo
    if (pct >= 60)  return '#FBBF24';  // parcialmente recebido
    return '#F87171';                   // recebeu pouco
  }
  if (pct > 100) return '#F87171';     // estourou o orçamento
  if (pct >= 80)  return '#FBBF24';    // quase no limite
  return '#4ADE80';                    // dentro do orçamento
}

// ── Linha de subcategoria ─────────────────────────────────────────────────────
function LinhaSubcat({ subcat, mes, anoStr, planejamento, realizadoPorMes, isReceita }) {
  const planMes = planejamento?.[anoStr]?.[mes]?.[subcat.id] || {};
  const meta     = planMes.projetado || 0;
  const realizado = (realizadoPorMes?.[mes]?.[subcat.id]) || 0;
  const aRealizar = Math.max(meta - realizado, 0);
  const excedente = Math.max(realizado - meta, 0);
  const pct = meta > 0 ? (realizado / meta) * 100 : (realizado > 0 ? 999 : 0);
  const cor = corBarra(pct, isReceita);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 110px 110px 110px 110px 180px',
      gap: 0,
      padding: '8px 16px 8px 40px',
      borderBottom: '1px solid var(--c-border)',
      alignItems: 'center',
      background: 'var(--c-bg)',
    }}>
      {/* Nome da subcategoria */}
      <span style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)' }}>
        {subcat.nome}
      </span>

      {/* Meta */}
      <span style={{ fontSize: FONT.sm, color: 'var(--c-text)', textAlign: 'right', paddingRight: 16, fontWeight: meta > 0 ? 600 : 400 }}>
        {meta > 0 ? fmtBRL(meta) : <span style={{ color: 'var(--c-text-dim)' }}>—</span>}
      </span>

      {/* Realizado */}
      <span style={{
        fontSize: FONT.sm,
        color: realizado > 0 ? 'var(--c-text)' : 'var(--c-text-dim)',
        textAlign: 'right', paddingRight: 16, fontWeight: realizado > 0 ? 600 : 400,
      }}>
        {realizado > 0 ? fmtBRL(realizado) : '—'}
      </span>

      {/* A Realizar */}
      <span style={{
        fontSize: FONT.sm,
        color: aRealizar > 0 ? '#60A5FA' : 'var(--c-text-dim)',
        textAlign: 'right', paddingRight: 16,
      }}>
        {aRealizar > 0 ? fmtBRL(aRealizar) : '—'}
      </span>

      {/* Excedente */}
      <span style={{
        fontSize: FONT.sm,
        color: excedente > 0 ? '#F87171' : 'var(--c-text-dim)',
        textAlign: 'right', paddingRight: 16,
        fontWeight: excedente > 0 ? 600 : 400,
      }}>
        {excedente > 0 ? fmtBRL(excedente) : '—'}
      </span>

      {/* Progress bar */}
      <div style={{ paddingRight: 8 }}>
        <ProgressBar
          value={realizado}
          max={meta}
          height={5}
          isReceita={isReceita}
          color={meta > 0 ? cor : undefined}
        />
        {meta > 0 && (
          <div style={{ fontSize: '10px', color: 'var(--c-text-dim)', marginTop: 2, textAlign: 'right' }}>
            {pct > 999 ? '>100' : pct.toFixed(0)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ── Linha de categoria (nível 2) ──────────────────────────────────────────────
function LinhaCategoria({ cat, subcats, mes, anoStr, planejamento, realizadoPorMes, isReceita, expandida, onToggle }) {
  // Totais da categoria
  const totais = useMemo(() => {
    let meta = 0, realizado = 0;
    for (const sub of subcats) {
      const planMes = planejamento?.[anoStr]?.[mes]?.[sub.id] || {};
      meta      += planMes.projetado || 0;
      realizado += realizadoPorMes?.[mes]?.[sub.id] || 0;
    }
    const aRealizar = Math.max(meta - realizado, 0);
    const excedente = Math.max(realizado - meta, 0);
    const pct = meta > 0 ? (realizado / meta) * 100 : (realizado > 0 ? 999 : 0);
    return { meta, realizado, aRealizar, excedente, pct };
  }, [subcats, mes, anoStr, planejamento, realizadoPorMes]);

  const cor = corBarra(totais.pct, isReceita);
  const temDados = totais.meta > 0 || totais.realizado > 0;

  return (
    <>
      {/* Linha da categoria */}
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 110px 110px 110px 110px 180px',
          gap: 0,
          padding: '10px 16px',
          borderBottom: '1px solid var(--c-border)',
          alignItems: 'center',
          cursor: 'pointer',
          background: expandida ? 'var(--c-bg-mid)' : 'var(--c-card)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-card-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = expandida ? 'var(--c-bg-mid)' : 'var(--c-card)'}
      >
        {/* Nome da categoria com chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {expandida
            ? <ChevronDown size={14} color="var(--c-text-muted)" />
            : <ChevronRight size={14} color="var(--c-text-muted)" />}
          <span style={{
            fontSize: FONT.base,
            fontWeight: 600,
            color: 'var(--c-text)',
          }}>
            {cat.nome}
          </span>
          <span style={{
            fontSize: FONT.xs,
            color: 'var(--c-text-dim)',
            marginLeft: 4,
          }}>
            ({subcats.length})
          </span>
        </div>

        {/* Meta total */}
        <span style={{ fontSize: FONT.base, color: 'var(--c-text)', textAlign: 'right', paddingRight: 16, fontWeight: 700 }}>
          {totais.meta > 0 ? fmtBRL(totais.meta) : <span style={{ color: 'var(--c-text-dim)', fontWeight: 400 }}>—</span>}
        </span>

        {/* Realizado total */}
        <span style={{
          fontSize: FONT.base,
          color: totais.realizado > 0 ? 'var(--c-text)' : 'var(--c-text-dim)',
          textAlign: 'right', paddingRight: 16, fontWeight: totais.realizado > 0 ? 700 : 400,
        }}>
          {totais.realizado > 0 ? fmtBRL(totais.realizado) : '—'}
        </span>

        {/* A Realizar total */}
        <span style={{
          fontSize: FONT.base,
          color: totais.aRealizar > 0 ? '#60A5FA' : 'var(--c-text-dim)',
          textAlign: 'right', paddingRight: 16, fontWeight: totais.aRealizar > 0 ? 600 : 400,
        }}>
          {totais.aRealizar > 0 ? fmtBRL(totais.aRealizar) : '—'}
        </span>

        {/* Excedente total */}
        <span style={{
          fontSize: FONT.base,
          color: totais.excedente > 0 ? '#F87171' : 'var(--c-text-dim)',
          textAlign: 'right', paddingRight: 16, fontWeight: totais.excedente > 0 ? 700 : 400,
        }}>
          {totais.excedente > 0 ? fmtBRL(totais.excedente) : '—'}
        </span>

        {/* Progress bar da categoria */}
        <div style={{ paddingRight: 8 }}>
          {temDados ? (
            <>
              <ProgressBar
                value={totais.realizado}
                max={totais.meta}
                height={7}
                isReceita={isReceita}
                color={totais.meta > 0 ? cor : undefined}
              />
              {totais.meta > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--c-text-dim)', marginTop: 2, textAlign: 'right' }}>
                  {totais.pct > 999 ? '>100' : totais.pct.toFixed(0)}%
                </div>
              )}
            </>
          ) : (
            <div style={{ height: 7, borderRadius: 4, background: 'var(--c-border)' }} />
          )}
        </div>
      </div>

      {/* Subcategorias expandidas */}
      {expandida && subcats.map(sub => (
        <LinhaSubcat
          key={sub.id}
          subcat={sub}
          mes={mes}
          anoStr={anoStr}
          planejamento={planejamento}
          realizadoPorMes={realizadoPorMes}
          isReceita={isReceita}
        />
      ))}
    </>
  );
}

// ── Linha de total do grupo ───────────────────────────────────────────────────
function LinhaTotalGrupo({ label, meta, realizado, aRealizar, excedente, isReceita, cor }) {
  const pct = meta > 0 ? (realizado / meta) * 100 : 0;
  const fillCor = cor || corBarra(pct, isReceita);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 110px 110px 110px 110px 180px',
      gap: 0,
      padding: '12px 16px',
      alignItems: 'center',
      background: 'var(--c-bg-mid)',
      borderTop: '2px solid var(--c-border-light)',
    }}>
      <span style={{ fontSize: FONT.base, fontWeight: 800, color: 'var(--c-text)', letterSpacing: '0.02em' }}>
        {label}
      </span>
      <span style={{ fontSize: FONT.base, fontWeight: 800, color: 'var(--c-text)', textAlign: 'right', paddingRight: 16 }}>
        {meta > 0 ? fmtBRL(meta) : '—'}
      </span>
      <span style={{ fontSize: FONT.base, fontWeight: 800, color: 'var(--c-text)', textAlign: 'right', paddingRight: 16 }}>
        {realizado > 0 ? fmtBRL(realizado) : '—'}
      </span>
      <span style={{ fontSize: FONT.base, fontWeight: 700, color: aRealizar > 0 ? '#60A5FA' : 'var(--c-text-dim)', textAlign: 'right', paddingRight: 16 }}>
        {aRealizar > 0 ? fmtBRL(aRealizar) : '—'}
      </span>
      <span style={{ fontSize: FONT.base, fontWeight: 700, color: excedente > 0 ? '#F87171' : 'var(--c-text-dim)', textAlign: 'right', paddingRight: 16 }}>
        {excedente > 0 ? fmtBRL(excedente) : '—'}
      </span>
      <div style={{ paddingRight: 8 }}>
        <ProgressBar value={realizado} max={meta} height={8} isReceita={isReceita} color={meta > 0 ? fillCor : undefined} />
        {meta > 0 && (
          <div style={{ fontSize: '10px', color: 'var(--c-text-dim)', marginTop: 2, textAlign: 'right' }}>
            {pct.toFixed(0)}%
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function AbaOrcamento({
  grupo,           // string: GRUPOS.RECEITAS | GRUPOS.FIXAS | ...
  mes,             // 0-11
  anoStr,          // '2025'
  planejamento,    // clienteAtivo.planejamento
  realizadoPorMes, // { [mes]: { [catId]: valor } }
  onEditarMetas,   // () => void — abre ModalMetas
  categorias,      // clienteAtivo.categorias (completa, com customizações)
  grupoColor,      // string — cor do grupo para header
}) {
  const [expandidas, setExpandidas] = useState(new Set());
  const isReceita = grupo === GRUPOS.RECEITAS;

  // Filtra categorias do grupo (usa as do cliente, fallback para CATEGORIAS_PADRAO)
  const cats = categorias || CATEGORIAS_PADRAO;
  const catsNivel2 = useMemo(() =>
    cats.filter(c => c.isCategoria === true && c.grupo === grupo && !c.oculto),
    [cats, grupo]
  );
  const subcatsPorCat = useMemo(() => {
    const map = {};
    for (const c of catsNivel2) map[c.id] = [];
    for (const s of cats) {
      if (!s.isCategoria && s.grupo === grupo && !s.oculto && s.categoria) {
        if (map[s.categoria]) map[s.categoria].push(s);
      }
    }
    return map;
  }, [cats, catsNivel2, grupo]);

  // Totais do grupo
  const totaisGrupo = useMemo(() => {
    let meta = 0, realizado = 0;
    for (const cat of catsNivel2) {
      for (const sub of subcatsPorCat[cat.id] || []) {
        const planMes = planejamento?.[anoStr]?.[mes]?.[sub.id] || {};
        meta      += planMes.projetado || 0;
        realizado += realizadoPorMes?.[mes]?.[sub.id] || 0;
      }
    }
    return {
      meta,
      realizado,
      aRealizar: Math.max(meta - realizado, 0),
      excedente: Math.max(realizado - meta, 0),
    };
  }, [catsNivel2, subcatsPorCat, planejamento, anoStr, mes, realizadoPorMes]);

  const toggle = (id) => {
    setExpandidas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Cabeçalho das colunas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 110px 110px 110px 110px 180px',
        gap: 0,
        padding: '8px 16px',
        background: 'var(--c-bg-mid)',
        borderBottom: '1px solid var(--c-border)',
        borderTop: '1px solid var(--c-border)',
        zIndex: 1,
      }}>
        <span style={{ fontSize: FONT.xs, color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Categoria
        </span>
        {['Meta', 'Realizado', 'A Realizar', 'Excedente', 'Progresso'].map(col => (
          <span key={col} style={{
            fontSize: FONT.xs, color: 'var(--c-text-muted)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            textAlign: col === 'Progresso' ? 'left' : 'right',
            paddingRight: col === 'Progresso' ? 0 : 16,
          }}>
            {col}
          </span>
        ))}
      </div>

      {/* Categorias */}
      {catsNivel2.length === 0 ? (
        <Empty title="Nenhuma categoria" sub="Não há categorias configuradas para este grupo." />
      ) : (
        catsNivel2.map(cat => (
          <LinhaCategoria
            key={cat.id}
            cat={cat}
            subcats={subcatsPorCat[cat.id] || []}
            mes={mes}
            anoStr={anoStr}
            planejamento={planejamento}
            realizadoPorMes={realizadoPorMes}
            isReceita={isReceita}
            expandida={expandidas.has(cat.id)}
            onToggle={() => toggle(cat.id)}
          />
        ))
      )}

      {/* Total do grupo */}
      <LinhaTotalGrupo
        label={`Total ${grupo}`}
        meta={totaisGrupo.meta}
        realizado={totaisGrupo.realizado}
        aRealizar={totaisGrupo.aRealizar}
        excedente={totaisGrupo.excedente}
        isReceita={isReceita}
        cor={grupoColor}
      />

      {/* Botão de edição de metas — alinhado no rodapé do card */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--c-border)', background: 'var(--c-bg-mid)' }}>
        <button
          onClick={onEditarMetas}
          title="Editar metas"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 20px',
            borderRadius: RADIUS.md,
            background: 'var(--c-brand, #00B8A9)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: FONT.sm,
            fontWeight: 700,
            fontFamily: 'inherit',
            boxShadow: '0 2px 8px rgba(0,184,169,0.35)',
            transition: 'opacity 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,184,169,0.55)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,184,169,0.35)'; }}
        >
          <Pencil size={14} />
          Editar metas
        </button>
      </div>
    </div>
  );
}
