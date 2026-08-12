-- =============================================================================
-- B2IF – RLS para tabelas bot: acesso de usuários autenticados (planejadores)
-- Migration: 20260729_bot_rls_authenticated.sql
--
-- Problema: bot_sessions, bot_lembretes, bot_messages, bot_config e
-- cliente_telefones só tinham política para service_role. O frontend usa
-- anon key com usuário autenticado (auth.uid()) → RLS bloqueava insert/select.
--
-- Estrutura real das tabelas (verificada em 2026-07-29):
--   bot_config:       assessor_id uuid
--   bot_lembretes:    assessor_id uuid, session_id uuid
--   bot_messages:     session_id uuid
--   bot_sessions:     assessor_id uuid, cliente_id text, telefone text
--   cliente_telefones: cliente_id text, telefone text  (sem assessor direto)
--
-- Regra: planejador acessa apenas registros onde assessor_id = auth.uid()
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. bot_sessions  (assessor_id = auth.uid())
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "authenticated_select_own" ON public.bot_sessions
    FOR SELECT TO authenticated
    USING (assessor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_insert_own" ON public.bot_sessions
    FOR INSERT TO authenticated
    WITH CHECK (assessor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_update_own" ON public.bot_sessions
    FOR UPDATE TO authenticated
    USING (assessor_id = auth.uid())
    WITH CHECK (assessor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_delete_own" ON public.bot_sessions
    FOR DELETE TO authenticated
    USING (assessor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. bot_lembretes  (assessor_id = auth.uid())
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "authenticated_select_own" ON public.bot_lembretes
    FOR SELECT TO authenticated
    USING (assessor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_insert_own" ON public.bot_lembretes
    FOR INSERT TO authenticated
    WITH CHECK (assessor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_update_own" ON public.bot_lembretes
    FOR UPDATE TO authenticated
    USING (assessor_id = auth.uid())
    WITH CHECK (assessor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_delete_own" ON public.bot_lembretes
    FOR DELETE TO authenticated
    USING (assessor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 3. bot_messages  (via session_id → bot_sessions.assessor_id)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "authenticated_select_own" ON public.bot_messages
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.bot_sessions s
        WHERE s.id = bot_messages.session_id
          AND s.assessor_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_insert_own" ON public.bot_messages
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.bot_sessions s
        WHERE s.id = bot_messages.session_id
          AND s.assessor_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 4. bot_config  (assessor_id = auth.uid())
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE POLICY "authenticated_select_own" ON public.bot_config
    FOR SELECT TO authenticated
    USING (assessor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_insert_own" ON public.bot_config
    FOR INSERT TO authenticated
    WITH CHECK (assessor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_update_own" ON public.bot_config
    FOR UPDATE TO authenticated
    USING (assessor_id = auth.uid())
    WITH CHECK (assessor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 5. cliente_telefones  (via clientes.planejador_id = auth.uid())
-- ---------------------------------------------------------------------------
ALTER TABLE public.cliente_telefones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_all" ON public.cliente_telefones
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_select_own" ON public.cliente_telefones
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_telefones.cliente_id
          AND c.planejador_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_insert_own" ON public.cliente_telefones
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_telefones.cliente_id
          AND c.planejador_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_update_own" ON public.cliente_telefones
    FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_telefones.cliente_id
          AND c.planejador_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated_delete_own" ON public.cliente_telefones
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_telefones.cliente_id
          AND c.planejador_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- FIM
-- =============================================================================
