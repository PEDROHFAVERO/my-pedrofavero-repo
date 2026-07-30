-- ============================================================
--  B2IF-PF — Script de Migração para Produção
--  Gerado em: 2026-03-31 17:33:03
--  Planejadores: 0
--  Clientes: 0 (0 com dados financeiros)
--  Acessos: 0 (não migrados — recriar manualmente)
-- ============================================================
-- INSTRUÇÕES:
--   1. Crie os usuários Auth dos planejadores manualmente no novo
--      projeto: Authentication → Users → Invite user (use os emails
--      listados abaixo). Anote os UUIDs gerados.
--   2. Atualize os UUIDs no bloco INSERT de planejadores se forem
--      diferentes dos originais (recomendado usar o mesmo email
--      para que o planejador reset a senha e entre normalmente).
--   3. Execute este script COMPLETO no SQL Editor do novo projeto.
--   4. Configure a Edge Function admin-cliente com os Secrets
--      ENC_KEY e SUPABASE_SERVICE_ROLE_KEY.
--   5. Recriar acessos de clientes via modal 👤 Acessos no app.
-- ============================================================

BEGIN;


-- ============================================================
--  SCHEMA B2IF-PF — gerado automaticamente pelo script de
--  migração. Execute ANTES dos INSERTs.
-- ============================================================

-- ── Tabela: planejadores ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS planejadores (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'planejador' CHECK (role IN ('manager','planejador')),
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE planejadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planejador_le_proprio" ON planejadores
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "manager_gerencia_planejadores" ON planejadores
  FOR ALL USING (
    EXISTS (SELECT 1 FROM planejadores p WHERE p.id = auth.uid() AND p.role = 'manager')
  );

-- ── Tabela: clientes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id            TEXT PRIMARY KEY,
  planejador_id UUID NOT NULL REFERENCES planejadores(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  dados         JSONB,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_planejador_id ON clientes(planejador_id);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planejador_gerencia_clientes" ON clientes
  FOR ALL USING (
    planejador_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM planejadores p WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

CREATE POLICY "cliente_le_proprio" ON clientes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cliente_acessos ca
      WHERE ca.cliente_id = clientes.id AND ca.user_id = auth.uid()
    )
  );

-- ── Tabela: cliente_acessos ──────────────────────────────────
CREATE TABLE IF NOT EXISTS cliente_acessos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  senha_enc  TEXT,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_cliente_acessos_cliente_id ON cliente_acessos(cliente_id);

ALTER TABLE cliente_acessos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planejador_gerencia_acessos" ON cliente_acessos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clientes c
      JOIN planejadores p ON p.id = c.planejador_id
      WHERE c.id = cliente_acessos.cliente_id AND p.id = auth.uid()
    )
  );

CREATE POLICY "manager_gerencia_acessos" ON cliente_acessos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM planejadores WHERE id = auth.uid() AND role = 'manager')
  );

CREATE POLICY "cliente_ve_proprio_acesso" ON cliente_acessos
  FOR SELECT USING (user_id = auth.uid());

-- ── Funções auxiliares ───────────────────────────────────────
-- Nota: as funções criar_acesso_cliente, resetar_senha_cliente e
-- excluir_acesso_cliente foram substituídas pela Edge Function
-- admin-cliente e não são mais necessárias. Mantidas abaixo como
-- referência legada (comentadas).

/*
CREATE OR REPLACE FUNCTION criar_acesso_cliente(...) ...
CREATE OR REPLACE FUNCTION resetar_senha_cliente(...) ...
CREATE OR REPLACE FUNCTION excluir_acesso_cliente(...) ...
*/

-- Nenhum planejador encontrado.
-- Nenhum cliente encontrado.

-- ── cliente_acessos ─────────────────────────────────────────
-- Os registros de cliente_acessos NÃO são migrados aqui porque
-- os UUIDs de auth.users são diferentes em cada projeto Supabase.
-- Após a migração, os planejadores devem recriar os acessos de
-- cada cliente usando o modal "👤 Acessos" no Hub do Planejador.
-- Os dados financeiros dos clientes estão intactos na tabela clientes.

COMMIT;

-- ============================================================
--  FIM DO SCRIPT
-- ============================================================
