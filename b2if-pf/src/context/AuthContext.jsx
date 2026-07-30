import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { EDGE_FN_URL, SUPABASE_ANON_KEY } from '../lib/appConfig.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null);
  // sessao = { user, perfil, clienteId (só para role=cliente) }
  const [carregando, setCarregando] = useState(true);

  // ── Manager Viewing State (Fase 0.4) ───────────────────────────────────────
  // Substitui localStorage.manager_viewing por React state.
  // Lê do localStorage na inicialização para sobreviver a refreshes de página
  // (o manager precisava recarregar a página para entrar no hub do planejador —
  // isso agora é opcional, mas mantemos compatibilidade de refresh).
  const [managerViewing, _setManagerViewing] = useState(() => {
    try { return JSON.parse(localStorage.getItem('manager_viewing') || 'null'); } catch { return null; }
  });

  function setManagerViewing(dados) {
    if (dados) {
      try { localStorage.setItem('manager_viewing', JSON.stringify(dados)); } catch { /* ignora */ }
    } else {
      try { localStorage.removeItem('manager_viewing'); } catch { /* ignora */ }
    }
    _setManagerViewing(dados);
  }

  function limparManagerViewing() {
    setManagerViewing(null);
  }

  // ── Restaura sessão ao carregar ─────────────────────────────────────────────
  useEffect(() => {
    // Timeout de segurança: se o Supabase não responder em 8s, libera a tela de login
    const timeout = setTimeout(() => setCarregando(false), 8000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      if (session) {
        resolverSessao(session.user).then(s => {
          setSessao(s);
          setCarregando(false);
        });
      } else {
        setCarregando(false);
      }
    }).catch(() => { clearTimeout(timeout); setCarregando(false); });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        resolverSessao(session.user).then(s => setSessao(s));
      } else {
        setSessao(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Resolve qual perfil o usuário tem: manager, planejador ou cliente
  async function resolverSessao(user) {
    // 1. Verifica primeiro se é planejador/manager — prioridade sobre cliente_acessos
    //    IMPORTANTE: planejadores têm precedência para evitar que um planejador que
    //    também tenha um registro em cliente_acessos seja tratado como cliente,
    //    o que bloquearia o modo de edição (modoLeitura=true) silenciosamente.
    const { data: perfil, error: erroPerfil } = await supabase
      .from('planejadores')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    console.log('[resolverSessao] planejadores:', { perfil, erroPerfil, userId: user.id });

    if (perfil) {
      return { user, perfil, clienteId: null };
    }

    // 2. Não é planejador → verifica se é cliente
    const { data: acesso, error: erroAcesso } = await supabase
      .from('cliente_acessos')
      .select('cliente_id, nome, modo_acesso')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('[resolverSessao] cliente_acessos:', { acesso, erroAcesso, userId: user.id });

    if (acesso) {
      // Garante que modo_acesso nunca seja undefined/null — coluna pode não existir
      // em instâncias onde a migration ainda não foi executada.
      // DEFESA: se mode_acesso vier null (coluna ausente no banco), usa 'visualizacao'
      // como fallback seguro. Executar sql/migration_modo_acesso.sql para corrigir.
      const modoAcesso = acesso.modo_acesso || 'visualizacao'; // 'visualizacao' | 'editor'

      if (!acesso.modo_acesso) {
        console.warn(
          '[resolverSessao] ATENÇÃO: modo_acesso é null/undefined para user_id:', user.id,
          '— Execute sql/migration_modo_acesso.sql no Supabase para corrigir.',
        );
      }

      return {
        user,
        perfil: { id: user.id, nome: acesso.nome, email: user.email, role: 'cliente', ativo: true },
        clienteId: acesso.cliente_id,
        modoAcesso,
      };
    }

    return { user, perfil: null, clienteId: null };
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async function login(email, senha) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(error.message);

    const s = await resolverSessao(data.user);
    if (!s.perfil) throw new Error('Usuário não encontrado no sistema. Contacte o seu planejador.');
    if (!s.perfil.ativo) throw new Error('Conta desativada. Contacte o seu planejador.');
    setSessao(s);
    return s.perfil;
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function logout() {
    await supabase.auth.signOut();
    setSessao(null);
  }

  // ── Criar planejador (apenas Manager) ──────────────────────────────────────
  // Usa Edge Function admin-cliente com email_confirm:true automático
  async function criarPlanejador({ nome, email, senha }) {
    return chamarAdminFn({ action: 'criar_planejador', nome, email, senha });
  }

  // ── Listar planejadores com status de confirmação (apenas Manager) ──────────
  // Retorna campo email_confirmado via Admin Auth API na Edge Function
  async function listarPlanejadores() {
    try {
      const resultado = await chamarAdminFn({ action: 'listar_planejadores' });
      if (Array.isArray(resultado)) return resultado;
      throw new Error('Resposta inválida');
    } catch {
      // Fallback: busca direta sem status de confirmação de email
      const { data, error } = await supabase
        .from('planejadores')
        .select('*')
        .eq('role', 'planejador')
        .order('criado_em', { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []).map(p => ({ ...p, email_confirmado: null }));
    }
  }

  // ── Confirmar email de planejador manualmente (apenas Manager) ─────────────
  async function confirmarEmailPlanejador(userId) {
    return chamarAdminFn({ action: 'confirmar_email', userId });
  }

  // ── Renomear planejador ─────────────────────────────────────────────────────
  async function renomearPlanejador(id, novoNome) {
    const { error } = await supabase
      .from('planejadores')
      .update({ nome: novoNome })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Ativar / Desativar planejador ───────────────────────────────────────────
  async function toggleAtivoPlanejador(id, ativo) {
    const { error } = await supabase
      .from('planejadores')
      .update({ ativo })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Resetar senha (envia email de reset via Supabase) ──────────────────────
  async function resetarSenha(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw new Error(error.message);
  }

  // ── Excluir planejador (apenas Manager) ────────────────────────────────────
  // Usa Edge Function admin-cliente: remove do Auth + tabela planejadores
  async function excluirPlanejador(id) {
    return chamarAdminFn({ action: 'excluir_planejador', userId: id });
  }

  // ── Helper: chama a Edge Function admin-cliente ──────────────────────────
  async function chamarAdminFn(body) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log('[adminFn] session:', sessionData?.session, 'error:', sessionError);
    
    if (!sessionData?.session) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const FN_URL = EDGE_FN_URL;
    const ANON_KEY = SUPABASE_ANON_KEY;

    console.log('[adminFn] chamando:', FN_URL, 'body:', body);

    let res;
    try {
      res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify(body),
      });
    } catch (fetchErr) {
      console.error('[adminFn] fetch falhou:', fetchErr);
      throw new Error('Não foi possível conectar à função. Verifique sua conexão.');
    }

    const text = await res.text();
    console.log('[adminFn] resposta raw:', res.status, text);

    let json;
    try { json = JSON.parse(text); } catch { json = { error: text }; }

    if (!res.ok || json.error) throw new Error(json.error || `Erro HTTP ${res.status}`);
    return json;
  }

  // ── Criar acesso de cliente ─────────────────────────────────────────────────
  async function criarAcessoCliente({ clienteId, nome, email, senha, modoAcesso = 'visualizacao' }) {
    return chamarAdminFn({ action: 'criar', clienteId, nome, email, senha, modoAcesso });
  }

  // ── Listar acessos de um cliente ────────────────────────────────────────────
  async function listarAcessosCliente(clienteId) {
    const { data, error } = await supabase
      .from('cliente_acessos')
      .select('id, user_id, nome, criado_em, modo_acesso')
      .eq('cliente_id', clienteId)
      .order('criado_em', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }

  // ── Atualizar modo de acesso de um cliente ──────────────────────────────
  async function atualizarModoAcesso(userId, modoAcesso) {
    const { error } = await supabase
      .from('cliente_acessos')
      .update({ modo_acesso: modoAcesso })
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  // ── Resetar senha de acesso cliente ────────────────────────────────────────
  async function resetarSenhaCliente(userId, novaSenha) {
    return chamarAdminFn({ action: 'resetar_senha', userId, novaSenha });
  }

  // ── Excluir acesso de cliente ───────────────────────────────────────────────
  async function excluirAcessoCliente(userId) {
    return chamarAdminFn({ action: 'excluir', userId });
  }

  const value = {
    sessao,
    carregando,
    login,
    logout,
    criarPlanejador,
    listarPlanejadores,
    confirmarEmailPlanejador,
    renomearPlanejador,
    toggleAtivoPlanejador,
    resetarSenha,
    excluirPlanejador,
    criarAcessoCliente,
    listarAcessosCliente,
    atualizarModoAcesso,
    resetarSenhaCliente,
    excluirAcessoCliente,
    isManager:    sessao?.perfil?.role === 'manager',
    isPlanejador: sessao?.perfil?.role === 'planejador',
    isCliente:    sessao?.perfil?.role === 'cliente',
    logado: !!sessao,
    // Fase 0.4 — Manager Viewing (sem localStorage direto)
    managerViewing,
    setManagerViewing,
    limparManagerViewing,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
