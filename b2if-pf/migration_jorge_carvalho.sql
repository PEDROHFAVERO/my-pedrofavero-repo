-- ==========================================================================
-- MIGRAÇÃO DOS DADOS PARA O PLANEJADOR "JORGE CARVALHO"
-- ==========================================================================
-- PASSO 1: Execute este bloco primeiro para obter o UUID de Jorge Carvalho
-- Copie o UUID retornado e substitua JORGE_CARVALHO_UUID abaixo
-- ==========================================================================

SELECT id, email FROM auth.users WHERE email = 'jorgecarvalho@100um.com.br';

-- ==========================================================================
-- PASSO 2: Substitua JORGE_CARVALHO_UUID pelo UUID obtido acima
-- e execute o restante do script completo
-- ==========================================================================

DO $$
DECLARE
  planejador_id UUID := 'JORGE_CARVALHO_UUID'; -- ← SUBSTITUA AQUI

  cliente1_id TEXT := '3iraxdfpkt3mmyxn7c4';
  cliente2_id TEXT := 'f4mxn3cl6ammn3q2lc8';

  dados1 JSONB;
  dados2 JSONB;
BEGIN

-- ============================================================
-- CLIENTE 1: Albert Pak
-- ============================================================
dados1 := '{
  "contas": [
    {"id": "c1", "nome": "BB Paulo", "tipo": "corrente", "saldo": 0},
    {"id": "c2", "nome": "Andrea BTG", "tipo": "investimento", "saldo": 0},
    {"id": "c3", "nome": "Paulo BB", "tipo": "corrente", "saldo": 0},
    {"id": "c4", "nome": "Paulo Itaú", "tipo": "corrente", "saldo": 0}
  ],
  "categorias": [
    {"id": "cat_salario", "nome": "salário", "tipo": "receita", "cor": "#4CAF50"},
    {"id": "cat_aluguel", "nome": "aluguel", "tipo": "despesa", "cor": "#F44336"},
    {"id": "cat_contas", "nome": "contas", "tipo": "despesa", "cor": "#FF9800"},
    {"id": "cat_alimentacao", "nome": "alimentação", "tipo": "despesa", "cor": "#E91E63"},
    {"id": "cat_transporte", "nome": "transporte", "tipo": "despesa", "cor": "#9C27B0"},
    {"id": "cat_saude", "nome": "saúde", "tipo": "despesa", "cor": "#2196F3"},
    {"id": "cat_lazer", "nome": "lazer", "tipo": "despesa", "cor": "#00BCD4"},
    {"id": "cat_educacao", "nome": "educação", "tipo": "despesa", "cor": "#3F51B5"},
    {"id": "cat_vestuario", "nome": "vestuário", "tipo": "despesa", "cor": "#795548"},
    {"id": "cat_assinaturas", "nome": "assinaturas", "tipo": "despesa", "cor": "#607D8B"},
    {"id": "cat_drogaria", "nome": "drogaria", "tipo": "despesa", "cor": "#009688"},
    {"id": "cat_anuidade", "nome": "anuidade", "tipo": "despesa", "cor": "#FF5722"},
    {"id": "cat_outros", "nome": "outros", "tipo": "despesa", "cor": "#9E9E9E"}
  ],
  "transacoes": [],
  "planejamento": {
    "2026": {
      "assinaturas": {"proj": 71, "parcelas": 0},
      "drogaria": {"proj": 82, "parcelas": 0},
      "anuidade": {"proj": 62, "parcelas": 0}
    }
  }
}'::JSONB;

-- ============================================================
-- CLIENTE 2: Paulo e Andrea
-- ============================================================
dados2 := '{
  "contas": [
    {"id": "c1", "nome": "BB Paulo", "tipo": "corrente", "saldo": 0},
    {"id": "c2", "nome": "Andrea BTG", "tipo": "investimento", "saldo": 0},
    {"id": "c3", "nome": "Paulo BB", "tipo": "corrente", "saldo": 0},
    {"id": "c4", "nome": "Paulo Itaú", "tipo": "corrente", "saldo": 0}
  ],
  "categorias": [
    {"id": "cat_salario", "nome": "salário", "tipo": "receita", "cor": "#4CAF50"},
    {"id": "cat_aluguel", "nome": "aluguel", "tipo": "despesa", "cor": "#F44336"},
    {"id": "cat_contas", "nome": "contas", "tipo": "despesa", "cor": "#FF9800"},
    {"id": "cat_alimentacao", "nome": "alimentação", "tipo": "despesa", "cor": "#E91E63"},
    {"id": "cat_transporte", "nome": "transporte", "tipo": "despesa", "cor": "#9C27B0"},
    {"id": "cat_saude", "nome": "saúde", "tipo": "despesa", "cor": "#2196F3"},
    {"id": "cat_lazer", "nome": "lazer", "tipo": "despesa", "cor": "#00BCD4"},
    {"id": "cat_educacao", "nome": "educação", "tipo": "despesa", "cor": "#3F51B5"},
    {"id": "cat_vestuario", "nome": "vestuário", "tipo": "despesa", "cor": "#795548"},
    {"id": "cat_assinaturas", "nome": "assinaturas", "tipo": "despesa", "cor": "#607D8B"},
    {"id": "cat_drogaria", "nome": "drogaria", "tipo": "despesa", "cor": "#009688"},
    {"id": "cat_anuidade", "nome": "anuidade", "tipo": "despesa", "cor": "#FF5722"},
    {"id": "cat_outros", "nome": "outros", "tipo": "despesa", "cor": "#9E9E9E"}
  ],
  "transacoes": [],
  "planejamento": {}
}'::JSONB;

-- ============================================================
-- INSERT DOS CLIENTES
-- ============================================================
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;

INSERT INTO clientes (id, planejador_id, nome, dados)
VALUES (cliente1_id, planejador_id, 'Albert Pak', dados1)
ON CONFLICT (id) DO UPDATE
  SET planejador_id = EXCLUDED.planejador_id,
      nome = EXCLUDED.nome,
      dados = EXCLUDED.dados;

INSERT INTO clientes (id, planejador_id, nome, dados)
VALUES (cliente2_id, planejador_id, 'Paulo e Andrea', dados2)
ON CONFLICT (id) DO UPDATE
  SET planejador_id = EXCLUDED.planejador_id,
      nome = EXCLUDED.nome,
      dados = EXCLUDED.dados;

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

RAISE NOTICE 'Migração concluída! Clientes inseridos: Albert Pak (%) e Paulo e Andrea (%)', cliente1_id, cliente2_id;

END $$;

-- Verifique o resultado:
SELECT id, nome, planejador_id, criado_em FROM clientes ORDER BY criado_em;
