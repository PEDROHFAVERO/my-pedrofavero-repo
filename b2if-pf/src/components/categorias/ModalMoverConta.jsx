import { useState } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn } from '../UI.jsx';

// ── ModalMoverConta ──────────────────────────────────────────────────────────
// Permite mover uma conta de um banco para outro (ou para "Sem banco")
function ModalMoverConta({ conta, bancos, onMover, onClose }) {
  const opcoesDestino = [
    { id: null, nome: '— Sem banco —' },
    ...bancos.filter(b => b.id !== conta.bancoId),
  ];
  const [destBancoId, setDestBancoId] = useState(opcoesDestino[0]?.id ?? null);

  return (
    <Modal open title="Mover Conta" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: FONT.base, color: C.text }}>
          Mover <strong style={{ color: C.brand }}>{conta.nome}</strong> para:
        </div>
        {opcoesDestino.length <= 1 ? (
          <div style={{ fontSize: FONT.sm, color: C.textMuted, padding: '10px 0' }}>
            Não há outros bancos disponíveis. Cadastre um novo banco primeiro.
          </div>
        ) : (
          <select
            value={destBancoId ?? ''}
            onChange={e => setDestBancoId(e.target.value || null)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: RADIUS.md,
              background: C.bgMid, border: `1px solid ${C.border}`,
              color: C.text, fontSize: FONT.base,
            }}
          >
            {opcoesDestino.map(b => (
              <option key={b.id ?? '__none'} value={b.id ?? ''}>{b.nome}</option>
            ))}
          </select>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn
          onClick={() => onMover(destBancoId)}
          disabled={opcoesDestino.length <= 1}
        >
          Mover
        </Btn>
      </div>
    </Modal>
  );
}


export { ModalMoverConta };
