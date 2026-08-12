# 🚀 Implantação do Bot WhatsApp — Supabase + Netlify

> Sem servidor EC2. Tudo roda em **Supabase Edge Functions** (serverless) + **Netlify** (frontend).

---

## 📋 Dados do projeto

| Item | Valor |
|------|-------|
| Supabase Project ID | `mioppztwrhrbnkkhuubs` |
| Phone Number ID (Meta) | `111838774685525` |
| WABA ID | `932587213096387` |
| Número WhatsApp | `+55 61 9929-0731` |
| Verify Token | `b2if_verify_2025` |
| Meta API Version | `v20.0` |

---

## ETAPA 1 — Rodar o SQL no Supabase

Acesse: https://supabase.com/dashboard/project/mioppztwrhrbnkkhuubs/sql/new

Cole e execute o arquivo `sql/bot_whatsapp_tables.sql` (já enviado anteriormente).

**Tabelas criadas:**
- `bot_sessions` — vincula telefone ↔ cliente ↔ assessor
- `bot_config` — configurações do bot por assessor
- `bot_lembretes` — lembretes automáticos
- `bot_messages` — histórico de mensagens
- `bot_alertas` — alertas de limite por categoria

---

## ETAPA 2 — Configurar Secrets no Supabase

Acesse: https://supabase.com/dashboard/project/mioppztwrhrbnkkhuubs/settings/functions

Clique em **"Add new secret"** e adicione **uma por vez**:

| Nome | Valor |
|------|-------|
| `META_ACCESS_TOKEN` | `EAAXZCsX495IIBROyTwZCaHxOSPZBjwGqZCupxkviPCR19...` (token completo) |
| `META_PHONE_NUMBER_ID` | `111838774685525` |
| `META_VERIFY_TOKEN` | `b2if_verify_2025` |
| `GEMINI_API_KEY` | sua chave gratuita do Google (instruções na seção abaixo) |

> ⚠️ `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente — não precisa adicionar.

### 🆓 Como obter a GEMINI_API_KEY (gratuito)

1. Acesse: https://aistudio.google.com
2. Clique em **"Get API Key"** no menu lateral esquerdo
3. Clique em **"Create API key"**
4. Selecione um projeto Google (ou clique em "Create a new project")
5. Copie a chave gerada — começa com `AIza...`
6. Cole como valor do secret `GEMINI_API_KEY` no Supabase

> 💡 Limites gratuitos do Gemini Flash: **1.500 requisições/dia** — suficiente para centenas de mensagens por dia sem nenhum custo.

---

## ETAPA 3 — Instalar a Supabase CLI

No terminal da sua máquina (Mac/Linux/Windows WSL):

```bash
# Mac
brew install supabase/tap/supabase

# Linux / WSL
curl -s https://raw.githubusercontent.com/supabase/supabase/master/install.sh | bash
# ou via npm:
npm install -g supabase
```

Verificar instalação:
```bash
supabase --version
```

---

## ETAPA 4 — Login e Link do projeto

```bash
# Login na Supabase CLI
supabase login
# → abrirá o navegador para autorizar

# Ir para a pasta do projeto
cd /caminho/para/b2if-pf

# Linkar com o projeto Supabase
supabase link --project-ref mioppztwrhrbnkkhuubs
# → pedirá a database password (a que você usa para acessar o banco)
```

---

## ETAPA 5 — Deploy das Edge Functions

```bash
# Na pasta b2if-pf/, executar:

# 1. Deploy do webhook (recebe mensagens da Meta)
supabase functions deploy whatsapp-webhook --no-verify-jwt

