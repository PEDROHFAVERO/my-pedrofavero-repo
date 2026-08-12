# B2IF — Guia de Implantação na EC2

> **Objetivo:** Hospedar o gateway do Bot WhatsApp (`b2if-whatsapp`) em uma instância EC2 da AWS.  
> O frontend (B2IF Desktop) continua hospedado no Netlify — apenas o servidor Node.js vai para a EC2.

---

## Arquitetura

```
Cliente WhatsApp
      │
      ▼
Meta Cloud API
      │  webhook POST
      ▼
EC2 (b2if-whatsapp — Node.js :3001)
      │
      ├── Supabase (banco de dados)
      └── OpenAI (IA — parsing de texto/foto/áudio/PDF)
```

---

## Pré-requisitos

| Item | Mínimo recomendado |
|------|--------------------|
| EC2 | t3.micro (1 vCPU, 1 GB RAM) |
| OS | Ubuntu 22.04 LTS |
| Node.js | v20+ |
| Porta liberada | 3001 (ou 443 com HTTPS) |
| Domínio ou IP público | Necessário para o webhook da Meta |

---

## 1. Preparar a EC2

### 1.1 Conectar na instância
```bash
ssh -i sua-chave.pem ubuntu@SEU_IP_EC2
```

### 1.2 Atualizar o sistema
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Instalar Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # deve mostrar v20.x
npm -v
```

### 1.4 Instalar PM2 (gerenciador de processos)
```bash
sudo npm install -g pm2
```

### 1.5 Instalar Git
```bash
sudo apt install -y git
```

---

## 2. Subir o código na EC2

### Opção A — Via Git (recomendado)
```bash
cd /home/ubuntu
git clone https://github.com/PEDROHFAVERO/my-pedrofavero-repo.git b2if
cd b2if/b2if-pf/b2if-whatsapp
npm install
```

### Opção B — Via upload manual
Copie a pasta `b2if-whatsapp` para a EC2:
```bash
# No seu computador local:
scp -i sua-chave.pem -r ./b2if-whatsapp ubuntu@SEU_IP_EC2:/home/ubuntu/
```

---

## 3. Configurar variáveis de ambiente

```bash
cd /home/ubuntu/b2if/b2if-pf/b2if-whatsapp   # ou o caminho que você usou
cp .env.example .env
nano .env
```

Preencha o arquivo `.env` com os valores reais:

```env
# ── Supabase ──────────────────────────────────────────────────
SUPABASE_URL=https://mioppztwrhrbnkkhuubs.supabase.co
SUPABASE_SERVICE_KEY=SEU_SERVICE_KEY_DO_SUPABASE

# ── OpenAI ────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── WhatsApp (Meta Cloud API) ─────────────────────────────────
WA_PROVIDER=meta
META_PHONE_NUMBER_ID=SEU_PHONE_NUMBER_ID
META_ACCESS_TOKEN=SEU_TOKEN_DE_ACESSO
META_VERIFY_TOKEN=b2if_webhook_2026

# ── Webhook ───────────────────────────────────────────────────
WEBHOOK_SECRET=escolha_uma_senha_forte_aqui

# ── Servidor ──────────────────────────────────────────────────
PORT=3001
NODE_ENV=production
```

> **Onde encontrar o SUPABASE_SERVICE_KEY:**  
> Supabase → Project Settings → API → `service_role` (secret)

> **Onde encontrar META_PHONE_NUMBER_ID e META_ACCESS_TOKEN:**  
> Meta Developers → seu app → WhatsApp → Configuração da API

---

## 4. Iniciar o servidor com PM2

```bash
cd /home/ubuntu/b2if/b2if-pf/b2if-whatsapp

# Iniciar
pm2 start src/server.js --name "b2if-whatsapp" --interpreter node

# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs b2if-whatsapp

