import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  criarClienteVazio, lerClienteDoLink, sincronizarCategorias, migrarTransacoesLegadas,
} from '../utils/clienteStorage.js';
import {
  carregarClientes,
  carregarClientePorId,
  salvarCliente,
  removerCliente as removerClienteDB,
  renomearCliente as renomearClienteDB,
  criarVersao,
  calcularHashDados,
} from '../services/cliente/clienteService.js';

// ── URL da Edge Function save-beacon ─────────────────────────────────────────
const BEACON_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-beacon`;
const ANON_KEY   = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── Inatividade antes de criar versão automática (2 minutos sem edição) ────────
const VERSAO_INATIVIDADE_MS = 2 * 60 * 1000;
// ── Intervalo mínimo entre versões automáticas (evita criar 2x seguidas) ────────
const VERSAO_MIN_INTERVALO_MS = 5 * 60 * 1000;
// ── Guard entre versões de categorias (30s — evita flood ao renomear várias seguidas) ──
const VERSAO_CATEGORIAS_MIN_MS = 30 * 1000;

const HubContext     = createContext(null);
const ClienteContext = createContext(null);

// Helpers Supabase extraídos para src/services/cliente/clienteService.js (Fase 2)

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppProvider({
  children, userId, clienteIdFixo = null, modoClienteFixo = false, modoLeituraFixo = null,
  // Dados do autor para rastrear quem fez alterações no histórico de versões
  autorTipo = 'planejador',   // 'planejador' | 'cliente' | 'manager'
  autorNome = '',             // nome legível do usuário logado
}) {
  // userId: vem do AuthContext (usuário logado)
  // clienteIdFixo: quando role=cliente, o cliente já é determinado no login
  // modoClienteFixo: true → restringe abas a Dashboard + Fluxo (sempre para clientes)
  // modoLeituraFixo: controla edição independente; null = usa modoClienteFixo como fallback
  // userId já é o ID correto: App.jsx passa managerViewing.id quando manager visualiza
  const planejadorId = userId;

  // modoLeitura: true = só visualiza, false = pode editar
  // Se modoLeituraFixo for passado explicitamente, usa ele; senão herda de modoClienteFixo
  const modoLeituraInicial = modoLeituraFixo !== null ? modoLeituraFixo : modoClienteFixo;

  const [hub, setHub]                         = useState({ clientes: [] });
  const [clienteAtivo, setClienteAtivoState]  = useState(null);
  const [modoLeitura, setModoLeitura]         = useState(modoLeituraInicial);
  const [modoCliente, setModoCliente]         = useState(modoClienteFixo);
  const [paginaAtual, setPaginaAtualState]    = useState(modoClienteFixo ? 'dashboard' : 'hub');
  const [hubCarregado, setHubCarregado]       = useState(false);

  // ── Período global sincronizado entre Dashboard e Planejador ──────────────
  const [periodoAtivo, setPeriodoAtivoState]  = useState(new Date().getMonth()); // 0-11

  // Persiste página ativa no localStorage para sobreviver ao reload
  const setPaginaAtual = useCallback((pagina) => {
    setPaginaAtualState(pagina);
    try { localStorage.setItem('b2if_pagina_ativa', pagina); } catch {}
  }, []);

  const debounceRef             = useRef(null);
  const hubRef                  = useRef(hub);
  const versaoInativoRef        = useRef(null);   // timer de inatividade para versão automática
  const ultimoHashRef           = useRef(null);   // hash da última versão criada (evita duplicatas)
  const ultimaVersaoEmRef       = useRef(null);   // timestamp da última versão criada
  const ultimaVersaoCategoriasRef = useRef(null); // timestamp da última versão de categorias
  const houveMudancaRef         = useRef(false);  // flag: houve edição desde a última versão
  const workspaceIdRef          = useRef(null);   // workspace_id do planejador (para versões)
  const [salvando, setSalvando]     = useState(false);
  const [erroSalvar, setErroSalvar] = useState(null);
  const [isDirty, setIsDirty]       = useState(false);
  useEffect(() => { hubRef.current = hub; }, [hub]);

  // ── Resolve workspace_id uma vez ao montar ────────────────────────────────
  // workspace_id = planejadorId (RPC get_my_workspace_id não existe no projeto)
  useEffect(() => {
    if (!planejadorId) return;
    workspaceIdRef.current = planejadorId;
  }, [planejadorId]);

  // ── Carrega clientes do Supabase ao montar ──────────────────────────────────
  useEffect(() => {
    if (!planejadorId) return;

    // Modo cliente fixo: carrega diretamente o cliente vinculado ao login
    if (modoClienteFixo && clienteIdFixo) {
      carregarClientePorId(clienteIdFixo)
        .then(cliente => {
          console.log('[AppContext] carregar cliente fixo:', { cliente, clienteIdFixo });
          if (cliente) setClienteAtivoState(cliente);
          else console.error('[AppContext] cliente não encontrado:', clienteIdFixo);
        })
        .catch(err => console.error('[AppContext] falha ao carregar cliente:', err))
        .finally(() => setHubCarregado(true));
      return;
    }

    // Verifica link de leitura primeiro
    const clienteLink = lerClienteDoLink();
    if (clienteLink) {
      setClienteAtivoState(clienteLink);
      setModoLeitura(true);
      setPaginaAtual('dashboard');
      setHubCarregado(true);
      return;
    }

    carregarClientes(planejadorId).then(clientes => {
      const novoHub = { clientes };
      setHub(novoHub);
      hubRef.current = novoHub;

      // Restaura sessão anterior: cliente e página salvos no localStorage
      try {
        const clienteIdSalvo = localStorage.getItem('b2if_cliente_ativo_id');
        const paginaSalva    = localStorage.getItem('b2if_pagina_ativa');
        if (clienteIdSalvo) {
          const c = clientes.find(x => x.id === clienteIdSalvo);
          if (c) {
            const cAtualizado = { ...JSON.parse(JSON.stringify(c)), categorias: sincronizarCategorias(c.categorias, c.setupCompleto) };
            cAtualizado.transacoes = migrarTransacoesLegadas(cAtualizado.transacoes);
            setClienteAtivoState(cAtualizado);
            // Restaura página válida (dashboard, categorizador, planejador)
            const paginasValidas = ['dashboard', 'categorizador', 'planejador'];
            if (paginaSalva && paginasValidas.includes(paginaSalva)) {
              setPaginaAtualState(paginaSalva);
            } else {
              setPaginaAtualState('dashboard');
            }
          }
        }
      } catch {}

      setHubCarregado(true);
    }).catch(err => {
      console.error('Erro ao carregar clientes:', err);
      setHubCarregado(true);
    });
  }, [planejadorId]);

  // ── Realtime: atualiza clienteAtivo quando a edge function salvar pelo WhatsApp ──
  // Usa ref para evitar closure stale: sempre compara com o estado mais recente
  const clienteAtivoRef = useRef(clienteAtivo);
  useEffect(() => { clienteAtivoRef.current = clienteAtivo; }, [clienteAtivo]);

  useEffect(() => {
    if (!clienteAtivo?.id) return;

    const channel = supabase
      .channel(`cliente-wpp-${clienteAtivo.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'clientes',
          filter: `id=eq.${clienteAtivo.id}`,
        },
        (payload) => {
          const novosDados = payload.new?.dados;
          if (!novosDados) return;

          // Usa ref para acessar estado atual sem fechar sobre ele
          const atual = clienteAtivoRef.current;
          const novaTransacoes   = novosDados.transacoes    ?? [];
          const atualTransacoes  = atual?.transacoes         ?? [];
          const novaTransacoesBot  = novosDados.transacoesBot ?? [];
          const atualTransacoesBot = atual?.transacoesBot     ?? [];
          const novoAtualizadoEm  = novosDados.atualizadoEm ?? '';
          const atualAtualizadoEm = atual?.atualizadoEm ?? '';

          // PROTEÇÃO RACE CONDITION: Se há debounce local pendente, o usuário está
          // editando agora. Para transacoesBot (gravadas pelo WhatsApp bot), sempre
          // aplicamos o merge mesmo com debounce ativo — nunca descartamos lançamentos do bot.
          const temDebounce = debounceRef.current !== null;

          // Detectar se cresceu transacoesBot (lançamento novo do WhatsApp bot)
          const botGrowth = novaTransacoesBot.length > atualTransacoesBot.length;

          if (botGrowth) {
            // Merge cirúrgico: preservar edições locais + adicionar entradas novas do banco
            console.log('[Realtime] transacoesBot cresceu — merge cirúrgico...',
              atualTransacoesBot.length, '->', novaTransacoesBot.length);
            setClienteAtivoState(prev => {
              const prevBot = prev?.transacoesBot ?? [];
              const mapaFinal = new Map(novaTransacoesBot.map(t => [t.id, t]));
              // Entradas locais sobrescrevem (edições do usuário têm prioridade)
              for (const t of prevBot) mapaFinal.set(t.id, t);
              return {
                ...prev,
                transacoesBot: Array.from(mapaFinal.values()),
              };
            });
            return;
          }

          if (temDebounce) {
            console.log('[Realtime] Ignorando update — edição local em andamento (debounce ativo)');
            return;
          }

          // Atualiza APENAS se novas transações chegaram via outra aba/import
          // NÃO usa atualizadoEm para decidir — isso causava sobrescrita das edições locais
          // (qualquer save do frontend muda atualizadoEm e o Realtime sobrescrevia tudo)
          const deveAtualizar = novaTransacoes.length > atualTransacoes.length;

          if (deveAtualizar) {
            console.log('[Realtime] Novas transações detectadas — merge cirúrgico...');
            // BUG2 FIX: Merge campo a campo — NUNCA sobrescreve categorias, planejamento,
            // regras, notas, contas, contasAPagar com dados do banco.
            // Apenas transacoes e transacoesBot são atualizadas pelo Realtime.
            setClienteAtivoState(prev => {
              // Merge de transacoes: banco tem mais → adiciona as novas, preserva locais
              const mapaLocal = new Map((prev?.transacoes ?? []).map(t => [t.id, t]));
              for (const t of novaTransacoes) {
                if (!mapaLocal.has(t.id)) mapaLocal.set(t.id, t); // só adiciona novas
              }
              const transacoesMerged = Array.from(mapaLocal.values());

              return {
                ...prev,
                // Apenas estes campos são atualizados pelo Realtime:
                transacoes: transacoesMerged,
                // transacoesBot já tratado no bloco botGrowth acima
                // Tudo o mais (categorias, planejamento, regras, notas, contas) vem do estado local
                id: prev.id,
                nome: prev.nome,
              };
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clienteAtivo?.id]);

  // ── Refs de flush (sempre atualizados, sem closure stale) ──────────────────
  // DEVE vir antes de criarVersaoSeNecessarioRef (que usa flushRef internamente)
  const flushRef = useRef(null);
  useEffect(() => {
    flushRef.current = { clienteAtivo, modoLeitura, planejadorId };
  }, [clienteAtivo, modoLeitura, planejadorId]);

  // ── Helper core: cria versão se o conteúdo mudou (verifica hash) ────────────
  // Usa refs para todos os valores mutáveis — sem closure stale, sem recriação
  const criarVersaoSeNecessarioRef = useRef(null);
  criarVersaoSeNecessarioRef.current = async (cliente, motivo, titulo = null, ttlDias = 90) => {
    const snap = flushRef.current;
    if (!cliente?.id || !snap?.planejadorId || snap?.modoLeitura) return;
    try {
      const { id, nome, criadoEm, atualizadoEm, ...dados } = cliente;
      const hash = await calcularHashDados(dados);
      // Guard de hash: bloqueia apenas versões automáticas com conteúdo idêntico.
      // 'manual' e 'projecao' sempre criam versão — o usuário pediu explicitamente.
      const bloqueadoPorHash = hash === ultimoHashRef.current;
      if (bloqueadoPorHash && motivo === 'auto') return;
      // Intervalo mínimo entre versões automáticas (não se aplica a checkpoint/manual)
      if (motivo === 'auto') {
        const agora = Date.now();
        if (ultimaVersaoEmRef.current && (agora - ultimaVersaoEmRef.current) < VERSAO_MIN_INTERVALO_MS) return;
      }
      await criarVersao({
        clienteId:   id,
        planejadorId: snap.planejadorId,
        workspaceId: workspaceIdRef.current,
        dados,
        autorTipo,
        autorId:     userId,
        autorNome:   autorNome || 'Planejador',
        motivo,
        titulo,
        ttlDias,
      });
      ultimoHashRef.current = hash;
      ultimaVersaoEmRef.current = Date.now();
      houveMudancaRef.current = false;
      console.log(`[versão] snapshot criado: motivo=${motivo}`);
    } catch (err) {
      // Versão não criada — não bloqueia o fluxo principal
      console.warn('[versão] falha ao criar snapshot:', err?.message);
    }
  };

  // Wrapper estável (referência nunca muda — seguro para usar em callbacks e deps)
  const criarVersaoSeNecessario = useCallback((cliente, motivo, titulo, ttlDias) => {
    return criarVersaoSeNecessarioRef.current?.(cliente, motivo, titulo, ttlDias);
  }, []); // sem deps — usa ref internamente

  // ── Versão imediata de categorias ──────────────────────────────────────────
  // Chamada pelos handlers CRUD de categorias (criar, renomear, deletar, mover).
  // Dispara versão IMEDIATAMENTE após a edição — não espera inatividade.
  // Guard de 30s evita flood ao renomear várias subcategorias em sequência.
  // Não cancela o timer de inatividade (outros tipos de mudança podem coexistir).
  const criarVersaoCategorias = useCallback(async (clienteComCategorias) => {
    const agora = Date.now();
    const ultima = ultimaVersaoCategoriasRef.current;
    if (ultima && (agora - ultima) < VERSAO_CATEGORIAS_MIN_MS) {
      // Ainda dentro do guard de 30s — ignora (evita flood)
      return;
    }
    ultimaVersaoCategoriasRef.current = agora;
    // Salva o estado atualizado no banco antes de versionar
    const snap = flushRef.current;
    if (!snap?.planejadorId || snap?.modoLeitura) return;
    try {
      await salvarCliente(snap.planejadorId, clienteComCategorias);
    } catch {}
    // Cria a versão de categorias (ttl = 90 dias, motivo = 'categorias')
    await criarVersaoSeNecessarioRef.current?.(clienteComCategorias, 'categorias');
  }, []);  // sem deps — usa refs internamente

  // ── Debounce salvar no Supabase (800ms) ────────────────────────────────────
  const agendarSalvarCliente = useCallback((cliente) => {
    if (modoLeitura || !planejadorId) return;
    clearTimeout(debounceRef.current);
    setIsDirty(true);
    setSalvando(false);
    setErroSalvar(null);

    // ── Opção C: versão por inatividade ───────────────────────────────────────
    // Marca que houve mudança e (re)agenda timer de 2 minutos de inatividade.
    // Se o usuário continuar editando, o timer é reiniciado a cada save.
    // Quando ficar 2 min parado, cria versão automática com o estado atual.
    houveMudancaRef.current = true;
    clearTimeout(versaoInativoRef.current);
    versaoInativoRef.current = setTimeout(() => {
      const snapAtual = flushRef.current;
      if (!snapAtual?.clienteAtivo || snapAtual.modoLeitura || !snapAtual.planejadorId) return;
      criarVersaoSeNecessarioRef.current?.(snapAtual.clienteAtivo, 'auto');
    }, VERSAO_INATIVIDADE_MS);

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setSalvando(true);
      salvarCliente(planejadorId, cliente)
        .catch(err => {
          console.error('[save] Erro ao salvar cliente:', err);
          setErroSalvar('Erro ao salvar. Verifique sua conexão ou use o botão Salvar.');
          setTimeout(() => setErroSalvar(null), 8000);
        })
        .finally(() => setSalvando(false));
    }, 800);
  }, [modoLeitura, planejadorId]);

  // ── Force save: salva + cria versão manual ────────────────────────────────
  const forceSave = useCallback(async () => {
    const snap = flushRef.current;
    if (!snap?.clienteAtivo || snap.modoLeitura || !snap.planejadorId) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
    setSalvando(true);
    setErroSalvar(null);
    try {
      await salvarCliente(snap.planejadorId, snap.clienteAtivo);
      // Cria versão manual ao salvar explicitamente
      await criarVersaoSeNecessario(snap.clienteAtivo, 'manual');
      setIsDirty(false);
    } catch (err) {
      console.error('[forceSave] Erro:', err);
      setErroSalvar('Erro ao salvar. Verifique sua conexão.');
      setTimeout(() => setErroSalvar(null), 8000);
      throw err;
    } finally {
      setSalvando(false);
    }
  }, [criarVersaoSeNecessario]);

  // ── Checkpoint manual: salva versão permanente com nome ───────────────────
  const criarCheckpoint = useCallback(async (titulo) => {
    const snap = flushRef.current;
    if (!snap?.clienteAtivo || snap.modoLeitura || !snap.planejadorId) return;
    // Salva o estado atual no banco primeiro
    await salvarCliente(snap.planejadorId, snap.clienteAtivo);
    // Cria versão permanente (ttlDias = null = nunca expira)
    const { id, nome, criadoEm, atualizadoEm, ...dados } = snap.clienteAtivo;
    await criarVersao({
      clienteId:   id,
      planejadorId: snap.planejadorId,
      workspaceId: workspaceIdRef.current,
      dados,
      autorTipo,
      autorId:     userId,
      autorNome:   autorNome || 'Planejador',
      motivo:      'checkpoint',
      titulo:      titulo || 'Ponto de restauração',
      ttlDias:     null, // nunca expira
    });
    const hash = await calcularHashDados(dados);
    ultimoHashRef.current = hash;
    ultimaVersaoEmRef.current = Date.now();
    houveMudancaRef.current = false;
    // Cancela timer de inatividade pendente — checkpoint já cobre o estado atual
    clearTimeout(versaoInativoRef.current);
    console.log('[versão] checkpoint criado:', titulo);
  }, [planejadorId, autorTipo, autorNome, userId]);

  // ── Limpa timer de inatividade ao desmontar ──────────────────────────────────
  useEffect(() => {
    return () => clearTimeout(versaoInativoRef.current);
  }, []);

  // ── Session lock anti-multi-tab ──────────────────────────────────────────────
  // Problema: duas abas abertas no mesmo cliente podem sobrescrever dados uma da outra.
  // Solução: cada aba grava um "lock" com timestamp. Antes de fazer flush (beforeunload),
  // a aba verifica se há um lock mais recente no localStorage — se houver, ABORTA o save.
  // A aba mais recente sempre ganha (tem o estado mais atual).
  const SESSION_LOCK_KEY = 'b2if_session_lock';
  const sessionIdRef = useRef(`${Date.now()}_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (modoLeitura || !planejadorId) return;
    // Registra esta aba como a sessão mais recente
    const atualizarLock = () => {
      try {
        localStorage.setItem(SESSION_LOCK_KEY, JSON.stringify({
          sessionId: sessionIdRef.current,
          ts:        Date.now(),
          clienteId: flushRef.current?.clienteAtivo?.id ?? null,
        }));
      } catch {}
    };
    atualizarLock();
    // Renova o lock a cada 30s (prova de vida desta aba)
    const lockInterval = setInterval(atualizarLock, 30_000);
    return () => clearInterval(lockInterval);
  }, [modoLeitura, planejadorId]);

  // ── Flush ao sair: usa sendBeacon para garantir save mesmo ao fechar aba ────
  useEffect(() => {
    const flushComBeacon = async () => {
      const snap = flushRef.current;
      if (!snap?.clienteAtivo || snap.modoLeitura || !snap.planejadorId) return;

      // ── Session lock check: aborta se outra aba é mais recente ───────────
      try {
        const lockRaw = localStorage.getItem(SESSION_LOCK_KEY);
        if (lockRaw) {
          const lock = JSON.parse(lockRaw);
          const isMinhaAba       = lock.sessionId === sessionIdRef.current;
          const mesmoCliente     = lock.clienteId === snap.clienteAtivo?.id;
          const lockRecente      = (Date.now() - lock.ts) < 60_000; // < 60s
          if (!isMinhaAba && mesmoCliente && lockRecente) {
            // Outra aba mais recente está ativa com o mesmo cliente — abortamos
            console.warn('[flush] ABORTADO — outra aba mais recente tem o lock');
            return;
          }
        }
      } catch {}

      clearTimeout(debounceRef.current);
      const { id, nome, criadoEm, atualizadoEm, ...dados } = snap.clienteAtivo;

      // ── sendBeacon: garante entrega mesmo ao fechar a aba ────────────────
      // Mais confiável que fetch() no beforeunload/visibilitychange
      const beaconPayload = JSON.stringify({
        token:        ANON_KEY,
        clienteId:    id,
        planejadorId: snap.planejadorId,
        workspaceId:  workspaceIdRef.current ?? snap.planejadorId,
        dados,
        hash:         ultimoHashRef.current ?? '',
        autorTipo,
        autorId:      userId  ?? '',
        autorNome:    autorNome || 'Planejador',
        motivo:       'fechamento',
        resumo:       {},
      });

      const beaconOk = typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon(BEACON_URL, beaconPayload);

      if (!beaconOk) {
        // Fallback: fetch síncrono (keepalive) — segunda linha de defesa
        try {
          await fetch(BEACON_URL, {
            method:    'POST',
            body:      beaconPayload,
            keepalive: true,  // garante entrega mesmo após página descarregada
          });
        } catch {
          // Último recurso: salvar diretamente no Supabase
          salvarCliente(snap.planejadorId, snap.clienteAtivo)
            .catch(err => console.error('[flush-fallback] Erro:', err));
        }
      }
    };

    const onBeforeUnload = () => { flushComBeacon(); };
    const onVis = () => { if (document.visibilityState === 'hidden') flushComBeacon(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [autorTipo, autorNome, userId]); // sem deps de estado — usa refs

  // ── Ações de Hub ────────────────────────────────────────────────────────────
  const criarCliente = useCallback(async (nome, { navegarAoAbrir = true } = {}) => {
    const novo = criarClienteVazio(nome);
    await salvarCliente(planejadorId, novo);
    setHub(h => {
      const next = { ...h, clientes: [...h.clientes, novo] };
      hubRef.current = next;
      return next;
    });
    if (navegarAoAbrir) {
      setClienteAtivoState(novo);
      // Persiste ID no localStorage para sobreviver ao reload
      try { localStorage.setItem('b2if_cliente_ativo_id', novo.id); } catch {}
      setPaginaAtual('dashboard');
    }
    return novo;
  }, [planejadorId, setPaginaAtual]);

  const abrirCliente = useCallback((clienteId) => {
    const c = hubRef.current.clientes.find(x => x.id === clienteId);
    if (c) {
      const catsSincronizadas = sincronizarCategorias(c.categorias, c.setupCompleto);
      const cAtualizado = { ...JSON.parse(JSON.stringify(c)), categorias: catsSincronizadas };
      cAtualizado.transacoes = migrarTransacoesLegadas(cAtualizado.transacoes);
      setClienteAtivoState(cAtualizado);
      try { localStorage.setItem('b2if_cliente_ativo_id', clienteId); } catch {}
      setPaginaAtual('dashboard');
      // BUG7 FIX: Persistir sincronização de categorias no banco imediatamente
      // (antes só ficava em memória, perdia ao não fazer nenhuma outra edição)
      if (planejadorId) {
        salvarCliente(planejadorId, cAtualizado)
          .catch(err => console.warn('[abrirCliente] falha ao persistir sync categorias:', err?.message));
      }
    }
  }, [setPaginaAtual, planejadorId]);

  const removerCliente = useCallback(async (clienteId) => {
    await removerClienteDB(clienteId);
    setHub(h => {
      const next = { ...h, clientes: h.clientes.filter(c => c.id !== clienteId) };
      hubRef.current = next;
      return next;
    });
    setClienteAtivoState(prev => {
      if (prev?.id === clienteId) { setPaginaAtual('hub'); return null; }
      return prev;
    });
  }, []);

  const renomearCliente = useCallback(async (clienteId, novoNome) => {
    await renomearClienteDB(clienteId, novoNome);
    setHub(h => {
      const next = { ...h, clientes: h.clientes.map(c => c.id === clienteId ? { ...c, nome: novoNome } : c) };
      hubRef.current = next;
      return next;
    });
    setClienteAtivoState(prev =>
      prev?.id === clienteId ? { ...prev, nome: novoNome } : prev
    );
  }, []);

  const setClienteAtivo = useCallback((clienteOuFn) => {
    // Suporta tanto objeto direto quanto callback (prev => novoEstado),
    // igual ao setState nativo do React.
    const clienteAtualizado = typeof clienteOuFn === 'function'
      ? clienteOuFn(clienteAtivoRef.current)
      : clienteOuFn;

    // Guard: se o resultado não tem id válido, aborta silenciosamente.
    // Evita upsert com id: null que causa erro 23502 no Supabase.
    if (!clienteAtualizado?.id) {
      console.warn('[setClienteAtivo] cliente sem id — operação ignorada', clienteAtualizado);
      return;
    }

    setClienteAtivoState(clienteAtualizado);
    // Persiste ID do cliente ativo para restaurar após reload
    try {
      localStorage.setItem('b2if_cliente_ativo_id', clienteAtualizado.id);
    } catch {}
    if (modoLeitura) return;
    setHub(h => {
      const next = {
        ...h,
        clientes: h.clientes.map(c =>
          c.id === clienteAtualizado.id
            ? { ...clienteAtualizado, atualizadoEm: new Date().toISOString() }
            : c
        ),
      };
      hubRef.current = next;
      return next;
    });
    agendarSalvarCliente(clienteAtualizado);
  }, [modoLeitura, agendarSalvarCliente]);

  const salvarClienteAtivo = useCallback(() => {
    if (clienteAtivo && !modoLeitura && planejadorId) {
      salvarCliente(planejadorId, clienteAtivo)
        .catch(err => {
          console.error('[salvarClienteAtivo] Erro ao salvar:', err);
          setErroSalvar('Erro ao salvar alterações. Verifique sua conexão ou contate o suporte.');
          setTimeout(() => setErroSalvar(null), 6000);
        });
    }
  }, [clienteAtivo, modoLeitura, planejadorId]);

  const voltarHub = useCallback(() => {
    setClienteAtivoState(null);
    setIsDirty(false);
    setPaginaAtual('hub');
    try {
      localStorage.removeItem('b2if_cliente_ativo_id');
      localStorage.removeItem('b2if_pagina_ativa');
    } catch {}
  }, [setPaginaAtual]);

  // ── Setter do período global (sincroniza mes entre páginas) ────────────────
  const setPeriodoAtivo = useCallback((mes) => {
    setPeriodoAtivoState(mes);
  }, []);

  // ── Patch seguro de campos do clienteAtivo via ref ─────────────────────────
  // Usa clienteAtivoRef.current para nunca ter closure stale.
  // Ideal para callbacks de componentes externos (ex: NotasFloat) que chamam
  // onChange com debounce e podem capturar clienteAtivo desatualizado.
  const patchClienteAtivo = useCallback((campos) => {
    const atual = clienteAtivoRef.current;
    if (!atual?.id) return; // guard: sem cliente ativo, ignora
    setClienteAtivo({ ...atual, ...campos });
  }, [setClienteAtivo]);

  // ── Valores dos contextos ───────────────────────────────────────────────────
  const hubValue = { hub, criarCliente, abrirCliente, removerCliente, renomearCliente, setClienteAtivo, hubCarregado };

  const clienteValue = {
    clienteAtivo, setClienteAtivo, patchClienteAtivo,
    modoLeitura, modoCliente, paginaAtual, setPaginaAtual,
    salvarClienteAtivo, voltarHub,
    salvando,
    erroSalvar,
    isDirty,
    forceSave,
    criarCheckpoint,           // fn async(titulo): cria versão permanente com nome
    criarVersaoSeNecessario,   // fn async(cliente, motivo): snapshot se conteúdo mudou
    criarVersaoCategorias,     // fn async(cliente): versão imediata após CRUD de categorias
    periodoAtivo, setPeriodoAtivo,
    planejadorId,              // userId do planejador (necessário para restaurarVersao)
    autorTipo, autorNome,      // metadados do autor para componentes que criam versões
  };

  return (
    <HubContext.Provider value={hubValue}>
      <ClienteContext.Provider value={clienteValue}>
        {children}
      </ClienteContext.Provider>
    </HubContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(ClienteContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
  return ctx;
}

export function useHub() {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error('useHub deve ser usado dentro de AppProvider');
  return ctx;
}
