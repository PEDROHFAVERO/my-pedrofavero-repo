-- =============================================================================
-- Migration: RLS UPDATE para clientes com modo_acesso = 'editor'
-- Data: 2026-08-10
-- Autor: genspark_ai_developer
--
-- PROBLEMA IDENTIFICADO:
--   Clientes com modo_acesso = 'editor' conseguiam editar o sistema visualmente
--   (modoLeitura=false), mas NADA era salvo no banco. O motivo: a tabela
--   `clientes` não tinha nenhuma política de UPDATE para o role cliente.
--
--   Fluxo com bug:
--     1. Carol (cliente editor) edita algo no Dashboard ou Categorizador
--     2. AppContext chama agendarSalvarCliente() → guarda modoLeitura passa (false)
--     3. salvarCliente(planejadorId=Carol.userId, cliente) é chamado
--     4. upsert tenta UPDATE em clientes WHERE id = clienteId
--     5. RLS: nenhuma política de UPDATE contempla o usuário cliente
--        - planejador_gerencia_clientes (ALL): exige planejador_id = auth.uid() — falha
--        - manager_update_clientes: exige role='manager' — falha
--     6. Supabase retorna 0 rows affected, SEM erro — save silenciosamente ignorado
--     7. criarVersao() também não é chamada (não há dado para versionar)
--     8. O sistema aparenta ter salvo (isDirty=false) mas o banco não foi atualizado
--
--   Resultado: tudo que a Carol faz some ao recarregar a página.
--   A versão nunca é criada. O toggle Editor/Visualização no ModalAcessos
--   mostra 'editor' corretamente no banco, mas não tem efeito no save.
--
-- CORREÇÃO:
--   Adiciona política de UPDATE que permite ao cliente editor atualizar
--   o registro do seu próprio cliente, verificando via cliente_acessos:
--     - user_id = auth.uid()          (é o usuário logado)
--     - cliente_id = clientes.id      (é o cliente correto)
--     - modo_acesso = 'editor'        (tem permissão de escrita)
--
-- SEGURANÇA:
--   - Cliente só pode atualizar o registro ao qual está vinculado
--   - Apenas clientes com modo_acesso='editor' podem escrever
--   - Clientes com modo_acesso='visualizacao' continuam somente leitura
--   - Não permite UPDATE em registros de outros clientes
--   - Não concede DELETE, INSERT ou SELECT além do que já existia
-- =============================================================================

CREATE POLICY "cliente_editor_atualiza_proprio"
  ON public.clientes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cliente_acessos ca
      WHERE ca.user_id    = auth.uid()
        AND ca.cliente_id = clientes.id
        AND ca.modo_acesso = 'editor'
    )
  );

-- Índice para acelerar a verificação da política (user_id + modo_acesso)
-- já existe idx implícito em user_id, mas modo_acesso junto ajuda no filtro
CREATE INDEX IF NOT EXISTS idx_cliente_acessos_user_modo
  ON public.cliente_acessos (user_id, modo_acesso);

-- =============================================================================
-- VERIFICAÇÃO (execute no SQL Editor do Supabase para confirmar):
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'clientes'
-- ORDER BY cmd, policyname;
--
-- Deve aparecer "cliente_editor_atualiza_proprio" com cmd=UPDATE
-- =============================================================================
