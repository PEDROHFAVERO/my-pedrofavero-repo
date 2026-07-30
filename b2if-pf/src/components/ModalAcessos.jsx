/**
 * ModalAcessos — gerencia logins de cliente
 * Usado em: PageHub (planejador) e PageManagerHub (manager → modal clientes)
 *
 * Props:
 *   open       boolean
 *   clienteId  string
 *   clienteNome string
 *   onClose    () => void
 */
import { useState, useEffect } from 'react';
import { User, Lock, Key, Trash2, Eye, Pencil, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { C, FONT, RADIUS } from '../design/tokens.js';

export default function ModalAcessos({ open, clienteId, clienteNome, onClose }) {
  const { listarAcessosCliente, criarAcessoCliente, atualizarModoAcesso, resetarSenhaCliente, excluirAcessoCliente } = useAuth();

  const [acessos, setAcessos]         = useState([]);
  const [carregando, setCarregando]   = useState(false);
  const [erro, setErro]               = useState('');

  // Sub-formulário: novo acesso
  const [showForm, setShowForm]       = useState(false);
  const [fNome, setFNome]             = useState('');
  const [fEmail, setFEmail]           = useState('');
  const [fSenha, setFSenha]           = useState('');
  const [fModo, setFModo]             = useState('visualizacao'); // novo
  const [fLoad, setFLoad]             = useState(false);
  const [fErro, setFErro]             = useState('');

  // Sub-modal: resetar senha
  const [modalReset, setModalReset]   = useState(null); // { userId, nome }
  const [novaSenha, setNovaSenha]     = useState('');
  const [resetLoad, setResetLoad]     = useState(false);
  const [resetErro, setResetErro]     = useState('');

  // Sub-modal: confirmar exclusão
  const [modalExcluir, setModalExcluir] = useState(null); // { userId, nome }
  const [excluirLoad, setExcluirLoad]   = useState(false);

  // Alterar modo de acesso inline no card
  const [modoLoad, setModoLoad]       = useState({}); // { [userId]: true|false }

  // Carrega acessos quando abre
  useEffect(() => {
    if (!open || !clienteId) return;
    carregar();
  }, [open, clienteId]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const lista = await listarAcessosCliente(clienteId);
      setAcessos(lista);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  function resetForm() {
    setFNome(''); setFEmail(''); setFSenha(''); setFModo('visualizacao'); setFErro(''); setShowForm(false);
  }

  async function handleCriar(e) {
    e.preventDefault();
    setFErro('');
    if (!fNome.trim())  { setFErro('Informe o nome.'); return; }
    if (!fEmail.trim()) { setFErro('Informe o e-mail.'); return; }
    if (fSenha.length < 6) { setFErro('Senha deve ter ao menos 6 caracteres.'); return; }
    setFLoad(true);
    try {
      await criarAcessoCliente({
        clienteId, nome: fNome.trim(),
        email: fEmail.trim().toLowerCase(),
        senha: fSenha,
        modoAcesso: fModo,
      });
      resetForm();
      await carregar();
    } catch (e) {
      setFErro(e.message);
    } finally {
      setFLoad(false);
    }
  }

  async function handleAlterarModo(userId, novoModo) {
    setModoLoad(prev => ({ ...prev, [userId]: true }));
    try {
      await atualizarModoAcesso(userId, novoModo);
      setAcessos(prev => prev.map(a => a.user_id === userId ? { ...a, modo_acesso: novoModo } : a));
    } catch (e) {
      setErro(e.message);
    } finally {
      setModoLoad(prev => ({ ...prev, [userId]: false }));
    }
  }

  async function handleResetar() {
    if (!novaSenha || novaSenha.length < 6) { setResetErro('Senha deve ter ao menos 6 caracteres.'); return; }
    setResetErro('');
    setResetLoad(true);
    try {
      await resetarSenhaCliente(modalReset.userId, novaSenha);
      setModalReset(null);
      setNovaSenha('');
    } catch (e) {
      setResetErro(e.message);
    } finally {
      setResetLoad(false);
    }
  }

  async function handleExcluir() {
    setExcluirLoad(true);
    try {
      await excluirAcessoCliente(modalExcluir.userId);
      setModalExcluir(null);
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setExcluirLoad(false);
    }
  }

  if (!open) return null;

  const inputSt = {
    width: '100%', boxSizing: 'border-box',
    background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: RADIUS.md, padding: '9px 12px',
    color: C.text, fontSize: FONT.sm,
    fontFamily: "'Inter',sans-serif", outline: 'none',
  };
  const labelSt = {
    fontSize: FONT.xs, color: C.textMuted,
    fontWeight: 600, display: 'block', marginBottom: 5,
  };

  return (
    <>
      {/* Overlay principal */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: RADIUS.lg, padding: '28px 28px',
          width: '100%', maxWidth: 500,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}>
          {/* Cabeçalho */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}><User size={16} /> Acessos do Cliente</div>
              <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 3 }}>
                Cliente: <strong style={{ color: C.brand }}>{clienteNome}</strong>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>

          {/* Erro global */}
          {erro && (
            <div style={{ fontSize: FONT.xs, color: C.desp, background: C.desp + '15', padding: '8px 12px', borderRadius: RADIUS.sm, marginBottom: 14 }}>
              {erro}
            </div>
          )}

          {/* Lista de acessos */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
            {carregando ? (
              <div style={{ textAlign: 'center', color: C.textMuted, fontSize: FONT.sm, padding: 24 }}>Carregando...</div>
            ) : acessos.length === 0 ? (
              <div style={{
                border: `1px dashed ${C.border}`, borderRadius: RADIUS.md,
                padding: '24px', textAlign: 'center', color: C.textMuted, fontSize: FONT.sm,
              }}>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><Lock size={28} /></div>
                Nenhum acesso criado ainda.<br />
                <span style={{ fontSize: FONT.xs }}>Clique em "+ Novo acesso" para criar o primeiro login.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {acessos.map(a => {
                  const isEditor = a.modo_acesso === 'editor';
                  const loading  = modoLoad[a.user_id];
                  return (
                    <div key={a.id} style={{
                      background: C.bg, border: `1px solid ${C.border}`,
                      borderRadius: RADIUS.md, padding: '12px 14px',
                    }}>
                      {/* Linha 1: avatar + nome + ações */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Avatar */}
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: C.brand + '22', color: C.brand,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: FONT.sm, flexShrink: 0,
                        }}>
                          {a.nome.charAt(0).toUpperCase()}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: FONT.sm, color: C.text }}>{a.nome}</div>
                          <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 1 }}>
                            Criado em {new Date(a.criado_em).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        {/* Ações */}
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <SmBtn onClick={() => { setModalReset({ userId: a.user_id, nome: a.nome }); setNovaSenha(''); setResetErro(''); }}>
                            <Key size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Senha
                          </SmBtn>
                          <SmBtn danger onClick={() => setModalExcluir({ userId: a.user_id, nome: a.nome })}>
                            <Trash2 size={11} />
                          </SmBtn>
                        </div>
                      </div>

                      {/* Linha 2: toggle de modo */}
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: FONT.xs, color: C.textMuted, flexShrink: 0 }}>Modo de acesso:</span>
                        <ModoToggle
                          isEditor={isEditor}
                          loading={loading}
                          onChange={novoModo => handleAlterarModo(a.user_id, novoModo)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Formulário novo acesso */}
          {showForm ? (
            <form onSubmit={handleCriar} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text, marginBottom: 4 }}>Novo acesso</div>
              <div>
                <label style={labelSt}>NOME</label>
                <input value={fNome} onChange={e => setFNome(e.target.value)} placeholder="Ex: Andrea" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>E-MAIL</label>
                <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="andrea@email.com" style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>SENHA INICIAL</label>
                <input type="password" value={fSenha} onChange={e => setFSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={inputSt} />
              </div>

              {/* Toggle de modo na criação */}
              <div>
                <label style={labelSt}>TIPO DE ACESSO</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <ModoOpcao
                    ativo={fModo === 'visualizacao'}
                    onClick={() => setFModo('visualizacao')}
                    icon={<Eye size={16} />}
                    label="Apenas Visualização"
                    desc="Vê os dados, não edita"
                  />
                  <ModoOpcao
                    ativo={fModo === 'editor'}
                    onClick={() => setFModo('editor')}
                    icon={<Pencil size={16} />}
                    label="Editor"
                    desc="Pode editar no sistema"
                  />
                </div>
              </div>

              {fErro && <div style={{ fontSize: FONT.xs, color: C.desp }}>{fErro}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <GhBtn onClick={resetForm}>Cancelar</GhBtn>
                <PrBtn type="submit" disabled={fLoad}>{fLoad ? 'Criando...' : 'Criar acesso'}</PrBtn>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              style={{
                width: '100%', padding: '10px', borderRadius: RADIUS.md,
                border: `1px dashed ${C.brand}66`, background: C.brand + '0d',
                color: C.brand, fontSize: FONT.sm, fontWeight: 600,
                fontFamily: "'Inter',sans-serif", cursor: 'pointer',
              }}
            >+ Novo acesso</button>
          )}
        </div>
      </div>

      {/* Sub-modal: Resetar senha */}
      {modalReset && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setModalReset(null); }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, padding: '28px', width: '100%', maxWidth: 380 }}>
            <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Key size={16} /> Resetar Senha</div>
            <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 16 }}>
              Definir nova senha para <strong style={{ color: C.text }}>{modalReset.nome}</strong>
            </div>
            <label style={labelSt}>NOVA SENHA</label>
            <input
              type="password"
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              style={{ ...inputSt, marginBottom: 12 }}
            />
            {resetErro && <div style={{ fontSize: FONT.xs, color: C.desp, marginBottom: 10 }}>{resetErro}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhBtn onClick={() => setModalReset(null)}>Cancelar</GhBtn>
              <PrBtn onClick={handleResetar} disabled={resetLoad}>{resetLoad ? 'Salvando...' : 'Salvar senha'}</PrBtn>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: Confirmar exclusão */}
      {modalExcluir && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setModalExcluir(null); }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, padding: '28px', width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 12 }}>Excluir acesso</div>
            <div style={{ fontSize: FONT.sm, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
              Tem certeza que deseja remover o acesso de <strong style={{ color: C.text }}>{modalExcluir.nome}</strong>?<br />
              <span style={{ fontSize: FONT.xs, color: C.desp, display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} /> O login será excluído permanentemente.</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <GhBtn onClick={() => setModalExcluir(null)}>Cancelar</GhBtn>
              <button
                onClick={handleExcluir}
                disabled={excluirLoad}
                style={{ background: excluirLoad ? C.desp + '66' : C.desp, color: '#fff', border: 'none', borderRadius: RADIUS.md, padding: '8px 18px', fontSize: FONT.sm, fontWeight: 700, fontFamily: "'Inter',sans-serif", cursor: excluirLoad ? 'not-allowed' : 'pointer' }}
              >{excluirLoad ? 'Excluindo...' : 'Excluir acesso'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Toggle de modo inline no card ────────────────────────────────────────────
function ModoToggle({ isEditor, loading, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: C.bg, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: 3 }}>
      <button
        onClick={() => !isEditor || loading ? null : onChange('visualizacao')}
        disabled={loading}
        style={{
          padding: '3px 10px', borderRadius: 4, border: 'none',
          fontSize: FONT.xs, fontFamily: "'Inter',sans-serif",
          cursor: isEditor && !loading ? 'pointer' : 'default',
          background: !isEditor ? C.brand : 'transparent',
          color: !isEditor ? '#fff' : C.textMuted,
          fontWeight: !isEditor ? 700 : 400,
          transition: 'all .15s',
        }}
      ><Eye size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Visualização</button>
      <button
        onClick={() => isEditor || loading ? null : onChange('editor')}
        disabled={loading}
        style={{
          padding: '3px 10px', borderRadius: 4, border: 'none',
          fontSize: FONT.xs, fontFamily: "'Inter',sans-serif",
          cursor: !isEditor && !loading ? 'pointer' : 'default',
          background: isEditor ? '#C084FC' : 'transparent',
          color: isEditor ? '#fff' : C.textMuted,
          fontWeight: isEditor ? 700 : 400,
          transition: 'all .15s',
        }}
      ><Pencil size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Editor</button>
    </div>
  );
}

// ── Card de opção de modo na criação ─────────────────────────────────────────
function ModoOpcao({ ativo, onClick, icon, label, desc }) {
  const cor = label === 'Editor' ? '#C084FC' : C.brand;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 12px', borderRadius: RADIUS.md, cursor: 'pointer',
        border: `2px solid ${ativo ? cor : C.border}`,
        background: ativo ? cor + '12' : 'transparent',
        textAlign: 'left', fontFamily: "'Inter',sans-serif",
        transition: 'all .15s',
      }}
    >
      <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: FONT.xs, fontWeight: 700, color: ativo ? cor : C.text }}>{label}</div>
      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{desc}</div>
    </button>
  );
}

// ── Botões auxiliares ────────────────────────────────────────────────────────
function SmBtn({ children, onClick, danger }) {
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

function PrBtn({ children, onClick, type = 'button', disabled }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
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

function GhBtn({ children, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: 'transparent', color: C.textMuted,
        border: `1px solid ${C.border}`, borderRadius: RADIUS.md,
        padding: '8px 18px', fontSize: FONT.sm,
        fontFamily: "'Inter',sans-serif", cursor: 'pointer',
      }}
    >{children}</button>
  );
}
