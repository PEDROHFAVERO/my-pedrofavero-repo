# B2IF PF — RELATÓRIO DE DIAGNÓSTICO ARQUITETURAL
## "A Autópsia"
> **Auditoria realizada em:** 25/06/2026  
> **Auditor:** Senior Software Engineer / Solutions Architect  
> **Veredicto:** SISTEMA EM ESTADO CRÍTICO — Não está pronto para escala nem para multi-tenancy real.

---

## SUMÁRIO EXECUTIVO

O sistema B2IF PF é funcionalmente competente para um MVP de um único planejador, mas está estruturalmente podre para qualquer ambição de SaaS/Enterprise. O codebase inteiro — **15.878 linhas de código em 16 arquivos** — opera como um monolito sem tipagem, sem isolamento de tenant, com lógica de negócio colada diretamente na UI, e com chamadas de IA pesadas rodando **dentro do browser do usuário**.

Cinco leis foram definidas como inegociáveis. O sistema viola **todas as cinco, de forma simultânea e sistêmica.**

---

## INVENTÁRIO DE DANOS

### Contagem de Linhas — O Quadro do Crime

| Arquivo | Linhas | Limite Legal | Excesso | Classificação |
|---|---|---|---|---|
| `src/pages/PageCategorizador.jsx` | **4.263** | 200 | **+2.031%** | 🔴 GOD FILE |
| `src/pages/PageDashboard.jsx` | **2.489** | 200 | **+1.144%** | 🔴 GOD FILE |
| `supabase/functions/whatsapp-webhook/index.ts` | **2.531** | 200 | **+1.165%** | 🔴 GOD FILE |
| `src/pages/PagePlanejador.jsx` | **1.799** | 200 | **+799%** | 🔴 GOD FILE |
| `src/pages/PageBotWhatsapp.jsx` | **1.137** | 200 | **+468%** | 🟠 GRAVE |
| `src/pages/PageBacklog.jsx` | **975** | 200 | **+387%** | 🟠 GRAVE |
| `src/utils/parser.js` | **832** | 200 | **+316%** | 🟠 GRAVE |
| `src/utils/gerarPDFProjecao.js` | **770** | 200 | **+285%** | 🟠 GRAVE |
| `src/pages/PageManagerHub.jsx` | **744** | 200 | **+272%** | 🟠 GRAVE |
| `src/utils/pdfParser.js` | **626** | 200 | **+213%** | 🟠 GRAVE |
| `src/utils/geminiClient.js` | **573** | 200 | **+186%** | 🟠 GRAVE |
| `src/context/AppContext.jsx` | **439** | 200 | **+119%** | 🟡 MODERADO |
| `src/App.jsx` | **365** | 200 | **+82%** | 🟡 MODERADO |
| **TOTAL FRONTEND** | **15.878** | — | — | 💀 |

**Zero arquivos** estão dentro do limite de 200 linhas. Nenhum. Zero. 100% do codebase viola a Lei 1.

---

## LEI 1 — VIOLAÇÃO: LIMITE DE LINHAS / SRP

### AUTOPSIA: PageCategorizador.jsx (4.263 linhas)
Este arquivo é o maior cadáver do sistema. Em um único componente `.jsx` vivem:

1. **`ColFilter`** — componente dropdown complexo com estado próprio (linhas ~50-150)
2. **`gerarFingerprint()`** — função pura de hashing (deveria ser `/utils`)
3. **`marcarDuplicatas()`** — lógica de negócio pura (deveria ser `/services`)
4. **`handleUploadPlanilha()`** — orquestrador de parsing CSV/XLSX
5. **`handleUploadPDFEscolhido()`** — orquestrador de parsing PDF
6. **`processarPDFsComGemini()`** — chamada de IA Gemini **DIRETAMENTE NO BROWSER** (violação da Lei 5)
7. **`confirmarImport()`** — write direto em `clienteAtivo` (mistura UI com state management)
8. Tabela de categorização com 100+ colunas condicionais
9. Editor de regras de categorização (CRUD completo)
10. Sistema de exportação (CSV, Excel)
11. Sistema de importação (PDF, CSV, XLSX)
12. Modal de revisão de transações
13. Modal de seleção de conta
14. Sistema de deduplicação

**Veredicto:** Um arquivo que deveria ser uma página de UI contém um **sistema completo de ETL financeiro**. Isto não é SRP violado — é SRP inexistente.

