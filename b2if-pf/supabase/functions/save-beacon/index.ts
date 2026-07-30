/**
 * save-beacon v1.0 — Endpoint para navigator.sendBeacon()
 *
 * PROBLEMA RESOLVIDO:
 *   navigator.sendBeacon() é a única API garantida de completar mesmo quando
 *   o usuário fecha a aba. O fetch() normal pode ser cancelado pelo browser.
 *   Porém, sendBeacon() só aceita text/plain, application/x-www-form-urlencoded
 *   ou FormData — não aceita JSON com Authorization header.
 *
 * SOLUÇÃO:
 *   Esta Edge Function recebe um POST com Content-Type text/plain contendo
 *   JSON no body. O token de autenticação vai no body (não no header),
 *   pois sendBeacon não permite headers customizados.
 *
 * PAYLOAD esperado (JSON serializado em text/plain):
 * {
 *   token:        string,   // Supabase JWT (anon ou service key)
 *   clienteId:    string,
 *   planejadorId: string,
 *   workspaceId:  string,
 *   dados:        object,   // dados completos do cliente
 *   hash:         string,   // SHA-256 dos dados
 *   autorTipo:    string,   // 'planejador' | 'cliente' | 'manager'
 *   autorId:      string,
 *   autorNome:    string,
 *   motivo:       string,   // 'fechamento' | 'auto'
 *   resumo:       object,
 * }
 *
 * RESPOSTA: 200 OK sempre (sendBeacon ignora a resposta, mas boa prática)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    // sendBeacon envia text/plain — parsear body como texto
    const raw = await req.text();
    if (!raw?.trim()) {
      return new Response(JSON.stringify({ ok: false, error: 'body vazio' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let payload: {
      token:        string;
      clienteId:    string;
      planejadorId: string;
      workspaceId:  string;
      dados:        Record<string, unknown>;
      hash:         string;
      autorTipo:    string;
      autorId:      string;
      autorNome:    string;
      motivo:       string;
      resumo:       Record<string, unknown>;
    };

    try {
      payload = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const {
      token, clienteId, planejadorId, workspaceId,
      dados, hash, autorTipo, autorId, autorNome, motivo, resumo,
    } = payload;

    if (!clienteId || !planejadorId || !dados || !hash) {
      return new Response(JSON.stringify({ ok: false, error: 'campos obrigatórios faltando' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Usar service_role para garantir que o save sempre funciona
    // mesmo que o token do usuário já tenha expirado (aba aberta há muito tempo)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // ── 1. Salvar o cliente (upsert principal — resolve o problema da Eduarda) ──
    // Fazer merge de transacoesBot antes de salvar (mesma lógica do clienteService.js)
    let dadosFinal = { ...dados };
    try {
      const { data: atual } = await supabase
        .from('clientes')
        .select('dados->transacoesBot')
        .eq('id', clienteId)
        .maybeSingle();

      if (atual?.transacoesBot && Array.isArray(atual.transacoesBot)) {
        const dosBanco = atual.transacoesBot as Array<{ id: string }>;
        const doEstado = (dados.transacoesBot as Array<{ id: string }>)  ?? [];
        const mapaFinal = new Map(dosBanco.map(t => [t.id, t]));
        for (const t of doEstado) mapaFinal.set(t.id, t);
        dadosFinal = { ...dadosFinal, transacoesBot: Array.from(mapaFinal.values()) };
      }
    } catch { /* não bloqueia */ }

    const { error: saveError } = await supabase
      .from('clientes')
      .upsert(
        { id: clienteId, planejador_id: planejadorId, dados: dadosFinal },
        { onConflict: 'id' }
      );

    if (saveError) {
      console.error('[save-beacon] Erro ao salvar cliente:', saveError);
      // Não retorna erro — tenta salvar a versão mesmo assim
    }

    // ── 2. Criar snapshot na tabela de versões ──────────────────────────────
    const { error: versaoError } = await supabase.rpc('criar_versao_cliente', {
      p_cliente_id:    clienteId,
      p_planejador_id: planejadorId,
      p_workspace_id:  workspaceId || null,
      p_dados:         dadosFinal,
      p_hash:          hash,
      p_autor_tipo:    autorTipo || 'planejador',
      p_autor_id:      autorId   || null,
      p_autor_nome:    autorNome || 'Sistema',
      p_motivo:        motivo    || 'fechamento',
      p_titulo:        null,
      p_resumo:        resumo    || {},
      p_ttl_dias:      90,
    });

    if (versaoError) {
      console.error('[save-beacon] Erro ao criar versão:', versaoError);
    }

    return new Response(
      JSON.stringify({ ok: true, motivo }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[save-beacon] Erro inesperado:', err);
    // Retorna 200 mesmo em erro — sendBeacon não processa a resposta
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
