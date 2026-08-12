-- ═══════════════════════════════════════════════════════════════════════════════
-- Planejador PF — Script de Setup Supabase  (White Label — Modelo C)
--
-- Execute este script no SQL Editor do seu projeto Supabase:
--   https://app.supabase.com → SQL Editor → New query → cole e execute
--
-- O script é idempotente: pode ser executado várias vezes sem erro.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXTENSÃO uuid-ossp (já vem habilitada no Supabase por padrão)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABELA: planejadores
--    Armazena manager e planejadores (usuários da plataforma, não clientes).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planejadores (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT        NOT NULL,
  email      TEXT        NOT NULL UNIQUE,
  role       TEXT        NOT NULL DEFAULT 'planejador'
                         CHECK (role IN ('manager', 'planejador')),
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TABELA: clientes
--    Cada linha = um cliente de um planejador.
--    Todos os dados do cliente ficam no campo JSONB 'dados'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clientes (
  id            TEXT        PRIMARY KEY,          -- nanoid gerado pelo front-end
  planejador_id UUID        NOT NULL REFERENCES public.planejadores(id) ON DELETE CASCADE,
  nome          TEXT        NOT NULL,
  dados         JSONB       NOT NULL DEFAULT '{}',
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para buscas por planejador
CREATE INDEX IF NOT EXISTS idx_clientes_planejador
  ON public.clientes (planejador_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TABELA: cliente_acessos
--    Logins que um cliente pode usar para acessar o sistema.
--    modo_acesso: 'visualizacao' = só leitura | 'editor' = pode editar
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cliente_acessos (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id  TEXT        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT        NOT NULL,
  modo_acesso TEXT        NOT NULL DEFAULT 'visualizacao'
                          CHECK (modo_acesso IN ('visualizacao', 'editor')),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cliente_acessos_user
  ON public.cliente_acessos (user_id);

CREATE INDEX IF NOT EXISTS idx_cliente_acessos_cliente
  ON public.cliente_acessos (cliente_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.planejadores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_acessos ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. POLÍTICAS RLS — planejadores
-- ─────────────────────────────────────────────────────────────────────────────

-- Cada planejador vê apenas o seu próprio registro
DROP POLICY IF EXISTS "planejadores_select_own" ON public.planejadores;
CREATE POLICY "planejadores_select_own"
  ON public.planejadores FOR SELECT
  USING (auth.uid() = id);

-- Manager vê todos os planejadores
DROP POLICY IF EXISTS "manager_select_all_planejadores" ON public.planejadores;
CREATE POLICY "manager_select_all_planejadores"
  ON public.planejadores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Manager pode inserir planejadores
DROP POLICY IF EXISTS "manager_insert_planejadores" ON public.planejadores;
CREATE POLICY "manager_insert_planejadores"
  ON public.planejadores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Manager pode atualizar planejadores
DROP POLICY IF EXISTS "manager_update_planejadores" ON public.planejadores;
CREATE POLICY "manager_update_planejadores"
  ON public.planejadores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Manager pode excluir planejadores
DROP POLICY IF EXISTS "manager_delete_planejadores" ON public.planejadores;
CREATE POLICY "manager_delete_planejadores"
  ON public.planejadores FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. POLÍTICAS RLS — clientes
-- ─────────────────────────────────────────────────────────────────────────────

-- Planejador (ou manager visualizando) vê seus clientes
DROP POLICY IF EXISTS "planejadores_select_clientes" ON public.clientes;
CREATE POLICY "planejadores_select_clientes"
  ON public.clientes FOR SELECT
  USING (planejador_id = auth.uid());

-- Manager vê todos os clientes
DROP POLICY IF EXISTS "manager_select_all_clientes" ON public.clientes;
CREATE POLICY "manager_select_all_clientes"
  ON public.clientes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Cliente logado vê apenas o seu próprio cliente
DROP POLICY IF EXISTS "cliente_select_own" ON public.clientes;
CREATE POLICY "cliente_select_own"
  ON public.clientes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cliente_acessos ca
      WHERE ca.user_id = auth.uid() AND ca.cliente_id = clientes.id
    )
  );

-- Planejador pode inserir clientes
DROP POLICY IF EXISTS "planejadores_insert_clientes" ON public.clientes;
CREATE POLICY "planejadores_insert_clientes"
  ON public.clientes FOR INSERT
  WITH CHECK (planejador_id = auth.uid());

-- Manager pode inserir clientes de qualquer planejador (ex: via hub do planejador)
DROP POLICY IF EXISTS "manager_insert_clientes" ON public.clientes;
CREATE POLICY "manager_insert_clientes"
  ON public.clientes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Planejador pode atualizar seus clientes
DROP POLICY IF EXISTS "planejadores_update_clientes" ON public.clientes;
CREATE POLICY "planejadores_update_clientes"
  ON public.clientes FOR UPDATE
  USING (planejador_id = auth.uid());

-- Manager pode atualizar clientes de qualquer planejador (operação via hub)
DROP POLICY IF EXISTS "manager_update_clientes" ON public.clientes;
CREATE POLICY "manager_update_clientes"
  ON public.clientes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Planejador pode excluir seus clientes
DROP POLICY IF EXISTS "planejadores_delete_clientes" ON public.clientes;
CREATE POLICY "planejadores_delete_clientes"
  ON public.clientes FOR DELETE
  USING (planejador_id = auth.uid());

-- Manager pode excluir clientes de qualquer planejador
DROP POLICY IF EXISTS "manager_delete_clientes" ON public.clientes;
CREATE POLICY "manager_delete_clientes"
  ON public.clientes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. POLÍTICAS RLS — cliente_acessos
-- ─────────────────────────────────────────────────────────────────────────────

-- Planejador vê acessos dos seus clientes
DROP POLICY IF EXISTS "planejadores_select_acessos" ON public.cliente_acessos;
CREATE POLICY "planejadores_select_acessos"
  ON public.cliente_acessos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_acessos.cliente_id AND c.planejador_id = auth.uid()
    )
  );

-- Cada usuário cliente vê seu próprio acesso
DROP POLICY IF EXISTS "cliente_select_own_acesso" ON public.cliente_acessos;
CREATE POLICY "cliente_select_own_acesso"
  ON public.cliente_acessos FOR SELECT
  USING (user_id = auth.uid());

-- Inserts/updates/deletes via Edge Function (service_role) — não precisam de policy pública

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. CRIAR O USUÁRIO MANAGER INICIAL
--
-- ATENÇÃO: Este passo NÃO pode ser feito via SQL puro pois requer a API Admin.
-- Faça via Supabase Dashboard:
--   Authentication → Users → Add user
--   Email: seu_email@empresa.com
--   Password: senha_forte
--
-- Depois, execute este SQL substituindo o UUID retornado pelo Dashboard:
--
-- INSERT INTO public.planejadores (id, nome, email, role, ativo)
-- VALUES (
--   'UUID_DO_USUARIO_CRIADO_ACIMA',
--   'Nome do Manager',
--   'seu_email@empresa.com',
--   'manager',
--   true
-- ) ON CONFLICT (id) DO NOTHING;
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. EDGE FUNCTION — admin-cliente
--
-- Implante a Edge Function via Supabase CLI:
--   1. Instale: npm install -g supabase
--   2. Login:   supabase login
--   3. Link:    supabase link --project-ref SEU_PROJECT_ID
--   4. Deploy:  supabase functions deploy admin-cliente
--
-- O código da função está em: supabase/functions/admin-cliente/index.ts
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- FIM DO SCRIPT
-- ─────────────────────────────────────────────────────────────────────────────
SELECT 'Setup concluído com sucesso!' AS status;
