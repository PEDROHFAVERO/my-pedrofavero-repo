import { Search, X, Pencil, Trash2, BookmarkPlus, Check, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useState, useRef } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn, Card, fmtBRL, Empty } from '../UI.jsx';
import { GRUPOS } from '../../data/categorias.js';
import { ColFilter } from '../tables/ColFilter.jsx';
import { StatBox, grupoColor, normalizarFormato, formatoColor } from './helpers.jsx';

// Mapa de formato → label legível (duplicado aqui para evitar dependência circular)
const FORMATO_LABEL = {
  pix:            'Pix',
  cartao_debito:  'Débito',
  cartao_credito: 'Crédito',
  dinheiro:       'Dinheiro',
  boleto:         'Boleto',
  ted:            'TED/DOC',
  credito:        'Crédito',
  debito:         'Débito',
};

export function AbaTransacoes({ ctx }) {
  const {
    // Dados brutos
    transacoes, categorias,
    // useFiltros: estado
    transacoesFiltradas,
    comCategoria, semCategoria, saldoFiltrado,
    filtroTempo, setFiltroTempo,
    filtroMes, setFiltroMes, setFiltroMesLocal,
    mesesDisponiveis,
    filtroStatus, setFiltroStatus,
    filtroOrigem, setFiltroOrigem,
    busca, setBusca,
    temFiltroAtivo,
    removerFiltro, atualizarLista, limparTodosFiltros,
    lockedIds, selecionados, setSelecionados,
    filtroCategoria,
    filtrosColuna, setFiltroCol,
    valoresCascata,
    macroTemp, setMacroTemp,
    aprendizadoOk, transComRegra,
    ordemValor, setOrdemValor,
    // useCategorias
    catPorId, categoriasPorMacro, categoriasOrdenadas,
    catPorIdCompleto, catIntermediarias, catPorCategoria,
    // Virtualização
    virt,
    // Ações do componente pai
    modoLeitura,
    setModalNovaCatRapida, setModalEditar,
    deletarSelecionados, categorizarSelecionados,
    setClienteAtivo, clienteAtivo,
    atualizarTransacao, trocarMacroLinha, salvarInline,
    toggleTodos, toggleSelecionar,
    criarCheckpoint,
  } = ctx;

  // ── Estado do botão "Salvar versão" ─────────────────────────────────────────
  const [salvandoVersao, setSalvandoVersao] = useState(false);
  const [versaoOk,       setVersaoOk]       = useState(false);
  const versaoOkTimerRef = useRef(null);

  async function handleSalvarVersao() {
    if (salvandoVersao || !criarCheckpoint) return;
    setSalvandoVersao(true);
    try {
      await criarCheckpoint('Fluxo Financeiro');
      setVersaoOk(true);
      clearTimeout(versaoOkTimerRef.current);
      versaoOkTimerRef.current = setTimeout(() => setVersaoOk(false), 2000);
    } finally {
      setSalvandoVersao(false);
    }
  }

  return (
    <>
      {/* Stats rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatBox label={`Total${transacoesFiltradas.length !== transacoes.length ? ` (${transacoesFiltradas.length} filtradas)` : ''}`} value={transacoes.length} color={C.info} />
        <StatBox label="Categorizados" value={comCategoria} color={C.green} />
        <StatBox label="Sem categoria" value={semCategoria} color={semCategoria > 0 ? C.yellow : C.green} />
        <StatBox
          label="Saldo (filtro atual)"
          value={(saldoFiltrado >= 0 ? '+' : '') + fmtBRL(Math.abs(saldoFiltrado))}
          color={saldoFiltrado >= 0 ? C.rec : C.desp}
        />
      </div>

      {/* Barra de filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Filtro de tempo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: C.bg, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, padding: '2px 4px' }}>
          {[['competencia','Competência'],['data','Data Compra']].map(([v,l]) => (
            <button key={v} onClick={() => { setFiltroTempo(v); setFiltroMesLocal(''); }}
              style={{ padding: '5px 10px', borderRadius: RADIUS.sm, border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontSize: FONT.xs, fontWeight: 600,
                background: filtroTempo === v ? C.brand : 'transparent', color: filtroTempo === v ? C.bg : C.textMuted }}>
              {l}
            </button>
          ))}
        </div>
        <select value={filtroMes} onChange={e => { setFiltroMes(e.target.value); }}
          style={{ background: C.card, border: `1px solid ${filtroMes ? C.brand : C.border}`, borderRadius: RADIUS.md, padding: '5px 6px', color: filtroMes ? C.brand : C.text, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", outline: 'none', fontWeight: filtroMes ? 700 : 400 }}>
          <option value="">Todos os períodos</option>
          {mesesDisponiveis.map(m => {
            const [yyyy, mm] = m.split('-');
            const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
            return <option key={m} value={m}>{nomes[parseInt(mm,10)-1]}/{yyyy}</option>;
          })}
        </select>
        <select value={filtroStatus} onChange={e => { setFiltroStatus(e.target.value); }}
          style={{ background: C.card, border: `1px solid ${filtroStatus !== 'todos' ? C.brand : C.border}`, borderRadius: RADIUS.md, padding: '5px 6px', color: filtroStatus !== 'todos' ? C.brand : C.text, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", outline: 'none', fontWeight: filtroStatus !== 'todos' ? 700 : 400 }}>
          <option value="todos">Todos os status</option>
          <option value="pendente">Sem categoria</option>
          <option value="categorizado">Categorizados</option>
        </select>
        {/* Filtro por origem removido: lançamentos WhatsApp migrados para página dedicada */}
        {/* Busca compacta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: C.card, border: `1px solid ${busca ? C.brand : C.border}`, borderRadius: RADIUS.md, padding: '4px 8px' }}>
          <Search size={12} color={C.textMuted} />
          <input placeholder="Buscar..." value={busca} onChange={e => { setBusca(e.target.value); }}
            style={{ background: 'transparent', border: 'none', color: C.text, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", outline: 'none', width: 110 }} />
          {busca && (
            <button onClick={() => { setBusca(''); }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', lineHeight: 1, padding: 0, display: 'flex' }}><X size={12} /></button>
          )}
        </div>
        {/* Botões lado direito: Salvar versão + Nova Categoria */}
        {!modoLeitura && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Botão Salvar versão */}
            <button
              onClick={handleSalvarVersao}
              disabled={salvandoVersao}
              title="Salva um ponto de restauração no histórico agora"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: RADIUS.md,
                border: `1.5px solid ${versaoOk ? '#22C55E' : '#F59E0B'}`,
                background: versaoOk ? '#22C55E18' : '#F59E0B18',
                color: versaoOk ? '#22C55E' : '#F59E0B',
                fontWeight: 700, fontSize: FONT.xs,
                fontFamily: "'Inter',sans-serif",
                cursor: salvandoVersao ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', transition: 'all 0.2s', opacity: salvandoVersao ? 0.6 : 1,
              }}
            >
              {versaoOk
                ? <><Check size={13} /> Versão salva!</>
                : salvandoVersao
                  ? 'Salvando…'
                  : <><BookmarkPlus size={13} /> Salvar versão</>
              }
            </button>
            {/* Botão Nova Categoria */}
            <button
              onClick={() => setModalNovaCatRapida(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: RADIUS.md,
                border: `1.5px solid ${C.brand}`, background: C.brand + '18',
                color: C.brand, fontWeight: 700, fontSize: FONT.xs,
                fontFamily: "'Inter',sans-serif", cursor: 'pointer',
                whiteSpace: 'nowrap', transition: 'background 0.15s',
              }}
            >
              + Nova Categoria
            </button>
          </div>
        )}
      </div>

      {/* ── Barra de chips de filtros ativos + botão Atualizar ──────────── */}
      {temFiltroAtivo() && (() => {
        const nomesMeses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const chips = [];
        if (filtroMes) {
          const [yyyy, mm] = filtroMes.split('-');
          chips.push({ id: 'mes', label: `${nomesMeses[parseInt(mm,10)-1]}/${yyyy}` });
        }
        if (filtroStatus !== 'todos') chips.push({ id: 'status', label: filtroStatus === 'pendente' ? 'Sem categoria' : 'Categorizados' });
        if (ctx.filtroConta) chips.push({ id: 'conta', label: `Conta: ${ctx.filtroConta}` });
        if (filtroCategoria) {
          const cat = catPorId.get(filtroCategoria);
          chips.push({ id: 'categoria', label: `Cat: ${cat?.nome || filtroCategoria}` });
        }
        if (ctx.filtroFormato) chips.push({ id: 'formato', label: `Formato: ${ctx.filtroFormato}` });
        // filtroOrigem removido: WhatsApp tem página própria
        if (busca) chips.push({ id: 'busca', label: `"${busca.length > 15 ? busca.slice(0,15) + '…' : busca}"` });
        if (filtrosColuna.conta.size > 0)     chips.push({ id: 'col_conta',    label: `Conta ×${filtrosColuna.conta.size}` });
        if (filtrosColuna.formato.size > 0)   chips.push({ id: 'col_formato',  label: `Formato ×${filtrosColuna.formato.size}` });
        if (filtrosColuna.macro.size > 0)     chips.push({ id: 'col_macro',    label: `Macro ×${filtrosColuna.macro.size}` });
        if (filtrosColuna.categoria.size > 0) chips.push({ id: 'col_categoria',label: `Cat. ×${filtrosColuna.categoria.size}` });
        if (filtrosColuna.parcela.size > 0)   chips.push({ id: 'col_parcela',  label: `Parcela ×${filtrosColuna.parcela.size}` });

        return (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: selecionados.size > 0 ? 8 : 12, padding: '6px 10px', background: C.bg, borderRadius: RADIUS.md, border: `1px solid ${lockedIds.size > 0 ? C.yellow : C.border}`, transition: 'border-color 0.2s' }}>
            <span style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>Filtros:</span>
            {chips.map(chip => (
              <button
                key={chip.id}
                onClick={() => removerFiltro(chip.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 20,
                  border: `1px solid ${C.brand}55`,
                  background: C.brand + '18', color: C.brand,
                  fontSize: FONT.xs, fontFamily: "'Inter',sans-serif",
                  fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.brand + '30'}
                onMouseLeave={e => e.currentTarget.style.background = C.brand + '18'}
                title={`Remover filtro: ${chip.label}`}
              >
                {chip.label} <X size={9} style={{ opacity: 0.7 }} />
              </button>
            ))}
            {/* Botão Atualizar — aparece quando há transações travadas (editadas com filtro ativo) */}
            {lockedIds.size > 0 && (
              <button
                onClick={atualizarLista}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 12px', borderRadius: 20,
                  border: `1.5px solid ${C.yellow}`,
                  background: C.yellow + '22', color: C.yellow,
                  fontSize: FONT.xs, fontFamily: "'Inter',sans-serif",
                  fontWeight: 700, cursor: 'pointer',
                  animation: 'pulse 1.5s infinite',
                }}
                title={`${lockedIds.size} transaç${lockedIds.size === 1 ? 'ão editada mantida' : 'ões editadas mantidas'} na lista. Clique para atualizar.`}
              >
                ↺ Atualizar lista
              </button>
            )}
            {/* Limpar tudo */}
            <button
              onClick={limparTodosFiltros}
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 10px', borderRadius: 20,
                border: `1px solid ${C.desp}44`,
                background: 'transparent', color: C.textMuted,
                fontSize: FONT.xs, fontFamily: "'Inter',sans-serif",
                fontWeight: 600, cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.desp + '15'; e.currentTarget.style.color = C.desp; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textMuted; }}
            >
              Limpar tudo ✕
            </button>
          </div>
        );
      })()}

      {/* Barra de ações em lote */}
      {selecionados.size > 0 && !modoLeitura && (() => {
        const selArr = [...selecionados];
        const sel1 = selecionados.size === 1;
        const transacaoSel1 = sel1 ? transacoes.find(t => t.id === selArr[0]) : null;

        const aplicarLote = (campo, valor) => {
          if (!valor) return;
          setClienteAtivo(prev => ({
            ...prev,
            transacoes: prev.transacoes.map(t =>
              selecionados.has(t.id) ? { ...t, [campo]: valor } : t
            )
          }));
        };

        const selStyle = {
          background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
          padding: '5px 10px', color: C.text, fontSize: FONT.sm,
          fontFamily: "'Inter',sans-serif", outline: 'none', cursor: 'pointer'
        };

        return (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', background: C.brand + '18', border: `1px solid ${C.brand}44`, borderRadius: RADIUS.md, padding: '8px 14px' }}>
            <span style={{ fontSize: FONT.sm, fontWeight: 600, color: C.brand }}>{selecionados.size} selecionada{selecionados.size > 1 ? 's' : ''}</span>

            {sel1 ? (
              /* ── 1 selecionada: Editar + Deletar + Limpar ── */
              <>
                <Btn size="sm" onClick={() => { setModalEditar(transacaoSel1); }}><Pencil size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Editar</Btn>
                <Btn size="sm" variant="ghost" onClick={deletarSelecionados} style={{ color: C.desp }}><X size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Deletar</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>Limpar seleção</Btn>
              </>
            ) : (
              /* ── 2+ selecionadas: controles em lote ── */
              <>
                {/* Formato */}
                <select defaultValue="" onChange={e => { aplicarLote('formato', e.target.value); e.target.value = ''; }} style={selStyle}>
                  <option value="">Formato…</option>
                  <option value="pix">Pix</option>
                  <option value="debito">Débito</option>
                  <option value="credito">Crédito</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="boleto">Boleto</option>
                  <option value="ted">TED/DOC</option>
                </select>

                {/* Macro */}
                <select defaultValue="" onChange={e => { aplicarLote('grupo', e.target.value); e.target.value = ''; }} style={selStyle}>
                  <option value="">Macro…</option>
                  {Object.values(GRUPOS).map(g => <option key={g} value={g}>{g}</option>)}
                </select>

                {/* Categoria (hierárquica com optgroup) */}
                <select defaultValue="" onChange={e => { if (e.target.value) categorizarSelecionados(e.target.value); e.target.value = ''; }} style={selStyle}>
                  <option value="">Categoria…</option>
                  {Object.entries(categoriasPorMacro).map(([grupo, cats]) =>
                    cats.length === 0 ? null : (
                      <optgroup key={grupo} label={grupo}>
                        {cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </optgroup>
                    )
                  )}
                </select>

                {/* Parcelas */}
                <input type="number" min="1" placeholder="Parcelas" defaultValue=""
                  onBlur={e => { const v = parseInt(e.target.value); if (v > 0) { aplicarLote('parcelaTotal', v); aplicarLote('parcelasRestantes', v); e.target.value = ''; } }}
                  style={{ ...selStyle, width: 80 }} />

                <Btn size="sm" variant="ghost" onClick={deletarSelecionados} style={{ color: C.desp }}>✕ Deletar</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>Limpar seleção</Btn>
              </>
            )}
          </div>
        );
      })()}

      {/* Tabela */}
      {transacoesFiltradas.length === 0 ? (
        <Card>
          <Empty icon="📄" title="Nenhuma transação encontrada"
            sub={transacoes.length === 0 ? 'Importe um arquivo CSV para começar' : 'Tente ajustar os filtros'} />
        </Card>
      ) : (
        <div style={{ background: C.card, borderRadius: RADIUS.lg, border: `1px solid ${C.border}`, overflow: 'hidden', width: '100%' }}>
          {/* Único container de scroll: horizontal + vertical — thead sticky garante alinhamento */}
          <div
            ref={virt.containerRef}
            style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 560, background: C.card, display: 'block', width: '100%' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONT.sm }}>
              <colgroup>
                <col style={{ width: 36, minWidth: 36 }} />
                <col style={{ width: 90, minWidth: 90 }} />
                <col style={{ width: 110, minWidth: 110 }} />
                <col style={{ width: 80, minWidth: 80 }} />
                <col style={{ width: 90, minWidth: 90 }} />
                <col />
                <col style={{ width: 80, minWidth: 80 }} />
                <col style={{ width: 120, minWidth: 120 }} />
                <col style={{ width: 150, minWidth: 150 }} />
                <col style={{ width: 70, minWidth: 70 }} />
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                  <th style={{ padding: '10px 10px', width: 36, background: C.bg }}>
                    {!modoLeitura && (
                      <input type="checkbox"
                        checked={selecionados.size === transacoesFiltradas.length && transacoesFiltradas.length > 0}
                        onChange={toggleTodos} style={{ cursor: 'pointer', accentColor: C.brand }} />
                    )}
                  </th>
                  {/* Cliente (portador) — com filtro por coluna (cascata) */}
                  <ColFilter label="Cliente" valores={valoresCascata.portadorCol}
                    selecionados={filtrosColuna.portador}
                    onChange={s => setFiltroCol('portador', s)} />
                  {/* Conta — com filtro por coluna (cascata) */}
                  <ColFilter label="Conta" valores={valoresCascata.contaCol}
                    selecionados={filtrosColuna.conta}
                    onChange={s => setFiltroCol('conta', s)} />
                  {/* Data — estático */}
                  <th style={{ padding: '10px 10px', textAlign: 'left', color: C.textMuted, fontWeight: 600, fontSize: FONT.xs, whiteSpace: 'nowrap', background: C.bg }}>Data</th>
                  {/* Valor — clicável: cicla null → desc → asc → null */}
                  <th style={{ padding: '10px 4px', background: C.bg }}>
                    <button
                      onClick={() => setOrdemValor(o => o === null ? 'desc' : o === 'desc' ? 'asc' : null)}
                      title={ordemValor === null ? 'Ordenar por valor (maior → menor)' : ordemValor === 'desc' ? 'Ordenar por valor (menor → maior)' : 'Voltar à ordem por data'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
                        borderRadius: RADIUS.sm,
                        color: ordemValor ? C.brand : C.textMuted,
                        fontWeight: 600, fontSize: FONT.xs, whiteSpace: 'nowrap',
                        transition: 'color .15s',
                      }}
                    >
                      Valor
                      {ordemValor === null  && <ArrowUpDown size={11} style={{ opacity: 0.45 }} />}
                      {ordemValor === 'desc' && <ArrowDown   size={11} />}
                      {ordemValor === 'asc'  && <ArrowUp     size={11} />}
                    </button>
                  </th>
                  {/* Descrição — estático */}
                  <th style={{ padding: '10px 10px', textAlign: 'left', color: C.textMuted, fontWeight: 600, fontSize: FONT.xs, whiteSpace: 'nowrap', background: C.bg }}>Descrição</th>
                  {/* Formato — com filtro por coluna (cascata) */}
                  <ColFilter label="Formato" valores={valoresCascata.formatoCol}
                    selecionados={filtrosColuna.formato}
                    onChange={s => setFiltroCol('formato', s)} />
                  {/* Macro — com filtro por coluna (cascata) */}
                  <ColFilter label="Macro" valores={valoresCascata.macroCol}
                    selecionados={filtrosColuna.macro}
                    onChange={s => setFiltroCol('macro', s)} />
                  {/* Categoria — com filtro por coluna (cascata) */}
                  <ColFilter label="Categoria" valores={valoresCascata.categoriaCol}
                    selecionados={filtrosColuna.categoria}
                    onChange={s => setFiltroCol('categoria', s)}
                    categorias={categorias} />
                  {/* Parc. — com filtro por coluna */}
                  <ColFilter label="Parc." valores={valoresCascata.parcela}
                    selecionados={filtrosColuna.parcela}
                    onChange={s => setFiltroCol('parcela', s)}
                    numeric />
                </tr>
              </thead>
              <tbody>
                {virt.visibleItems.map(({ item: t, index: i }) => {
                  const cat = catPorId.get(t.categoria);
                  // normalizarMacro: corrige legado 'Despesas Fixas' → 'Despesas Essenciais'
                  const _grupoRaw = macroTemp[t.id] !== undefined ? macroTemp[t.id] : (cat?.grupo || t.grupoImportado || '');
                  const grupoAtual = _grupoRaw === 'Despesas Fixas' ? 'Despesas Essenciais' : _grupoRaw;
                  const catsDoGrupo = grupoAtual ? (categoriasPorMacro[grupoAtual] || []) : categoriasOrdenadas;
                  const sel = selecionados.has(t.id);
                  const jaAprendeu = aprendizadoOk[t.id] || transComRegra.has(t.id);
                  return (
                    <tr key={t.id}
                      onMouseEnter={e => { if (!sel) { const td = e.currentTarget.querySelector('.acoes-linha'); if (td) td.style.opacity = '1'; } }}
                      onMouseLeave={e => { if (!sel) { const td = e.currentTarget.querySelector('.acoes-linha'); if (td) td.style.opacity = '0'; } }}
                      style={{
                        borderBottom: `1px solid ${C.border}20`,
                        background: sel ? C.brand + '18' : i % 2 === 0 ? 'transparent' : C.bg + '44',
                      }}>
                      {/* Checkbox */}
                      <td style={{ padding: '7px 10px', textAlign: 'center', width: 36 }}>
                        {!modoLeitura && (
                          <input type="checkbox" checked={sel} onChange={() => toggleSelecionar(t.id)}
                            style={{ cursor: 'pointer', accentColor: C.brand }} />
                        )}
                      </td>
                      {/* Cliente (portador) */}
                      <td style={{ padding: '7px 10px', minWidth: 70, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.portador
                          ? <span style={{ fontSize: FONT.xs, fontWeight: 600, color: C.brand, background: `${C.brand}14`, padding: '2px 7px', borderRadius: 10 }}>{t.portador}</span>
                          : <span style={{ fontSize: FONT.xs, color: C.textDim }}>—</span>
                        }
                      </td>
                      {/* Conta */}
                      <td style={{ padding: '7px 10px', minWidth: 90, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: FONT.xs, color: C.textMuted }}>{t.conta || '—'}</span>
                      </td>
                      {/* Data */}
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', fontSize: FONT.xs }}>
                        <span style={{ color: C.textMuted }}>{t.data ? t.data.split('-').reverse().join('/') : '—'}</span>
                        {(() => {
                          const periodo = t.competencia || (t.data ? t.data.slice(0, 7) : null);
                          if (!periodo) return null;
                          const [y, m] = periodo.split('-');
                          const ns = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                          const label = `${ns[parseInt(m,10)-1]}/${y}`;
                          const diffComp = t.competencia && t.data && t.competencia !== t.data.slice(0, 7);
                          return (
                            <span style={{ display: 'block', fontSize: 10, color: diffComp ? C.yellow : C.brand + 'aa', fontWeight: 600 }}
                              title={diffComp ? `Competência: ${label} (difere da data de compra)` : `Competência: ${label}`}>
                              {label}{diffComp ? ' *' : ''}
                            </span>
                          );
                        })()}
                      </td>
                      {/* Valor */}
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: t.tipo === 'receita' ? C.rec : t.tipo === 'neutro' ? C.textMuted : C.desp, whiteSpace: 'nowrap' }}>
                        {t.tipo === 'receita' ? '+' : t.tipo === 'despesa' ? '−' : ''}{fmtBRL(Math.abs(t.valor))}
                      </td>
                      {/* Descrição */}
                      <td title={t.descricao} style={{ padding: '7px 10px', color: C.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default' }}>
                        {t.origem === 'whatsapp' && <span title={t.subOrigem === 'pdf' ? 'Importado via WhatsApp (PDF)' : 'Lançado via WhatsApp'} style={{ marginRight: 3, fontSize: 12 }}>📱{t.subOrigem === 'pdf' ? '📄' : ''}</span>}
                        {t.descricao}
                      </td>
                      {/* Formato — editável inline */}
                      {(() => {
                        const fmtId = normalizarFormato(t.formato);
                        return (
                          <td style={{ padding: '7px 8px', minWidth: 90 }}>
                            {modoLeitura ? (
                              fmtId
                                ? <span style={{ fontSize: FONT.xs, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: formatoColor(fmtId) + '22', color: formatoColor(fmtId), whiteSpace: 'nowrap' }}>{FORMATO_LABEL[fmtId] || fmtId}</span>
                                : <span style={{ color: C.textMuted, fontSize: FONT.xs }}>—</span>
                            ) : (
                              <select
                                value={fmtId || ''}
                                onChange={e => atualizarTransacao(t.id, { formato: e.target.value || null })}
                                style={{
                                  background: 'transparent',
                                  border: `1px solid ${fmtId ? formatoColor(fmtId) + '55' : C.border}`,
                                  borderRadius: 6,
                                  padding: '3px 6px',
                                  color: fmtId ? formatoColor(fmtId) : C.textMuted,
                                  fontSize: FONT.xs,
                                  fontWeight: fmtId ? 600 : 400,
                                  fontFamily: "'Inter',sans-serif",
                                  outline: 'none',
                                  cursor: 'pointer',
                                  width: '100%',
                                }}>
                                <option value="">— formato —</option>
                                <option value="pix">Pix</option>
                                <option value="cartao_debito">Débito</option>
                                <option value="cartao_credito">Crédito</option>
                                <option value="dinheiro">Dinheiro</option>
                                <option value="boleto">Boleto</option>
                                <option value="ted">TED/DOC</option>
                              </select>
                            )}
                          </td>
                        );
                      })()}
                      {/* Macro – dropdown clicável sempre visível */}
                      <td style={{ padding: '7px 8px', minWidth: 120 }}>
                        {modoLeitura ? (
                          <span style={{ fontSize: FONT.xs, fontWeight: grupoAtual ? 700 : 400, color: grupoAtual ? grupoColor(grupoAtual) : C.textMuted }}>
                            {grupoAtual || '—'}
                          </span>
                        ) : (
                          <select
                            value={grupoAtual}
                            onChange={e => trocarMacroLinha(t.id, e.target.value)}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${grupoAtual ? grupoColor(grupoAtual) + '55' : C.border}`,
                              borderRadius: 6,
                              padding: '3px 6px',
                              color: grupoAtual ? grupoColor(grupoAtual) : C.textMuted,
                              fontSize: FONT.xs,
                              fontFamily: "'Inter',sans-serif",
                              fontWeight: grupoAtual ? 700 : 400,
                              outline: 'none',
                              cursor: 'pointer',
                              width: '100%',
                            }}
                          >
                            <option value="">— macro —</option>
                            {Object.values(GRUPOS).map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        )}
                      </td>
                      {/* Categoria — dropdown único com optgroup hierárquico */}
                      <td style={{ padding: '7px 8px', minWidth: 190 }}>
                        {modoLeitura ? (
                          (() => {
                            const subcat = catPorIdCompleto.get(t.categoria);
                            const pai = subcat?.categoria ? catPorIdCompleto.get(subcat.categoria) : null;
                            return (
                              <span style={{ fontSize: FONT.xs, fontWeight: t.categoria ? 700 : 400, color: t.categoria ? C.brand : C.textMuted }}>
                                {t.categoria ? (pai ? `${pai.nome} › ${subcat.nome}` : (subcat?.nome || '—')) : '—'}
                              </span>
                            );
                          })()
                        ) : (
                          <select
                            value={t.categoria || ''}
                            onChange={e => {
                              salvarInline(t.id, 'categoria', e.target.value || null);
                              setMacroTemp(prev => { const n = {...prev}; delete n[t.id]; return n; });
                            }}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${t.categoria ? C.brand + '66' : C.yellow + '88'}`,
                              borderRadius: 6,
                              padding: '3px 6px',
                              color: t.categoria ? C.brand : C.yellow,
                              fontSize: FONT.xs,
                              fontFamily: "'Inter',sans-serif",
                              fontWeight: t.categoria ? 700 : 400,
                              outline: 'none',
                              cursor: 'pointer',
                              width: '100%',
                            }}
                          >
                            <option value="">— sem categoria —</option>
                            {(catIntermediarias[grupoAtual] || []).map(interm => {
                              const subs = catPorCategoria[interm.id] || [];
                              if (subs.length === 0) return null;
                              return (
                                <optgroup key={interm.id} label={interm.nome}>
                                  {subs.map(s => (
                                    <option key={s.id} value={s.id}>{s.nome}</option>
                                  ))}
                                </optgroup>
                              );
                            })}
                            {/* Subcats sem pai (legado/custom) */}
                            {catsDoGrupo.filter(c => !c.isCategoria && !c.categoria).length > 0 && (
                              <optgroup label="Outros">
                                {catsDoGrupo.filter(c => !c.isCategoria && !c.categoria).map(s => (
                                  <option key={s.id} value={s.id}>{s.nome}</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        )}
                      </td>
                      {/* Parcelas */}
                      <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const temParcela = t.parcelaTotal > 1;
                          const pRestantes = t.parcelasRestantes != null
                            ? t.parcelasRestantes
                            : (temParcela ? t.parcelaTotal - (t.parcelaAtual || 1) + 1 : null);
                          const exibir = temParcela ? pRestantes : null;
                          return modoLeitura ? (
                            <span style={{ fontSize: FONT.xs, color: C.textMuted }}>
                              {exibir ? `${exibir}x` : '—'}
                            </span>
                          ) : (
                            <input
                              type="number" min="1"
                              value={exibir || ''}
                              onChange={e => {
                                const n = parseInt(e.target.value) || null;
                                const novas = transacoes.map(tx => tx.id === t.id
                                  ? { ...tx, parcelaAtual: 1, parcelaTotal: n, parcelasRestantes: n }
                                  : tx
                                );
                                setClienteAtivo({ ...clienteAtivo, transacoes: novas });
                              }}
                              placeholder="—"
                              title="Parcelas restantes (incluindo o mês atual)"
                              style={{ width: 44, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 4px', color: C.text, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", outline: 'none', textAlign: 'center' }}
                            />
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
