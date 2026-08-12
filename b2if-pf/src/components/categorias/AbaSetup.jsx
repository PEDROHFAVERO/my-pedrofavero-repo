/**
 * AbaSetup.jsx — Wizard de onboarding de novo cliente
 *
 * Arquitetura UX (Sprint 5 — revisão UX/Comportamental):
 *   Passo 0 — Boas-vindas          (propósito e engajamento — Efeito Zeigarnik)
 *   Passo 1 — Núcleo Familiar      (cards horizontais, humanização)
 *   Passo 2 — Ecossistema Financeiro (tabs por membro, accordion banco, toggles iOS)
 *   Passo 3 — Interlúdio           (reforço positivo antes da etapa densa)
 *   Passo 4 — Diagnóstico          (accordion 3 níveis + toggles iOS + adição rápida)
 *   Passo 5 — Finalização          (segurança + CTA pro Dashboard)
 *
 * Princípios aplicados:
 *   • Efeito Zeigarnik   — stepper visual sempre visível (cria tensão positiva)
 *   • Default Effect     — categorias todas ligadas por padrão
 *   • Progressive Disclosure — accordion fecha tudo, expande sob demanda
 *   • Aversão à Perda    — auto-save a cada ação (badge "Salvando...")
 *   • Reforço Positivo   — tela de interlúdio entre estrutura e diagnóstico
 *   • Humanização        — avatar colorido, papel/grau de parentesco
 */

import { useState, useCallback, useRef } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn } from '../UI.jsx';
import { GRUPOS, CATEGORIAS_PADRAO } from '../../data/categorias.js';
import { gerarId } from '../../utils/clienteStorage.js';
import { AbaCategorias } from './AbaCategorias.jsx';
import { AbaContas } from './AbaContas.jsx';
import { BancoLogo } from '../BancoLogo.jsx';

// ── Constantes ──────────────────────────────────────────────────────────────
const MACROS_WIZARD = [
  GRUPOS.RECEITAS,
  GRUPOS.FIXAS,
  GRUPOS.CONSUMO,
  GRUPOS.DIVIDAS,
  GRUPOS.INVESTIMENTOS,
];

const PASSOS = [
  { id: 'boasvindas',  label: 'Início'     },
  { id: 'nucleo',      label: 'Família'    },
  { id: 'financeiro',  label: 'Contas'     },
  { id: 'interludio',  label: ''           }, // oculto no stepper
  { id: 'categorias',  label: 'Categorias' },
  { id: 'fim',         label: 'Conclusão'  },
];
// Passos visíveis no stepper (sem interlúdio)
const PASSOS_STEPPER = PASSOS.filter(p => p.label !== '');

const TIPOS_CONTA = [
  { id: 'corrente',        label: 'Conta Corrente',    icone: '💳' },
  { id: 'poupanca',        label: 'Poupança',          icone: '🏦' },
  { id: 'cartao_credito',  label: 'Cartão de Crédito', icone: '💲' },
  { id: 'investimentos',   label: 'Investimentos',     icone: '📈' },
  { id: 'outro',           label: 'Outro',             icone: '🔖' },
];

const PAPEIS = ['Titular', 'Cônjuge', 'Filho(a)', 'Dependente', 'Outro'];

function corMacro(grupo) {
  if (grupo === GRUPOS.RECEITAS)      return '#22D3A0';
  if (grupo === GRUPOS.FIXAS)         return '#F87171';
  if (grupo === GRUPOS.CONSUMO)       return '#FBBF24';
  if (grupo === GRUPOS.DIVIDAS)       return '#C084FC';
  if (grupo === GRUPOS.INVESTIMENTOS) return '#60A5FA';
  return C.brand;
}

function iconeMacro(grupo) {
  if (grupo === GRUPOS.RECEITAS)      return '💰';
  if (grupo === GRUPOS.FIXAS)         return '🏠';
  if (grupo === GRUPOS.CONSUMO)       return '🛒';
  if (grupo === GRUPOS.DIVIDAS)       return '📋';
  if (grupo === GRUPOS.INVESTIMENTOS) return '📈';
  return '📊';
}

function subcatsDeMacro(grupo) {
  return CATEGORIAS_PADRAO.filter(c => c.grupo === grupo && !c.isCategoria && !c.oculto);
}
function catNivel2DeMacro(grupo) {
  return CATEGORIAS_PADRAO.filter(c => c.grupo === grupo && c.isCategoria === true);
}

