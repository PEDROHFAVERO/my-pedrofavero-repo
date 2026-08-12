/**
 * get-gemini-key v1.0
 * Retorna a GEMINI_API_KEY para o browser processar PDFs diretamente.
 * Requer header Authorization com anon key válida do Supabase.
 * Resposta em <500ms — sem limite de 60s.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, erro: 'GEMINI_API_KEY não configurado' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  return new Response(JSON.stringify({ ok: true, key: apiKey }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
});
