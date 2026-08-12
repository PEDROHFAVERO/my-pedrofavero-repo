-- =============================================================================
-- Migration: Fix RLS Infinite Recursion em planejadores e clientes
-- Data: 2026-08-12
-- Autor: genspark_ai_developer
--
-- PROBLEMA IDENTIFICADO:
--   Erro: "infinite recursion detected in policy for relation 'clientes'"
--   (e também para 'planejadores')
--
--   O ciclo acontece em dois lugares:
--
--   CICLO 1 — planejadores (afeta TODOS os usuários ao salvar):
--     workspace_update_clientes (UPDATE clientes)
--       → SELECT workspace_id FROM planejadores WHERE id = auth.uid()
--         → planejadores_select_workspace (SELECT planejadores)
--           → SELECT workspace_id FROM planejadores WHERE id = auth.uid()
--             → planejadores_select_workspace ← LOOP INFINITO
--
--     Mesma recursão ocorre em: workspace_insert_clientes, workspace_delete_clientes,
--     workspace_select_clientes, versoes_select_planejador, versoes_insert_planejador,
--     manager_insert_planejadores, manager_update_planejadores, manager_delete_planejadores
--
--   CICLO 2 — cliente_acessos ↔ clientes (afeta editores de clientes):
--     cliente_editor_atualiza_proprio (UPDATE clientes) [foi DROPADA, mas precisa ser recriada]
--       → SELECT FROM cliente_acessos
--         → planejador_gerencia_acessos (ALL cliente_acessos)
--           → SELECT FROM clientes JOIN planejadores
--             → workspace_update_clientes (UPDATE clientes) ← LOOP
--
-- SOLUÇÃO:
--   Funções SECURITY DEFINER executam com privilégios do criador (service_role),
--   ignorando RLS das tabelas que consultam. Quebram o ciclo na raiz.
--
--   1. get_my_workspace_id_safe() → lê planejadores SEM acionar RLS de planejadores
--      Substitui o subselect inline nas policies de clientes, versoes e planejadores
--
--   2. usuario_eh_editor_do_cliente(TEXT) → lê cliente_acessos SEM acionar seu RLS
--      Permite policy de UPDATE para clientes com modo_acesso='editor'
--
-- IDEMPOTENTE: todos os passos usam OR REPLACE / DROP IF EXISTS / IF NOT EXISTS.
-- =============================================================================

-- =============================================================================
-- PASSO 1: Criar função SECURITY DEFINER para resolver workspace_id do usuário
--          sem acionar recursão nas policies de planejadores
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_workspace_id_safe()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Executa com privilégios do criador (bypassa RLS de planejadores)
  -- Retorna workspace_id do usuário logado sem causar recursão
  SELECT workspace_id
  FROM   public.planejadores
  WHERE  id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_workspace_id_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_workspace_id_safe() TO anon;

COMMENT ON FUNCTION public.get_my_workspace_id_safe IS
  'Retorna workspace_id do planejador/manager logado sem acionar RLS. '
  'SECURITY DEFINER: executa com privilégios do criador para evitar '
  'recursão infinita nas policies que consultam planejadores.';

-- =============================================================================
-- PASSO 2: Criar função SECURITY DEFINER para verificar se usuário é editor
--          de um cliente sem acionar recursão em cliente_acessos
-- =============================================================================

CREATE OR REPLACE FUNCTION public.usuario_eh_editor_do_cliente(p_cliente_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Executa com privilégios do criador (bypassa RLS de cliente_acessos)
  -- Verifica se auth.uid() tem modo_acesso='editor' para o cliente informado
  SELECT EXISTS (
    SELECT 1
    FROM   public.cliente_acessos ca
    WHERE  ca.user_id     = auth.uid()
      AND  ca.cliente_id  = p_cliente_id
      AND  ca.modo_acesso = 'editor'
  );
$$;

GRANT EXECUTE ON FUNCTION public.usuario_eh_editor_do_cliente(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_eh_editor_do_cliente(TEXT) TO anon;

COMMENT ON FUNCTION public.usuario_eh_editor_do_cliente IS
  'Verifica se o usuário logado é editor do cliente informado, '
  'sem acionar RLS de cliente_acessos (SECURITY DEFINER). '
  'Parâmetro TEXT porque clientes.id e cliente_acessos.cliente_id são TEXT.';

-- =============================================================================
-- PASSO 3: Recriar policies de planejadores usando get_my_workspace_id_safe()
--          Quebra o ciclo CICLO 1 na tabela planejadores
-- =============================================================================

-- Dropa a policy recursiva original
DROP POLICY IF EXISTS "planejadores_select_workspace" ON public.planejadores;

-- Recria sem recursão: usa a função SECURITY DEFINER para obter o workspace
CREATE POLICY "planejadores_select_workspace"
  ON public.planejadores FOR SELECT
  USING (
    workspace_id = public.get_my_workspace_id_safe()
  );

-- Recriar as policies de manager também (usavam o mesmo subselect recursivo)
DROP POLICY IF EXISTS "manager_insert_planejadores" ON public.planejadores;
CREATE POLICY "manager_insert_planejadores"
  ON public.planejadores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE  p.id   = auth.uid()
        AND  p.role = 'manager'
    )
    AND workspace_id = auth.uid()
  );

