/**
 * BancoLogo — quadrado colorido com a cor brand de cada banco
 *
 * Uso:
 *   <BancoLogo banco="nubank"   size={32} />
 *   <BancoLogo banco="itau"     size={24} />
 *   <BancoLogo banco="bradesco" size={20} radius={6} />
 *
 * Props:
 *   banco   — ID interno retornado por detectarBanco() ou nomeBancoLabel()
 *   size    — largura/altura em px (default: 32)
 *   radius  — border-radius em px (default: size * 0.22)
 *   style   — estilo extra no container
 *
 * Cobertura: nubank, nubank_fatura, itau, bradesco, inter, santander, bb,
 *            c6, caixa, sicoob, sicredi, xp, mercadopago, picpay, pagbank,
 *            btg, neon, safra + fallback genérico por hash
 */

// ── Mapa banco_id → cor brand ────────────────────────────────────────────────
const BANCO_COR = {
  nubank:       '#820AD1',
  nubank_fatura:'#820AD1',
  itau:         '#EC7000',
  bradesco:     '#CC0000',
  inter:        '#FF6B00',
  santander:    '#EC0000',
  bb:           '#F9DC00',
  c6:           '#242424',
  caixa:        '#005CA9',
  sicoob:       '#007A33',
  sicredi:      '#009640',
  xp:           '#121212',
  mercadopago:  '#009EE3',
  picpay:       '#11C76F',
  pagbank:      '#F5A800',
  btg:          '#000000',
  neon:         '#00D4AA',
  safra:        '#002B5C',
  asaas:        '#006BFF',
};

// ── Paleta de fallback por hash ───────────────────────────────────────────────
const FALLBACK_COLORS = [
  '#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#F97316', '#EF4444', '#06B6D4',
];

function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xFFFFFF;
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
}

// ── Normaliza banco_id para lookup ────────────────────────────────────────────
function normalizeBancoId(banco) {
  if (!banco) return '';
  const b = String(banco).toLowerCase().trim();
  if (b.includes('nubank') && b.includes('fatura')) return 'nubank_fatura';
  if (b.includes('nubank'))     return 'nubank';
  if (b.includes('itaú') || b.includes('itau'))   return 'itau';
  if (b.includes('bradesco'))   return 'bradesco';
  if (b.includes('inter'))      return 'inter';
  if (b.includes('santander'))  return 'santander';
  if (b.includes('brasil') || b === 'bb') return 'bb';
  if (b.includes('c6'))         return 'c6';
  if (b.includes('caixa'))      return 'caixa';
  if (b.includes('sicoob'))     return 'sicoob';
  if (b.includes('sicredi'))    return 'sicredi';
  if (b.includes('xp'))         return 'xp';
  if (b.includes('mercado'))    return 'mercadopago';
  if (b.includes('picpay'))     return 'picpay';
  if (b.includes('pagbank') || b.includes('pag bank')) return 'pagbank';
  if (b.includes('btg'))        return 'btg';
  if (b.includes('neon'))       return 'neon';
  if (b.includes('safra'))      return 'safra';
  if (b.includes('asaas'))      return 'asaas';
  return b;
}

// ── Componente principal ──────────────────────────────────────────────────────
export function BancoLogo({ banco, size = 32, radius, style = {} }) {
  const key   = normalizeBancoId(banco);
  const cor   = BANCO_COR[key] ?? hashColor(banco ?? '?');
  const r     = radius !== undefined ? radius : Math.round(size * 0.22);

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: r,
      background: cor,
      flexShrink: 0,
      display: 'inline-block',
      ...style,
    }} />
  );
}

export default BancoLogo;
