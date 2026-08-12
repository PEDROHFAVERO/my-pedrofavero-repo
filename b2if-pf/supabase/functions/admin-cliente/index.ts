import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autorizado' }, 401);

    // Cliente admin (service_role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Cliente para verificar quem está chamando
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) return json({ error: 'Sessão inválida' }, 401);

    // Verifica se quem chama é planejador ou manager
    const { data: perfil } = await supabaseAdmin
      .from('planejadores')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (!perfil || !['planejador', 'manager'].includes(perfil.role)) {
      return json({ error: 'Sem permissão' }, 403);
    }

    const isManager = perfil.role === 'manager';

    const body = await req.json();
    const { action } = body;

    // ── CRIAR ACESSO DE CLIENTE ───────────────────────────────────────────────
    if (action === 'criar') {
      const { email, senha, nome, clienteId, modoAcesso } = body;

      if (!email || !senha || !nome || !clienteId) {
        return json({ error: 'Campos obrigatórios ausentes' }, 400);
      }

      const modoFinal = modoAcesso === 'editor' ? 'editor' : 'visualizacao';

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,   // ← confirmação automática
        user_metadata: { nome, role: 'cliente' },
      });

      if (createError) return json({ error: createError.message }, 400);

      const { error: acessoError } = await supabaseAdmin
        .from('cliente_acessos')
        .insert({ cliente_id: clienteId, user_id: newUser.user.id, nome, modo_acesso: modoFinal });

      if (acessoError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return json({ error: acessoError.message }, 400);
      }

      return json({ user_id: newUser.user.id, email, nome, modo_acesso: modoFinal });
    }

    // ── CRIAR PLANEJADOR (apenas Manager) ────────────────────────────────────
    if (action === 'criar_planejador') {
      if (!isManager) return json({ error: 'Apenas o Manager pode criar planejadores' }, 403);

      const { email, senha, nome } = body;
      if (!email || !senha || !nome) return json({ error: 'Campos obrigatórios ausentes' }, 400);

      // Cria usuário via Admin API com email já confirmado
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,   // ← confirmação automática, sem email
        user_metadata: { nome, role: 'planejador' },
      });

      if (createError) return json({ error: createError.message }, 400);

      // Insere na tabela planejadores
      const { error: planErr } = await supabaseAdmin.from('planejadores').insert({
        id: newUser.user.id,
        nome,
        email,
        role: 'planejador',
        ativo: true,
      });

      if (planErr) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return json({ error: planErr.message }, 400);
      }

      return json({ user_id: newUser.user.id, email, nome, email_confirmado: true });
    }

    // ── CONFIRMAR EMAIL DE PLANEJADOR (apenas Manager) ────────────────────────
    if (action === 'confirmar_email') {
      if (!isManager) return json({ error: 'Apenas o Manager pode confirmar emails' }, 403);

      const { userId } = body;
      if (!userId) return json({ error: 'userId obrigatório' }, 400);

      const { data: updated, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });

      if (error) return json({ error: error.message }, 400);

      return json({ ok: true, email: updated.user.email, confirmed_at: updated.user.email_confirmed_at });
    }

    // ── LISTAR PLANEJADORES COM STATUS DE CONFIRMAÇÃO (apenas Manager) ────────
    if (action === 'listar_planejadores') {
      if (!isManager) return json({ error: 'Apenas o Manager pode listar planejadores' }, 403);

      // Busca planejadores da tabela
      const { data: planejadores, error: pErr } = await supabaseAdmin
        .from('planejadores')
        .select('*')
        .eq('role', 'planejador')
        .order('criado_em', { ascending: true });

      if (pErr) return json({ error: pErr.message }, 400);

      if (!planejadores || planejadores.length === 0) return json([]);

      // Busca usuários Auth para obter status de confirmação
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
      if (authErr) return json({ error: authErr.message }, 400);

      const authMap = new Map(authData.users.map(u => [u.id, u]));

      const resultado = planejadores.map(p => ({
        ...p,
        email_confirmado: !!authMap.get(p.id)?.email_confirmed_at,
        confirmado_em: authMap.get(p.id)?.email_confirmed_at ?? null,
      }));

      return json(resultado);
    }

    // ── RESETAR SENHA ─────────────────────────────────────────────────────────
    if (action === 'resetar_senha') {
      const { userId, novaSenha } = body;

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: novaSenha,
      });

      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ── EXCLUIR ACESSO DE CLIENTE ─────────────────────────────────────────────
    if (action === 'excluir') {
      const { userId } = body;

      await supabaseAdmin.from('cliente_acessos').delete().eq('user_id', userId);

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);

      return json({ ok: true });
    }

    // ── EXCLUIR PLANEJADOR (apenas Manager) ───────────────────────────────────
    if (action === 'excluir_planejador') {
      if (!isManager) return json({ error: 'Apenas o Manager pode excluir planejadores' }, 403);

      const { userId } = body;
      if (!userId) return json({ error: 'userId obrigatório' }, 400);

      // Remove da tabela planejadores
      await supabaseAdmin.from('planejadores').delete().eq('id', userId);

      // Remove do Auth
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);

      return json({ ok: true });
    }

    return json({ error: 'Ação desconhecida' }, 400);

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
