import { createHash } from 'crypto';

/**
 * Normaliza uma string de estabelecimento para fins de deduplicação.
 * Remove caracteres especiais, converte para minúsculas e aplica trim.
 */
function normalizarDescricao(desc) {
  if (!desc) return '';
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')   // remove especiais
    .replace(/\s+/g, ' ')           // colapsa espaços
    .trim()
    .split(' ')
    .slice(0, 3)                    // primeiras 3 palavras (como no desktop)
    .join(' ');
}

/**
 * Gera um fingerprint para uma transação.
 * Combine: cliente_id + valor (centavos) + data (YYYY-MM-DD) + descrição normalizada
 *
 * @param {object} t - { clienteId, valor, data, descricao }
 * @returns {string} hash SHA-256 hex (16 chars)
 */
export function gerarFingerprint(t) {
  const centavos = Math.round(Math.abs(Number(t.valor) || 0) * 100);
  const data     = (t.data || '').substring(0, 10);
  const desc     = normalizarDescricao(t.descricao);
  const raw      = `${t.clienteId}|${centavos}|${data}|${desc}`;
  return createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

/**
 * Verifica se já existe uma transação com o mesmo fingerprint nas últimas 48h.
 * Retorna o ID da transação duplicada ou null.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} fingerprint
 * @param {string} clienteId
 */
export async function verificarDuplicata(supabase, fingerprint, clienteId) {
  const limite = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('transacoes')
    .select('id, created_at')
    .eq('fingerprint', fingerprint)
    .eq('cliente_id', clienteId)
    .gte('created_at', limite)
    .limit(1);

  if (error) {
    console.error('[fingerprint] Erro ao verificar duplicata:', error.message);
    return null;
  }
  return data?.length ? data[0].id : null;
}
