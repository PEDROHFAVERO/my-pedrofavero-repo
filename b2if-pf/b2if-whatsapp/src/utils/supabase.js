import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

/**
 * Cliente Supabase com service_role key.
 * Nunca exponha esta key no frontend — use somente no backend.
 */
export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  }
);
