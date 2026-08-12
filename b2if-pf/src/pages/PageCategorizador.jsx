import { useState, useRef, useEffect } from 'react';
import { Download, Upload, Pencil, X, Check } from 'lucide-react';
import { C, FONT, RADIUS } from '../design/tokens.js';
import { useApp } from '../context/AppContext.jsx';
import { Btn, Card, Badge, fmtBRL } from '../components/UI.jsx';
import { parseCSV, parseXLSM, autoCategorizar } from '../utils/parser.js';

import { GRUPOS, REGRAS_PADRAO } from '../data/categorias.js';
import { gerarId } from '../utils/clienteStorage.js';
import { marcarDuplicatas } from '../utils/fingerprint.js';
import { usePDFProcessing } from '../hooks/usePDFProcessing.js';
import { MiniBtn } from '../components/categorias/helpers.jsx';
import { useExport } from '../hooks/useExport.js';
import { useCategorias } from '../hooks/useCategorias.js';
import { useFiltros } from '../hooks/useFiltros.js';
import { AbaTransacoes } from '../components/categorias/AbaTransacoes.jsx';
import { AbaCategorias } from '../components/categorias/AbaCategorias.jsx';
import { AbaContas } from '../components/categorias/AbaContas.jsx';
import { AbaSetup } from '../components/categorias/AbaSetup.jsx';
import { ModaisCategorizador } from '../components/categorias/ModaisCategorizador.jsx';

// ── Funções puras de módulo (fora do componente React) ────────────────────────
// gerarFingerprint + marcarDuplicatas → extraídas para src/utils/fingerprint.js

// useVirtualList desativado: renderiza tudo diretamente.
// Com ate ~500 linhas, o DOM direto e mais confiavel que virtualizar.
function useVirtualList(allItems) {
  const containerRef = useRef(null);
  const visibleItems = allItems.map((item, index) => ({ item, index }));
  return { containerRef, totalHeight: 0, offsetTop: 0, offsetBottom: 0, visibleItems };
}

// ── ColFilter — extraído para src/components/tables/ColFilter.jsx ─────────────
// PARC_VAZIO e ColFilter importados acima

