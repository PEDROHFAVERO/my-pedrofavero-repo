-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO: Adicionar coluna modo_acesso à tabela cliente_acessos
--
-- PROBLEMA RESOLVIDO:
--   A coluna modo_acesso foi adicionada ao código (AuthContext, admin-cliente)
--   mas nunca foi criada no banco de dados via migration. Isso causa uma cadeia
--   silenciosa de falhas:
--
--   1. SELECT retorna modo_acesso = null (coluna inexistente retorna null no Supabase)
--   2. AuthContext: modoAcesso = acesso.modo_acesso || 'visualizacao' → 'visualizacao'
--   3. App.jsx: isEditor = (undefined === 'editor') = false
--   4. modoLeituraFixo = !false = true → modoLeitura = true
--   5. AppContext.jsx linha 219: if (modoLeitura) return → SAVE BLOQUEADO
--
--   Resultado: Planejadores que acessam via login de cliente em outra máquina
--   não conseguem salvar nenhuma alteração. O sistema parece funcionar (não mostra
--   erro) mas nada é persistido no banco.
--
-- EXECUTE NO SUPABASE:
--   Dashboard → SQL Editor → New query → cole e execute
--
-- IDEMPOTENTE: pode ser executado múltiplas vezes sem erro
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 1: Adicionar coluna modo_acesso (se ainda não existe)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cliente_acessos
  ADD COLUMN IF NOT EXISTS modo_acesso TEXT NOT NULL DEFAULT 'visualizacao'
  CHECK (modo_acesso IN ('visualizacao', 'editor'));

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 2: Backfill — todos os registros existentes ficam como 'visualizacao'
--   (o DEFAULT já faz isso para novos registros; UPDATE garante os antigos)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.cliente_acessos
  SET modo_acesso = 'visualizacao'
  WHERE modo_acesso IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 3: Verificar resultado
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  id,
  nome,
  modo_acesso,
  criado_em
FROM public.cliente_acessos
ORDER BY criado_em;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO 4 (OPCIONAL): Se você quer que planejadores que têm acesso de cliente
--   possam editar, atualize manualmente os registros necessários:
--
--   UPDATE public.cliente_acessos
--     SET modo_acesso = 'editor'
--     WHERE user_id = 'UUID_DO_USUARIO';
--
-- Ou use o painel do sistema em Gerenciar Acessos → Modo de Acesso → Editor
-- ─────────────────────────────────────────────────────────────────────────────

SELECT 'Migração concluída — coluna modo_acesso adicionada à tabela cliente_acessos' AS status;
