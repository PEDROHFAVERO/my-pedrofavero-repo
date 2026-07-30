/**
 * ColFilter.jsx — Filtro por coluna tipo "Excel" para tabela de transações
 *
 * Extraído de: PageCategorizador.jsx (linhas 51-258)
 * Responsabilidade única: filtro dropdown com multi-seleção, busca e ordenação.
 *
 * Props:
 *  - label: string — texto do cabeçalho da coluna
 *  - valores: Set<string> — todos os valores possíveis
 *  - selecionados: Set<string> — valores atualmente filtrados
 *  - onChange: (Set<string>) => void — callback ao mudar seleção
 *  - categorias?: Categoria[] — para resolver IDs em nomes legíveis
 *  - numeric?: boolean — para ordenação numérica
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';

const PARC_VAZIO = '__vazio__'; // sentinela para "sem parcelamento"

export { PARC_VAZIO };

export function ColFilter({ label, valores, selecionados, onChange, categorias: cats, numeric }) {
  const [aberto,  setAberto]  = useState(false);
  const [pos,     setPos]     = useState(null);   // { top, left } coords fixed
  const [busca,   setBusca]   = useState('');
  const [sortDir, setSortDir] = useState(null);   // null | 'asc' | 'desc'
  const btnRef  = useRef();
  const dropRef = useRef();

  function abrirDropdown() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
    setAberto(true);
  }
  function fecharDropdown() { setAberto(false); setPos(null); }

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    function handler(e) {
      if (
        dropRef.current && !dropRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) fecharDropdown();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  // Fecha ao rolar a página (mas não dentro do próprio dropdown)
  useEffect(() => {
    if (!aberto) return;
    const handler = (e) => {
      if (dropRef.current && dropRef.current.contains(e.target)) return;
      fecharDropdown();
    };
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [aberto]);

  const temFiltro = selecionados.size > 0;

  const valoresFiltrados = useMemo(() => {
    const list = [...valores];
    if (numeric) {
      const vazio = list.includes(PARC_VAZIO) ? [PARC_VAZIO] : [];
      const nums  = list.filter(v => v !== PARC_VAZIO);
      if (sortDir === 'asc')  nums.sort((a, b) => Number(a) - Number(b));
      if (sortDir === 'desc') nums.sort((a, b) => Number(b) - Number(a));
      const sorted = [...vazio, ...nums];
      if (!busca.trim()) return sorted;
      const q = busca.trim().toLowerCase();
      return sorted.filter(v => rotulo(v).toLowerCase().includes(q));
    }
    if (sortDir === 'asc')  list.sort((a, b) => rotulo(a).localeCompare(rotulo(b), 'pt'));
    if (sortDir === 'desc') list.sort((a, b) => rotulo(b).localeCompare(rotulo(a), 'pt'));
    if (!busca.trim()) return list;
    const q = busca.trim().toLowerCase();
    return list.filter(v => rotulo(v).toLowerCase().includes(q));
  }, [valores, busca, sortDir, numeric, cats]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleValor(v) {
    const next = new Set(selecionados);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next);
  }
  function toggleTodos() {
    if (selecionados.size === valores.size) onChange(new Set());
    else onChange(new Set(valores));
  }
  function limpar() { onChange(new Set()); }

  function rotulo(v) {
    if (v === PARC_VAZIO) return '— Vazio (sem parcelas) —';
    if (cats) {
      const c = cats.find(x => x.id === v);
      if (c) {
        if (c.categoria) {
          const pai = cats.find(x => x.id === c.categoria);
          if (pai) return `${pai.nome} › ${c.nome}`;
        }
        return c.nome;
      }
    }
    if (numeric) return `${v} parcela${Number(v) !== 1 ? 's' : ''}`;
    return String(v);
  }

  return (
    <th style={{ padding: '10px 10px', textAlign: 'left', whiteSpace: 'nowrap', position: 'relative', userSelect: 'none', background: 'inherit' }}>
      {/* Botão do cabeçalho */}
      <button
        ref={btnRef}
        onClick={() => aberto ? fecharDropdown() : abrirDropdown()}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          color: temFiltro ? C.brand : C.textMuted,
          fontWeight: 600, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif",
          padding: 0, width: '100%',
        }}
      >
        {label}
        <span style={{
          fontSize: 9, opacity: temFiltro ? 1 : 0.5,
          color: temFiltro ? C.brand : C.textMuted,
          transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s',
        }}>&#9660;</span>
        {temFiltro && (
          <span style={{ background: C.brand, color: '#fff', borderRadius: 10, fontSize: 9, padding: '1px 5px', fontWeight: 700 }}>
            {selecionados.size}
          </span>
        )}
      </button>

      {/* Dropdown via position:fixed (não cortado por overflow do container) */}
      {aberto && pos && (
        <div
          ref={dropRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left,
            zIndex: 99999, background: C.card,
            border: `1px solid ${C.border}`, borderRadius: RADIUS.lg,
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            minWidth: 240, maxHeight: 360,
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Toolbar: ordenar + limpar */}
          <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
            <button onClick={() => setSortDir(sortDir === 'asc' ? null : 'asc')}
              style={{ flex: 1, padding: '4px 0', borderRadius: 4, border: `1px solid ${sortDir === 'asc' ? C.brand : C.border}`, background: sortDir === 'asc' ? C.brand + '22' : 'transparent', color: sortDir === 'asc' ? C.brand : C.textMuted, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", cursor: 'pointer' }}>A&#8594;Z</button>
            <button onClick={() => setSortDir(sortDir === 'desc' ? null : 'desc')}
              style={{ flex: 1, padding: '4px 0', borderRadius: 4, border: `1px solid ${sortDir === 'desc' ? C.brand : C.border}`, background: sortDir === 'desc' ? C.brand + '22' : 'transparent', color: sortDir === 'desc' ? C.brand : C.textMuted, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", cursor: 'pointer' }}>Z&#8594;A</button>
            {temFiltro && (
              <button onClick={() => { limpar(); fecharDropdown(); }}
                style={{ flex: 1, padding: '4px 0', borderRadius: 4, border: `1px solid ${C.desp}55`, background: C.desp + '18', color: C.desp, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", cursor: 'pointer', fontWeight: 700 }}>Limpar</button>
            )}
          </div>

          {/* Busca */}
          <div style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.bg, borderRadius: 6, padding: '4px 8px' }}>
              <input
                autoFocus
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Filtrar..."
                style={{ background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", width: '100%' }}
              />
            </div>
          </div>

          {/* Selecionar todos */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', color: C.textMuted, fontSize: FONT.xs }}>
            <input type="checkbox" checked={selecionados.size === 0} onChange={toggleTodos} style={{ accentColor: C.brand }} />
            <span style={{ fontWeight: 600 }}>{selecionados.size === 0 ? '✓ Todos' : 'Selecionar todos'}</span>
          </label>

          {/* Lista de valores */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {valoresFiltrados.length === 0 ? (
              <div style={{ padding: '10px 12px', color: C.textMuted, fontSize: FONT.xs, textAlign: 'center' }}>Nenhum resultado</div>
            ) : valoresFiltrados.map(v => (
              <label key={v} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer',
                background: selecionados.has(v) ? C.brand + '14' : 'transparent', transition: 'background .1s',
              }}>
                <input type="checkbox" checked={selecionados.has(v)} onChange={() => toggleValor(v)} style={{ accentColor: C.brand }} />
                <span style={{ color: C.text, fontSize: FONT.xs, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rotulo(v)}
                </span>
              </label>
            ))}
          </div>

          {/* Rodapé */}
          <div style={{ padding: '6px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: C.textMuted }}>Mostrando {valoresFiltrados.length} de {valores.size}</span>
            <button onClick={fecharDropdown}
              style={{ background: C.brand, color: '#fff', border: 'none', borderRadius: 5, padding: '3px 12px', fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", cursor: 'pointer', fontWeight: 700 }}>OK</button>
          </div>
        </div>
      )}
    </th>
  );
}

export default ColFilter;
