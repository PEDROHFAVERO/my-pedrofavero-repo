import { useApp, useHub } from './context/AppContext.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { FONT } from './design/tokens.js';
import { APP_NAME, LOGO_URL } from './lib/appConfig.js';
import React, { lazy, Suspense, useState, useCallback, useEffect, useRef } from 'react';
import NotasFloat from './components/NotasFloat.jsx';
import { SaveBar, CheckpointFab } from './components/SaveBar.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Sidebar } from './components/Sidebar.jsx';

// lazy: cada página só é carregada quando acessada pela 1ª vez
const PageHub            = lazy(() => import('./pages/PageHub.jsx'));
const PageDashboard      = lazy(() => import('./pages/PageDashboard.jsx'));
const PagePlanejador     = lazy(() => import('./pages/PagePlanejador.jsx'));
const PageCategorizador  = lazy(() => import('./pages/PageCategorizador.jsx'));
const PageBotWhatsapp    = lazy(() => import('./pages/PageBotWhatsapp.jsx'));
const PageLogin          = lazy(() => import('./pages/PageLogin.jsx'));
const PageManagerHub     = lazy(() => import('./pages/PageManagerHub.jsx'));
const PageBacklog        = lazy(() => import('./pages/PageBacklog.jsx'));
const PageOrcamento      = lazy(() => import('./pages/PageOrcamento.jsx'));
const PageFluxoWhatsapp      = lazy(() => import('./pages/PageFluxoWhatsapp.jsx'));
const PageHistoricoVersoes   = lazy(() => import('./pages/PageHistoricoVersoes.jsx'));

// ── Spinner ───────────────────────────────────────────────────────────────────
function PageSpinner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', color: 'var(--c-text-muted)', fontSize: FONT.sm,
      background: 'var(--c-bg)', fontFamily: "'Inter',sans-serif",
    }}>
      Carregando...
    </div>
  );
}

