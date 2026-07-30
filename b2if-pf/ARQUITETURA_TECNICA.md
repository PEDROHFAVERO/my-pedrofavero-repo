# B2IF Desktop — Documentação Técnica para Refatoração

> **Finalidade deste documento:** orientar o técnico responsável pela refatoração da aplicação
> para os padrões **DDD (Domain-Driven Design)** e **SOLID**, com deploy em EC2.

---

## 1. Visão Geral do Sistema

O **B2IF Desktop** é uma SPA (Single Page Application) em **React + Vite** que funciona como
sistema de gestão financeira pessoal para assessores e seus clientes.

### Perfis de usuário

| Perfil | O que faz |
|--------|-----------|
| **Manager** | Administra assessores, redistribui clientes, acesso total |
| **Planejador** | Gerencia seus clientes, lança transações, cria planejamentos |
| **Cliente** | Acesso somente leitura ao próprio Dashboard e Fluxo Financeiro |

### Telas do sistema

| Tela | Arquivo | Descrição |
|------|---------|-----------|
| Login | `PageLogin.jsx` | Autenticação via Supabase Auth |
| Hub | `PageHub.jsx` | Lista de clientes do planejador |
| Manager Hub | `PageManagerHub.jsx` | Painel administrativo do Manager |
| Dashboard | `PageDashboard.jsx` | KPIs, gráficos e visão anual |
| Planejador | `PagePlanejador.jsx` | Orçamento projetado vs. realizado |
| Fluxo Financeiro | `PageCategorizador.jsx` | Importação e categorização de transações |
| Bot WhatsApp | `PageBotWhatsapp.jsx` | Configuração do bot (em desenvolvimento) |

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework UI | React | 19 |
| Build tool | Vite | 8 |
| Backend / Auth / DB | Supabase (PostgreSQL + Auth + RLS) | 2.x |
| Estilo | CSS-in-JS inline (design tokens) | — |
| Ícones | Lucide React | 0.577 |
| Importação XLSX | SheetJS (xlsx) | 0.18 |
| Leitura PDF | pdfjs-dist | 5.x |
| Geração PDF | jsPDF + jspdf-autotable | 4.x |
| CSV | PapaParse | 5.x |
| Linguagem | JavaScript (JSX) — sem TypeScript | — |

---

## 3. Estrutura de Arquivos Atual

```
b2if-pf/
├── public/                        # Assets estáticos
│   ├── logo.png / logo-light.png  # Logos (white-label)
│   ├── favicon.svg
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service Worker (PWA)
│   ├── _redirects                 # Netlify SPA fallback
│   └── pdf.worker.min.mjs         # Worker do pdfjs
│
├── src/
│   ├── main.jsx                   # Entry point React
│   ├── App.jsx                    # Router + NavBar + Providers
│   ├── mobile.css                 # Responsividade mobile
│   │
│   ├── lib/
│   │   ├── appConfig.js           # Lê variáveis de ambiente (white-label)
│   │   └── supabase.js            # Instância do cliente Supabase
│   │
│   ├── design/
│   │   └── tokens.js              # Design system: cores, tipografia, bordas
│   │
│   ├── data/
│   │   └── categorias.js          # Categorias padrão + grupos macro + regras de auto-cat
│   │
│   ├── context/
│   │   ├── AuthContext.jsx        # Autenticação, sessão, criação de usuários
│   │   └── AppContext.jsx         # Estado global: cliente ativo, hub, persistência
│   │
│   ├── components/
│   │   ├── UI.jsx                 # Componentes reutilizáveis (Btn, Modal, StatBox…)
│   │   └── ModalAcessos.jsx       # Modal de gestão de acessos do cliente
│   │
│   ├── pages/
│   │   ├── PageLogin.jsx          # Tela de login
│   │   ├── PageHub.jsx            # Hub do planejador (lista de clientes)
│   │   ├── PageManagerHub.jsx     # Painel do Manager
│   │   ├── PageDashboard.jsx      # Dashboard com KPIs e gráficos
│   │   ├── PagePlanejador.jsx     # Planejador orçamentário
│   │   ├── PageCategorizador.jsx  # Fluxo Financeiro (importação + categorização)
│   │   └── PageBotWhatsapp.jsx    # Bot WhatsApp (em desenvolvimento)
│   │
│   └── utils/
│       ├── parser.js              # Parser XLSX/XLSM → modelo interno de transação
│       ├── pdfParser.js           # Parser de extratos PDF (fatura cartão)
│       ├── clienteStorage.js      # Sync de categorias (localStorage ↔ padrão)
│       └── gerarPDFProjecao.js    # Gerador do PDF de projeção orçamentária
│
├── .env                           # Variáveis de ambiente (não commitar)
├── .env.example                   # Modelo das variáveis
├── package.json
├── vite.config.js
└── index.html
```

---

## 4. Modelo de Dados

### 4.1 Tabelas no Supabase (PostgreSQL)

