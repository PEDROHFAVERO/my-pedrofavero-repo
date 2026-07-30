-- =============================================================================
-- B2IF – Fix Bot Schema v3.1
-- Migration: correções de schema e funções auxiliares
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Garantir coluna atualizado_em em bot_sessions (já existe, só documenta)
-- ---------------------------------------------------------------------------
-- bot_sessions já tem: id, assessor_id, cliente_id, telefone, ativo, criado_em, atualizado_em
-- O código anterior usava 'ultima_atividade' (errado) — corrigido para 'atualizado_em'

-- ---------------------------------------------------------------------------
-- 2. Garantir UNIQUE constraint em bot_queue.msg_id (já existe)
-- ---------------------------------------------------------------------------
-- CREATE UNIQUE INDEX IF NOT EXISTS bot_queue_msg_id_unique 
--   ON public.bot_queue(msg_id) WHERE msg_id IS NOT NULL;
-- (já aplicado manualmente)

-- ---------------------------------------------------------------------------
-- 3. RPC get_resumo_semanal — lê despesas diretamente do JSONB sem carregar tudo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_resumo_semanal(
  p_cliente_id  text,
  p_data_inicio text
)
RETURNS TABLE(descricao text, valor numeric, data text, categoria text)
LANGUAGE sql STABLE
AS $$
  SELECT
    (elem->>'descricao')::text    AS descricao,
    (elem->>'valor')::numeric     AS valor,
    (elem->>'data')::text         AS data,
    (elem->>'categoria')::text    AS categoria
  FROM clientes,
       jsonb_array_elements(dados->'transacoes') AS elem
  WHERE id = p_cliente_id
    AND (elem->>'tipo')::text     = 'despesa'
    AND (elem->>'data')::text    >= p_data_inicio
  ORDER BY (elem->>'data')::text DESC
  LIMIT 50;
$$;

-- Permissão para service_role
GRANT EXECUTE ON FUNCTION public.get_resumo_semanal(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. RPC append_transacao — versão melhorada (retorna jsonb com a transação)
-- ---------------------------------------------------------------------------
-- Já existe e funciona — não precisa alterar

-- ---------------------------------------------------------------------------
-- 5. Trigger para atualizar atualizado_em em bot_sessions automaticamente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_atualizado_em()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_sessions_touch ON public.bot_sessions;
CREATE TRIGGER trg_bot_sessions_touch
  BEFORE UPDATE ON public.bot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_atualizado_em();

-- =============================================================================
-- FIM DA MIGRATION
-- =============================================================================

-- RPCs adicionais para operações atômicas na fila (adicionado em 2026-04-24)

CREATE OR REPLACE FUNCTION public.enfileirar_mensagem(
  p_session_id  uuid,
  p_cliente_id  text,
  p_telefone    text,
  p_tipo        text,
  p_payload     jsonb,
  p_msg_id      text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.bot_queue (session_id, cliente_id, telefone, tipo, payload, msg_id, status)
  VALUES (p_session_id, p_cliente_id, p_telefone, p_tipo, p_payload, p_msg_id, 'pending')
  ON CONFLICT (msg_id) WHERE msg_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  
  RETURN v_id; -- NULL se foi duplicata (ON CONFLICT DO NOTHING)
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_fila(
  p_queue_id     uuid,
  p_status       text,
  p_erro         text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.bot_queue
  SET status = p_status,
      erro = p_erro,
      processado_em = now()
  WHERE id = p_queue_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enfileirar_mensagem TO service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_fila TO service_role;