export default function PageCategorizador() {
  const { clienteAtivo, setClienteAtivo, setPaginaAtual, modoLeitura, salvando, erroSalvar, isDirty, forceSave, periodoAtivo, setPeriodoAtivo, criarVersaoSeNecessario, criarCheckpoint } = useApp();
  // aba inicial: novos clientes (setupCompleto===false) abre direto no Setup
  const [aba, setAba] = useState(() =>
    clienteAtivo?.setupCompleto === false ? 'setup' : 'transacoes'
  );

  // Reseta aba sempre que o cliente muda — evita ficar numa aba inexistente
  // Ex: estava em 'contas' (legacy), abre cliente novo → vai para 'setup'
  //     estava em 'setup' (novo), abre cliente legacy → vai para 'transacoes'
  const prevClienteId = useRef(clienteAtivo?.id);
  useEffect(() => {
    if (!clienteAtivo) return;
    if (clienteAtivo.id === prevClienteId.current) return; // mesmo cliente, não reseta
    prevClienteId.current = clienteAtivo.id;
    // Escolhe aba padrão conforme tipo do cliente
    setAba(clienteAtivo.setupCompleto === false ? 'setup' : 'transacoes');
  }, [clienteAtivo?.id]);
  const [modalEditar, setModalEditar] = useState(null);
  const [modalRegra, setModalRegra] = useState(null);
  const [modalCategoria, setModalCategoria] = useState(null);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null); // { id, nome, qtdTrans }
  const [editandoCatNome, setEditandoCatNome] = useState(null);   // id em edição inline
  // ── Estados para gestão hierárquica de categorias ──────────────────────
  const [modalNovaCategoria, setModalNovaCategoria] = useState(null);   // { grupo, tipo } → criar categoria-nível2
  const [modalNovaSubcat,    setModalNovaSubcat]    = useState(null);   // { categoriaId, grupo, tipo } → criar subcategoria
  const [modalMoverSubcat,   setModalMoverSubcat]   = useState(null);   // { subcat } → mover subcategoria
  const [moverDestino,       setMoverDestino]       = useState('');     // id categoria destino
  const [editandoNome2,      setEditandoNome2]      = useState(null);   // id categoria-nível2 em edição
  const [confirmDeleteCat2,  setConfirmDeleteCat2]  = useState(null);   // { id, nome } categoria-nível2
  const [modalConta, setModalConta] = useState(null);
  const [modalRevisao, setModalRevisao] = useState(null); // { transacoes, banco, nomeConta }
  const [carregando, setCarregando] = useState(false);  // loading de planilha/CSV
  const [erroImport, setErroImport] = useState(null);
  const fileRef = useRef();
  const fileRefXLSX = useRef(); // para planilha padrão
  // Modal de escolha de tipo de importação
  const [modalTipoImport, setModalTipoImport] = useState(false);
  // Modal rápido "Nova Categoria" acessível da barra de transações
  const [modalNovaCatRapida, setModalNovaCatRapida] = useState(false);

  // ── Hook de processamento de PDF (Gemini via Edge Function — server-side) ──
  // Instanciado aqui (antes do early return) seguindo as Rules of Hooks.
  // Usa optional chaining pois clienteAtivo pode ser null no primeiro render.
  // Extrai nome do cliente e membros do núcleo familiar para melhorar
  // a detecção de Fluxo Interno no prompt do Gemini.
  // Usa optional chaining pois clienteAtivo pode ser null no primeiro render.
  const _nomeCliente  = clienteAtivo?.nome ?? '';
  const _nomesFamilia = (clienteAtivo?.nucleo ?? []).map(m => m.nome).filter(Boolean);

  const pdfHook = usePDFProcessing({
    transacoesExistentes: clienteAtivo?.transacoes ?? [],
    regras:               clienteAtivo?.regras ?? [],
    nomeCliente:          _nomeCliente,
    nomesFamilia:         _nomesFamilia,
    onResultado: ({ transacoes: transacoesResult, tipoDoc, compFatura, bancoId }) => {
      setModalRevisao({
        transacoes:   transacoesResult,
        banco:        _modalContaPDFRef.current?.nomeConta ?? '',
        bancoId:      bancoId ?? '',
        nomeConta:    _modalContaPDFRef.current?.nomeConta ?? '',
        portadorId:   _modalContaPDFRef.current?.portadorId ?? '',
        textoOriginal: null,
        isPDF:         true,
        temDuplicatas: transacoesResult.some(t => t._duplicata),
        compFatura,
      });
    },
    onVersaoAposImportacao: () => {
      // Snapshot imediato pós-importação PDF (motivo: 'importacao_pdf').
      // criarVersaoSeNecessario compara hash — não cria duplicatas.
      criarVersaoSeNecessario?.(clienteAtivo, 'importacao_pdf');
    },
  });
  // Ref para acessar o nomeConta do modal dentro do callback onResultado
  const _modalContaPDFRef = useRef(null);
  // Modal de seleção de conta/portador para PDF
  const [modalContaPDF, setModalContaPDF] = useState(null); // null | { arquivos, contaSel, novaConta, criandoConta, portadorId }
  // Modal de seleção de portador para planilha (antes do seletor de arquivo)
  const [modalPortadorPlanilha, setModalPortadorPlanilha] = useState(null); // null | { portadorId }
  // loadingMsg, loadingElapsed e cancelar vêm do pdfHook acima
  const [showModalExport, setShowModalExport] = useState(false);
  const [modalBanco, setModalBanco] = useState(null);
  const [modalMoverConta, setModalMoverConta] = useState(null);

  // ── Hooks que devem ficar ANTES do early return (Rules of Hooks) ──────────
  // Usam optional chaining para funcionar quando clienteAtivo === null
  const _transacoes    = clienteAtivo?.transacoes    ?? [];
  const _regrasSafe    = clienteAtivo?.regras        ?? [];
  const _catsSafe      = clienteAtivo?.categorias    ?? [];
  const _catsFiltradas = _catsSafe.filter(c => !c.isCategoria && !c.oculto);

  // ── Hook de exportação (CSV, XLSX, PDF) ──────────────────────────────────
  const { exportarCSV, exportarXLSX, exportarPDF, mesesCompetenciaDisponiveis } = useExport({
    transacoes:  _transacoes,
    _categorias: _catsSafe,
    nomeCliente: clienteAtivo?.nome ?? '',
  });

  // ── useCategorias: computed maps + CRUD actions (antes do early return) ────
  const {
    catPorId, categoriasOrdenadas, categoriasPorMacro, catIntermediarias,
    catPorCategoria, catPorIdCompleto, subcatsSemPai, catOpts, catOptsHier,
    grupoDeCategoria,
    salvarCategoria, deletarCategoria, renomearCategoria,
    criarCategoriaNivel2, criarSubcategoria, criarCategoriaComSubcat,
    renomearCategoriaNivel2, deletarCategoriaNivel2, moverSubcategoria,
  } = useCategorias({
    categorias: _catsFiltradas,
    _categorias: _catsSafe,
    clienteAtivo: clienteAtivo ?? { categorias: [], transacoes: [], regras: [], contas: [] },
    setModalCategoria,
    setEditandoCatNome,
    setConfirmDeleteCat,
    setModalNovaCategoria,
    setModalNovaSubcat,
    setModalMoverSubcat,
    setEditandoNome2,
    setConfirmDeleteCat2,
    setMoverDestino,
  });
  const gruposOpts = Object.values(GRUPOS).map(g => ({ value: g, label: g }));

  // ── useFiltros: estado de filtros + computed derivados ───────────────────
  const {
    filtroStatus, setFiltroStatus,
    filtroConta, setFiltroConta,
    filtroCategoria, setFiltroCategoria,
    filtroFormato, setFiltroFormato,
    filtroTempo, setFiltroTempo,
    filtroMes, setFiltroMes, setFiltroMesLocal,
    filtroOrigem, setFiltroOrigem,
    busca, setBusca,
    macroTemp, setMacroTemp,
    aprendizadoOk, setAprendizadoOk,
    selecionados, setSelecionados,
    lockedIds, setLockedIds,
    ordemValor, setOrdemValor,
    filtrosColuna, setFiltrosColuna, setFiltroCol,
    valoresColuna, valoresCascata, categoriasCascata,
    transacoesFiltradas,
    semCategoria, comCategoria, totalCategorizados, saldoFiltrado,
    mesesDisponiveis, transComRegra,
    temFiltroAtivo, atualizarLista, removerFiltro, limparTodosFiltros,
    extrairKeyword, temRegraParaTransacao,
  } = useFiltros({ transacoes: _transacoes, regras: _regrasSafe, categorias: _catsFiltradas, catPorId });

  if (!clienteAtivo) return null;

  // ── Migração retroativa: se bancos[] ainda não existe, cria a partir dos
  // valores únicos do campo banco das contas (texto livre → entidades) ────────
  // Executa inline antes de qualquer render; só altera o objeto em memória
  // até o próximo setClienteAtivo que persiste.
  if (!clienteAtivo.bancos) {
    const bancosUnicos = [...new Set((clienteAtivo.contas || []).map(c => (c.banco || '').trim()).filter(Boolean))];
    const novosBancos = bancosUnicos.map(nome => ({ id: 'banco_' + nome.toLowerCase().replace(/\s+/g, '_'), nome }));
    const novasContas = (clienteAtivo.contas || []).map(c => {
      const bancoNome = (c.banco || '').trim();
      const bancoObj = novosBancos.find(b => b.nome === bancoNome);
      return { ...c, bancoId: bancoObj ? bancoObj.id : null };
    });
    // Persiste migração imediatamente
    setClienteAtivo({ ...clienteAtivo, bancos: novosBancos, contas: novasContas });
  }

  const { transacoes, categorias: _categorias, regras, contas, bancos = [] } = clienteAtivo;
  const categorias = _categorias.filter(c => !c.isCategoria && !c.oculto);

  // ── Helper: verifica se há algum filtro ativo ───────────────────────────

  // ── Upload de Planilha Padrão (XLSM/XLSX/CSV) ─────────────────────────
  async function handleUploadPlanilha(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // Lê portadorId gravado pelo modal de portador (via _portadorId na ref)
    const portadorId = fileRefXLSX.current?._portadorId ?? '';
    if (fileRefXLSX.current) fileRefXLSX.current._portadorId = ''; // limpa após leitura
    setCarregando(true);
    setErroImport(null);
    setLoadingMsg('Processando planilha...');

    try {
      for (const file of files) {
        const nameLower = file.name.toLowerCase();
        const isCSV  = nameLower.endsWith('.csv');
        const isXLSX = nameLower.endsWith('.xlsx') || nameLower.endsWith('.xlsm');
        const regrasEfetivas = (regras && regras.length > 0) ? regras : REGRAS_PADRAO;

        if (isCSV) {
          const text = await file.text();
          const nomeConta = file.name.replace(/\.csv$/i, '');
          const { transacoes: parsed } = parseCSV(text, nomeConta);
          const autocats = autoCategorizar(parsed, regrasEfetivas);
          confirmarImport(autocats, nomeConta, portadorId);
        } else if (isXLSX) {
          const resultado = await parseXLSM(file);
          const autocats = autoCategorizar(resultado.transacoes, regrasEfetivas);
          setModalRevisao({
            transacoes: autocats,
            banco: resultado.banco,
            nomeConta: resultado.nomeConta,
            portadorId,
            textoOriginal: null,
            isXLSM: true,
          });
        }
      }
    } catch (err) {
      console.error(err);
      setErroImport('Erro ao processar arquivo: ' + (err?.message || err));
    }

    setCarregando(false);
    e.target.value = '';
  }

  // ── Ao selecionar PDFs: abre modal de seleção de portador + conta ─────
  function handleUploadPDFEscolhido(e) {
    const files = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (!files.length) return;
    e.target.value = '';
    const nucleo = clienteAtivo?.nucleoFamiliar ?? [];
    // portadorId inicial: primeiro do núcleo, ou '' se não houver
    const portadorId = nucleo.length > 0 ? nucleo[0].id : '';
    // Filtra contas do portador inicial (ou todas, se sem portador)
    const contasDoPortador = contas.filter(c => !portadorId || c.nucleoId === portadorId);
    const contaInicial = contasDoPortador.length > 0 ? contasDoPortador[0].nome : '';
    setModalContaPDF({
      arquivos: files,
      portadorId,
      contaSel: contaInicial,
      novaConta: '',
      criandoConta: contasDoPortador.length === 0,
    });
  }

  // fileParaBase64 removido — v6 usa extrairTextoPDF (texto puro, ~9k chars vs ~380k base64)

  // ── processarPDFsComGemini — agora delega para pdfHook (Gemini via Edge Function) ──
  // A GEMINI_API_KEY nunca toca o browser. Veja src/hooks/usePDFProcessing.js.
  // O modal já chama setModalContaPDF(null) antes de invocar esta função.
  // tipoPDF: 'extrato' | 'fatura' — selecionado pelo usuário no modal (pula etapa IA de identificação)
  async function processarPDFsComGemini(arquivos, nomeConta, tipoPDF = 'extrato', portadorId = '') {
    _modalContaPDFRef.current = { nomeConta, portadorId };
    await pdfHook.processarArquivos(arquivos, nomeConta, tipoPDF);
  }

  // ── Compatibilidade: handleUpload antigo (não usado mais, mantido por segurança) ──
  async function handleUpload(e) {
    handleUploadPlanilha(e);
  }

  // ── Confirma import (vindo da revisão ou direto do CSV) ────────────────
  // portadorId: id do membro do núcleo familiar selecionado na importação (ou '')
  function confirmarImport(novasT, nomeConta, portadorId = '') {
    const nucleo = clienteAtivo?.nucleoFamiliar ?? [];
    const portador = portadorId ? nucleo.find(p => p.id === portadorId) : null;
    const nomePortador = portador?.nome ?? '';

    // Garante id, formato e portador em toda transação importada
    const novasTNorm = novasT.map(t => ({
      ...t,
      id:       t.id     || gerarId(),
      formato:  t.formato || (t.tipo === 'receita' ? 'pix' : 'cartao_credito'),
      portador: nomePortador || t.portador || '',
    }));
    let novasTransacoes = [...transacoes, ...novasTNorm];
    let novasContas = [...contas];

    // Coleta TODAS as contas únicas presentes nas transações importadas
    // Cada transação pode ter uma conta diferente (ex: XLSM com múltiplas contas)
    const contasNasTransacoes = [...new Set(
      novasT.map(t => t.conta?.trim()).filter(Boolean)
    )];

    // Fallback: se nenhuma transação tem conta individual, usa nomeConta
    const contasParaCriar = contasNasTransacoes.length > 0
      ? contasNasTransacoes
      : [nomeConta].filter(Boolean);

    for (const nomeC of contasParaCriar) {
      if (!novasContas.find(c => c.nome === nomeC)) {
        novasContas.push({
          id: gerarId(), nome: nomeC, bancoId: null, tipo: 'corrente',
          nucleoId: portadorId || null,
        });
      }
    }

    setClienteAtivo({ ...clienteAtivo, transacoes: novasTransacoes, contas: novasContas });
    setModalRevisao(null);
  }


  // ── Virtualização da tabela de transações ─────────────────────────────────
  // ROW_HEIGHT deve corresponder à altura real da linha (padding 7px×2 + fonte ~18px + border ~1px = ~44px)
  // Usamos 46 para garantir margem e evitar gap no fundo.
  const ROW_HEIGHT = 46;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const virt = useVirtualList(transacoesFiltradas, ROW_HEIGHT);

  // Filtros sincronos — isFiltering sempre false
  const isFiltering = false;

  // Salva regra imediatamente ao clicar 🧠 — sem modal de confirmação
  function salvarAprendizado(t) {
    if (!t.categoria) return;
    const keyword = extrairKeyword(t.descricao);
    if (!keyword) return;
    const jaExiste = regras.find(r => r.keyword.toLowerCase() === keyword.toLowerCase());
    let novasRegras;
    if (jaExiste) {
      novasRegras = regras.map(r =>
        r.keyword.toLowerCase() === keyword.toLowerCase()
          ? { ...r, categoria: t.categoria }
          : r
      );
    } else {
      novasRegras = [...regras, { id: gerarId(), keyword, categoria: t.categoria, prioridade: 2 }];
    }
    setClienteAtivo({ ...clienteAtivo, regras: novasRegras });
    // Marca check permanente para esta transação nesta sessão
    setAprendizadoOk(prev => ({ ...prev, [t.id]: true }));
  }

  // ── Auto-categorizar tudo ──────────────────────────────────────────────
  function handleAutoCat() {
    const novas = autoCategorizar(transacoes, regras);
    setClienteAtivo({ ...clienteAtivo, transacoes: novas });
  }

  // ── Edição inline rápida (macro / categoria) ────────────────────────
  function salvarInline(id, campo, valor) {
    // Trava a transação na lista sempre (evita que suma/mude de posição após edição)
    // O usuário pode liberar clicando em "Atualizar lista"
    setLockedIds(prev => new Set([...prev, id]));
    const novas = transacoes.map(t => t.id === id
      ? {
          ...t,
          [campo]: valor,
          // status: 'categorizado' só quando categoria foi preenchida; 'pendente' se foi apagada
          status: campo === 'categoria'
            ? (valor ? 'categorizado' : 'pendente')
            : t.status,
        }
      : t
    );
    setClienteAtivo({ ...clienteAtivo, transacoes: novas });
  }

  // Quando troca macro de uma linha, guarda temporariamente e limpa categoria
  function trocarMacroLinha(id, novoGrupo) {
    // Trava sempre: a transação não se move até "Atualizar lista"
    setLockedIds(prev => new Set([...prev, id]));
    setMacroTemp(prev => ({ ...prev, [id]: novoGrupo }));
    const novas = transacoes.map(t => t.id === id
      ? { ...t, categoria: null, status: 'pendente' } : t
    );
    setClienteAtivo({ ...clienteAtivo, transacoes: novas });
  }

  function atualizarTransacao(id, campos) {
    setLockedIds(prev => new Set([...prev, id]));
    const novas = transacoes.map(t => t.id === id ? { ...t, ...campos } : t);
    setClienteAtivo({ ...clienteAtivo, transacoes: novas });
  }

  // ── Ação em lote ──────────────────────────────────────────────────────
  function toggleSelecionar(id) {
    setSelecionados(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }
  function toggleTodos() {
    if (selecionados.size === transacoesFiltradas.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(transacoesFiltradas.map(t => t.id)));
    }
  }
  function deletarSelecionados() {
    const novas = transacoes.filter(t => !selecionados.has(t.id));
    setClienteAtivo({ ...clienteAtivo, transacoes: novas });
    setSelecionados(new Set());
  }
  function categorizarSelecionados(catId) {
    const novas = transacoes.map(t => selecionados.has(t.id)
      ? { ...t, categoria: catId, status: 'categorizado' } : t
    );
    setClienteAtivo({ ...clienteAtivo, transacoes: novas });
    setSelecionados(new Set());
  }

  // ── Salvar edição de transação ─────────────────────────────────────────
  function salvarEdicao(t) {
    setLockedIds(prev => new Set([...prev, t.id]));
    // status segue a presença da categoria — nunca marca 'categorizado' se não há categoria
    const novas = transacoes.map(x =>
      x.id === t.id ? { ...t, status: t.categoria ? 'categorizado' : 'pendente' } : x
    );
    setClienteAtivo({ ...clienteAtivo, transacoes: novas });
    setModalEditar(null);
  }

  // ── Deletar transação ──────────────────────────────────────────────────
  function deletarTransacao(id) {
    const novas = transacoes.filter(t => t.id !== id);
    setClienteAtivo({ ...clienteAtivo, transacoes: novas });
  }

  // ── Salvar regra ───────────────────────────────────────────────────────
  function salvarRegra(r) {
    const novas = r.id
      ? regras.map(x => x.id === r.id ? r : x)
      : [...regras, { ...r, id: gerarId() }];
    setClienteAtivo({ ...clienteAtivo, regras: novas });
    setModalRegra(null);
  }


  // ── ctx objects para sub-componentes ─────────────────────────────────────
  const ctxTrans = {
    transacoes, categorias,
    transacoesFiltradas, comCategoria, semCategoria, saldoFiltrado,
    filtroTempo, setFiltroTempo, filtroMes, setFiltroMes, setFiltroMesLocal,
    mesesDisponiveis, filtroStatus, setFiltroStatus,
    filtroOrigem, setFiltroOrigem, busca, setBusca,
    temFiltroAtivo, removerFiltro, atualizarLista, limparTodosFiltros,
    lockedIds, selecionados, setSelecionados,
    filtroCategoria, filtroFormato: filtroFormato ?? '',
    filtroConta: filtroConta ?? '',
    filtrosColuna, setFiltroCol, valoresCascata,
    ordemValor, setOrdemValor,
    macroTemp, setMacroTemp, aprendizadoOk, transComRegra,
    catPorId, categoriasPorMacro, categoriasOrdenadas,
    catPorIdCompleto, catIntermediarias, catPorCategoria,
    virt, modoLeitura,
    setModalNovaCatRapida, setModalEditar,
    deletarSelecionados, categorizarSelecionados,
    setClienteAtivo, clienteAtivo,
    atualizarTransacao, trocarMacroLinha, salvarInline,
    toggleTodos, toggleSelecionar,
    criarCheckpoint,
  };

  const ctxCat = {
    transacoes, clienteAtivo,
    renomearCategoriaNivel2, renomearCategoria,
    criarCategoriaNivel2, criarSubcategoria, moverSubcategoria,
    deletarCategoria, deletarCategoriaNivel2,
    modalNovaCategoria, setModalNovaCategoria,
    modalNovaSubcat, setModalNovaSubcat,
    modalMoverSubcat, setModalMoverSubcat,
    moverDestino, setMoverDestino,
    editandoNome2, setEditandoNome2,
    editandoCatNome, setEditandoCatNome,
    confirmDeleteCat, setConfirmDeleteCat,
    confirmDeleteCat2, setConfirmDeleteCat2,
    modoLeitura,
  };

  const ctxContas = {
    transacoes, contas, bancos,
    clienteAtivo, setClienteAtivo,
    modoLeitura,
    setModalBanco, setModalConta, setModalMoverConta,
  };

  // ── ctx para AbaSetup — combina ctxCat + ctxContas + extras ──────────────
  const ctxSetup = {
    clienteAtivo, setClienteAtivo, modoLeitura,
    // contas
    transacoes, contas, bancos,
    setModalBanco, setModalConta, setModalMoverConta,
    // categorias
    renomearCategoriaNivel2, renomearCategoria,
    criarCategoriaNivel2, criarSubcategoria, moverSubcategoria,
    deletarCategoria, deletarCategoriaNivel2,
    modalNovaCategoria, setModalNovaCategoria,
    modalNovaSubcat, setModalNovaSubcat,
    modalMoverSubcat, setModalMoverSubcat,
    moverDestino, setMoverDestino,
    editandoNome2, setEditandoNome2,
    editandoCatNome, setEditandoCatNome,
    confirmDeleteCat, setConfirmDeleteCat,
    confirmDeleteCat2, setConfirmDeleteCat2,
    // navegação — permite que o wizard volte para o hub ao fechar sem concluir
    setPaginaAtual,
    // callback: wizard finalizado → vai para Transações
    onSetupConcluido: () => setAba('transacoes'),
  };

  const ctxModais = {
    transacoes, contas, bancos, categorias, _categorias, regras,
    clienteAtivo, setClienteAtivo, modoLeitura,
    nucleoFamiliar: clienteAtivo?.nucleoFamiliar ?? [],
    modalEditar, setModalEditar,
    modalCategoria, setModalCategoria,
    modalRegra, setModalRegra,
    modalConta, setModalConta,
    modalBanco, setModalBanco,
    modalMoverConta, setModalMoverConta,
    modalRevisao, setModalRevisao,
    showModalExport, setShowModalExport,
    modalNovaCatRapida, setModalNovaCatRapida,
    modalTipoImport, setModalTipoImport,
    modalContaPDF, setModalContaPDF,
    modalPortadorPlanilha, setModalPortadorPlanilha,
    carregando, erroImport, setErroImport,
    catIntermediarias, catPorCategoria,
    gruposOpts,
    salvarCategoria, criarCategoriaComSubcat, criarSubcategoria,
    pdfHook,
    salvarEdicao, salvarRegra, confirmarImport, processarPDFsComGemini,
    exportarCSV, exportarXLSX, exportarPDF,
    mesesCompetenciaDisponiveis,
    fileRef, fileRefXLSX,
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1500, margin: '0 auto' }}>
      {/* Header da ferramenta */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: FONT.xl, fontWeight: 800, color: C.text }}>{clienteAtivo.nome}</div>
            {transacoes.length > 0 && (
              <span style={{
                fontSize: FONT.xs, fontWeight: 600, padding: '3px 10px',
                background: totalCategorizados === transacoes.length ? C.recBg : C.yellowBg,
                color: totalCategorizados === transacoes.length ? C.rec : C.yellow,
                borderRadius: 20, border: `1px solid ${totalCategorizados === transacoes.length ? C.rec : C.yellow}44`,
              }}>
                {transacoes.length} transações · {Math.round((totalCategorizados / transacoes.length) * 100)}% categorizadas
              </span>
            )}
            {/* Indicador de salvamento automático */}
            {salvando ? (
              <span style={{
                fontSize: FONT.xs, fontWeight: 600, padding: '3px 10px',
                background: C.brand + '18', color: C.brand,
                borderRadius: 20, border: `1px solid ${C.brand}44`,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: C.brand, animation: 'pulse 1s infinite' }} />
                Salvando...
              </span>
            ) : !modoLeitura && transacoes.length > 0 ? (
              <span style={{
                fontSize: FONT.xs, fontWeight: 500, padding: '3px 10px',
                background: C.recBg, color: C.rec,
                borderRadius: 20, border: `1px solid ${C.rec}33`,
              }}>
  Salvo
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: FONT.sm, color: C.textMuted, marginTop: 4 }}>Categorizador de Transações</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          {!modoLeitura && transacoes.length > 0 && (
            <button onClick={() => setShowModalExport(true)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 8,
              border: `2px solid ${C.rec}`, background: 'transparent',
              color: C.rec, fontWeight: 700, fontSize: FONT.base,
              fontFamily: "'Inter',sans-serif", cursor: 'pointer',
            }}>
              <Download size={15} style={{ flexShrink: 0 }} /> Exportar
            </button>
          )}
          {!modoLeitura && (
            <>
              {/* input para planilha padrão */}
              <input ref={fileRefXLSX} type="file" accept=".csv,.CSV,.xlsx,.XLSX,.xlsm,.XLSM" multiple onChange={handleUploadPlanilha} style={{ display: 'none' }} />
              {/* input para PDFs (Gemini) */}
              <input ref={fileRef} type="file" accept=".pdf,.PDF" multiple onChange={handleUploadPDFEscolhido} style={{ display: 'none' }} />
              <button
                onClick={() => setModalTipoImport(true)}
                disabled={carregando}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 8,
                  border: `2px solid ${carregando ? C.border : C.rec}`,
                  background: 'transparent',
                  color: carregando ? C.textMuted : C.rec,
                  fontWeight: 700, fontSize: FONT.base,
                  fontFamily: "'Inter',sans-serif", cursor: carregando ? 'not-allowed' : 'pointer',
                  opacity: carregando ? 0.5 : 1, transition: 'opacity 0.15s',
                }}
              >
                <Upload size={15} style={{ flexShrink: 0 }} /> {carregando ? 'Processando...' : 'Importar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Abas */}
      {/* setupCompleto === undefined → legacy: Transações + Contas + Categorias */}
      {/* setupCompleto === false/true → new/configured: Transações + Setup       */}
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
        {[
          { id: 'transacoes', label: 'Transações' },
          ...(clienteAtivo.setupCompleto === undefined
            ? [
                { id: 'contas',      label: 'Contas' },
                { id: 'categorias',  label: 'Categorias' },
              ]
            : [
                { id: 'setup', label: clienteAtivo.setupCompleto === false ? 'Setup' : 'Setup' },
              ]
          ),
        ].map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            style={{
              padding: '10px 18px', border: 'none', background: 'transparent',
              color: aba === a.id ? C.brand : C.textMuted,
              fontWeight: aba === a.id ? 700 : 500,
              fontSize: FONT.base, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
              borderBottom: aba === a.id ? `2px solid ${C.brand}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >{a.label}</button>
        ))}
      </div>

      {/* ── ABA: TRANSAÇÕES ──────────────────────────────────────────────── */}
      {aba === 'transacoes' && (
        <AbaTransacoes ctx={ctxTrans} />
      )}

      {/* ── ABA: REGRAS ──────────────────────────────────────────────────── */}
      {aba === 'regras' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Btn size="sm" onClick={() => setModalRegra({ keyword: '', categoria: '', prioridade: 3 })}>+ Nova Regra</Btn>
          </div>
          <div style={{ background: C.card, borderRadius: RADIUS.lg, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONT.sm }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                  {['Palavra-chave','Categoria','Prioridade','Ações'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: C.textMuted, fontWeight: 600, fontSize: FONT.xs }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...regras].sort((a,b) => a.prioridade - b.prioridade).map((r, i) => {
                  const cat = catPorId.get(r.categoria);
                  return (
                    <tr key={r.id || i} style={{ borderBottom: `1px solid ${C.border}20` }}>
                      <td style={{ padding: '9px 14px', color: C.brand, fontFamily: 'monospace' }}>{r.keyword}</td>
                      <td style={{ padding: '9px 14px' }}>{cat ? <Badge color={C.brand}>{cat.nome}</Badge> : <Badge color={C.red}>{r.categoria}</Badge>}</td>
                      <td style={{ padding: '9px 14px', color: C.textMuted }}>{r.prioridade}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <MiniBtn onClick={() => setModalRegra({ ...r })}><Pencil size={11} /></MiniBtn>
                          <MiniBtn onClick={() => setClienteAtivo({ ...clienteAtivo, regras: regras.filter(x => (x.id||x.keyword) !== (r.id||r.keyword)) })} danger><X size={11} /></MiniBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ABA: CATEGORIAS (legacy — setupCompleto === undefined) ─────────── */}
      {aba === 'categorias' && clienteAtivo.setupCompleto === undefined && (
        <AbaCategorias ctx={ctxCat} />
      )}

      {/* ── ABA: CONTAS (legacy — setupCompleto === undefined) ───────────── */}
      {aba === 'contas' && clienteAtivo.setupCompleto === undefined && (
        <AbaContas ctx={ctxContas} />
      )}

      {/* ── ABA: SETUP (novos e configurados — setupCompleto !== undefined) ─ */}
      {aba === 'setup' && clienteAtivo.setupCompleto !== undefined && (
        <AbaSetup ctx={ctxSetup} />
      )}

      {/* ── MODAIS ────────────────────────────────────────────────────────── */}
      <ModaisCategorizador ctx={ctxModais} />

      {/* SaveBar global em App.jsx — não duplicar aqui */}
    </div>
  );
}

