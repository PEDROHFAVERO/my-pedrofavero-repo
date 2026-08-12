# Planejador PF — Guia de Onboarding White Label (Modelo C)

Este guia descreve o processo completo para implantar uma instância do **Planejador PF** para um novo cliente, com banco de dados, domínio e identidade visual próprios.

---

## Visão geral do Modelo C

Cada cliente recebe:
- **Projeto Supabase exclusivo** (dados isolados, banco próprio)
- **Deploy front-end dedicado** (Netlify / Vercel / Cloudflare Pages)
- **Domínio próprio** (ex: `pf.nomeEmpresa.com.br`)
- **Identidade visual customizada** (logo, cor da marca, nome do app)

Tempo estimado: **40–60 min** para o primeiro cliente; **15–20 min** a partir do segundo.

---

## Passo 1 — Criar o projeto Supabase do cliente (5 min)

1. Acesse [https://app.supabase.com](https://app.supabase.com) e crie uma nova organização (ou use a existente).
2. Clique em **New Project**.
3. Defina:
   - **Name**: nome do cliente (ex: `empresa-pf`)
   - **Database Password**: senha forte (salve em local seguro)
   - **Region**: a mais próxima do cliente (ex: São Paulo — `sa-east-1`)
4. Aguarde o projeto ser criado (~1–2 min).
5. Vá em **Settings → API** e anote:
   - **Project URL**: `https://XXXXXXXXXX.supabase.co`
   - **anon public key**: `eyJ...`
   - **Project ID**: `XXXXXXXXXX` (usado no CLI)

---

## Passo 2 — Executar o script SQL de setup (5 min)

1. No painel do projeto, vá em **SQL Editor → New Query**.
2. Cole o conteúdo de `setup_supabase.sql` (na raiz do repositório).
3. Clique em **Run**.
4. Confira a mensagem: `Setup concluído com sucesso!`

---

## Passo 3 — Criar o usuário Manager (5 min)

1. Vá em **Authentication → Users → Add User**.
2. Preencha:
   - **Email**: email do manager do cliente
   - **Password**: senha provisória (o manager poderá redefinir depois)
   - Marque **Auto Confirm User**
3. Anote o **UUID** gerado (coluna `ID`).
4. Volte ao **SQL Editor** e execute:

```sql
INSERT INTO public.planejadores (id, nome, email, role, ativo)
VALUES (
  'UUID_COPIADO_ACIMA',
  'Nome do Manager',
  'email@empresa.com',
  'manager',
  true
) ON CONFLICT (id) DO NOTHING;
```

---

## Passo 4 — Implantar a Edge Function (10 min)

```bash
# Instale o Supabase CLI (uma vez)
npm install -g supabase

# Autentique
supabase login

# Vincule ao projeto do cliente (use o Project ID do Passo 1)
supabase link --project-ref SEU_PROJECT_ID

# Faça o deploy da função
supabase functions deploy admin-cliente
```

Verifique em **Edge Functions** no painel do Supabase se `admin-cliente` aparece como **Active**.

---

## Passo 5 — Configurar a identidade visual (5 min)

1. Copie o arquivo de modelo:
   ```bash
   cp .env.example .env
   ```

2. Edite o `.env` com os dados do cliente:
   ```env
   VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...anon_key...

   VITE_APP_NAME=Empresa PF
   VITE_APP_SUBTITLE=Planejador Financeiro
   VITE_APP_COMPANY=Empresa Assessoria
   VITE_APP_TAGLINE=Sistema de Uso Interno

   VITE_BRAND_COLOR=#1A56DB
   VITE_LOGO_FILE=logo-empresa.png
   ```

3. Coloque o logo do cliente em `public/logo-empresa.png`
   - Formato: PNG ou SVG
   - Tamanho recomendado: 128×128 px ou maior (quadrado)

---

## Passo 6 — Gerar o build e fazer o deploy (10 min)

```bash
# Instale as dependências (uma vez por máquina)
npm install

# Gere o build de produção
npm run build

# A pasta dist/ contém os arquivos para deploy
```

### Deploy no Netlify

1. Acesse [https://app.netlify.com](https://app.netlify.com).
2. Clique em **Add New Site → Import an existing project** ou arraste a pasta `dist/`.
3. Configure o domínio personalizado em **Domain Management**.
4. Opcionalmente, configure as variáveis de ambiente diretamente no Netlify
   (**Site Settings → Environment Variables**) e ative o auto-deploy via GitHub.

### Deploy no Vercel

```bash
npm install -g vercel
vercel --prod
```

### Deploy no Cloudflare Pages

```bash
npm install -g wrangler
wrangler pages deploy dist
```

---

## Passo 7 — Verificação final (5 min)

- [ ] Acesse a URL do deploy e confirme que o logo e a cor da marca aparecem corretamente.
- [ ] Faça login com o usuário Manager criado no Passo 3.
- [ ] Crie um planejador de teste e verifique o fluxo completo.
- [ ] Confirme que o botão "Gerar PDF" funciona no Planejador.

---

## Resumo do tempo estimado

| Passo | Ação | Tempo |
|-------|------|-------|
| 1 | Criar projeto Supabase | 5 min |
| 2 | Executar setup_supabase.sql | 5 min |
| 3 | Criar usuário Manager | 5 min |
| 4 | Deploy Edge Function | 10 min |
| 5 | Configurar .env e logo | 5 min |
| 6 | Build + Deploy | 10 min |
| 7 | Verificação | 5 min |
| **Total** | | **~45 min** |

---

## Variáveis de ambiente — referência rápida

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Chave pública (anon) do Supabase |
| `VITE_APP_NAME` | ✅ | Nome exibido no header e no PDF |
| `VITE_APP_SUBTITLE` | ➖ | Subtítulo na tela de login |
| `VITE_APP_COMPANY` | ➖ | Nome da empresa (rodapé do login) |
| `VITE_APP_TAGLINE` | ➖ | Tagline (rodapé do login) |
| `VITE_BRAND_COLOR` | ➖ | Cor principal em hex (padrão: `#00B8A9`) |
| `VITE_LOGO_FILE` | ➖ | Nome do arquivo de logo em `/public` (padrão: `logo-light.png`) |

---

## Solução de problemas comuns

### "Usuário não encontrado no sistema"
→ O usuário foi criado em `auth.users` mas não foi inserido em `planejadores`. Execute o SQL do Passo 3.

### "Sem permissão" ao criar acesso de cliente
→ A Edge Function `admin-cliente` não foi implantada. Execute o Passo 4.

### Logo não aparece
→ Verifique se o arquivo está em `public/` com exatamente o nome definido em `VITE_LOGO_FILE`.

### Cor da marca não mudou
→ O build precisa ser refeito após alterar o `.env`: `npm run build`.

---

## Manutenção e atualizações

Para atualizar o sistema para um cliente existente:

```bash
# Atualize o código-fonte (git pull ou substitua os arquivos)
git pull origin main

# Refaça o build (o .env já está configurado)
npm run build

# Redistribua o deploy (Netlify/Vercel sincronizam automaticamente se conectados ao GitHub)
```

Se houver mudanças no banco de dados (novas tabelas, políticas), execute o SQL adicional no Editor do projeto Supabase do cliente.