# Configurar para iniciar automaticamente após reboot
pm2 startup
pm2 save
```

### Verificar se está rodando
```bash
curl http://localhost:3001
```
Deve retornar:
```json
{
  "name": "B2IF WhatsApp Gateway",
  "status": "running"
}
```

---

## 5. Liberar porta no Security Group da EC2

No painel da AWS:
1. EC2 → Instances → selecione sua instância
2. Clique na aba **Security**
3. Clique no Security Group
4. **Inbound rules** → **Edit inbound rules**
5. Adicione a regra:

| Type | Protocol | Port | Source |
|------|----------|------|--------|
| Custom TCP | TCP | 3001 | 0.0.0.0/0 |

> **Recomendado para produção:** use HTTPS na porta 443 com Nginx como proxy reverso (ver seção 7).

---

## 6. Configurar o Webhook na Meta

Com o servidor rodando e a porta aberta, configure o webhook:

1. Meta Developers → seu app **B2IF IA** → **WhatsApp** → **Configuração**
2. Na seção **Webhooks**, clique em **Configurar webhooks**
3. Preencha:
   - **URL do callback:** `http://SEU_IP_EC2:3001/webhook`
   - **Token de verificação:** `b2if_webhook_2026` *(o mesmo do .env META_VERIFY_TOKEN)*
4. Clique **Verificar e salvar**
5. Assine os eventos: `messages`

> A Meta vai fazer um GET no seu webhook para verificar — o servidor responde automaticamente.

---

## 7. HTTPS com Nginx (recomendado para produção)

A Meta **exige HTTPS** para webhooks em produção. Configure assim:

### 7.1 Instalar Nginx e Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 7.2 Criar configuração do Nginx
```bash
sudo nano /etc/nginx/sites-available/b2if
```

Cole:
```nginx
server {
    listen 80;
    server_name SEU_DOMINIO.com.br;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/b2if /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7.3 Gerar certificado SSL gratuito
```bash
sudo certbot --nginx -d SEU_DOMINIO.com.br
```

Após isso, o webhook será:
```
https://SEU_DOMINIO.com.br/webhook
```

---

## 8. Adicionar o número do WhatsApp

Na Meta, adicione o número do eSIM:

1. Meta Developers → WhatsApp → **Configuração da API**
2. Etapa 5: **Adicionar telefone**
3. Número: `+55 61 99929 0731`
4. Verificação por SMS ou ligação

---

## 9. Variáveis de ambiente — resumo completo

| Variável | Onde obter |
|----------|-----------|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → service_role |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `META_PHONE_NUMBER_ID` | Meta → WhatsApp → Configuração da API |
| `META_ACCESS_TOKEN` | Meta → WhatsApp → Configuração da API → Gerar token |
| `META_VERIFY_TOKEN` | Você define (qualquer string) |
| `WEBHOOK_SECRET` | Você define (senha forte) |

---

## 10. Comandos úteis do dia a dia

```bash
# Ver logs
pm2 logs b2if-whatsapp

# Reiniciar após atualização
pm2 restart b2if-whatsapp

# Parar
pm2 stop b2if-whatsapp

# Atualizar código
cd /home/ubuntu/b2if
git pull origin main
cd b2if-pf/b2if-whatsapp
npm install
pm2 restart b2if-whatsapp

# Ver uso de memória/CPU
pm2 monit
```

---

## 11. Checklist final

- [ ] EC2 rodando com Node.js 20 instalado
- [ ] Código do `b2if-whatsapp` na EC2
- [ ] Arquivo `.env` preenchido com todas as variáveis
- [ ] PM2 rodando: `pm2 status` mostra `online`
- [ ] Porta 3001 liberada no Security Group (ou 443 com Nginx)
- [ ] Webhook configurado e verificado na Meta
- [ ] Número `+55 61 99929 0731` adicionado na Meta
- [ ] Token de acesso gerado na Meta
- [ ] Teste: enviar mensagem no WhatsApp e verificar nos logs da EC2

---

## Suporte

Qualquer erro durante a implantação, verifique primeiro os logs:
```bash
pm2 logs b2if-whatsapp --lines 50
```

E confira se todas as variáveis do `.env` estão preenchidas corretamente.
