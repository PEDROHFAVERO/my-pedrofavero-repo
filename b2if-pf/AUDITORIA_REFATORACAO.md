# B2IF PF — PLANO DE REFATORAÇÃO DEFINITIVO
## "A Cirurgia"
> **Baseado no:** Relatório de Diagnóstico de 25/06/2026  
> **Premissa:** Zero downtime. Refatoração incremental. Cada fase é deployável independentemente.

---

## PRINCÍPIO DE EXECUÇÃO

Este plano segue a regra do **Estrangulador (Strangler Fig)**:
- Nunca reescreva tudo de uma vez — você vai parar no meio e ter dois sistemas ruins
- Cada fase entrega valor isolado e pode ir para produção
- A arquitetura nova cresce ao redor da velha até a velha ser extinta
- A ordem das fases é cirúrgica: segurança primeiro, arquitetura depois, qualidade por último

---

## FASE 0 — REMEDIAÇÃO EMERGENCIAL (1-2 dias)
### Objetivo: Fechar as feridas que sangram agora

### 0.1 — Revogar exposição da chave Gemini no browser
**Problema:** `get-gemini-key` Edge Function retorna a chave real para o browser.

**Ação imediata:** Modificar a Edge Function para **nunca retornar a chave**. A chave deve ser usada apenas server-side.

```typescript
// supabase/functions/get-gemini-key/index.ts — MATAR ESTA FUNÇÃO
// Substituir por: supabase/functions/process-pdf/index.ts
// que recebe o texto do PDF e retorna as transações processadas
// A chave Gemini fica em Deno.env.get('GEMINI_API_KEY') — nunca sai do servidor
```

**Workaround urgente** enquanto a Edge Function não está pronta:
```javascript
// geminiClient.js — remover buscarChaveGemini() do export público
// Tornar privada até que o processamento seja movido para servidor
```

### 0.2 — Deprecar `gerarLinkLeitura()` — LGPD Risk
```javascript
// src/utils/clienteStorage.js
// DELETAR as funções gerarLinkLeitura() e importarClienteDeLink()
// Substituição: gerar um token UUID no Supabase com TTL de 7 dias
// CREATE TABLE public.link_leitura (
//   id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
//   cliente_id text REFERENCES public.clientes(id),
//   expires_at timestamptz DEFAULT now() + interval '7 days',
//   criado_por uuid REFERENCES auth.users(id)
// );
```

### 0.3 — Adicionar ErrorBoundary em todas as rotas
```jsx
// src/components/ErrorBoundary.jsx — CRIAR ESTE ARQUIVO
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info); }
  render() {
    if (this.state.hasError) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}

// src/App.jsx — envolver cada lazy import
{visitadas.has('categorizador') && (
  <ErrorBoundary key="categorizador">
    <PageCategorizador />
  </ErrorBoundary>
)}
```

### 0.4 — Remover `localStorage` do tenant switching
```javascript
// src/App.jsx e src/context/AppContext.jsx
// Substituir localStorage.getItem('manager_viewing')
// por estado React normal passado via AppProvider props
// O token JWT já indica o role — confiar no JWT, não no localStorage
```

**Comandos para instalar dependências da Fase 0:**
```bash
cd b2if-pf
npm install react-error-boundary  # biblioteca battle-tested de ErrorBoundary
```

---

## FASE 1 — INFRAESTRUTURA DE QUALIDADE (3-5 dias)
### Objetivo: Forçar qualidade antes de mexer na lógica de negócio

### 1.1 — Instalar e configurar TypeScript + ESLint estrito
```bash
cd b2if-pf
npm install -D typescript @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D eslint eslint-plugin-react eslint-plugin-react-hooks
npm install -D zod  # validação de schema nas fronteiras
```

**`tsconfig.json` — configuração estrita:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "allowJs": true,           // Migração incremental: JS ainda funciona
    "checkJs": false,          // Mas não valida JS antigo ainda
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**`.eslintrc.cjs` — regras de morte para `any` e arquivos grandes:**
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',          // any = erro de build
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    'max-lines': ['error', { max: 200, skipBlankLines: true }],  // Lei 1 = lei
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['error', 'warn'] }],
  }
};
```

### 1.2 — Criar interfaces de domínio centrais
```typescript
// src/types/domain.ts — CRIAR ESTE ARQUIVO

