#!/usr/bin/env python3
"""
=============================================================
  B2IF-PF — Script de Migração Supabase
  Exporta dados do projeto de DEV e gera SQL pronto para
  importar no projeto de PRODUÇÃO.
=============================================================

USO:
  1. Preencha SERVICE_ROLE_KEY abaixo (Settings → API → service_role)
  2. Execute:  python3 migrar_supabase.py
  3. O arquivo  migracao_producao.sql  será gerado neste diretório
  4. Cole o conteúdo no SQL Editor do novo projeto Supabase e execute

ATENÇÃO:
  - Os usuários auth.users (acessos de clientes) NÃO são migrados —
    eles precisam ser recriados pelo planejador no novo ambiente.
  - O campo `dados` (JSON financeiro) de cada cliente é migrado integralmente.
=============================================================
"""

import json
import datetime
import requests
import sys

# ── Configuração ─────────────────────────────────────────────────────────────
SUPABASE_URL      = "https://mioppztwrhrbnkkhuubs.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pb3BwenR3cmhyYm5ra2h1dWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQ0NjQsImV4cCI6MjA5MDQ4MDQ2NH0.opPC34brWzXzrTbtcXcn9Xl8ZO5WIBgkm1Fa9D6iaZU"

# ⚠️  OBRIGATÓRIO: insira a service_role key do projeto de DEV
#     (Supabase → Settings → API → service_role)
SERVICE_ROLE_KEY  = "COLE_AQUI_A_SERVICE_ROLE_KEY"

OUTPUT_FILE = "migracao_producao.sql"
# ─────────────────────────────────────────────────────────────────────────────


def headers(key=None):
    k = key or SUPABASE_ANON_KEY
    return {
        "apikey": k,
        "Authorization": f"Bearer {k}",
        "Content-Type": "application/json",
    }


def fetch_table(table, key=None):
    """Busca todos os registros de uma tabela via PostgREST."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select=*&order=criado_em.asc"
    resp = requests.get(url, headers=headers(key))
    if resp.status_code != 200:
        print(f"  ERRO ao buscar {table}: {resp.status_code} — {resp.text[:200]}")
        return []
    return resp.json()


def escape_sql_string(value):
    """Escapa uma string para uso seguro dentro de SQL."""
    if value is None:
        return "NULL"
    s = str(value)
    s = s.replace("'", "''")          # escapa aspas simples
    s = s.replace("\\", "\\\\")       # escapa backslash
    return f"'{s}'"


def json_to_sql(obj):
    """Converte objeto Python para string JSON escapada para SQL."""
    if obj is None:
        return "NULL"
    raw = json.dumps(obj, ensure_ascii=False)
    raw = raw.replace("'", "''")
    return f"'{raw}'"


def bool_sql(v):
    if v is True or v == "true":
        return "TRUE"
    if v is False or v == "false":
        return "FALSE"
    return "NULL"


def generate_schema():
    """Retorna o DDL completo: tabelas, índices, RLS e funções."""
    return """
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
"""


def generate_planejadores_inserts(rows):
    if not rows:
        return "-- Nenhum planejador encontrado.\n"
    lines = [
        "-- ── INSERT: planejadores ───────────────────────────────────",
        "-- ⚠️  Os UUIDs dos planejadores referenciam auth.users.",
        "-- Você precisará criar os usuários Auth manualmente (Dashboard → Authentication → Users)",
        "-- com os mesmos emails ANTES de executar estes INSERTs.",
        "",
    ]
    for r in rows:
        lines.append(
            f"INSERT INTO planejadores (id, nome, email, role, ativo, criado_em) VALUES ("
            f"{escape_sql_string(r.get('id'))}, "
            f"{escape_sql_string(r.get('nome'))}, "
            f"{escape_sql_string(r.get('email'))}, "
            f"{escape_sql_string(r.get('role', 'planejador'))}, "
            f"{bool_sql(r.get('ativo', True))}, "
            f"{escape_sql_string(r.get('criado_em'))}"
            f") ON CONFLICT (id) DO NOTHING;"
        )
    return "\n".join(lines) + "\n"


def generate_clientes_inserts(rows):
    if not rows:
        return "-- Nenhum cliente encontrado.\n"
    lines = [
        "",
        "-- ── INSERT: clientes (inclui dados JSON financeiros) ───────",
        "",
    ]
    for r in rows:
        dados_sql = json_to_sql(r.get('dados'))
        lines.append(
            f"INSERT INTO clientes (id, planejador_id, nome, dados, criado_em, atualizado_em) VALUES ("
            f"{escape_sql_string(r.get('id'))}, "
            f"{escape_sql_string(r.get('planejador_id'))}, "
            f"{escape_sql_string(r.get('nome'))}, "
            f"{dados_sql}::jsonb, "
            f"{escape_sql_string(r.get('criado_em'))}, "
            f"{escape_sql_string(r.get('atualizado_em'))}"
            f") ON CONFLICT (id) DO UPDATE SET "
            f"nome = EXCLUDED.nome, "
            f"dados = EXCLUDED.dados, "
            f"atualizado_em = EXCLUDED.atualizado_em;"
        )
    return "\n".join(lines) + "\n"


def generate_acessos_comment():
    return """
