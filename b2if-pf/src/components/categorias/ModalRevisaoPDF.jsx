import { useState, useRef, useMemo } from 'react';
import { AlertTriangle, Zap, X, CheckCircle2, Brain } from 'lucide-react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn, Modal, Input, Select, Badge, fmtBRL } from '../UI.jsx';
import { GRUPOS } from '../../data/categorias.js';
import { gerarId } from '../../utils/clienteStorage.js';
import { autoCategorizar } from '../../utils/parser.js';
import { marcarDuplicatas } from '../../utils/fingerprint.js';
import { StatBox, TipoBadge, MiniBtn, grupoColor, normalizarFormato, formatoColor } from './helpers.jsx';
import { BancoLogo } from '../BancoLogo.jsx';

// ── Modal de Revisão de PDF ───────────────────────────────────────────────────
function ModalRevisaoPDF({ dados, categorias, regras, onConfirmar, onCancelar, clienteAtivo, setClienteAtivo, modoLeitura }) {
  const [transacoes, setTransacoes] = useState(dados.transacoes);
  const [nomeConta, setNomeConta]   = useState(dados.nomeConta);
  // Inicializa competência a partir do compFatura do PDF, se disponível
  const [competencia, setCompetencia] = useState(dados.compFatura || '');   // YYYY-MM global
  const [periodoLabel, setPeriodoLabel] = useState(''); // label texto
  const [abaRevisao, setAbaRevisao]   = useState('lista');
  // Inicializa checkboxes: duplicatas vêm desmarcadas por padrão
  const [selecionados, setSelecionados] = useState(() => {
    const s = new Set();
    dados.transacoes.forEach((t, i) => { if (!t._duplicata) s.add(i); });
    return s;
  });
  const [macroLote, setMacroLote] = useState('');
  // Estado do macro selecionado por linha (fora do .map para não violar regra de hooks)
  const [macrosPorLinha, setMacrosPorLinha] = useState(() => {
    const catMap = new Map();
    for (const c of categorias) catMap.set(c.id, c);
    const init = {};
    dados.transacoes.forEach((t, i) => {
      init[i] = catMap.get(t.categoria)?.grupo || t.grupoImportado || '';
    });
    return init;
  });

  const semCat = transacoes.filter(t => !t.categoria).length;
  const total  = transacoes.length;
  const qtdDuplicatas         = transacoes.filter(t => t._duplicata).length;
  const qtdDuplicatasSugeridas = transacoes.filter(t => t._duplicataSugerida).length;
  const qtdSelecionados = selecionados.size;

  // categorias ordenadas por macro (para dropdowns) — memoizado
  const catsOrdenadas = useMemo(
    () => [...categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt')),
    [categorias]
  );
  const catMapModal = useMemo(() => { const m = new Map(); for (const c of categorias) m.set(c.id, c); return m; }, [categorias]);
  const catsPorMacro = useMemo(() => {
    const mapa = {};
    for (const g of Object.values(GRUPOS)) mapa[g] = [];
    for (const c of catsOrdenadas) {
      if (mapa[c.grupo]) mapa[c.grupo].push(c);
      else mapa[c.grupo] = [c];
    }
    return mapa;
  }, [catsOrdenadas]);

  // Hierarquia para dropdowns do modal de revisão
  const intermsRevisao = useMemo(() => {
    const mapa = {};
    for (const g of Object.values(GRUPOS)) mapa[g] = [];
    for (const c of categorias) {
      if (c.isCategoria) {
        if (!mapa[c.grupo]) mapa[c.grupo] = [];
        mapa[c.grupo].push(c);
      }
    }
    return mapa;
  }, [categorias]);

  const subcatsPorIntermRevisao = useMemo(() => {
    const mapa = {};
    for (const c of categorias) {
      if (!c.isCategoria && c.categoria) {
        if (!mapa[c.categoria]) mapa[c.categoria] = [];
        mapa[c.categoria].push(c);
      }
    }
    return mapa;
  }, [categorias]);

  // Estado da intermediária selecionada por linha (índice → catIntermId)
  const [intermsLinha, setIntermsLinha] = useState(() => {
    const init = {};
    dados.transacoes.forEach((t, i) => {
      const cat = categorias.find(c => c.id === t.categoria);
      init[i] = cat?.categoria || '';
    });
    return init;
  });

  function editar(idx, campo, valor) {
    setTransacoes(ts => ts.map((t, i) =>
      i === idx
        ? {
            ...t,
            [campo]: valor,
            status: campo === 'categoria'
              ? (valor ? 'categorizado' : 'pendente')
              : t.status,
          }
        : t
    ));
  }
  function setMacroLinha(idx, novoMacro) {
    setMacrosPorLinha(prev => ({ ...prev, [idx]: novoMacro }));
    // Limpa categoria da linha ao trocar macro
    setTransacoes(ts => ts.map((t, i) =>
      i === idx ? { ...t, categoria: null, status: 'pendente' } : t
    ));
  }
  function remover(idx) { setTransacoes(ts => ts.filter((_, i) => i !== idx)); }

  function handleAutoCat() {
    setTransacoes(ts => ts.map(t => {
      if (t.categoria) return t;
      const desc = (t.descricao || '').toLowerCase();
      for (const r of [...regras].sort((a,b) => a.prioridade - b.prioridade)) {
        if (desc.includes(r.keyword.toLowerCase()))
          return { ...t, categoria: r.categoria, status: 'categorizado' };
      }
      return t;
    }));
  }

  function toggleSel(idx) {
    setSelecionados(prev => { const s = new Set(prev); s.has(idx) ? s.delete(idx) : s.add(idx); return s; });
  }
  function toggleTodos() {
    // Ao marcar todos: inclui todas (inclusive duplicatas). Ao desmarcar: limpa tudo.
    setSelecionados(selecionados.size === total ? new Set() : new Set(transacoes.map((_,i) => i)));
  }
  function toggleDuplicatas() {
    // Alterna seleção das duplicatas certas E sugeridas
    const novas = new Set(selecionados);
    const todasDupSelecionadas = transacoes.every((t, i) => !(t._duplicata || t._duplicataSugerida) || novas.has(i));
    transacoes.forEach((t, i) => {
      if (t._duplicata || t._duplicataSugerida) {
        todasDupSelecionadas ? novas.delete(i) : novas.add(i);
      }
    });
    setSelecionados(novas);
  }
  function categorizarLote(catId) {
    setTransacoes(ts => ts.map((t, i) =>
      selecionados.has(i) ? { ...t, categoria: catId, status: 'categorizado' } : t
    ));
    setSelecionados(new Set());
  }
  function deletarLote() {
    setTransacoes(ts => ts.filter((_, i) => !selecionados.has(i)));
    setSelecionados(new Set());
  }

  // ── Aprendizado na revisão ──────────────────────────────────────────────
  const [aprOkRevisao, setAprOkRevisao] = useState({}); // { [idx]: true } regra criada

  function extrairKeywordRevisao(descricao = '') {
    const limpo = descricao.trim()
      .replace(/\s*PARC\s+\d{1,2}\/\d{1,2}/gi, '')
      .replace(/\s+\d{1,2}\/\d{1,2}$/g, '')
      .replace(/\s+(BR|SP|RJ|MG|RS|SC|PR|BA|CE|GO|DF)$/gi, '')
      .replace(/\s+[A-Z]{2}\s*$/g, '')
      .trim();
    return limpo.split(/\s+/).filter(Boolean).slice(0, 3).join(' ').slice(0, 30).toLowerCase();
  }

  // Verifica se já existe regra cobrindo esta descrição (nas regras do cliente)
  function temRegraRevisao(t) {
    const desc = (t.descricao || '').toLowerCase();
    const regrasAtuais = clienteAtivo?.regras || [];
    return regrasAtuais.some(r => r.keyword && desc.includes(r.keyword.toLowerCase()));
  }

  // Salva regra imediatamente ao clicar 🧠 — sem modal
  function salvarAprenderRevisao(idx, t) {
    if (!t.categoria || !clienteAtivo) return;
    const keyword = extrairKeywordRevisao(t.descricao);
    if (!keyword) return;
    const regrasAtuais = clienteAtivo.regras || [];
    const jaExiste = regrasAtuais.find(r => r.keyword.toLowerCase() === keyword.toLowerCase());
    let novasRegras;
    if (jaExiste) {
      novasRegras = regrasAtuais.map(r =>
        r.keyword.toLowerCase() === keyword.toLowerCase()
          ? { ...r, categoria: t.categoria }
          : r
      );
    } else {
      novasRegras = [...regrasAtuais, { id: `r_${Date.now()}`, keyword, categoria: t.categoria, prioridade: 2 }];
    }
    setClienteAtivo({ ...clienteAtivo, regras: novasRegras });
    setAprOkRevisao(prev => ({ ...prev, [idx]: true }));
  }

  const catsLote = macroLote ? (catsPorMacro[macroLote] || []) : [];

  const inputStyle = { background: 'transparent', border: 'none', color: C.text, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", outline: 'none', width: '100%' };
  const selStyle = (hasVal) => ({ background: hasVal ? C.bg : C.yellowBg, border: `1px solid ${hasVal ? C.border : C.yellow}`, borderRadius: 4, padding: '2px 5px', color: hasVal ? C.text : C.yellow, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", outline: 'none', width: '100%' });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.xl, width: '100%', maxWidth: 1100, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Logo do banco */}
            <BancoLogo banco={dados.bancoId || dados.banco} size={44} radius={10} />
            <div>
              <div style={{ fontSize: FONT.lg, fontWeight: 800, color: C.text }}>Revisar Importação — PDF</div>
              <div style={{ fontSize: FONT.sm, color: C.textMuted, marginTop: 2 }}>
                <strong style={{ color: C.brand }}>{dados.banco || nomeConta}</strong> · {total} transações ·{' '}
                {semCat > 0 ? <span style={{ color: C.yellow }}>{semCat} sem categoria</span>
                            : <span style={{ color: C.rec }}>todas categorizadas ✓</span>}
                {qtdDuplicatas > 0 && (
                  <span style={{ color: C.desp }}> · <span title="Parcelamentos já lançados — desmarcados automaticamente" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={11} /> {qtdDuplicatas} duplicata{qtdDuplicatas !== 1 ? 's' : ''} detectada{qtdDuplicatas !== 1 ? 's' : ''}</span></span>
                )}
                {qtdDuplicatasSugeridas > 0 && (
                  <span style={{ color: C.yellow }}> · <span title="Possíveis duplicatas — verifique antes de importar" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={11} /> {qtdDuplicatasSugeridas} possível{qtdDuplicatasSugeridas !== 1 ? 'eis' : ''} duplicata{qtdDuplicatasSugeridas !== 1 ? 's' : ''}</span></span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onCancelar} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', lineHeight: 1, padding: 4 }}><X size={18} /></button>
        </div>

        {/* ── Campos globais + abas ── */}
        <div style={{ padding: '10px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: FONT.xs, color: C.textMuted, whiteSpace: 'nowrap' }}>Conta:</span>
            <input value={nomeConta} onChange={e => setNomeConta(e.target.value)}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 8px', color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none', width: 160 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: FONT.xs, color: C.textMuted, whiteSpace: 'nowrap' }}>Competência:</span>
            <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 8px', color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: FONT.xs, color: C.textMuted, whiteSpace: 'nowrap' }}>Período (label):</span>
            <input value={periodoLabel} onChange={e => setPeriodoLabel(e.target.value)} placeholder="Ex: Dez/2024"
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 8px', color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none', width: 130 }} />
          </div>
          {semCat > 0 && <Btn size="sm" variant="outline" onClick={handleAutoCat}><Zap size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Auto ({semCat})</Btn>}
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {['lista','texto'].map(v => (
              <button key={v} onClick={() => setAbaRevisao(v)}
                style={{ padding: '4px 12px', borderRadius: 4, border: `1px solid ${C.border}`, background: abaRevisao === v ? C.brand : 'transparent', color: abaRevisao === v ? C.bg : C.textMuted, fontSize: FONT.xs, cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
                {v === 'lista' ? 'Transações' : 'Texto'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Barra lote (aparece quando há seleção) ── */}
        {selecionados.size > 0 && !modoLeitura && (
          <div style={{ padding: '8px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, background: C.brand + '14', flexWrap: 'wrap' }}>
            <span style={{ fontSize: FONT.sm, fontWeight: 700, color: C.brand }}>{selecionados.size} selecionadas</span>
            <select value={macroLote} onChange={e => setMacroLote(e.target.value)}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 8px', color: C.text, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", outline: 'none' }}>
              <option value="">Filtrar macro...</option>
              {Object.values(GRUPOS).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select defaultValue="" onChange={e => { if(e.target.value) categorizarLote(e.target.value); e.target.value=''; }}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 8px', color: C.text, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", outline: 'none', minWidth: 200 }}>
              <option value="">Categorizar como...</option>
              {(macroLote ? catsLote : catsOrdenadas).map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <Btn size="sm" variant="ghost" onClick={deletarLote} style={{ color: C.desp }}><X size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Deletar</Btn>
            <Btn size="sm" variant="ghost" onClick={() => setSelecionados(new Set())}>Limpar</Btn>
          </div>
        )}

        {/* ── Conteúdo ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {abaRevisao === 'texto' ? (
            <pre style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.6, padding: '16px 24px' }}>
              {dados.textoOriginal || 'Texto não disponível'}
            </pre>
          ) : total === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: C.textMuted }}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><AlertTriangle size={36} color={C.yellow} /></div>
              <div style={{ fontSize: FONT.base, fontWeight: 600, color: C.warn, marginBottom: 8 }}>Nenhuma transação detectada</div>
              <Btn variant="ghost" onClick={() => setAbaRevisao('texto')}>Ver texto extraído</Btn>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: FONT.sm }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                  <th style={{ padding: '8px 10px', width: 32 }}>
                    <input type="checkbox" checked={selecionados.size === total && total > 0}
                      onChange={toggleTodos} style={{ cursor: 'pointer', accentColor: C.brand }} />
                  </th>
                  {['Conta','Data','Valor','Descrição','Formato','Macro','Categoria','Parc.','',''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: C.textMuted, fontWeight: 600, fontSize: FONT.xs, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transacoes.map((t, i) => {
                  const catAtual = catMapModal.get(t.categoria);
                  const macroRow = macrosPorLinha[i] || catAtual?.grupo || t.grupoImportado || '';
                  const catsRow = macroRow ? (catsPorMacro[macroRow] || []) : catsOrdenadas;
                  const sel = selecionados.has(i);
                  const isDup      = !!t._duplicata;
                  const isDupSug    = !!t._duplicataSugerida;
                  const tooltipDup  = isDup
                    ? `Duplicata detectada (critério ${t._duplicataCriterio}): ${t._duplicataMotivo || 'já lançado'} — desmarcado automaticamente`
                    : isDupSug
                    ? `Possível duplicata (critério ${t._duplicataCriterio}): ${t._duplicataMotivo || 'verifique'} — verifique antes de importar`
                    : '';
                  return (
                    <tr key={i} title={tooltipDup}
                      style={{ borderBottom: `1px solid ${C.border}20`, background: isDup ? C.desp + '14' : isDupSug ? C.yellow + '10' : sel ? C.brand + '18' : i % 2 ? C.bg + '44' : 'transparent', opacity: isDup && !sel ? 0.45 : 1 }}>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <input type="checkbox" checked={sel} onChange={() => toggleSel(i)} style={{ cursor: 'pointer', accentColor: C.brand }} />
                      </td>
                      {/* Conta */}
                      <td style={{ padding: '6px 10px', minWidth: 80, maxWidth: 130 }}>
                        <input
                          value={t.conta || ''}
                          onChange={e => editar(i, 'conta', e.target.value)}
                          placeholder={nomeConta || 'conta'}
                          style={{ ...inputStyle, width: 110, color: C.text, fontSize: FONT.xs }}
                        />
                      </td>
                      {/* Data */}
                      <td style={{ padding: '6px 10px', color: C.textMuted, whiteSpace: 'nowrap', minWidth: 95 }}>
                        <input type="date" value={t.data || ''} onChange={e => editar(i,'data',e.target.value)} style={inputStyle} />
                      </td>
                      {/* Valor */}
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', minWidth: 90 }}>
                        <input type="number" value={t.valor || ''} onChange={e => editar(i,'valor', parseFloat(e.target.value)||0)}
                          style={{ ...inputStyle, color: t.tipo==='receita' ? C.rec : C.desp, fontWeight: 700, width: 80 }} />
                      </td>
                      {/* Descrição */}
                      <td style={{ padding: '6px 10px', minWidth: 200 }}>
                        <input value={t.descricao || ''} onChange={e => editar(i,'descricao',e.target.value)} style={inputStyle} />
                      </td>
                      {/* Formato */}
                      <td style={{ padding: '6px 8px', minWidth: 100 }}>
                        <select value={t.formato || ''} onChange={e => editar(i, 'formato', e.target.value || null)}
                          style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 5px', color: C.text, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", outline: 'none', width: '100%' }}>
                          <option value="">— formato —</option>
                          <option value="pix">Pix</option>
                          <option value="cartao_debito">Débito</option>
                          <option value="cartao_credito">Crédito</option>
                          <option value="dinheiro">Dinheiro</option>
                          <option value="boleto">Boleto</option>
                          <option value="ted">TED/DOC</option>
                        </select>
                      </td>
                      {/* Macro */}
                      <td style={{ padding: '6px 10px', minWidth: 130 }}>
                        <select value={macroRow} onChange={e => setMacroLinha(i, e.target.value)}
                          style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 5px', color: C.text, fontSize: FONT.xs, fontFamily: "'Inter',sans-serif", outline: 'none', width: '100%' }}>
                          <option value="">— macro —</option>
                          {Object.values(GRUPOS).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </td>
                      {/* Categoria — dropdown hierárquico: Intermediária → Subcategoria */}
                      <td style={{ padding: '6px 10px', minWidth: 180 }}>
                        {(() => {
                          const intermAtual = intermsLinha[i] || '';
                          const subcatAtualR = catMapModal.get(t.categoria);
                          const intermsDisponiveis = macroRow ? (intermsRevisao[macroRow] || []) : [];
                          const subcatsDisponiveis = intermAtual === '__sem_pai__'
                            ? catsRow.filter(c => !c.isCategoria && !c.categoria)
                            : intermAtual
                              ? (subcatsPorIntermRevisao[intermAtual] || [])
                              : [];
                          const semPaiRow = catsRow.filter(c => !c.isCategoria && !c.categoria);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {/* Select 1: Intermediária */}
                              <select
                                value={intermAtual}
                                onChange={e => {
                                  const novaInterm = e.target.value;
                                  setIntermsLinha(prev => ({ ...prev, [i]: novaInterm }));
                                  editar(i, 'categoria', null);
                                }}
                                style={{ ...selStyle(!!intermAtual), padding: '2px 5px', fontSize: FONT.xs }}
                              >
                                <option value="">— categoria —</option>
                                {intermsDisponiveis.map(interm => (
                                  <option key={interm.id} value={interm.id}>{interm.nome}</option>
                                ))}
                                {semPaiRow.length > 0 && <option value="__sem_pai__">Outros</option>}
                              </select>
                              {/* Select 2: Subcategoria */}
                              {subcatsDisponiveis.length > 0 && (
                                <select
                                  value={t.categoria || ''}
                                  onChange={e => editar(i, 'categoria', e.target.value || null)}
                                  style={{ ...selStyle(!!t.categoria), padding: '2px 5px', fontSize: FONT.xs }}
                                >
                                  <option value="">— subcategoria —</option>
                                  {subcatsDisponiveis.map(s => (
                                    <option key={s.id} value={s.id}>{s.nome}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      {/* Parc. */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: FONT.xs, fontWeight: 700 }}>
                        {(() => {
                          const temParcela = t.parcelaTotal > 1;
                          const pR = t.parcelasRestantes != null
                            ? t.parcelasRestantes
                            : (temParcela ? t.parcelaTotal - (t.parcelaAtual || 1) + 1 : null);
                          const exibir = temParcela ? pR : null;
                          if (isDup) return (
                            <span style={{ color: C.desp }} title={tooltipDup}>
                              <AlertTriangle size={10} /> {exibir ? `${exibir}x` : '—'}
                            </span>
                          );
                          if (isDupSug) return (
                            <span style={{ color: C.yellow }} title={tooltipDup}>
                              <AlertTriangle size={10} /> {exibir ? `${exibir}x` : '⚠️'}
                            </span>
                          );
                          return exibir
                            ? <span style={{ color: C.brand }} title={`${exibir} parcelas restantes`}>{exibir}x</span>
                            : <span style={{ color: C.textMuted }}>—</span>;
                        })()}
                      </td>
                      {/* Aprender */}
                      <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                        {(() => {
                          const jaAprendeuR = aprOkRevisao[i] || temRegraRevisao(t);
                          return (
                            <button
                              onClick={() => !jaAprendeuR && salvarAprenderRevisao(i, t)}
                              title={
                                jaAprendeuR ? 'Regra já criada para esta descrição'
                                : t.categoria ? 'Criar regra: próximas importações serão categorizadas automaticamente'
                                : 'Categorize primeiro para criar regra'
                              }
                              style={{
                                background: jaAprendeuR ? C.rec + '22' : 'transparent',
                                border: `1px solid ${jaAprendeuR ? C.rec : t.categoria ? C.border : C.border + '55'}`,
                                borderRadius: 4,
                                width: 26, height: 26,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: (jaAprendeuR || !t.categoria) ? 'default' : 'pointer',
                                opacity: (!jaAprendeuR && !t.categoria) ? 0.3 : 1,
                                fontSize: 13,
                                color: jaAprendeuR ? C.rec : C.textMuted,
                              }}
                            >
                              {jaAprendeuR ? <CheckCircle2 size={13} /> : <Brain size={13} />}
                            </button>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <button onClick={() => remover(i)} style={{ background: 'transparent', border: 'none', color: C.desp, cursor: 'pointer', lineHeight: 1, padding: 2 }}><X size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: FONT.sm, color: C.textMuted }}>
            {total} transações · <span style={{ color: C.rec }}>{total - semCat} categorizadas</span>
            {semCat > 0 && <span style={{ color: C.yellow }}> · {semCat} pendentes</span>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {(qtdDuplicatas > 0 || qtdDuplicatasSugeridas > 0) && (
              <Btn size="sm" variant="ghost" onClick={toggleDuplicatas}
                style={{ color: C.yellow, borderColor: C.yellow + '88' }}>
                {transacoes.every((t, i) => !(t._duplicata || t._duplicataSugerida) || selecionados.has(i))
                  ? `↩ Desmarcar duplicatas (${qtdDuplicatas + qtdDuplicatasSugeridas})`
                  : `Selecionar duplicatas (${qtdDuplicatas + qtdDuplicatasSugeridas})`}
              </Btn>
            )}
            <Btn variant="ghost" onClick={onCancelar}>Cancelar</Btn>
            <Btn
              onClick={() => {
                // Importa APENAS as linhas selecionadas
                const paraImportar = transacoes
                  .filter((_, i) => selecionados.has(i))
                  .map(t => ({
                    ...t,
                    conta: t.conta?.trim() || nomeConta,
                    competencia: competencia || t.competencia || null,
                    periodoLabel: periodoLabel || t.periodoLabel || nomeConta,
                  }));
                onConfirmar(paraImportar);
              }}
              disabled={qtdSelecionados === 0}
            >
              <CheckCircle2 size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />Confirmar e Importar ({qtdSelecionados}/{total})
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}


export { ModalRevisaoPDF };
