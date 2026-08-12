/**
 * SaveBar.jsx — Botão fixo de salvamento manual
 *
 * Comportamento:
 *  - Aparece (canto inferior direito) quando isDirty=true, ou seja, quando o
 *    usuário fez alguma edição desde o último clique no botão (ou desde o carregamento).
 *  - NÃO some com o auto-save — só some quando o usuário CLICAR nele.
 *  - Ao clicar: faz save forçado imediato (forceSave), mostra "Salvando..." e
 *    depois "Salvo ✓" por 1.5s, e então some.
 *  - Se der erro: fica vermelho com botão "Tentar novamente" — não some.
 *
 * Props:
 *   isDirty    boolean        — há edições não confirmadas pelo usuário?
 *   salvando   boolean        — auto-save em andamento (mostra indicador discreto)
 *   erroSalvar string|null   — erro do auto-save
 *   onSave     fn async      — chama forceSave do contexto
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Save, CheckCircle, AlertCircle, Loader2, Bookmark } from 'lucide-react';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens.js';

export function SaveBar({ isDirty, salvando, erroSalvar, onSave, onCheckpoint }) {
  // Estados internos do botão manual
  const [btnStatus, setBtnStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const timerRef = useRef(null);

  // Quando isDirty volta a true (nova edição), reseta estado do botão para idle
  // para ele aparecer limpo novamente se o usuário editar após um "Salvo"
  useEffect(() => {
    if (isDirty && btnStatus === 'saved') {
      setBtnStatus('idle');
    }
  }, [isDirty]);

  // Limpa timer ao desmontar
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleSave = useCallback(async () => {
    if (btnStatus === 'saving') return;
    clearTimeout(timerRef.current);
    setBtnStatus('saving');
    try {
      await onSave();
      setBtnStatus('saved');
      // Some 1.5s após confirmação — usuário viu que foi salvo
      timerRef.current = setTimeout(() => setBtnStatus('idle'), 1500);
    } catch {
      setBtnStatus('error');
      // Erro não some sozinho — fica até o usuário tentar novamente
    }
  }, [btnStatus, onSave]);

  // ── Visibilidade ───────────────────────────────────────────────────────────
  // Aparece quando:
  //  - há edições pendentes (isDirty) E botão ainda não foi clicado com sucesso
  //  - está salvando (feedback do botão)
  //  - deu erro (não some)
  const visivel = (isDirty && btnStatus !== 'saved') || btnStatus === 'saving' || btnStatus === 'error';
  if (!visivel) return null;

  // ── Aparência por estado ───────────────────────────────────────────────────
  const isError   = btnStatus === 'error'  || !!erroSalvar;
  const isSaving  = btnStatus === 'saving';

  const bgColor = isError
    ? 'rgba(239,68,68,0.97)'
    : 'rgba(17,24,39,0.96)';

  const borderColor = isError
    ? 'rgba(239,68,68,0.35)'
    : 'rgba(255,255,255,0.08)';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: RADIUS.lg,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.25)',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        backdropFilter: 'blur(14px)',
        transition: 'background 0.2s ease, border-color 0.2s ease',
        fontFamily: "'Inter', system-ui, sans-serif",
        userSelect: 'none',
      }}
    >
      {/* Indicador de estado */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {isError
          ? <AlertCircle size={15} color="#fff" />
          : isSaving
          ? (
            <div style={{
              width: 15, height: 15,
              border: '2px solid rgba(255,255,255,0.25)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'savebar-spin 0.75s linear infinite',
            }} />
          )
          : <Save size={15} color={C.brand} />
        }
      </div>

      {/* Label */}
      <span style={{
        fontSize: FONT.sm,
        fontWeight: 600,
        color: '#fff',
        letterSpacing: '-0.01em',
      }}>
        {isError
          ? (erroSalvar || 'Erro ao salvar')
          : isSaving
          ? 'Salvando...'
          : 'Alterações não salvas'
        }
      </span>

      {/* Botão de ação principal */}
      {!isSaving && (
        <button
          onClick={handleSave}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            background: isError ? 'rgba(255,255,255,0.2)' : C.brand,
            border: 'none',
            borderRadius: RADIUS.md,
            color: '#fff',
            fontSize: FONT.sm,
            fontWeight: 700,
            fontFamily: "'Inter', system-ui, sans-serif",
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'opacity 0.15s',
            marginLeft: 4,
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.82'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          <Save size={12} />
          {isError ? 'Tentar novamente' : 'Salvar'}
        </button>
      )}

      {/* Botão Checkpoint — só quando não está em erro e há callback */}
      {!isSaving && !isError && onCheckpoint && (
        <button
          onClick={onCheckpoint}
          title="Criar checkpoint (versão permanente com nome)"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            padding: 0,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: RADIUS.md,
            color: '#fff',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
        >
          <Bookmark size={13} />
        </button>
      )}

      <style>{`
        @keyframes savebar-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/**
 * CheckpointFab — Botão flutuante permanente para criar checkpoint.
 *
 * Sempre visível quando há cliente ativo e não está em modo leitura,
 * independente do estado do SaveBar (isDirty). Posiciona-se no canto
 * inferior direito, acima do SaveBar quando este estiver visível.
 *
 * Props:
 *   onCheckpoint   fn async(titulo) — abre modal de checkpoint
 *   saveBarVisible boolean          — se SaveBar está visível (ajusta posição)
 */
export function CheckpointFab({ onCheckpoint, saveBarVisible = false }) {
  const [modal, setModal]       = useState(false);
  const [titulo, setTitulo]     = useState('');
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk]             = useState(false);
  const inputRef                = useRef(null);

  // Posiciona acima do SaveBar (altura estimada 52px) quando ele está visível
  const bottom = saveBarVisible ? 88 : 28;

  const abrir = () => {
    setTitulo('');
    setOk(false);
    setModal(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const fechar = () => {
    if (salvando) return;
    setModal(false);
    setTitulo('');
  };

  const confirmar = async () => {
    const t = titulo.trim();
    if (!t || salvando) return;
    setSalvando(true);
    try {
      await onCheckpoint(t);
      setOk(true);
      setTimeout(() => {
        setModal(false);
        setTitulo('');
        setOk(false);
      }, 1500);
    } catch {
      // mantém modal aberto em caso de erro
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      {/* Botão flutuante permanente */}
      <button
        onClick={abrir}
        title="Criar checkpoint (versão permanente com nome)"
        style={{
          position: 'fixed',
          bottom,
          right: 28,
          zIndex: 599, // abaixo do SaveBar (600)
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(17,24,39,0.88)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'bottom 0.2s ease, background 0.15s, transform 0.15s',
          color: '#F59E0B',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(245,158,11,0.18)';
          e.currentTarget.style.transform = 'scale(1.08)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(17,24,39,0.88)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <Bookmark size={16} />
      </button>

      {/* Modal inline de checkpoint */}
      {modal && (
        <div
          onClick={e => e.target === e.currentTarget && fechar()}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{
            background: 'rgba(17,24,39,0.97)', borderRadius: RADIUS.xl,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            padding: 28, width: '100%', maxWidth: 440,
            fontFamily: "'Inter',system-ui,sans-serif",
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Bookmark size={18} color="#F59E0B" />
              <span style={{ fontSize: FONT.md, fontWeight: 700, color: '#fff' }}>
                Criar Checkpoint
              </span>
            </div>
            <p style={{ fontSize: FONT.sm, color: 'rgba(255,255,255,0.55)', marginBottom: 16, lineHeight: 1.5 }}>
              Salva uma versão permanente e nomeada do estado atual.
              Checkpoints nunca expiram e podem ser restaurados a qualquer momento.
            </p>

            {ok ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22C55E', fontSize: FONT.sm, fontWeight: 600 }}>
                <CheckCircle size={16} /> Checkpoint criado com sucesso!
              </div>
            ) : (
              <>
                <input
                  ref={inputRef}
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmar()}
                  placeholder="Ex: Antes de importar fatura de julho"
                  disabled={salvando}
                  style={{
                    width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: RADIUS.md, color: '#fff', fontSize: FONT.sm,
                    outline: 'none', fontFamily: "'Inter',system-ui,sans-serif",
                  }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
                  <button
                    onClick={fechar}
                    disabled={salvando}
                    style={{
                      padding: '8px 16px', borderRadius: RADIUS.md,
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.7)', fontSize: FONT.sm,
                      cursor: 'pointer', fontFamily: "'Inter',system-ui,sans-serif",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmar}
                    disabled={!titulo.trim() || salvando}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 18px', borderRadius: RADIUS.md,
                      background: titulo.trim() && !salvando ? '#F59E0B' : 'rgba(245,158,11,0.35)',
                      border: 'none', color: titulo.trim() && !salvando ? '#000' : 'rgba(255,255,255,0.4)',
                      fontSize: FONT.sm, fontWeight: 700,
                      cursor: titulo.trim() && !salvando ? 'pointer' : 'not-allowed',
                      fontFamily: "'Inter',system-ui,sans-serif",
                      transition: 'background 0.15s',
                    }}
                  >
                    {salvando ? (
                      <>
                        <div style={{ width: 13, height: 13, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'savebar-spin 0.75s linear infinite' }} />
                        Salvando...
                      </>
                    ) : (
                      <><Bookmark size={13} /> Criar Checkpoint</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
