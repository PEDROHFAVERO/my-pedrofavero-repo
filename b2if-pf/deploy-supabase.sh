#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
#  B2IF — Deploy Supabase (Edge Function + Migrations)
#  Requer: SUPABASE_ACCESS_TOKEN=sbp_xxx no ambiente ou como argumento
#
#  Uso:
#    SUPABASE_ACCESS_TOKEN=sbp_xxx ./deploy-supabase.sh
#  ou:
#    ./deploy-supabase.sh sbp_xxx
# ════════════════════════════════════════════════════════════════════════════
set -e

PROJECT_REF="mioppztwrhrbnkkhuubs"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pb3BwenR3cmhyYm5ra2h1dWJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDkwNDQ2NCwiZXhwIjoyMDkwNDgwNDY0fQ.Q1_oDPScxFobtrciksa8ytC9hJ_grJ8Hva9jJ_BRrx4"

# Aceitar token: argumento > env var > .env file
ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-$1}"
if [ -z "$ACCESS_TOKEN" ]; then
  ACCESS_TOKEN=$(grep "^SUPABASE_ACCESS_TOKEN=" .env 2>/dev/null | cut -d= -f2)
fi

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ SUPABASE_ACCESS_TOKEN não definido."
  echo ""
  echo "Obtenha em: https://supabase.com/dashboard/account/tokens"
  echo "Uso: SUPABASE_ACCESS_TOKEN=sbp_xxx ./deploy-supabase.sh"
  exit 1
fi

echo "🔧 Configurando Supabase CLI..."
export SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  PASSO 1 — Executando migrations via Management API"
echo "═══════════════════════════════════════════════════════"

run_sql() {
  local desc="$1"
  local sql="$2"
  echo ""
  echo "▶ $desc"
  RESULT=$(curl -s -X POST \
    "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$sql" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}")

  if echo "$RESULT" | grep -q '"error"'; then
    echo "  ⚠️  Resultado: $RESULT"
  else
    echo "  ✅ OK"
  fi
}

# Migration 1: transacoes_bot + contas_pagar
run_sql "Migration: append_transacao_bot RPC" "$(cat supabase/migrations/20260625_transacoes_bot_contas_pagar.sql)"

# Migration 2: cafe_consigo_mesmo
run_sql "Migration: cafe_estado + cafe_inicio em bot_sessions" "$(cat supabase/migrations/20260625_cafe_consigo_mesmo.sql)"

# Verificar se as colunas foram criadas
run_sql "Verificar: colunas cafe_estado + cafe_inicio" "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bot_sessions' AND column_name IN ('cafe_estado', 'cafe_inicio') ORDER BY column_name"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  PASSO 2 — Deploy Edge Function whatsapp-webhook v9.8"
echo "═══════════════════════════════════════════════════════"
echo ""

npx supabase functions deploy whatsapp-webhook \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  PASSO 3 — Health check"
echo "═══════════════════════════════════════════════════════"
echo ""

sleep 2
HEALTH=$(curl -s "https://${PROJECT_REF}.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=b2if_verify_2025&hub.challenge=HEALTH_OK")
if [ "$HEALTH" = "HEALTH_OK" ]; then
  echo "✅ Webhook respondendo (HEALTH_OK)"
else
  echo "❌ Webhook retornou: $HEALTH"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ Deploy Supabase concluído!"
echo "  📊 Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
echo "════════════════════════════════════════════════════════"
