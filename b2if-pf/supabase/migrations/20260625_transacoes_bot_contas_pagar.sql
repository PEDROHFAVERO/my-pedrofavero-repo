-- =============================================================================
-- Migration: transacoesBot + contasAPagar + append_transacao_bot RPC
-- Data: 2026-06-25
--
-- Objetivos:
--   1. RPC append_transacao_bot — grava em dados->'transacoesBot' (separado de transacoes)
--   2. Estrutura contasAPagar já nasce nos dados do cliente via clienteStorage.js
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. RPC append_transacao_bot
--    Espelha append_transacao mas usa a chave 'transacoesBot' dentro do JSONB dados.
--    Garante que lançamentos do WhatsApp NÃO entram em dados.transacoes (extrato oficial).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_transacao_bot(
  p_cliente_id  text,
  p_transacao   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transacao jsonb;
BEGIN
  -- Garante que a transação tem um id
  IF p_transacao->>'id' IS NULL OR p_transacao->>'id' = '' THEN
    v_transacao := p_transacao || jsonb_build_object('id', gen_random_uuid()::text);
  ELSE
    v_transacao := p_transacao;
  END IF;

  -- Insere na array transacoesBot dentro do campo dados (JSONB)
  -- Se transacoesBot não existir, inicializa como array vazio antes de appended
  UPDATE public.clientes
  SET dados = jsonb_set(
    CASE
      WHEN dados ? 'transacoesBot' THEN dados
      ELSE dados || '{"transacoesBot": []}'::jsonb
    END,
    '{transacoesBot}',
    (
      COALESCE(dados->'transacoesBot', '[]'::jsonb) || jsonb_build_array(v_transacao)
    )
  ),
  atualizado_em = now()
  WHERE id = p_cliente_id::uuid;

  RETURN v_transacao;
END;
$$;

-- Garante permissão para a service role (usada pelo Edge Function)
GRANT EXECUTE ON FUNCTION public.append_transacao_bot(text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Comentário explicativo nas estruturas
-- ---------------------------------------------------------------------------
COMMENT ON FUNCTION public.append_transacao_bot IS
  'Appends a bot transaction to dados.transacoesBot (WhatsApp drafts).
   These are behavioral records only — they do NOT appear in Categorizador/Planejador.
   Reconciliation happens via the Conciliação panel for contasAPagar items only.';

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================