```sql
-- Planejadores (assessores financeiros)
planejadores (
  id        uuid PK  -- mesmo ID do auth.users
  nome      text
  email     text
  role      text     -- 'manager' | 'planejador'
  criado_em timestamptz
)

-- Clientes de cada planejador
clientes (
  id              uuid PK
  planejador_id   uuid FK → planejadores.id
  nome            text
  dados           jsonb    -- toda a estrutura financeira do cliente (ver 4.2)
  criado_em       timestamptz
  atualizado_em   timestamptz
)

-- Acessos dos clientes ao sistema (login próprio)
cliente_acessos (
  id          uuid PK
  cliente_id  uuid FK → clientes.id
  user_id     uuid FK → auth.users.id
  criado_em   timestamptz
)
```

### 4.2 Estrutura do campo `dados` (JSONB)

```jsonb
{
  "nome": "João Silva",
  "anoAtivo": 2026,
  "categorias": [
    {
      "id": "supermercado",
      "nome": "Supermercado",
      "grupo": "Consumo Mensal",
      "tipo": "despesa"
    }
  ],
  "transacoes": [
    {
      "id": "uuid",
      "data": "2026-04-10",
      "competencia": "2026-04",
      "descricao": "Mercado Extra",
      "valor": -350.00,
      "tipo": "despesa",
      "categoria": "supermercado",
      "categoriaId": "supermercado",
      "conta": "Nubank",
      "formato": "Débito",
      "origem": "xlsx",    // "xlsx" | "pdf" | "manual" | "whatsapp"
      "parcelaAtual": null,
      "parcelaTotal": null
    }
  ],
  "planejamento": {
    "2026": {
      "0": {                        // índice do mês (0=Jan … 11=Dez)
        "supermercado": {
          "projetado": 1200,
          "parcelas": 0
        }
      }
    }
  },
  "botWhatsapp": {
    "telefone": "5561999290731",
    "ativo": true,
    "vinculadoEm": "17/04/2026",
    "lembretes": [],
    "alertas": {},
    "mensagens": []
  }
}
```

---

## 5. Fluxo de Autenticação

```
Usuário entra na URL
        │
        ▼
AuthContext.getSession()  ──── Supabase Auth
        │
        ├── Sem sessão → PageLogin
        │
        └── Com sessão → resolverSessao(user)
                │
                ├── role = cliente   → RouterCliente  (Dashboard + Fluxo)
                ├── role = manager   → PageManagerHub
                └── role = planejador → Router (Hub + Dashboard + Planejador + Fluxo + Bot)
```

---

## 6. Fluxo de Dados — Transações

```
Usuário importa arquivo
        │
        ├── XLSX/XLSM → parser.js → [ ] transações normalizadas
        └── PDF       → pdfParser.js → [ ] transações normalizadas
                │
                ▼
        PageCategorizador
                │
                ├── Auto-categorização (REGRAS_PADRAO de categorias.js)
                ├── Edição manual inline
                └── Salvar → AppContext.setClienteAtivo()
                                │
                                ▼
                        Supabase: UPDATE clientes SET dados = ...
```

---

## 7. White-Label (Multi-tenant)

O sistema suporta customização por variável de ambiente:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `VITE_APP_NAME` | `B2IF PF` | Nome exibido no header |
| `VITE_BRAND_COLOR` | `#00B8A9` | Cor principal (derivadas calculadas automaticamente) |
| `VITE_LOGO_FILE` | `logo-light.png` | Arquivo de logo em `/public` |
| `VITE_SUPABASE_URL` | — | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | — | Chave anon do Supabase |

---

## 8. Responsabilidades de cada arquivo

### `src/context/AppContext.jsx`
- Estado global: `clienteAtivo`, `hub` (lista de clientes), `paginaAtual`
- Persistência no Supabase: `salvarCliente()`, `carregarHub()`
- Debounce de 1s para evitar writes excessivos no banco
- Funções: `criarCliente`, `abrirCliente`, `removerCliente`, `setClienteAtivo`

### `src/context/AuthContext.jsx`
- Sessão do usuário: `sessao`, `carregando`
- Funções: `login`, `logout`, `criarPlanejador`, `listarPlanejadores`
- Resolve o role do usuário (manager / planejador / cliente) via consultas ao Supabase

### `src/pages/PageCategorizador.jsx` ⚠️ Maior arquivo (1954 linhas)
- Importação de XLSX, PDF e entrada manual
- Tabela virtualizada (hook `useVirtualList`) para performance com milhares de linhas
- Filtros por coluna estilo Excel (`ColFilter`)
- Auto-categorização por regras
- Aprendizado de regras (botão 🧠)
- Aba Contas (gestão de contas bancárias)
- Aba Categorias (CRUD de categorias customizadas)

