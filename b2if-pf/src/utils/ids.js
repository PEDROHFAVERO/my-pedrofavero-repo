/**
 * ids.js — Geração segura de identificadores únicos
 *
 * SUBSTITUI: Math.random().toString(36) em clienteStorage.js
 * MOTIVO: Math.random() não é criptograficamente seguro e tem risco
 *         de colisão em escala. crypto.randomUUID() usa CSPRNG do browser/runtime.
 */

/**
 * Gera um UUID v4 criptograficamente seguro.
 * Disponível em todos os browsers modernos (Chrome 92+, Firefox 95+, Safari 15.4+)
 * e em Node.js 19+ / Deno / Edge Functions.
 *
 * @returns {string} UUID no formato xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function gerarId() {
  // crypto.randomUUID() é a forma correta e segura
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback para ambientes que não suportam (muito antigos — não deve acontecer)
  // Usa getRandomValues (também criptograficamente seguro) para montar UUID v4
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versão 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/**
 * Gera um ID curto legível para uso em URLs ou labels (NÃO para PKs do banco).
 * Usa 8 bytes aleatórios criptograficamente seguros → 16 chars hex.
 *
 * @returns {string} Ex: "a3f9b2c1d4e5f678"
 */
export function gerarIdCurto() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
