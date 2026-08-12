/**
 * ModalMetas.jsx — Modal de edição de metas orçamentárias
 *
 * Colunas por linha:
 *   • Input da meta atual
 *   • Meta mês anterior (referência)
 *   • Meta mesmo mês ano anterior (referência)
 *
 * Footer:
 *   • Total corrente (soma dos inputs)
 *   • "Editar total" — link que mostra déficit/superávit em relação ao total digitado
 *     NÃO distribui proporcionalmente — o planejador ajusta individualmente
 *
 * Hierarquia: Categoria (nível 2) → Subcategorias (inputs individuais)
 */
import { useState, useMemo, useCallback } from 'react';
import { X, Info, ChevronDown, ChevronRight } from 'lucide-react';
import { C, FONT, RADIUS, SHADOW } from '../../design/tokens.js';
import { fmtBRL, Btn } from '../UI.jsx';
import { GRUPOS, CATEGORIAS_PADRAO } from '../../data/categorias.js';

// ── Helper: converte string monetária para número ─────────────────────────────
function parseBRL(str) {
  if (!str && str !== 0) return 0;
  const s = String(str).replace(/[R$\s.]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function formatInput(val) {
  if (!val && val !== 0) return '';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

// ── Input de meta individual ──────────────────────────────────────────────────
function MetaInput({ subcatId, valor, onChange }) {
  const [focused, setFocused] = useState(false);
  const [localVal, setLocalVal] = useState(() => valor > 0 ? formatInput(valor) : '');

  const handleFocus = (e) => {
    setFocused(true);
    // Remove formatação ao focar
    setLocalVal(valor > 0 ? String(valor) : '');
    setTimeout(() => e.target.select(), 0);
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseBRL(localVal);
    onChange(subcatId, parsed);
    setLocalVal(parsed > 0 ? formatInput(parsed) : '');
  };

  const handleChange = (e) => {
    // Permite apenas dígitos, vírgula e ponto
    const raw = e.target.value.replace(/[^0-9,.]/g, '');
    setLocalVal(raw);
  };

  return (
    <input
      type="text"
      value={localVal}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder="0,00"
      style={{
        width: '100%',
        background: 'var(--c-bg)',
        border: `1px solid ${focused ? 'var(--c-brand, #00B8A9)' : 'var(--c-border)'}`,
        borderRadius: RADIUS.sm,
        padding: '6px 10px',
        color: 'var(--c-text)',
        fontSize: FONT.sm,
        fontFamily: 'inherit',
        outline: 'none',
        textAlign: 'right',
        transition: 'border-color 0.15s',
        boxSizing: 'border-box',
      }}
    />
  );
}

// ── Linha de subcategoria no modal ────────────────────────────────────────────
function LinhaSubcatModal({
  sub, metaAtual, metaMesAnterior, metaAnoAnterior, onChangeMeta,
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 160px 120px 120px',
      gap: 8,
      padding: '7px 0',
      borderBottom: '1px solid var(--c-border)',
      alignItems: 'center',
    }}>
      <span style={{
        fontSize: FONT.sm, color: 'var(--c-text-muted)',
        paddingLeft: 16,
      }}>
        {sub.nome}
      </span>
      <MetaInput subcatId={sub.id} valor={metaAtual} onChange={onChangeMeta} />
      <span style={{ fontSize: FONT.sm, color: 'var(--c-text-dim)', textAlign: 'right' }}>
        {metaMesAnterior > 0 ? fmtBRL(metaMesAnterior) : '—'}
      </span>
      <span style={{ fontSize: FONT.sm, color: 'var(--c-text-dim)', textAlign: 'right' }}>
        {metaAnoAnterior > 0 ? fmtBRL(metaAnoAnterior) : '—'}
      </span>
    </div>
  );
}

// ── Seção por categoria (nível 2) ─────────────────────────────────────────────
function SecaoCategoriaModal({
  cat, subcats, metas, onChangeMeta, planejamento, anoStr, mes,
}) {
  const [aberta, setAberta] = useState(true);

  // Total desta categoria
  const totalCat = subcats.reduce((acc, s) => acc + (metas[s.id] || 0), 0);

  // Meta mês anterior
  const mesPrev = mes === 0 ? 11 : mes - 1;
  const anoPrevStr = mes === 0 ? String(Number(anoStr) - 1) : anoStr;
  // Meta mesmo mês ano anterior
  const anoAntStr = String(Number(anoStr) - 1);

  const metaMesAnteriorCat = subcats.reduce((acc, s) => {
    return acc + (planejamento?.[anoPrevStr]?.[mesPrev]?.[s.id]?.projetado || 0);
  }, 0);
  const metaAnoAnteriorCat = subcats.reduce((acc, s) => {
    return acc + (planejamento?.[anoAntStr]?.[mes]?.[s.id]?.projetado || 0);
  }, 0);

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Header da categoria */}
      <div
        onClick={() => setAberta(a => !a)}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 160px 120px 120px',
          gap: 8,
          padding: '9px 0',
          cursor: 'pointer',
          background: 'var(--c-bg-mid)',
          alignItems: 'center',
          borderRadius: RADIUS.sm,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-card-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--c-bg-mid)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {aberta
            ? <ChevronDown size={13} color="var(--c-text-muted)" />
            : <ChevronRight size={13} color="var(--c-text-muted)" />}
          <span style={{ fontSize: FONT.base, fontWeight: 700, color: 'var(--c-text)' }}>
            {cat.nome}
          </span>
        </div>
        <span style={{ fontSize: FONT.sm, fontWeight: 700, color: 'var(--c-text)', textAlign: 'right' }}>
          {totalCat > 0 ? fmtBRL(totalCat) : <span style={{ color: 'var(--c-text-dim)', fontWeight: 400 }}>—</span>}
        </span>
        <span style={{ fontSize: FONT.sm, color: 'var(--c-text-dim)', textAlign: 'right' }}>
          {metaMesAnteriorCat > 0 ? fmtBRL(metaMesAnteriorCat) : '—'}
        </span>
        <span style={{ fontSize: FONT.sm, color: 'var(--c-text-dim)', textAlign: 'right' }}>
          {metaAnoAnteriorCat > 0 ? fmtBRL(metaAnoAnteriorCat) : '—'}
        </span>
      </div>

      {/* Subcategorias */}
      {aberta && subcats.map(sub => {
        const mesPrevStr = anoStr;
        const metaAnterior = planejamento?.[anoPrevStr]?.[mesPrev]?.[sub.id]?.projetado || 0;
        const metaAnoAnt   = planejamento?.[anoAntStr]?.[mes]?.[sub.id]?.projetado || 0;
        return (
          <LinhaSubcatModal
            key={sub.id}
            sub={sub}
            metaAtual={metas[sub.id] || 0}
            metaMesAnterior={metaAnterior}
            metaAnoAnterior={metaAnoAnt}
            onChangeMeta={onChangeMeta}
          />
        );
      })}
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
export function ModalMetas({
  open,
  onClose,
  grupo,
  mes,            // 0-11
  anoStr,         // '2025'
  planejamento,
  onSalvar,       // (novasMetas: { [subcatId]: valor }) => void
  categorias,
}) {
  const cats = categorias || CATEGORIAS_PADRAO;

  // Categorias nível 2 do grupo
  const catsNivel2 = useMemo(() =>
    cats.filter(c => c.isCategoria === true && c.grupo === grupo && !c.oculto),
    [cats, grupo]
  );

  // Subcategorias por categoria
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

  // Estado das metas (inicializa com os valores atuais do planejamento)
  const [metas, setMetas] = useState(() => {
    const m = {};
    for (const cat of catsNivel2) {
      for (const sub of (subcatsPorCat[cat.id] || [])) {
        m[sub.id] = planejamento?.[anoStr]?.[mes]?.[sub.id]?.projetado || 0;
      }
    }
    return m;
  });

  // Reset ao reabrir
  const resetMetas = useCallback(() => {
    const m = {};
    for (const cat of catsNivel2) {
      for (const sub of (subcatsPorCat[cat.id] || [])) {
        m[sub.id] = planejamento?.[anoStr]?.[mes]?.[sub.id]?.projetado || 0;
      }
    }
    setMetas(m);
    setEditarTotal(false);
    setTotalDesejado('');
  }, [catsNivel2, subcatsPorCat, planejamento, anoStr, mes]);

  // Total atual dos inputs
  const totalAtual = useMemo(() =>
    Object.values(metas).reduce((acc, v) => acc + (v || 0), 0),
    [metas]
  );

  // Estado para "Editar total"
  const [editarTotal, setEditarTotal] = useState(false);
  const [totalDesejado, setTotalDesejado] = useState('');
  const totalDesejadoNum = parseBRL(totalDesejado);
  const diferenca = editarTotal && totalDesejado
    ? totalDesejadoNum - totalAtual
    : null;

  const handleChangeMeta = useCallback((subcatId, valor) => {
    setMetas(prev => ({ ...prev, [subcatId]: valor }));
  }, []);

  const handleSalvar = () => {
    onSalvar(metas);
    onClose();
  };

  if (!open) return null;

  const nomeGrupo = grupo;
  const mesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--c-card)',
        border: '1px solid var(--c-border)',
        borderRadius: RADIUS.xl,
        width: '760px',
        maxWidth: '98vw',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: SHADOW.modal,
      }}>
        {/* Header do modal */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--c-border)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: FONT.xl, fontWeight: 800, color: 'var(--c-text)' }}>
              Metas — {nomeGrupo}
            </div>
            <div style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', marginTop: 2 }}>
              {mesNomes[mes]} {anoStr}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--c-border)',
              borderRadius: RADIUS.sm, color: 'var(--c-text-muted)',
              cursor: 'pointer', width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Cabeçalho das colunas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 160px 120px 120px',
          gap: 8,
          padding: '8px 24px',
          background: 'var(--c-bg-mid)',
          borderBottom: '1px solid var(--c-border)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: FONT.xs, color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Categoria
          </span>
          <span style={{ fontSize: FONT.xs, color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>
            Meta {mesNomes[mes]}
          </span>
          <span style={{ fontSize: FONT.xs, color: 'var(--c-text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>
            Mês anterior
          </span>
          <span style={{ fontSize: FONT.xs, color: 'var(--c-text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>
            {mesNomes[mes]} {Number(anoStr) - 1}
          </span>
        </div>

        {/* Corpo scrollável */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 24px',
        }}>
          {catsNivel2.map(cat => (
            <SecaoCategoriaModal
              key={cat.id}
              cat={cat}
              subcats={subcatsPorCat[cat.id] || []}
              metas={metas}
              onChangeMeta={handleChangeMeta}
              planejamento={planejamento}
              anoStr={anoStr}
              mes={mes}
            />
          ))}
        </div>

        {/* Footer com total */}
        <div style={{
          borderTop: '2px solid var(--c-border-light)',
          padding: '16px 24px',
          flexShrink: 0,
          background: 'var(--c-bg-mid)',
        }}>
          {/* Linha do total */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: editarTotal ? 12 : 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: FONT.base, color: 'var(--c-text)', fontWeight: 700 }}>
                Total do mês:
              </span>
              <span style={{ fontSize: FONT.xl, fontWeight: 800, color: 'var(--c-text)' }}>
                {fmtBRL(totalAtual)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Link "Editar total" */}
              <button
                onClick={() => {
                  setEditarTotal(e => !e);
                  setTotalDesejado('');
                }}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--c-brand, #00B8A9)',
                  fontSize: FONT.sm, fontWeight: 600,
                  cursor: 'pointer', padding: 0,
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                }}
              >
                {editarTotal ? 'Fechar' : 'Editar total'}
              </button>
              <button
                onClick={resetMetas}
                style={{
                  background: 'none', border: '1px solid var(--c-border)',
                  borderRadius: RADIUS.sm,
                  color: 'var(--c-text-muted)',
                  fontSize: FONT.sm,
                  cursor: 'pointer', padding: '5px 12px',
                  fontFamily: 'inherit',
                }}
              >
                Resetar
              </button>
              <Btn onClick={handleSalvar} variant="primary" size="sm">
                Salvar metas
              </Btn>
            </div>
          </div>

          {/* Seção "Editar total" */}
          {editarTotal && (
            <div style={{
              background: 'var(--c-card)',
              border: '1px solid var(--c-border)',
              borderRadius: RADIUS.md,
              padding: '14px 16px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              }}>
                <Info size={14} color="var(--c-text-muted)" />
                <span style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)' }}>
                  Informe o total desejado para ver o déficit ou superávit. Ajuste individualmente nas categorias acima.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Total desejado:
                </label>
                <input
                  type="text"
                  value={totalDesejado}
                  onChange={e => setTotalDesejado(e.target.value.replace(/[^0-9,.]/g, ''))}
                  placeholder="0,00"
                  style={{
                    background: 'var(--c-bg)',
                    border: '1px solid var(--c-border)',
                    borderRadius: RADIUS.sm,
                    padding: '8px 12px',
                    color: 'var(--c-text)',
                    fontSize: FONT.base,
                    fontFamily: 'inherit',
                    outline: 'none',
                    width: 160,
                    textAlign: 'right',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--c-brand, #00B8A9)'}
                  onBlur={e => e.target.style.borderColor = 'var(--c-border)'}
                />
                {diferenca !== null && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px',
                    borderRadius: RADIUS.md,
                    background: diferenca < 0 ? 'var(--c-desp-bg)' : diferenca > 0 ? 'var(--c-rec-bg)' : 'var(--c-bg-mid)',
                    border: `1px solid ${diferenca < 0 ? '#F8717140' : diferenca > 0 ? '#22D3A040' : 'var(--c-border)'}`,
                  }}>
                    <span style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)' }}>
                      {diferenca < 0 ? 'Déficit:' : diferenca > 0 ? 'Superávit:' : 'Equilibrado'}
                    </span>
                    {diferenca !== 0 && (
                      <span style={{
                        fontSize: FONT.base,
                        fontWeight: 700,
                        color: diferenca < 0 ? '#F87171' : '#22D3A0',
                      }}>
                        {fmtBRL(Math.abs(diferenca))}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
