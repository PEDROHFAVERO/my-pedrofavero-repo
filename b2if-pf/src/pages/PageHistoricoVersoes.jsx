/**
 * PageHistoricoVersoes.jsx — Histórico de Versões do Cliente
 *
 * Equivalente ao Google Docs "Histórico de versões" — permite ao Planejador/Manager
 * ver todas as versões salvas e restaurar qualquer uma delas.
 *
 * ACESSO:
 *   - Planejador: sempre visível, pode restaurar
 *   - Manager: sempre visível, pode restaurar
 *   - Cliente editor: visível E pode restaurar (com snapshot pré-restauração)
 *   - Cliente visualizador: NÃO tem acesso
 *
 * FUNCIONALIDADES:
 *   - Timeline agrupada por data (hoje, ontem, datas anteriores)
 *   - Badge de autor (Planejador / Cliente / Manager / Sistema / Bot)
 *   - Resumo compacto por versão (tx total, categorizadas, pendentes)
 *   - Diff visual antes de restaurar (antes × depois)
 *   - Checkpoint manual permanente com nome customizado
 *   - Modal de confirmação de restauração com aviso claro
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Clock, RotateCcw, Pin, ChevronDown, ChevronUp,
  User, Shield, Bot, Cpu, AlertTriangle, CheckCircle,
  FileText, Upload, X, Bookmark, RefreshCw, Info,
} from 'lucide-react';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens.js';
import { useApp } from '../context/AppContext.jsx';
import {
  listarVersoes, restaurarVersao,
} from '../services/cliente/clienteService.js';

// ── Helpers de formatação ─────────────────────────────────────────────────────

function formatarData(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatarHora(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function labelDia(isoStr) {
  if (!isoStr) return '';
  const d      = new Date(isoStr);
  const hoje   = new Date();
  const ontem  = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
  const dStr   = d.toDateString();
  if (dStr === hoje.toDateString())  return 'Hoje';
  if (dStr === ontem.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function agruparPorDia(versoes) {
  const grupos = [];
  let diaAtual = null;
  let grupo    = null;
  for (const v of versoes) {
    const dia = new Date(v.criado_em).toDateString();
    if (dia !== diaAtual) {
      diaAtual = dia;
      grupo    = { dia, label: labelDia(v.criado_em), versoes: [] };
      grupos.push(grupo);
    }
    grupo.versoes.push(v);
  }
  return grupos;
}

// ── Badge de autor ────────────────────────────────────────────────────────────
const AUTOR_META = {
  planejador: { label: 'Planejador', color: '#3B82F6', Icon: User   },
  cliente:    { label: 'Cliente',    color: '#22D3A0', Icon: User   },
  manager:    { label: 'Manager',    color: '#A855F7', Icon: Shield },
  sistema:    { label: 'Sistema',    color: '#6B7280', Icon: Cpu    },
  bot:        { label: 'Bot',        color: '#F59E0B', Icon: Bot    },
};

function BadgeAutor({ tipo }) {
  const meta = AUTOR_META[tipo] || AUTOR_META.sistema;
  const { Icon, label, color } = meta;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99,
      background: `${color}18`, color,
      fontSize: FONT.xs, fontWeight: 600,
    }}>
      <Icon size={10} />
      {label}
    </span>
  );
}

// ── Badge de motivo ───────────────────────────────────────────────────────────
const MOTIVO_META = {
  manual:          { label: 'Salvo',           color: '#22C55E' },
  projecao:        { label: 'Projeção',        color: '#06B6D4' },
  importacao_pdf:  { label: 'PDF importado',   color: '#3B82F6' },
  fechamento:      { label: 'Ao fechar',       color: '#6B7280' },
  auto:            { label: 'Auto-salvo',      color: '#6B7280' },
  categorias:      { label: 'Categorias',      color: '#8B5CF6' },
  checkpoint:      { label: 'Checkpoint',      color: '#F59E0B' },
  pre_restauracao: { label: 'Pré-restauração', color: '#EF4444' },
  restauracao:     { label: 'Restauração',     color: '#A855F7' },
};

function BadgeMotivo({ motivo }) {
  const meta = MOTIVO_META[motivo] || { label: motivo, color: '#6B7280' };
  return (
    <span style={{
      padding: '1px 7px', borderRadius: 99,
      background: `${meta.color}18`, color: meta.color,
      fontSize: FONT.xs, fontWeight: 500,
    }}>
      {meta.label}
    </span>
  );
}

// ── Resumo compacto de uma versão ─────────────────────────────────────────────
function ResumoVersao({ resumo, size = 'sm' }) {
  const r = resumo || {};
  const fs = size === 'sm' ? FONT.xs : FONT.sm;
  return (
    <span style={{ display: 'inline-flex', gap: 10, fontSize: fs, color: C.textMuted }}>
      <span><strong style={{ color: C.text }}>{r.tx_total ?? 0}</strong> transações</span>
    </span>
  );
}

// ── Modal de checkpoint ───────────────────────────────────────────────────────
function ModalCheckpoint({ onConfirmar, onCancelar }) {
  const [titulo, setTitulo] = useState('');
  return (
    <div style={overlayStyle()}>
      <div style={modalStyle(440)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Bookmark size={20} color="#F59E0B" />
          <span style={{ fontSize: FONT.md, fontWeight: 700, color: C.text }}>
            Criar Checkpoint
          </span>
        </div>
        <p style={{ fontSize: FONT.sm, color: C.textMuted, marginBottom: 16 }}>
          Um checkpoint salva uma versão permanente do estado atual do cliente.
          Checkpoints nunca expiram e podem ser usados para restauração a qualquer momento.
        </p>
        <input
          autoFocus
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && titulo.trim() && onConfirmar(titulo.trim())}
          placeholder="Ex: Antes de importar fatura de julho"
          style={{
            width: '100%', padding: '10px 12px',
            background: C.bgMid, border: `1px solid ${C.border}`,
            borderRadius: RADIUS.md, color: C.text, fontSize: FONT.sm,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} style={btnSecStyle()}>Cancelar</button>
          <button
            onClick={() => titulo.trim() && onConfirmar(titulo.trim())}
            disabled={!titulo.trim()}
            style={btnPrimStyle('#F59E0B', !titulo.trim())}
          >
            <Bookmark size={14} /> Criar Checkpoint
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de confirmação de restauração ───────────────────────────────────────
function ModalRestaurar({ versao, resumoAtual, onConfirmar, onCancelar, restaurando }) {
  const r  = versao.resumo || {};
  const ra = resumoAtual   || {};
  return (
    <div style={overlayStyle()}>
      <div style={modalStyle(520)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <AlertTriangle size={20} color="#EF4444" />
          <span style={{ fontSize: FONT.md, fontWeight: 700, color: C.text }}>
            Restaurar versão anterior?
          </span>
        </div>

        <p style={{ fontSize: FONT.sm, color: C.textMuted, marginBottom: 16 }}>
          Você está prestes a substituir o estado atual por esta versão salva em{' '}
          <strong style={{ color: C.text }}>{formatarData(versao.criado_em)}</strong>{' '}
          por <strong style={{ color: C.text }}>{versao.autor_nome}</strong>.
          O estado atual será salvo automaticamente antes da restauração.
        </p>

        {/* Diff visual */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16,
        }}>
          <div style={diffCardStyle(C.border)}>
            <div style={{ fontSize: FONT.xs, fontWeight: 700, color: C.textMuted, marginBottom: 8 }}>
              ESTADO ATUAL
            </div>
            <div style={{ fontSize: FONT.sm }}>{ra.tx_total ?? '?'} transações</div>
          </div>
          <div style={diffCardStyle('#22D3A020')}>
            <div style={{ fontSize: FONT.xs, fontWeight: 700, color: '#22D3A0', marginBottom: 8 }}>
              SERÁ RESTAURADO
            </div>
            <div style={{ fontSize: FONT.sm }}>{r.tx_total ?? '?'} transações</div>
          </div>
        </div>

        <p style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 16 }}>
          ⚠️ Esta ação substituirá os dados atuais pelos da versão selecionada.
          O estado atual ficará salvo no histórico como "Pré-restauração".
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} disabled={restaurando} style={btnSecStyle()}>
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={restaurando}
            style={btnPrimStyle('#EF4444', restaurando)}
          >
            {restaurando
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Restaurando...</>
              : <><RotateCcw size={14} /> Restaurar versão</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Card de versão na timeline ────────────────────────────────────────────────
function CardVersao({ versao, isAtual, podeRestaurar, onRestaurar }) {
  const [expandido, setExpandido] = useState(false);
  const isCheckpoint = versao.motivo === 'checkpoint';
  const isPreRest    = versao.motivo === 'pre_restauracao';

  return (
    <div style={{
      background: isAtual ? `${C.brand}08` : C.card,
      border: `1px solid ${isAtual ? C.brand : (isCheckpoint ? '#F59E0B40' : C.border)}`,
      borderRadius: RADIUS.lg, padding: '12px 16px',
      transition: 'box-shadow .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Ícone lateral */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isCheckpoint ? '#F59E0B20' : isAtual ? `${C.brand}20` : C.bgMid,
        }}>
          {isCheckpoint ? <Pin size={14} color="#F59E0B" /> :
           isAtual      ? <CheckCircle size={14} color={C.brand} /> :
           isPreRest    ? <AlertTriangle size={14} color="#EF4444" /> :
                          <Clock size={14} color={C.textMuted} />}
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: FONT.sm, fontWeight: 600, color: C.text }}>
              {formatarHora(versao.criado_em)}
            </span>
            <BadgeAutor tipo={versao.autor_tipo} />
            <BadgeMotivo motivo={versao.motivo} />
            {isAtual && (
              <span style={{
                padding: '1px 8px', borderRadius: 99,
                background: `${C.brand}20`, color: C.brand,
                fontSize: FONT.xs, fontWeight: 700,
              }}>
                ATUAL
              </span>
            )}
            {versao.ttl_dias === null && !isAtual && (
              <span style={{
                padding: '1px 6px', borderRadius: 99,
                background: '#F59E0B15', color: '#F59E0B',
                fontSize: FONT.xs,
              }}>
                📌 Permanente
              </span>
            )}
          </div>

          {/* Nome do autor */}
          <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 2 }}>
            {versao.autor_nome}
            {versao.titulo && (
              <span style={{ color: '#F59E0B', marginLeft: 6, fontStyle: 'italic' }}>
                — {versao.titulo}
              </span>
            )}
          </div>

          {/* Resumo */}
          <div style={{ marginTop: 6 }}>
            <ResumoVersao resumo={versao.resumo} />
          </div>
        </div>

        {/* Ações */}
        {!isAtual && podeRestaurar && (
          <button
            onClick={() => onRestaurar(versao)}
            title="Restaurar esta versão"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: RADIUS.md,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: C.textMuted, fontSize: FONT.xs, cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all .15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#EF444415';
              e.currentTarget.style.borderColor = '#EF4444';
              e.currentTarget.style.color = '#EF4444';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.textMuted;
            }}
          >
            <RotateCcw size={12} />
            Restaurar
          </button>
        )}
      </div>
    </div>
  );
}

