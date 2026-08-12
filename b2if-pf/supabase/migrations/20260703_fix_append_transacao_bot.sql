-- =============================================================================
-- Migration: fix append_transacao_bot — remove incorrect ::uuid cast
-- Data: 2026-07-03
--
-- Root cause: append_transacao_bot used WHERE id = p_cliente_id::uuid
-- but clientes.id is TEXT (e.g. 'vkmeurz25yimo15xyyv'), not UUID.
-- PostgreSQL raised: "operator does not exist: text = uuid" (code 42883)
-- causing ALL WhatsApp bot transactions to be silently lost since deployment.
--
-- Fix: Remove ::uuid cast → WHERE id = p_cliente_id
-- =============================================================================

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
  -- Se transacoesBot não existir, inicializa como array vazio antes de append
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
  WHERE id = p_cliente_id;  -- FIX: was p_cliente_id::uuid (wrong type cast)

  RETURN v_transacao;
END;
$$;

-- Garante permissão para a service role (usada pelo Edge Function)
GRANT EXECUTE ON FUNCTION public.append_transacao_bot(text, jsonb) TO service_role;

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================