export interface Transacao {
  id: string;
  data: string;               // YYYY-MM-DD
  descricao: string;
  valor: number;              // sempre positivo
  tipo: 'receita' | 'despesa';
  categoria: string | null;
  subcategoria?: string;
  conta: string;
  competencia?: string;       // YYYY-MM
  parcelaAtual?: number | null;
  parcelaTotal?: number | null;
  status: 'pendente' | 'categorizado' | 'rascunho';
  origem?: 'csv' | 'pdf' | 'whatsapp' | 'manual';
}

export interface Categoria {
  id: string;
  nome: string;
  grupo: string;
  tipo?: 'receita' | 'despesa';
  isCategoria?: boolean;
  categoria?: string;         // parent category id
  oculto?: boolean;
}

export interface ContaAPagar {
  id: string;
  nome: string;
  valor: number;
  diaVencimento: number;
  categoriaId: string;
  ativo: boolean;
}

export interface Planejamento {
  [ano: string]: {
    [mes: number]: {
      [categoriaId: string]: {
        projetado: number;
        parcelas: number;
      };
    };
  };
}

export interface ClienteAtivo {
  id: string;
  nome: string;
  planejador_id: string;
  anoAtivo: number;
  transacoes: Transacao[];
  categorias: Categoria[];
  planejamento: Planejamento;
  contasAPagar: ContaAPagar[];
  contas: Array<{ id: string; nome: string }>;
  notas?: string;
}

export interface PlanejadorPerfil {
  id: string;
  nome: string;
  email: string;
  role: 'planejador' | 'manager';
  ativo: boolean;
}

export interface Sessao {
  user: { id: string; email: string };
  perfil: PlanejadorPerfil | null;
  clienteId: string | null;
  modoAcesso?: 'visualizacao' | 'editor';
}
```

### 1.3 — Instalar Zod e criar schemas de validação
```typescript
// src/schemas/cliente.schema.ts — CRIAR ESTE ARQUIVO
import { z } from 'zod';

export const TransacaoSchema = z.object({
  id: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().min(1),
  valor: z.number().nonnegative(),
  tipo: z.enum(['receita', 'despesa']),
  categoria: z.string().nullable(),
  conta: z.string(),
  competencia: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  parcelaAtual: z.number().nullable().optional(),
  parcelaTotal: z.number().nullable().optional(),
  status: z.enum(['pendente', 'categorizado', 'rascunho']),
});

export const ClienteSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  planejador_id: z.string().uuid(),
  anoAtivo: z.number().int().min(2020).max(2099),
  transacoes: z.array(TransacaoSchema),
  categorias: z.array(z.object({
    id: z.string(),
    nome: z.string(),
    grupo: z.string(),
  })),
  planejamento: z.record(z.record(z.record(z.object({
    projetado: z.number(),
    parcelas: z.number(),
  })))),
  contasAPagar: z.array(z.object({
    id: z.string(),
    nome: z.string(),
    valor: z.number(),
    diaVencimento: z.number().int().min(1).max(31),
  })).optional().default([]),
  contas: z.array(z.object({ id: z.string(), nome: z.string() })).optional().default([]),
});