// ── Estilos utilitários ───────────────────────────────────────────────────────
const overlayStyle = () => ({
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24,
});
const modalStyle = (maxW) => ({
  background: C.card, borderRadius: RADIUS.xl,
  border: `1px solid ${C.border}`, boxShadow: SHADOW.xl,
  padding: 24, width: '100%', maxWidth: maxW,
});
const diffCardStyle = (bg) => ({
  background: bg, borderRadius: RADIUS.md,
  padding: '12px 14px', border: `1px solid ${C.border}`,
});
const btnSecStyle = () => ({
  padding: '8px 16px', borderRadius: RADIUS.md,
  background: C.bgMid, border: `1px solid ${C.border}`,
  color: C.text, fontSize: FONT.sm, cursor: 'pointer',
});
const btnPrimStyle = (color, disabled) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: RADIUS.md,
  background: disabled ? `${color}40` : color,
  border: 'none', color: '#fff', fontSize: FONT.sm,
  cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600,
});

// ── Componente principal ──────────────────────────────────────────────────────
export default function PageHistoricoVersoes() {
  const {
    clienteAtivo, planejadorId, modoLeitura, modoCliente,
    autorTipo, autorNome, setClienteAtivo,
    criarCheckpoint, criarVersaoSeNecessario,
  } = useApp();

  const [versoes, setVersoes]           = useState([]);
  const [carregando, setCarregando]     = useState(true);
  const [erro, setErro]                 = useState(null);
  const [modalCheckpoint, setModalCheckpoint]   = useState(false);
  const [modalRestaurar, setModalRestaurar]     = useState(null); // versao alvo
  const [restaurando, setRestaurando]           = useState(false);
  const [feedback, setFeedback]                 = useState(null); // { tipo, msg }
  const [checkpointOk, setCheckpointOk]         = useState(false);

  const podeRestaurar = !modoLeitura;
  const podeVerHistorico = !modoCliente || autorTipo === 'cliente';

  // Calcular resumo da versão atual para o diff
  const resumoAtual = clienteAtivo ? {
    tx_total:         (clienteAtivo.transacoes ?? []).length,
    tx_categorizadas: (clienteAtivo.transacoes ?? []).filter(t => t.status === 'categorizado').length,
    tx_pendentes:     (clienteAtivo.transacoes ?? []).filter(t => t.status === 'pendente').length,
    tx_outros:        (clienteAtivo.transacoes ?? []).filter(t => t.categoria === 'outros').length,
  } : {};

  const carregarHistorico = useCallback(async () => {
    if (!clienteAtivo?.id) return;
    setCarregando(true);
    setErro(null);
    try {
      const dados = await listarVersoes(clienteAtivo.id, 200);
      setVersoes(dados);
    } catch (err) {
      setErro('Erro ao carregar histórico. Verifique sua conexão.');
      console.error('[PageHistoricoVersoes]', err);
    } finally {
      setCarregando(false);
    }
  }, [clienteAtivo?.id]);

  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

  const handleCheckpoint = useCallback(async (titulo) => {
    setModalCheckpoint(false);
    try {
      await criarCheckpoint(titulo);
      setCheckpointOk(true);
      setTimeout(() => setCheckpointOk(false), 3000);
      await carregarHistorico();
    } catch (err) {
      setErro('Erro ao criar checkpoint: ' + err?.message);
    }
  }, [criarCheckpoint, carregarHistorico]);

  const handleRestaurar = useCallback(async () => {
    if (!modalRestaurar || !clienteAtivo) return;
    setRestaurando(true);
    try {
      const dadosRestaurados = await restaurarVersao({
        versaoId:     modalRestaurar.id,
        clienteAtual: clienteAtivo,
        planejadorId,
        workspaceId:  null,
        autorTipo,
        autorId:      planejadorId,
        autorNome:    autorNome || 'Planejador',
      });

      // Atualiza o estado React com os dados restaurados
      setClienteAtivo(prev => ({
        ...prev,
        ...dadosRestaurados,
        id:   prev.id,
        nome: prev.nome,
      }));

      setModalRestaurar(null);
      setFeedback({ tipo: 'ok', msg: 'Versão restaurada com sucesso! O estado anterior foi salvo no histórico.' });
      setTimeout(() => setFeedback(null), 6000);
      await carregarHistorico();
    } catch (err) {
      setFeedback({ tipo: 'erro', msg: 'Erro ao restaurar versão: ' + err?.message });
      setTimeout(() => setFeedback(null), 8000);
    } finally {
      setRestaurando(false);
    }
  }, [modalRestaurar, clienteAtivo, planejadorId, autorTipo, autorNome, setClienteAtivo, carregarHistorico]);

  // ── Sem cliente ativo ───────────────────────────────────────────────────────
  if (!clienteAtivo) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
        Nenhum cliente selecionado.
      </div>
    );
  }

  if (!podeVerHistorico) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
        Você não tem permissão para ver o histórico de versões.
      </div>
    );
  }

  const grupos = agruparPorDia(versoes);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={20} color={C.brand} />
            <h1 style={{ fontSize: FONT.xl, fontWeight: 800, color: C.text, margin: 0 }}>
              Histórico de Versões
            </h1>
          </div>
          <p style={{ fontSize: FONT.sm, color: C.textMuted, margin: '4px 0 0 30px' }}>
            {clienteAtivo.nome} · {versoes.length} versões salvas
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {/* Refresh */}
          <button
            onClick={carregarHistorico}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: RADIUS.md,
              background: C.bgMid, border: `1px solid ${C.border}`,
              color: C.textMuted, fontSize: FONT.sm, cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
          </button>

          {/* Checkpoint */}
          {podeRestaurar && (
            <button
              onClick={() => setModalCheckpoint(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: RADIUS.md,
                background: '#F59E0B', border: 'none',
                color: '#fff', fontSize: FONT.sm, cursor: 'pointer', fontWeight: 600,
              }}
            >
              <Pin size={14} />
              + Criar Checkpoint
            </button>
          )}
        </div>
      </div>

      {/* ── Feedback ───────────────────────────────────────────────────────── */}
      {checkpointOk && (
        <div style={feedbackStyle('#22C55E')}>
          <CheckCircle size={14} /> Checkpoint criado com sucesso! Versão permanente salva.
        </div>
      )}
      {feedback && (
        <div style={feedbackStyle(feedback.tipo === 'ok' ? '#22C55E' : '#EF4444')}>
          {feedback.tipo === 'ok' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {feedback.msg}
        </div>
      )}
      {erro && (
        <div style={feedbackStyle('#EF4444')}>
          <AlertTriangle size={14} /> {erro}
        </div>
      )}

      {/* ── Info sobre como funciona ────────────────────────────────────────── */}
      <div style={{
        background: `${C.brand}08`, border: `1px solid ${C.brand}30`,
        borderRadius: RADIUS.md, padding: '10px 14px',
        display: 'flex', gap: 8, alignItems: 'flex-start',
        marginBottom: 20, fontSize: FONT.xs, color: C.textMuted,
      }}>
        <Info size={14} color={C.brand} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          Versões são criadas automaticamente ao salvar, importar PDFs e ao fechar o sistema.
          Versões automáticas ficam disponíveis por <strong>90 dias</strong>.
          Checkpoints são permanentes.
        </span>
      </div>

      {/* ── Timeline ───────────────────────────────────────────────────────── */}
      {carregando ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <div>Carregando histórico...</div>
        </div>
      ) : versoes.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60,
          background: C.card, borderRadius: RADIUS.xl,
          border: `1px solid ${C.border}`,
        }}>
          <Clock size={40} color={C.textMuted} style={{ marginBottom: 12, opacity: .4 }} />
          <div style={{ fontSize: FONT.md, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            Nenhuma versão ainda
          </div>
          <div style={{ fontSize: FONT.sm, color: C.textMuted }}>
            As versões aparecem aqui automaticamente quando você salva o cliente
            ou importa PDFs. Use o botão "Salvar" para criar a primeira versão.
          </div>
        </div>
      ) : (
        grupos.map((grupo, gi) => (
          <div key={gi} style={{ marginBottom: 28 }}>
            {/* Cabeçalho do dia */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 12,
            }}>
              <span style={{
                fontSize: FONT.xs, fontWeight: 700, color: C.textMuted,
                textTransform: 'uppercase', letterSpacing: 1,
              }}>
                {grupo.label}
              </span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: FONT.xs, color: C.textDim }}>
                {grupo.versoes.length} {grupo.versoes.length === 1 ? 'versão' : 'versões'}
              </span>
            </div>

            {/* Cards do dia */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grupo.versoes.map((v, vi) => (
                <CardVersao
                  key={v.id}
                  versao={v}
                  isAtual={gi === 0 && vi === 0}
                  podeRestaurar={podeRestaurar}
                  onRestaurar={setModalRestaurar}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* ── Modais ─────────────────────────────────────────────────────────── */}
      {modalCheckpoint && (
        <ModalCheckpoint
          onConfirmar={handleCheckpoint}
          onCancelar={() => setModalCheckpoint(false)}
        />
      )}
      {modalRestaurar && (
        <ModalRestaurar
          versao={modalRestaurar}
          resumoAtual={resumoAtual}
          onConfirmar={handleRestaurar}
          onCancelar={() => setModalRestaurar(null)}
          restaurando={restaurando}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function feedbackStyle(color) {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px', borderRadius: RADIUS.md,
    background: `${color}15`, border: `1px solid ${color}40`,
    color, fontSize: FONT.sm, marginBottom: 12,
  };
}
