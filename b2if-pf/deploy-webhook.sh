#!/bin/bash
# Script de deploy do whatsapp-webhook
# Sempre usa --no-verify-jwt para que a Meta possa chamar sem Authorization header

set -e

echo "🚀 Deployando whatsapp-webhook..."

SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-$(grep SUPABASE_ACCESS_TOKEN .env 2>/dev/null | cut -d= -f2)}" \
  npx supabase functions deploy whatsapp-webhook \
    --project-ref mioppztwrhrbnkkhuubs \
    --no-verify-jwt

echo ""
echo "✅ Deploy concluído!"
echo "🔗 Dashboard: https://supabase.com/dashboard/project/mioppztwrhrbnkkhuubs/functions"
echo ""

# Teste rápido de saúde
echo "🧪 Testando webhook..."
RESULT=$(curl -s "https://mioppztwrhrbnkkhuubs.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=b2if_verify_2025&hub.challenge=HEALTH_OK")
if [ "$RESULT" = "HEALTH_OK" ]; then
  echo "✅ Webhook respondendo corretamente (sem auth header)"
else
  echo "❌ ERRO: webhook retornou: $RESULT"
  echo "   Verifique os logs: https://supabase.com/dashboard/project/mioppztwrhrbnkkhuubs/functions/whatsapp-webhook/logs"
fi
