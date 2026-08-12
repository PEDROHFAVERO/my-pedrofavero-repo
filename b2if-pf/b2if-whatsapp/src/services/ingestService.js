/**
 * ingestService.js
 * Motor central de ingestão de transações.
 * 1. Salva mensagem bruta em transacoes_raw
 * 2. Parseia via IA (texto/imagem/áudio/PDF)
 * 3. Deduplica via fingerprint
 * 4. Insere em transacoes (estrutura do B2IF Desktop)
 * 5. Envia confirmação via WhatsApp
 */
import pdfParse from 'pdf-parse';
import { supabase }             from '../utils/supabase.js';
import { gerarFingerprint, verificarDuplicata } from '../utils/fingerprint.js';
import { nomeCategoria }        from '../utils/categorias.js';
import {
  parsearTexto,
  parsearImagem,
  parsearAudio,
  parsearExtratoPDF,
}                               from './aiService.js';
import {
  confirmarTransacao,
  notificarErro,
  notificarDuplicata,
}                               from './whatsappSender.js';

// ─── Competência ───────────────────────────────────────────────────────────────
function dataToCompetencia(dataStr) {
  if (!dataStr) {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }
  const [ano, mes] = dataStr.split('-');
  return `${mes}/${ano}`;
}

// ─── Salvar raw ────────────────────────────────────────────────────────────────
async function salvarRaw({ telefone, clienteId, fonte, payload }) {
  const { data, error } = await supabase
    .from('transacoes_raw')
    .insert({ telefone, cliente_id: clienteId, fonte, payload })
    .select('id')
    .single();
  if (error) console.error('[ingestService] Erro ao salvar raw:', error.message);
  return data?.id || null;
}

// ─── Atualizar raw ─────────────────────────────────────────────────────────────
async function atualizarRaw(rawId, updates) {
  if (!rawId) return;
  await supabase
    .from('transacoes_raw')
    .update({ ...updates, processed_at: new Date().toISOString() })
    .eq('id', rawId);
}

