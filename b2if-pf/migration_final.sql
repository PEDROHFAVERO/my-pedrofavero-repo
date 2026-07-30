-- ============================================================
-- MIGRAÇÃO - CLIENTES PARA JORGE CARVALHO
-- ============================================================
-- PASSO 1: Rode esta linha e copie o UUID retornado:
-- ============================================================
SELECT id AS uuid_jorge_carvalho FROM auth.users
WHERE email = 'jorgecarvalho@100um.com.br';

-- ============================================================
-- PASSO 2: Substitua COLE_O_UUID_AQUI pelo UUID acima e rode
-- ============================================================

DO $$
DECLARE
  pid UUID := 'COLE_O_UUID_AQUI';
BEGIN

  ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;

  -- ── CLIENTE 1: Albert Pak ────────────────────────────────
  INSERT INTO clientes (id, planejador_id, nome, dados)
  VALUES (
    '3iraxdfpkt3mmyxn7c4', pid, 'Albert Pak',
    jsonb_build_object(
      'id',           '3iraxdfpkt3mmyxn7c4',
      'nome',         'Albert Pak',
      'criadoEm',     '2026-01-01T00:00:00.000Z',
      'atualizadoEm', now()::text,
      'anoAtivo',     2026,
      'contas',       '[]'::jsonb,
      'transacoes',   '[]'::jsonb,
      'planejamento', '{
        "2026": {
          "assinaturas": {"proj": 71,  "parcelas": 0},
          "drogaria":    {"proj": 82,  "parcelas": 0},
          "anuidade":    {"proj": 62,  "parcelas": 0}
        }
      }'::jsonb,
      'categorias', '[
        {"id":"salario",        "nome":"Salário",               "grupo":"Receitas",           "tipo":"receita"},
        {"id":"freelance",      "nome":"Freelance / Renda Extra","grupo":"Receitas",           "tipo":"receita"},
        {"id":"aluguel_rec",    "nome":"Aluguel Recebido",      "grupo":"Receitas",           "tipo":"receita"},
        {"id":"rendimentos",    "nome":"Rendimentos",            "grupo":"Receitas",           "tipo":"receita"},
        {"id":"reembolso",      "nome":"Reembolso",              "grupo":"Receitas",           "tipo":"receita"},
        {"id":"outros_rec",     "nome":"Outros Recebimentos",    "grupo":"Receitas",           "tipo":"receita"},
        {"id":"moradia",        "nome":"Moradia",                "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"aluguel",        "nome":"Aluguel",                "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"contas",         "nome":"Contas de Casa",         "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"celular",        "nome":"Celular",                "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"assinaturas",    "nome":"Assinaturas",            "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"escola",         "nome":"Escola / Faculdade",     "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"plano_saude",    "nome":"Plano de Saúde",         "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"academia",       "nome":"Academia",               "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"impostos",       "nome":"Impostos / Taxas",       "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"custos_imoveis", "nome":"Custos de Imóvel",       "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"outras_fixas",   "nome":"Outras Fixas",           "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"trabalho",       "nome":"Trabalho",               "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"alimentacao_fora","nome":"Alimentação Fora",      "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"alimentacao",    "nome":"Supermercado",           "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"padaria",        "nome":"Padaria / Café",         "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"transporte",     "nome":"Transporte",             "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"gasolina",       "nome":"Gasolina / Combustível", "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"carro",          "nome":"Carro",                  "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"saude",          "nome":"Saúde / Consulta",       "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"drogaria",       "nome":"Drogaria / Farmácia",    "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"beleza",         "nome":"Beleza",                 "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"vestuario",      "nome":"Vestuário",              "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"lazer",          "nome":"Lazer",                  "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"viagem",         "nome":"Viagem",                 "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"papelaria",      "nome":"Papelaria",              "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"decoracao",      "nome":"Decoração / Casa",       "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"compras_online", "nome":"Compras Online",         "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"compras",        "nome":"Compras Gerais",         "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"outros",         "nome":"Outros Consumos",        "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"pets",           "nome":"Pets",                   "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"presente",       "nome":"Presentes",              "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"doacoes",        "nome":"Doações",                "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"esporte",        "nome":"Esporte",                "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"livro_curso",    "nome":"Livro / Curso",          "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"reforma",        "nome":"Reforma",                "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"fin_cartao",     "nome":"Financiamento de Cartão","grupo":"Dívidas",            "tipo":"despesa"},
        {"id":"emprestimo",     "nome":"Empréstimo",             "grupo":"Dívidas",            "tipo":"despesa"},
        {"id":"financiamento",  "nome":"Financiamento",          "grupo":"Dívidas",            "tipo":"despesa"},
        {"id":"anuidade",       "nome":"Anuidade",               "grupo":"Dívidas",            "tipo":"despesa"},
        {"id":"tarifas",        "nome":"Tarifas Bancárias",      "grupo":"Dívidas",            "tipo":"despesa"},
        {"id":"investimento",   "nome":"Investimento",           "grupo":"Investimentos",      "tipo":"despesa"},
        {"id":"poupanca",       "nome":"Poupança",               "grupo":"Investimentos",      "tipo":"despesa"},
        {"id":"previdencia",    "nome":"Previdência",            "grupo":"Investimentos",      "tipo":"despesa"},
        {"id":"entre_contas",   "nome":"Entre contas",           "grupo":"Fluxo Interno",      "tipo":"neutro"}
      ]'::jsonb,
      'regras', '[
        {"keyword":"salario",        "categoria":"salario",          "prioridade":1},
        {"keyword":"salário",        "categoria":"salario",          "prioridade":1},
        {"keyword":"rendimento",     "categoria":"rendimentos",      "prioridade":2},
        {"keyword":"ifood",          "categoria":"alimentacao_fora", "prioridade":1},
        {"keyword":"rappi",          "categoria":"alimentacao_fora", "prioridade":1},
        {"keyword":"restaurante",    "categoria":"alimentacao_fora", "prioridade":2},
        {"keyword":"padaria",        "categoria":"padaria",          "prioridade":1},
        {"keyword":"supermercado",   "categoria":"alimentacao",      "prioridade":1},
        {"keyword":"mercado",        "categoria":"alimentacao",      "prioridade":2},
        {"keyword":"carrefour",      "categoria":"alimentacao",      "prioridade":1},
        {"keyword":"assai",          "categoria":"alimentacao",      "prioridade":1},
        {"keyword":"uber",           "categoria":"transporte",       "prioridade":1},
        {"keyword":"shell",          "categoria":"gasolina",         "prioridade":1},
        {"keyword":"posto",          "categoria":"gasolina",         "prioridade":1},
        {"keyword":"farmacia",       "categoria":"drogaria",         "prioridade":1},
        {"keyword":"farmácia",       "categoria":"drogaria",         "prioridade":1},
        {"keyword":"drogasil",       "categoria":"drogaria",         "prioridade":1},
        {"keyword":"droga raia",     "categoria":"drogaria",         "prioridade":1},
        {"keyword":"ultrafarma",     "categoria":"drogaria",         "prioridade":1},
        {"keyword":"hospital",       "categoria":"saude",            "prioridade":1},
        {"keyword":"clinica",        "categoria":"saude",            "prioridade":1},
        {"keyword":"medico",         "categoria":"saude",            "prioridade":1},
        {"keyword":"dentista",       "categoria":"saude",            "prioridade":1},
        {"keyword":"unimed",         "categoria":"plano_saude",      "prioridade":1},
        {"keyword":"netflix",        "categoria":"assinaturas",      "prioridade":1},
        {"keyword":"spotify",        "categoria":"assinaturas",      "prioridade":1},
        {"keyword":"amazon prime",   "categoria":"assinaturas",      "prioridade":1},
        {"keyword":"disney",         "categoria":"assinaturas",      "prioridade":1},
        {"keyword":"escola",         "categoria":"escola",           "prioridade":1},
        {"keyword":"faculdade",      "categoria":"escola",           "prioridade":1},
        {"keyword":"salao",          "categoria":"beleza",           "prioridade":1},
        {"keyword":"barbearia",      "categoria":"beleza",           "prioridade":1},
        {"keyword":"academia",       "categoria":"academia",         "prioridade":1},
        {"keyword":"smartfit",       "categoria":"academia",         "prioridade":1},
        {"keyword":"shopee",         "categoria":"compras_online",   "prioridade":1},
        {"keyword":"mercado livre",  "categoria":"compras_online",   "prioridade":1},
        {"keyword":"amazon",         "categoria":"compras_online",   "prioridade":2},
        {"keyword":"enel",           "categoria":"contas",           "prioridade":1},
        {"keyword":"cpfl",           "categoria":"contas",           "prioridade":1},
        {"keyword":"sabesp",         "categoria":"contas",           "prioridade":1},
        {"keyword":"internet",       "categoria":"contas",           "prioridade":2},
        {"keyword":"vivo",           "categoria":"contas",           "prioridade":2},
        {"keyword":"claro",          "categoria":"contas",           "prioridade":2},
        {"keyword":"condominio",     "categoria":"moradia",          "prioridade":1},
        {"keyword":"condomínio",     "categoria":"moradia",          "prioridade":1},
        {"keyword":"aluguel",        "categoria":"aluguel",          "prioridade":1},
        {"keyword":"iptu",           "categoria":"impostos",         "prioridade":1},
        {"keyword":"ipva",           "categoria":"impostos",         "prioridade":1},
        {"keyword":"transferencia",  "categoria":"entre_contas",     "prioridade":1},
        {"keyword":"transferência",  "categoria":"entre_contas",     "prioridade":1},
        {"keyword":"pix",            "categoria":"entre_contas",     "prioridade":3},
        {"keyword":"aplicacao",      "categoria":"investimento",     "prioridade":1},
        {"keyword":"aplicação",      "categoria":"investimento",     "prioridade":1},
        {"keyword":"cdb",            "categoria":"investimento",     "prioridade":1},
        {"keyword":"tesouro",        "categoria":"investimento",     "prioridade":1},
        {"keyword":"anuidade",       "categoria":"anuidade",         "prioridade":1},
        {"keyword":"tarifa",         "categoria":"tarifas",          "prioridade":1}
      ]'::jsonb
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET planejador_id = EXCLUDED.planejador_id,
        nome          = EXCLUDED.nome,
        dados         = EXCLUDED.dados;

  -- ── CLIENTE 2: Paulo e Andrea ────────────────────────────
  INSERT INTO clientes (id, planejador_id, nome, dados)
  VALUES (
    'f4mxn3cl6ammn3q2lc8', pid, 'Paulo e Andrea',
    jsonb_build_object(
      'id',           'f4mxn3cl6ammn3q2lc8',
      'nome',         'Paulo e Andrea',
      'criadoEm',     '2026-01-01T00:00:00.000Z',
      'atualizadoEm', now()::text,
      'anoAtivo',     2026,
      'contas',       '[]'::jsonb,
      'transacoes',   '[]'::jsonb,
      'planejamento', '{}'::jsonb,
      'categorias', '[
        {"id":"salario",        "nome":"Salário",               "grupo":"Receitas",           "tipo":"receita"},
        {"id":"freelance",      "nome":"Freelance / Renda Extra","grupo":"Receitas",           "tipo":"receita"},
        {"id":"aluguel_rec",    "nome":"Aluguel Recebido",      "grupo":"Receitas",           "tipo":"receita"},
        {"id":"rendimentos",    "nome":"Rendimentos",            "grupo":"Receitas",           "tipo":"receita"},
        {"id":"reembolso",      "nome":"Reembolso",              "grupo":"Receitas",           "tipo":"receita"},
        {"id":"outros_rec",     "nome":"Outros Recebimentos",    "grupo":"Receitas",           "tipo":"receita"},
        {"id":"moradia",        "nome":"Moradia",                "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"aluguel",        "nome":"Aluguel",                "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"contas",         "nome":"Contas de Casa",         "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"celular",        "nome":"Celular",                "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"assinaturas",    "nome":"Assinaturas",            "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"escola",         "nome":"Escola / Faculdade",     "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"plano_saude",    "nome":"Plano de Saúde",         "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"academia",       "nome":"Academia",               "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"impostos",       "nome":"Impostos / Taxas",       "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"custos_imoveis", "nome":"Custos de Imóvel",       "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"outras_fixas",   "nome":"Outras Fixas",           "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"trabalho",       "nome":"Trabalho",               "grupo":"Despesas Fixas",     "tipo":"despesa"},
        {"id":"alimentacao_fora","nome":"Alimentação Fora",      "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"alimentacao",    "nome":"Supermercado",           "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"padaria",        "nome":"Padaria / Café",         "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"transporte",     "nome":"Transporte",             "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"gasolina",       "nome":"Gasolina / Combustível", "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"carro",          "nome":"Carro",                  "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"saude",          "nome":"Saúde / Consulta",       "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"drogaria",       "nome":"Drogaria / Farmácia",    "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"beleza",         "nome":"Beleza",                 "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"vestuario",      "nome":"Vestuário",              "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"lazer",          "nome":"Lazer",                  "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"viagem",         "nome":"Viagem",                 "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"papelaria",      "nome":"Papelaria",              "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"decoracao",      "nome":"Decoração / Casa",       "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"compras_online", "nome":"Compras Online",         "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"compras",        "nome":"Compras Gerais",         "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"outros",         "nome":"Outros Consumos",        "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"pets",           "nome":"Pets",                   "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"presente",       "nome":"Presentes",              "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"doacoes",        "nome":"Doações",                "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"esporte",        "nome":"Esporte",                "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"livro_curso",    "nome":"Livro / Curso",          "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"reforma",        "nome":"Reforma",                "grupo":"Consumo Mensal",     "tipo":"despesa"},
        {"id":"fin_cartao",     "nome":"Financiamento de Cartão","grupo":"Dívidas",            "tipo":"despesa"},
        {"id":"emprestimo",     "nome":"Empréstimo",             "grupo":"Dívidas",            "tipo":"despesa"},
        {"id":"financiamento",  "nome":"Financiamento",          "grupo":"Dívidas",            "tipo":"despesa"},
        {"id":"anuidade",       "nome":"Anuidade",               "grupo":"Dívidas",            "tipo":"despesa"},
        {"id":"tarifas",        "nome":"Tarifas Bancárias",      "grupo":"Dívidas",            "tipo":"despesa"},
        {"id":"investimento",   "nome":"Investimento",           "grupo":"Investimentos",      "tipo":"despesa"},
        {"id":"poupanca",       "nome":"Poupança",               "grupo":"Investimentos",      "tipo":"despesa"},
        {"id":"previdencia",    "nome":"Previdência",            "grupo":"Investimentos",      "tipo":"despesa"},
        {"id":"entre_contas",   "nome":"Entre contas",           "grupo":"Fluxo Interno",      "tipo":"neutro"}
      ]'::jsonb,
      'regras', '[
        {"keyword":"salario",        "categoria":"salario",          "prioridade":1},
        {"keyword":"salário",        "categoria":"salario",          "prioridade":1},
        {"keyword":"rendimento",     "categoria":"rendimentos",      "prioridade":2},
        {"keyword":"ifood",          "categoria":"alimentacao_fora", "prioridade":1},
        {"keyword":"rappi",          "categoria":"alimentacao_fora", "prioridade":1},
        {"keyword":"restaurante",    "categoria":"alimentacao_fora", "prioridade":2},
        {"keyword":"padaria",        "categoria":"padaria",          "prioridade":1},
        {"keyword":"supermercado",   "categoria":"alimentacao",      "prioridade":1},
        {"keyword":"mercado",        "categoria":"alimentacao",      "prioridade":2},
        {"keyword":"carrefour",      "categoria":"alimentacao",      "prioridade":1},
        {"keyword":"assai",          "categoria":"alimentacao",      "prioridade":1},
        {"keyword":"uber",           "categoria":"transporte",       "prioridade":1},
        {"keyword":"shell",          "categoria":"gasolina",         "prioridade":1},
        {"keyword":"posto",          "categoria":"gasolina",         "prioridade":1},
        {"keyword":"farmacia",       "categoria":"drogaria",         "prioridade":1},
        {"keyword":"farmácia",       "categoria":"drogaria",         "prioridade":1},
        {"keyword":"drogasil",       "categoria":"drogaria",         "prioridade":1},
        {"keyword":"droga raia",     "categoria":"drogaria",         "prioridade":1},
        {"keyword":"ultrafarma",     "categoria":"drogaria",         "prioridade":1},
        {"keyword":"hospital",       "categoria":"saude",            "prioridade":1},
        {"keyword":"clinica",        "categoria":"saude",            "prioridade":1},
        {"keyword":"medico",         "categoria":"saude",            "prioridade":1},
        {"keyword":"dentista",       "categoria":"saude",            "prioridade":1},
        {"keyword":"unimed",         "categoria":"plano_saude",      "prioridade":1},
        {"keyword":"netflix",        "categoria":"assinaturas",      "prioridade":1},
        {"keyword":"spotify",        "categoria":"assinaturas",      "prioridade":1},
        {"keyword":"amazon prime",   "categoria":"assinaturas",      "prioridade":1},
        {"keyword":"disney",         "categoria":"assinaturas",      "prioridade":1},
        {"keyword":"escola",         "categoria":"escola",           "prioridade":1},
        {"keyword":"faculdade",      "categoria":"escola",           "prioridade":1},
        {"keyword":"salao",          "categoria":"beleza",           "prioridade":1},
        {"keyword":"barbearia",      "categoria":"beleza",           "prioridade":1},
        {"keyword":"academia",       "categoria":"academia",         "prioridade":1},
        {"keyword":"smartfit",       "categoria":"academia",         "prioridade":1},
        {"keyword":"shopee",         "categoria":"compras_online",   "prioridade":1},
        {"keyword":"mercado livre",  "categoria":"compras_online",   "prioridade":1},
        {"keyword":"amazon",         "categoria":"compras_online",   "prioridade":2},
        {"keyword":"enel",           "categoria":"contas",           "prioridade":1},
        {"keyword":"cpfl",           "categoria":"contas",           "prioridade":1},
        {"keyword":"sabesp",         "categoria":"contas",           "prioridade":1},
        {"keyword":"internet",       "categoria":"contas",           "prioridade":2},
        {"keyword":"vivo",           "categoria":"contas",           "prioridade":2},
        {"keyword":"claro",          "categoria":"contas",           "prioridade":2},
        {"keyword":"condominio",     "categoria":"moradia",          "prioridade":1},
        {"keyword":"condomínio",     "categoria":"moradia",          "prioridade":1},
        {"keyword":"aluguel",        "categoria":"aluguel",          "prioridade":1},
        {"keyword":"iptu",           "categoria":"impostos",         "prioridade":1},
        {"keyword":"ipva",           "categoria":"impostos",         "prioridade":1},
        {"keyword":"transferencia",  "categoria":"entre_contas",     "prioridade":1},
        {"keyword":"transferência",  "categoria":"entre_contas",     "prioridade":1},
        {"keyword":"pix",            "categoria":"entre_contas",     "prioridade":3},
        {"keyword":"aplicacao",      "categoria":"investimento",     "prioridade":1},
        {"keyword":"aplicação",      "categoria":"investimento",     "prioridade":1},
        {"keyword":"cdb",            "categoria":"investimento",     "prioridade":1},
        {"keyword":"tesouro",        "categoria":"investimento",     "prioridade":1},
        {"keyword":"anuidade",       "categoria":"anuidade",         "prioridade":1},
        {"keyword":"tarifa",         "categoria":"tarifas",          "prioridade":1}
      ]'::jsonb
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET planejador_id = EXCLUDED.planejador_id,
        nome          = EXCLUDED.nome,
        dados         = EXCLUDED.dados;

  ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

  RAISE NOTICE 'OK - Albert Pak e Paulo e Andrea vinculados a Jorge Carvalho';

END $$;

-- PASSO 3: Confirme com esta query:
SELECT c.id, c.nome AS cliente, p.nome AS planejador
FROM clientes c
JOIN planejadores p ON p.id = c.planejador_id
ORDER BY c.criado_em;