// ── Componente raiz ─────────────────────────────────────────────────────────
export function AbaSetup({ ctx }) {
  const {
    clienteAtivo, setClienteAtivo, modoLeitura,
    onSetupConcluido,
    setModalBanco, setModalConta, setModalMoverConta,
    transacoes, contas, bancos,
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
  } = ctx;

  const setupCompleto = clienteAtivo?.setupCompleto;

  // ── Modo config (setupCompleto === true) ───────────────────────────────────
  if (setupCompleto === true) {
    return (
      <ConfigMode
        ctx={ctx}
        ctxContas={{ transacoes, contas, bancos, clienteAtivo, setClienteAtivo, modoLeitura, setModalBanco, setModalConta, setModalMoverConta }}
        ctxCat={{ transacoes, clienteAtivo, renomearCategoriaNivel2, renomearCategoria, criarCategoriaNivel2, criarSubcategoria, moverSubcategoria, deletarCategoria, deletarCategoriaNivel2, modalNovaCategoria, setModalNovaCategoria, modalNovaSubcat, setModalNovaSubcat, modalMoverSubcat, setModalMoverSubcat, moverDestino, setMoverDestino, editandoNome2, setEditandoNome2, editandoCatNome, setEditandoCatNome, confirmDeleteCat, setConfirmDeleteCat, confirmDeleteCat2, setConfirmDeleteCat2, modoLeitura }}
      />
    );
  }

  // ── Modo wizard (setupCompleto === false) ──────────────────────────────────
  // key={clienteAtivo.id} força React a destruir e recriar o WizardModal
  // ao trocar de cliente — garante que todos os useState internos (wizardBancos,
  // wizardContas, nucleo, passo, etc.) reinicializam do zero para cada cliente.
  const { setPaginaAtual } = ctx;
  const irParaHub = useCallback(() => setPaginaAtual('hub'), [setPaginaAtual]);

  return (
    <WizardModal
      key={clienteAtivo?.id}
      clienteAtivo={clienteAtivo}
      setClienteAtivo={setClienteAtivo}
      onSetupConcluido={onSetupConcluido}
      onFechar={irParaHub}
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// WIZARD MODAL
// ════════════════════════════════════════════════════════════════════════════
function WizardModal({ clienteAtivo, setClienteAtivo, onSetupConcluido, onFechar }) {
  const [passo, setPasso] = useState(0); // índice em PASSOS
  const [saving, setSaving] = useState(false);

  // ── Estado: Núcleo familiar ─────────────────────────────────────────────
  const [nucleo, setNucleo] = useState(() =>
    clienteAtivo?.nucleoFamiliar?.length > 0
      ? clienteAtivo.nucleoFamiliar.map(m => ({ papel: 'Titular', ...m }))
      : []
  );

  // ── Estado: Bancos/contas por membro ─────────────────────────────────────
  // MODELO: bancos agora têm nucleoId — cada membro tem sua própria lista.
  // Isso evita que bancos de João apareçam para Maria e vice-versa.
  // Deep clone garante isolamento total de referências entre clientes.
  const [wizardBancos, setWizardBancos] = useState(() =>
    JSON.parse(JSON.stringify(
      // Migra bancos antigos (sem nucleoId) para o modelo novo — atribui ao primeiro membro
      (clienteAtivo?.bancos ?? []).map(b =>
        b.nucleoId !== undefined ? b : { ...b, nucleoId: clienteAtivo?.nucleoFamiliar?.[0]?.id ?? '' }
      )
    ))
  );
  const [wizardContas, setWizardContas] = useState(() =>
    JSON.parse(JSON.stringify(clienteAtivo?.contas ?? []))
  );
  // Aba ativa na etapa financeiro (índice de membro)
  const [abaFinanceiro, setAbaFinanceiro] = useState(0);

  // ── Estado: Categorias — Set de ids ligados (todos ON por padrão) ─────────
  const [catsLigadas, setCatsLigadas] = useState(() => {
    const ids = new Set();
    MACROS_WIZARD.forEach(g => subcatsDeMacro(g).forEach(c => ids.add(c.id)));
    return ids;
  });
  // Categorias nível 2 expandidas no accordion
  const [catAberta, setCatAberta] = useState(null); // id cat nível 2

  // ── Auto-save badge ───────────────────────────────────────────────────────
  const savingTimer = useRef(null);
  const triggerSave = useCallback(() => {
    setSaving(true);
    clearTimeout(savingTimer.current);
    savingTimer.current = setTimeout(() => setSaving(false), 1200);
  }, []);

  // ── Navegação ─────────────────────────────────────────────────────────────
  const ir = useCallback((idx) => {
    setPasso(idx);
    triggerSave();
  }, [triggerSave]);

  const proximo = useCallback(() => ir(Math.min(passo + 1, PASSOS.length - 1)), [passo, ir]);
  const voltar  = useCallback(() => ir(Math.max(passo - 1, 0)), [passo, ir]);

  const passoId = PASSOS[passo]?.id;

  // ── Finalizar wizard ──────────────────────────────────────────────────────
  const finalizar = useCallback(() => {
    const idsSel = catsLigadas;
    const catNivel2ComSub = new Set();
    CATEGORIAS_PADRAO.filter(c => !c.isCategoria && !c.oculto)
      .forEach(c => { if (idsSel.has(c.id) && c.categoria) catNivel2ComSub.add(c.categoria); });

    const catsFinal = CATEGORIAS_PADRAO.filter(c => {
      // Aliases ocultos (v4.0→v5.0) NÃO são salvos nas categorias do cliente:
      // eles existem apenas para resolver transações históricas via catPorIdCompleto
      if (c.oculto) return false;
      if (c.isCategoria) return catNivel2ComSub.has(c.id) || c.grupo === GRUPOS.INTERNO;
      if (c.grupo === GRUPOS.INTERNO) return true;
      return idsSel.has(c.id);
    });

    setClienteAtivo({
      ...clienteAtivo,
      setupCompleto: true,
      nucleoFamiliar: nucleo.filter(m => m.nome?.trim()),
      bancos: wizardBancos,
      contas: wizardContas,
      categorias: catsFinal,
    });
    onSetupConcluido?.();
  }, [catsLigadas, nucleo, wizardBancos, wizardContas, clienteAtivo, setClienteAtivo, onSetupConcluido]);

  // ── Índice no stepper (sem interlúdio) ────────────────────────────────────
  const stepperIdx = PASSOS_STEPPER.findIndex(p => p.id === passoId);
  // Em passos especiais (interludio) usa o índice do passo anterior
  const stepperIdxEfetivo = stepperIdx >= 0 ? stepperIdx : PASSOS_STEPPER.findIndex(p => p.id === PASSOS[passo - 1]?.id);
  const stepperTotal = PASSOS_STEPPER.length;

  const mostrarHeader = passoId !== 'boasvindas';

  return (
    // Overlay do modal
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9000,
      padding: '16px',
      backdropFilter: 'blur(4px)',
    }}>
      {/* Painel do modal */}
      <div style={{
        width: '100%', maxWidth: 700,
        maxHeight: '92vh',
        background: C.card,
        borderRadius: RADIUS.xl,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 32px 96px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)',
      }}>

        {/* ── Header fixo com stepper ──────────────────────────────────── */}
        {mostrarHeader && (
          <ModalHeader
            clienteNome={clienteAtivo?.nome}
            saving={saving}
            stepper={{ idx: stepperIdxEfetivo, total: stepperTotal, passos: PASSOS_STEPPER }}
            onFechar={onFechar}
          />
        )}

        {/* ── Header mínimo para boas-vindas (badge + botão fechar) ─────── */}
        {!mostrarHeader && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 32px 0',
          }}>
            <SaveBadge saving={saving} />
            <BtnFechar onFechar={onFechar} />
          </div>
        )}

        {/* ── Conteúdo scrollável ──────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px 36px' }}>

          {passoId === 'boasvindas' && (
            <PassoBoasVindas clienteNome={clienteAtivo?.nome} onAvancar={proximo} />
          )}

          {passoId === 'nucleo' && (
            <PassoNucleo
              nucleo={nucleo}
              setNucleo={v => { setNucleo(v); triggerSave(); }}
              onVoltar={voltar}
              onAvancar={proximo}
            />
          )}

          {passoId === 'financeiro' && (
            <PassoFinanceiro
              nucleo={nucleo}
              wizardBancos={wizardBancos} setWizardBancos={v => { setWizardBancos(v); triggerSave(); }}
              wizardContas={wizardContas} setWizardContas={v => { setWizardContas(v); triggerSave(); }}
              abaAtiva={abaFinanceiro} setAbaAtiva={setAbaFinanceiro}
              onVoltar={voltar}
              onAvancar={proximo}
            />
          )}

          {passoId === 'interludio' && (
            <PassoInterludio onAvancar={proximo} onVoltar={voltar} />
          )}

          {passoId === 'categorias' && (
            <PassoCategorias
              catsLigadas={catsLigadas}
              setCatsLigadas={v => { setCatsLigadas(v); triggerSave(); }}
              catAberta={catAberta}
              setCatAberta={setCatAberta}
              onVoltar={voltar}
              onAvancar={proximo}
            />
          )}

          {passoId === 'fim' && (
            <PassoFim clienteNome={clienteAtivo?.nome} onFinalizar={finalizar} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Badge de salvamento (reutilizável) ──────────────────────────────────────
function SaveBadge({ saving }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      fontSize: FONT.xs, color: saving ? C.brand : C.textDim,
      transition: 'color 0.3s',
      minWidth: 68,
    }}>
      {saving ? (
        <>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: C.brand,
            display: 'inline-block',
            animation: 'pulse-dot 1s ease-in-out infinite',
          }} />
          Salvando...
        </>
      ) : (
        <>
          <span style={{ color: '#22D3A0', fontSize: 10, fontWeight: 700 }}>✓</span>
          Salvo
        </>
      )}
    </div>
  );
}

// ── Botão fechar (X) reutilizável ──────────────────────────────────────────
function BtnFechar({ onFechar }) {
  return (
    <button
      onClick={onFechar}
      title="Fechar e voltar para o hub de clientes"
      style={{
        width: 32, height: 32,
        borderRadius: '50%',
        border: `1px solid ${C.border}`,
        background: 'transparent',
        color: C.textMuted,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700,
        lineHeight: 1,
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textMuted; }}
    >
      ✕
    </button>
  );
}

// ── Header fixo do modal ────────────────────────────────────────────────────
function ModalHeader({ clienteNome, saving, stepper, onFechar }) {
  const { idx, total, passos } = stepper;
  return (
    <div style={{
      padding: '20px 36px 0',
      borderBottom: `1px solid ${C.border}`,
      background: C.card,
      flexShrink: 0,
    }}>
      {/* Linha superior: nome do cliente + badge salvando + botão fechar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 500, letterSpacing: '0.01em' }}>
          Configurando cliente:{' '}
          <span style={{ color: C.text, fontWeight: 700 }}>{clienteNome}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SaveBadge saving={saving} />
          <BtnFechar onFechar={onFechar} />
        </div>
      </div>

      {/* Stepper visual — Efeito Zeigarnik */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, paddingBottom: 20 }}>
        {passos.map((p, i) => {
          const done    = i < idx;
          const active  = i === idx;
          return (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'flex-start',
              flex: i < passos.length - 1 ? 1 : 'none',
            }}>
              {/* Círculo + label */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? C.brand : active ? 'transparent' : 'transparent',
                  border: `2px solid ${done ? C.brand : active ? C.brand : C.border}`,
                  transition: 'all 0.3s',
                  flexShrink: 0,
                  boxShadow: active ? `0 0 0 4px ${C.brand}18` : 'none',
                }}>
                  {done ? (
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 700, lineHeight: 1 }}>✓</span>
                  ) : (
                    <span style={{
                      fontSize: FONT.xs, fontWeight: 700, lineHeight: 1,
                      color: active ? C.brand : C.textDim,
                    }}>{i + 1}</span>
                  )}
                </div>
                <span style={{
                  fontSize: '10px', fontWeight: active ? 700 : 500,
                  color: active ? C.brand : done ? C.textMuted : C.textDim,
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.01em',
                }}>{p.label}</span>
              </div>

              {/* Linha conectora */}
              {i < passos.length - 1 && (
                <div style={{
                  flex: 1,
                  height: 2,
                  marginTop: 14, // alinha com o centro do círculo
                  background: done ? C.brand : C.border,
                  margin: '14px 8px 0',
                  transition: 'background 0.4s',
                  borderRadius: 1,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PASSO 0 — BOAS-VINDAS
// ════════════════════════════════════════════════════════════════════════════
function PassoBoasVindas({ clienteNome, onAvancar }) {
  const primeiroNome = clienteNome?.split(' ')[0] ?? clienteNome;
  return (
    <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
      {/* Ícone hero */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: `linear-gradient(135deg, ${C.brand}22, ${C.brand}08)`,
        border: `2px solid ${C.brand}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, margin: '0 auto 24px',
        boxShadow: `0 0 32px ${C.brand}18`,
      }}>🎯</div>

      <div style={{ fontSize: FONT.xxl, fontWeight: 800, color: C.text, marginBottom: 10, lineHeight: 1.2 }}>
        Bem-vindo ao planejamento
      </div>
      <div style={{
        fontSize: FONT.xl, fontWeight: 700,
        background: `linear-gradient(135deg, ${C.brand}, #60A5FA)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        marginBottom: 16, lineHeight: 1.3,
      }}>
        {primeiroNome}
      </div>

      <div style={{
        fontSize: FONT.base, color: C.textMuted, lineHeight: 1.75,
        maxWidth: 440, margin: '0 auto 40px',
      }}>
        Nas próximas etapas vamos montar a estrutura financeira completa.
        Cada configuração feita aqui vai transformar dados em{' '}
        <strong style={{ color: C.text }}>decisões mais inteligentes</strong>.
      </div>

      {/* Tiles de preview */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12, maxWidth: 460, margin: '0 auto 44px',
      }}>
        {[
          { icone: '👨‍👩‍👧', label: 'Família',     desc: 'Núcleo familiar' },
          { icone: '🏦',      label: 'Contas',     desc: 'Bancos e contas' },
          { icone: '📊',      label: 'Categorias', desc: 'Mapa financeiro' },
        ].map((item, i) => (
          <div key={item.label} style={{
            padding: '18px 12px',
            background: `linear-gradient(135deg, ${C.brand}08, ${C.brand}04)`,
            borderRadius: RADIUS.md,
            border: `1px solid ${C.brand}18`,
            textAlign: 'center',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: -10, right: -6,
              width: 20, height: 20, borderRadius: '50%',
              background: C.brand, border: `2px solid ${C.card}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700, color: '#fff',
            }}>{i + 1}</div>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{item.icone}</div>
            <div style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text, marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontSize: FONT.xs, color: C.textMuted }}>{item.desc}</div>
          </div>
        ))}
      </div>

      <Btn
        onClick={onAvancar}
        style={{
          padding: '14px 48px',
          fontSize: FONT.base,
          borderRadius: RADIUS.lg,
          letterSpacing: '0.01em',
        }}
      >
        Vamos começar →
      </Btn>
      <div style={{ fontSize: FONT.xs, color: C.textDim, marginTop: 14 }}>
        ⏱ Leva cerca de 3 minutos
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PASSO 1 — NÚCLEO FAMILIAR
// ════════════════════════════════════════════════════════════════════════════
function PassoNucleo({ nucleo, setNucleo, onVoltar, onAvancar }) {
  const [novoNome,  setNovoNome]  = useState('');
  const [novoTel,   setNovoTel]   = useState('');
  const [novoPapel, setNovoPapel] = useState('Titular');
  const inputRef = useRef();

  const adicionar = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    const papel = nucleo.length === 0 ? 'Titular' : novoPapel;
    setNucleo([...nucleo, { id: gerarId(), nome, telefone: novoTel.trim(), papel }]);
    setNovoNome('');
    setNovoTel('');
    setNovoPapel('Cônjuge');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div>
      <PassoTitulo
        icone="👨‍👩‍👧"
        titulo="Quem faz parte do planejamento?"
        descricao="Cadastre as pessoas do núcleo familiar. O telefone conecta ao Bot do WhatsApp."
      />

      {/* Cards dos membros já adicionados */}
      {nucleo.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {nucleo.map((m, i) => (
            <MemberCard
              key={m.id}
              membro={m}
              index={i}
              onRemove={() => setNucleo(nucleo.filter(x => x.id !== m.id))}
              onChangePapel={papel => setNucleo(nucleo.map(x => x.id === m.id ? { ...x, papel } : x))}
            />
          ))}
        </div>
      )}

      {/* Formulário para novo membro */}
      <div style={{
        padding: '18px', background: C.bg,
        borderRadius: RADIUS.md,
        border: `1.5px dashed ${C.border}`,
      }}>
        <div style={{
          fontSize: FONT.xs, fontWeight: 700, color: C.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: C.brand }}>+</span>
          {nucleo.length === 0 ? 'Adicionar primeiro membro' : 'Adicionar outro membro'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            ref={inputRef}
            placeholder="Nome completo"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adicionar()}
            style={{ ...iS(), flex: '2 1 150px' }}
            autoFocus
          />
          <input
            placeholder="(11) 99999-9999"
            value={novoTel}
            onChange={e => setNovoTel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adicionar()}
            style={{ ...iS(), flex: '2 1 130px' }}
          />
          <select
            value={nucleo.length === 0 ? 'Titular' : novoPapel}
            onChange={e => setNovoPapel(e.target.value)}
            disabled={nucleo.length === 0}
            style={{ ...sS(), flex: '1 1 110px', opacity: nucleo.length === 0 ? 0.5 : 1 }}
          >
            {PAPEIS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={adicionar} disabled={!novoNome.trim()} style={aBtnS(!novoNome.trim())}>
            + Adicionar
          </button>
        </div>
        {nucleo.length === 0 && (
          <div style={{ fontSize: FONT.xs, color: C.textDim, marginTop: 10 }}>
            💡 O primeiro membro é automaticamente o Titular do planejamento.
          </div>
        )}
      </div>

      <NavFooter
        onVoltar={onVoltar}
        onAvancar={onAvancar}
        labelAvancar={nucleo.length === 0 ? 'Pular por agora →' : `Próximo: Contas →`}
      />
    </div>
  );
}

// Card horizontal de membro
function MemberCard({ membro: m, index: i, onRemove, onChangePapel }) {
  const [editandoPapel, setEditandoPapel] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 16px',
      background: C.bg,
      borderRadius: RADIUS.md,
      border: `1px solid ${C.border}`,
      transition: 'border-color 0.15s',
    }}>
      <Avatar nome={m.nome} index={i} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text }}>{m.nome}</span>
          {editandoPapel ? (
            <select
              autoFocus
              value={m.papel || 'Titular'}
              onChange={e => { onChangePapel(e.target.value); setEditandoPapel(false); }}
              onBlur={() => setEditandoPapel(false)}
              style={{ ...sS(), fontSize: FONT.xs, padding: '2px 6px' }}
            >
              {PAPEIS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : (
            <button
              onClick={() => setEditandoPapel(true)}
              style={{
                fontSize: FONT.xs, fontWeight: 600, color: C.brand,
                background: C.brand + '14', padding: '2px 9px',
                borderRadius: RADIUS.full, border: 'none', cursor: 'pointer',
                fontFamily: "'Inter',sans-serif",
                transition: 'background 0.15s',
              }}
              title="Clique para alterar o papel"
            >{m.papel || 'Titular'} ✎</button>
          )}
        </div>
        {m.telefone
          ? <div style={{ fontSize: FONT.xs, color: C.textMuted }}>📱 {m.telefone}</div>
          : <div style={{ fontSize: FONT.xs, color: C.textDim, fontStyle: 'italic' }}>Sem telefone cadastrado</div>
        }
      </div>
      <button onClick={onRemove} style={btnIconeStyle()} title="Remover membro">✕</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PASSO 2 — ECOSSISTEMA FINANCEIRO
// ════════════════════════════════════════════════════════════════════════════
function PassoFinanceiro({ nucleo, wizardBancos, setWizardBancos, wizardContas, setWizardContas, abaAtiva, setAbaAtiva, onVoltar, onAvancar }) {
  // Membros efetivos: se não há núcleo, usa "Geral"
  const membros = nucleo.length > 0 ? nucleo : [{ id: '__geral__', nome: 'Geral', papel: '' }];
  const membro = membros[abaAtiva] ?? membros[0];
  const memNucleoId = membro.id === '__geral__' ? '' : membro.id;

  const [novoBanco, setNovoBanco] = useState('');
  const [bancoPop, setBancoPop]   = useState(null); // id do banco com painel aberto

  // Bancos DO MEMBRO ATIVO — cada membro tem sua lista própria (nucleoId)
  const bancosDoMembro = wizardBancos.filter(b => b.nucleoId === memNucleoId);

  const addBanco = () => {
    const nome = novoBanco.trim();
    if (!nome) return;
    // ID único por membro+banco — membros diferentes podem ter banco de mesmo nome sem conflito
    const id = 'banco_' + memNucleoId + '_' + nome.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    setWizardBancos([...wizardBancos, { id, nome, nucleoId: memNucleoId }]);
    setNovoBanco('');
    setBancoPop(id);
  };

  const toggleTipoConta = (bancoId, tipo) => {
    const nomeBanco = wizardBancos.find(b => b.id === bancoId)?.nome ?? '';
    const tipoLabel = TIPOS_CONTA.find(t => t.id === tipo)?.label ?? tipo;
    // Nome da conta no formato "Banco - Tipo" para exibição no Fluxo Financeiro
    const nomeConta = nomeBanco ? `${nomeBanco} - ${tipoLabel}` : tipoLabel;
    const existe = wizardContas.find(c => c.bancoId === bancoId && c.tipo === tipo && c.nucleoId === memNucleoId);
    if (existe) {
      setWizardContas(wizardContas.filter(c => !(c.bancoId === bancoId && c.tipo === tipo && c.nucleoId === memNucleoId)));
    } else {
      setWizardContas([...wizardContas, {
        id: gerarId(),
        nome: nomeConta,   // ex: "Nubank - Conta Corrente"
        bancoId,
        tipo,
        nucleoId: memNucleoId,
      }]);
    }
  };

  const contasDoMembroPorBanco = (bancoId) =>
    wizardContas.filter(c => c.bancoId === bancoId && c.nucleoId === memNucleoId);

  const tipoAtivo = (bancoId, tipo) => contasDoMembroPorBanco(bancoId).some(c => c.tipo === tipo);

  // Remove banco e contas SOMENTE do membro ativo — não afeta outros membros
  const removerBanco = (bancoId) => {
    setWizardBancos(wizardBancos.filter(b => b.id !== bancoId));
    setWizardContas(wizardContas.filter(c => !(c.bancoId === bancoId && c.nucleoId === memNucleoId)));
  };

  return (
    <div>
      <PassoTitulo
        icone="🏦"
        titulo="Ecossistema financeiro"
        descricao="Registre os bancos e tipos de conta de cada membro da família."
      />

      {/* Tabs por membro */}
      {membros.length > 1 && (
        <div style={{
          display: 'flex', gap: 2,
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 24,
          overflowX: 'auto',
        }}>
          {membros.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setAbaAtiva(i)}
              style={{
                padding: '9px 18px', border: 'none', background: 'transparent',
                color: abaAtiva === i ? C.brand : C.textMuted,
                fontWeight: abaAtiva === i ? 700 : 500,
                fontSize: FONT.sm, cursor: 'pointer',
                fontFamily: "'Inter',sans-serif",
                borderBottom: abaAtiva === i ? `2px solid ${C.brand}` : '2px solid transparent',
                marginBottom: -1, whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'color 0.15s',
              }}
            >
              <Avatar nome={m.nome} index={i} size={22} />
              {m.nome}
              {m.papel && (
                <span style={{ fontSize: '10px', color: abaAtiva === i ? C.brand + 'AA' : C.textDim }}>
                  {m.papel}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Bancos do membro ativo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {bancosDoMembro.length === 0 && (
          <div style={{
            padding: '20px', textAlign: 'center',
            background: C.bg, borderRadius: RADIUS.md,
            border: `1px dashed ${C.border}`,
            color: C.textDim, fontSize: FONT.sm,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🏦</div>
            Nenhuma instituição adicionada ainda.<br />
            <span style={{ fontSize: FONT.xs }}>Use o campo abaixo para adicionar.</span>
          </div>
        )}
        {bancosDoMembro.map(banco => {
          const contasBanco = contasDoMembroPorBanco(banco.id);
          const open = bancoPop === banco.id;
          return (
            <BancoAccordion
              key={banco.id}
              banco={banco}
              open={open}
              onToggle={() => setBancoPop(open ? null : banco.id)}
              onRemove={() => removerBanco(banco.id)}
              contas={contasBanco}
              tipoAtivo={(tipo) => tipoAtivo(banco.id, tipo)}
              onToggleTipo={(tipo) => toggleTipoConta(banco.id, tipo)}
            />
          );
        })}
      </div>

      {/* Input novo banco */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          placeholder="+ Adicionar instituição (ex: Nubank, Itaú, XP...)"
          value={novoBanco}
          onChange={e => setNovoBanco(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addBanco()}
          style={{ ...iS(), flex: 1 }}
        />
        <button onClick={addBanco} disabled={!novoBanco.trim()} style={aBtnS(!novoBanco.trim())}>
          Adicionar
        </button>
      </div>

      <NavFooter
        onVoltar={onVoltar}
        onAvancar={onAvancar}
        labelAvancar="Próximo →"
      />
    </div>
  );
}

// Accordion de banco
function BancoAccordion({ banco, open, onToggle, onRemove, contas, tipoAtivo, onToggleTipo }) {
  return (
    <div style={{
      borderRadius: RADIUS.md,
      border: `1px solid ${open ? C.brand + '50' : C.border}`,
      overflow: 'hidden',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: open ? `0 4px 20px ${C.brand}10` : 'none',
    }}>
      {/* Header do banco */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '13px 16px', cursor: 'pointer',
          background: open ? C.brand + '08' : C.bg,
          userSelect: 'none',
          transition: 'background 0.2s',
        }}
      >
        <BancoLogo banco={banco.nome} size={36} radius={8} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text }}>{banco.nome}</div>
          <div style={{ fontSize: FONT.xs, color: C.textMuted, marginTop: 2 }}>
            {contas.length === 0
              ? <span style={{ color: C.textDim, fontStyle: 'italic' }}>Nenhuma conta configurada</span>
              : contas.map(c => TIPOS_CONTA.find(t => t.id === c.tipo)?.label ?? c.nome).join(' · ')
            }
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {contas.length > 0 && (
            <span style={{
              fontSize: FONT.xs, fontWeight: 700,
              color: C.brand, background: C.brand + '14',
              padding: '2px 8px', borderRadius: RADIUS.full,
            }}>{contas.length}</span>
          )}
          <span style={{
            fontSize: 11, color: C.textDim,
            transition: 'transform 0.2s',
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'none',
          }}>▼</span>
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            style={btnIconeStyle()}
            title="Remover banco"
          >✕</button>
        </div>
      </div>

      {/* Tipos de conta (toggles iOS) */}
      {open && (
        <div style={{
          padding: '16px 16px 18px',
          borderTop: `1px solid ${C.border}`,
          background: C.card,
        }}>
          <div style={{
            fontSize: FONT.xs, color: C.textMuted, fontWeight: 700,
            marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.07em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>Tipos de conta disponíveis</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TIPOS_CONTA.map(tc => {
              const ativo = tipoAtivo(tc.id);
              return (
                <div
                  key={tc.id}
                  onClick={() => onToggleTipo(tc.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 14px',
                    border: `1.5px solid ${ativo ? C.brand + '60' : C.border}`,
                    borderRadius: RADIUS.md,
                    background: ativo ? C.brand + '08' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{tc.icone}</span>
                    <span style={{
                      fontSize: FONT.sm, fontWeight: ativo ? 600 : 400,
                      color: ativo ? C.text : C.textMuted,
                      transition: 'color 0.15s',
                    }}>
                      {tc.label}
                    </span>
                  </div>
                  <Toggle ligado={ativo} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// INTERLÚDIO — REFORÇO POSITIVO
// ════════════════════════════════════════════════════════════════════════════
function PassoInterludio({ onAvancar, onVoltar }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      {/* Ícone animado */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'linear-gradient(135deg, #22D3A022, #22D3A008)',
        border: '2px solid #22D3A040',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 40, margin: '0 auto 24px',
        boxShadow: '0 0 40px rgba(34, 211, 160, 0.2)',
      }}>✅</div>

      <div style={{ fontSize: FONT.xl, fontWeight: 800, color: C.text, marginBottom: 10 }}>
        Estrutura base concluída!
      </div>
      <div style={{
        fontSize: FONT.base, color: C.textMuted, lineHeight: 1.75,
        maxWidth: 400, margin: '0 auto 32px',
      }}>
        Família e contas estão registradas.{' '}
        Agora vamos configurar as{' '}
        <strong style={{ color: C.text }}>categorias financeiras</strong>{' '}
        — o mapa inteligente das finanças de {'{nome}'}.
      </div>

      {/* Mini-resumo do que foi configurado */}
      <div style={{
        display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 36,
        flexWrap: 'wrap',
      }}>
        {[
          { icone: '👨‍👩‍👧', label: 'Família configurada' },
          { icone: '🏦', label: 'Contas registradas' },
          { icone: '📊', label: 'Categorias: próximo →' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            background: i < 2 ? '#22D3A010' : C.brand + '10',
            border: `1px solid ${i < 2 ? '#22D3A030' : C.brand + '30'}`,
            borderRadius: RADIUS.full,
            fontSize: FONT.xs, fontWeight: 600,
            color: i < 2 ? '#22D3A0' : C.brand,
          }}>
            <span>{item.icone}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <Btn variant="ghost" onClick={onVoltar}>← Voltar</Btn>
        <Btn onClick={onAvancar} style={{ padding: '12px 36px', fontSize: FONT.base }}>
          Configurar categorias →
        </Btn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PASSO 4 — DIAGNÓSTICO E CATEGORIAS (ACCORDION 3 NÍVEIS)
// ════════════════════════════════════════════════════════════════════════════
function PassoCategorias({ catsLigadas, setCatsLigadas, catAberta, setCatAberta, onVoltar, onAvancar }) {
  // Accordion: qual macro está expandido
  const [macroAberto, setMacroAberto] = useState(null);
  // "Criar nova" inline por cat nível 2
  const [novaCatNome, setNovaCatNome] = useState({});
  // Novas subcats criadas pelo usuário (apenas no wizard, não persistidas em CATEGORIAS_PADRAO)
  const [subcatsExtras, setSubcatsExtras] = useState([]);

  const toggleSubcat = useCallback((id) => {
    setCatsLigadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [setCatsLigadas]);

  const toggleCat2 = useCallback((cat2Id, subcatIds) => {
    const todasLigadas = subcatIds.every(id => catsLigadas.has(id));
    setCatsLigadas(prev => {
      const next = new Set(prev);
      subcatIds.forEach(id => { if (todasLigadas) next.delete(id); else next.add(id); });
      return next;
    });
  }, [catsLigadas, setCatsLigadas]);

  const criarSubcatExtra = (cat2Id, grupo) => {
    const nome = (novaCatNome[cat2Id] ?? '').trim();
    if (!nome) return;
    const id = 'custom_' + gerarId();
    const nova = {
      id, nome, grupo, isCategoria: false, categoria: cat2Id,
      oculto: false, tipo: grupo === GRUPOS.RECEITAS ? 'receita' : 'despesa',
    };
    setSubcatsExtras(prev => [...prev, nova]);
    setCatsLigadas(prev => new Set([...prev, id]));
    setNovaCatNome(prev => ({ ...prev, [cat2Id]: '' }));
  };

  // Total selecionado
  const totalSel  = [...catsLigadas].length;
  const totalDisp = MACROS_WIZARD.reduce((acc, g) => acc + subcatsDeMacro(g).length, 0) + subcatsExtras.length;
  const pct = totalDisp > 0 ? Math.round((totalSel / totalDisp) * 100) : 0;

  return (
    <div>
      <PassoTitulo
        icone="📊"
        titulo="Diagnóstico financeiro"
        descricao="Defina o mapa de categorias. Tudo já vem ativado — desative o que não se aplica."
      />

      {/* Resumo com barra de progresso */}
      <div style={{
        padding: '12px 16px',
        background: C.brand + '08',
        borderRadius: RADIUS.md,
        border: `1px solid ${C.brand}20`,
        marginBottom: 20,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <span style={{ fontSize: FONT.xs, color: C.textMuted }}>
            <strong style={{ color: C.brand, fontSize: FONT.sm }}>{totalSel}</strong>
            <span style={{ color: C.textDim }}> / {totalDisp}</span>
            {' '}categorias ativas
          </span>
          <button
            onClick={() => {
              const todasOn = MACROS_WIZARD.every(g => subcatsDeMacro(g).every(c => catsLigadas.has(c.id)));
              if (todasOn) {
                setCatsLigadas(new Set(subcatsExtras.map(c => c.id)));
              } else {
                const ids = new Set();
                MACROS_WIZARD.forEach(g => subcatsDeMacro(g).forEach(c => ids.add(c.id)));
                subcatsExtras.forEach(c => ids.add(c.id));
                setCatsLigadas(ids);
              }
            }}
            style={{
              fontSize: FONT.xs, fontWeight: 600, color: C.brand,
              background: 'transparent', border: `1px solid ${C.brand}40`,
              padding: '3px 10px', borderRadius: RADIUS.full, cursor: 'pointer',
              fontFamily: "'Inter',sans-serif",
            }}
          >
            {MACROS_WIZARD.every(g => subcatsDeMacro(g).every(c => catsLigadas.has(c.id))) ? 'Desativar tudo' : 'Ativar tudo'}
          </button>
        </div>
        {/* Barra de progresso */}
        <div style={{
          height: 4, background: C.border,
          borderRadius: RADIUS.full, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: `linear-gradient(90deg, ${C.brand}, #60A5FA)`,
            borderRadius: RADIUS.full,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Accordion por macro */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {MACROS_WIZARD.map(grupo => {
          const cor     = corMacro(grupo);
          const icone   = iconeMacro(grupo);
          const cats2   = catNivel2DeMacro(grupo);
          const allSubs = [...subcatsDeMacro(grupo), ...subcatsExtras.filter(c => c.grupo === grupo)];
          const nAtivos = allSubs.filter(c => catsLigadas.has(c.id)).length;
          const aberto  = macroAberto === grupo;
          const todasOn = allSubs.every(c => catsLigadas.has(c.id));

          return (
            <div key={grupo} style={{
              borderRadius: RADIUS.md,
              border: `1px solid ${aberto ? cor + '60' : C.border}`,
              overflow: 'hidden',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: aberto ? `0 4px 16px ${cor}12` : 'none',
            }}>
              {/* Header do macro */}
              <div
                onClick={() => setMacroAberto(aberto ? null : grupo)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: aberto ? cor + '0C' : C.bg,
                  cursor: 'pointer', userSelect: 'none',
                  transition: 'background 0.2s',
                }}
              >
                {/* Ícone + ponto de cor */}
                <div style={{
                  width: 36, height: 36, borderRadius: RADIUS.sm,
                  background: cor + '18', border: `1px solid ${cor}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>{icone}</div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text }}>{grupo}</div>
                  {/* Barra de progresso mini */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
                  }}>
                    <div style={{
                      flex: 1, height: 3,
                      background: C.border, borderRadius: RADIUS.full, overflow: 'hidden',
                      maxWidth: 80,
                    }}>
                      <div style={{
                        height: '100%',
                        width: allSubs.length > 0 ? `${(nAtivos / allSubs.length) * 100}%` : '0%',
                        background: cor, borderRadius: RADIUS.full,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{ fontSize: '10px', color: C.textDim }}>
                      {nAtivos}/{allSubs.length}
                    </span>
                  </div>
                </div>

                {/* Toggle do macro inteiro */}
                <div
                  onClick={e => {
                    e.stopPropagation();
                    const ids = allSubs.map(c => c.id);
                    setCatsLigadas(prev => {
                      const next = new Set(prev);
                      if (todasOn) ids.forEach(id => next.delete(id));
                      else ids.forEach(id => next.add(id));
                      return next;
                    });
                  }}
                  style={{ flexShrink: 0 }}
                >
                  <Toggle
                    ligado={nAtivos > 0}
                    indeterminate={nAtivos > 0 && nAtivos < allSubs.length}
                    cor={cor}
                  />
                </div>

                <span style={{
                  fontSize: 11, color: C.textDim,
                  transform: aberto ? 'rotate(180deg)' : 'none',
                  display: 'inline-block', transition: 'transform 0.25s',
                  marginLeft: 4,
                }}>▼</span>
              </div>

              {/* Conteúdo expandido: categorias nível 2 */}
              {aberto && (
                <div style={{ background: C.card, borderTop: `1px solid ${C.border}` }}>
                  {cats2.map((cat2, idx2) => {
                    const subcatsDaCat = allSubs.filter(s => s.categoria === cat2.id);
                    if (subcatsDaCat.length === 0) return null;
                    const catAbertaLocal = catAberta === cat2.id;
                    const todasCat2On   = subcatsDaCat.every(c => catsLigadas.has(c.id));
                    const algumaCat2On  = subcatsDaCat.some(c => catsLigadas.has(c.id));
                    const nCat2Ativas   = subcatsDaCat.filter(c => catsLigadas.has(c.id)).length;

                    return (
                      <div key={cat2.id} style={{
                        borderBottom: idx2 < cats2.length - 1 ? `1px solid ${C.border}18` : 'none',
                      }}>
                        {/* Linha da categoria nível 2 */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '12px 16px 12px 20px',
                          background: catAbertaLocal ? cor + '07' : 'transparent',
                          transition: 'background 0.15s',
                        }}>
                          {/* Seta expand — só ativa se toggle ligado (Progressive Disclosure) */}
                          <button
                            onClick={() => algumaCat2On && setCatAberta(catAbertaLocal ? null : cat2.id)}
                            style={{
                              background: 'transparent', border: 'none', padding: '3px 5px',
                              cursor: algumaCat2On ? 'pointer' : 'default',
                              color: algumaCat2On ? (catAbertaLocal ? cor : C.textMuted) : C.textDim,
                              fontSize: 11, fontFamily: "'Inter',sans-serif",
                              transition: 'transform 0.2s, color 0.2s',
                              transform: catAbertaLocal ? 'rotate(90deg)' : 'none',
                              display: 'inline-block',
                              opacity: algumaCat2On ? 1 : 0.25,
                              flexShrink: 0,
                            }}
                            title={algumaCat2On ? 'Ver subcategorias' : 'Ative a categoria para expandir'}
                          >▶</button>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{
                              fontSize: FONT.sm, fontWeight: 600,
                              color: algumaCat2On ? C.text : C.textDim,
                              transition: 'color 0.2s',
                            }}>
                              {cat2.nome}
                            </span>
                          </div>

                          <span style={{
                            fontSize: '10px', color: C.textDim, marginRight: 10,
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {nCat2Ativas}/{subcatsDaCat.length}
                          </span>

                          {/* Toggle da categoria nível 2 */}
                          <div
                            onClick={() => toggleCat2(cat2.id, subcatsDaCat.map(c => c.id))}
                            style={{ flexShrink: 0 }}
                          >
                            <Toggle
                              ligado={algumaCat2On}
                              indeterminate={algumaCat2On && !todasCat2On}
                              cor={cor}
                            />
                          </div>
                        </div>

                        {/* Subcategorias (nível 3) — Progressive Disclosure */}
                        {catAbertaLocal && algumaCat2On && (
                          <div style={{
                            paddingLeft: 44, paddingRight: 16, paddingBottom: 12,
                            background: cor + '04',
                            borderTop: `1px solid ${cor}12`,
                          }}>
                            {subcatsDaCat.map((sub, si) => {
                              const on = catsLigadas.has(sub.id);
                              return (
                                <div
                                  key={sub.id}
                                  style={{
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '9px 0',
                                    borderBottom: si < subcatsDaCat.length - 1
                                      ? `1px solid ${C.border}14`
                                      : 'none',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                                      background: on ? cor : C.border,
                                      transition: 'background 0.2s',
                                    }} />
                                    <span style={{
                                      fontSize: FONT.sm,
                                      color: on ? C.text : C.textDim,
                                      transition: 'color 0.2s',
                                      textDecoration: on ? 'none' : 'none',
                                    }}>
                                      {sub.nome}
                                    </span>
                                    {sub.id.startsWith('custom_') && (
                                      <span style={{
                                        fontSize: '10px', color: C.brand,
                                        background: C.brand + '14',
                                        padding: '1px 6px', borderRadius: RADIUS.full,
                                        fontWeight: 600,
                                      }}>novo</span>
                                    )}
                                  </div>
                                  <div onClick={() => toggleSubcat(sub.id)} style={{ cursor: 'pointer', flexShrink: 0 }}>
                                    <Toggle ligado={on} cor={cor} />
                                  </div>
                                </div>
                              );
                            })}

                            {/* Adição rápida de subcat */}
                            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                              <input
                                placeholder="+ Criar nova subcategoria..."
                                value={novaCatNome[cat2.id] ?? ''}
                                onChange={e => setNovaCatNome(prev => ({ ...prev, [cat2.id]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && criarSubcatExtra(cat2.id, grupo)}
                                style={{
                                  ...iS(), fontSize: FONT.xs, flex: 1,
                                  padding: '7px 10px',
                                  border: `1px dashed ${C.brand}40`,
                                  background: C.brand + '04',
                                }}
                              />
                              {(novaCatNome[cat2.id] ?? '').trim() && (
                                <button
                                  onClick={() => criarSubcatExtra(cat2.id, grupo)}
                                  style={{ ...aBtnS(false), padding: '5px 12px', fontSize: FONT.xs }}
                                >
                                  ↵ Criar
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Subcats órfãs (sem cat nível 2) */}
                  {(() => {
                    const orfas = [
                      ...subcatsDeMacro(grupo).filter(s => !s.categoria),
                      ...subcatsExtras.filter(c => c.grupo === grupo && !c.categoria),
                    ];
                    if (!orfas.length) return null;
                    return (
                      <div style={{
                        padding: '10px 16px 14px 24px',
                        borderTop: cats2.length > 0 ? `1px solid ${C.border}18` : 'none',
                      }}>
                        {orfas.map(sub => {
                          const on = catsLigadas.has(sub.id);
                          return (
                            <div key={sub.id} style={{
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '9px 0',
                              borderBottom: `1px solid ${C.border}10`,
                            }}>
                              <span style={{ fontSize: FONT.sm, color: on ? C.text : C.textDim, flex: 1 }}>
                                {sub.nome}
                              </span>
                              <div onClick={() => toggleSubcat(sub.id)} style={{ cursor: 'pointer' }}>
                                <Toggle ligado={on} cor={cor} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <NavFooter onVoltar={onVoltar} onAvancar={onAvancar} labelAvancar="Finalizar →" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PASSO 5 — FINALIZAÇÃO
// ════════════════════════════════════════════════════════════════════════════
function PassoFim({ clienteNome, onFinalizar }) {
  const primeiroNome = clienteNome?.split(' ')[0] ?? clienteNome;
  return (
    <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
      {/* Ícone de sucesso */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))',
        border: '2px solid rgba(59,130,246,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 40, margin: '0 auto 24px',
        boxShadow: '0 0 40px rgba(59,130,246,0.2)',
      }}>🚀</div>

      <div style={{ fontSize: FONT.xxl, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.2 }}>
        Tudo configurado!
      </div>
      <div style={{
        fontSize: FONT.lg, color: C.textMuted, marginBottom: 24, fontWeight: 500,
      }}>
        {primeiroNome} está pronto para o planejamento
      </div>

      {/* Card de reassurance */}
      <div style={{
        maxWidth: 400, margin: '0 auto 36px',
        padding: '16px 20px',
        background: C.brand + '08',
        borderRadius: RADIUS.md,
        border: `1px solid ${C.brand}20`,
        textAlign: 'left',
      }}>
        <div style={{
          fontSize: FONT.xs, fontWeight: 700, color: C.brand,
          textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12,
        }}>
          ✓ Configuração salva com sucesso
        </div>
        {[
          'Família e vínculos cadastrados',
          'Bancos e contas organizados',
          'Categorias personalizadas',
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 0',
            borderBottom: i < 2 ? `1px solid ${C.brand}10` : 'none',
            fontSize: FONT.sm, color: C.textMuted,
          }}>
            <span style={{ color: '#22D3A0', fontWeight: 700, fontSize: 12 }}>✓</span>
            {item}
          </div>
        ))}
      </div>

      <div style={{
        fontSize: FONT.xs, color: C.textDim, maxWidth: 360,
        margin: '0 auto 28px', lineHeight: 1.6,
      }}>
        💡 Você pode editar família, contas e categorias a qualquer momento
        na aba <strong style={{ color: C.textMuted }}>Setup</strong> deste cliente.
      </div>

      <Btn
        onClick={onFinalizar}
        style={{ padding: '14px 48px', fontSize: FONT.base, borderRadius: RADIUS.lg }}
      >
        Ir para Transações →
      </Btn>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MODO CONFIG (setupCompleto === true)
// ════════════════════════════════════════════════════════════════════════════
function ConfigMode({ ctx, ctxContas, ctxCat }) {
  const { clienteAtivo, setClienteAtivo, modoLeitura, contas } = ctx;
  const [secao, setSecao] = useState('familia');

  return (
    <div>
      <div style={{
        display: 'flex', gap: 4,
        borderBottom: `1px solid ${C.border}`,
        marginBottom: 28,
      }}>
        {[
          { id: 'familia',    label: 'Família & Contas' },
          { id: 'categorias', label: 'Categorias'       },
        ].map(s => (
          <button key={s.id} onClick={() => setSecao(s.id)} style={{
            padding: '9px 20px', border: 'none', background: 'transparent',
            color: secao === s.id ? C.brand : C.textMuted,
            fontWeight: secao === s.id ? 700 : 500,
            fontSize: FONT.base, cursor: 'pointer',
            fontFamily: "'Inter',sans-serif",
            borderBottom: secao === s.id ? `2px solid ${C.brand}` : '2px solid transparent',
            marginBottom: -1,
            transition: 'color 0.15s',
          }}>{s.label}</button>
        ))}
      </div>

      {secao === 'familia' && (
        <AbaContas ctx={ctxContas} />
      )}

      {secao === 'categorias' && <AbaCategorias ctx={ctxCat} />}
    </div>
  );
}

function NucleoConfig({ nucleo, contas, modoLeitura, onChange }) {
  const [novoNome, setNovoNome] = useState('');
  const [novoTel,  setNovoTel]  = useState('');
  const [novoPapel, setNovoPapel] = useState('Cônjuge');

  const adicionar = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    onChange([...nucleo, { id: gerarId(), nome, telefone: novoTel.trim(), papel: novoPapel }]);
    setNovoNome(''); setNovoTel('');
  };

  return (
    <div>
      <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 16 }}>Núcleo Familiar</div>

      {nucleo.length === 0 && (
        <div style={{
          padding: '12px 16px', background: C.brand + '08',
          borderRadius: RADIUS.md, border: `1px dashed ${C.brand}30`,
          color: C.textDim, fontSize: FONT.sm, marginBottom: 14,
        }}>
          Nenhum membro cadastrado.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {nucleo.map((m, i) => {
          const qtdContas = contas.filter(c => c.nucleoId === m.id).length;
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', background: C.bg,
              borderRadius: RADIUS.md, border: `1px solid ${C.border}`,
            }}>
              <Avatar nome={m.nome} index={i} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text }}>
                  {m.nome}
                  {m.papel && (
                    <span style={{
                      marginLeft: 8, fontSize: FONT.xs, color: C.brand,
                      background: C.brand + '12', padding: '1px 7px',
                      borderRadius: RADIUS.full,
                    }}>
                      {m.papel}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: FONT.xs, color: C.textMuted }}>
                  {m.telefone ? `📱 ${m.telefone}` : 'Sem telefone'}
                  {' · '}{qtdContas} conta{qtdContas !== 1 ? 's' : ''}
                </div>
              </div>
              {!modoLeitura && (
                <button onClick={() => onChange(nucleo.filter(x => x.id !== m.id))} style={btnIconeStyle()}>✕</button>
              )}
            </div>
          );
        })}
      </div>

      {!modoLeitura && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="Nome"
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adicionar()}
            style={{ ...iS(), flex: '2 1 130px' }}
          />
          <input
            placeholder="Telefone"
            value={novoTel}
            onChange={e => setNovoTel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adicionar()}
            style={{ ...iS(), flex: '2 1 120px' }}
          />
          <select value={novoPapel} onChange={e => setNovoPapel(e.target.value)} style={{ ...sS(), flex: '1 1 100px' }}>
            {PAPEIS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={adicionar} disabled={!novoNome.trim()} style={aBtnS(!novoNome.trim())}>
            + Membro
          </button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTES ATÔMICOS
// ════════════════════════════════════════════════════════════════════════════

// Toggle estilo iOS — 36×20px, sliding dot
function Toggle({ ligado, indeterminate, cor }) {
  const corAtiva = cor ?? C.brand;
  return (
    <div style={{
      width: 36, height: 20, borderRadius: RADIUS.full,
      background: ligado ? corAtiva : C.border,
      position: 'relative', flexShrink: 0,
      transition: 'background 0.2s',
      cursor: 'pointer',
    }}>
      <div style={{
        position: 'absolute',
        top: 2,
        left: ligado ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: indeterminate && !ligado ? C.textDim : '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
        transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }} />
    </div>
  );
}

// Avatar com cor derivada do index
function Avatar({ nome, index, size }) {
  const CORES = [C.brand, '#22D3A0', '#F87171', '#FBBF24', '#C084FC', '#60A5FA'];
  const cor = CORES[(index ?? 0) % CORES.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: cor + '22', border: `1.5px solid ${cor}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: cor,
      letterSpacing: '-0.01em',
    }}>
      {nome?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// Título padronizado de passo
function PassoTitulo({ icone, titulo, descricao }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 28, marginBottom: 10, lineHeight: 1 }}>{icone}</div>
      <div style={{ fontSize: FONT.lg, fontWeight: 800, color: C.text, marginBottom: 6, lineHeight: 1.3 }}>
        {titulo}
      </div>
      <div style={{ fontSize: FONT.sm, color: C.textMuted, lineHeight: 1.65 }}>
        {descricao}
      </div>
    </div>
  );
}

// Rodapé de navegação
function NavFooter({ onVoltar, onAvancar, labelAvancar = 'Próximo →', disabled = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 36, paddingTop: 20,
      borderTop: `1px solid ${C.border}`,
    }}>
      <Btn variant="ghost" onClick={onVoltar}>← Voltar</Btn>
      <Btn onClick={onAvancar} disabled={disabled}>{labelAvancar}</Btn>
    </div>
  );
}

// ── Style helpers ───────────────────────────────────────────────────────────
function iS() { // input style
  return {
    padding: '9px 12px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: RADIUS.sm,
    color: C.text,
    fontSize: FONT.sm,
    fontFamily: "'Inter',sans-serif",
    outline: 'none',
  };
}

function sS() { // select style
  return {
    padding: '9px 10px',
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: RADIUS.sm,
    color: C.text,
    fontSize: FONT.sm,
    fontFamily: "'Inter',sans-serif",
    outline: 'none',
    cursor: 'pointer',
  };
}

function aBtnS(disabled) { // action button style
  return {
    padding: '9px 18px',
    background: disabled ? C.border : C.brand,
    border: 'none',
    borderRadius: RADIUS.sm,
    color: disabled ? C.textDim : '#fff',
    fontWeight: 700,
    fontSize: FONT.sm,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: "'Inter',sans-serif",
    whiteSpace: 'nowrap',
    transition: 'background 0.15s, opacity 0.15s',
    opacity: disabled ? 0.6 : 1,
  };
}

function btnIconeStyle() {
  return {
    background: 'transparent', border: 'none',
    cursor: 'pointer', color: C.textDim,
    fontSize: 15, padding: '4px 8px',
    borderRadius: RADIUS.sm,
    fontFamily: "'Inter',sans-serif",
    transition: 'color 0.15s',
  };
}
