# Roteiro: Leitura de PDF Financeiro com Gemini API

## Visão Geral do Fluxo

```
PDF (browser)
  → extrai texto com pdfjs-dist
  → chama Gemini via SSE streaming (2 etapas)
  → recebe array JSON de transações
  → pós-processa e salva no banco
```

Nada passa servidor próprio. A chave do Gemini fica protegida numa Edge Function.
O PDF nunca sai do browser como arquivo — só o texto extraído (muito menor e sem CORS).

---

## Por que esse desenho

**Problema central:** PDFs de fatura têm ~380k chars em base64. Enviar isso ao Gemini
via `generateContent` (sem stream) demora 60–240s. O browser mata a conexão fetch()
depois de ~60s sem receber dados → tela preta.

**Solução:**
1. Extrair texto do PDF no browser com pdfjs-dist (~9k chars, 1s)
2. Usar `streamGenerateContent` (SSE) → Gemini envia chunks continuamente → fetch() nunca fica idle
3. A chave da API fica numa Edge Function (Supabase/Cloudflare) → nunca exposta no bundle

---

## Passo 1 — Proteger a chave Gemini com Edge Function

Crie uma Edge Function simples que lê a chave do ambiente e a devolve autenticada.

**Exemplo (Supabase Edge Function — Deno/TypeScript):**

```typescript
// supabase/functions/get-gemini-key/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  // Valide autenticação aqui (ex: checar header Authorization com seu anon key)
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return new Response(JSON.stringify({ error: 'não configurado' }), { status: 500 });
  return new Response(JSON.stringify({ key }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
```

**No painel do Supabase:** adicione `GEMINI_API_KEY` como secret da Edge Function.

**No browser, busca a chave assim:**
```javascript
async function buscarChaveGemini(supabaseUrl, supabaseAnonKey) {
  const res = await fetch(`${supabaseUrl}/functions/v1/get-gemini-key`, {
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    },
  });
  const data = await res.json();
  return data.key; // string com a API key
}
```

> Se preferir não usar Supabase, qualquer backend que leia uma env var e devolva a chave
> via JSON serve. O padrão é o mesmo.

---

## Passo 2 — Extrair texto do PDF no browser

Instale pdfjs-dist:
```bash
npm install pdfjs-dist
```

```javascript
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export async function extrairTextoPDF(file) {
  // file: File | Blob vindo de <input type="file">
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let texto = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map(item => item.str).join(' ') + '\n';
  }
  return texto; // texto puro, ~5–15k chars para faturas comuns
}
```

> **Limite:** PDFs baseados em imagem (scaneados) não têm texto selecionável
> e retornam string vazia. Informe o usuário nesse caso.

---

## Passo 3 — Chamar o Gemini via SSE streaming

Este é o núcleo. Use `streamGenerateContent?alt=sse` para receber chunks em tempo real.

```javascript
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE  = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`;

