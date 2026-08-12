-- Fila de processamento assíncrono para mensagens WhatsApp
CREATE TABLE IF NOT EXISTS public.bot_queue (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        REFERENCES bot_sessions(id) ON DELETE SET NULL,
  cliente_id  text        NOT NULL,
  telefone    text        NOT NULL,
  tipo        text        NOT NULL,  -- 'text' | 'audio' | 'image'
  payload     jsonb       NOT NULL DEFAULT '{}',
  status      text        NOT NULL DEFAULT 'pending',  -- 'pending' | 'processing' | 'done' | 'error'
  tentativas  int         NOT NULL DEFAULT 0,
  erro        text,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz
);

-- Index para buscar pendentes
CREATE INDEX IF NOT EXISTS bot_queue_status_idx ON bot_queue(status, criado_em);

-- RLS desabilitado para acesso interno
ALTER TABLE bot_queue DISABLE ROW LEVEL SECURITY;