-- ── cliente_acessos ─────────────────────────────────────────
-- Os registros de cliente_acessos NÃO são migrados aqui porque
-- os UUIDs de auth.users são diferentes em cada projeto Supabase.
-- Após a migração, os planejadores devem recriar os acessos de
-- cada cliente usando o modal "👤 Acessos" no Hub do Planejador.
-- Os dados financeiros dos clientes estão intactos na tabela clientes.
"""


def main():
    print("=" * 60)
    print("  B2IF-PF — Script de Migração Supabase")
    print("=" * 60)

    if SERVICE_ROLE_KEY == "COLE_AQUI_A_SERVICE_ROLE_KEY":
        print("\n⚠️  ERRO: Você precisa preencher SERVICE_ROLE_KEY no script.")
        print("   Abra migrar_supabase.py e insira a chave na linha indicada.")
        print("\n   Onde encontrar: Supabase → Settings → API → service_role key\n")
        # Continua para gerar ao menos o schema
        key = SUPABASE_ANON_KEY
        print("   Usando anon key (dados podem estar incompletos por RLS).\n")
    else:
        key = SERVICE_ROLE_KEY

    print("\n[1/4] Buscando planejadores...")
    planejadores = fetch_table("planejadores", key)
    print(f"      → {len(planejadores)} planejador(es) encontrado(s)")

    print("[2/4] Buscando clientes...")
    clientes = fetch_table("clientes", key)
    print(f"      → {len(clientes)} cliente(s) encontrado(s)")
    total_dados = sum(1 for c in clientes if c.get('dados'))
    print(f"      → {total_dados} cliente(s) com dados financeiros")

    print("[3/4] Verificando acessos...")
    acessos = fetch_table("cliente_acessos", key)
    print(f"      → {len(acessos)} acesso(s) cadastrado(s) (não serão migrados — ver nota no SQL)")

    print("[4/4] Gerando arquivo SQL...")

    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"""-- ============================================================
--  B2IF-PF — Script de Migração para Produção
--  Gerado em: {now}
--  Planejadores: {len(planejadores)}
--  Clientes: {len(clientes)} ({total_dados} com dados financeiros)
--  Acessos: {len(acessos)} (não migrados — recriar manualmente)
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

"""

    schema = generate_schema()
    pl_inserts = generate_planejadores_inserts(planejadores)
    cl_inserts = generate_clientes_inserts(clientes)
    acessos_note = generate_acessos_comment()

    footer = """
COMMIT;

-- ============================================================
--  FIM DO SCRIPT
-- ============================================================
"""

    sql_content = header + schema + "\n" + pl_inserts + cl_inserts + acessos_note + footer

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(sql_content)

    size_kb = len(sql_content.encode("utf-8")) / 1024
    print(f"\n✅ Arquivo gerado: {OUTPUT_FILE}  ({size_kb:.1f} KB)")
    print(f"\n{'=' * 60}")
    print("  PRÓXIMOS PASSOS:")
    print("  1. Abra o arquivo gerado e revise os UUIDs dos planejadores")
    print("  2. No novo projeto Supabase:")
    print("     a) Crie os usuários Auth dos planejadores manualmente")
    print("        (Authentication → Users → Invite user)")
    print("     b) Cole e execute o SQL no SQL Editor")
    print("  3. Configure a Edge Function admin-cliente no novo projeto")
    print("     (copie o código de supabase/functions/admin-cliente/index.ts)")
    print("     e adicione os Secrets: ENC_KEY e SUPABASE_SERVICE_ROLE_KEY")
    print("  4. Atualize src/lib/supabase.js com URL e anon key do novo projeto")
    print("  5. Os planejadores recriam os acessos de clientes via modal 👤 Acessos")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