async function geminiCall(textoPDF, prompts, apiKey) {
  // prompts: array de strings — cada uma vira um { text: ... } separado
  const parts = [
    ...prompts.map(t => ({ text: t })),
    { text: `\n\nDOCUMENTO:\n${textoPDF}` },
  ];

  const res = await fetch(
    `${GEMINI_BASE}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,      // baixo = mais determinístico
          maxOutputTokens: 65536, // alto o suficiente para faturas longas
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);

  // Lê o stream SSE e acumula o texto completo
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer   = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // última linha pode estar incompleta

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      try {
        const chunk = JSON.parse(jsonStr);
        const text  = chunk?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        fullText += text;
      } catch (_) { /* chunk malformado — ignora */ }
    }
  }

  return fullText; // texto completo que o Gemini gerou
}
```

**Por que acumular manualmente:**
O Gemini SSE envia uma linha `data: { ...json... }` por chunk. Cada chunk contém
um pedaço do texto gerado. O buffer é necessário porque um chunk pode chegar
cortado na borda de um `read()`. A lógica de `lines.pop()` preserva esse resto.

---

## Passo 4 — Processar o PDF em 2 etapas de prompt

Separar em 2 etapas melhora muito a qualidade: a primeira é rápida e identifica o tipo
do documento; a segunda usa essas informações para extrair os dados com precisão.

```javascript
export async function processarPDF(textoPDF, apiKey, nomeConta, onProgress) {
  const texto = textoPDF.substring(0, 15000); // trunca para evitar exceder tokens

  // ── ETAPA 1: Identificar tipo do documento ───────────────────────────────
  onProgress?.('Identificando tipo do documento...');

  const promptIdentificacao = `Analise este documento financeiro e retorne APENAS um JSON (sem markdown):
{"tipo":"fatura","vencimento":"YYYY-MM-DD","fechamento":"YYYY-MM-DD","anoDocumento":2026}
ou
{"tipo":"extrato","vencimento":null,"fechamento":null,"anoDocumento":2026}

Regras:
- tipo: "fatura" para fatura de cartão de crédito; "extrato" para extrato bancário
- vencimento: data de vencimento da fatura (apenas faturas)
- fechamento: data de corte/fechamento (apenas faturas)
- anoDocumento: ano principal dos lançamentos`;

  const idTexto = await geminiCall(texto, [promptIdentificacao], apiKey);
  const tipoInfo = extrairJSON(idTexto); // ver Passo 5

  const isFatura = tipoInfo.tipo === 'fatura';
  const anoDoc   = tipoInfo.anoDocumento || new Date().getFullYear();
  const vencStr  = tipoInfo.vencimento ?? '';
  const vencMes  = vencStr ? Number(vencStr.split('-')[1]) : 0;

  // Competência da fatura = mês do VENCIMENTO (não da compra)
  const compFatura = isFatura && vencStr ? vencStr.substring(0, 7) : '';

  // ── ETAPA 2: Extrair todos os lançamentos ────────────────────────────────
  onProgress?.('Extraindo lançamentos...');

  // O prompt varia conforme o tipo identificado na Etapa 1
  const promptExtracao = isFatura
    ? promptFatura(anoDoc, vencMes, vencStr) // ver seção de prompts abaixo
    : promptExtrato(anoDoc);

  const parseTexto = await geminiCall(texto, [promptExtracao], apiKey);
  const lista = extrairJSON(parseTexto); // array de transações brutas

  // ── ETAPA 3: Pós-processar ───────────────────────────────────────────────
  onProgress?.('Processando...');
  const transacoes = posProcessar(lista, isFatura, vencStr, compFatura, anoDoc, nomeConta);

  return { ok: true, tipoDoc: isFatura ? 'fatura' : 'extrato', compFatura, transacoes };
}
```

---

## Passo 5 — Extrair JSON da resposta do Gemini

O Gemini às vezes envolve o JSON em blocos de código markdown. Esta função limpa isso:

```javascript
function extrairJSON(texto) {
  const limpo = texto
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Tenta encontrar array
  const mArr = limpo.match(/\[[\s\S]*\]/);
  if (mArr) { try { return JSON.parse(mArr[0]); } catch (_) {} }

  // Tenta encontrar objeto
  const mObj = limpo.match(/\{[\s\S]*\}/);
  if (mObj) { try { return JSON.parse(mObj[0]); } catch (_) {} }

  throw new Error(`Gemini não retornou JSON válido. Amostra: ${limpo.substring(0, 200)}`);
}
```

---

## Passo 6 — Prompts de extração

### Para fatura de cartão:

```javascript
function promptFatura(anoDoc, vencMes, vencStr) {
  return `Extraia TODOS os lançamentos desta fatura de cartão de crédito.
Vencimento: ${vencStr} | Ano principal: ${anoDoc}

REGRAS:
1. VALOR: sempre NEGATIVO (despesa). Estornos/créditos: POSITIVO.
2. DATA DE COMPRA: use a data real da compra (YYYY-MM-DD).
   - Mês da compra <= mês do vencimento (${vencMes}): ano ${anoDoc}
   - Mês da compra >  mês do vencimento (${vencMes}): ano ${anoDoc - 1}
3. FORMATO: sempre "Credito".
4. DESCRICAO: copie exatamente como aparece na fatura.
5. CATEGORIAS: escolha a mais adequada para o seu sistema (adapte esta lista).
6. PARCELAS: "PARC 3/12" → parcelaAtual=3, parcelaTotal=12. Sem parcela → 1/1.

Retorne APENAS o array JSON, sem nenhum texto adicional:
[
  {
    "descricao": "iFood *Restaurante X",
    "valor": -45.90,
    "data": "${anoDoc}-02-05",
    "categoria": "alimentacao_fora",
    "formato": "Credito",
    "parcelaAtual": 1,
    "parcelaTotal": 1
  }
]`;
}
```

### Para extrato bancário:

```javascript
function promptExtrato(anoDoc) {
  return `Extraia TODOS os lançamentos deste extrato bancário.

REGRAS:
1. VALOR: NEGATIVO para débitos/saídas, POSITIVO para créditos/entradas.
2. DATA: data de cada lançamento (YYYY-MM-DD). Ano=${anoDoc}.
3. FORMATO: "Pix" | "Debito" | "Dinheiro" | "Boleto" — use o mais adequado.
4. DESCRICAO: copie exatamente como aparece no extrato.
5. CATEGORIAS: escolha a mais adequada para o seu sistema.
6. PARCELAS: parcelaAtual=1, parcelaTotal=1 para todas.

Retorne APENAS o array JSON, sem nenhum texto adicional:
[
  {
    "descricao": "iFood *Restaurante X",
    "valor": -45.90,
    "data": "${anoDoc}-03-05",
    "categoria": "alimentacao_fora",
    "formato": "Pix",
    "parcelaAtual": 1,
    "parcelaTotal": 1
  }
]`;
}
```

**Dica crítica nos prompts:**
- Diga "Retorne APENAS o array JSON" — sem isso o Gemini adiciona texto antes/depois
- Para faturas, explique a regra do ano das compras (compras de dezembro numa fatura de março pertencem ao ano anterior)
- `temperature: 0.1` é essencial — evita criatividade indesejada em dados financeiros

---

## Passo 7 — Pós-processar as transações

Aqui você normaliza a resposta do Gemini para o formato do seu banco:

```javascript
function posProcessar(lista, isFatura, vencStr, compFatura, anoDoc, nomeConta) {
  const hoje = new Date().toISOString().substring(0, 10);

  return lista
    .filter(t => t?.descricao && t?.valor != null) // remove linhas inválidas
    .map(t => {
      const valorRaw = Number(t.valor);
      const tipo     = valorRaw < 0 ? 'despesa' : 'receita';
      const valor    = Math.abs(valorRaw);
      let   data     = String(t.data ?? hoje).substring(0, 10);

      // Segurança: se Gemini errou o ano e a data ficou posterior ao vencimento
      if (isFatura && vencStr && data > vencStr) {
        const [dAno, dMes, dDia] = data.split('-');
        data = `${Number(dAno) - 1}-${dMes}-${dDia}`;
      }

      // Competência = mês de referência da transação no sistema
      // Para faturas: sempre o mês do vencimento (independente da data da compra)
      // Para extratos: mês da própria transação
      const competencia = (isFatura && compFatura)
        ? compFatura
        : data.substring(0, 7); // "YYYY-MM"

      const parcelaAtual  = Number(t.parcelaAtual ?? 1) || 1;
      const parcelaTotal  = Number(t.parcelaTotal ?? 1) || 1;
      const parcelasRestantes = Math.max(1, parcelaTotal - parcelaAtual + 1);

      return {
        id:                crypto.randomUUID(),
        descricao:         String(t.descricao).trim(),
        valor:             tipo === 'despesa' ? -valor : valor,
        data,                        // data real da compra/lançamento
        competencia,                 // "YYYY-MM" — mês de referência no sistema
        categoria:         t.categoria ?? 'outros',
        formato:           normalizarFormato(t.formato, isFatura),
        tipo,                        // "despesa" | "receita"
        parcelaAtual,
        parcelaTotal,
        parcelasRestantes,
        conta:             nomeConta ?? 'Importado',
        status:            'pendente', // aguarda revisão do usuário
      };
    });
}

function normalizarFormato(formato, isFatura) {
  if (isFatura) return 'cartao_credito';
  const f = (formato ?? '').toLowerCase();
  if (f.includes('pix') || f.includes('transfer') || f.includes('ted') || f.includes('doc')) return 'pix';
  if (f.includes('debito')) return 'cartao_debito';
  if (f.includes('dinheiro') || f.includes('saque')) return 'dinheiro';
  if (f.includes('boleto')) return 'boleto';
  return 'pix'; // fallback seguro
}
```

---

## Passo 8 — Salvar no banco de dados

As transações chegam com `status: 'pendente'`. O padrão é mostrar ao usuário
para revisão antes de confirmar — o Gemini erra eventualmente.

### Estrutura mínima da tabela de transações (SQL):

```sql
CREATE TABLE transacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao   TEXT        NOT NULL,
  valor       NUMERIC     NOT NULL,   -- negativo = despesa, positivo = receita
  data        DATE        NOT NULL,   -- data real do lançamento
  competencia TEXT        NOT NULL,   -- 'YYYY-MM' — período de referência
  categoria   TEXT,
  formato     TEXT,                   -- pix | cartao_credito | cartao_debito | dinheiro | boleto
  tipo        TEXT,                   -- despesa | receita
  parcela_atual    INT DEFAULT 1,
  parcela_total    INT DEFAULT 1,
  parcelas_restantes INT DEFAULT 1,
  conta       TEXT,
  status      TEXT DEFAULT 'pendente', -- pendente | confirmado | ignorado
  cliente_id  UUID REFERENCES clientes(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Inserir via Supabase JS:

```javascript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function salvarTransacoes(transacoes, clienteId) {
  const rows = transacoes.map(t => ({
    ...t,
    cliente_id: clienteId,
  }));

  const { error } = await supabase
    .from('transacoes')
    .insert(rows);

  if (error) throw new Error(`Erro ao salvar: ${error.message}`);
}
```

> O campo `status: 'pendente'` é fundamental. Nunca salve diretamente como
> confirmado — sempre permita que o usuário revise antes de confirmar.

---

## Armadilhas comuns e como evitar

| Problema | Causa | Solução |
|---|---|---|
| Tela preta / timeout | `generateContent` sem stream demora >60s | Usar `streamGenerateContent?alt=sse` |
| JSON cortado | `maxOutputTokens` muito baixo | Usar 65536 para extração; 512 para identificação |
| Erro de CORS | File Upload API do Gemini bloqueada | Nunca usar File API — enviar texto puro |
| PDF sem texto | PDF é imagem escaneada | Detectar string vazia e informar usuário |
| Ano errado nas parcelas | Fatura de março com compras de dezembro | Checar: se mês da compra > mês vencimento → ano anterior |
| Gemini envolve JSON em ```markdown``` | Comportamento padrão do modelo | Limpar ` ```json ` antes de JSON.parse |
| `generateContent` timeout em extração | Resposta longa (>300 itens) demora >60s | Usar streaming também na extração |
| Chave exposta no bundle | API key hardcoded no frontend | Sempre buscar via Edge Function |

---

## Checklist de implementação

- [ ] Edge Function criada com `GEMINI_API_KEY` como secret (nunca hardcoded)
- [ ] pdfjs-dist instalado; worker configurado para o bundler correto (Vite/Webpack)
- [ ] Extração de texto testada: fatura Nubank, Itaú, BB — verificar se retorna >100 chars
- [ ] Etapa 1 (identificação) usa `generateContent` simples — rápido, sem stream
- [ ] Etapa 2 (extração) usa `streamGenerateContent?alt=sse` — obrigatório para evitar timeout
- [ ] Buffer SSE acumula linhas corretamente (lógica `lines.pop()`)
- [ ] `extrairJSON` limpa markdown antes de JSON.parse
- [ ] Pós-processamento corrige ano das compras em faturas
- [ ] Campo `competencia` separado da `data` de compra (essencial para faturas)
- [ ] Transações salvas com `status: 'pendente'` para revisão do usuário
- [ ] Tela de revisão permite ao usuário confirmar, editar ou ignorar cada item

---

## Fluxo resumido em código (chamada completa)

```javascript
// 1. Usuário seleciona um arquivo PDF
const file = event.target.files[0];

// 2. Extrai texto no browser
const textoPDF = await extrairTextoPDF(file);
if (textoPDF.length < 50) {
  alert('Este PDF não tem texto selecionável (pode ser escaneado).');
  return;
}

// 3. Busca chave Gemini via servidor (nunca exposta no frontend)
const apiKey = await buscarChaveGemini(SUPABASE_URL, SUPABASE_ANON_KEY);

// 4. Processa: identifica tipo + extrai lançamentos via SSE
const resultado = await processarPDF(
  textoPDF,
  apiKey,
  'Nubank',                         // nome da conta
  (msg) => setStatus(msg)           // callback de progresso para a UI
);

// 5. Mostra ao usuário para revisão
setTransacoesPendentes(resultado.transacoes);

// 6. Após revisão e confirmação do usuário:
await salvarTransacoes(transacoesConfirmadas, clienteId);
```
