/**
 * sessionService.js
 * Gerencia o mapeamento telefone → cliente B2IF (tabela whatsapp_sessions).
 * Cache em memória por 5 minutos para reduzir round-trips ao Supabase.
 */
import { supabase } from '../utils/supabase.js';

const cache = new Map(); // telefone → { session, expiresAt }
const TTL_MS = 5 * 60 * 1000;

/**
 * Busca a sessão de um número de telefone.
 * @param {string} telefone
 * @returns {object|null} { id, telefone, cliente_id, nome_cliente, ... } ou null
 */
export async function buscarSessao(telefone) {
  const hit = cache.get(telefone);
  if (hit && hit.expiresAt > Date.now()) return hit.session;

  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('telefone', telefone)
    .eq('ativo', true)
    .single();

  if (error || !data) {
    cache.set(telefone, { session: null, expiresAt: Date.now() + TTL_MS });
    return null;
  }

  cache.set(telefone, { session: data, expiresAt: Date.now() + TTL_MS });
  return data;
}

/**
 * Cria (ou atualiza) a sessão de um número.
 * Útil para o assessor vincular um cliente via dashboard.
 */
export async function upsertSessao({ telefone, clienteId, nomeCliente, assessorId }) {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .upsert({
      telefone,
      cliente_id:   clienteId,
      nome_cliente: nomeCliente,
      assessor_id:  assessorId || null,
      ativo:        true,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'telefone' })
    .select()
    .single();

  if (error) throw new Error(`[sessionService] upsert erro: ${error.message}`);
  cache.delete(telefone); // invalida cache
  return data;
}

/**
 * Desativa a sessão (desvincula o número).
 */
export async function desativarSessao(telefone) {
  await supabase
    .from('whatsapp_sessions')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('telefone', telefone);
  cache.delete(telefone);
}

/**
 * Lista todas as sessões ativas (para o painel do assessor).
 */
export async function listarSessoes(assessorId) {
  let query = supabase.from('whatsapp_sessions').select('*').eq('ativo', true);
  if (assessorId) query = query.eq('assessor_id', assessorId);
  const { data, error } = await query.order('nome_cliente');
  if (error) throw new Error(error.message);
  return data || [];
}
