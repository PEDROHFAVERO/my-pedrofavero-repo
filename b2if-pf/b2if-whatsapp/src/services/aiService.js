/**
 * aiService.js
 * Parseia mensagens WhatsApp (texto, imagem, áudio, PDF) via OpenAI.
 * Retorna um objeto de transação normalizado.
 */
import OpenAI from 'openai';
import { config } from '../../config/index.js';
import { resolverCategoria } from '../utils/categorias.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

// ─── Prompt sistema compartilhado ─────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é um assistente financeiro que extrai dados de transações.
Dado um texto/imagem/áudio descrevendo um gasto ou receita, retorne SOMENTE um JSON válido:
{
  "descricao": "Nome do estabelecimento ou descrição resumida (máx 60 chars)",
  "valor": -89.90,          // negativo=despesa, positivo=receita. SEMPRE número.
  "data": "2026-04-09",     // YYYY-MM-DD. Se não informado, use hoje.
  "categoria": "alimentacao", // Uma de: moradia, alimentacao, transporte, saude, educacao, lazer, vestuario, cuidados, assinaturas, servicos, contas, animais, presentes, investimentos, reserva, receita, entre_contas, outros
  "conta": "Nubank",        // banco/cartão mencionado ou null
  "formato": "débito",      // débito|crédito|pix|dinheiro|transferência ou null
  "parcelas": 1,            // número de parcelas ou 1
  "confianca": 0.9          // 0.0-1.0, sua confiança na extração
}
Hoje é ${new Date().toLocaleDateString('pt-BR')}.
Responda APENAS com o JSON, sem markdown, sem explicações.`;

// ─── Texto ─────────────────────────────────────────────────────────────────────
/**
 * Extrai transação de uma mensagem de texto.
 * @param {string} texto
 */
export async function parsearTexto(texto) {
  const completion = await openai.chat.completions.create({
    model:       config.openaiModel,
    temperature: 0,
    messages: [
      { role: 'system',  content: SYSTEM_PROMPT },
      { role: 'user',    content: texto },
    ],
  });

  return parseResposta(completion.choices[0].message.content);
}

// ─── Imagem ─────────────────────────────────────────────────────────────────────
/**
 * Extrai transação de uma imagem (comprovante, cupom fiscal, etc.).
 * @param {string} imageUrl  URL pública ou base64 data URL
 */
export async function parsearImagem(imageUrl) {
  const completion = await openai.chat.completions.create({
    model:       config.openaiModel,
    temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role:    'user',
        content: [
          { type: 'text',      text: 'Extraia a transação desta imagem de comprovante/recibo:' },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
        ],
      },
    ],
  });

  return parseResposta(completion.choices[0].message.content);
}

// ─── Áudio ─────────────────────────────────────────────────────────────────────
/**
 * Transcreve áudio e extrai transação.
 * @param {Buffer|Blob} audioBuffer  Conteúdo do arquivo de áudio
 * @param {string}      filename     Ex: "audio.ogg"
 */
export async function parsearAudio(audioBuffer, filename = 'audio.ogg') {
  // 1. Transcrição via Whisper
  const transcricao = await openai.audio.transcriptions.create({
    model: config.whisperModel,
    file:  new File([audioBuffer], filename, { type: 'audio/ogg' }),
    language: 'pt',
  });

  const texto = transcricao.text;
  console.log(`[aiService] Áudio transcrito: "${texto}"`);

  // 2. Parsing do texto transcrito
  const resultado = await parsearTexto(texto);
  resultado._transcricao = texto;
  return resultado;
}

// ─── PDF ───────────────────────────────────────────────────────────────────────
/**
 * Extrai múltiplas transações de texto de extrato bancário.
 * @param {string} textoPDF  Texto bruto extraído do PDF
 */
export async function parsearExtratoPDF(textoPDF) {
  // Limitar tamanho para não exceder contexto
  const textoTruncado = textoPDF.substring(0, 12000);

  const completion = await openai.chat.completions.create({
    model:       config.openaiModel,
    temperature: 0,
    messages: [
      {
        role:    'system',
        content: `Você é um assistente financeiro que extrai listas de transações de extratos bancários.
Retorne SOMENTE um JSON válido com um array de transações:
[
  {
    "descricao": "string",
    "valor": -89.90,
    "data": "2026-04-09",
    "categoria": "alimentacao",
    "conta": "Nubank",
    "formato": "débito",
    "parcelas": 1
  }
]
Hoje é ${new Date().toLocaleDateString('pt-BR')}.
Responda APENAS com o array JSON, sem markdown.`,
      },
      {
        role:    'user',
        content: `Extrato bancário:\n${textoTruncado}`,
      },
    ],
  });

  try {
    const raw = completion.choices[0].message.content.trim();
    const lista = JSON.parse(raw);
    return Array.isArray(lista) ? lista.map(normalizarTransacao) : [];
  } catch (e) {
    console.error('[aiService] Erro ao parsear array do PDF:', e.message);
    return [];
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function parseResposta(content) {
  try {
    // Remove possível markdown wrapper
    const limpo = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
    const obj   = JSON.parse(limpo);
    return normalizarTransacao(obj);
  } catch (e) {
    console.error('[aiService] Erro ao parsear resposta:', e.message, '| Raw:', content);
    return null;
  }
}

function normalizarTransacao(obj) {
  if (!obj) return null;
  return {
    descricao:  (obj.descricao || '').substring(0, 60).trim(),
    valor:      typeof obj.valor === 'number' ? obj.valor : parseFloat(obj.valor) || 0,
    data:       validarData(obj.data),
    categoria:  resolverCategoria(obj.categoria || ''),
    conta:      obj.conta   || null,
    formato:    obj.formato || null,
    parcelas:   parseInt(obj.parcelas) || 1,
    confianca:  parseFloat(obj.confianca) || 0.8,
    _raw:       obj,
  };
}

function validarData(data) {
  if (!data) return new Date().toISOString().substring(0, 10);
  // Aceita YYYY-MM-DD ou DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    const [d, m, y] = data.split('/');
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().substring(0, 10);
}
