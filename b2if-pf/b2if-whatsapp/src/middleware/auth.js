/**
 * auth.js
 * Middlewares de autenticação para as rotas da API.
 */
import { config } from '../../config/index.js';

/**
 * Valida o token secreto do webhook (header X-Webhook-Token ou query ?token=).
 * Bloqueia requisições não autorizadas com 401.
 */
export function webhookAuth(req, res, next) {
  if (!config.webhookSecret) return next(); // sem segredo configurado = dev mode

  const token =
    req.headers['x-webhook-token'] ||
    req.headers['x-hub-signature'] ||
    req.query.token;

  if (token !== config.webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

/**
 * Valida o token interno da API (para rotas de gerenciamento).
 * Header: Authorization: Bearer <SUPABASE_SERVICE_KEY>
 */
export function apiAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');

  if (token !== config.supabaseServiceKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
