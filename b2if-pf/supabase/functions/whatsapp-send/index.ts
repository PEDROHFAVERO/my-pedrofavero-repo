/**
 * whatsapp-send
 * Supabase Edge Function — envia mensagens WhatsApp via Meta Cloud API
 * Chamada pelo frontend (tela Bot WhatsApp → aba Mensagens)
 *
 * POST /functions/v1/whatsapp-send
 * Headers: Authorization: Bearer <supabase_anon_key>
 * Body: { "telefone": "5561999290731", "texto": "Mensagem aqui" }
 *
 * Secrets necessários (Supabase → Project Settings → Edge Functions):
 *   META_ACCESS_TOKEN     — token gerado na Meta
 *   META_PHONE_NUMBER_ID  — 111838774685525
 *   GEMINI_API_KEY        — chave gratuita em aistudio.google.com
 */

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const META_ACCESS_TOKEN    = Deno.env.get('META_ACCESS_TOKEN')    ?? '';
const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID') ?? '111838774685525';
const META_API_VERSION     = 'v20.0';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')         ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Autenticar o assessor via JWT do Supabase
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { telefone, texto } = body;

    if (!telefone || !texto) {
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos: telefone e texto são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar que o assessor tem sessão com esse telefone
    const { data: sessao } = await supabase
      .from('bot_sessions')
      .select('id')
      .eq('assessor_id', user.id)
      .eq('telefone', telefone)
      .maybeSingle();

    if (!sessao) {
      return new Response(JSON.stringify({ error: 'Sessão não encontrada para este número' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enviar via Meta Cloud API
    const metaRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type:    'individual',
          to:                telefone,
          type:              'text',
          text:              { preview_url: false, body: texto },
        }),
      }
    );

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`Meta API: HTTP ${metaRes.status} — ${errText}`);
    }

    const metaData = await metaRes.json();

    // Salvar mensagem enviada no histórico
    await supabase.from('bot_messages').insert({
      session_id: sessao.id,
      de:         `assessor:${user.id}`,
      tipo:       'text',
      conteudo:   texto,
      meta:       { wamid: metaData.messages?.[0]?.id },
      lida:       true,
    });

    return new Response(JSON.stringify({ ok: true, wamid: metaData.messages?.[0]?.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[whatsapp-send]', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