// Uso:
// const resultado = ClienteSchema.safeParse(dadosDoBanco);
// if (!resultado.success) throw new Error(resultado.error.message);
```

---

## FASE 2 — CIRURGIA NOS GOD FILES (2-3 semanas)
### Objetivo: Partir os 4 God Files em módulos coerentes

### 2.1 — Nova Árvore de Pastas
```
src/
├── types/
│   ├── domain.ts           # interfaces de domínio (Transacao, Cliente, etc.)
│   └── api.ts              # tipos de request/response das Edge Functions
│
├── schemas/
│   ├── cliente.schema.ts   # Zod schemas para validação
│   ├── transacao.schema.ts
│   └── webhook.schema.ts   # validação das respostas das Edge Functions
│
├── services/               # toda lógica que faz I/O (Supabase, Gemini, etc.)
│   ├── supabase/
│   │   ├── clientes.service.ts    # CRUD de clientes
│   │   ├── planejadores.service.ts
│   │   └── bot.service.ts
│   ├── pdf/
│   │   ├── process-pdf.service.ts  # chama Edge Function, NUNCA o Gemini direto
│   │   └── extract-text.service.ts # wrapper do pdfParser
│   └── gemini/
│       └── gemini.service.ts       # APENAS server-side (Edge Functions)
│
├── lib/
│   ├── supabase.ts         # cliente Supabase (já existe)
│   ├── appConfig.ts        # configurações (já existe)
│   └── errors.ts           # classes de erro tipadas
│
├── utils/                  # funções puras, sem I/O
│   ├── parser/
│   │   ├── csv.parser.ts          # extraído de parser.js
│   │   ├── xlsx.parser.ts         # extraído de parser.js
│   │   └── calculations.ts        # calcularParcelasFuturas, agruparPorMes, etc.
│   ├── pdfParser/
│   │   ├── extractor.ts           # extrairLinhasPDF, extrairTextoPDF
│   │   ├── banks/
│   │   │   ├── bb.parser.ts       # parsarFaturaCartaoBR
│   │   │   ├── nubank.parser.ts   # parsarNubankFatura
│   │   │   └── generic.parser.ts  # parsarGenerico
│   │   └── index.ts               # parsePDF (orquestrador)
│   ├── fingerprint.ts      # gerarFingerprint, marcarDuplicatas
│   ├── categorization.ts   # autoCategorizar, REGRAS_PADRAO
│   └── ids.ts              # gerarId via crypto.randomUUID()
│
├── hooks/                  # custom hooks, sem render
│   ├── useClienteAtivo.ts  # lógica de cliente ativo extraída do AppContext
│   ├── useSupabaseRealtime.ts  # subscription extraída do AppContext
│   ├── usePDFProcessing.ts     # lógica de processamento de PDF
│   ├── useCategorization.ts    # lógica de categorização
│   └── usePlanejamento.ts      # lógica do planejador
│
├── components/             # componentes de UI puros (sem I/O)
│   ├── ErrorBoundary.tsx
│   ├── UI.jsx              # já existe
│   ├── NotasFloat.jsx      # já existe
│   ├── tables/
│   │   ├── TransacoesTable.tsx    # extraído de PageCategorizador
│   │   └── ColFilter.tsx          # extraído de PageCategorizador
│   ├── charts/
│   │   ├── BarChart.tsx           # extraído de PageDashboard
│   │   └── KPICard.tsx            # extraído de PageDashboard
│   └── modals/
│       ├── ModalTransacoes.tsx    # extraído de PageDashboard
│       ├── ModalRevisaoImport.tsx # extraído de PageCategorizador
│       └── ModalRevisaoMetas.tsx  # extraído de PagePlanejador
│
├── context/
│   ├── AppContext.jsx       # reduzir para <150 linhas — só orquestração
│   └── AuthContext.jsx      # já ok (277 linhas, pode ser refatorado para TS)
│
├── pages/                  # páginas = orchestration layer only
│   ├── PageCategorizador/
│   │   ├── index.jsx        # <200 linhas — orquestração
│   │   ├── ImportSection.tsx
│   │   ├── CategorizacaoSection.tsx
│   │   └── RegrasSection.tsx
│   ├── PageDashboard/
│   │   ├── index.jsx        # <200 linhas — orquestração
│   │   ├── VistaAnual.tsx
│   │   └── VistaMensal.tsx
│   ├── PagePlanejador/
│   │   ├── index.jsx        # <200 linhas — orquestração
│   │   ├── PlanejamentoTable.tsx
│   │   └── ContasAPagarSection.tsx
│   └── ... (demais pages)
│
├── design/
│   └── tokens.js           # já existe
│
└── data/
    └── categorias.js       # já existe
