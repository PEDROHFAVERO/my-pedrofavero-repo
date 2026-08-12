import 'dotenv/config';

// ─── Validate required env vars ───────────────────────────────────────────────
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENAI_API_KEY'];
const missing  = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`[config] Variáveis de ambiente ausentes: ${missing.join(', ')}`);
  console.error('[config] Copie .env.example para .env e preencha os valores.');
  process.exit(1);
}

export const config = {
  // Server
  port:    parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Supabase
  supabaseUrl:        process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,

  // OpenAI
  openaiApiKey:  process.env.OPENAI_API_KEY,
  openaiModel:   process.env.OPENAI_MODEL   || 'gpt-4o-mini',
  whisperModel:  process.env.WHISPER_MODEL  || 'whisper-1',

  // Webhook security
  webhookSecret: process.env.WEBHOOK_SECRET || '',

  // WhatsApp provider: "meta" | "evolution" | "zapi"
  waProvider: process.env.WA_PROVIDER || 'meta',

  // ─── META CLOUD API (principal) ───────────────────────────────────────────
  // Token de acesso permanente gerado no painel Meta Developers
  metaAccessToken:  process.env.META_ACCESS_TOKEN  || '',
  // Phone Number ID exibido na tela "Configuração da API" do Meta
  metaPhoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
  // Token de verificação do webhook (você define qualquer string)
  metaVerifyToken:  process.env.META_VERIFY_TOKEN  || 'b2if_verify_2025',
  // Versão da Graph API
  metaApiVersion:   process.env.META_API_VERSION   || 'v20.0',

  // ─── Evolution API (alternativa) ─────────────────────────────────────────
  evolutionApiUrl:  process.env.EVOLUTION_API_URL  || '',
  evolutionApiKey:  process.env.EVOLUTION_API_KEY  || '',
  evolutionInstance: process.env.EVOLUTION_INSTANCE || 'b2if',

  // ─── Z-API (alternativa) ─────────────────────────────────────────────────
  zapiInstanceId:   process.env.ZAPI_INSTANCE_ID   || '',
  zapiToken:        process.env.ZAPI_TOKEN          || '',
  zapiClientToken:  process.env.ZAPI_CLIENT_TOKEN   || '',
};
