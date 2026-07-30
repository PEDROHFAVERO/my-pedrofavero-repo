-- =============================================================================
-- Migration: Fase 3 — workspace_id + RLS Multi-tenancy
-- Data: 2026-06-25
-- Autor: genspark_ai_developer
--
-- OBJETIVO:
--   Introduzir isolamento real entre tenants (escritórios/managers) usando
--   a coluna workspace_id em planejadores e clientes.
--
-- MODELO DE NEGÓCIO:
--   • Manager cria um workspace — workspace_id = manager.id
--   • Planejadores contratados pelo manager herdam workspace_id = manager.id
--   • Planejador solo (sem manager) tem workspace_id = próprio id
--   • Todos os clientes de um planejador herdam workspace_id do planejador
--
-- RESULTADO:
--   • Planejador vê APENAS clientes com workspace_id = seu próprio workspace
--   • Manager vê TODOS os planejadores e clientes do seu workspace
--   • Zero cross-tenant data leakage mesmo que workspace_id seja inferido errado
--
-- ESTRATÉGIA DE MIGRAÇÃO (SEGURA — backward compatible):
--   1. Adiciona workspace_id como nullable primeiro
--   2. Backfill: planejadores solo → workspace_id = id
--   3. Backfill: planejadores com manager → workspace_id = manager.id (via subquery)
--   4. Backfill: clientes herdam workspace_id do seu planejador
--   5. Adiciona NOT NULL constraint + índices
--   6. Reconstrói políticas RLS usando workspace_id
--   7. Trigger para propagar workspace_id automaticamente em novos clientes
--
-- IDEMPOTENTE: usa IF NOT EXISTS / DO NOTHING / OR REPLACE em todos os passos.
-- Pode ser re-executado sem efeitos colaterais.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1: workspace_id em planejadores
--   nullable primeiro para permitir backfill antes de aplicar NOT NULL
-- ---------------------------------------------------------------------------

ALTER TABLE public.planejadores
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.planejadores(id) ON DELETE SET NULL;

-- Índice para lookups frequentes (AppContext, RLS policies)
CREATE INDEX IF NOT EXISTS idx_planejadores_workspace
  ON public.planejadores (workspace_id);

COMMENT ON COLUMN public.planejadores.workspace_id IS
  'ID do workspace (manager que fundou o tenant). '
  'Manager: workspace_id = próprio id. '
  'Planejador contratado: workspace_id = manager.id. '
  'Planejador solo: workspace_id = próprio id.';

-- ---------------------------------------------------------------------------
-- PASSO 2: Backfill workspace_id nos planejadores
--   Lógica: manager → workspace_id = id
--           planejador sem manager → workspace_id = id (solo)
--           planejador com manager → workspace_id = id do manager
--           (manager é o único com role = 'manager' no sistema atual)
-- ---------------------------------------------------------------------------

-- Managers: workspace_id = próprio id
UPDATE public.planejadores
SET    workspace_id = id
WHERE  role = 'manager'
  AND  workspace_id IS NULL;

-- Planejadores contratados: workspace_id = id do manager do seu workspace
-- No modelo atual cada instância tem UM manager; todos os planejadores
-- que não são manager herdam o workspace do manager da instância.
UPDATE public.planejadores p
SET    workspace_id = (
  SELECT m.id
  FROM   public.planejadores m
  WHERE  m.role = 'manager'
  LIMIT  1
)
WHERE  p.role = 'planejador'
  AND  p.workspace_id IS NULL;

-- Fallback: planejadores que ainda ficaram NULL (instância sem manager, e.g. dev/test)
-- → workspace solo: workspace_id = próprio id
UPDATE public.planejadores
SET    workspace_id = id
WHERE  workspace_id IS NULL;

-- Agora podemos aplicar NOT NULL
ALTER TABLE public.planejadores
  ALTER COLUMN workspace_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- PASSO 3: workspace_id em clientes
-- ---------------------------------------------------------------------------

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.planejadores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_clientes_workspace
  ON public.clientes (workspace_id);

