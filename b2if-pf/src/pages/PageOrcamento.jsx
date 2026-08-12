/**
 * PageOrcamento.jsx — Página de Orçamento Mensal
 *
 * Layout: padrão Bot WhatsApp — container centralizado, card com bordas
 * arredondadas, header + SeletorMes inline, tabs dentro do card.
 *
 * Padrão diamante: isolado em novos arquivos, sem tocar em código refatorado.
 * Design system: CSS vars (var(--c-xxx)), Lucide icons, sem emojis.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, ShoppingCart, CreditCard,
  BarChart2, LineChart, Wallet,
} from 'lucide-react';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens.js';
import { useApp } from '../context/AppContext.jsx';
import { Empty } from '../components/UI.jsx';
import { SeletorMes }       from '../components/orcamento/SeletorMes.jsx';
import { AbaOrcamento }     from '../components/orcamento/AbaOrcamento.jsx';
import { ModalMetas }       from '../components/orcamento/ModalMetas.jsx';
import { AbaInvestimentos } from '../components/orcamento/AbaInvestimentos.jsx';
import { AbaEvolucao }      from '../components/orcamento/AbaEvolucao.jsx';
import { GRUPOS, MESES_FULL } from '../data/categorias.js';

// ── Definição das abas (fora do componente — padrão diamante) ─────────────────
const ABAS_ORCAMENTO = [
  { id: 'receitas',      label: 'Receitas',        Icon: TrendingUp,   grupo: GRUPOS.RECEITAS      },
  { id: 'fixas',         label: 'Despesas Essenciais', Icon: TrendingDown, grupo: GRUPOS.FIXAS    },
  { id: 'consumo',       label: 'Consumo Mensal',  Icon: ShoppingCart, grupo: GRUPOS.CONSUMO       },
  { id: 'dividas',       label: 'Dívidas',         Icon: CreditCard,   grupo: GRUPOS.DIVIDAS       },
  { id: 'investimentos', label: 'Investimentos',   Icon: BarChart2,    grupo: GRUPOS.INVESTIMENTOS },
  { id: 'evolucao',      label: 'Evolução',        Icon: LineChart,    grupo: null                 },
];

// ── Cores por grupo ───────────────────────────────────────────────────────────
const GRUPO_COR = {
  [GRUPOS.RECEITAS]:      '#22D3A0',
  [GRUPOS.FIXAS]:         '#F87171',
  [GRUPOS.CONSUMO]:       '#FBBF24',
  [GRUPOS.DIVIDAS]:       '#C084FC',
  [GRUPOS.INVESTIMENTOS]: '#60A5FA',
};

// ── Agrupa realizados por mês/categoria ──────────────────────────────────────
function agruparRealizadoPorMes(transacoes, ano) {
  const map = {};
  if (!transacoes) return map;
  for (const t of transacoes) {
    const d = new Date(t.data);
    if (isNaN(d.getTime())) continue;
    if (d.getFullYear() !== ano) continue;
    const m = d.getMonth();
    const catId = t.categoria;
    if (!catId) continue;
    if (!map[m]) map[m] = {};
    map[m][catId] = (map[m][catId] || 0) + Math.abs(t.valor || 0);
  }
  return map;
}

// ── Agrupa realizados por ano/mês/cat (para Evolução) ────────────────────────
function agruparRealizadoPorAnoMes(transacoes) {
  const map = {};
  if (!transacoes) return map;
  for (const t of transacoes) {
    const d = new Date(t.data);
    if (isNaN(d.getTime())) continue;
    const a = String(d.getFullYear());
    const m = d.getMonth();
    const catId = t.categoria;
    if (!catId) continue;
    if (!map[a]) map[a] = {};
    if (!map[a][m]) map[a][m] = {};
    map[a][m][catId] = (map[a][m][catId] || 0) + Math.abs(t.valor || 0);
  }
  return map;
}

// ── Item de aba ───────────────────────────────────────────────────────────────
function AbaItem({ aba, ativa, onClick }) {
  const [hov, setHov] = useState(false);
  const cor = aba.grupo ? GRUPO_COR[aba.grupo] : '#60A5FA';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '10px 18px',
        border: 'none',
        borderBottom: ativa ? `2px solid ${cor}` : '2px solid transparent',
        background: 'transparent',
        color: ativa ? cor : hov ? 'var(--c-text)' : 'var(--c-text-muted)',
        fontFamily: FONT.family,
        fontSize: FONT.base,
        fontWeight: ativa ? 700 : 500,
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <aba.Icon size={14} />
      {aba.label}
    </button>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function PageOrcamento() {
  const { clienteAtivo, patchClienteAtivo, modoLeitura } = useApp();

  const [mes, setMes]         = useState(new Date().getMonth());
  const [ano, setAno]         = useState(new Date().getFullYear());
  const [abaAtiva, setAbaAtiva] = useState('receitas');
  const [modalMetas, setModalMetas] = useState(false);

  if (!clienteAtivo) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--c-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Empty title="Nenhum cliente selecionado" sub="Selecione um cliente no Hub para acessar o Orçamento." />
      </div>
    );
  }

  const { transacoes, categorias, planejamento } = clienteAtivo;
  const anoStr = String(ano);

  const realizadoPorMes = useMemo(() =>
    agruparRealizadoPorMes(transacoes, ano),
    [transacoes, ano]
  );

  const realizadoPorAnoMes = useMemo(() =>
    agruparRealizadoPorAnoMes(transacoes),
    [transacoes]
  );

  const abaConfig = ABAS_ORCAMENTO.find(a => a.id === abaAtiva);

  const handleSalvarMetas = useCallback((novasMetas) => {
    if (modoLeitura) return;
    const planAtual = clienteAtivo.planejamento || {};
    const planAno   = { ...(planAtual[anoStr] || {}) };
    const planMes   = { ...(planAno[mes] || {}) };

    for (const [catId, valor] of Object.entries(novasMetas)) {
      if (valor > 0) {
        planMes[catId] = { ...(planMes[catId] || {}), projetado: valor };
      } else {
        const atual = planMes[catId];
        if (atual) {
          const { projetado, ...resto } = atual;
          if (Object.keys(resto).length > 0) planMes[catId] = resto;
          else delete planMes[catId];
        }
      }
    }

    planAno[mes] = planMes;
    patchClienteAtivo({ planejamento: { ...planAtual, [anoStr]: planAno } });
  }, [clienteAtivo, anoStr, mes, modoLeitura, patchClienteAtivo]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--c-bg)',
      fontFamily: FONT.family,
      padding: '32px 32px 80px',
    }}>
      {/* ── Container centralizado (padrão Dashboard — 1500px) ── */}
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>

        {/* ── Cabeçalho da página ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{
                fontSize: FONT.xl, fontWeight: 800,
                color: 'var(--c-text)', margin: 0,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Wallet size={22} color={C.brand} />
                Orçamento
              </h1>
              <p style={{
                fontSize: FONT.sm, color: 'var(--c-text-muted)',
                margin: '5px 0 0', lineHeight: 1.5,
              }}>
                {MESES_FULL[mes]} {ano} — {clienteAtivo.nome}
              </p>
            </div>
            <SeletorMes mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
          </div>
        </div>

        {/* ── Card principal com bordas arredondadas ── */}
        <div style={{
          background: 'var(--c-card)',
          border: '1px solid var(--c-border)',
          borderRadius: RADIUS.xl,
          boxShadow: SHADOW.card,
          overflow: 'hidden',
        }}>

          {/* Barra de abas dentro do card */}
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
            borderBottom: '1px solid var(--c-border)',
            overflowX: 'auto',
            padding: '0 8px',
            gap: 0,
            // Esconde scrollbar mantendo scroll funcional
            scrollbarWidth: 'none',
          }}>
            {ABAS_ORCAMENTO.map(aba => (
              <AbaItem
                key={aba.id}
                aba={aba}
                ativa={abaAtiva === aba.id}
                onClick={() => setAbaAtiva(aba.id)}
              />
            ))}
          </div>

          {/* Conteúdo da aba ativa */}
          <div style={{ position: 'relative' }}>
            {/* Abas de orçamento: Receitas, Fixas, Consumo, Dívidas */}
            {abaConfig && abaConfig.grupo && (
              <AbaOrcamento
                grupo={abaConfig.grupo}
                mes={mes}
                anoStr={anoStr}
                planejamento={planejamento}
                realizadoPorMes={realizadoPorMes}
                onEditarMetas={() => setModalMetas(true)}
                categorias={categorias}
                grupoColor={GRUPO_COR[abaConfig.grupo]}
              />
            )}

            {/* Aba Investimentos */}
            {abaAtiva === 'investimentos' && (
              <AbaInvestimentos
                mes={mes}
                anoStr={anoStr}
                clienteId={clienteAtivo.id}
                planejadorId={clienteAtivo.planejadorId}
                realizadoPorMes={realizadoPorMes}
              />
            )}

            {/* Aba Evolução */}
            {abaAtiva === 'evolucao' && (
              <AbaEvolucao
                planejamento={planejamento}
                realizadoPorAnoMes={realizadoPorAnoMes}
                categorias={categorias}
                clienteNome={clienteAtivo.nome}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modal de metas */}
      {abaConfig && abaConfig.grupo && (
        <ModalMetas
          open={modalMetas}
          onClose={() => setModalMetas(false)}
          grupo={abaConfig.grupo}
          mes={mes}
          anoStr={anoStr}
          planejamento={planejamento}
          onSalvar={handleSalvarMetas}
          categorias={categorias}
        />
      )}
    </div>
  );
}
