/**
 * whatsappSender.js
 * Abstração para envio de mensagens via Meta Cloud API, Evolution API ou Z-API.
 * Permite trocar o provider sem alterar o código de negócio.
 */
import { config } from '../../config/index.js';

// ─── META CLOUD API ────────────────────────────────────────────────────────────
async function enviarMeta(telefone, texto) {
  const url = `https://graph.facebook.com/${config.metaApiVersion}/${config.metaPhoneNumberId}/messages`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${config.metaAccessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to:                telefone,
      type:              'text',
      text:              { preview_url: false, body: texto },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Meta] HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Evolution API ─────────────────────────────────────────────────────────────
async function enviarEvolution(telefone, texto) {
  const url = `${config.evolutionApiUrl}/message/sendText/${config.evolutionInstance}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        config.evolutionApiKey,
    },
    body: JSON.stringify({ number: telefone, text: texto }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Evolution] HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Z-API ─────────────────────────────────────────────────────────────────────
async function enviarZAPI(telefone, texto) {
  const url = `https://api.z-api.io/instances/${config.zapiInstanceId}/token/${config.zapiToken}/send-text`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Client-Token':  config.zapiClientToken,
    },
    body: JSON.stringify({ phone: telefone, message: texto }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[Z-API] HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Interface pública ─────────────────────────────────────────────────────────
/**
 * Envia uma mensagem de texto via WhatsApp.
 * @param {string} telefone  Número no formato "5511999990000"
 * @param {string} texto     Texto a enviar (suporta *bold* e _italic_ do WA)
 */
export async function enviarMensagem(telefone, texto) {
  try {
    if (config.waProvider === 'meta') {
      return await enviarMeta(telefone, texto);
    }
    if (config.waProvider === 'zapi') {
      return await enviarZAPI(telefone, texto);
    }
    return await enviarEvolution(telefone, texto);
  } catch (err) {
    console.error(`[whatsappSender] Falha ao enviar para ${telefone}:`, err.message);
    // Não relança — falha de envio não deve derrubar o fluxo principal
  }
}

/**
 * Monta e envia a confirmação de registro de transação.
 */
export async function confirmarTransacao(telefone, t) {
  const sinal  = t.valor < 0 ? '📤' : '📥';
  const tipo   = t.valor < 0 ? 'Saída' : 'Entrada';
  const valor  = `R$ ${Math.abs(t.valor).toFixed(2).replace('.', ',')}`;
  const data   = t.data ? new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  const cat    = t.categoria_nome || t.categoria || '—';

  const msg = [
    `${sinal} *${tipo} registrada!*`,
    `📝 ${t.descricao || 'Sem descrição'}`,
    `💰 ${valor}`,
    t.data    ? `📅 ${data}` : null,
    `🏷️ ${cat}`,
    t.conta   ? `🏦 ${t.conta}` : null,
    ``,
    `_Para corrigir, responda: corrigir_`,
  ].filter(Boolean).join('\n');

  return enviarMensagem(telefone, msg);
}

/**
 * Envia mensagem de erro amigável ao usuário.
 */
export async function notificarErro(telefone, motivo) {
  const msg = [
    `⚠️ *Não consegui registrar essa transação*`,
    `Motivo: ${motivo}`,
    ``,
    `Tente novamente no formato:`,
    `  • Texto: _"Almoço 45"_ ou _"Almoço R$45,00"_`,
    `  • Foto do comprovante`,
    `  • Áudio descrevendo o gasto`,
    `  • PDF do extrato bancário`,
  ].join('\n');

  return enviarMensagem(telefone, msg);
}

/**
 * Informa que o registro é duplicado.
 */
export async function notificarDuplicata(telefone, t) {
  const valor = `R$ ${Math.abs(t.valor).toFixed(2).replace('.', ',')}`;
  const msg = `ℹ️ Parece que você já registrou *${t.descricao}* (${valor}) recentemente. Nenhum dado duplicado foi salvo.`;
  return enviarMensagem(telefone, msg);
}
