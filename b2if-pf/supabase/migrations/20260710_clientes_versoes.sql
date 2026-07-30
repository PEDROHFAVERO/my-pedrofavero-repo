-- =============================================================================
-- Migration: Sistema de Histórico de Versões (Version Control)
-- Data: 2026-07-10
-- Autor: genspark_ai_developer
--
-- OBJETIVO:
--   Criar uma rede de segurança completa para os dados dos clientes,
--   equivalente ao histórico de versões do Google Docs.
--
-- MODELO:
--   • Cada save relevante gera um snapshot imutável em clientes_versoes
--   • Snapshots automáticos expiram em 90 dias (pg_cron)
--   • Checkpoints manuais nunca expiram (ttl_dias = NULL)
--   • Hash SHA-256 evita versões duplicadas (conteúdo idêntico não grava)
--   • Máximo 50 versões automáticas por cliente (LRU — mais antigas caem)
--   • Antes de qualquer restauração, versão atual é salva como pre_restauracao
--
-- AUTORES RASTREADOS:
--   'planejador' | 'cliente' | 'manager' | 'sistema' | 'bot'
--
-- MOTIVOS:
--   'manual'          → usuário clicou Salvar
--   'importacao_pdf'  → PDF importado com sucesso
--   'fechamento'      → beforeunload / sendBeacon
--   'auto'            → intervalo automático (10min)
--   'checkpoint'      → ponto de restauração manual com nome
--   'pre_restauracao' → snapshot antes de restaurar versão anterior
--   'restauracao'     → a versão restaurada em si (marker informativo)
--
-- IDEMPOTENTE: usa IF NOT EXISTS em todos os passos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PASSO 1: Enum de autor
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE autor_tipo_enum AS ENUM ('planejador','cliente','manager','sistema','bot');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE versao_motivo_enum AS ENUM (
    'manual','importacao_pdf','fechamento','auto',
    'checkpoint','pre_restauracao','restauracao'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- PASSO 2: Tabela principal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes_versoes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     TEXT        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  planejador_id  UUID        NOT NULL REFERENCES public.planejadores(id) ON DELETE CASCADE,
  workspace_id   UUID        REFERENCES public.planejadores(id) ON DELETE SET NULL,

  -- Snapshot completo dos dados do cliente naquele momento
  dados          JSONB       NOT NULL,

  -- Hash SHA-256 do dados (sem espaços) — evita duplicatas
  hash           TEXT        NOT NULL,

  -- Quem salvou
  autor_tipo     autor_tipo_enum NOT NULL DEFAULT 'planejador',
  autor_id       UUID,           -- user.id de quem estava logado (nullable para sistema/bot)
  autor_nome     TEXT        NOT NULL DEFAULT 'Sistema',

  -- Contexto do save
  motivo         versao_motivo_enum NOT NULL DEFAULT 'auto',
  titulo         TEXT,           -- nome do checkpoint (só para motivo='checkpoint')

  -- Resumo calculado no momento — para exibir sem deserializar JSONB
  resumo         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- formato: { tx_total, tx_categorizadas, tx_pendentes, tx_outros }

  -- Timestamps
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Política de retenção:
  -- NULL  → nunca expira (checkpoints manuais)
  -- N     → expira em N dias a partir de criado_em
  ttl_dias       INT         DEFAULT 90
);

COMMENT ON TABLE public.clientes_versoes IS
  'Histórico imutável de versões dos dados de cada cliente. '
  'Cada linha é um snapshot point-in-time. '
  'Versões com ttl_dias NULL nunca expiram. '
  'A tabela só cresce — updates e deletes são proibidos exceto pela limpeza automática.';

-- ---------------------------------------------------------------------------
-- PASSO 3: Índices
-- ---------------------------------------------------------------------------

-- Busca principal: versões de um cliente, ordenadas por data (timeline)
CREATE INDEX IF NOT EXISTS idx_versoes_cliente_criado
  ON public.clientes_versoes (cliente_id, criado_em DESC);

-- Para verificar duplicata por hash antes de inserir
CREATE UNIQUE INDEX IF NOT EXISTS idx_versoes_hash_unique
  ON public.clientes_versoes (cliente_id, hash);

-- Para limitar 50 versões automáticas por cliente (pg_cron)
CREATE INDEX IF NOT EXISTS idx_versoes_auto
  ON public.clientes_versoes (cliente_id, criado_em DESC)
  WHERE ttl_dias IS NOT NULL;

-- Para RLS workspace
CREATE INDEX IF NOT EXISTS idx_versoes_workspace
  ON public.clientes_versoes (workspace_id);

-- Para limpeza de TTL
CREATE INDEX IF NOT EXISTS idx_versoes_expiracao
  ON public.clientes_versoes (criado_em)
  WHERE ttl_dias IS NOT NULL;

