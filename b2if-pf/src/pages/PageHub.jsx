import { useState, useRef, useEffect } from 'react';
import { C, FONT, RADIUS } from '../design/tokens.js';
import { useHub, useApp } from '../context/AppContext.jsx';
import { APP_NAME, LOGO_URL } from '../lib/appConfig.js';
import { Btn, Card, Modal, Input, KPICard, SectionTitle, Empty } from '../components/UI.jsx';
import ModalAcessos from '../components/ModalAcessos.jsx';
import { Kanban, Users, BarChart3, CalendarDays, User, FolderOpen, Pencil, Trash2, Rocket, UserCheck } from 'lucide-react';

export default function PageHub() {
  const { hub, criarCliente, abrirCliente, removerCliente, renomearCliente, hubCarregado } = useHub();
  const { setPaginaAtual } = useApp();
  const [modalNovo, setModalNovo]         = useState(false);
  const [nome, setNome]                   = useState('');
  const [busca, setBusca]                 = useState('');
  const [modalAcessos, setModalAcessos]   = useState(null); // { id, nome }
  const [modalRenomear, setModalRenomear] = useState(null); // { id, nome }
  const [modalExcluir, setModalExcluir]   = useState(null); // { id, nome }
  const [novoNome, setNovoNome]           = useState('');
  const [acaoLoad, setAcaoLoad]           = useState(false);
  const [acaoErro, setAcaoErro]           = useState('');

  const clientesFiltrados = hub.clientes
    .filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

  async function handleCriar() {
    if (!nome.trim()) return;
    setNome('');
    setModalNovo(false);
    await criarCliente(nome.trim(), { navegarAoAbrir: false });
  }

  async function handleRenomear() {
    if (!novoNome.trim() || !modalRenomear) return;
    setAcaoLoad(true); setAcaoErro('');
    try {
      await renomearCliente(modalRenomear.id, novoNome.trim());
      setModalRenomear(null); setNovoNome('');
    } catch (e) { setAcaoErro(e.message || 'Erro ao renomear.'); }
    finally { setAcaoLoad(false); }
  }

  async function handleExcluir() {
    if (!modalExcluir) return;
    setAcaoLoad(true); setAcaoErro('');
    try {
      await removerCliente(modalExcluir.id);
      setModalExcluir(null);
    } catch (e) { setAcaoErro(e.message || 'Erro ao excluir.'); }
    finally { setAcaoLoad(false); }
  }

  const totalClientes = hub.clientes.length;

  if (!hubCarregado) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter',sans-serif", color: C.textMuted, fontSize: FONT.sm }}>
        Carregando clientes...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Inter', sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '0 40px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={LOGO_URL} alt={APP_NAME} style={{ width: 40, height: 40, objectFit: 'contain' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: FONT.lg, color: C.text, lineHeight: 1 }}>{APP_NAME}</div>
              <div style={{ fontSize: FONT.xs, color: C.brand, fontWeight: 600 }}>Planejador Financeiro PF</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={() => setPaginaAtual('backlog')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'transparent', color: C.brand,
                border: `1px solid ${C.brand}55`,
                borderRadius: RADIUS.md, padding: '8px 18px',
                fontSize: FONT.sm, fontWeight: 700,
                fontFamily: "'Inter',sans-serif", cursor: 'pointer',
              }}
            ><Kanban size={14} /> Backlog</button>
            <Btn size="sm" onClick={() => setModalNovo(true)}>+ Novo Cliente</Btn>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '36px 40px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          <KPICard label="Total de Clientes" value={totalClientes} icon={<Users size={16} />} color={C.brand} />
          <KPICard
            label="Ativos este mês"
            value={hub.clientes.filter(c => {
              if (!c.atualizadoEm) return false;
              const d = new Date(c.atualizadoEm);
              const n = new Date();
              return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
            }).length}
            icon={<BarChart3 size={16} />}
            color={C.rec}
          />
          <KPICard
            label="Ano em Curso"
            value={new Date().getFullYear()}
            icon={<CalendarDays size={16} />}
            color={C.info}
          />
        </div>

        {/* Lista de clientes */}
        <SectionTitle
          title="Meus Clientes"
          sub={`${totalClientes} cliente${totalClientes !== 1 ? 's' : ''} cadastrado${totalClientes !== 1 ? 's' : ''}`}
        />

        {/* Busca */}
        {totalClientes > 0 && (
          <input
            placeholder="Buscar cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.md,
              padding: '10px 16px', color: C.text, fontSize: FONT.base,
              fontFamily: "'Inter', sans-serif", outline: 'none', width: '100%',
              boxSizing: 'border-box', marginBottom: 16,
            }}
          />
        )}

        {clientesFiltrados.length === 0 ? (
          <Card>
            <Empty
              icon={<User size={22} />}
              title="Nenhum cliente ainda"
              sub='Clique em "+ Novo Cliente" para começar'
            />
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {clientesFiltrados.map(c => (
              <ClienteCard
                key={c.id}
                cliente={c}
                onAbrir={() => abrirCliente(c.id)}
                onAcessos={e => { e.stopPropagation(); setModalAcessos({ id: c.id, nome: c.nome }); }}
                onRenomear={e => { e.stopPropagation(); setNovoNome(c.nome); setModalRenomear({ id: c.id, nome: c.nome }); setAcaoErro(''); }}
                onExcluir={e => { e.stopPropagation(); setModalExcluir({ id: c.id, nome: c.nome }); setAcaoErro(''); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Novo Cliente */}
      <Modal open={modalNovo} onClose={() => { setModalNovo(false); setNome(''); }} title="Novo Cliente">
        <Input label="Nome completo do cliente" value={nome} onChange={setNome} placeholder="Ex: João Silva" />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => { setModalNovo(false); setNome(''); }}>Cancelar</Btn>
          <Btn onClick={handleCriar} disabled={!nome.trim()}>Criar Cliente</Btn>
        </div>
      </Modal>

      {/* Modal Acessos */}
      <ModalAcessos
        open={!!modalAcessos}
        clienteId={modalAcessos?.id}
        clienteNome={modalAcessos?.nome}
        onClose={() => setModalAcessos(null)}
      />

      {/* Modal Renomear */}
      <Modal open={!!modalRenomear} onClose={() => { setModalRenomear(null); setNovoNome(''); setAcaoErro(''); }} title="Renomear Cliente">
        <Input label="Novo nome" value={novoNome} onChange={setNovoNome} placeholder={modalRenomear?.nome} />
        {acaoErro && <div style={{ fontSize: FONT.xs, color: '#F87171', marginTop: 8 }}>{acaoErro}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <Btn variant="ghost" onClick={() => { setModalRenomear(null); setNovoNome(''); setAcaoErro(''); }}>Cancelar</Btn>
          <Btn onClick={handleRenomear} disabled={!novoNome.trim() || acaoLoad}>
            {acaoLoad ? 'Salvando...' : 'Salvar'}
          </Btn>
        </div>
      </Modal>

      {/* Modal Excluir */}
      <Modal open={!!modalExcluir} onClose={() => { setModalExcluir(null); setAcaoErro(''); }} title="Excluir Cliente">
        <div style={{ fontSize: FONT.sm, color: C.text, lineHeight: 1.6 }}>
          Tem certeza que deseja excluir <strong>{modalExcluir?.nome}</strong>?<br />
          <span style={{ color: '#F87171', fontSize: FONT.xs }}>
            Todos os dados (transações, categorias, planejamento) serão apagados permanentemente.
          </span>
        </div>
        {acaoErro && <div style={{ fontSize: FONT.xs, color: '#F87171', marginTop: 8 }}>{acaoErro}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <Btn variant="ghost" onClick={() => { setModalExcluir(null); setAcaoErro(''); }}>Cancelar</Btn>
          <Btn onClick={handleExcluir} disabled={acaoLoad} style={{ background: '#F87171', borderColor: '#F87171' }}>
            {acaoLoad ? 'Excluindo...' : 'Confirmar Exclusão'}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

// ── ClienteCard ───────────────────────────────────────────────────────────────

function ClienteCard({ cliente, onAbrir, onAcessos, onRenomear, onExcluir }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const qtdTransacoes = cliente.transacoes?.length || 0;
  const ultimaAtualizacao = cliente.atualizadoEm
    ? new Date(cliente.atualizadoEm).toLocaleDateString('pt-BR')
    : '—';

  useEffect(() => {
    if (!menuOpen) return;
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <Card onClick={onAbrir} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        {/* Avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: RADIUS.full, background: C.brand + '22',
          border: `2px solid ${C.brand}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: FONT.lg, fontWeight: 800, color: C.brand,
        }}>
          {cliente.nome.charAt(0).toUpperCase()}
        </div>

        {/* Botão ⋯ */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            title="Opções"
            style={{
              background: menuOpen ? C.brand + '18' : 'transparent',
              border: `1px solid ${menuOpen ? C.brand : C.border}`,
              borderRadius: RADIUS.sm, width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: menuOpen ? C.brand : C.textMuted,
              fontSize: 18, transition: 'all .15s',
            }}
          >⋯</button>
          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 300,
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: RADIUS.md, minWidth: 185, padding: '4px 0',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            }}>
              <CardMenuItem onClick={() => { setMenuOpen(false); onAbrir(); }}><Rocket size={12} style={{ marginRight: 6 }} />Abrir cliente</CardMenuItem>
              <CardMenuItem onClick={e => { setMenuOpen(false); onAcessos(e); }}><UserCheck size={12} style={{ marginRight: 6 }} />Gerenciar acessos</CardMenuItem>
              <CardMenuItem onClick={e => { setMenuOpen(false); onRenomear(e); }}><Pencil size={12} style={{ marginRight: 6 }} />Renomear</CardMenuItem>
              <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
              <CardMenuItem onClick={e => { setMenuOpen(false); onExcluir(e); }} color="#F87171"><Trash2 size={12} style={{ marginRight: 6 }} />Excluir cliente</CardMenuItem>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontWeight: 700, fontSize: FONT.lg, color: C.text, marginBottom: 4 }}>{cliente.nome}</div>
      <div style={{ fontSize: FONT.sm, color: C.textMuted }}>
        {qtdTransacoes > 0
          ? `${qtdTransacoes} transações importadas`
          : 'Sem dados importados ainda'}
      </div>
      <div style={{ fontSize: FONT.xs, color: C.textDim, marginTop: 10 }}>
        Atualizado em {ultimaAtualizacao}
      </div>
    </Card>
  );
}

function CardMenuItem({ onClick, color, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(e); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '9px 14px', background: hover ? C.border + '44' : 'none',
        border: 'none', color: color || C.text, fontSize: FONT.xs,
        cursor: 'pointer', fontFamily: "'Inter',sans-serif",
      }}
    >{children}</button>
  );
}