```

### 2.2 — Plano de Corte: PageCategorizador.jsx (4.263 → ~5 arquivos)

**Extração 1 — `ColFilter` → `src/components/tables/ColFilter.tsx`**
```bash
# O componente ColFilter começa por volta da linha 50
# Tem estado próprio, props bem definidas — extração limpa
# Meta: ~100 linhas
```

**Extração 2 — Funções puras → `src/utils/fingerprint.ts`**
```typescript
// gerarFingerprint() e marcarDuplicatas() são funções puras
// Zero dependências de React — extração trivial
export function gerarFingerprint(transacao: Transacao): string { ... }
export function marcarDuplicatas(transacoes: Transacao[]): Transacao[] { ... }
```

**Extração 3 — Lógica de categorização → `src/utils/categorization.ts`**
```typescript
// autoCategorizar(), REGRAS_PADRAO, aplicarRegras()
// Zero dependências de React
export function autoCategorizar(transacoes: Transacao[], regras: Regra[]): Transacao[] { ... }
```

**Extração 4 — Hook de PDF → `src/hooks/usePDFProcessing.ts`**
```typescript
// Toda a lógica de:
// - handleUploadPDFEscolhido()
// - processarPDFsComGemini() — MAS agora chamando Edge Function, não Gemini direto
// - geminiKeyRef, loadingTimerRef, cancelarPDFRef
// - loadingMsg, loadingElapsed, carregando states

export function usePDFProcessing(clienteAtivo: ClienteAtivo, onImport: (t: Transacao[]) => void) {
  // ... todos os states e handlers de PDF
  return { processarPDFs, carregando, loadingMsg, cancelar };
}
```

**Extração 5 — Modal de revisão → `src/components/modals/ModalRevisaoImport.tsx`**
```typescript
// ModalRevisao com toda a tabela de revisão de transações (~400 linhas)
// Interface props bem definida
interface ModalRevisaoImportProps {
  transacoes: Transacao[];
  onConfirmar: (transacoes: Transacao[]) => void;
  onCancelar: () => void;
}
```

**Resultado:** `PageCategorizador/index.jsx` fica com ~200 linhas de pura orquestração: importa os hooks, renderiza as seções, passa props.

### 2.3 — Plano de Corte: PageDashboard.jsx (2.489 → ~4 arquivos)

**Extração 1 — `VistaAnual` → `src/pages/PageDashboard/VistaAnual.tsx`**
```typescript
// Componente com suas próprias sub-renderizações e hooks
// ~600 linhas
```

**Extração 2 — `VistaMensal` → `src/pages/PageDashboard/VistaMensal.tsx`**
```typescript
// CRÍTICO: remover o prop setClienteAtivo
// VistaMensal NÃO deve escrever dados — apenas ler
// Ações de edição devem subir via callbacks tipados
interface VistaMensalProps {
  // ... props de leitura apenas
  onCategorizarTransacao: (id: string, categoria: string) => void; // callback seguro
}
```

**Extração 3 — `KPICard`, `grupoColor` → `src/components/charts/`**

**Resultado:** `PageDashboard/index.jsx` fica com ~150 linhas: cálculos de `useMemo`, estado de aba/mês, rendering condicional dos sub-componentes.

### 2.4 — Plano de Corte: PagePlanejador.jsx (1.799 → ~3 arquivos)

**Extração 1 — Hook de planejamento → `src/hooks/usePlanejamento.ts`**
```typescript
export function usePlanejamento(clienteAtivo: ClienteAtivo) {
  // inicializarComMedias()
  // replicarAteDezembroEFechar()
  // limparMesesSelecionados()
  // limparGrupoMes()
  // atualizarLimite()
  // confirmarImportacaoMetas()
  return { inicializar, replicar, limpar, atualizar, confirmarMetas };
}
```

**Extração 2 — Contas a Pagar → `src/pages/PagePlanejador/ContasAPagarSection.tsx`**
```typescript
// salvarConta(), removerConta(), statusConta()
// Modal de CRUD de contas
// ~300 linhas
```

**Extração 3 — Importação PDF Metas → `src/hooks/useMetasPDF.ts`**
```typescript
// handleImportarPDFMetas() — mas movendo para Edge Function
// modalRevisaoMetas, importandoPDF, importProgressMsg
```

### 2.5 — Plano de Corte: whatsapp-webhook (2.531 → ~6 arquivos Deno)

```
supabase/functions/whatsapp-webhook/
├── index.ts            # <200 linhas — apenas roteamento de entrada
├── handlers/
│   ├── text.handler.ts         # processarTexto()
│   ├── audio.handler.ts        # processarAudio()
│   ├── image.handler.ts        # processarImagem()
│   └── cafe.handler.ts         # toda a lógica de Café Consigo Mesmo
├── services/
│   ├── gemini.service.ts       # todas as chamadas ao Gemini
│   ├── whatsapp.service.ts     # enviarMsg(), enviarAudio(), etc.
│   └── session.service.ts      # gerenciamento de sessões de bot
└── types/
    └── webhook.types.ts        # interfaces TypeScript, sem any
