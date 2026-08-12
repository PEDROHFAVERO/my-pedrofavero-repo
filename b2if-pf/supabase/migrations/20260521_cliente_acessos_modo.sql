-- Migration: adiciona campo modo_acesso à tabela cliente_acessos
-- Valores: 'visualizacao' (padrão, comportamento atual) | 'editor'
ALTER TABLE public.cliente_acessos
  ADD COLUMN IF NOT EXISTS modo_acesso TEXT NOT NULL DEFAULT 'visualizacao'
  CHECK (modo_acesso IN ('visualizacao', 'editor'));

-- Índice opcional para queries por modo
CREATE INDEX IF NOT EXISTS idx_cliente_acessos_modo ON public.cliente_acessos(modo_acesso);
