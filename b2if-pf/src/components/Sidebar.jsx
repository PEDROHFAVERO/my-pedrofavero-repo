/**
 * Sidebar.jsx — Menu lateral retrátil
 *
 * Minimizado: 64px — apenas ícones centralizados
 * Expandido:  220px — ícone + label + subnavegação
 *
 * Usa Lucide React para todos os ícones.
 * Integra toggle dark/light via useTheme.
 */
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Target, ArrowLeftRight, MessageCircle,
  Kanban, FolderOpen, Shield, StickyNote, Settings,
  ChevronRight, ChevronLeft, Sun, Moon, LogOut, Eye,
  User, Wallet, Smartphone, Clock,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { FONT, RADIUS } from '../design/tokens.js';
import { APP_NAME, LOGO_URL } from '../lib/appConfig.js';

// ── Definição das abas ────────────────────────────────────────────────────────
const ABAS_PLANEJADOR = [
  { id: 'hub',              label: 'Hub de Clientes',     Icon: FolderOpen },
  { id: 'dashboard',        label: 'Dashboard',            Icon: LayoutDashboard },
  { id: 'planejador',       label: 'Planejador',           Icon: Target },
  { id: 'orcamento',        label: 'Orçamento',            Icon: Wallet },
  { id: 'categorizador',    label: 'Fluxo Financeiro',     Icon: ArrowLeftRight },
  { id: 'fluxo-whatsapp',   label: 'Fluxo WhatsApp',      Icon: Smartphone },
  { id: 'bot-whatsapp',     label: 'Bot WhatsApp',        Icon: MessageCircle },
  { id: 'historico-versoes',label: 'Histórico de Versões',Icon: Clock },
  { id: 'backlog',          label: 'Backlog',              Icon: Kanban },
];

// ABAS_CLIENTE base — historico-versoes é adicionado condicionalmente para editores
const ABAS_CLIENTE_BASE = [
  { id: 'dashboard',     label: 'Dashboard',         Icon: LayoutDashboard },
  { id: 'categorizador', label: 'Fluxo Financeiro',  Icon: ArrowLeftRight },
];
const ABA_HISTORICO = { id: 'historico-versoes', label: 'Histórico de Versões', Icon: Clock };

// ── Item da sidebar ────────────────────────────────────────────────────────────
function SidebarItem({ item, active, expanded, onClick, modoLeitura }) {
  const { Icon, label } = item;
  const [hovered, setHovered] = useState(false);

  const isActive = active;
  const baseColor = isActive ? '#3B82F6' : (hovered ? 'var(--c-text)' : 'var(--c-text-muted)');
  const bgColor   = isActive
    ? 'var(--sidebar-item-active)'
    : hovered ? 'var(--sidebar-item-hover)' : 'transparent';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={!expanded ? label : undefined}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: expanded ? 12 : 0,
        justifyContent: expanded ? 'flex-start' : 'center',
        padding: expanded ? '10px 16px' : '10px 0',
        border: 'none',
        background: bgColor,
        borderRadius: RADIUS.md,
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        fontFamily: FONT.family,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Indicador lateral ativo */}
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: '20%', bottom: '20%',
          width: 3, borderRadius: '0 3px 3px 0',
          background: '#3B82F6',
          boxShadow: '0 0 8px rgba(59,130,246,0.6)',
        }} />
      )}

      {/* Ícone */}
      <Icon
        size={18}
        color={isActive ? '#3B82F6' : baseColor}
        style={{
          flexShrink: 0,
          filter: isActive ? 'drop-shadow(0 0 6px rgba(59,130,246,0.5))' : 'none',
          transition: 'filter 0.18s',
        }}
      />

      {/* Label (só quando expandido) */}
      {expanded && (
        <span style={{
          fontSize: FONT.sm,
          fontWeight: isActive ? 700 : 500,
          color: isActive ? 'var(--c-text)' : baseColor,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'color 0.18s',
          letterSpacing: '0.01em',
        }}>
          {label}
          {modoLeitura && item.id !== 'hub' && item.id !== 'dashboard' && (
            <Eye size={10} style={{ marginLeft: 4, opacity: 0.5, display: 'inline' }} />
          )}
        </span>
      )}
    </button>
  );
}

// ── Separador ─────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div style={{
      height: 1,
      background: 'var(--c-border)',
      margin: '8px 12px',
    }} />
  );
}