### AUTOPSIA: PageDashboard.jsx (2.489 linhas)
Em um arquivo de dashboard existem:

1. **`VistaAnual`** — componente com estado próprio (deveria ser arquivo separado)
2. **`VistaMensal`** — componente com estado próprio (deveria ser arquivo separado)
3. **`KPICard`** — componente de UI puro (deveria ser `/components`)
4. **`grupoColor()`** — utility function (deveria ser `/utils`)
5. **`ModalTransacoes`** — modal completo com 200+ linhas (deveria ser `/components`)
6. Lógica de cálculo de totais anuais, mensais, multi-mês — tudo inline
7. Lógica de filtragem de contas inline
8. Lógica de projeção de parcelas inline

**Achado crítico:** `VistaMensal` recebe `setClienteAtivo` como prop e **chama diretamente** para modificar dados do cliente. Uma sub-view de apresentação tem poder de escrita no estado global. Isso é uma violação de fluxo de dados unidirecional que gera bugs impossíveis de rastrear.

### AUTOPSIA: PagePlanejador.jsx (1.799 linhas)
1. `handleImportarPDFMetas()` — chama Gemini (`buscarChaveGemini`, `processarMetasMD`) **diretamente** dentro de um event handler de `<input>`. A IA roda no browser. (Lei 5 violada)
2. `confirmarImportacaoMetas()` — 40 linhas de lógica de negócio de reconciliação de dados dentro de um callback UI
3. `inicializarComMedias()`, `replicarAteDezembroEFechar()`, `limparMesesSelecionados()` — funções de negócio misturadas com handlers de modal
4. `salvarConta()`, `removerConta()` — CRUD de `contasAPagar` com mutação direta do JSONB

**Achado crítico:** A função de botão anônima `btn(onClick, label, variant)` criada dentro do `return()` do componente. Uma factory de componentes criada inline no render. Cada renderização cria uma nova função. Performance degradada por design.

### AUTOPSIA: whatsapp-webhook/index.ts (2.531 linhas)
O backend não é melhor. Em um único arquivo Deno/TypeScript:

1. Toda a lógica de recebimento de webhook WhatsApp
2. Todo o processamento de mensagens de texto
3. Todo o processamento de áudio (transcrição)
4. Todo o processamento de imagens
5. Todo o sistema de lembretes
6. Todo o sistema de Café Consigo Mesmo
7. Chamadas Gemini (multi-modal, PDF, texto)
8. Acesso direto ao Supabase (sem camada de repositório)
9. Orquestração de fluxo conversacional
10. Gerenciamento de sessões de bot

Este arquivo tem **mais responsabilidades que muitos sistemas completos**.

---

## LEI 2 — VIOLAÇÃO: MULTI-TENANT OBRIGATÓRIO

### Achado 1: `workspace_id` não existe em lugar nenhum
```sql
-- setup_supabase.sql
CREATE TABLE public.planejadores (
  id    UUID PRIMARY KEY REFERENCES auth.users(id),
  nome  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role  TEXT NOT NULL DEFAULT 'planejador'
  -- ❌ SEM workspace_id
);

CREATE TABLE public.clientes (
  id            TEXT PRIMARY KEY,  -- nanoid gerado no frontend
  planejador_id UUID NOT NULL REFERENCES public.planejadores(id),
  dados         JSONB
  -- ❌ SEM workspace_id
);
```

A coluna `workspace_id` não existe em **nenhuma tabela** do sistema. A fronteira de tenant é o `planejador_id` — o que significa que cada `planejador` é simultaneamente um usuário E um tenant. Isso funciona para um único escritório de finanças, mas **é inviável para um produto SaaS white-label** onde múltiplos escritórios (organizações/empresas) precisam estar isolados.

**Cenário de falha:** Dois escritórios de planejamento financeiro contratam o B2IF PF como SaaS. Os planejadores de escritório A conseguem ver os planejadores de escritório B se a política RLS do manager for relaxada por erro. Há zero separação organizacional.

### Achado 2: Chave Primária de `clientes` é `TEXT` gerado no frontend
```javascript
// src/utils/clienteStorage.js — linha 130
return Math.random().toString(36).slice(2) + Date.now().toString(36);
```
- `Math.random()` **NÃO é criptograficamente seguro**
- Em escala com múltiplos usuários simultâneos, colisão de ID é possível
- Um ID gerado no frontend não pode ser auditado, rastreado ou sequenciado no banco
- UUID v4 gerado pelo banco (`uuid_generate_v4()`) deveria ser o padrão

