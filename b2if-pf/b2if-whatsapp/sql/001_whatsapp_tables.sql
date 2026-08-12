-- =============================================================================
-- B2IF WhatsApp Gateway – Tabelas de suporte
-- Execute no Supabase SQL Editor (ou psql)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. whatsapp_sessions
--    Mapeia número de telefone → cliente B2IF
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone        text          NOT NULL UNIQUE,          -- ex: "5511999990000"
  cliente_id      text          NOT NULL,                 -- ID do cliente no B2IF
  assessor_id     uuid,                                   -- ref ao usuário assessor (opcional)
  nome_cliente    text,
  ativo           boolean       DEFAULT true,
  created_at      timestamptz   DEFAULT now(),
  updated_at      timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_sessions_telefone ON public.whatsapp_sessions(telefone);
CREATE INDEX IF NOT EXISTS idx_wa_sessions_cliente  ON public.whatsapp_sessions(cliente_id);

-- ---------------------------------------------------------------------------
-- 2. transacoes_raw
--    Fila de entrada antes do processamento / deduplicação
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transacoes_raw (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone        text          NOT NULL,
  cliente_id      text,                                   -- preenchido após lookup
  fonte           text          NOT NULL,                 -- 'whatsapp_text' | 'whatsapp_image' | 'whatsapp_audio' | 'whatsapp_pdf'
  payload         jsonb         NOT NULL,                 -- mensagem bruta (texto, url de mídia, etc.)
  ia_resposta     jsonb,                                  -- output do GPT/Whisper
  fingerprint     text,                                   -- hash para deduplicação
  status          text          DEFAULT 'pendente',       -- 'pendente' | 'processado' | 'duplicado' | 'erro'
  erro            text,
  transacao_id    uuid,                                   -- referência à transacoes após inserção
  created_at      timestamptz   DEFAULT now(),
  processed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_raw_telefone    ON public.transacoes_raw(telefone);
CREATE INDEX IF NOT EXISTS idx_raw_cliente     ON public.transacoes_raw(cliente_id);
CREATE INDEX IF NOT EXISTS idx_raw_fingerprint ON public.transacoes_raw(fingerprint);
CREATE INDEX IF NOT EXISTS idx_raw_status      ON public.transacoes_raw(status);

-- ---------------------------------------------------------------------------
-- 3. transacoes
--    Tabela principal – espelha a estrutura usada pelo B2IF Desktop
--    (se já existir no seu Supabase, adapte as colunas conforme necessário)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transacoes (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id      text          NOT NULL,
  data            date,                                   -- data da compra / transação
  competencia     text,                                   -- "MM/YYYY" (período de competência)
  valor           numeric(12,2) NOT NULL,                 -- positivo=receita, negativo=despesa
  descricao       text,
  categoria       text,                                   -- ID da categoria B2IF
  conta           text,                                   -- nome da conta
  formato         text,                                   -- 'débito' | 'crédito' | 'pix' | etc.
  parcelas        integer       DEFAULT 1,
  fonte           text          DEFAULT 'whatsapp',       -- origem do dado
  fingerprint     text,
  confirmado      boolean       DEFAULT false,
  raw_id          uuid          REFERENCES public.transacoes_raw(id),
  created_at      timestamptz   DEFAULT now(),
  updated_at      timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transacoes_cliente     ON public.transacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_data        ON public.transacoes(data);
CREATE INDEX IF NOT EXISTS idx_transacoes_competencia ON public.transacoes(competencia);
CREATE INDEX IF NOT EXISTS idx_transacoes_fingerprint ON public.transacoes(fingerprint);

-- ---------------------------------------------------------------------------
-- 4. Trigger: updated_at automático
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transacoes_updated ON public.transacoes;
CREATE TRIGGER trg_transacoes_updated
  BEFORE UPDATE ON public.transacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_wa_sessions_updated ON public.whatsapp_sessions;
CREATE TRIGGER trg_wa_sessions_updated
  BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security (RLS)
--    Ajuste conforme a sua estratégia de auth no Supabase
-- ---------------------------------------------------------------------------
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_raw    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes        ENABLE ROW LEVEL SECURITY;

-- Policy: service_role tem acesso total (backend usa service key)
CREATE POLICY "service_role_all" ON public.whatsapp_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.transacoes_raw
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all" ON public.transacoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- FIM DO SCRIPT
-- =============================================================================
