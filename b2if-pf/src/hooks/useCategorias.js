/**
 * useCategorias.js — Hook de categorias
 *
 * Encapsula:
 * 1. Computed maps/arrays derivados de `_categorias` (catPorId, categoriasOrdenadas,
 *    categoriasPorMacro, catIntermediarias, catPorCategoria, catPorIdCompleto,
 *    subcatsSemPai, catOpts, catOptsHier)
 * 2. Actions CRUD de categorias (salvar, deletar, renomear, criar níveis 2/subcats,
 *    mover subcategoria)
 *
 * Dependências: useApp, gerarId, GRUPOS
 */

import { useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { gerarId } from '../utils/clienteStorage.js';
import { GRUPOS } from '../data/categorias.js';

/**
 * @param {Object} params
 * @param {Array}  params.categorias      — array filtrado (sem isCategoria, sem oculto)
 * @param {Array}  params._categorias     — array completo (inclui intermediárias)
 * @param {Object} params.clienteAtivo    — objeto cliente completo (para CRUD)
 * @param {Function} params.setModalCategoria
 * @param {Function} params.setEditandoCatNome
 * @param {Function} params.setConfirmDeleteCat
 * @param {Function} params.setModalNovaCategoria
 * @param {Function} params.setModalNovaSubcat
 * @param {Function} params.setModalMoverSubcat
 * @param {Function} params.setEditandoNome2
 * @param {Function} params.setConfirmDeleteCat2
 * @param {Function} params.setMoverDestino
 */
export function useCategorias({
  categorias,
  _categorias,
  clienteAtivo,
  setModalCategoria,
  setEditandoCatNome,
  setConfirmDeleteCat,
  setModalNovaCategoria,
  setModalNovaSubcat,
  setModalMoverSubcat,
  setEditandoNome2,
  setConfirmDeleteCat2,
  setMoverDestino,
}) {
  const { setClienteAtivo, criarVersaoCategorias } = useApp();
  const { transacoes } = clienteAtivo;

  // ── Computed maps ──────────────────────────────────────────────────────────

  /** Map id → categoria (apenas leaf/filtradas) — lookup O(1) */
  const catPorId = useMemo(() => {
    const m = new Map();
    for (const c of categorias) m.set(c.id, c);
    return m;
  }, [categorias]);

  /** Categorias ordenadas por nome pt-BR */
  const categoriasOrdenadas = useMemo(
    () => [...categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')),
    [categorias]
  );

  /** Mapa grupo → [categorias] */
  const categoriasPorMacro = useMemo(() => {
    const ordem = Object.values(GRUPOS);
    const mapa = {};
    for (const g of ordem) mapa[g] = [];
    for (const c of categoriasOrdenadas) {
      if (mapa[c.grupo]) mapa[c.grupo].push(c);
      else mapa[c.grupo] = [c];
    }
    return mapa;
  }, [categoriasOrdenadas]);

  /** Categorias intermediárias (nível 2) agrupadas por macro — exclui aliases ocultos */
  const catIntermediarias = useMemo(() => {
    const mapa = {};
    for (const g of Object.values(GRUPOS)) mapa[g] = [];
    for (const c of _categorias) {
      if (c.isCategoria && !c.oculto) {
        if (!mapa[c.grupo]) mapa[c.grupo] = [];
        mapa[c.grupo].push(c);
      }
    }
    return mapa;
  }, [_categorias]);

  /** Map catId → [subcategorias] — exclui aliases ocultos do dropdown */
  const catPorCategoria = useMemo(() => {
    const mapa = {};
    for (const c of _categorias) {
      if (!c.isCategoria && c.categoria && !c.oculto) {
        if (!mapa[c.categoria]) mapa[c.categoria] = [];
        mapa[c.categoria].push(c);
      }
    }
    return mapa;
  }, [_categorias]);

  /** Map id→cat COMPLETO (inclui intermediárias) */
  const catPorIdCompleto = useMemo(() => {
    const m = new Map();
    for (const c of _categorias) m.set(c.id, c);
    return m;
  }, [_categorias]);

  /** Subcategorias sem categoria intermediária (legado ou custom) */
  const subcatsSemPai = useMemo(
    () => categorias.filter(c => !c.isCategoria && !c.categoria),
    [categorias]
  );

  /** Opções flat para Select (grupo › nome) */
  const catOpts = useMemo(
    () => categoriasOrdenadas.map(c => ({ value: c.id, label: `${c.grupo} › ${c.nome}` })),
    [categoriasOrdenadas]
  );

  /** Opções hierárquicas para Modal Regra (grupo › intermediária › subcategoria) */
  const catOptsHier = useMemo(() => {
    const opts = [];
    for (const g of Object.values(GRUPOS)) {
      const intermediarias = catIntermediarias[g] || [];
      if (intermediarias.length > 0) {
        for (const interm of intermediarias) {
          const subs = catPorCategoria[interm.id] || [];
          for (const s of subs) {
            opts.push({ value: s.id, label: `${g} › ${interm.nome} › ${s.nome}` });
          }
        }
      }
    }
    for (const c of subcatsSemPai) {
      opts.push({ value: c.id, label: `${c.grupo} › ${c.nome}` });
    }
    return opts;
  }, [catIntermediarias, catPorCategoria, subcatsSemPai]);

  /** Grupo de uma categoria por id */
  function grupoDeCategoria(catId) {
    return catPorId.get(catId)?.grupo || '';
  }

  // ── CRUD Actions ───────────────────────────────────────────────────────────

  function salvarCategoria(c) {
    const todasCats = clienteAtivo.categorias;
    const novas = c.id && todasCats.find(x => x.id === c.id)
      ? todasCats.map(x => x.id === c.id ? c : x)
      : [...todasCats, { ...c, id: c.id || gerarId() }];
    const novoCliente = { ...clienteAtivo, categorias: novas };
    setClienteAtivo(novoCliente);
    criarVersaoCategorias(novoCliente);
    setModalCategoria(null);
  }

  function deletarCategoria(id) {
    const todasCats = clienteAtivo.categorias;
    const novasCats = todasCats.filter(c => c.id !== id);
    const novasTrans = transacoes.map(t =>
      t.categoria === id ? { ...t, categoria: '', subcategoria: '' } : t
    );
    const novoCliente = { ...clienteAtivo, categorias: novasCats, transacoes: novasTrans };
    setClienteAtivo(novoCliente);
    criarVersaoCategorias(novoCliente);
    setConfirmDeleteCat(null);
  }

  function renomearCategoria(id, novoNome) {
    const nome = novoNome.trim();
    if (!nome) return;
    const todasCats = clienteAtivo.categorias;
    const novas = todasCats.map(c => c.id === id ? { ...c, nome } : c);
    const novoCliente = { ...clienteAtivo, categorias: novas };
    setClienteAtivo(novoCliente);
    criarVersaoCategorias(novoCliente);
    setEditandoCatNome(null);
  }

  function criarCategoriaNivel2(nome, grupo, tipo) {
    const nome_ = nome.trim();
    if (!nome_) return;
    const todasCats = clienteAtivo.categorias;
    const nova = { id: 'cat_custom_' + gerarId(), nome: nome_, grupo, tipo, isCategoria: true };
    const novoCliente = { ...clienteAtivo, categorias: [...todasCats, nova] };
    setClienteAtivo(novoCliente);
    criarVersaoCategorias(novoCliente);
    setModalNovaCategoria(null);
  }

  function criarSubcategoria(nome, categoriaId, grupo, tipo) {
    const nome_ = nome.trim();
    if (!nome_) return;
    const todasCats = clienteAtivo.categorias;
    const nova = { id: 'sub_custom_' + gerarId(), nome: nome_, grupo, tipo, isCategoria: false, categoria: categoriaId };
    const novoCliente = { ...clienteAtivo, categorias: [...todasCats, nova] };
    setClienteAtivo(novoCliente);
    criarVersaoCategorias(novoCliente);
    setModalNovaSubcat(null);
  }

  function criarCategoriaComSubcat(nomeCategoria, nomeSubcat, grupo, tipo) {
    const nomeCat_ = nomeCategoria.trim();
    const nomeSub_ = nomeSubcat.trim();
    if (!nomeCat_ || !nomeSub_) return;
    const catId = 'cat_custom_' + gerarId();
    const novaCat = { id: catId, nome: nomeCat_, grupo, tipo, isCategoria: true };
    const novaSub = { id: 'sub_custom_' + gerarId(), nome: nomeSub_, grupo, tipo, isCategoria: false, categoria: catId };
    const todasCats = clienteAtivo.categorias;
    const novoCliente = { ...clienteAtivo, categorias: [...todasCats, novaCat, novaSub] };
    setClienteAtivo(novoCliente);
    criarVersaoCategorias(novoCliente);
  }

  function renomearCategoriaNivel2(id, novoNome) {
    const nome = novoNome.trim();
    if (!nome) return;
    const todasCats = clienteAtivo.categorias;
    const novas = todasCats.map(c => c.id === id ? { ...c, nome } : c);
    const novoCliente = { ...clienteAtivo, categorias: novas };
    setClienteAtivo(novoCliente);
    criarVersaoCategorias(novoCliente);
    setEditandoNome2(null);
  }

  function deletarCategoriaNivel2(catId) {
    const todasCats = clienteAtivo.categorias;
    const filhasIds = new Set(todasCats.filter(c => c.categoria === catId).map(c => c.id));
    const novasCats = todasCats.filter(c => c.id !== catId && !filhasIds.has(c.id));
    const novasTrans = transacoes.map(t =>
      filhasIds.has(t.categoria) ? { ...t, categoria: '', subcategoria: '' } : t
    );
    const novoCliente = { ...clienteAtivo, categorias: novasCats, transacoes: novasTrans };
    setClienteAtivo(novoCliente);
    criarVersaoCategorias(novoCliente);
    setConfirmDeleteCat2(null);
  }

  function moverSubcategoria(subcatId, novaCategoriaId) {
    const todasCats = clienteAtivo.categorias;
    const destino = todasCats.find(c => c.id === novaCategoriaId);
    if (!destino) return;
    const novas = todasCats.map(c =>
      c.id === subcatId
        ? { ...c, categoria: novaCategoriaId, grupo: destino.grupo, tipo: destino.tipo }
        : c
    );
    const novasTrans = transacoes.map(t =>
      t.categoria === subcatId ? { ...t, macro: destino.grupo } : t
    );
    const novoCliente = { ...clienteAtivo, categorias: novas, transacoes: novasTrans };
    setClienteAtivo(novoCliente);
    criarVersaoCategorias(novoCliente);
    setModalMoverSubcat(null);
    setMoverDestino('');
  }

  return {
    // Computed maps
    catPorId,
    categoriasOrdenadas,
    categoriasPorMacro,
    catIntermediarias,
    catPorCategoria,
    catPorIdCompleto,
    subcatsSemPai,
    catOpts,
    catOptsHier,
    grupoDeCategoria,
    // CRUD actions
    salvarCategoria,
    deletarCategoria,
    renomearCategoria,
    criarCategoriaNivel2,
    criarSubcategoria,
    criarCategoriaComSubcat,
    renomearCategoriaNivel2,
    deletarCategoriaNivel2,
    moverSubcategoria,
  };
}