// ── Layout com sidebar ────────────────────────────────────────────────────────
// Calcula o offset esquerdo dinamicamente via CSS var ou estado
function AppLayout({ children, sidebarWidth }) {
  return (
    <div style={{
      marginLeft: sidebarWidth,
      minHeight: '100vh',
      background: 'var(--c-bg)',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: 'var(--c-text)',
      transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {children}
    </div>
  );
}

// ── Router para planejador ────────────────────────────────────────────────────
function Router() {
  const { paginaAtual, setPaginaAtual, clienteAtivo, patchClienteAtivo, voltarHub, modoLeitura, salvando, erroSalvar, isDirty, forceSave, criarCheckpoint } = useApp();
  const { sessao, logout, managerViewing, limparManagerViewing } = useAuth();
  const { hubCarregado } = useHub();

  const [notasAberto, setNotasAberto] = useState(false);
  const [visitadas, setVisitadas]     = useState(() => new Set([paginaAtual]));
  // Rastreia largura atual da sidebar para offset do conteúdo
  const [sidebarW, setSidebarW] = useState(() => {
    try { return localStorage.getItem('b2if-sidebar') === 'collapsed' ? 64 : 220; }
    catch { return 220; }
  });

  const handleNotasChange = useCallback((html) => {
    patchClienteAtivo({ notas: html });
  }, [patchClienteAtivo]);

  // Quando o cliente ativo muda, resetamos o Set de visitadas para que todas as
  // páginas remontadas pelo Fragment key recomecem apenas com a página atual.
  const prevClienteIdRef = useRef(clienteAtivo?.id);
  useEffect(() => {
    if (clienteAtivo?.id && clienteAtivo.id !== prevClienteIdRef.current) {
      prevClienteIdRef.current = clienteAtivo.id;
      setVisitadas(new Set([paginaAtual]));
    }
  }, [clienteAtivo?.id, paginaAtual]);

  if (!visitadas.has(paginaAtual)) {
    setVisitadas(prev => new Set([...prev, paginaAtual]));
  }

  if (!hubCarregado) return <PageSpinner />;

  const sessaoNome = clienteAtivo?.nome || sessao?.perfil?.nome || '';

  // Observa mudanças na sidebar via localStorage para ajustar offset
  const handleSidebarToggle = () => {
    // O Sidebar persiste sozinho; nós lemos depois via evento de storage ou simplesmente
    // deixamos o CSS transition cuidar da transição visual.
    // Abordagem simples: re-sincroniza o sidebarW após a animação
    setTimeout(() => {
      try {
        const col = localStorage.getItem('b2if-sidebar') === 'collapsed';
        setSidebarW(col ? 64 : 220);
      } catch {}
    }, 300);
  };

  return (
    <>
      <Sidebar
        paginaAtual={paginaAtual}
        setPaginaAtual={setPaginaAtual}
        voltarHub={voltarHub}
        modoCliente={false}
        modoLeitura={modoLeitura}
        clienteAtivo={clienteAtivo}
        sessaoNome={sessaoNome}
        managerViewing={managerViewing}
        limparManagerViewing={limparManagerViewing}
        onToggleNotas={() => setNotasAberto(o => !o)}
        notasAberto={notasAberto}
        salvando={salvando}
        erroSalvar={erroSalvar}
        onLogout={logout}
        isEditor={true}
      />

      <AppLayout sidebarWidth={sidebarW}>
        <Suspense fallback={<PageSpinner />}>
          {/* key={clienteAtivo?.id} força remount de todas as páginas ao trocar de cliente,
              eliminando o React error #300 causado por estado stale do cliente anterior */}
          <React.Fragment key={clienteAtivo?.id || 'no-client'}>
            {visitadas.has('hub') && (
              <div style={{ display: paginaAtual === 'hub' ? 'block' : 'none' }}>
                <ErrorBoundary pagina="Hub"><PageHub /></ErrorBoundary>
              </div>
            )}
            {visitadas.has('dashboard') && (
              <div style={{ display: paginaAtual === 'dashboard' ? 'block' : 'none' }}>
                <ErrorBoundary pagina="Dashboard"><PageDashboard /></ErrorBoundary>
              </div>
            )}
            {visitadas.has('planejador') && (
              <div style={{ display: paginaAtual === 'planejador' ? 'block' : 'none' }}>
                <ErrorBoundary pagina="Planejador"><PagePlanejador /></ErrorBoundary>
              </div>
            )}
            {visitadas.has('categorizador') && (
              <div style={{ display: paginaAtual === 'categorizador' ? 'block' : 'none' }}>
                <ErrorBoundary pagina="Fluxo Financeiro"><PageCategorizador /></ErrorBoundary>
              </div>
            )}
            {visitadas.has('bot-whatsapp') && (
              <div style={{ display: paginaAtual === 'bot-whatsapp' ? 'block' : 'none' }}>
                <ErrorBoundary pagina="Bot WhatsApp"><PageBotWhatsapp /></ErrorBoundary>
              </div>
            )}
            {visitadas.has('backlog') && (
              <div style={{ display: paginaAtual === 'backlog' ? 'block' : 'none' }}>
                <ErrorBoundary pagina="Backlog"><PageBacklog onVoltar={() => setPaginaAtual('hub')} /></ErrorBoundary>
              </div>
            )}
            {visitadas.has('orcamento') && (
              <div style={{ display: paginaAtual === 'orcamento' ? 'block' : 'none' }}>
                <ErrorBoundary pagina="Orçamento"><PageOrcamento /></ErrorBoundary>
              </div>
            )}
            {visitadas.has('fluxo-whatsapp') && (
              <div style={{ display: paginaAtual === 'fluxo-whatsapp' ? 'block' : 'none' }}>
                <ErrorBoundary pagina="Fluxo WhatsApp"><PageFluxoWhatsapp /></ErrorBoundary>
              </div>
            )}
            {visitadas.has('historico-versoes') && (
              <div style={{ display: paginaAtual === 'historico-versoes' ? 'block' : 'none' }}>
                <ErrorBoundary pagina="Histórico de Versões"><PageHistoricoVersoes /></ErrorBoundary>
              </div>
            )}
          </React.Fragment>
        </Suspense>

        <NotasFloat
          open={notasAberto}
          onClose={() => setNotasAberto(false)}
          value={clienteAtivo?.notas || ''}
          onChange={handleNotasChange}
          clienteNome={clienteAtivo?.nome}
          onForceSave={forceSave}
        />

        {/* Botão Salvar global — canto inferior direito, some só ao clicar */}
        {clienteAtivo && !modoLeitura && (
          <SaveBar
            isDirty={isDirty}
            salvando={salvando}
            erroSalvar={erroSalvar}
            onSave={forceSave}
          />
        )}

        {/* Checkpoint FAB — sempre visível quando há cliente ativo + não leitura */}
        {clienteAtivo && !modoLeitura && (
          <CheckpointFab
            onCheckpoint={criarCheckpoint}
            saveBarVisible={isDirty}
          />
        )}
      </AppLayout>
    </>
  );
}

// ── Router para cliente ───────────────────────────────────────────────────────
function RouterCliente({ isEditor = false }) {
  const { paginaAtual, setPaginaAtual, clienteAtivo, criarCheckpoint, isDirty, modoLeitura, salvando, erroSalvar, forceSave } = useApp();
  const { hubCarregado } = useHub();
  const { sessao, logout } = useAuth();
  const [visitadas, setVisitadas] = useState(() => new Set(['dashboard']));
  const [sidebarW, setSidebarW] = useState(() => {
    try { return localStorage.getItem('b2if-sidebar') === 'collapsed' ? 64 : 220; }
    catch { return 220; }
  });

  if (!visitadas.has(paginaAtual)) {
    setVisitadas(prev => new Set([...prev, paginaAtual]));
  }

  if (!hubCarregado) return <PageSpinner />;

  if (!clienteAtivo) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 16,
        fontFamily: "'Inter',sans-serif", color: 'var(--c-text-muted)', background: 'var(--c-bg)',
      }}>
        <span style={{ fontSize: 14 }}>Não foi possível carregar seus dados.</span>
        <span style={{ fontSize: 12, color: 'var(--c-text-dim)' }}>Tente novamente ou contacte seu planejador.</span>
        <button
          onClick={logout}
          style={{ marginTop: 8, padding: '8px 20px', background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 6, color: 'var(--c-text-muted)', cursor: 'pointer', fontSize: 13 }}
        >Sair</button>
      </div>
    );
  }

  const sessaoNome = sessao?.perfil?.nome || clienteAtivo?.nome || '';

  return (
    <>
      <Sidebar
        paginaAtual={paginaAtual}
        setPaginaAtual={setPaginaAtual}
        voltarHub={null}
        modoCliente={true}
        modoLeitura={false}
        clienteAtivo={clienteAtivo}
        sessaoNome={sessaoNome}
        managerViewing={null}
        limparManagerViewing={null}
        onToggleNotas={null}
        notasAberto={false}
        salvando={isEditor ? salvando : false}
        erroSalvar={isEditor ? erroSalvar : null}
        onLogout={logout}
        isEditor={isEditor}
      />
      <AppLayout sidebarWidth={sidebarW}>
        <Suspense fallback={<PageSpinner />}>
          {visitadas.has('dashboard') && (
            <div style={{ display: paginaAtual === 'dashboard' ? 'block' : 'none' }}>
              <ErrorBoundary pagina="Dashboard"><PageDashboard /></ErrorBoundary>
            </div>
          )}
          {visitadas.has('categorizador') && (
            <div style={{ display: paginaAtual === 'categorizador' ? 'block' : 'none' }}>
              <ErrorBoundary pagina="Fluxo Financeiro"><PageCategorizador /></ErrorBoundary>
            </div>
          )}
          {isEditor && visitadas.has('historico-versoes') && (
            <div style={{ display: paginaAtual === 'historico-versoes' ? 'block' : 'none' }}>
              <ErrorBoundary pagina="Histórico de Versões"><PageHistoricoVersoes /></ErrorBoundary>
            </div>
          )}
        </Suspense>

        {/* SaveBar — cliente editor vê o indicador de salvamento igual ao planejador */}
        {isEditor && clienteAtivo && !modoLeitura && (
          <SaveBar
            isDirty={isDirty}
            salvando={salvando}
            erroSalvar={erroSalvar}
            onSave={forceSave}
          />
        )}

        {/* Checkpoint FAB — sempre visível para cliente editor com cliente ativo */}
        {isEditor && clienteAtivo && !modoLeitura && (
          <CheckpointFab
            onCheckpoint={criarCheckpoint}
            saveBarVisible={isDirty}
          />
        )}
      </AppLayout>
    </>
  );
}

