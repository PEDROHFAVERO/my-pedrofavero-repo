import { useState } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn, Card, Modal, Select, Empty } from '../UI.jsx';
import { GRUPOS } from '../../data/categorias.js';
import { MiniBtn, ModalFormNome } from './helpers.jsx';

export function AbaCategorias({ ctx }) {
  const {
    // Dados
    transacoes, clienteAtivo,
    // CRUD categorias
    renomearCategoriaNivel2, renomearCategoria,
    criarCategoriaNivel2, criarSubcategoria, moverSubcategoria,
    deletarCategoria, deletarCategoriaNivel2,
    // Estado modal
    modalNovaCategoria, setModalNovaCategoria,
    modalNovaSubcat, setModalNovaSubcat,
    modalMoverSubcat, setModalMoverSubcat,
    moverDestino, setMoverDestino,
    editandoNome2, setEditandoNome2,
    editandoCatNome, setEditandoCatNome,
    confirmDeleteCat, setConfirmDeleteCat,
    confirmDeleteCat2, setConfirmDeleteCat2,
    // App
    modoLeitura,
  } = ctx;

  // ── Accordion exclusivo nível 1: qual macro está aberto (null = todos fechados)
  const [macroAberto, setMacroAberto] = useState(null);
  // ── Accordion exclusivo nível 2: qual cat N2 está aberta (null = todas fechadas)
  // Reseta automaticamente ao trocar de macro
  const [cat2Aberta, setCat2Aberta] = useState(null);

  const toggleMacro = (grupo) => {
    if (macroAberto === grupo) {
      setMacroAberto(null);
      setCat2Aberta(null);
    } else {
      setMacroAberto(grupo);
      setCat2Aberta(null); // fecha todas as cat2 ao trocar de macro
    }
  };

  const toggleCat2 = (id) => {
    setCat2Aberta(prev => prev === id ? null : id);
  };

  return (
    <>
      {/* Legenda de hierarquia */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, padding: '10px 16px', background: C.brand + '0C', borderRadius: RADIUS.md, border: `1px solid ${C.brand}22`, flexWrap: 'wrap' }}>
        <span style={{ fontSize: FONT.xs, color: C.textMuted }}>Estrutura:</span>
        <span style={{ fontSize: FONT.xs, color: C.text }}><strong style={{ color: C.brand }}>Macro</strong> → <strong style={{ color: C.text }}>Categoria</strong> → <span style={{ opacity: 0.75 }}>Subcategoria (onde as transações são lançadas)</span></span>
        {!modoLeitura && (
          <span style={{ fontSize: FONT.xs, color: C.textDim, marginLeft: 'auto' }}>Clique duplo para renomear qualquer item</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.values(GRUPOS).filter(g => g !== GRUPOS.INTERNO).map(grupo => {
          const tipoGrupo = grupo === GRUPOS.RECEITAS ? 'receita' : 'despesa';
          const corGrupo =
            grupo === GRUPOS.RECEITAS      ? C.rec
            : grupo === GRUPOS.FIXAS       ? C.grupoFixas
            : grupo === GRUPOS.CONSUMO     ? C.grupoConsumo
            : grupo === GRUPOS.DIVIDAS     ? C.grupoDividas
            : C.grupoInvestimentos;

          const estaAberto = macroAberto === grupo;

          const catsNivel2 = clienteAtivo.categorias
            .filter(c => c.grupo === grupo && c.isCategoria === true)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

          const subcatsSemPaiLocal = clienteAtivo.categorias
            .filter(c => c.grupo === grupo && !c.isCategoria && !c.categoria && !c.oculto)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

          const totalSubcats = clienteAtivo.categorias.filter(c => c.grupo === grupo && !c.isCategoria && !c.oculto).length;

          return (
            <Card key={grupo} padding="0" style={{ overflow: 'hidden' }}>
              {/* ── Header Macro — clicável para expandir/recolher ── */}
              <div
                onClick={() => toggleMacro(grupo)}
                style={{
                  padding: '14px 20px',
                  background: estaAberto ? corGrupo + '22' : corGrupo + '12',
                  borderBottom: estaAberto ? `1px solid ${corGrupo}30` : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer', userSelect: 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = corGrupo + '28'}
                onMouseLeave={e => e.currentTarget.style.background = estaAberto ? corGrupo + '22' : corGrupo + '12'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Chevron */}
                  <span style={{
                    fontSize: 11, color: corGrupo,
                    transform: estaAberto ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    display: 'inline-block',
                    width: 12, flexShrink: 0,
                  }}>▶</span>
                  <span style={{ fontWeight: 700, color: corGrupo, fontSize: FONT.sm, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{grupo}</span>
                  <span style={{ fontSize: FONT.xs, color: corGrupo, opacity: 0.6 }}>{catsNivel2.length} categorias · {totalSubcats} subcategorias</span>
                </div>
                {/* Botão "+ Nova Categoria" — stopPropagation para não abrir/fechar o macro */}
                {!modoLeitura && (
                  <button
                    onClick={e => { e.stopPropagation(); setModalNovaCategoria({ grupo, tipo: tipoGrupo, nome: '' }); }}
                    style={{ background: 'transparent', border: `1px solid ${corGrupo}60`, borderRadius: RADIUS.sm, padding: '4px 12px', color: corGrupo, fontSize: FONT.xs, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}
                  >+ Nova Categoria</button>
                )}
              </div>

              {/* ── Corpo do macro (visível apenas quando aberto) ── */}
              {estaAberto && (
                <>
                  {catsNivel2.length === 0 && subcatsSemPaiLocal.length === 0 ? (
                    <div style={{ padding: '16px 20px', color: C.textDim, fontSize: FONT.xs, fontStyle: 'italic' }}>Nenhuma categoria neste grupo.</div>
                  ) : (
                    <div>
                      {catsNivel2.map((cat2, idxCat2) => {
                        const subcats = clienteAtivo.categorias
                          .filter(c => c.categoria === cat2.id && !c.isCategoria && !c.oculto)
                          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
                        const isEditandoCat2 = editandoNome2 === cat2.id;
                        const cat2Expandida = cat2Aberta === cat2.id;
                        const isUltimaCategoria = idxCat2 === catsNivel2.length - 1 && subcatsSemPaiLocal.length === 0;

                        return (
                          <div key={cat2.id} style={{ borderBottom: isUltimaCategoria && !cat2Expandida ? 'none' : `1px solid ${C.border}20` }}>
                            {/* ── Linha da categoria nível 2 — clicável ── */}
                            <div
                              onClick={() => !isEditandoCat2 && toggleCat2(cat2.id)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 20px',
                                background: cat2Expandida ? corGrupo + '10' : corGrupo + '06',
                                cursor: 'pointer', userSelect: 'none',
                                transition: 'background 0.12s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = corGrupo + '14'}
                              onMouseLeave={e => e.currentTarget.style.background = cat2Expandida ? corGrupo + '10' : corGrupo + '06'}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                {/* Chevron nível 2 */}
                                <span style={{
                                  fontSize: 9, color: corGrupo, opacity: 0.7,
                                  transform: cat2Expandida ? 'rotate(90deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.2s',
                                  display: 'inline-block', width: 10, flexShrink: 0,
                                }}>▶</span>
                                {isEditandoCat2 ? (
                                  <input autoFocus defaultValue={cat2.nome}
                                    onClick={e => e.stopPropagation()}
                                    onBlur={e => renomearCategoriaNivel2(cat2.id, e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') renomearCategoriaNivel2(cat2.id, e.target.value);
                                      if (e.key === 'Escape') setEditandoNome2(null);
                                    }}
                                    style={{ background: C.bg, border: `1px solid ${C.brand}`, borderRadius: RADIUS.sm, padding: '3px 8px', color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none', width: 220, fontWeight: 600 }}
                                  />
                                ) : (
                                  <span
                                    style={{ fontSize: FONT.sm, fontWeight: 600, color: C.text, cursor: modoLeitura ? 'default' : 'pointer' }}
                                    onDoubleClick={e => { e.stopPropagation(); !modoLeitura && setEditandoNome2(cat2.id); }}
                                    title={modoLeitura ? '' : 'Clique para ver subcategorias · Duplo clique para renomear'}>
                                    {cat2.nome}
                                  </span>
                                )}
                                <span style={{ fontSize: FONT.xs, color: C.textDim }}>{subcats.length} subcategor{subcats.length === 1 ? 'ia' : 'ias'}</span>
                              </div>
                              {!modoLeitura && (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={() => setModalNovaSubcat({ categoriaId: cat2.id, grupo, tipo: tipoGrupo, nome: '' })}
                                    style={{ background: 'transparent', border: `1px solid ${C.brand}40`, borderRadius: RADIUS.sm, padding: '3px 10px', color: C.brand, fontSize: FONT.xs, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}
                                  >+ Subcategoria</button>
                                  <MiniBtn onClick={() => setEditandoNome2(cat2.id)} title="Renomear">✏️</MiniBtn>
                                  <MiniBtn danger onClick={() => setConfirmDeleteCat2({ id: cat2.id, nome: cat2.nome, qtdFilhas: subcats.length })} title="Excluir categoria e subcategorias">🗑️</MiniBtn>
                                </div>
                              )}
                            </div>

                            {/* ── Subcategorias (visíveis apenas quando cat2 expandida) ── */}
                            {cat2Expandida && (
                              <>
                                {subcats.map((sub, idxSub) => {
                                  const qtdTrans = transacoes.filter(t => t.categoria === sub.id).length;
                                  const isEditandoSub = editandoCatNome === sub.id;
                                  return (
                                    <div key={sub.id}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px 9px 52px', borderBottom: idxSub < subcats.length - 1 ? `1px solid ${C.border}12` : 'none', transition: 'background 0.12s' }}
                                      onMouseEnter={e => e.currentTarget.style.background = C.brand + '06'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                        <span style={{ color: C.textDim, fontSize: 10 }}>└</span>
                                        {isEditandoSub ? (
                                          <input autoFocus defaultValue={sub.nome}
                                            onBlur={e => renomearCategoria(sub.id, e.target.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') renomearCategoria(sub.id, e.target.value);
                                              if (e.key === 'Escape') setEditandoCatNome(null);
                                            }}
                                            style={{ background: C.bg, border: `1px solid ${C.brand}`, borderRadius: RADIUS.sm, padding: '3px 8px', color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none', width: 200 }}
                                          />
                                        ) : (
                                          <span
                                            style={{ fontSize: FONT.sm, color: C.text, cursor: modoLeitura ? 'default' : 'text' }}
                                            onDoubleClick={() => !modoLeitura && setEditandoCatNome(sub.id)}
                                            title={modoLeitura ? '' : 'Clique duplo para renomear'}>
                                            {sub.nome}
                                          </span>
                                        )}
                                        {qtdTrans > 0 && (
                                          <span style={{ fontSize: FONT.xs, color: C.textDim, background: C.bg, borderRadius: RADIUS.full, padding: '1px 7px', border: `1px solid ${C.border}` }}>
                                            {qtdTrans} lanç.
                                          </span>
                                        )}
                                      </div>
                                      {!modoLeitura && (
                                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                          <MiniBtn onClick={() => { setModalMoverSubcat(sub); setMoverDestino(''); }} title="Mover para outra categoria">↗️</MiniBtn>
                                          <MiniBtn onClick={() => setEditandoCatNome(sub.id)} title="Renomear">✏️</MiniBtn>
                                          <MiniBtn danger onClick={() => setConfirmDeleteCat({ id: sub.id, nome: sub.nome, qtdTrans })} title="Excluir">🗑️</MiniBtn>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {subcats.length === 0 && (
                                  <div style={{ padding: '8px 52px', color: C.textDim, fontSize: FONT.xs, fontStyle: 'italic' }}>Nenhuma subcategoria. Clique em "+ Subcategoria" para adicionar.</div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}

                      {/* Subcategorias sem categoria nível 2 (órfãs) */}
                      {subcatsSemPaiLocal.length > 0 && (
                        <div style={{ borderTop: catsNivel2.length > 0 ? `1px solid ${C.border}20` : 'none' }}>
                          <div style={{ padding: '8px 20px', background: C.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: FONT.xs, color: C.textDim, fontStyle: 'italic' }}>Sem categoria definida</span>
                          </div>
                          {subcatsSemPaiLocal.map((sub, idxSub) => {
                            const qtdTrans = transacoes.filter(t => t.categoria === sub.id).length;
                            const isEditandoSub = editandoCatNome === sub.id;
                            return (
                              <div key={sub.id}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px 9px 36px', borderBottom: idxSub < subcatsSemPaiLocal.length - 1 ? `1px solid ${C.border}12` : 'none', transition: 'background 0.12s' }}
                                onMouseEnter={e => e.currentTarget.style.background = C.brand + '06'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                                  {isEditandoSub ? (
                                    <input autoFocus defaultValue={sub.nome}
                                      onBlur={e => renomearCategoria(sub.id, e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') renomearCategoria(sub.id, e.target.value);
                                        if (e.key === 'Escape') setEditandoCatNome(null);
                                      }}
                                      style={{ background: C.bg, border: `1px solid ${C.brand}`, borderRadius: RADIUS.sm, padding: '3px 8px', color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none', width: 200 }}
                                    />
                                  ) : (
                                    <span
                                      style={{ fontSize: FONT.sm, color: C.text, cursor: modoLeitura ? 'default' : 'text' }}
                                      onDoubleClick={() => !modoLeitura && setEditandoCatNome(sub.id)}>
                                      {sub.nome}
                                    </span>
                                  )}
                                  {qtdTrans > 0 && (
                                    <span style={{ fontSize: FONT.xs, color: C.textDim, background: C.bg, borderRadius: RADIUS.full, padding: '1px 7px', border: `1px solid ${C.border}` }}>
                                      {qtdTrans} lanç.
                                    </span>
                                  )}
                                </div>
                                {!modoLeitura && (
                                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                    <MiniBtn onClick={() => { setModalMoverSubcat(sub); setMoverDestino(''); }} title="Mover para uma categoria">↗️</MiniBtn>
                                    <MiniBtn onClick={() => setEditandoCatNome(sub.id)} title="Renomear">✏️</MiniBtn>
                                    <MiniBtn danger onClick={() => setConfirmDeleteCat({ id: sub.id, nome: sub.nome, qtdTrans })} title="Excluir">🗑️</MiniBtn>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── Modal: Nova Categoria nível 2 ── */}
      {modalNovaCategoria && (
        <ModalFormNome
          titulo="Nova Categoria"
          descricao={<>Será um agrupador dentro de <strong>{modalNovaCategoria.grupo}</strong>. Depois você adiciona subcategorias.</>}
          onConfirmar={nome => criarCategoriaNivel2(nome, modalNovaCategoria.grupo, modalNovaCategoria.tipo)}
          onCancelar={() => setModalNovaCategoria(null)}
        />
      )}

      {/* ── Modal: Nova Subcategoria ── */}
      {modalNovaSubcat && (() => {
        const cat2 = clienteAtivo.categorias.find(c => c.id === modalNovaSubcat.categoriaId);
        return (
          <ModalFormNome
            titulo="Nova Subcategoria"
            descricao={<>Dentro de <strong>{cat2?.nome ?? '—'}</strong> ({modalNovaSubcat.grupo}). Aqui é onde as transações serão lançadas.</>}
            onConfirmar={nome => criarSubcategoria(nome, modalNovaSubcat.categoriaId, modalNovaSubcat.grupo, modalNovaSubcat.tipo)}
            onCancelar={() => setModalNovaSubcat(null)}
          />
        );
      })()}

      {/* ── Modal: Mover Subcategoria ── */}
      {modalMoverSubcat && (() => {
        const opcoesDestino = clienteAtivo.categorias
          .filter(c => c.isCategoria === true && c.id !== modalMoverSubcat.categoria)
          .sort((a, b) => a.grupo.localeCompare(b.grupo) || a.nome.localeCompare(b.nome, 'pt'))
          .map(c => ({ value: c.id, label: `${c.grupo} › ${c.nome}` }));
        return (
          <Modal open title="Mover Subcategoria" onClose={() => { setModalMoverSubcat(null); setMoverDestino(''); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: FONT.sm, color: C.text }}>
                Mover <strong style={{ color: C.brand }}>{modalMoverSubcat.nome}</strong> para:
              </div>
              <Select
                label="Categoria destino"
                value={moverDestino}
                onChange={v => setMoverDestino(v)}
                options={opcoesDestino}
                placeholder="Selecione a categoria destino..."
              />
              {moverDestino && (() => {
                const dest = clienteAtivo.categorias.find(c => c.id === moverDestino);
                return dest ? (
                  <div style={{ fontSize: FONT.xs, color: C.textMuted, background: C.brand + '0C', padding: '8px 12px', borderRadius: RADIUS.sm, border: `1px solid ${C.brand}22` }}>
                    A subcategoria passará a ser lançada em <strong>{dest.grupo}</strong> → <strong>{dest.nome}</strong>. As transações existentes serão atualizadas.
                  </div>
                ) : null;
              })()}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <Btn variant="ghost" onClick={() => { setModalMoverSubcat(null); setMoverDestino(''); }}>Cancelar</Btn>
              <Btn onClick={() => moverSubcategoria(modalMoverSubcat.id, moverDestino)} disabled={!moverDestino}>Mover</Btn>
            </div>
          </Modal>
        );
      })()}

      {/* ── Modal: Confirmar exclusão de subcategoria ── */}
      {confirmDeleteCat && (
        <Modal open title="Excluir Subcategoria" onClose={() => setConfirmDeleteCat(null)}>
          <div style={{ fontSize: FONT.sm, color: C.text, lineHeight: 1.6 }}>
            <p>Excluir <strong style={{ color: C.desp }}>{confirmDeleteCat.nome}</strong>?</p>
            {confirmDeleteCat.qtdTrans > 0 && (
              <p style={{ color: C.yellow, marginTop: 12, background: C.bg, padding: '10px 14px', borderRadius: RADIUS.md, border: `1px solid ${C.yellow}40` }}>
                ⚠️ <strong>{confirmDeleteCat.qtdTrans} transa{confirmDeleteCat.qtdTrans === 1 ? 'ção' : 'ções'}</strong> vinculada{confirmDeleteCat.qtdTrans > 1 ? 's' : ''} serão movidas para <em>sem categoria</em>.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <Btn variant="ghost" onClick={() => setConfirmDeleteCat(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => deletarCategoria(confirmDeleteCat.id)}>Excluir</Btn>
          </div>
        </Modal>
      )}

      {/* ── Modal: Confirmar exclusão de categoria nível 2 ── */}
      {confirmDeleteCat2 && (
        <Modal open title="Excluir Categoria" onClose={() => setConfirmDeleteCat2(null)}>
          <div style={{ fontSize: FONT.sm, color: C.text, lineHeight: 1.6 }}>
            <p>Excluir a categoria <strong style={{ color: C.desp }}>{confirmDeleteCat2.nome}</strong>?</p>
            {confirmDeleteCat2.qtdFilhas > 0 && (
              <p style={{ color: C.yellow, marginTop: 12, background: C.bg, padding: '10px 14px', borderRadius: RADIUS.md, border: `1px solid ${C.yellow}40` }}>
                ⚠️ Esta categoria tem <strong>{confirmDeleteCat2.qtdFilhas} subcategor{confirmDeleteCat2.qtdFilhas === 1 ? 'ia' : 'ias'}</strong>. Todas as subcategorias e suas transações vinculadas serão <strong>removidas</strong>.
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
            <Btn variant="ghost" onClick={() => setConfirmDeleteCat2(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => deletarCategoriaNivel2(confirmDeleteCat2.id)}>Excluir</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
