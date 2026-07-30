-- ============================================================
-- B2IF — Bot WhatsApp: tabelas de suporte
-- Executar no Supabase SQL Editor (uma vez)
-- ============================================================

-- ── 1. bot_sessions ─────────────────────────────────────────
-- Vincula número de WhatsApp ao cliente (assessor → cliente)
CREATE TABLE IF NOT EXISTS public.bot_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id    uuid NOT NULL,          -- ID do cliente no sistema B2IF
  telefone      text NOT NULL,          -- número com DDI+DDD, só dígitos (ex: 5511999990000)
  ativo         boolean DEFAULT true,
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now(),
  UNIQUE(assessor_id, cliente_id),
  UNIQUE(telefone)                      -- 1 número ↔ 1 cliente
);

-- ── 2. bot_config ────────────────────────────────────────────
-- Configurações globais do bot por assessor
CREATE TABLE IF NOT EXISTS public.bot_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nome_bot      text DEFAULT 'B2IF Bot',
  saudacao      text DEFAULT 'Olá! Sou o assistente financeiro do seu planejador. Envie seus gastos por aqui! 😊',
  tom           text DEFAULT 'amigavel',   -- amigavel | formal | neutro
  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

-- ── 3. bot_lembretes ─────────────────────────────────────────
-- Lembretes automáticos configurados pelo assessor para cada cliente
CREATE TABLE IF NOT EXISTS public.bot_lembretes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.bot_sessions(id) ON DELETE CASCADE,
  assessor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto         text NOT NULL,
  dia_mes       smallint NOT NULL CHECK (dia_mes BETWEEN 1 AND 28),
  horario       time NOT NULL DEFAULT '09:00',
  ativo         boolean DEFAULT true,
  fixo          boolean DEFAULT false,   -- lembretes padrão não podem ser removidos
  criado_em     timestamptz DEFAULT now()
);

-- ── 4. bot_messages ──────────────────────────────────────────
-- Log de todas as mensagens trocadas (cliente ↔ bot ↔ planejador)
CREATE TABLE IF NOT EXISTS public.bot_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.bot_sessions(id) ON DELETE CASCADE,
  de            text NOT NULL CHECK (de IN ('cliente','bot','planejador')),
  tipo          text DEFAULT 'texto',    -- texto | imagem | audio | pdf | resumo
  conteudo      text NOT NULL,
  meta          jsonb,                   -- dados extras (categoria detectada, valor, fingerprint…)
  lida          boolean DEFAULT false,
  criado_em     timestamptz DEFAULT now()
);

-- ── 5. bot_alertas ───────────────────────────────────────────
-- Quais categorias têm alerta de limite ativado por cliente
CREATE TABLE IF NOT EXISTS public.bot_alertas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.bot_sessions(id) ON DELETE CASCADE,
  categoria_id  text NOT NULL,           -- ID da categoria (ex: 'supermercado')
  ativo         boolean DEFAULT true,
  criado_em     timestamptz DEFAULT now(),
  UNIQUE(session_id, categoria_id)
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bot_sessions_telefone    ON public.bot_sessions(telefone);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_assessor    ON public.bot_sessions(assessor_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_session     ON public.bot_messages(session_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_bot_lembretes_session    ON public.bot_lembretes(session_id);
CREATE INDEX IF NOT EXISTS idx_bot_alertas_session      ON public.bot_alertas(session_id);

-- ── RLS (Row Level Security) ──────────────────────────────────
-- Cada assessor acessa apenas seus próprios dados
ALTER TABLE public.bot_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_lembretes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_alertas   ENABLE ROW LEVEL SECURITY;

-- Políticas bot_sessions
CREATE POLICY "assessor acessa suas sessions"
  ON public.bot_sessions FOR ALL
  USING (assessor_id = auth.uid());

-- Políticas bot_config
CREATE POLICY "assessor acessa sua config"
  ON public.bot_config FOR ALL
  USING (assessor_id = auth.uid());

-- Políticas bot_lembretes
CREATE POLICY "assessor acessa seus lembretes"
  ON public.bot_lembretes FOR ALL
  USING (assessor_id = auth.uid());

-- Políticas bot_messages
CREATE POLICY "assessor acessa suas mensagens"
  ON public.bot_messages FOR ALL
  USING (
    session_id IN (
      SELECT id FROM public.bot_sessions WHERE assessor_id = auth.uid()
    )
  );

-- Políticas bot_alertas
CREATE POLICY "assessor acessa seus alertas"
  ON public.bot_alertas FOR ALL
  USING (
    session_id IN (
      SELECT id FROM public.bot_sessions WHERE assessor_id = auth.uid()
    )
  );

-- ── Função: atualiza updated_at automaticamente ───────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bot_sessions_updated
  BEFORE UPDATE ON public.bot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_bot_config_updated
  BEFORE UPDATE ON public.bot_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Seed: lembretes padrão para novos vínculos ───────────────
-- (executado via trigger ao criar uma bot_session)
CREATE OR REPLACE FUNCTION public.criar_lembretes_padrao()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.bot_lembretes (session_id, assessor_id, texto, dia_mes, horario, ativo, fixo) VALUES
    (NEW.id, NEW.assessor_id, '☕ Lembrete semanal: já registrou seus gastos dessa semana?',          7,  '09:00', true,  true),
    (NEW.id, NEW.assessor_id, '📄 Hora de enviar o extrato do mês! Encaminhe o PDF aqui no WhatsApp.', 28, '10:00', true,  true),
    (NEW.id, NEW.assessor_id, '📅 Lembrete de reunião mensal com seu planejador esta semana!',          25, '08:00', false, true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_criar_lembretes_padrao
  AFTER INSERT ON public.bot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.criar_lembretes_padrao();

-- ============================================================
-- FIM DA MIGRAÇÃO
-- Execute no Supabase: Database → SQL Editor → New query → Cole e rode
-- ============================================================