```

---

## FASE 3 — MULTI-TENANCY (1-2 semanas)
### Objetivo: Adicionar `workspace_id` sem derrubar a operação

### 3.1 — Estratégia de Migração Zero-Downtime

**Regra:** Nunca adicionar coluna `NOT NULL` sem default em tabela com dados. Sempre:
1. Adicionar coluna `NULLABLE` com `DEFAULT`
2. Preencher backfill em batches
3. Adicionar `NOT NULL` constraint apenas após backfill completo

**Passo 1 — Criar tabela `workspaces`:**
```sql
-- Migration: 20260701_create_workspaces.sql
CREATE TABLE public.workspaces (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  plano       TEXT        NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'enterprise'
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Manager vê apenas sua workspace
CREATE POLICY "workspace_owner_select"
  ON public.workspaces FOR SELECT
  USING (id IN (
    SELECT workspace_id FROM public.planejadores WHERE id = auth.uid()
  ));
```

**Passo 2 — Criar workspace padrão para dados existentes:**
```sql
-- Migration: 20260702_seed_default_workspace.sql
-- Cria uma workspace 'default' para migração dos dados existentes
INSERT INTO public.workspaces (id, nome, slug, plano)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Workspace', 'default', 'pro');
```

**Passo 3 — Adicionar `workspace_id` nas tabelas vitais (nullable primeiro):**
```sql
-- Migration: 20260703_add_workspace_id.sql

-- planejadores
ALTER TABLE public.planejadores 
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);

-- clientes
ALTER TABLE public.clientes 
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);

-- bot_sessions
ALTER TABLE public.bot_sessions 
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);

-- bot_messages
ALTER TABLE public.bot_messages 
  ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
```

**Passo 4 — Backfill dos dados existentes:**
```sql
-- Migration: 20260704_backfill_workspace_id.sql
-- Preenche workspace_id para todos os registros existentes com o workspace default
UPDATE public.planejadores 
  SET workspace_id = '00000000-0000-0000-0000-000000000001'
  WHERE workspace_id IS NULL;

UPDATE public.clientes c
  SET workspace_id = p.workspace_id
  FROM public.planejadores p
  WHERE c.planejador_id = p.id AND c.workspace_id IS NULL;

UPDATE public.bot_sessions bs
  SET workspace_id = c.workspace_id
  FROM public.clientes c
  WHERE bs.cliente_id = c.id AND bs.workspace_id IS NULL;
```

**Passo 5 — Tornar `workspace_id` NOT NULL (após confirmar backfill 100%):**
```sql
-- Migration: 20260705_workspace_id_not_null.sql
ALTER TABLE public.planejadores ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.clientes     ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.bot_sessions ALTER COLUMN workspace_id SET NOT NULL;
```

**Passo 6 — Reescrever RLS para isolar por workspace:**
```sql
-- Migration: 20260706_rls_workspace_isolation.sql

-- planejadores: vê apenas os da sua workspace
DROP POLICY IF EXISTS "manager_select_all_planejadores" ON public.planejadores;
CREATE POLICY "workspace_planejadores_select"
  ON public.planejadores FOR SELECT
  USING (workspace_id = (
    SELECT workspace_id FROM public.planejadores WHERE id = auth.uid()
  ));

-- clientes: vê apenas clientes da sua workspace
DROP POLICY IF EXISTS "manager_select_all_clientes" ON public.clientes;
CREATE POLICY "workspace_clientes_select"
  ON public.clientes FOR SELECT
  USING (workspace_id = (
    SELECT workspace_id FROM public.planejadores WHERE id = auth.uid()
  ));

-- bot_sessions: isolamento por workspace
DROP POLICY IF EXISTS "service_role_all" ON public.bot_sessions;
CREATE POLICY "workspace_bot_sessions_select"
  ON public.bot_sessions FOR SELECT
  USING (workspace_id = (
    SELECT workspace_id FROM public.planejadores WHERE id = auth.uid()
  ));
