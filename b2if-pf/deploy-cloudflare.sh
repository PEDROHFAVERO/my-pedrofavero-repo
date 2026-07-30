#!/bin/bash
set -e

# Carrega variáveis de ambiente (incluindo CLOUDFLARE_API_TOKEN do .env)
source "$(dirname "$0")/.env" 2>/dev/null || true

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN não definido. Adicione ao seu .env"
  exit 1
fi

echo "🏗️  Buildando..."
npm run build

echo "🚀 Fazendo deploy na Cloudflare Pages..."
npx wrangler pages deploy dist \
  --project-name b2if-pf \
  --branch main \
  --commit-dirty=true

echo ""
echo "✅ Deploy concluído!"
echo "🔗 URL: https://b2if-pf.pages.dev"
