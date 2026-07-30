/**
 * server.js
 * Servidor Express principal do B2IF WhatsApp Gateway.
 *
 * Rotas:
 *   GET  /              → health check
 *   POST /webhook       → eventos WhatsApp (Evolution API / Z-API)
 *   GET  /webhook       → health check do webhook
 *   POST /api/sessions  → gerenciar vínculos telefone ↔ cliente
 *   GET  /api/sessions  → listar vínculos
 *   ...
 */
import express        from 'express';
import { config }     from '../config/index.js';
import webhookRouter  from './routes/webhook.js';
import sessionsRouter from './routes/sessions.js';
import ingestRouter   from './routes/ingest.js';

const app = express();

// ─── Middlewares globais ───────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS básico (ajuste para produção)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Webhook-Token');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Logging de requests
app.use((req, res, next) => {
  if (config.nodeEnv !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ─── Rotas ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name:      'B2IF WhatsApp Gateway',
    version:   '1.0.0',
    status:    'running',
    timestamp: new Date().toISOString(),
    provider:  config.waProvider,
    endpoints: {
      webhook:  'POST /webhook',
      sessions: 'POST /api/sessions',
      ingest:   'POST /api/ingest/texto',
    },
  });
});

app.use('/webhook',      webhookRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/ingest',   ingestRouter);

// ─── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// ─── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[server] Erro não tratado:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║     B2IF WhatsApp Gateway  v1.0       ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`  🚀  Servidor: http://localhost:${config.port}`);
  console.log(`  📡  Provider: ${config.waProvider.toUpperCase()}`);
  console.log(`  🔑  Webhook:  ${config.webhookSecret ? 'Protegido' : '⚠️  Sem proteção (dev)'}`);
  console.log(`  🌍  Ambiente: ${config.nodeEnv}`);
  console.log('');
  console.log(`  Endpoints:`);
  console.log(`    GET  /                → health check`);
  console.log(`    POST /webhook         → eventos WhatsApp`);
  console.log(`    POST /api/sessions    → vincular telefone`);
  console.log(`    POST /api/ingest/texto → ingestão manual`);
  console.log('');
});

export default app;
