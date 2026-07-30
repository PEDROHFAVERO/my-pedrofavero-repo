/**
 * sessions.js
 * API REST para gerenciar vínculos telefone ↔ cliente B2IF.
 * Usada pelo assessor via painel ou integração com o desktop.
 *
 * POST   /api/sessions          → criar/atualizar vínculo
 * GET    /api/sessions          → listar vínculos ativos
 * DELETE /api/sessions/:telefone → remover vínculo
 */
import { Router }         from 'express';
import { apiAuth }        from '../middleware/auth.js';
import {
  upsertSessao,
  listarSessoes,
  desativarSessao,
}                         from '../services/sessionService.js';

const router = Router();

// ─── POST /api/sessions ────────────────────────────────────────────────────────
router.post('/', apiAuth, async (req, res) => {
  const { telefone, clienteId, nomeCliente, assessorId } = req.body;

  if (!telefone || !clienteId) {
    return res.status(400).json({ error: 'telefone e clienteId são obrigatórios' });
  }

  try {
    const sessao = await upsertSessao({ telefone, clienteId, nomeCliente, assessorId });
    res.status(200).json({ success: true, sessao });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/sessions ─────────────────────────────────────────────────────────
router.get('/', apiAuth, async (req, res) => {
  try {
    const { assessorId } = req.query;
    const sessoes = await listarSessoes(assessorId);
    res.json({ sessoes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/sessions/:telefone ───────────────────────────────────────────
router.delete('/:telefone', apiAuth, async (req, res) => {
  try {
    await desativarSessao(req.params.telefone);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