### Achado 3: Dados do cliente em JSONB blob não-normalizado
```sql
dados JSONB  -- contém: transacoes[], categorias[], planejamento{}, contasAPagar[]...
```
- **Zero queryability**: impossível buscar "todas as transações acima de R$1000 do planejador X" sem `jsonb_array_elements()` custoso
- **Zero integridade referencial**: nada impede `transacoes[0].categoriaId = "id_que_nao_existe"`
- **Zero índices granulares**: um UPDATE de uma única transação reescreve o blob inteiro
- **Problema de concorrência**: dois clients simultâneos podem causar race condition na escrita do JSONB
- **Impossível adicionar `workspace_id` às transações** sem migrar todos os dados do JSONB para tabelas normalizadas

---

## LEI 3 — VIOLAÇÃO: SEGURANÇA A NÍVEL DE BANCO

### Achado 1: RLS nas tabelas de Bot é APENAS `service_role`
```sql
-- supabase/migrations/002_bot_whatsapp.sql
ALTER TABLE public.bot_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.bot_sessions
  USING (auth.role() = 'service_role');
-- ...mesma política para bot_messages e bot_lembretes
```

**Isto significa:** nenhum usuário autenticado normal consegue consultar as tabelas de bot via client-side Supabase. O acesso é apenas pelo `service_role`. Isso soa seguro, mas é uma **implementação defeituosa**:

1. Um planejador deveria poder ver as sessões de bot dos **seus próprios clientes** — atualmente impossível via RLS, força bypass via Edge Function com service_role para tudo
2. Se algum dia for necessário mostrar histórico de chat na UI, será necessário criar políticas RLS retroativamente
3. Não há `planejador_id` nas tabelas de bot, impossibilitando isolamento futuro

### Achado 2: Manager vê TODOS os clientes de TODOS os planejadores
```sql
-- setup_supabase.sql linha 141
CREATE POLICY "manager_select_all_clientes"
  ON public.clientes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.planejadores p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );
```

Um `manager` consegue fazer `SELECT * FROM clientes` e ver **todos os clientes de todos os planejadores**. Em uma implantação com múltiplos escritórios no mesmo projeto Supabase, isto é um **vazamento de dados cross-tenant crítico**. O `manager` deveria ver apenas clientes de sua própria `workspace`.

### Achado 3: `gerarLinkLeitura()` expõe dados financeiros completos via URL
```javascript
// src/utils/clienteStorage.js — linha 113
export function gerarLinkLeitura(cliente) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(cliente))));
  return `${window.location.origin}/leitura?d=${encoded}`;
}
```

**VIOLAÇÃO CRÍTICA DE PRIVACIDADE:** Todo o objeto JSON do cliente — incluindo `transacoes[]`, `planejamento{}`, `contasAPagar[]` — é serializado e codificado em Base64 e colocado **na URL**. O `btoa` não é criptografia. Qualquer pessoa com o link consegue:
1. Decodificar `atob(d)` e ver todos os dados financeiros em texto puro
2. O link fica no histórico do browser, em logs de servidor, em ferramentas de analytics, em e-mails de "clique aqui para abrir"
3. URLs são registradas em qualquer proxy corporativo

Esta funcionalidade deveria gerar um token opaco (`uuid v4`) armazenado em tabela com TTL, nunca expor dados na URL.

### Achado 4: Switching de Tenant via `localStorage`
```javascript
// src/App.jsx — linhas 26, 272, 323
const managerViewing = (() => {
  try { return JSON.parse(localStorage.getItem('manager_viewing') || 'null'); } catch { return null; }
})();
```

O estado de "qual planejador o manager está visualizando" é armazenado em `localStorage`. Isso é um **anti-padrão de segurança**:
1. `localStorage` pode ser manipulado via DevTools por qualquer usuário
2. Um usuário com role `planejador` que conhece o formato do objeto pode injetar `manager_viewing` e tentar acessar dados de outros planejadores
3. A validação real deveria ocorrer no servidor via RLS, não no frontend via localStorage