-- ---------------------------------------------------------------------------
-- PASSO 4: RLS — segurança por workspace (mesma lógica da tabela clientes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.clientes_versoes ENABLE ROW LEVEL SECURITY;

-- Planejador: vê versões dos clientes do seu workspace
DROP POLICY IF EXISTS versoes_select_planejador ON public.clientes_versoes;
CREATE POLICY versoes_select_planejador
  ON public.clientes_versoes
  FOR SELECT
  USING (
    workspace_id = (
      SELECT workspace_id FROM public.planejadores WHERE id = auth.uid()
    )
  );

-- Planejador: insere versões dos seus clientes
DROP POLICY IF EXISTS versoes_insert_planejador ON public.clientes_versoes;
CREATE POLICY versoes_insert_planejador
  ON public.clientes_versoes
  FOR INSERT
  WITH CHECK (
    workspace_id = (
      SELECT workspace_id FROM public.planejadores WHERE id = auth.uid()
    )
  );

-- Ninguém pode fazer UPDATE ou DELETE diretamente (imutabilidade)
-- A limpeza é feita apenas pelo service_role (pg_cron)

-- ---------------------------------------------------------------------------
-- PASSO 5: Função de limpeza automática
--   Executada pelo pg_cron a cada hora:
--   1. Remove versões automáticas expiradas (criado_em + ttl_dias dias < NOW)
--   2. Para cada cliente, mantém no máximo 50 versões automáticas (LRU)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limpar_versoes_antigas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Remove versões expiradas por TTL
  DELETE FROM public.clientes_versoes
  WHERE ttl_dias IS NOT NULL
    AND criado_em + (ttl_dias || ' days')::interval < NOW();

  -- 2. Para cada cliente, mantém apenas as 50 versões automáticas mais recentes
  --    (checkpoints = ttl_dias NULL nunca são tocados)
  DELETE FROM public.clientes_versoes
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY cliente_id
               ORDER BY criado_em DESC
             ) AS rn
      FROM public.clientes_versoes
      WHERE ttl_dias IS NOT NULL
    ) ranked
    WHERE rn > 50
  );
END;
$$;

COMMENT ON FUNCTION public.limpar_versoes_antigas IS
  'Executada pelo pg_cron a cada hora. '
  'Remove versões automáticas expiradas por TTL e mantém máximo 50 por cliente.';

-- ---------------------------------------------------------------------------
-- PASSO 6: Agendar pg_cron (se disponível na instância)
--   No Supabase Free, pg_cron pode não estar disponível via migration.
--   Alternativa: chamar via Edge Function agendada ou manualmente.
--   Tentamos agendar mas não falhamos se não conseguir.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'limpar-versoes-clientes',
      '0 * * * *',  -- todo início de hora
      'SELECT public.limpar_versoes_antigas()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pg_cron não disponível nesta instância — limpeza será manual/via Edge Function
  RAISE NOTICE 'pg_cron não disponível. Limpeza de versões será manual.';
END $$;

-- ---------------------------------------------------------------------------
-- PASSO 7: RPC para inserir versão (service_role no frontend não é necessário)
--   O frontend usa a service_key apenas para this RPC quando o planejador
--   faz saves normais. Para o sendBeacon (fechamento de aba), a Edge Function
--   save-beacon usará o service_role diretamente.
-- ---------------------------------------------------------------------------

-- RPC para criar versão — aceita dados do front-end via PostgREST
-- Verifica hash antes de inserir (evita duplicatas)
CREATE OR REPLACE FUNCTION public.criar_versao_cliente(
  p_cliente_id     TEXT,
  p_planejador_id  UUID,
  p_workspace_id   UUID,
  p_dados          JSONB,
  p_hash           TEXT,
  p_autor_tipo     TEXT,
  p_autor_id       UUID,
  p_autor_nome     TEXT,
  p_motivo         TEXT,
  p_titulo         TEXT    DEFAULT NULL,
  p_resumo         JSONB   DEFAULT '{}'::jsonb,
  p_ttl_dias       INT     DEFAULT 90
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Verifica se já existe versão com esse hash para esse cliente
  SELECT id INTO v_id
  FROM public.clientes_versoes
  WHERE cliente_id = p_cliente_id AND hash = p_hash;

  IF v_id IS NOT NULL THEN
    -- Versão idêntica já existe — não duplica, retorna ID existente
    RETURN v_id;
  END IF;

  -- Insere nova versão
  INSERT INTO public.clientes_versoes (
    cliente_id, planejador_id, workspace_id,
    dados, hash,
    autor_tipo, autor_id, autor_nome,
    motivo, titulo, resumo, ttl_dias
  ) VALUES (
    p_cliente_id, p_planejador_id, p_workspace_id,
    p_dados, p_hash,
    p_autor_tipo::autor_tipo_enum, p_autor_id, p_autor_nome,
    p_motivo::versao_motivo_enum, p_titulo, p_resumo, p_ttl_dias
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.criar_versao_cliente IS
  'Cria snapshot imutável do cliente. '
  'Verifica hash antes de inserir — versões idênticas são descartadas silenciosamente. '
  'Retorna UUID da versão criada (ou existente se hash duplicado).';

-- Garante que a função pode ser chamada pelo anon/authenticated via RPC
GRANT EXECUTE ON FUNCTION public.criar_versao_cliente TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_versao_cliente TO anon;
GRANT EXECUTE ON FUNCTION public.limpar_versoes_antigas TO service_role;
