-- Tabela temporária para jobs de processamento de PDF (polling pattern)
-- Cada registro dura max 10 minutos e é limpo automaticamente.

CREATE TABLE IF NOT EXISTS pdf_jobs (
  id          TEXT PRIMARY KEY,                    -- UUID gerado pelo client
  status      TEXT NOT NULL DEFAULT 'pending',     -- pending | processing | done | error
  progress    TEXT,                                -- mensagem de progresso atual
  result      JSONB,                               -- resultado final (transações)
  erro        TEXT,                                -- mensagem de erro se status=error
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para limpeza por tempo
CREATE INDEX IF NOT EXISTS pdf_jobs_created_at_idx ON pdf_jobs (created_at);

-- RLS desativado (acesso apenas via service_role pela Edge Function)
ALTER TABLE pdf_jobs DISABLE ROW LEVEL SECURITY;

-- Limpeza automática de jobs antigos (> 15 minutos)
CREATE OR REPLACE FUNCTION cleanup_pdf_jobs() RETURNS void LANGUAGE sql AS $$
  DELETE FROM pdf_jobs WHERE created_at < now() - INTERVAL '15 minutes';
$$;