### Achado 5: Chave Supabase (anon key) hardcoded em código-fonte
```javascript
// src/utils/geminiClient.js — linha 24
const _SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pb3BwenR3cmhyYm5ra2h1dWJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDQ0NjQsImV4cCI6MjA5MDQ4MDQ2NH0.opPC34brWzXzrTbtcXcn9Xl8ZO5WIBgkm1Fa9D6iaZU';
```

A anon key do Supabase está hardcoded no arquivo de utilidade. Embora a anon key seja intencionalmente pública, hardcodá-la dificulta rotações de chave, cria inconsistência com variáveis de ambiente e é um hábito que normaliza segredos no código.

---

## LEI 4 — VIOLAÇÃO: TIPAGEM ESTRITA

### Achado 1: Zero TypeScript no Frontend (15.878 linhas de JavaScript puro)
Todo o codebase frontend é `.jsx` e `.js` — sem TypeScript. Consequências diretas encontradas durante a auditoria:

**Sem interfaces de dados definidas:**
- O objeto `clienteAtivo` é consumido em 6+ arquivos com propriedades acessadas diretamente (`clienteAtivo.dados`, `clienteAtivo.transacoes`, `clienteAtivo.contasAPagar`) sem nenhuma garantia de que essas propriedades existem ou têm o tipo correto
- Qualquer `undefined` em `transacoes` causa crash silencioso nos `useMemo` de `PageDashboard.jsx`

**Sem validação de schema em fronteiras:**
- `importarClienteDeArquivo()` em `clienteStorage.js` valida apenas `id`, `nome`, `transacoes` — aceita qualquer JSON malformado sem erro
- A resposta do Gemini é parseada com `try/catch` silencioso: `try { return JSON.parse(m[0]); } catch (_) {}` — falha silenciosa sem log estruturado
- Respostas da Edge Function `whatsapp-webhook` não têm schema validation — qualquer JSON inesperado causa comportamento indefinido

### Achado 2: `any` abusado no backend (72 ocorrências no webhook)
```typescript
// whatsapp-webhook/index.ts — exemplos representativos
system_instruction: any;        // linha 356
contents: any[];                 // linha 357
generationConfig?: any;          // linha 358
async function geminiGerar(parts: any[]): Promise<any>  // linha 557
const txBot: any[] = ...         // linha 633
(t: any) => String(t.competencia...)  // linha 634
```

72 usos de `any` no único arquivo TypeScript do projeto. O TypeScript foi adicionado mas sem rigor — o `any` pervasivo anula 100% dos benefícios de tipagem estática.

### Achado 3: Zero Error Boundaries no Frontend
```bash
# Resultado da busca por ErrorBoundary em todo o codebase:
# 0 resultados
```
Não existe um único `ErrorBoundary` React em todo o frontend. Consequência: um erro em `PageCategorizador.jsx` durante processamento de PDF **derruba toda a aplicação** com tela branca. O usuário perde o contexto, não há fallback UI, não há mensagem de erro amigável.

### Achado 4: `try/catch` silenciosos e logs sem estrutura
```javascript
// AppContext.jsx — padrão recorrente
try { localStorage.setItem('b2if_pagina_ativa', pagina); } catch {}
// ...
.catch(err => console.error('[flush] Erro ao salvar ao sair:', err))
```
- `catch {}` vazio em 4+ locais — erros engolidos silenciosamente
- `console.error` sem estrutura — sem correlação de request, sem `userId`, sem timestamp padronizado
- Nenhuma integração com serviço de monitoramento de erros (Sentry, LogRocket, etc.)

---

## LEI 5 — VIOLAÇÃO: DESACOPLAMENTO DE TAREFAS PESADAS

### Achado 1: Gemini rodando DIRETAMENTE NO BROWSER do usuário (Lei 5: violação máxima)

**`PageCategorizador.jsx` — `processarPDFsComGemini()` (linha ~463):**
```javascript
async function processarPDFsComGemini(arquivos, nomeConta) {
  // ...
  geminiKeyRef.current = await buscarChaveGemini();  // busca chave no servidor
  const textoPDF = await extrairTextoPDF(file);       // processa PDF no browser
  // Chama Gemini DIRETAMENTE do browser com a chave real
  const resultado = await processarPDFNoBrowser(textoPDF, apiKey, ...);
  // ...
}
```

