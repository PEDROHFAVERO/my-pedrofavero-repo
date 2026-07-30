/**
 * webhook.js
 * Recebe eventos do WhatsApp via Meta Cloud API, Evolution API ou Z-API
 * e roteia para o ingestService.
 *
 * Meta Cloud API:
 *   GET  /webhook  → verificação do webhook (hub.challenge)
 *   POST /webhook  → mensagens recebidas
 *
 * Evolution API:
 *   POST /webhook
 *   { event: "messages.upsert", data: { key: { remoteJid }, message: { ... } } }
 *
 * Z-API:
 *   POST /webhook
 *   { type: "ReceivedCallback", phone: "5511...", text: { message }, image: { ... }, ... }
 */
import { Router }          from 'express';
import { config }          from '../../config/index.js';
import { buscarSessao }    from '../services/sessionService.js';
import {
  processarTexto,
  processarImagem,
  processarAudio,
  processarPDF,
}                          from '../services/ingestService.js';
import { downloadMedia, detectarTipoMidia } from '../utils/downloadMedia.js';
import { enviarMensagem }  from '../services/whatsappSender.js';

const router = Router();

// ─── GET /webhook — Verificação do webhook Meta ────────────────────────────────
// A Meta faz um GET com ?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=yyy
// Devemos responder com hub.challenge se o token bater.
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.metaVerifyToken) {
    console.log('[webhook] Verificação Meta OK ✔');
    return res.status(200).send(challenge);
  }

  // Fallback: health check normal
  res.json({ status: 'ok', provider: config.waProvider, timestamp: new Date().toISOString() });
});

