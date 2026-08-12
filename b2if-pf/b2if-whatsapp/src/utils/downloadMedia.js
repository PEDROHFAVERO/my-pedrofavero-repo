/**
 * downloadMedia.js
 * Baixa mídia do WhatsApp (imagem, áudio, documento) a partir de uma URL.
 * Retorna um Buffer com o conteúdo binário.
 */
import { config } from '../../config/index.js';

/**
 * Baixa mídia a partir da URL fornecida pelo webhook.
 * Para Evolution API, a URL já é acessível com o API key no header.
 * Para Z-API, a URL é pública por tempo limitado.
 *
 * @param {string} url       URL da mídia
 * @param {string} provider  'evolution' | 'zapi'
 * @returns {Promise<Buffer>}
 */
export async function downloadMedia(url, provider = config.waProvider) {
  const headers = {};

  if (provider === 'evolution' && config.evolutionApiKey) {
    headers['apikey'] = config.evolutionApiKey;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`[downloadMedia] HTTP ${res.status} ao baixar ${url}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Detecta o tipo de mídia baseado no MIME type ou extensão da URL.
 * @param {string} mimetype
 * @param {string} url
 * @returns {'image'|'audio'|'document'|'unknown'}
 */
export function detectarTipoMidia(mimetype = '', url = '') {
  const m = mimetype.toLowerCase();
  const u = url.toLowerCase();

  if (m.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)/.test(u)) return 'image';
  if (m.startsWith('audio/') || /\.(ogg|mp3|wav|m4a|opus)/.test(u))  return 'audio';
  if (m === 'application/pdf' || u.endsWith('.pdf'))                   return 'document';

  return 'unknown';
}