// ── HubWrapper (sem cliente ativo — só Hub standalone) ─────────────────────────
function HubWrapper() {
  const { logout, managerViewing, limparManagerViewing } = useAuth();
  const { paginaAtual, setPaginaAtual } = useApp();
  const [sidebarW, setSidebarW] = useState(() => {
    try { return localStorage.getItem('b2if-sidebar') === 'collapsed' ? 64 : 220; }
    catch { return 220; }
  });

  // No HubWrapper só temos a aba backlog além do hub
  const pagina = paginaAtual === 'backlog' ? 'backlog' : 'hub';

  return (
    <>
      <Sidebar
        paginaAtual={pagina}
        setPaginaAtual={setPaginaAtual}
        voltarHub={() => setPaginaAtual('hub')}
        modoCliente={false}
        modoLeitura={false}
        clienteAtivo={null}
        sessaoNome={managerViewing?.nome || ''}
        managerViewing={managerViewing}
        limparManagerViewing={limparManagerViewing}
        onToggleNotas={null}
        notasAberto={false}
        salvando={false}
        erroSalvar={null}
        onLogout={logout}
      />
      <AppLayout sidebarWidth={sidebarW}>
        {pagina === 'hub'
          ? <PageHub />
          : (
            <Suspense fallback={<PageSpinner />}>
              <ErrorBoundary pagina="Backlog">
                <PageBacklog onVoltar={() => setPaginaAtual('hub')} />
              </ErrorBoundary>
            </Suspense>
          )
        }
      </AppLayout>
    </>
  );
}