DROP POLICY IF EXISTS "manager_update_planejadores" ON public.planejadores;
CREATE POLICY "manager_update_planejadores"
  ON public.planejadores FOR UPDATE
  USING (
    workspace_id = public.get_my_workspace_id_safe()
    AND EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE  p.id   = auth.uid()
        AND  p.role = 'manager'
    )
  );

DROP POLICY IF EXISTS "manager_delete_planejadores" ON public.planejadores;
CREATE POLICY "manager_delete_planejadores"
  ON public.planejadores FOR DELETE
  USING (
    workspace_id = public.get_my_workspace_id_safe()
    AND EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE  p.id   = auth.uid()
        AND  p.role = 'manager'
    )
    AND id <> auth.uid()
  );

-- =============================================================================
-- PASSO 4: Recriar policies de clientes usando get_my_workspace_id_safe()
--          Quebra o ciclo CICLO 1 na tabela clientes
-- =============================================================================

-- SELECT: planejador/manager do workspace
DROP POLICY IF EXISTS "workspace_select_clientes" ON public.clientes;
CREATE POLICY "workspace_select_clientes"
  ON public.clientes FOR SELECT
  USING (
    workspace_id = public.get_my_workspace_id_safe()
  );

-- INSERT: planejador/manager do workspace
DROP POLICY IF EXISTS "workspace_insert_clientes" ON public.clientes;
CREATE POLICY "workspace_insert_clientes"
  ON public.clientes FOR INSERT
  WITH CHECK (
    planejador_id IN (
      SELECT p.id FROM public.planejadores p
      WHERE  p.workspace_id = public.get_my_workspace_id_safe()
    )
    AND workspace_id = public.get_my_workspace_id_safe()
  );

-- UPDATE: planejador/manager do workspace
DROP POLICY IF EXISTS "workspace_update_clientes" ON public.clientes;
CREATE POLICY "workspace_update_clientes"
  ON public.clientes FOR UPDATE
  USING (
    workspace_id = public.get_my_workspace_id_safe()
  );

-- DELETE: planejador/manager do workspace
DROP POLICY IF EXISTS "workspace_delete_clientes" ON public.clientes;
CREATE POLICY "workspace_delete_clientes"
  ON public.clientes FOR DELETE
  USING (
    workspace_id = public.get_my_workspace_id_safe()
  );

-- =============================================================================
-- PASSO 5: Recriar policy de UPDATE para clientes com modo_acesso='editor'
--          (a policy foi DROPADA na sessão anterior para eliminar recursão CICLO 2)
--          Agora recriamos com usuario_eh_editor_do_cliente() que bypassa o ciclo
-- =============================================================================

DROP POLICY IF EXISTS "cliente_editor_atualiza_proprio" ON public.clientes;
CREATE POLICY "cliente_editor_atualiza_proprio"
  ON public.clientes FOR UPDATE
  USING (
    public.usuario_eh_editor_do_cliente(clientes.id)
  );

-- =============================================================================
-- PASSO 6: Recriar policies de clientes_versoes usando get_my_workspace_id_safe()
--          Quebra recursão no histórico de versões (checkpoint, auto-save, etc.)
-- =============================================================================

DROP POLICY IF EXISTS "versoes_select_planejador" ON public.clientes_versoes;
CREATE POLICY "versoes_select_planejador"
  ON public.clientes_versoes FOR SELECT
  USING (
    workspace_id = public.get_my_workspace_id_safe()
  );

DROP POLICY IF EXISTS "versoes_insert_planejador" ON public.clientes_versoes;
CREATE POLICY "versoes_insert_planejador"
  ON public.clientes_versoes FOR INSERT
  WITH CHECK (
    workspace_id = public.get_my_workspace_id_safe()
  );

-- =============================================================================
-- VERIFICAÇÃO FINAL
-- =============================================================================
-- Execute no SQL Editor do Supabase para confirmar as policies:
--
-- SELECT policyname, tablename, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('clientes', 'planejadores', 'clientes_versoes')
-- ORDER BY tablename, cmd, policyname;
--
-- Deve retornar as policies sem subselects recursivos inline —
-- apenas chamadas a get_my_workspace_id_safe() e usuario_eh_editor_do_cliente().
-- =============================================================================