# 2. Deploy do sender (frontend envia mensagens)
supabase functions deploy whatsapp-send
```

> **`--no-verify-jwt` no webhook** é obrigatório pois a Meta não envia token JWT.

Após o deploy, as URLs serão:
```
https://mioppztwrhrbnkkhuubs.supabase.co/functions/v1/whatsapp-webhook
https://mioppztwrhrbnkkhuubs.supabase.co/functions/v1/whatsapp-send
```

---

## ETAPA 6 — Configurar Webhook na Meta

1. Acesse: https://developers.facebook.com → Seu app **B2IF IA**
2. No menu lateral: **WhatsApp → Configuração**
3. Na seção **Webhooks**, clique em **"Editar"** (ou "Configurar")
4. Preencha:
   - **URL do callback:** `https://mioppztwrhrbnkkhuubs.supabase.co/functions/v1/whatsapp-webhook`
   - **Token de verificação:** `b2if_verify_2025`
5. Clique em **"Verificar e salvar"**
   - A Meta fará um GET na URL — a Edge Function responderá com o challenge ✔
6. Após salvar, **assine os campos:**
   - ✅ `messages`
   - ✅ `message_deliveries` (opcional)
   - ✅ `message_reads` (opcional)

---

## ETAPA 7 — Testar o webhook

No painel da Meta, na mesma seção de Webhooks:
1. Clique em **"Testar"** ao lado de `messages`
2. Isso envia um payload de teste para sua Edge Function
3. Verifique os logs em: https://supabase.com/dashboard/project/mioppztwrhrbnkkhuubs/functions

---

## ETAPA 8 — Adicionar número permanente

O token atual é **temporário (24h)**. Para gerar um **token permanente**:

1. No painel Meta: **WhatsApp → Configuração da API**
2. Role até **"Token de acesso do sistema"**
3. Clique em **"Gerar token"** → selecione **"Nunca expirar"**
4. Atualize o secret `META_ACCESS_TOKEN` no Supabase com o novo token

---

## ETAPA 9 — Vincular cliente ao número WhatsApp (na tela do sistema)

1. Faça login no B2IF (planfinb2pessoal.netlify.app)
2. Selecione um cliente
3. Acesse **Bot WhatsApp** no menu lateral
4. Na aba **Conexão**: informe o número WhatsApp do cliente
5. Clique em **Vincular**
   - Isso cria um registro em `bot_sessions` vinculando telefone → cliente → assessor

---

## ETAPA 10 — Teste completo

Envie uma mensagem de qualquer número **vinculado** para `+55 61 9929-0731`:

```
Almoço 45
```

O bot deve responder:
```
📤 Saída registrada!
📝 Almoço
💰 R$ 45,00
📅 hoje
🏷️ alimentacao

Visível no Fluxo Financeiro do B2IF
```

E a transação aparecerá no **Fluxo Financeiro** do cliente com ícone 📱.

---

## 🔧 Estrutura de arquivos

```
supabase/
  functions/
    whatsapp-webhook/
      index.ts          ← Edge Function principal (webhook)
    whatsapp-send/
      index.ts          ← Edge Function de envio (frontend → Meta)

sql/
  bot_whatsapp_tables.sql  ← Migration das tabelas
```

---

## 📊 Fluxo de dados

```
Cliente WhatsApp
      │
      ▼
Meta Cloud API
      │  POST
      ▼
Supabase Edge Function: whatsapp-webhook
      │
      ├─► Busca sessão (bot_sessions)
      ├─► Salva mensagem (bot_messages)
      ├─► Gemini Flash (parseia texto/imagem/áudio — gratuito)
      ├─► Salva transação (transacoes)
      └─► Responde via Meta Graph API
```

---

## ❓ Dúvidas comuns

**P: O webhook não verificou (erro 403)?**
R: Confirme que `META_VERIFY_TOKEN` no Supabase é exatamente `b2if_verify_2025`.

**P: As mensagens chegam mas não aparecem no sistema?**
R: Verifique se o número está vinculado em `bot_sessions` com `ativo = true`.

**P: O token expirou?**
R: Gere um token permanente (Etapa 8) e atualize o secret no Supabase.

**P: Erro "Function not found"?**
R: Rode `supabase functions deploy whatsapp-webhook --no-verify-jwt` novamente.