**`PagePlanejador.jsx` — `handleImportarPDFMetas()` (linha ~96):**
```javascript
async function handleImportarPDFMetas(e) {
  const textoPDF = await extrairTextoPDF(file);
  const apiKey = await buscarChaveGemini();  // busca chave real
  const resultado = await processarMetasMD(textoPDF, apiKey, ...);  // Gemini no browser
}
```

**Consequências desta arquitetura:**

1. **A chave Gemini é exposta ao browser.** A Edge Function `get-gemini-key` retorna a chave real, que é então usada em chamadas `fetch()` diretamente do client. Qualquer usuário com DevTools aberto consegue capturar a chave e fazer chamadas Gemini ilimitadas com ela.

2. **O processamento bloqueia a UI.** Mesmo com SSE streaming para não dar timeout, durante os ~15s de processamento o usuário fica preso na tela. Se fechar a aba, o processamento morre.

3. **Sem retry automático.** Se o Gemini retornar erro, o usuário precisa recomeçar do zero.

4. **Sem fila.** Se 10 usuários enviarem PDFs ao mesmo tempo, 10 chamadas Gemini simultâneas são feitas — sem rate limiting, sem throttling, sem custo controlado.

5. **Sem auditoria.** Não há registro de qual usuário processou qual PDF, quando, com qual custo em tokens.

**A solução correta:** Uma Edge Function `process-pdf` recebe o arquivo, enfileira o processamento, chama o Gemini server-side com a chave protegida no ambiente da função, e retorna resultado via polling ou webhook. A chave Gemini **jamais deve chegar ao browser**.

### Achado 2: `pdfParser.js` roda parsing pesado no browser (626 linhas)
O `pdfjs-dist` é inicializado no browser para extrair texto de PDFs de bancos. Para arquivos grandes (~5MB), isso pode consumir centenas de MB de RAM e travar a aba em dispositivos móveis. Este processamento pertence ao servidor.

### Achado 3: `gerarPDFProjecao.js` (770 linhas) gera PDF no browser
A geração do relatório PDF de projeção financeira — 770 linhas de código — roda completamente no browser via `jsPDF`. Para relatórios grandes com muitos dados, isso pode causar crash em dispositivos com RAM limitada.

---

## SUMÁRIO DE VIOLAÇÕES POR LEI

| Lei | Status | Criticidade | Descrição Curta |
|---|---|---|---|
| Lei 1 — Limite de Linhas / SRP | 🔴 FALHA TOTAL | CRÍTICA | 15/15 arquivos violam o limite; 4 God Files acima de 1.799 linhas |
| Lei 2 — Multi-Tenant | 🔴 FALHA TOTAL | CRÍTICA | Zero `workspace_id`; PK de cliente é nanoid inseguro gerado no frontend; dados em JSONB blob |
| Lei 3 — Segurança DB-Level | 🔴 FALHA CRÍTICA | CRÍTICA | `btoa` URL expondo dados financeiros; localStorage para tenant switching; bot tables sem user-level RLS; manager vê todos os clientes |
| Lei 4 — TypeScript Strict | 🔴 FALHA TOTAL | ALTA | Zero TypeScript no frontend; 72x `any` no webhook; zero Zod; zero ErrorBoundary |
| Lei 5 — Desacoplamento Pesado | 🔴 FALHA TOTAL | CRÍTICA | Gemini + PDF parsing + PDF generation rodando no browser; chave Gemini exposta ao client |

**Resultado:** 5 leis avaliadas. **5 violações críticas.** Score: 0/5.

---

## RISCOS IMEDIATOS (Antes de Qualquer Refatoração)

| Risco | Probabilidade | Impacto | Ação Emergencial |
|---|---|---|---|
| Chave Gemini capturada via DevTools | Alta | Alto (custo financeiro ilimitado) | Remover `get-gemini-key` pública; processar Gemini server-side |
| Dados financeiros vazando via `gerarLinkLeitura()` | Média | Alto (LGPD) | Deprecar função imediatamente; substituir por token opaco |
| `localStorage.manager_viewing` explorado | Baixa | Alto (acesso cross-tenant) | Remover; validar acesso server-side |
| Crash total de UI por ausência de ErrorBoundary | Alta | Médio (UX) | Adicionar ErrorBoundary em cada rota lazy-loaded |
| Race condition no save de JSONB | Média | Alto (perda de dados) | Implementar transação otimista com version control |
