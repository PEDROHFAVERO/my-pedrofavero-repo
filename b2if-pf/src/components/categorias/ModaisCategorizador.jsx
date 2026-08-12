import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn, Modal, Input, Select, Spinner } from '../UI.jsx';
import { GRUPOS } from '../../data/categorias.js';
import { gerarId } from '../../utils/clienteStorage.js';
import { EditarTransacaoModal } from './EditarTransacaoModal.jsx';
import { ModalRevisaoPDF } from './ModalRevisaoPDF.jsx';
import { ModalMoverConta } from './ModalMoverConta.jsx';
import { ModalNovaCatRapida } from './ModalNovaCatRapida.jsx';
import { ExportModal } from './ExportModal.jsx';

export function ModaisCategorizador({ ctx }) {
  const {
    // Dados
    transacoes, contas, bancos, categorias, _categorias, regras,
    clienteAtivo, setClienteAtivo,
    modoLeitura,
    nucleoFamiliar,
    // Modal estado
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
    carregando,
    erroImport, setErroImport,
    // useCategorias
    catIntermediarias, catPorCategoria,
    gruposOpts,
    salvarCategoria, criarCategoriaComSubcat, criarSubcategoria,
    // pdfHook
    pdfHook,
    // Ações
    salvarEdicao, salvarRegra, confirmarImport, processarPDFsComGemini,
    // Export
    exportarCSV, exportarXLSX, exportarPDF,
    mesesCompetenciaDisponiveis,
    // Refs para inputs de arquivo
    fileRef, fileRefXLSX,
  } = ctx;

  return (
    <>
      {/* ── MODAL: Editar Transação ────────────────────────────────────────── */}
      {modalEditar && (
        <EditarTransacaoModal
          t={modalEditar}
          todasCategorias={_categorias}
          onSave={salvarEdicao}
          onClose={() => setModalEditar(null)}
        />
      )}

      {/* ── MODAL: Categoria ──────────────────────────────────────────────── */}
      {modalCategoria && (
        <Modal open title={modalCategoria.id ? 'Editar Categoria' : 'Nova Categoria'} onClose={() => setModalCategoria(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Nome" value={modalCategoria.nome} onChange={v => setModalCategoria(p => ({ ...p, nome: v }))} />
            <Select label="Grupo macro" value={modalCategoria.grupo} onChange={v => setModalCategoria(p => ({ ...p, grupo: v }))} options={gruposOpts} />
            <Select label="Tipo" value={modalCategoria.tipo} onChange={v => setModalCategoria(p => ({ ...p, tipo: v }))}
              options={[{ value: 'receita', label: 'Receita' }, { value: 'despesa', label: 'Despesa' }, { value: 'neutro', label: 'Neutro' }]} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setModalCategoria(null)}>Cancelar</Btn>
            <Btn onClick={() => salvarCategoria(modalCategoria)} disabled={!modalCategoria.nome.trim()}>Salvar</Btn>
          </div>
        </Modal>
      )}

      {/* ── MODAL: Regra ──────────────────────────────────────────────────── */}
      {modalRegra && (
        <Modal open title={modalRegra.id ? 'Editar Regra' : 'Nova Regra'} onClose={() => setModalRegra(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Palavra-chave (case-insensitive)" value={modalRegra.keyword} onChange={v => setModalRegra(p => ({ ...p, keyword: v }))} placeholder="Ex: ifood" />
            {/* Selector hierárquico: Grupo → Categoria Intermediária → Subcategoria */}
            {(() => {
              const subcatRegra = categorias.find(c => c.id === modalRegra.categoria);
              const intermRegra = subcatRegra?.categoria ? categorias.find(c => c.id === subcatRegra.categoria) : null;
              const grupoRegra  = subcatRegra?.grupo || '';
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600 }}>Categoria</label>
                  {/* Step 1: Macro Grupo */}
                  <select
                    value={grupoRegra}
                    onChange={e => {
                      setModalRegra(p => ({ ...p, categoria: null, _grupoRegraSel: e.target.value, _intermRegraSel: '' }));
                    }}
                    style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '7px 10px', color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none' }}
                  >
                    <option value="">— Macro Grupo —</option>
                    {Object.values(GRUPOS).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  {/* Step 2: Categoria Intermediária */}
                  {(() => {
                    const grupoEfetivo = grupoRegra || modalRegra._grupoRegraSel || '';
                    if (!grupoEfetivo) return null;
                    const interms = catIntermediarias[grupoEfetivo] || [];
                    const intermAtual = intermRegra?.id || modalRegra._intermRegraSel || '';
                    return (
                      <select
                        value={intermAtual}
                        onChange={e => {
                          setModalRegra(p => ({ ...p, categoria: null, _intermRegraSel: e.target.value }));
                        }}
                        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '7px 10px', color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none' }}
                      >
                        <option value="">— Categoria —</option>
                        {interms.map(interm => <option key={interm.id} value={interm.id}>{interm.nome}</option>)}
                      </select>
                    );
                  })()}
                  {/* Step 3: Subcategoria */}
                  {(() => {
                    const intermAtual = intermRegra?.id || modalRegra._intermRegraSel || '';
                    if (!intermAtual) return null;
                    const subs = catPorCategoria[intermAtual] || [];
                    return (
                      <select
                        value={modalRegra.categoria || ''}
                        onChange={e => setModalRegra(p => ({ ...p, categoria: e.target.value || null }))}
                        style={{ background: C.bg, border: `1px solid ${modalRegra.categoria ? C.brand : C.border}`, borderRadius: RADIUS.sm, padding: '7px 10px', color: modalRegra.categoria ? C.brand : C.textMuted, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", fontWeight: modalRegra.categoria ? 700 : 400, outline: 'none' }}
                      >
                        <option value="">— Subcategoria —</option>
                        {subs.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                      </select>
                    );
                  })()}
                  {/* Exibe seleção atual */}
                  {modalRegra.categoria && (() => {
                    const subcatRegra2 = categorias.find(c => c.id === modalRegra.categoria);
                    const intermRegra2 = subcatRegra2?.categoria ? categorias.find(c => c.id === subcatRegra2.categoria) : null;
                    const grupoRegra2  = subcatRegra2?.grupo || '';
                    return subcatRegra2 ? (
                      <div style={{ fontSize: FONT.xs, color: C.brand, fontWeight: 600 }}>
                        ✓ {grupoRegra2} › {intermRegra2?.nome || '—'} › {subcatRegra2.nome}
                      </div>
                    ) : null;
                  })()}
                </div>
              );
            })()}
            <Input label="Prioridade (1 = mais alta)" value={String(modalRegra.prioridade)} onChange={v => setModalRegra(p => ({ ...p, prioridade: parseInt(v) || 1 }))} type="number" />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setModalRegra(null)}>Cancelar</Btn>
            <Btn onClick={() => salvarRegra(modalRegra)} disabled={!modalRegra.keyword.trim() || !modalRegra.categoria}>Salvar</Btn>
          </div>
        </Modal>
      )}

      {/* ── MODAL: Conta ──────────────────────────────────────────────────── */}
      {modalConta && (
        <Modal open title={modalConta.id ? 'Editar Conta' : 'Nova Conta'} onClose={() => setModalConta(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Nome da conta" value={modalConta.nome} onChange={v => setModalConta(p => ({ ...p, nome: v }))} placeholder="Ex: BTG Corrente" />
            {/* Banco: select dos bancos cadastrados */}
            <div>
              <div style={{ fontSize: FONT.xs, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Banco</div>
              <select
                value={modalConta.bancoId || ''}
                onChange={e => setModalConta(p => ({ ...p, bancoId: e.target.value || null }))}
                style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '7px 10px', color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none' }}
              >
                <option value="">— Sem banco —</option>
                {bancos.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
              </select>
            </div>
            <Select label="Tipo" value={modalConta.tipo} onChange={v => setModalConta(p => ({ ...p, tipo: v }))}
              options={[{ value: 'corrente', label: 'Conta Corrente' }, { value: 'cartao', label: 'Cartão de Crédito' }, { value: 'poupanca', label: 'Poupança' }, { value: 'investimento', label: 'Investimento' }]} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setModalConta(null)}>Cancelar</Btn>
            <Btn onClick={() => {
              const novas = modalConta.id ? contas.map(c => c.id === modalConta.id ? modalConta : c) : [...contas, { ...modalConta, id: gerarId() }];
              setClienteAtivo({ ...clienteAtivo, contas: novas });
              setModalConta(null);
            }} disabled={!modalConta.nome.trim()}>Salvar</Btn>
          </div>
        </Modal>
      )}

      {/* ── MODAL: Banco ──────────────────────────────────────────────────── */}
      {modalBanco && (
        <Modal open title={modalBanco.id ? 'Editar Banco' : 'Novo Banco'} onClose={() => setModalBanco(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="Nome do banco" value={modalBanco.nome} onChange={v => setModalBanco(p => ({ ...p, nome: v }))} placeholder="Ex: BTG, Itaú, Nubank…" />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setModalBanco(null)}>Cancelar</Btn>
            <Btn onClick={() => {
              const novosBancos = modalBanco.id
                ? bancos.map(b => b.id === modalBanco.id ? { ...b, nome: modalBanco.nome.trim() } : b)
                : [...bancos, { id: 'banco_' + gerarId(), nome: modalBanco.nome.trim() }];
              setClienteAtivo({ ...clienteAtivo, bancos: novosBancos });
              setModalBanco(null);
            }} disabled={!modalBanco.nome.trim()}>Salvar</Btn>
          </div>
        </Modal>
      )}

      {/* ── MODAL: Mover Conta entre Bancos ───────────────────────────────── */}
      {modalMoverConta && (
        <ModalMoverConta
          conta={modalMoverConta.conta}
          bancos={bancos}
          onMover={(destBancoId) => {
            const novasContas = contas.map(c =>
              c.id === modalMoverConta.conta.id ? { ...c, bancoId: destBancoId } : c
            );
            setClienteAtivo({ ...clienteAtivo, contas: novasContas });
            setModalMoverConta(null);
          }}
          onClose={() => setModalMoverConta(null)}
        />
      )}

      {/* ── MODAL: Revisão de importação PDF ─────────────────────────────── */}
      {modalRevisao && (
        <ModalRevisaoPDF
          dados={modalRevisao}
          categorias={categorias}
          regras={regras}
          onConfirmar={(ts) => confirmarImport(ts, modalRevisao.nomeConta, modalRevisao.portadorId ?? '')}
          onCancelar={() => setModalRevisao(null)}
          setClienteAtivo={setClienteAtivo}
          clienteAtivo={clienteAtivo}
          modoLeitura={modoLeitura}
        />
      )}

      {/* ── Modal: Exportar ───────────────────────────────────────────────── */}
      {showModalExport && (
        <ExportModal
          transacoes={transacoes}
          contas={contas}
          mesesDisponiveis={mesesCompetenciaDisponiveis}
          onCSV={exportarCSV}
          onXLSX={exportarXLSX}
          onPDF={exportarPDF}
          onClose={() => setShowModalExport(false)}
        />
      )}

      {/* ── Modal: Nova Categoria Rápida ─────────────────────────────────── */}
      {modalNovaCatRapida && (
        <ModalNovaCatRapida
          grupos={Object.values(GRUPOS)}
          catIntermediarias={catIntermediarias}
          onCriarCategoriaComSubcat={(nomeCategoria, nomeSubcat, grupo, tipo) => {
            criarCategoriaComSubcat(nomeCategoria, nomeSubcat, grupo, tipo);
            setModalNovaCatRapida(false);
          }}
          onCriarSubcat={(nomeSubcat, catPaiId, grupo, tipo) => {
            criarSubcategoria(nomeSubcat, catPaiId, grupo, tipo);
            setModalNovaCatRapida(false);
          }}
          onClose={() => setModalNovaCatRapida(false)}
        />
      )}

      {/* ── Modal: Escolha tipo de importação ─────────────────────────────── */}
      {modalTipoImport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.xl, padding: '32px 36px', minWidth: 380, maxWidth: 480 }}>
            <div style={{ fontSize: FONT.lg, fontWeight: 800, color: C.text, marginBottom: 6 }}>Importar lançamentos</div>
            <div style={{ fontSize: FONT.sm, color: C.textMuted, marginBottom: 24 }}>Como deseja importar os dados deste cliente?</div>

            {/* Opção 1: Planilha Padrão */}
            <button
              onClick={() => {
                setModalTipoImport(false);
                // Se há núcleo familiar, pede portador antes de abrir o seletor de arquivo
                if (nucleoFamiliar.length > 0) {
                  setModalPortadorPlanilha({ portadorId: nucleoFamiliar[0].id });
                } else {
                  fileRefXLSX.current?.click();
                }
              }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%',
                background: C.bg, border: `2px solid ${C.border}`, borderRadius: RADIUS.md,
                padding: '16px 18px', cursor: 'pointer', marginBottom: 12, textAlign: 'left',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.brand}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
            >
              <span style={{ fontSize: 28, lineHeight: 1 }}>📊</span>
              <div>
                <div style={{ fontWeight: 700, color: C.text, fontSize: FONT.base, marginBottom: 4 }}>Planilha Padrão</div>
                <div style={{ fontSize: FONT.sm, color: C.textMuted }}>Importar arquivo <strong>.xlsx</strong> ou <strong>.csv</strong> no formato B2IF — sem IA</div>
              </div>
            </button>

            {/* Opção 2: PDF Inteligente */}
            <button
              onClick={() => { setModalTipoImport(false); fileRef.current?.click(); }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%',
                background: C.bg, border: `2px solid ${C.brand}30`, borderRadius: RADIUS.md,
                padding: '16px 18px', cursor: 'pointer', marginBottom: 24, textAlign: 'left',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.brand}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.brand + '30'}
            >
              <span style={{ fontSize: 28, lineHeight: 1 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 700, color: C.brand, fontSize: FONT.base, marginBottom: 4 }}>PDF Inteligente (Gemini IA)</div>
                <div style={{ fontSize: FONT.sm, color: C.textMuted }}>Envie <strong>extratos ou faturas em PDF</strong> — a IA extrai automaticamente todos os lançamentos</div>
              </div>
            </button>

            <Btn variant="ghost" onClick={() => setModalTipoImport(false)} style={{ width: '100%', justifyContent: 'center' }}>Cancelar</Btn>
          </div>
        </div>
      )}

      {/* ── Modal: Portador para Planilha (só aparece se há núcleo familiar) ── */}
      {modalPortadorPlanilha && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.xl, padding: '28px 32px', minWidth: 380, maxWidth: 440 }}>
            <div style={{ fontSize: FONT.lg, fontWeight: 800, color: C.text, marginBottom: 4 }}>De quem é este extrato?</div>
            <div style={{ fontSize: FONT.sm, color: C.textMuted, marginBottom: 20 }}>
              Selecione o cliente para que as transações sejam atribuídas corretamente.
            </div>

            {/* Seleção de portador via cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {nucleoFamiliar.map(p => {
                const sel = modalPortadorPlanilha.portadorId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setModalPortadorPlanilha(prev => ({ ...prev, portadorId: p.id }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: RADIUS.md, cursor: 'pointer',
                      border: `2px solid ${sel ? C.brand : C.border}`,
                      background: sel ? `${C.brand}14` : C.bg,
                      fontFamily: "'Inter',sans-serif", textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: sel ? C.brand : C.border,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: FONT.base, fontWeight: 800,
                      color: sel ? '#fff' : C.textMuted, flexShrink: 0,
                    }}>
                      {p.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: sel ? C.brand : C.text, fontSize: FONT.sm }}>{p.nome}</div>
                      {p.telefone && <div style={{ fontSize: FONT.xs, color: C.textMuted }}>{p.telefone}</div>}
                    </div>
                    {sel && <div style={{ marginLeft: 'auto', color: C.brand, fontSize: FONT.base }}>✓</div>}
                  </button>
                );
              })}
              {/* Opção sem portador */}
              <button
                onClick={() => setModalPortadorPlanilha(prev => ({ ...prev, portadorId: '' }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: RADIUS.md, cursor: 'pointer',
                  border: `2px solid ${modalPortadorPlanilha.portadorId === '' ? C.brand : C.border}`,
                  background: modalPortadorPlanilha.portadorId === '' ? `${C.brand}14` : C.bg,
                  fontFamily: "'Inter',sans-serif", textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: modalPortadorPlanilha.portadorId === '' ? C.brand : C.border,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: FONT.sm, color: modalPortadorPlanilha.portadorId === '' ? '#fff' : C.textMuted, flexShrink: 0,
                }}>—</div>
                <div style={{ fontWeight: 600, color: modalPortadorPlanilha.portadorId === '' ? C.brand : C.textMuted, fontSize: FONT.sm }}>
                  Sem portador
                </div>
                {modalPortadorPlanilha.portadorId === '' && <div style={{ marginLeft: 'auto', color: C.brand, fontSize: FONT.base }}>✓</div>}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setModalPortadorPlanilha(null)}>Cancelar</Btn>
              <Btn onClick={() => {
                // Guarda portadorId para usar no confirmarImport depois
                // Passa via data attribute na ref do fileInput
                if (fileRefXLSX.current) {
                  fileRefXLSX.current._portadorId = modalPortadorPlanilha.portadorId;
                }
                setModalPortadorPlanilha(null);
                fileRefXLSX.current?.click();
              }}>
                Continuar →
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Seleção de portador + conta para PDF ────────────────────── */}
      {modalContaPDF && (() => {
        // Contas filtradas pelo portador selecionado
        const portadorId = modalContaPDF.portadorId ?? '';
        const contasFiltradas = portadorId
          ? contas.filter(c => c.nucleoId === portadorId)
          : contas;
        const temContas = contasFiltradas.length > 0 && !modalContaPDF.criandoConta;

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.xl, padding: '28px 32px', minWidth: 420, maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ fontSize: FONT.lg, fontWeight: 800, color: C.text, marginBottom: 4 }}>Importar PDF</div>
              <div style={{ fontSize: FONT.sm, color: C.textMuted, marginBottom: 20 }}>
                {modalContaPDF.arquivos.length} arquivo{modalContaPDF.arquivos.length > 1 ? 's' : ''} selecionado{modalContaPDF.arquivos.length > 1 ? 's' : ''}
              </div>

              {/* ── TIPO DE DOCUMENTO ── */}
              <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em' }}>TIPO DE DOCUMENTO</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  { id: 'extrato', label: '🏦 Extrato bancário', desc: 'Conta corrente, poupança, débitos em conta' },
                  { id: 'fatura',  label: '💳 Fatura de cartão', desc: 'Cartão de crédito (Nubank, Itaú, Bradesco…)' },
                ].map(({ id, label, desc }) => {
                  const sel = (modalContaPDF.tipoPDF ?? 'extrato') === id;
                  return (
                    <button key={id} onClick={() => setModalContaPDF(p => ({ ...p, tipoPDF: id }))}
                      style={{
                        textAlign: 'left', padding: '12px 14px',
                        border: `2px solid ${sel ? C.brand : C.border}`,
                        borderRadius: RADIUS.md, background: sel ? `${C.brand}14` : C.bg,
                        cursor: 'pointer', fontFamily: "'Inter',sans-serif",
                        transition: 'border-color 0.15s, background 0.15s',
                      }}>
                      <div style={{ fontSize: FONT.sm, fontWeight: 700, color: sel ? C.brand : C.text, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: FONT.xs, color: C.textMuted, lineHeight: 1.4 }}>{desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* ── PORTADOR (só se há núcleo familiar) ── */}
              {nucleoFamiliar.length > 0 && (
                <>
                  <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em' }}>DE QUEM É ESTE DOCUMENTO?</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {nucleoFamiliar.map(p => {
                      const sel = portadorId === p.id;
                      return (
                        <button key={p.id}
                          onClick={() => {
                            // Ao trocar portador, reset contaSel para primeira conta do novo portador
                            const novasContas = contas.filter(c => c.nucleoId === p.id);
                            setModalContaPDF(prev => ({
                              ...prev,
                              portadorId: p.id,
                              contaSel: novasContas.length > 0 ? novasContas[0].nome : '',
                              criandoConta: novasContas.length === 0,
                            }));
                          }}
                          style={{
                            padding: '7px 14px', borderRadius: RADIUS.full, cursor: 'pointer',
                            border: `2px solid ${sel ? C.brand : C.border}`,
                            background: sel ? `${C.brand}14` : C.bg,
                            color: sel ? C.brand : C.text,
                            fontWeight: sel ? 700 : 500, fontSize: FONT.sm,
                            fontFamily: "'Inter',sans-serif", transition: 'all 0.15s',
                          }}>
                          {p.nome}
                        </button>
                      );
                    })}
                    {/* Sem portador */}
                    <button
                      onClick={() => setModalContaPDF(prev => ({
                        ...prev, portadorId: '',
                        contaSel: contas.length > 0 ? contas[0].nome : '',
                        criandoConta: contas.length === 0,
                      }))}
                      style={{
                        padding: '7px 14px', borderRadius: RADIUS.full, cursor: 'pointer',
                        border: `2px solid ${portadorId === '' ? C.brand : C.border}`,
                        background: portadorId === '' ? `${C.brand}14` : C.bg,
                        color: portadorId === '' ? C.brand : C.textMuted,
                        fontWeight: portadorId === '' ? 700 : 500, fontSize: FONT.sm,
                        fontFamily: "'Inter',sans-serif", transition: 'all 0.15s',
                      }}>
                      Sem portador
                    </button>
                  </div>
                </>
              )}

              {/* ── CONTA (filtrada pelo portador selecionado) ── */}
              {temContas && (
                <>
                  <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em' }}>
                    CONTA {portadorId && nucleoFamiliar.find(p => p.id === portadorId) ? `DE ${nucleoFamiliar.find(p => p.id === portadorId).nome.toUpperCase()}` : ''}
                  </div>
                  <select
                    value={modalContaPDF.contaSel}
                    onChange={e => setModalContaPDF(p => ({ ...p, contaSel: e.target.value }))}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: RADIUS.md,
                      border: `1px solid ${modalContaPDF.contaSel ? C.brand : C.border}`,
                      background: C.bg, color: C.text,
                      fontSize: FONT.sm, fontFamily: "'Inter',sans-serif",
                      cursor: 'pointer', boxSizing: 'border-box', marginBottom: 10, outline: 'none',
                    }}
                  >
                    <option value="">— Selecione uma conta —</option>
                    {contasFiltradas.map(c => (
                      <option key={c.id} value={c.nome}>{c.nome}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setModalContaPDF(p => ({ ...p, criandoConta: true, contaSel: '' }))}
                    style={{ background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: RADIUS.md, padding: '8px 14px', color: C.textMuted, fontSize: FONT.sm, cursor: 'pointer', fontFamily: "'Inter',sans-serif", width: '100%', marginBottom: 16 }}
                  >+ Criar nova conta</button>
                </>
              )}

              {/* ── NOVA CONTA ── */}
              {(modalContaPDF.criandoConta || contasFiltradas.length === 0) && (
                <>
                  <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em' }}>NOVA CONTA</div>
                  <input
                    value={modalContaPDF.novaConta ?? ''}
                    onChange={e => setModalContaPDF(p => ({ ...p, novaConta: e.target.value }))}
                    placeholder="Ex: Nubank Cartão, Bradesco Corrente..."
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter' && modalContaPDF.novaConta?.trim()) {
                        const nomeConta = modalContaPDF.novaConta.trim();
                        const tipoPDF = modalContaPDF.tipoPDF ?? 'extrato';
                        const pid = modalContaPDF.portadorId ?? '';
                        setModalContaPDF(null);
                        processarPDFsComGemini(modalContaPDF.arquivos, nomeConta, tipoPDF, pid);
                      }
                    }}
                    style={{
                      width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                      borderRadius: RADIUS.md, padding: '10px 12px', color: C.text,
                      fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", outline: 'none',
                      boxSizing: 'border-box', marginBottom: 10,
                    }}
                  />
                  {contasFiltradas.length > 0 && (
                    <button
                      onClick={() => setModalContaPDF(p => ({ ...p, criandoConta: false, contaSel: contasFiltradas[0].nome }))}
                      style={{ background: 'transparent', border: 'none', color: C.brand, fontSize: FONT.sm, cursor: 'pointer', fontFamily: "'Inter',sans-serif", marginBottom: 16, padding: 0 }}
                    >← Usar conta existente</button>
                  )}
                  {contasFiltradas.length === 0 && <div style={{ marginBottom: 16 }} />}
                </>
              )}

              {/* Arquivos */}
              <div style={{ background: C.bg, borderRadius: RADIUS.md, padding: '10px 14px', marginBottom: 20 }}>
                <div style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 6, fontWeight: 600 }}>ARQUIVOS</div>
                {modalContaPDF.arquivos.map((f, i) => (
                  <div key={i} style={{ fontSize: FONT.xs, color: C.text, padding: '2px 0' }}>📄 {f.name}</div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Btn variant="ghost" onClick={() => setModalContaPDF(null)}>Cancelar</Btn>
                <Btn
                  disabled={modalContaPDF.criandoConta ? !modalContaPDF.novaConta?.trim() : !modalContaPDF.contaSel}
                  onClick={() => {
                    const nomeConta = modalContaPDF.criandoConta
                      ? modalContaPDF.novaConta.trim()
                      : modalContaPDF.contaSel;
                    const tipoPDF = modalContaPDF.tipoPDF ?? 'extrato';
                    const pid = modalContaPDF.portadorId ?? '';
                    if (!nomeConta) return;
                    setModalContaPDF(null);
                    processarPDFsComGemini(modalContaPDF.arquivos, nomeConta, tipoPDF, pid);
                  }}
                >
                  Processar →
                </Btn>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Overlay de carregamento ─────────────────────────────────────────── */}
      {(carregando || pdfHook.carregando) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3000,
          background: 'rgba(10,14,25,0.92)',
          backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <div style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.xl,
            padding: '36px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
            minWidth: 340, maxWidth: 440, boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
          }}>
            <Spinner />
            <div style={{ color: C.text, fontSize: FONT.base, fontWeight: 600, textAlign: 'center' }}>
              {pdfHook.carregando ? pdfHook.loadingMsg : 'Processando planilha…'}
            </div>
            {pdfHook.carregando && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: C.bg, borderRadius: RADIUS.md, padding: '6px 14px',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.brand, animation: 'pulse 1.2s infinite' }} />
                <div style={{ color: C.textMuted, fontSize: FONT.sm }}>
                  {pdfHook.loadingElapsed < 10
                    ? 'Iniciando…'
                    : pdfHook.loadingElapsed < 30
                    ? `Enviando PDF ao Gemini… (${pdfHook.loadingElapsed}s)`
                    : pdfHook.loadingElapsed < 90
                    ? `Gemini lendo o documento… (${pdfHook.loadingElapsed}s)`
                    : `Quase pronto, aguarde… (${pdfHook.loadingElapsed}s)`
                  }
                </div>
              </div>
            )}
            {pdfHook.carregando && (
              <div style={{ color: C.textMuted, fontSize: FONT.xs, textAlign: 'center', lineHeight: 1.5 }}>
                PDFs longos podem levar até 2 minutos.
              </div>
            )}
            {pdfHook.carregando && (
              <button
                onClick={() => pdfHook.cancelar()}
                style={{
                  marginTop: 4, background: 'transparent', border: `1px solid ${C.border}`,
                  borderRadius: RADIUS.md, padding: '7px 20px', color: C.textMuted,
                  fontSize: FONT.sm, fontFamily: "'Inter',sans-serif", cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Aviso de importação parcial (não-bloqueante) ───────────────────── */}
      {pdfHook.aviso && !erroImport && !pdfHook.erro && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 3050, maxWidth: 560, width: 'calc(100% - 32px)',
          background: '#1a1200', border: '1px solid #f59e0b88',
          borderRadius: RADIUS.xl, padding: '16px 20px',
          boxShadow: '0 6px 32px rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.4 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: FONT.sm, marginBottom: 4 }}>
              Importação parcial — verifique os lançamentos
            </div>
            <div style={{ color: '#e5c97a', fontSize: FONT.xs, lineHeight: 1.6 }}>
              {pdfHook.aviso}
            </div>
          </div>
          <button
            onClick={pdfHook.limparAviso}
            style={{
              background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer',
              fontSize: 18, lineHeight: 1, padding: '2px 4px', flexShrink: 0,
            }}
            title="Fechar aviso"
          >×</button>
        </div>
      )}

      {/* ── Erro de importação ─────────────────────────────────────────────── */}
      {(erroImport || pdfHook.erro) && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 3100,
          background: 'rgba(10,14,25,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: C.card, border: `1px solid ${C.desp}44`,
            borderRadius: RADIUS.xl, padding: '32px 36px',
            minWidth: 340, maxWidth: 500, boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 10, textAlign: 'center' }}>⚠️</div>
            <div style={{ color: C.desp, fontWeight: 700, fontSize: FONT.lg, marginBottom: 12, textAlign: 'center' }}>Falha na importação</div>
            <div style={{
              color: C.text, fontSize: FONT.sm, marginBottom: 20,
              whiteSpace: 'pre-wrap', background: C.bg, borderRadius: RADIUS.md,
              padding: '12px 14px', maxHeight: 240, overflowY: 'auto', lineHeight: 1.6,
            }}>{erroImport || pdfHook.erro}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Btn onClick={() => { setErroImport(null); pdfHook.limparErro(); }}>Fechar</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
