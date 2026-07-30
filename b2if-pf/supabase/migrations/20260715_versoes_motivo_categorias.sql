-- =============================================================================
-- Migration: Adiciona motivo 'categorias' ao enum versao_motivo_enum
-- Data: 2026-07-15
-- Contexto: criarVersaoCategorias() usa motivo='categorias' (versão imediata
--           após CRUD de categorias). O enum original não incluía este valor.
--           Sem esta migration, o RPC lança erro de cast silencioso e a versão
--           nunca é gravada no banco.
-- IDEMPOTENTE: ALTER TYPE ... ADD VALUE IF NOT EXISTS (disponível no PG 12+)
-- =============================================================================

-- Adiciona 'categorias' ao enum de motivos (idempotente no PG 12+)
ALTER TYPE public.versao_motivo_enum ADD VALUE IF NOT EXISTS 'categorias';

-- Commit é necessário para o enum ficar disponível imediatamente
-- (DDL em PG é transacional — o COMMIT implícito acontece ao final do script)
