import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { ClipboardList, Users, Pencil, Key, CheckCircle2, Trash2, Unlock, RefreshCw, User, X, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { C, FONT, RADIUS } from '../design/tokens.js';
import { supabase } from '../lib/supabase.js';
import { APP_NAME, LOGO_URL } from '../lib/appConfig.js';
import ModalAcessos from '../components/ModalAcessos.jsx';
import PageBacklog from './PageBacklog.jsx';

export default function PageManagerHub() {
  const {
    listarPlanejadores, criarPlanejador, renomearPlanejador,
    toggleAtivoPlanejador, resetarSenhaCliente, excluirPlanejador,
    confirmarEmailPlanejador,
    logout, sessao, setManagerViewing,
  } = useAuth();

  const [planejadores, setPlanejadores] = useState([]);
  const [carregando, setCarregando]     = useState(true);
  const [erro, setErro]                 = useState('');

  // Modais
  const [modalNovo, setModalNovo]           = useState(false);
  const [modalRenomear, setModalRenomear]   = useState(null);
  const [modalSenha, setModalSenha]         = useState(null); // { id, email, nome }
  const [modalExcluir, setModalExcluir]     = useState(null);
  const [modalAcessar, setModalAcessar]     = useState(null);
  const [modalClientes, setModalClientes]   = useState(null);

  // Form novo planejador
  const [novoNome, setNovoNome]   = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [formErro, setFormErro]   = useState('');
  const [formLoad, setFormLoad]   = useState(false);
  const [formSucesso, setFormSucesso] = useState('');

  // Form renomear
  const [renomearNome, setRenomearNome] = useState('');

  // Form resetar senha (nova senha direta)
  const [novaSenhaReset, setNovaSenhaReset] = useState('');
  const [resetLoad, setResetLoad]           = useState(false);
  const [resetSucesso, setResetSucesso]     = useState('');
  const [resetErro, setResetErro]           = useState('');

  // Confirmar email em progresso
  const [confirmandoId, setConfirmandoId] = useState(null);

  // Busca
  const [busca, setBusca] = useState('');

  // Backlog
  const [verBacklog, setVerBacklog] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await listarPlanejadores();
      setPlanejadores(lista);
    } catch (e) { setErro(e.message); }
    finally { setCarregando(false); }
  }, [listarPlanejadores]);

  useEffect(() => { carregar(); }, [carregar]);

  const planejadoresFiltrados = planejadores.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.email.toLowerCase().includes(busca.toLowerCase())
  );

  // ── Criar planejador ────────────────────────────────────────────────────────
  async function handleCriar(e) {
    e.preventDefault();
    setFormErro(''); setFormSucesso('');
    if (!novoNome.trim() || !novoEmail.trim() || !novaSenha) {
      setFormErro('Preencha todos os campos.'); return;
    }
    if (novaSenha.length < 6) { setFormErro('Senha deve ter ao menos 6 caracteres.'); return; }
    setFormLoad(true);
    try {
      await criarPlanejador({ nome: novoNome.trim(), email: novoEmail.trim().toLowerCase(), senha: novaSenha });
      setFormSucesso(`Conta criada com sucesso! ${novoEmail} já pode fazer login.`);
      setNovoNome(''); setNovoEmail(''); setNovaSenha('');
      await carregar();
      setTimeout(() => { setModalNovo(false); setFormSucesso(''); }, 2500);
    } catch (e) { setFormErro(e.message); }
    finally { setFormLoad(false); }
  }

  // ── Renomear ────────────────────────────────────────────────────────────────
  async function handleRenomear(e) {
    e.preventDefault();
    if (!renomearNome.trim()) return;
    try {
      await renomearPlanejador(modalRenomear.id, renomearNome.trim());
      setModalRenomear(null);
      await carregar();
    } catch (e) { setErro(e.message); }
  }

  // ── Toggle ativo ────────────────────────────────────────────────────────────
  async function handleToggleAtivo(p) {
    try {
      await toggleAtivoPlanejador(p.id, !p.ativo);
      await carregar();
    } catch (e) { setErro(e.message); }
  }

  // ── Confirmar email ─────────────────────────────────────────────────────────
  async function handleConfirmarEmail(p) {
    setConfirmandoId(p.id);
    try {
      await confirmarEmailPlanejador(p.id);
      await carregar();
    } catch (e) { setErro(e.message); }
    finally { setConfirmandoId(null); }
  }

  // ── Resetar senha (nova senha direta, via Edge Function admin-cliente) ────────
  async function handleResetarSenha(e) {
    e.preventDefault();
    setResetErro(''); setResetSucesso('');
    if (!novaSenhaReset || novaSenhaReset.length < 6) {
      setResetErro('A nova senha deve ter ao menos 6 caracteres.'); return;
    }
    setResetLoad(true);
    try {
      await resetarSenhaCliente(modalSenha.id, novaSenhaReset);
      setResetSucesso(`Senha alterada com sucesso para ${modalSenha.nome}!`);
      setNovaSenhaReset('');
      setTimeout(() => { setModalSenha(null); setResetSucesso(''); setResetErro(''); }, 2000);
    } catch (e) { setResetErro(e.message); }
    finally { setResetLoad(false); }
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: RADIUS.md, padding: '9px 12px',
    color: C.text, fontSize: FONT.sm,
    fontFamily: "'Inter',sans-serif", outline: 'none',
  };

  const labelStyle = {
    fontSize: FONT.xs, color: C.textMuted,
    fontWeight: 600, display: 'block', marginBottom: 5,
  };

  // ── Renderizar Backlog ───────────────────────────────────────────────────────
  if (verBacklog) {
    return <PageBacklog onVoltar={() => setVerBacklog(false)} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Inter',system-ui,sans-serif", color: C.text }}>

      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '0 32px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1500, margin: '0 auto', display: 'flex', alignItems: 'center', height: 52, gap: 16 }}>
          <img src={LOGO_URL} alt={APP_NAME} style={{ width: 30, height: 30, objectFit: 'contain' }} />
          <span style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text }}>{APP_NAME}</span>
          <span style={{ fontSize: FONT.xs, color: C.brand, background: C.brand + '18', padding: '2px 10px', borderRadius: RADIUS.full, fontWeight: 600 }}>
            Manager
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: FONT.xs, color: C.textMuted }}>{sessao?.perfil?.nome}</span>
          <button onClick={logout} style={{ fontSize: FONT.xs, color: C.textMuted, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '4px 12px', cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
            Sair
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px' }}>

        {/* Título + ações */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: FONT.xl, fontWeight: 800 }}>Painel Manager</div>
            <div style={{ fontSize: FONT.sm, color: C.textMuted, marginTop: 2 }}>Gerencie as contas dos Planejadores</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setVerBacklog(true)}
              style={{
                background: 'transparent', color: C.brand,
                border: `1px solid ${C.brand}55`,
                borderRadius: RADIUS.md, padding: '10px 20px',
                fontSize: FONT.sm, fontWeight: 700,
                fontFamily: "'Inter',sans-serif", cursor: 'pointer',
              }}
            ><ClipboardList size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Backlog</button>
            <button
              onClick={() => { setModalNovo(true); setFormErro(''); setFormSucesso(''); }}
              style={{
                background: C.brand, color: C.bg, border: 'none',
                borderRadius: RADIUS.md, padding: '10px 20px',
                fontSize: FONT.sm, fontWeight: 700,
                fontFamily: "'Inter',sans-serif", cursor: 'pointer',
              }}
            >+ Novo Planejador</button>
          </div>
        </div>

        {/* Barra de busca */}
        <div style={{ marginBottom: 20 }}>
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            style={{ ...inputStyle, maxWidth: 360 }}
          />
        </div>

        {/* Erro global */}
        {erro && (
          <div style={{ background: C.desp + '18', border: `1px solid ${C.desp}44`, borderRadius: RADIUS.sm, padding: '10px 14px', fontSize: FONT.xs, color: C.desp, marginBottom: 16 }}>
            {erro} <button onClick={() => setErro('')} style={{ marginLeft: 8, color: C.desp, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0 }}><X size={11} /></button>
          </div>
        )}

        {/* Tabela de planejadores */}
        {carregando ? (
          <div style={{ color: C.textMuted, fontSize: FONT.sm, padding: '48px', textAlign: 'center' }}>Carregando...</div>
        ) : planejadoresFiltrados.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, padding: '48px', textAlign: 'center', color: C.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Users size={32} /></div>
            <div style={{ fontSize: FONT.base, fontWeight: 600, color: C.text, marginBottom: 8 }}>Nenhum Planejador cadastrado</div>
            <div style={{ fontSize: FONT.sm }}>Clique em "+ Novo Planejador" para criar a primeira conta.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {planejadoresFiltrados.map(p => (
              <div key={p.id} style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: RADIUS.md, padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 16,
                opacity: p.ativo ? 1 : 0.5,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: C.brand + '22', color: C.brand,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: FONT.base, flexShrink: 0,
                }}>
                  {p.nome.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: FONT.sm, color: C.text, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {p.nome}
                    {!p.ativo && (
                      <span style={{ fontSize: FONT.xs, color: C.desp, background: C.desp + '18', padding: '1px 8px', borderRadius: RADIUS.full }}>
                        Desativado
                      </span>
                    )}
                    {/* Badge de confirmação de email */}
                    {p.email_confirmado === true ? (
                      <span style={{ fontSize: 10, color: '#22c55e', background: '#22c55e18', padding: '1px 8px', borderRadius: RADIUS.full, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <CheckCircle2 size={10} /> email confirmado
                      </span>
                    ) : p.email_confirmado === false ? (
                      <span style={{ fontSize: 10, color: '#f59e0b', background: '#f59e0b18', padding: '1px 8px', borderRadius: RADIUS.full, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <AlertTriangle size={10} /> email não confirmado
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 2 }}>{p.email}</div>
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                    Criado em {new Date(p.criado_em).toLocaleDateString('pt-BR')}
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <ActionBtn color={C.brand} onClick={() => setModalAcessar(p)}><Unlock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Acessar</ActionBtn>
                  <ActionBtn color="#A78BFA" onClick={() => setModalClientes(p)}><Users size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Clientes</ActionBtn>
                  <ActionBtn onClick={() => { setModalRenomear(p); setRenomearNome(p.nome); }}><Pencil size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Renomear</ActionBtn>
                  <ActionBtn onClick={() => { setModalSenha(p); setNovaSenhaReset(''); setResetSucesso(''); setResetErro(''); }}><Key size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Resetar senha</ActionBtn>
                  {/* Botão confirmar email apenas se não confirmado */}
                  {p.email_confirmado === false && (
                    <ActionBtn
                      color="#f59e0b"
                      onClick={() => handleConfirmarEmail(p)}
                      disabled={confirmandoId === p.id}
                    >
                      {confirmandoId === p.id ? 'Confirmando...' : 'Confirmar email'}
                    </ActionBtn>
                  )}
                  <ActionBtn onClick={() => handleToggleAtivo(p)}>
                    {p.ativo ? 'Desativar' : 'Ativar'}
                  </ActionBtn>
                  <ActionBtn color={C.desp} onClick={() => setModalExcluir(p)}><Trash2 size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Excluir</ActionBtn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal Novo Planejador ─────────────────────────────────────────────── */}
      <ModalBase open={modalNovo} onClose={() => { setModalNovo(false); setFormSucesso(''); setFormErro(''); }} title="Novo Planejador">
        {formSucesso ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={40} color="#22c55e" /></div>
            <div style={{ fontSize: FONT.sm, color: '#22c55e', fontWeight: 600, lineHeight: 1.5 }}>{formSucesso}</div>
            <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 8 }}>
              Email já confirmado automaticamente — pode logar imediatamente.
            </div>
          </div>
        ) : (
          <form onSubmit={handleCriar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>NOME</label>
              <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: Luan Machado" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>E-MAIL</label>
              <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="luan@b2if.com.br" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>SENHA INICIAL</label>
              <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={inputStyle} />
            </div>
            <div style={{ fontSize: FONT.xs, color: C.textMuted, background: C.brand + '10', border: `1px solid ${C.brand}30`, borderRadius: RADIUS.sm, padding: '8px 12px' }}>
              Email confirmado automaticamente — o planejador pode logar imediatamente sem precisar confirmar o email.
            </div>
            {formErro && <div style={{ fontSize: FONT.xs, color: C.desp }}>{formErro}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <GhostBtn onClick={() => { setModalNovo(false); setFormErro(''); }}>Cancelar</GhostBtn>
              <PrimaryBtn type="submit" disabled={formLoad}>{formLoad ? 'Criando...' : 'Criar conta'}</PrimaryBtn>
            </div>
          </form>
        )}
      </ModalBase>

      {/* ── Modal Renomear ───────────────────────────────────────────────────── */}
      <ModalBase open={!!modalRenomear} onClose={() => setModalRenomear(null)} title="Renomear Planejador">
        <form onSubmit={handleRenomear} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>NOVO NOME</label>
            <input value={renomearNome} onChange={e => setRenomearNome(e.target.value)} placeholder="Nome do planejador" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <GhostBtn onClick={() => setModalRenomear(null)}>Cancelar</GhostBtn>
            <PrimaryBtn type="submit">Salvar</PrimaryBtn>
          </div>
        </form>
      </ModalBase>

      {/* ── Modal Resetar Senha ──────────────────────────────────────────────── */}
      <ModalBase open={!!modalSenha} onClose={() => { setModalSenha(null); setNovaSenhaReset(''); setResetSucesso(''); setResetErro(''); }} title="Resetar Senha">
        {resetSucesso ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={40} color="#22c55e" /></div>
            <div style={{ fontSize: FONT.sm, color: '#22c55e', fontWeight: 600 }}>{resetSucesso}</div>
          </div>
        ) : (
          <form onSubmit={handleResetarSenhaDireto} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: FONT.sm, color: C.textMuted, lineHeight: 1.5 }}>
              Definir nova senha para:<br />
              <strong style={{ color: C.text }}>{modalSenha?.nome}</strong>
              <span style={{ color: C.textMuted }}> — {modalSenha?.email}</span>
            </div>
            <div>
              <label style={labelStyle}>NOVA SENHA</label>
              <input
                type="password"
                value={novaSenhaReset}
                onChange={e => setNovaSenhaReset(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={inputStyle}
                autoFocus
              />
            </div>
            {resetErro && <div style={{ fontSize: FONT.xs, color: C.desp }}>{resetErro}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <GhostBtn onClick={() => { setModalSenha(null); setNovaSenhaReset(''); setResetErro(''); }}>Cancelar</GhostBtn>
              <PrimaryBtn type="submit" disabled={resetLoad}>{resetLoad ? 'Salvando...' : 'Salvar nova senha'}</PrimaryBtn>
            </div>
          </form>
        )}
      </ModalBase>

      {/* ── Modal Excluir ────────────────────────────────────────────────────── */}
      <ModalBase open={!!modalExcluir} onClose={() => setModalExcluir(null)} title="Excluir Planejador">
        <div style={{ fontSize: FONT.sm, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
          Tem certeza que deseja excluir <strong style={{ color: C.text }}>{modalExcluir?.nome}</strong>?<br />
          <span style={{ color: C.desp, fontSize: FONT.xs, display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} /> Todos os clientes e dados serão permanentemente apagados.</span>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <GhostBtn onClick={() => setModalExcluir(null)}>Cancelar</GhostBtn>
          <button
            onClick={handleExcluir}
            style={{ background: C.desp, color: '#fff', border: 'none', borderRadius: RADIUS.md, padding: '8px 18px', fontSize: FONT.sm, fontWeight: 700, fontFamily: "'Inter',sans-serif", cursor: 'pointer' }}
          >Excluir permanentemente</button>
        </div>
      </ModalBase>

      {/* ── Modal Clientes do Planejador ──────────────────────────────────────── */}
      <ModalClientes
        open={!!modalClientes}
        planejador={modalClientes}
        planejadores={planejadores}
        onClose={() => setModalClientes(null)}
        onReload={carregar}
      />

      {/* ── Modal Acessar Hub do Planejador ──────────────────────────────────── */}
      <ModalBase open={!!modalAcessar} onClose={() => setModalAcessar(null)} title="Acessar Hub">
        <div style={{ fontSize: FONT.sm, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
          Você está prestes a acessar o hub de<br />
          <strong style={{ color: C.text, fontSize: FONT.base }}>{modalAcessar?.nome}</strong><br />
          <span style={{ fontSize: FONT.xs }}>Você verá todos os clientes e dados deste Planejador.</span>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <GhostBtn onClick={() => setModalAcessar(null)}>Cancelar</GhostBtn>
          <PrimaryBtn onClick={() => {
            // Fase 0.4 — React state via AuthContext, sem localStorage direto
            // e sem window.location.reload (AppRoot re-renderiza automaticamente)
            setManagerViewing({
              id: modalAcessar.id,
              nome: modalAcessar.nome,
              email: modalAcessar.email,
            });
            setModalAcessar(null);
          }}>Acessar hub</PrimaryBtn>
        </div>
      </ModalBase>

    </div>
  );

  // ── Handlers que precisam de closure sobre state ─────────────────────────────

  async function handleResetarSenhaDireto(e) {
    // Alias para handleResetarSenha — usa a mesma lógica
    return handleResetarSenha(e);
  }

  async function handleExcluir() {
    try {
      await excluirPlanejador(modalExcluir.id);
      setModalExcluir(null);
      await carregar();
    } catch (e) { setErro(e.message); }
  }
}

// ── Componentes auxiliares ───────────────────────────────────────────────────

function ActionBtn({ children, onClick, color, disabled }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontSize: FONT.xs, color: disabled ? C.textDim : (color || C.textMuted),
        background: hover && !disabled ? (color || C.textMuted) + '15' : 'transparent',
        border: `1px solid ${((color || C.textMuted)) + '44'}`,
        borderRadius: RADIUS.sm, padding: '5px 12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: "'Inter',sans-serif",
        transition: 'background .12s',
        opacity: disabled ? 0.6 : 1,
      }}
    >{children}</button>
  );
}

function ModalBase({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: RADIUS.lg, padding: '28px 28px',
        width: '100%', maxWidth: 440,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick, type = 'button', disabled }) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      style={{
        background: disabled ? C.brand + '66' : C.brand,
        color: C.bg, border: 'none', borderRadius: RADIUS.md,
        padding: '8px 18px', fontSize: FONT.sm, fontWeight: 700,
        fontFamily: "'Inter',sans-serif",
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >{children}</button>
  );
}

function GhostBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', color: C.textMuted,
        border: `1px solid ${C.border}`, borderRadius: RADIUS.md,
        padding: '8px 18px', fontSize: FONT.sm,
        fontFamily: "'Inter',sans-serif", cursor: 'pointer',
      }}
    >{children}</button>
  );
}

// ── Modal Clientes do Planejador ─────────────────────────────────────────────
function ModalClientes({ open, planejador, planejadores, onClose, onReload }) {
  const [clientes, setClientes]         = useState([]);
  const [carregando, setCarregando]     = useState(false);
  const [erro, setErro]                 = useState('');

  const [modalMigrar, setModalMigrar]   = useState(null);
  const [destinoId, setDestinoId]       = useState('');
  const [migrando, setMigrando]         = useState(false);
  const [migrarErro, setMigrarErro]     = useState('');

  const [modalExcluir, setModalExcluir] = useState(null);
  const [excluindo, setExcluindo]       = useState(false);

  const [modalAcessos, setModalAcessos] = useState(null);

  useEffect(() => {
    if (!open || !planejador) return;
    setErro('');
    carregar();
  }, [open, planejador]);

  async function carregar() {
    setCarregando(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nome')
      .eq('planejador_id', planejador.id)
      .order('nome');
    setCarregando(false);
    if (error) { setErro(error.message); return; }
    setClientes(data || []);
  }

  async function handleMigrar() {
    if (!destinoId) { setMigrarErro('Selecione o planejador de destino.'); return; }
    setMigrarErro(''); setMigrando(true);
    try {
      const { error } = await supabase
        .from('clientes')
        .update({ planejador_id: destinoId })
        .eq('id', modalMigrar.id)
        .eq('planejador_id', planejador.id);
      if (error) throw error;
      setModalMigrar(null); setDestinoId('');
      await carregar();
      onReload();
    } catch(e) { setMigrarErro(e.message); }
    finally { setMigrando(false); }
  }

  async function handleExcluir() {
    setExcluindo(true);
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', modalExcluir.id);
      if (error) throw error;
      setModalExcluir(null);
      await carregar();
      onReload();
    } catch(e) { setErro(e.message); }
    finally { setExcluindo(false); }
  }

  if (!open) return null;

  const destinos = planejadores.filter(p => p.id !== planejador?.id);

  const inputSt = {
    width: '100%', boxSizing: 'border-box',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: RADIUS.md, padding: '9px 12px',
    color: C.text, fontSize: FONT.sm,
    fontFamily: "'Inter',sans-serif", outline: 'none',
  };

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: RADIUS.lg, padding: '28px',
          width: '100%', maxWidth: 520,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={16} /> Clientes</div>
              <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 3 }}>
                Planejador: <strong style={{ color: '#A78BFA' }}>{planejador?.nome}</strong>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>

          {erro && (
            <div style={{ fontSize: FONT.xs, color: C.desp, background: C.desp + '15', padding: '8px 12px', borderRadius: RADIUS.sm, marginBottom: 14 }}>
              {erro}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: RADIUS.md }}>
            {carregando ? (
              <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: FONT.sm }}>Carregando...</div>
            ) : clientes.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: C.textMuted, fontSize: FONT.sm }}>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><User size={28} /></div>
                Nenhum cliente cadastrado.
              </div>
            ) : clientes.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: '#A78BFA22', color: '#A78BFA',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: FONT.sm, flexShrink: 0,
                }}>
                  {c.nome.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, fontSize: FONT.sm, color: C.text, fontWeight: 500 }}>{c.nome}</div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <SmallBtn onClick={() => setModalAcessos({ id: c.id, nome: c.nome })}><User size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />Acessos</SmallBtn>
                  <SmallBtn onClick={() => { setModalMigrar(c); setDestinoId(''); setMigrarErro(''); }}><RefreshCw size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />Migrar</SmallBtn>
                  <SmallBtn danger onClick={() => setModalExcluir(c)}><Trash2 size={11} /></SmallBtn>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <GhostBtn onClick={onClose}>Fechar</GhostBtn>
          </div>
        </div>
      </div>

      {/* Sub-modal: Migrar cliente */}
      {modalMigrar && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setModalMigrar(null); }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, padding: '28px', width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={16} /> Migrar Cliente</div>
            <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 16 }}>
              Transferir <strong style={{ color: C.text }}>{modalMigrar.nome}</strong> para outro planejador
            </div>
            <label style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>PLANEJADOR DE DESTINO</label>
            <select value={destinoId} onChange={e => setDestinoId(e.target.value)} style={{ ...inputSt, marginBottom: 12 }}>
              <option value="">Selecione...</option>
              {destinos.map(p => <option key={p.id} value={p.id}>{p.nome} — {p.email}</option>)}
            </select>
            {migrarErro && <div style={{ fontSize: FONT.xs, color: C.desp, marginBottom: 10 }}>{migrarErro}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhostBtn onClick={() => setModalMigrar(null)}>Cancelar</GhostBtn>
              <PrimaryBtn onClick={handleMigrar} disabled={migrando}>{migrando ? 'Migrando...' : 'Confirmar'}</PrimaryBtn>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: Excluir cliente */}
      {modalExcluir && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setModalExcluir(null); }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, padding: '28px', width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 12 }}>Excluir Cliente</div>
            <div style={{ fontSize: FONT.sm, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
              Tem certeza que deseja excluir <strong style={{ color: C.text }}>{modalExcluir.nome}</strong>?<br />
              <span style={{ fontSize: FONT.xs, color: C.desp, display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} /> Todos os dados financeiros serão apagados permanentemente.</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhostBtn onClick={() => setModalExcluir(null)}>Cancelar</GhostBtn>
              <button
                onClick={handleExcluir} disabled={excluindo}
                style={{ background: excluindo ? C.desp + '66' : C.desp, color: '#fff', border: 'none', borderRadius: RADIUS.md, padding: '8px 18px', fontSize: FONT.sm, fontWeight: 700, fontFamily: "'Inter',sans-serif", cursor: excluindo ? 'not-allowed' : 'pointer' }}
              >{excluindo ? 'Excluindo...' : 'Excluir permanentemente'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: Acessos do cliente */}
      <ModalAcessos
        open={!!modalAcessos}
        clienteId={modalAcessos?.id}
        clienteNome={modalAcessos?.nome}
        onClose={() => setModalAcessos(null)}
      />
    </>
  );
}

function SmallBtn({ children, onClick, danger }) {
  const [hov, setHov] = useState(false);
  const col = danger ? C.desp : C.textMuted;
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        fontSize: FONT.xs, color: col,
        background: hov ? col + '18' : 'transparent',
        border: `1px solid ${col + '44'}`,
        borderRadius: RADIUS.sm, padding: '4px 10px',
        cursor: 'pointer', fontFamily: "'Inter',sans-serif",
        transition: 'background .12s', whiteSpace: 'nowrap',
      }}
    >{children}</button>
  );
}