// ── Root com hub/router ────────────────────────────────────────────────────────
function HubOrBacklog() {
  const { paginaAtual, setPaginaAtual } = useApp();
  const { hubCarregado } = useHub();

  if (!hubCarregado) return <PageSpinner />;

  if (paginaAtual === 'backlog') {
    return (
      <Suspense fallback={<PageSpinner />}>
        <ErrorBoundary pagina="Backlog">
          <PageBacklog onVoltar={() => setPaginaAtual('hub')} />
        </ErrorBoundary>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageSpinner />}>
      <HubWrapper />
    </Suspense>
  );
}

// ── Raiz da aplicação ─────────────────────────────────────────────────────────
function AppRoot() {
  const { sessao, carregando, isManager, isCliente, managerViewing } = useAuth();

  if (carregando) return <PageSpinner />;

  if (!sessao) {
    return (
      <Suspense fallback={<PageSpinner />}>
        <ErrorBoundary pagina="Login"><PageLogin /></ErrorBoundary>
      </Suspense>
    );
  }

  if (isManager && !managerViewing) {
    return (
      <Suspense fallback={<PageSpinner />}>
        <ErrorBoundary pagina="Painel Manager"><PageManagerHub /></ErrorBoundary>
      </Suspense>
    );
  }

  if (isCliente) {
    const isEditor = sessao.modoAcesso === 'editor';
    return (
      <AppProvider
        userId={sessao.user.id}
        clienteIdFixo={sessao.clienteId}
        modoClienteFixo={true}
        modoLeituraFixo={!isEditor}
        autorTipo="cliente"
        autorNome={sessao.perfil?.nome || 'Cliente'}
      >
        <RouterCliente isEditor={isEditor} />
      </AppProvider>
    );
  }

  const planejadorUserId = managerViewing?.id ?? sessao.user.id;
  const autorTipo = managerViewing ? 'manager' : 'planejador';
  const autorNome = sessao.perfil?.nome || (managerViewing ? 'Manager' : 'Planejador');

  return (
    <AppProvider userId={planejadorUserId} autorTipo={autorTipo} autorNome={autorNome}>
      <Router />
    </AppProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </ThemeProvider>
  );
}
