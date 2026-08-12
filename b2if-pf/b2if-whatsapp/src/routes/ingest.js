/**
 * ingest.js
 * API REST de ingestão manual (para testes e integrações externas).
 *
 * POST /api/ingest/texto    → { telefone, clienteId, texto }
 * POST /api/ingest/imagem   → { telefone, clienteId, imageUrl }
 */
import { Router }       from 'express';
import { apiAuth }      from '../middleware/auth.js';
import {
  processarTexto,
  processarImagem,
}                       from '../services/ingestService.js';

const router = Router();

router.post('/texto', apiAuth, async (req, res) => {
  const { telefone, clienteId, texto } = req.body;
  if (!clienteId || !texto) {
    return res.status(400).json({ error: 'clienteId e texto são obrigatórios' });
  }

  try {
    const resultado = await processarTexto({ telefone: telefone || 'api', clienteId, texto });
    res.json({ success: true, resultado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/imagem', apiAuth, async (req, res) => {
  const { telefone, clienteId, imageUrl } = req.body;
  if (!clienteId || !imageUrl) {
    return res.status(400).json({ error: 'clienteId e imageUrl são obrigatórios' });
  }

  try {
    const resultado = await processarImagem({ telefone: telefone || 'api', clienteId, imageUrl });
    res.json({ success: true, resultado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
