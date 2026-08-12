/**
 * appConfig.js
 * Lê as variáveis de ambiente VITE_* e exporta a configuração
 * de identidade visual e conexão Supabase para todo o sistema.
 *
 * Para white-label: basta trocar o .env e fazer um novo build.
 */

// ── Supabase ──────────────────────────────────────────────────────────────────
export const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ── Identidade da empresa ─────────────────────────────────────────────────────
export const APP_NAME     = import.meta.env.VITE_APP_NAME     || 'Planejador PF';
export const APP_SUBTITLE = import.meta.env.VITE_APP_SUBTITLE || 'Planejador Financeiro';
export const APP_COMPANY  = import.meta.env.VITE_APP_COMPANY  || 'B2IF Assessoria';
export const APP_TAGLINE  = import.meta.env.VITE_APP_TAGLINE  || 'Sistema de Uso Interno';
export const LOGO_FILE    = import.meta.env.VITE_LOGO_FILE    || 'logo-light.png';
export const LOGO_URL     = `/${LOGO_FILE}`;

// ── Cor da marca ──────────────────────────────────────────────────────────────
// Recebe hex (#RRGGBB) e gera variantes escura e clara automaticamente
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

function darken(hex, amount = 0.15) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function lighten(hex, amount = 0.25) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount,
  );
}

const RAW_BRAND = import.meta.env.VITE_BRAND_COLOR || '#00B8A9';

export const BRAND_COLOR       = RAW_BRAND;
export const BRAND_COLOR_DARK  = darken(RAW_BRAND, 0.18);
export const BRAND_COLOR_LIGHT = lighten(RAW_BRAND, 0.20);

/**
 * Edge Function URL — derivada automaticamente da SUPABASE_URL.
 * Não precisa ser configurada separadamente.
 */
export const EDGE_FN_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/admin-cliente`
  : '';

/** URL do whatsapp-webhook usado como proxy admin para operações de manager */
export const ADMIN_PROXY_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/whatsapp-webhook`
  : '';

/** Service Role Key — usado APENAS no Manager para operações admin via proxy */
export const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || '';

/** URL da Edge Function de processamento de PDF via Gemini */
export const PROCESS_PDF_URL = SUPABASE_URL
  ? `${SUPABASE_URL}/functions/v1/process-pdf`
  : '';