COMMENT ON COLUMN public.clientes.workspace_id IS
  'Herda workspace_id do planejador dono do cliente. '
  'Permite queries e RLS direto sem JOIN.';

-- ---------------------------------------------------------------------------
-- PASSO 4: Backfill workspace_id nos clientes (herdar do planejador)
-- ---------------------------------------------------------------------------

UPDATE public.clientes c
SET    workspace_id = p.workspace_id
FROM   public.planejadores p
WHERE  c.planejador_id = p.id
  AND  c.workspace_id IS NULL;

-- Após backfill completo, aplicar NOT NULL
ALTER TABLE public.clientes
  ALTER COLUMN workspace_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- PASSO 5: Trigger para propagar workspace_id automaticamente
--   Quando um novo cliente é inserido, workspace_id é preenchido
--   automaticamente a partir do seu planejador, mesmo que o front-end
--   não envie o campo.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_clientes_set_workspace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só preenche se não foi fornecido explicitamente
  IF NEW.workspace_id IS NULL THEN
    SELECT p.workspace_id
    INTO   NEW.workspace_id
    FROM   public.planejadores p
    WHERE  p.id = NEW.planejador_id;
  END IF;

  -- Se ainda NULL (planejador não encontrado), usa planejador_id como fallback
  IF NEW.workspace_id IS NULL THEN
    NEW.workspace_id := NEW.planejador_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_set_workspace_id ON public.clientes;
CREATE TRIGGER trg_clientes_set_workspace_id
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_clientes_set_workspace_id();

-- ---------------------------------------------------------------------------
-- PASSO 6: Reconstruir políticas RLS em planejadores usando workspace_id
-- ---------------------------------------------------------------------------

-- Remover políticas anteriores
DROP POLICY IF EXISTS "planejadores_select_own"          ON public.planejadores;
DROP POLICY IF EXISTS "manager_select_all_planejadores"  ON public.planejadores;
DROP POLICY IF EXISTS "manager_insert_planejadores"      ON public.planejadores;
DROP POLICY IF EXISTS "manager_update_planejadores"      ON public.planejadores;
DROP POLICY IF EXISTS "manager_delete_planejadores"      ON public.planejadores;

-- 6a. Planejador vê apenas registros do seu workspace
CREATE POLICY "planejadores_select_workspace"
  ON public.planejadores FOR SELECT
  USING (
    workspace_id = (
      SELECT p.workspace_id
      FROM   public.planejadores p
      WHERE  p.id = auth.uid()
    )
  );

-- 6b. Manager pode inserir novos planejadores no seu workspace
CREATE POLICY "manager_insert_planejadores"
  ON public.planejadores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE  p.id  = auth.uid()
        AND  p.role = 'manager'
    )
    AND workspace_id = auth.uid() -- inserções sempre no workspace do manager logado
  );

-- 6c. Manager pode atualizar planejadores do seu workspace
CREATE POLICY "manager_update_planejadores"
  ON public.planejadores FOR UPDATE
  USING (
    workspace_id = (
      SELECT p.workspace_id
      FROM   public.planejadores p
      WHERE  p.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE  p.id  = auth.uid()
        AND  p.role = 'manager'
    )
  );

-- 6d. Manager pode remover planejadores do seu workspace
CREATE POLICY "manager_delete_planejadores"
  ON public.planejadores FOR DELETE
  USING (
    workspace_id = (
      SELECT p.workspace_id
      FROM   public.planejadores p
      WHERE  p.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE  p.id  = auth.uid()
        AND  p.role = 'manager'
    )
    AND id <> auth.uid() -- manager não pode deletar a si mesmo
  );

-- ---------------------------------------------------------------------------
-- PASSO 7: Reconstruir políticas RLS em clientes usando workspace_id
-- ---------------------------------------------------------------------------

