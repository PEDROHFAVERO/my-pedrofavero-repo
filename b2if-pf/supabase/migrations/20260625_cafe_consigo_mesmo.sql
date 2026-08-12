-- Fase 6: Café Consigo Mesmo
-- Adiciona estado do modo café à tabela bot_sessions

ALTER TABLE public.bot_sessions
  ADD COLUMN IF NOT EXISTS cafe_estado  boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS cafe_inicio  timestamptz DEFAULT NULL;

-- Índice para facilitar busca por sessões em modo café ativo
CREATE INDEX IF NOT EXISTS idx_bot_sessions_cafe_ativo
  ON public.bot_sessions (cafe_estado)
  WHERE cafe_estado = true;

COMMENT ON COLUMN public.bot_sessions.cafe_estado IS
  'true = cliente está em modo Café Consigo Mesmo (reflexão financeira livre)';
COMMENT ON COLUMN public.bot_sessions.cafe_inicio IS
  'Timestamp de início do modo café — expira automaticamente após 30min de inatividade';
