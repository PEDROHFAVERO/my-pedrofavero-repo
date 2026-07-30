import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { C, FONT, RADIUS } from '../design/tokens.js';
import { APP_NAME, APP_SUBTITLE, APP_COMPANY, APP_TAGLINE, LOGO_URL } from '../lib/appConfig.js';

export default function PageLogin() {
  const { login } = useAuth();
  const [email, setEmail]     = useState('');
  const [senha, setSenha]     = useState('');
  const [erro, setErro]       = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    if (!email.trim() || !senha) { setErro('Preencha e-mail e senha.'); return; }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), senha);
      // AuthContext + App.jsx detectam a sessão e redirecionam automaticamente
    } catch (err) {
      setErro(err.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo + título */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src={LOGO_URL} alt={APP_NAME} style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 16 }} />
          <div style={{ fontSize: FONT.xl, fontWeight: 800, color: C.text }}>{APP_NAME}</div>
          <div style={{ fontSize: FONT.sm, color: C.textMuted, marginTop: 4 }}>{APP_SUBTITLE}</div>
        </div>

        {/* Card do formulário */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: RADIUS.lg, padding: '32px',
        }}>
          <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 24 }}>
            Entrar na sua conta
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* E-mail */}
            <div>
              <label style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                E-MAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                disabled={loading}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: RADIUS.md, padding: '10px 14px',
                  color: C.text, fontSize: FONT.sm,
                  fontFamily: "'Inter',sans-serif", outline: 'none',
                  opacity: loading ? 0.6 : 1,
                }}
                onFocus={e => e.target.style.borderColor = C.brand}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>

            {/* Senha */}
            <div>
              <label style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                SENHA
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: C.bg, border: `1px solid ${C.border}`,
                    borderRadius: RADIUS.md, padding: '10px 40px 10px 14px',
                    color: C.text, fontSize: FONT.sm,
                    fontFamily: "'Inter',sans-serif", outline: 'none',
                    opacity: loading ? 0.6 : 1,
                  }}
                  onFocus={e => e.target.style.borderColor = C.brand}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: C.textMuted, fontSize: 14, padding: 0,
                  }}
                >{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div style={{
                background: C.desp + '18', border: `1px solid ${C.desp}44`,
                borderRadius: RADIUS.sm, padding: '10px 14px',
                fontSize: FONT.xs, color: C.desp, lineHeight: 1.5,
              }}>
                {erro}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? C.brand + '88' : C.brand,
                border: 'none', borderRadius: RADIUS.md,
                color: C.bg, fontSize: FONT.sm, fontWeight: 700,
                fontFamily: "'Inter',sans-serif", cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background .15s', marginTop: 4,
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Rodapé */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: FONT.xs, color: C.textDim }}>
          {APP_COMPANY} · {APP_TAGLINE}
        </div>
      </div>
    </div>
  );
}