// ─── POST /webhook — Mensagens recebidas ──────────────────────────────────────
router.post('/', async (req, res) => {
  // Responde imediatamente para não causar retries
  res.status(200).json({ received: true });

  try {
    const body = req.body;

    if (config.waProvider === 'meta') {
      await handleMeta(body);
    } else if (config.waProvider === 'evolution') {
      await handleEvolution(body);
    } else {
      await handleZAPI(body);
    }
  } catch (err) {
    console.error('[webhook] Erro não tratado:', err.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// META CLOUD API HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
async function handleMeta(body) {
  // Estrutura: { object: "whatsapp_business_account", entry: [ { changes: [ { value: { messages: [...] } } ] } ] }
  if (body.object !== 'whatsapp_business_account') return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;

      const value    = change.value || {};
      const messages = value.messages || [];
      const contacts = value.contacts || [];

      for (const msg of messages) {
        // Ignora mensagens que não sejam recebidas do cliente
        if (msg.from === config.metaPhoneNumberId) continue;

        const telefone = normalizarTelefone(msg.from);
        if (!telefone) continue;

        const sessao = await buscarSessao(telefone);
        if (!sessao) {
          console.log(`[webhook/meta] Número sem sessão: ${telefone}`);
          await enviarMensagem(telefone,
            '👋 Seu número ainda não está vinculado ao B2IF.\n' +
            'Solicite ao seu assessor financeiro que faça a vinculação.'
          );
          continue;
        }

        const clienteId = sessao.cliente_id;

        // ── Texto ─────────────────────────────────────────────────────────────
        if (msg.type === 'text') {
          const texto = msg.text?.body || '';
          const cmd   = texto.trim().toLowerCase();
          if (cmd === 'resumo' || cmd === 'extrato') {
            await enviarResumoSemanal(telefone, clienteId); continue;
          }
          if (cmd === 'ajuda' || cmd === 'menu') {
            await enviarAjuda(telefone); continue;
          }
          await processarTexto({ telefone, clienteId, texto });
          continue;
        }

        // ── Imagem ────────────────────────────────────────────────────────────
        if (msg.type === 'image') {
          const mediaId = msg.image?.id;
          if (mediaId) {
            const mediaUrl = await resolverMediaUrl(mediaId);
            if (mediaUrl) {
              await processarImagem({ telefone, clienteId, imageUrl: mediaUrl });
            }
          }
          continue;
        }

        // ── Áudio / PTT ───────────────────────────────────────────────────────
        if (msg.type === 'audio') {
          const mediaId = msg.audio?.id;
          if (mediaId) {
            try {
              const buffer = await baixarMediaMeta(mediaId);
              await processarAudio({ telefone, clienteId, audioBuffer: buffer, filename: 'audio.ogg' });
            } catch (err) {
              console.error('[webhook/meta] Erro ao baixar áudio:', err.message);
            }
          }
          continue;
        }

        // ── Documento ─────────────────────────────────────────────────────────
        if (msg.type === 'document') {
          const mediaId = msg.document?.id;
          const mime    = msg.document?.mime_type || '';
          const fname   = msg.document?.filename  || '';
          const tipo    = detectarTipoMidia(mime, fname);
          if (mediaId && tipo === 'document') {
            try {
              const buffer = await baixarMediaMeta(mediaId);
              await processarPDF({ telefone, clienteId, pdfBuffer: buffer });
            } catch (err) {
              console.error('[webhook/meta] Erro ao baixar PDF:', err.message);
            }
          }
          continue;
        }
      }
    }
  }
}

// ─── Helpers Meta ──────────────────────────────────────────────────────────────

/** Resolve o URL de download de uma mídia Meta pelo ID */
async function resolverMediaUrl(mediaId) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${config.metaApiVersion}/${mediaId}`,
      { headers: { Authorization: `Bearer ${config.metaAccessToken}` } }
    );
    const data = await res.json();
    return data.url || null;
  } catch (err) {
    console.error('[webhook/meta] Erro ao resolver URL de mídia:', err.message);
    return null;
  }
}

/** Baixa uma mídia Meta pelo ID e retorna o Buffer */
async function baixarMediaMeta(mediaId) {
  const mediaUrl = await resolverMediaUrl(mediaId);
  if (!mediaUrl) throw new Error(`Não foi possível resolver URL da mídia ${mediaId}`);

  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${config.metaAccessToken}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar mídia`);

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVOLUTION API HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
async function handleEvolution(body) {
  if (body.event !== 'messages.upsert' && body.event !== 'MESSAGES_UPSERT') return;

  const msg = body.data?.message || body.message;
  if (!msg) return;

  if (body.data?.key?.fromMe || msg.key?.fromMe) return;

  const remoteJid  = body.data?.key?.remoteJid || msg.key?.remoteJid || '';
  const telefone   = normalizarTelefone(remoteJid.replace(/@.*/, ''));
  if (!telefone) return;

  const sessao = await buscarSessao(telefone);
  if (!sessao) {
    console.log(`[webhook/evolution] Número sem sessão: ${telefone}`);
    await enviarMensagem(telefone,
      '👋 Seu número ainda não está vinculado ao B2IF.\n' +
      'Solicite ao seu assessor financeiro que faça a vinculação.'
    );
    return;
  }

  const clienteId  = sessao.cliente_id;
  const msgContent = body.data?.message || msg;

  const textoBody =
    msgContent?.conversation ||
    msgContent?.extendedTextMessage?.text ||
    msgContent?.message?.conversation ||
    msgContent?.message?.extendedTextMessage?.text;

  if (textoBody) {
    const cmd = textoBody.trim().toLowerCase();
    if (cmd === 'resumo' || cmd === 'extrato') return enviarResumoSemanal(telefone, clienteId);
    if (cmd === 'ajuda' || cmd === 'menu')     return enviarAjuda(telefone);
    await processarTexto({ telefone, clienteId, texto: textoBody });
    return;
  }

  const imageMsg = msgContent?.imageMessage || msgContent?.message?.imageMessage;
  if (imageMsg) {
    const mediaUrl = imageMsg.url || imageMsg.directPath;
    if (mediaUrl) await processarImagem({ telefone, clienteId, imageUrl: mediaUrl });
    return;
  }

  const audioMsg =
    msgContent?.audioMessage ||
    msgContent?.message?.audioMessage ||
    msgContent?.pttMessage ||
    msgContent?.message?.pttMessage;

  if (audioMsg) {
    const mediaUrl = audioMsg.url || audioMsg.directPath;
    if (mediaUrl) {
      try {
        const buffer = await downloadMedia(mediaUrl);
        await processarAudio({ telefone, clienteId, audioBuffer: buffer, filename: 'audio.ogg' });
      } catch (err) {
        console.error('[webhook/evolution] Erro ao baixar áudio:', err.message);
      }
    }
    return;
  }

  const docMsg = msgContent?.documentMessage || msgContent?.message?.documentMessage;
  if (docMsg) {
    const mimetype = docMsg.mimetype || '';
    const tipo     = detectarTipoMidia(mimetype, docMsg.fileName || '');
    if (tipo === 'document') {
      const mediaUrl = docMsg.url || docMsg.directPath;
      if (mediaUrl) {
        try {
          const buffer = await downloadMedia(mediaUrl);
          await processarPDF({ telefone, clienteId, pdfBuffer: buffer });
        } catch (err) {
          console.error('[webhook/evolution] Erro ao baixar PDF:', err.message);
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Z-API HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
async function handleZAPI(body) {
  if (!body.phone) return;

  const telefone  = normalizarTelefone(body.phone);
  const sessao    = await buscarSessao(telefone);

  if (!sessao) {
    console.log(`[webhook/zapi] Número sem sessão: ${telefone}`);
    await enviarMensagem(telefone,
      '👋 Seu número ainda não está vinculado ao B2IF.\n' +
      'Solicite ao seu assessor financeiro que faça a vinculação.'
    );
    return;
  }

  const clienteId = sessao.cliente_id;

  if (body.text?.message) {
    const cmd = body.text.message.trim().toLowerCase();
    if (cmd === 'resumo' || cmd === 'extrato') return enviarResumoSemanal(telefone, clienteId);
    if (cmd === 'ajuda' || cmd === 'menu')     return enviarAjuda(telefone);
    await processarTexto({ telefone, clienteId, texto: body.text.message });
    return;
  }

  if (body.image?.imageUrl) {
    await processarImagem({ telefone, clienteId, imageUrl: body.image.imageUrl });
    return;
  }

  if (body.audio?.audioUrl) {
    try {
      const buffer = await downloadMedia(body.audio.audioUrl, 'zapi');
      await processarAudio({ telefone, clienteId, audioBuffer: buffer, filename: 'audio.ogg' });
    } catch (err) {
      console.error('[webhook/zapi] Erro ao baixar áudio:', err.message);
    }
    return;
  }

  if (body.document?.documentUrl) {
    const tipo = detectarTipoMidia(body.document.mimeType || '', body.document.fileName || '');
    if (tipo === 'document') {
      try {
        const buffer = await downloadMedia(body.document.documentUrl, 'zapi');
        await processarPDF({ telefone, clienteId, pdfBuffer: buffer });
      } catch (err) {
        console.error('[webhook/zapi] Erro ao baixar PDF:', err.message);
      }
    }
  }
}

// ─── Helpers comuns ────────────────────────────────────────────────────────────
function normalizarTelefone(raw) {
  if (!raw) return '';
  const n = raw.replace(/@.*/, '').replace(/\D/g, '');
  if (n.length >= 10 && n.length <= 11 && !n.startsWith('55')) return `55${n}`;
  return n;
}

async function enviarAjuda(telefone) {
  const msg = [
    '📲 *B2IF Mobile – Como usar:*',
    '',
    '✏️ *Texto:* "Almoço 45" ou "Salário 3200"',
    '📸 *Foto:* Mande a foto do comprovante',
    '🎙️ *Áudio:* Descreva o gasto por voz',
    '📄 *PDF:* Envie o extrato do banco',
    '',
    '📊 *Comandos:*',
    '  • _resumo_ → ver gastos da semana',
    '  • _ajuda_ → este menu',
  ].join('\n');

  return enviarMensagem(telefone, msg);
}

async function enviarResumoSemanal(telefone, clienteId) {
  const { supabase } = await import('../utils/supabase.js');
  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  const { data } = await supabase
    .from('transacoes')
    .select('valor, descricao, data, categoria')
    .eq('cliente_id', clienteId)
    .gte('data', seteDiasAtras)
    .lt('valor', 0)
    .order('data', { ascending: false });

  if (!data || data.length === 0) {
    return enviarMensagem(telefone, '📊 Nenhuma despesa registrada nos últimos 7 dias.');
  }

  const total  = data.reduce((s, t) => s + Math.abs(t.valor), 0);
  const linhas = data
    .slice(0, 8)
    .map(t => `• ${t.descricao}: *R$ ${Math.abs(t.valor).toFixed(2).replace('.', ',')}*`);

  const msg = [
    `📊 *Resumo dos últimos 7 dias:*`,
    '',
    ...linhas,
    data.length > 8 ? `... e mais ${data.length - 8} transações` : '',
    '',
    `💰 *Total: R$ ${total.toFixed(2).replace('.', ',')}*`,
  ].filter(l => l !== '').join('\n');

  return enviarMensagem(telefone, msg);
}

export default router;