// ── Sidebar principal ──────────────────────────────────────────────────────────
export function Sidebar({
  paginaAtual, setPaginaAtual, voltarHub,
  modoCliente, modoLeitura, modoManager,
  clienteAtivo, sessaoNome,
  managerViewing, limparManagerViewing,
  onToggleNotas, notasAberto,
  salvando, erroSalvar,
  onLogout,
  isEditor = false,
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  // Persiste estado expandido
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('b2if-sidebar') !== 'collapsed'; }
    catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem('b2if-sidebar', expanded ? 'expanded' : 'collapsed'); }
    catch {}
  }, [expanded]);

  const W = expanded ? 220 : 64;

  // Abas visíveis conforme modo
  const abasCliente = isEditor
    ? [...ABAS_CLIENTE_BASE, ABA_HISTORICO]
    : ABAS_CLIENTE_BASE;

  const abas = modoCliente
    ? abasCliente
    : ABAS_PLANEJADOR.filter(a => {
        // Sem cliente ativo: mostrar só hub e backlog
        if (!clienteAtivo && a.id !== 'hub' && a.id !== 'backlog') return false;
        if (modoLeitura && (a.id === 'bot-whatsapp' || a.id === 'backlog')) return false;
        if (modoLeitura && a.id === 'categorizador') return false;
        if (modoLeitura && a.id === 'fluxo-whatsapp') return false;
        return true;
      });

  const handleNavClick = (id) => {
    if (id === 'hub') voltarHub?.();
    else setPaginaAtual(id);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0, top: 0, bottom: 0,
        width: W,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
      }}
    >
      {/* ── Logo + toggle ──────────────────────────────────────────────────── */}
      <div style={{
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: expanded ? 'space-between' : 'center',
        padding: expanded ? '0 12px 0 16px' : '0',
        flexShrink: 0,
        borderBottom: '1px solid var(--sidebar-border)',
      }}>
        {expanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img
              src={LOGO_URL}
              alt={APP_NAME}
              style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: FONT.sm, fontWeight: 800, color: 'var(--c-text)', lineHeight: 1.2 }}>
                {APP_NAME}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--c-brand, #00B8A9)', fontWeight: 600, lineHeight: 1 }}>
                Planejador PF
              </div>
            </div>
          </div>
        )}

        {!expanded && (
          <img
            src={LOGO_URL}
            alt={APP_NAME}
            style={{ width: 28, height: 28, objectFit: 'contain' }}
          />
        )}

        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Recolher menu' : 'Expandir menu'}
          style={{
            background: 'transparent',
            border: '1px solid var(--c-border)',
            borderRadius: RADIUS.sm,
            color: 'var(--c-text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            padding: 0,
            flexShrink: 0,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-border-light)'; e.currentTarget.style.color = 'var(--c-text)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text-muted)'; }}
        >
          {expanded
            ? <ChevronLeft size={14} />
            : <ChevronRight size={14} />}
        </button>
      </div>

      {/* ── Banner manager viewing ─────────────────────────────────────────── */}
      {managerViewing && expanded && (
        <div style={{
          margin: '8px 10px 0',
          padding: '8px 10px',
          background: 'rgba(59,130,246,0.1)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: RADIUS.md,
          fontSize: '10px',
          color: '#60A5FA',
          lineHeight: 1.4,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>Visualizando:</div>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {managerViewing.nome}
          </div>
          <button
            onClick={limparManagerViewing}
            style={{
              marginTop: 6, background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: RADIUS.sm, padding: '3px 8px',
              color: '#60A5FA', fontSize: '10px', cursor: 'pointer',
              fontFamily: FONT.family, fontWeight: 600, width: '100%',
            }}
          >
            Voltar ao painel
          </button>
        </div>
      )}

      {/* ── Status salvando ───────────────────────────────────────────────── */}
      {salvando && expanded && (
        <div style={{
          margin: '8px 10px 0',
          padding: '5px 10px',
          background: 'rgba(0,184,169,0.08)',
          border: '1px solid rgba(0,184,169,0.2)',
          borderRadius: RADIUS.sm,
          fontSize: '10px',
          color: '#00B8A9',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#00B8A9',
            animation: 'pulse 1s infinite',
          }} />
          Salvando...
        </div>
      )}

      {/* ── Navegação principal ───────────────────────────────────────────── */}
      <nav style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: expanded ? '12px 8px' : '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        {abas.map(aba => (
          <SidebarItem
            key={aba.id}
            item={aba}
            active={paginaAtual === aba.id || (aba.id === 'hub' && paginaAtual === 'hub')}
            expanded={expanded}
            modoLeitura={modoLeitura}
            onClick={() => handleNavClick(aba.id)}
          />
        ))}

        {/* Notas (só se cliente ativo e não modo cliente) */}
        {!modoCliente && clienteAtivo && (
          <>
            <Divider />
            <SidebarItem
              item={{ id: 'notas', label: 'Notas do Cliente', Icon: StickyNote }}
              active={notasAberto}
              expanded={expanded}
              onClick={onToggleNotas}
            />
          </>
        )}

        {/* Erro de salvar */}
        {erroSalvar && expanded && (
          <div style={{
            margin: '4px 4px 0',
            padding: '6px 10px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: RADIUS.sm,
            fontSize: '10px',
            color: '#F87171',
          }}>
            {erroSalvar}
          </div>
        )}
      </nav>

      {/* ── Rodapé: tema + usuário + sair ─────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid var(--sidebar-border)',
        padding: expanded ? '10px 8px' : '10px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flexShrink: 0,
      }}>
        {/* Toggle de tema */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: expanded ? 12 : 0,
            justifyContent: expanded ? 'flex-start' : 'center',
            padding: expanded ? '9px 16px' : '9px 0',
            border: 'none',
            background: 'transparent',
            borderRadius: RADIUS.md,
            cursor: 'pointer',
            fontFamily: FONT.family,
            transition: 'background 0.18s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-item-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {isDark
            ? <Sun size={17} color="var(--c-text-muted)" />
            : <Moon size={17} color="var(--c-text-muted)" />}
          {expanded && (
            <span style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', fontWeight: 500 }}>
              {isDark ? 'Tema Claro' : 'Tema Escuro'}
            </span>
          )}
        </button>

        {/* Info do usuário */}
        {expanded && sessaoNome && (
          <div style={{
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <User size={13} color="#60A5FA" />
            </div>
            <span style={{
              fontSize: '11px', color: 'var(--c-text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {sessaoNome}
            </span>
          </div>
        )}

        {/* Sair */}
        <button
          onClick={onLogout}
          title="Sair"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: expanded ? 12 : 0,
            justifyContent: expanded ? 'flex-start' : 'center',
            padding: expanded ? '9px 16px' : '9px 0',
            border: 'none',
            background: 'transparent',
            borderRadius: RADIUS.md,
            cursor: 'pointer',
            fontFamily: FONT.family,
            transition: 'background 0.18s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut size={17} color="var(--c-text-muted)" />
          {expanded && (
            <span style={{ fontSize: FONT.sm, color: 'var(--c-text-muted)', fontWeight: 500 }}>
              Sair
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
