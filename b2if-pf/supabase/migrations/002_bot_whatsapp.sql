-- =============================================================================
-- B2IF – Bot WhatsApp
-- Migration 002: tabelas de suporte ao bot
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. bot_config
--    Configurações globais do bot (um registro por instalação)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bot_config (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_bot        text        NOT NULL DEFAULT 'Assistente B2IF',
  tom             text        NOT NULL DEFAULT 'amigavel',   -- 'amigavel' | 'formal'
  boas_vindas     text        NOT NULL DEFAULT 'Olá! Sou o assistente B2IF. Pode me enviar seus gastos por texto, foto, áudio ou PDF do extrato. 😊',
  wa_phone_id     text,       -- Meta: Phone Number ID
  wa_token        text,       -- Meta: permanent access token
  wa_verify_token text,       -- Meta: webhook verify token
  ativo           boolean     DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. bot_sessions
--    Vínculo: número de telefone ↔ cliente B2IF
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bot_sessions (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone        text        NOT NULL UNIQUE,   -- "5511999990000"
  cliente_id      text        NOT NULL,          -- ID do cliente no B2IF
  planejador_id   uuid,                          -- auth.users.id do planejador responsável
  nome_cliente    text,
  ativo           boolean     DEFAULT true,
  ultima_msg_em   timestamptz,
  total_msgs      integer     DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_sessions_telefone   ON public.bot_sessions(telefone);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_cliente    ON public.bot_sessions(cliente_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_planejador ON public.bot_sessions(planejador_id);

-- ---------------------------------------------------------------------------
-- 3. bot_messages
--    Log de todas as mensagens trocadas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bot_messages (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone        text        NOT NULL,
  cliente_id      text,
  direcao         text        NOT NULL,   -- 'entrada' | 'saida'
  tipo            text        NOT NULL,   -- 'texto' | 'imagem' | 'audio' | 'documento' | 'sistema'
  conteudo        text,                  -- texto da mensagem ou descrição do arquivo
  media_url       text,                  -- URL da mídia (imagem/áudio/PDF)
  wa_message_id   text,                  -- ID da mensagem no WhatsApp
  transacao_id    uuid,                  -- se gerou uma transação
  status          text        DEFAULT 'recebida', -- 'recebida' | 'processada' | 'erro' | 'enviada'
  erro            text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_messages_telefone  ON public.bot_messages(telefone);
CREATE INDEX IF NOT EXISTS idx_bot_messages_cliente   ON public.bot_messages(cliente_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_created   ON public.bot_messages(created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. bot_lembretes
--    Lembretes configurados pelo assessor para cada cliente
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bot_lembretes (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id      text        NOT NULL,
  planejador_id   uuid,
  tipo            text        NOT NULL,
  -- 'cafe_consigo'  → lembrete semanal do café
  -- 'extrato'       → enviar extrato do banco
  -- 'reuniao'       → lembrete de reunião
  -- 'personalizado' → texto livre
  titulo          text        NOT NULL,
  mensagem        text        NOT NULL,   -- texto que o bot vai enviar
  ativo           boolean     DEFAULT true,

  -- Recorrência
  recorrencia     text        NOT NULL DEFAULT 'unica',
  -- 'unica' | 'semanal' | 'mensal'

  -- Para recorrência semanal: 0=Dom, 1=Seg, …, 6=Sab
  dia_semana      integer,

  -- Para recorrência mensal: 1-31
  dia_mes         integer,

  -- Horário de envio (HH:MM, fuso de Brasília)
  horario         text        NOT NULL DEFAULT '09:00',

  -- Para lembrete único: data/hora específica
  enviar_em       timestamptz,

  -- Controle de envio
  ultimo_envio    timestamptz,
  total_envios    integer     DEFAULT 0,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_lembretes_cliente    ON public.bot_lembretes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_bot_lembretes_planejador ON public.bot_lembretes(planejador_id);
CREATE INDEX IF NOT EXISTS idx_bot_lembretes_ativo      ON public.bot_lembretes(ativo);

-- ---------------------------------------------------------------------------
-- 5. Trigger updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_bot_config_upd   ON public.bot_config;
CREATE TRIGGER trg_bot_config_upd
  BEFORE UPDATE ON public.bot_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bot_sessions_upd ON public.bot_sessions;
CREATE TRIGGER trg_bot_sessions_upd
  BEFORE UPDATE ON public.bot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bot_lembretes_upd ON public.bot_lembretes;
CREATE TRIGGER trg_bot_lembretes_upd
  BEFORE UPDATE ON public.bot_lembretes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. RLS – service_role tem acesso total (backend usa service key)
-- ---------------------------------------------------------------------------
ALTER TABLE public.bot_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_lembretes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_all" ON public.bot_config    FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY "service_role_all" ON public.bot_sessions  FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY "service_role_all" ON public.bot_messages  FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY "service_role_all" ON public.bot_lembretes FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- FIM
-- =============================================================================
