# B2IF WhatsApp Gateway

Microsserviço Node.js que recebe mensagens do WhatsApp (texto, foto, áudio e PDF) e insere transações financeiras no banco de dados do B2IF.

---

## Arquitetura

```
WhatsApp (cliente)
        │
        ▼ webhook
Evolution API / Z-API
        │
        ▼ POST /webhook
B2IF WhatsApp Gateway (este serviço)
        │
        ├── Texto   → GPT-4o-mini extrai { valor, descrição, categoria, data }
        ├── Imagem  → GPT-4o-mini Vision lê comprovante
        ├── Áudio   → Whisper transcreve → GPT parseia
        └── PDF     → pdf-parse extrai texto → GPT lista transações
        │
        ▼ fingerprint + deduplicação
Supabase (tabelas: transacoes, transacoes_raw, whatsapp_sessions)
        │
        ▼ sync
B2IF Desktop (lê as mesmas tabelas)
```

---

## Setup rápido

### 1. Pré-requisitos
- Node.js 18+
- Conta Supabase com as tabelas criadas (ver `sql/001_whatsapp_tables.sql`)
- API key OpenAI (GPT-4o-mini + Whisper)
- Evolution API ou Z-API configurado

### 2. Instalação

```bash
cd b2if-whatsapp
npm install
cp .env.example .env
# Edite .env com suas credenciais
```

### 3. Banco de dados

Execute o script SQL no Supabase SQL Editor:

```sql
-- Conteúdo de sql/001_whatsapp_tables.sql
```

### 4. Iniciar o servidor

```bash
# Desenvolvimento (com auto-reload)
npm run dev

# Produção
npm start
```

O servidor inicia na porta `3001` (configurável via `PORT`).

---

## Configuração do Webhook

### Evolution API

No painel da Evolution API, configure:
```
Webhook URL: https://seu-servidor.com/webhook
Events: messages.upsert
Header: apikey: <sua-chave>
```

No `.env`:
```
WA_PROVIDER=evolution
EVOLUTION_API_URL=https://sua-evolution.com
EVOLUTION_API_KEY=sua-chave
EVOLUTION_INSTANCE=b2if
WEBHOOK_SECRET=seu-token-secreto
```

### Z-API

No painel da Z-API, configure:
```
Webhook URL: https://seu-servidor.com/webhook?token=seu-token-secreto
```

No `.env`:
```
WA_PROVIDER=zapi
ZAPI_INSTANCE_ID=seu-id
ZAPI_TOKEN=seu-token
ZAPI_CLIENT_TOKEN=seu-client-token
```

---

## Vincular clientes

Antes de receber mensagens, vincule o número do cliente ao ID do B2IF:

```bash
curl -X POST https://seu-servidor.com/api/sessions \
  -H "Authorization: Bearer <SUPABASE_SERVICE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "telefone": "5511999990000",
    "clienteId": "uuid-do-cliente-no-b2if",
    "nomeCliente": "João Silva"
  }'
```

---

## Comandos do cliente no WhatsApp

| Mensagem | Ação |
|---|---|
| `Almoço 45` | Registra despesa R$45 em Alimentação |
| `Salário 3200` | Registra receita R$3.200 |
| `Farmácia R$32,50 débito` | Registra com conta e formato |
| 📸 (foto do comprovante) | OCR + extração automática |
| 🎙️ (áudio) | Transcrição + extração automática |
| 📄 (PDF do extrato) | Importação em lote com deduplicação |
| `resumo` | Resumo dos gastos dos últimos 7 dias |
| `ajuda` | Exibe este menu |

---

## Deduplicação

Cada transação recebe um **fingerprint** SHA-256 baseado em:
- `cliente_id`
- Valor (em centavos, sem sinal)
- Data (YYYY-MM-DD)
- Primeiras 3 palavras da descrição normalizada

Antes de inserir, o sistema verifica se existe uma transação com o mesmo fingerprint nas últimas **48 horas**. Se sim, a inserção é ignorada e o cliente é notificado.

---

## Estrutura do projeto

```
b2if-whatsapp/
├── config/
│   └── index.js           # Configurações e validação de env vars
├── sql/
│   └── 001_whatsapp_tables.sql  # Script de criação das tabelas
├── src/
│   ├── server.js           # Express + rotas
│   ├── routes/
│   │   ├── webhook.js      # Recebe eventos WhatsApp
│   │   ├── sessions.js     # CRUD de vínculos telefone ↔ cliente
│   │   └── ingest.js       # Ingestão manual via API
│   ├── services/
│   │   ├── aiService.js    # GPT-4o-mini + Whisper
│   │   ├── ingestService.js # Motor de ingestão + deduplicação
│   │   ├── sessionService.js # Gerência de sessões
│   │   └── whatsappSender.js # Envio de mensagens de retorno
│   ├── utils/
│   │   ├── supabase.js     # Cliente Supabase (service role)
│   │   ├── fingerprint.js  # Geração e verificação de fingerprints
│   │   ├── categorias.js   # Mapa de categorias B2IF
│   │   └── downloadMedia.js # Download de mídia do WA
│   └── middleware/
│       └── auth.js         # Validação de tokens
├── .env.example
├── package.json
└── README.md
```

---

## Deploy recomendado

- **Railway / Render / Fly.io** – Plataformas com suporte a Node.js, fáceis de configurar com variáveis de ambiente.
- **VPS própria** – Ubuntu 22.04 + PM2 + Nginx como proxy reverso.
- **Docker** – Use o `Dockerfile` (a criar) para containerizar.

Certifique-se de que o servidor tenha um endereço HTTPS público para que o webhook funcione.