### `src/pages/PageDashboard.jsx` (1739 linhas)
- KPIs: saldo, receitas, despesas, economia
- Gráfico de barras SVG (mês a mês)
- Gráfico de linhas SVG (evolução anual)
- Visão mensal e anual
- Fluxo por macro-grupo (Fixas, Consumo, Dívidas, Investimentos)

### `src/pages/PagePlanejador.jsx` (498 linhas)
- Projeção orçamentária por categoria e mês
- Comparação projetado vs. realizado
- Replicação de projeção entre meses
- Geração de PDF da projeção

### `src/utils/parser.js` (786 linhas)
- Leitura de XLSX/XLSM com SheetJS
- Mapeamento de colunas (Conta, Data, Valor, Descrição, Macro, Categoria…)
- Normalização de datas e valores
- Mapeamento de categorias do formato externo para IDs internos

### `src/utils/pdfParser.js` (626 linhas)
- Leitura de faturas de cartão em PDF (pdfjs-dist)
- Extração de data, valor e descrição por expressão regular
- Suporte a múltiplos bancos (BB, Itaú, Nubank, Bradesco…)
- Cálculo de competência por parcela

### `src/data/categorias.js` (337 linhas)
- `GRUPOS`: macro-grupos (Receitas, Despesas Fixas, Consumo Mensal, Dívidas, Investimentos, Fluxo Interno)
- `CATEGORIAS_PADRAO`: 84 categorias com id, nome, grupo e tipo
- `REGRAS_PADRAO`: mapeamento de palavras-chave → categoriaId (auto-categorização)

---

## 9. Sugestão de Estrutura para DDD + SOLID

```
src/
├── domain/
│   ├── transaction/
│   │   ├── Transaction.js           # Entidade
│   │   ├── TransactionRepository.js # Interface
│   │   └── TransactionService.js    # Regras de negócio
│   ├── category/
│   │   ├── Category.js
│   │   └── CategoryService.js       # Auto-categorização, regras
│   ├── planning/
│   │   ├── Planning.js
│   │   └── PlanningService.js       # Projeções, comparativos
│   └── client/
│       ├── Client.js
│       └── ClientRepository.js
│
├── application/
│   ├── usecases/
│   │   ├── ImportTransactions.js    # XLSX + PDF
│   │   ├── AutoCategorize.js
│   │   ├── SavePlanning.js
│   │   └── GenerateReport.js
│   └── ports/
│       ├── IStoragePort.js          # Abstração do Supabase
│       └── IParserPort.js           # Abstração dos parsers
│
├── infrastructure/
│   ├── supabase/
│   │   ├── SupabaseClientRepo.js
│   │   └── SupabaseAuthRepo.js
│   └── parsers/
│       ├── XlsxParser.js
│       └── PdfParser.js
│
└── presentation/
    ├── pages/                       # Pages atuais (refatoradas como views)
    ├── components/
    └── context/                     # Apenas estado UI, sem lógica de negócio
```

---

## 10. Pontos de Atenção para Refatoração

1. **`PageCategorizador.jsx` tem 1954 linhas** — é o candidato principal à decomposição. Sugestão: separar em `TransactionTable`, `TransactionFilters`, `ImportWizard`, `CategoryManager`, `AccountManager`.

2. **`PageDashboard.jsx` tem 1739 linhas** — separar os gráficos SVG em componentes independentes (`BarChart`, `LineChart`, `KPICard`).

3. **Lógica de negócio misturada nos contextos** — `AppContext` e `AuthContext` contêm regras de negócio que devem ir para a camada de domínio/application no DDD.

4. **Sem TypeScript** — considerar migração gradual, começando pelas entidades do domínio.

5. **Dados do cliente em JSONB único** — para escala, avaliar normalização das tabelas `transacoes` e `planejamento` em tabelas próprias.

6. **Auto-categorização em `categorias.js`** — hoje são regras estáticas; no DDD ficaria em `CategoryService.autoCategorizeBatch(transactions, rules)`.

---

## 11. Variáveis de Ambiente necessárias

Crie o arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_NAME=B2IF PF
VITE_BRAND_COLOR=#00B8A9
VITE_LOGO_FILE=logo-light.png
```

---

## 12. Como rodar localmente

```bash
# Instalar dependências
npm install

# Desenvolvimento (hot reload)
npm run dev
# → http://localhost:5173

# Build de produção
npm run build
# → pasta dist/

# Preview do build
npm run preview
```

---

## 13. Deploy na EC2

```bash
# 1. Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Instalar dependências e buildar
npm install
npm run build

# 3. Servir o dist com Nginx ou serve
sudo apt install -y nginx
sudo cp -r dist/* /var/www/html/

# 4. Configurar Nginx para SPA (roteamento client-side)
# /etc/nginx/sites-available/b2if:
# location / { try_files $uri $uri/ /index.html; }
```

> O arquivo `public/_redirects` já está configurado para Netlify.
> Para Nginx, use `try_files $uri $uri/ /index.html;` no bloco `location /`.
