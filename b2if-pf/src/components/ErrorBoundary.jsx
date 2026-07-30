/**
 * ErrorBoundary.jsx — Barreira de erro React para evitar tela branca
 *
 * Envolve cada página lazy-loaded. Se um componente filho lançar um erro
 * durante o render, exibe uma UI de fallback amigável em vez de crash total.
 *
 * Uso:
 *   <ErrorBoundary pagina="Fluxo Financeiro">
 *     <PageCategorizador />
 *   </ErrorBoundary>
 */
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { C, FONT, RADIUS } from '../design/tokens.js';

/**
 * Componente de fallback exibido quando ocorre um erro não capturado.
 * @param {{ error: Error, resetErrorBoundary: () => void, pagina?: string }} props
 */
function FallbackUI({ error, resetErrorBoundary, pagina }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '40px 24px',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{
        background: C.card,
        border: `1px solid ${C.desp}40`,
        borderRadius: RADIUS.lg,
        padding: '32px 40px',
        maxWidth: 520,
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Ícone */}
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>

        {/* Título */}
        <div style={{ fontSize: FONT.lg, fontWeight: 700, color: C.text, marginBottom: 8 }}>
          Algo deu errado{pagina ? ` em ${pagina}` : ''}
        </div>

        {/* Mensagem de erro */}
        <div style={{
          fontSize: FONT.sm,
          color: C.textMuted,
          marginBottom: 24,
          lineHeight: 1.6,
        }}>
          Ocorreu um erro inesperado. Seus dados não foram perdidos.
        </div>

        {/* Detalhes técnicos (colapsados) */}
        <details style={{ marginBottom: 24, textAlign: 'left' }}>
          <summary style={{
            fontSize: FONT.xs,
            color: C.textDim,
            cursor: 'pointer',
            marginBottom: 8,
          }}>
            Detalhes técnicos
          </summary>
          <pre style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: RADIUS.sm,
            padding: '10px 12px',
            fontSize: 11,
            color: C.desp,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {error?.message || String(error)}
          </pre>
        </details>

        {/* Ações */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={resetErrorBoundary}
            style={{
              background: C.brand,
              color: '#fff',
              border: 'none',
              borderRadius: RADIUS.md,
              padding: '10px 24px',
              fontSize: FONT.sm,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Tentar novamente
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'transparent',
              color: C.textMuted,
              border: `1px solid ${C.border}`,
              borderRadius: RADIUS.md,
              padding: '10px 24px',
              fontSize: FONT.sm,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Recarregar página
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper do ErrorBoundary com logging de erros.
 *
 * @param {{ children: React.ReactNode, pagina?: string }} props
 */
export function ErrorBoundary({ children, pagina }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <FallbackUI
          error={error}
          resetErrorBoundary={resetErrorBoundary}
          pagina={pagina}
        />
      )}
      onError={(error, info) => {
        // Log estruturado — no futuro integrar com Sentry/LogRocket
        console.error('[ErrorBoundary]', {
          pagina,
          error: error?.message,
          componentStack: info?.componentStack?.substring(0, 500),
        });
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

export default ErrorBoundary;