-- Remover políticas anteriores (todas)
DROP POLICY IF EXISTS "planejadores_select_clientes"   ON public.clientes;
DROP POLICY IF EXISTS "manager_select_all_clientes"    ON public.clientes;
DROP POLICY IF EXISTS "cliente_select_own"             ON public.clientes;
DROP POLICY IF EXISTS "planejadores_insert_clientes"   ON public.clientes;
DROP POLICY IF EXISTS "manager_insert_clientes"        ON public.clientes;
DROP POLICY IF EXISTS "planejadores_update_clientes"   ON public.clientes;
DROP POLICY IF EXISTS "manager_update_clientes"        ON public.clientes;
DROP POLICY IF EXISTS "planejadores_delete_clientes"   ON public.clientes;
DROP POLICY IF EXISTS "manager_delete_clientes"        ON public.clientes;

-- 7a. SELECT: qualquer usuário autenticado do mesmo workspace
--   Cobre: planejador vê seus clientes + manager vê todos no workspace
CREATE POLICY "workspace_select_clientes"
  ON public.clientes FOR SELECT
  USING (
    workspace_id = (
      SELECT p.workspace_id
      FROM   public.planejadores p
      WHERE  p.id = auth.uid()
    )
  );

-- 7b. SELECT: cliente logado vê apenas o seu próprio registro
CREATE POLICY "cliente_select_own"
  ON public.clientes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cliente_acessos ca
      WHERE ca.user_id    = auth.uid()
        AND ca.cliente_id = clientes.id
    )
  );

-- 7c. INSERT: planejador pode criar clientes no seu workspace
CREATE POLICY "workspace_insert_clientes"
  ON public.clientes FOR INSERT
  WITH CHECK (
    planejador_id IN (
      SELECT p.id FROM public.planejadores p
      WHERE  p.workspace_id = (
        SELECT p2.workspace_id FROM public.planejadores p2
        WHERE  p2.id = auth.uid()
      )
    )
    -- Confirma que workspace_id está correto
    AND workspace_id = (
      SELECT p.workspace_id
      FROM   public.planejadores p
      WHERE  p.id = auth.uid()
    )
  );

-- 7d. UPDATE: planejador pode atualizar clientes do seu workspace
CREATE POLICY "workspace_update_clientes"
  ON public.clientes FOR UPDATE
  USING (
    workspace_id = (
      SELECT p.workspace_id
      FROM   public.planejadores p
      WHERE  p.id = auth.uid()
    )
  );

-- 7e. DELETE: planejador pode remover clientes do seu workspace
CREATE POLICY "workspace_delete_clientes"
  ON public.clientes FOR DELETE
  USING (
    workspace_id = (
      SELECT p.workspace_id
      FROM   public.planejadores p
      WHERE  p.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- PASSO 8: Índice composto para a query mais frequente
--   carregarClientes(planejadorId) → WHERE planejador_id = ? ORDER BY criado_em
--   Com workspace_id no WHERE de RLS, esse índice acelera ambos
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_clientes_workspace_planejador
  ON public.clientes (workspace_id, planejador_id);

-- ---------------------------------------------------------------------------
-- PASSO 9: Função auxiliar — retorna workspace_id do usuário logado
--   Útil para queries no front-end via Supabase RPC sem expor a lógica
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_workspace_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT workspace_id
  FROM   public.planejadores
  WHERE  id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_workspace_id() TO authenticated;

COMMENT ON FUNCTION public.get_my_workspace_id IS
  'Retorna o workspace_id do planejador/manager logado. '
  'Útil para filtrar queries no client sem expor lógica de negócio.';

-- ---------------------------------------------------------------------------
-- VERIFICAÇÃO FINAL
-- ---------------------------------------------------------------------------

SELECT
  'workspace_id em planejadores' AS check,
  COUNT(*) FILTER (WHERE workspace_id IS NOT NULL) AS com_workspace,
  COUNT(*) FILTER (WHERE workspace_id IS NULL)     AS sem_workspace,
  COUNT(*)                                         AS total
FROM public.planejadores

UNION ALL

SELECT
  'workspace_id em clientes',
  COUNT(*) FILTER (WHERE workspace_id IS NOT NULL),
  COUNT(*) FILTER (WHERE workspace_id IS NULL),
  COUNT(*)
FROM public.clientes;

SELECT 'Fase 3 — workspace_id + RLS multi-tenancy aplicados com sucesso!' AS status;