// ─── Inserir transação ─────────────────────────────────────────────────────────
async function inserirTransacao({ clienteId, parsed, rawId, fonte }) {
  const fingerprint = gerarFingerprint({
    clienteId,
    valor:    parsed.valor,
    data:     parsed.data,
    descricao: parsed.descricao,
  });

  const duplicataId = await verificarDuplicata(supabase, fingerprint, clienteId);
  if (duplicataId) {
    console.log(`[ingestService] Duplicata detectada para cliente ${clienteId}: ${fingerprint}`);
    await atualizarRaw(rawId, { status: 'duplicado', fingerprint, transacao_id: duplicataId });
    return { duplicata: true, transacaoId: duplicataId, parsed };
  }

  const { data, error } = await supabase
    .from('transacoes')
    .insert({
      cliente_id:  clienteId,
      data:        parsed.data,
      competencia: dataToCompetencia(parsed.data),
      valor:       parsed.valor,
      descricao:   parsed.descricao,
      categoria:   parsed.categoria,
      conta:       parsed.conta,
      formato:     parsed.formato,
      parcelas:    parsed.parcelas,
      fonte,
      fingerprint,
      confirmado:  false,
      raw_id:      rawId,
    })
    .select('id')
    .single();

  if (error) {
    await atualizarRaw(rawId, { status: 'erro', erro: error.message, fingerprint });
    throw new Error(`[ingestService] Erro ao inserir transação: ${error.message}`);
  }

  await atualizarRaw(rawId, { status: 'processado', fingerprint, transacao_id: data.id, ia_resposta: parsed._raw });
  return { duplicata: false, transacaoId: data.id, parsed };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLERS DE TIPO DE MENSAGEM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Processa mensagem de texto.
 */
export async function processarTexto({ telefone, clienteId, texto }) {
  const rawId  = await salvarRaw({ telefone, clienteId, fonte: 'whatsapp_text', payload: { texto } });
  let parsed;

  try {
    parsed = await parsearTexto(texto);
  } catch (err) {
    await atualizarRaw(rawId, { status: 'erro', erro: err.message });
    await notificarErro(telefone, 'Não entendi a mensagem. Tente: "Almoço 45" ou "Salário 3200"');
    return null;
  }

  if (!parsed || !parsed.valor) {
    await atualizarRaw(rawId, { status: 'erro', erro: 'Nenhuma transação identificada' });
    return null; // Não é uma transação — resposta tratada fora
  }

  const resultado = await inserirTransacao({ clienteId, parsed, rawId, fonte: 'whatsapp_text' });

  if (resultado.duplicata) {
    await notificarDuplicata(telefone, parsed);
  } else {
    await confirmarTransacao(telefone, {
      ...parsed,
      categoria_nome: nomeCategoria(parsed.categoria),
    });
  }

  return resultado;
}

/**
 * Processa imagem (comprovante, cupom).
 */
export async function processarImagem({ telefone, clienteId, imageUrl }) {
  const rawId = await salvarRaw({ telefone, clienteId, fonte: 'whatsapp_image', payload: { imageUrl } });
  let parsed;

  try {
    parsed = await parsearImagem(imageUrl);
  } catch (err) {
    await atualizarRaw(rawId, { status: 'erro', erro: err.message });
    await notificarErro(telefone, 'Não consegui ler a imagem. Tente uma foto mais nítida.');
    return null;
  }

  if (!parsed || !parsed.valor) {
    await atualizarRaw(rawId, { status: 'erro', erro: 'Nenhuma transação na imagem' });
    await notificarErro(telefone, 'Não identifiquei nenhuma transação nessa imagem.');
    return null;
  }

  const resultado = await inserirTransacao({ clienteId, parsed, rawId, fonte: 'whatsapp_image' });

  if (resultado.duplicata) {
    await notificarDuplicata(telefone, parsed);
  } else {
    await confirmarTransacao(telefone, {
      ...parsed,
      categoria_nome: nomeCategoria(parsed.categoria),
    });
  }

  return resultado;
}

/**
 * Processa mensagem de áudio.
 */
export async function processarAudio({ telefone, clienteId, audioBuffer, filename }) {
  const rawId = await salvarRaw({ telefone, clienteId, fonte: 'whatsapp_audio', payload: { filename } });
  let parsed;

  try {
    parsed = await parsearAudio(audioBuffer, filename);
  } catch (err) {
    await atualizarRaw(rawId, { status: 'erro', erro: err.message });
    await notificarErro(telefone, 'Não consegui transcrever o áudio. Tente enviar texto.');
    return null;
  }

  if (!parsed || !parsed.valor) {
    await atualizarRaw(rawId, { status: 'erro', erro: 'Áudio sem transação identificada' });
    return null;
  }

  const resultado = await inserirTransacao({ clienteId, parsed, rawId, fonte: 'whatsapp_audio' });

  if (resultado.duplicata) {
    await notificarDuplicata(telefone, parsed);
  } else {
    await confirmarTransacao(telefone, {
      ...parsed,
      categoria_nome: nomeCategoria(parsed.categoria),
    });
  }

  return resultado;
}

/**
 * Processa PDF de extrato bancário.
 * Insere múltiplas transações de uma vez.
 */
export async function processarPDF({ telefone, clienteId, pdfBuffer }) {
  const rawId = await salvarRaw({ telefone, clienteId, fonte: 'whatsapp_pdf', payload: { tamanho: pdfBuffer.length } });

  let textoPDF;
  try {
    const result = await pdfParse(pdfBuffer);
    textoPDF = result.text;
  } catch (err) {
    await atualizarRaw(rawId, { status: 'erro', erro: `PDF inválido: ${err.message}` });
    await notificarErro(telefone, 'Não consegui ler o PDF. Verifique se o arquivo não está protegido.');
    return null;
  }

  let lista;
  try {
    lista = await parsearExtratoPDF(textoPDF);
  } catch (err) {
    await atualizarRaw(rawId, { status: 'erro', erro: err.message });
    await notificarErro(telefone, 'Erro ao interpretar o extrato. Tente novamente.');
    return null;
  }

  if (!lista || lista.length === 0) {
    await atualizarRaw(rawId, { status: 'erro', erro: 'Nenhuma transação no extrato' });
    await notificarErro(telefone, 'Não encontrei transações nesse extrato.');
    return null;
  }

  await atualizarRaw(rawId, { status: 'processado', ia_resposta: { total: lista.length } });

  let inseridas = 0;
  let duplicadas = 0;
  let erros = 0;

  for (const parsed of lista) {
    try {
      const res = await inserirTransacao({ clienteId, parsed, rawId: null, fonte: 'whatsapp_pdf' });
      if (res.duplicata) duplicadas++; else inseridas++;
    } catch {
      erros++;
    }
  }

  // Resumo
  const parts = [`✅ *${inseridas} transações importadas* do extrato`];
  if (duplicadas) parts.push(`⚠️ ${duplicadas} já existiam (ignoradas)`);
  if (erros)      parts.push(`❌ ${erros} com erro`);
  parts.push(`\nVisualize no app B2IF para revisar e categorizar.`);

  const { enviarMensagem } = await import('./whatsappSender.js');
  await enviarMensagem(telefone, parts.join('\n'));

  return { inseridas, duplicadas, erros };
}