CREATE POLICY "service_role_bot_sessions_all"
  ON public.bot_sessions FOR ALL
  USING (auth.role() = 'service_role');
```

### 3.2 — Migrar PK de `clientes` de TEXT para UUID

**Este é o passo mais arriscado — deve ser feito com extremo cuidado:**

```sql
-- Migration: 20260710_migrate_cliente_pk.sql
-- FASE PREPARATÓRIA: adicionar coluna uuid paralela
ALTER TABLE public.clientes ADD COLUMN id_uuid UUID DEFAULT uuid_generate_v4();
ALTER TABLE public.cliente_acessos ADD COLUMN cliente_id_uuid UUID;

-- Backfill dos acessos com o novo UUID
UPDATE public.cliente_acessos ca
  SET cliente_id_uuid = c.id_uuid
  FROM public.clientes c
  WHERE ca.cliente_id = c.id;

-- ATENÇÃO: O frontend deve ser atualizado para usar o novo UUID
-- antes de fazer o swap da primary key.
-- Manter ambas as colunas durante o período de transição.
```

**No frontend — gerar IDs com `crypto.randomUUID()`:**
```typescript
// src/utils/ids.ts — SUBSTITUIR Math.random
export function gerarId(): string {
  // crypto.randomUUID() é disponível em todos os browsers modernos e Node 19+
  return crypto.randomUUID();
}
```

---

## FASE 4 — MOVER TAREFAS PESADAS PARA SERVIDOR (1 semana)
### Objetivo: Tirar Gemini e PDF do browser

### 4.1 — Criar Edge Function `process-pdf`
```typescript
// supabase/functions/process-pdf/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // 1. Autentica o usuário via JWT no header
  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') ?? '');
  if (!user) return new Response('Unauthorized', { status: 401 });

  // 2. Recebe o texto já extraído (extração ainda pode ser no browser com pdfjs)
  const { textoPDF, nomeConta, clienteId } = await req.json();

  // 3. Chama Gemini SERVER-SIDE com a chave protegida
  const apiKey = Deno.env.get('GEMINI_API_KEY')!; // NUNCA vai para o browser
  const transacoes = await processarComGemini(textoPDF, apiKey);

  // 4. Retorna as transações processadas (sem expor a chave)
  return new Response(JSON.stringify({ transacoes }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

**No frontend — chamada via Edge Function:**
```typescript
// src/services/pdf/process-pdf.service.ts
export async function processarPDFViaServidor(
  textoPDF: string,
  nomeConta: string,
  clienteId: string,
): Promise<Transacao[]> {
  const { data, error } = await supabase.functions.invoke('process-pdf', {
    body: { textoPDF, nomeConta, clienteId },
  });
  if (error) throw new Error(error.message);
  return TransacoesArraySchema.parse(data.transacoes); // Zod validation
}
```

### 4.2 — OPCIONAL: Fila assíncrona para múltiplos PDFs
Para o caso de usuários enviando 5+ PDFs simultaneamente:

```typescript
// supabase/migrations/20260715_pdf_jobs.sql
CREATE TABLE public.pdf_jobs (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id   TEXT        NOT NULL,
  planejador_id UUID       NOT NULL,
  workspace_id  UUID       NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending', -- pending | processing | done | error
  texto_pdf    TEXT        NOT NULL,
  nome_conta   TEXT        NOT NULL,
  resultado    JSONB,      -- transacoes[] quando done
  erro         TEXT,       -- mensagem quando error
  criado_em    TIMESTAMPTZ DEFAULT now(),
  processado_em TIMESTAMPTZ
);

-- CRON Job via pg_cron (disponível no Supabase):
SELECT cron.schedule(
  'process-pdf-jobs',
  '*/30 seconds',
  $$SELECT net.http_post(url := 'https://<project>.supabase.co/functions/v1/process-pdf-worker', ...)$$
);
```

### 4.3 — Mover geração de PDF para servidor
```typescript
// supabase/functions/generate-pdf/index.ts
// Recebe os dados do relatório, gera o PDF server-side
// Retorna URL de download (Storage Supabase com TTL)
// Remove o arquivo gerarPDFProjecao.js (770 linhas) do bundle frontend
```

---

## FASE 5 — TYPESCRIPT COMPLETO (2 semanas, incremental)
### Objetivo: Migrar de .jsx/.js para .tsx/.ts sem quebrar nada

**Estratégia incremental:**
```bash
# 1. Renomear arquivos novos criados nas fases anteriores como .ts/.tsx
# 2. Para arquivos existentes, renomear um por vez:
mv src/utils/fingerprint.js src/utils/fingerprint.ts
# 3. Corrigir erros de TypeScript que aparecerem
# 4. Nunca usar 'any' — usar 'unknown' + type guard quando necessário
# 5. Para manter o backlog limpo, usar:
# @ts-ignore — apenas como último recurso, com comentário explicativo
```

**Prioridade de migração:**
1. `/utils/` (funções puras — migração mais simples)
2. `/services/` (interfaces de I/O — crítico para segurança de tipos)
3. `/hooks/` (lógica de negócio)
4. `/context/` (estado global)
5. `/components/` (UI)
6. `/pages/` (orchestration)

---

## FASE 6 — NORMALIZAÇÃO DO BANCO (longo prazo, 1-2 meses)
### Objetivo: Sair do JSONB blob para tabelas normalizadas

Esta fase é a mais arriscada e deve ser feita com feature flags.

### 6.1 — Criar tabela `transacoes` normalizada (paralela ao JSONB)
```sql
-- Migration: 20260801_create_transacoes_table.sql
CREATE TABLE public.transacoes (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id    TEXT        NOT NULL REFERENCES public.clientes(id),
  workspace_id  UUID        NOT NULL REFERENCES public.workspaces(id),
  data          DATE        NOT NULL,
  descricao     TEXT        NOT NULL,
  valor         NUMERIC(12,2) NOT NULL,
  tipo          TEXT        NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  categoria     TEXT,
  conta         TEXT,
  competencia   TEXT        CHECK (competencia ~ '^\d{4}-\d{2}$'),
  parcela_atual SMALLINT,
  parcela_total SMALLINT,
  status        TEXT        NOT NULL DEFAULT 'pendente',
  origem        TEXT        DEFAULT 'manual',
  criado_em     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transacoes_cliente_competencia 
  ON public.transacoes (cliente_id, competencia);
CREATE INDEX idx_transacoes_workspace 
  ON public.transacoes (workspace_id);

ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_transacoes_isolation"
  ON public.transacoes FOR ALL
  USING (workspace_id = (
    SELECT workspace_id FROM public.planejadores WHERE id = auth.uid()
  ));
```

### 6.2 — Estratégia de Feature Flag para migração dual-write
```typescript
// src/lib/featureFlags.ts
export const FEATURES = {
  USE_NORMALIZED_TRANSACOES: import.meta.env.VITE_FF_NORMALIZED_TRANSACOES === 'true',
};

// src/services/supabase/clientes.service.ts
export async function salvarTransacao(transacao: Transacao, clienteId: string) {
  if (FEATURES.USE_NORMALIZED_TRANSACOES) {
    // Salva na tabela normalizada
    await supabase.from('transacoes').upsert(mapToDbRow(transacao));
  } else {
    // Continua salvando no JSONB (fallback seguro)
    await salvarClienteSupabase(clienteId);
  }
}
```

---

## CHECKLIST DE EXECUÇÃO

### Fase 0 — Emergencial (Esta semana)
- [ ] Criar `process-pdf` Edge Function que usa Gemini server-side
- [ ] Remover `get-gemini-key` ou torná-la obsoleta
- [ ] Deprecar `gerarLinkLeitura()` e criar tabela `link_leitura` com TTL
- [ ] Adicionar `ErrorBoundary` em todas as rotas lazy-loaded
- [ ] Remover `localStorage.manager_viewing` — usar estado React

### Fase 1 — Infraestrutura de Qualidade (Semana 1-2)
- [ ] `npm install zod react-error-boundary`
- [ ] `npm install -D typescript @typescript-eslint/eslint-plugin eslint`
- [ ] Criar `tsconfig.json` com `strict: true`, `allowJs: true`
- [ ] Criar `src/types/domain.ts` com todas as interfaces
- [ ] Criar `src/schemas/cliente.schema.ts` com Zod schemas
- [ ] Adicionar `max-lines: 200` no ESLint — CI falha se arquivo exceder

### Fase 2 — Cirurgia nos God Files (Semana 2-5)
- [ ] Extrair `ColFilter` → `src/components/tables/ColFilter.tsx`
- [ ] Extrair funções puras de `PageCategorizador` → `src/utils/`
- [ ] Criar `usePDFProcessing.ts` hook
- [ ] Criar `ModalRevisaoImport.tsx` componente
- [ ] Reduzir `PageCategorizador/index.jsx` para <200 linhas
- [ ] Extrair `VistaAnual` e `VistaMensal` do Dashboard
- [ ] Remover `setClienteAtivo` como prop de componentes de apresentação
- [ ] Extrair hook `usePlanejamento.ts`
- [ ] Refatorar `whatsapp-webhook` em módulos por responsabilidade
- [ ] Eliminar todos os `any` do webhook — zero tolerância

### Fase 3 — Multi-Tenancy (Semana 5-7)
- [ ] Migration: `CREATE TABLE workspaces`
- [ ] Migration: `ADD COLUMN workspace_id NULLABLE`
- [ ] Migration: backfill de todos os workspace_id existentes
- [ ] Migration: `SET NOT NULL` após backfill
- [ ] Migration: reescrever políticas RLS com isolamento por workspace
- [ ] Substituir `Math.random().toString(36)` por `crypto.randomUUID()`
- [ ] Atualizar AppContext para injetar `workspace_id` em todas as operações

### Fase 4 — Desacoplar Tarefas Pesadas (Semana 6-8)
- [ ] Criar Edge Function `process-pdf` (Gemini server-side)
- [ ] Criar Edge Function `generate-pdf` (relatório server-side)
- [ ] Atualizar frontend para chamar Edge Functions
- [ ] Remover `geminiClient.js` do bundle frontend
- [ ] Remover `gerarPDFProjecao.js` do bundle frontend

### Fase 5 — TypeScript Completo (Ongoing)
- [ ] Migrar `/utils/` para `.ts`
- [ ] Migrar `/services/` para `.ts`  
- [ ] Migrar `/hooks/` para `.ts`
- [ ] Migrar `/context/` para `.ts`
- [ ] Migrar `/components/` para `.tsx`
- [ ] Migrar `/pages/` para `.tsx`
- [ ] Zero `any` em todo o codebase — configurado no CI

### Fase 6 — Normalização (Mês 2-3)
- [ ] Criar tabela `transacoes` normalizada
- [ ] Implementar dual-write com feature flag
- [ ] Validar integridade dos dados migrados
- [ ] Remover dependência do campo JSONB `dados.transacoes`

---

## ESTIMATIVA DE ESFORÇO

| Fase | Duração | Risco | Impacto |
|---|---|---|---|
| 0 — Emergencial | 1-2 dias | Baixo | Alto (fecha buracos de segurança) |
| 1 — Infraestrutura | 3-5 dias | Baixo | Alto (previne regressão futura) |
| 2 — God Files | 2-3 semanas | Médio | Alto (manutenibilidade) |
| 3 — Multi-Tenancy | 1-2 semanas | Alto (mitigado pelo plano) | Crítico (SaaS) |
| 4 — Tarefas Pesadas | 1 semana | Médio | Crítico (segurança + UX) |
| 5 — TypeScript | 2 semanas | Baixo | Alto (qualidade long-term) |
| 6 — Normalização | 1-2 meses | Alto | Crítico (escala) |
| **TOTAL** | **~3 meses** | — | — |

---

## REGRA FINAL

**Nenhuma feature nova** é aceita no codebase até que a Fase 0 e a Fase 1 estejam completas.

A dívida técnica atual é tão alta que adicionar código novo **antes de erguer os alicerces de qualidade** é o equivalente a construir um novo andar em cima de uma fundação que está afundando. Cada linha nova escrita sem TypeScript, sem Zod, sem ErrorBoundary e sem limite de tamanho é outra camada de cimento sobre o cadáver.

O sistema não precisa de features. Ele precisa de cirurgia.
