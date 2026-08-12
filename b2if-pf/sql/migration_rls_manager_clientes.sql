-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Políticas RLS para Manager operar clientes de qualquer planejador
--
-- PROBLEMA RESOLVIDO:
--   Quando o Manager acessa o hub de um planejador via "Acessar Hub" e faz
--   qualquer alteração (categorias, subcategorias, notas, etc.), o save é
--   BLOQUEADO SILENCIOSAMENTE pela RLS.
--
--   CADEIA DO BUG:
--   1. Manager clica "Acessar Hub" → localStorage.manager_viewing = planejador.id
--   2. AppContext: planejadorId = localStorage['manager_viewing'].id (ID do planejador)
--   3. salvarClienteSupabase: upsert com planejador_id = planejador.id
--   4. RLS UPDATE: USING (planejador_id = auth.uid())
--      auth.uid() = manager.id ≠ planejador.id → REJEITADO
--   5. Erro vai para .catch(console.error) → SILENCIOSO, UI não mostra nada
--   6. Dados ficam apenas em memória React → somem no próximo reload
--
--   ISSO TAMBÉM EXPLICA as notas sumidas: mesmo caminho de save, mesmo bloqueio.
--
-- EXECUTE NO SUPABASE:
--   Dashboard → SQL Editor → New query → cole e execute
--
-- IDEMPOTENTE: pode ser executado múltiplas vezes sem erro.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 1: Manager pode atualizar clientes de qualquer planejador
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "manager_update_clientes" ON public.clientes;
CREATE POLICY "manager_update_clientes"
  ON public.clientes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 2: Manager pode inserir clientes (criar novo cliente para qualquer planejador)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "manager_insert_clientes" ON public.clientes;
CREATE POLICY "manager_insert_clientes"
  ON public.clientes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 3: Manager pode deletar clientes de qualquer planejador
-- ─────────────────────────────────────────────────────────────────────────────
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
-- VERIFICAÇÃO: listar políticas ativas da tabela clientes
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  policyname,
  cmd,
  qual AS using_expr,
  with_check AS check_expr
FROM pg_policies
WHERE tablename = 'clientes'
ORDER BY cmd, policyname;

SELECT 'Migração concluída — Manager agora pode salvar clientes de qualquer planejador' AS status;
