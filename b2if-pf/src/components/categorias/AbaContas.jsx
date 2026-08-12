/**
 * AbaContas.jsx — Visão "Família & Contas" pós-setup (ConfigMode)
 *
 * Hierarquia member-first:
 *   Membro familiar (accordion-card com faixa lateral colorida)
 *     └── Banco (row com ícone + contagem + ações)
 *           └── Account chips humanizados (tipo label + ícone + transações)
 *           └── "+ Nova Conta" chip dashed
 *     └── "+ Adicionar Banco" botão scoped ao membro
 *
 * Migração silenciosa de legado:
 *   • bancos sem nucleoId → atribuídos ao primeiro membro do núcleo (ou '' se vazio)
 *   • contas sem nucleoId → mantidas em seção "Contas não vinculadas" no final
 */

import { useState } from 'react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { MiniBtn } from './helpers.jsx';
import { BancoLogo } from '../BancoLogo.jsx';

// ── Constantes ───────────────────────────────────────────────────────────────

const CORES_MEMBRO = [
  '#3B82F6', // brand azul (índice 0 = Titular)
  '#22D3A0', // verde-menta (Cônjuge)
  '#F87171', // vermelho-rosado
  '#FBBF24', // âmbar
  '#C084FC', // roxo
  '#60A5FA', // azul-claro
];

const TIPOS_CONTA = [
  { id: 'corrente',       label: 'Conta Corrente',    icone: '💳' },
  { id: 'poupanca',       label: 'Poupança',          icone: '🏦' },
  { id: 'cartao_credito', label: 'Cartão de Crédito', icone: '💲' },
  { id: 'investimentos',  label: 'Investimentos',     icone: '📈' },
  { id: 'outro',          label: 'Outro',             icone: '🔖' },
];

function tipoLabel(tipo) {
  return TIPOS_CONTA.find(t => t.id === tipo)?.label ?? tipo ?? '—';
}
function tipoIcone(tipo) {
  return TIPOS_CONTA.find(t => t.id === tipo)?.icone ?? '🔖';
}
function corMembro(idx) {
  return CORES_MEMBRO[idx % CORES_MEMBRO.length];
}

// ── Componente raiz ──────────────────────────────────────────────────────────

export function AbaContas({ ctx }) {
  const {
    transacoes, contas, bancos,
    clienteAtivo, setClienteAtivo,
    modoLeitura,
    setModalBanco, setModalConta, setModalMoverConta,
  } = ctx;

  const nucleo = clienteAtivo?.nucleoFamiliar ?? [];

  // ── Migração silenciosa: bancos sem nucleoId → primeiro membro (ou '')
  const primeiroMembroId = nucleo[0]?.id ?? '';
  const bancosNorm = bancos.map(b =>
    b.nucleoId !== undefined ? b : { ...b, nucleoId: primeiroMembroId }
  );

  // ── Contas sem nucleoId (legado pré-wizard, edge case)
  const contasSemMembro = contas.filter(c => !c.nucleoId && !c.bancoId);

  // ── Estado de expand/collapse — accordion exclusivo (um de cada vez), fechado por padrão
  const [aberto, setAberto] = useState(null); // id do membro aberto, ou null

  const toggleExpand = (id) => {
    setAberto(prev => prev === id ? null : id);
  };

  // ── Caso vazio total
  if (nucleo.length === 0 && bancosNorm.length === 0) {
    return (
      <EmptyGlobal modoLeitura={modoLeitura} onAddBanco={() => setModalBanco({ id: '', nome: '' })} />
    );
  }

  // ── Se não há membros cadastrados, exibe no modo "Geral" (legado flat)
  if (nucleo.length === 0) {
    return (
      <FlatFallback
        bancos={bancosNorm}
        contas={contas}
        transacoes={transacoes}
        modoLeitura={modoLeitura}
        clienteAtivo={clienteAtivo}
        setClienteAtivo={setClienteAtivo}
        setModalBanco={setModalBanco}
        setModalConta={setModalConta}
        setModalMoverConta={setModalMoverConta}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Um accordion-card por membro ───────────────────────────────── */}
      {nucleo.map((membro, idx) => {
        const cor     = corMembro(idx);
        const estaAberto = aberto === membro.id;
        const bancosDM = bancosNorm.filter(b => b.nucleoId === membro.id);
        const contasDM = contas.filter(c => c.nucleoId === membro.id);
        const totalTx  = contasDM.reduce((acc, c) => acc + transacoes.filter(t => t.conta === c.nome).length, 0);

        return (
          <MemberAccordion
            key={membro.id}
            membro={membro}
            index={idx}
            cor={cor}
            aberto={estaAberto}
            onToggle={() => toggleExpand(membro.id)}
            bancos={bancosDM}
            contas={contasDM}
            totalTx={totalTx}
            allContas={contas}
            transacoes={transacoes}
            modoLeitura={modoLeitura}
            clienteAtivo={clienteAtivo}
            setClienteAtivo={setClienteAtivo}
            allBancos={bancos}
            setModalBanco={setModalBanco}
            setModalConta={setModalConta}
            setModalMoverConta={setModalMoverConta}
          />
        );
      })}

      {/* ── Contas não vinculadas a nenhum membro (legado) ─────────────── */}
      {contasSemMembro.length > 0 && (
        <ContasSemVinculo
          contas={contasSemMembro}
          transacoes={transacoes}
          modoLeitura={modoLeitura}
          clienteAtivo={clienteAtivo}
          setClienteAtivo={setClienteAtivo}
          setModalConta={setModalConta}
          setModalMoverConta={setModalMoverConta}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ACCORDION DE MEMBRO
// ════════════════════════════════════════════════════════════════════════════

function MemberAccordion({
  membro, index, cor, aberto, onToggle,
  bancos, contas, totalTx,
  allContas, allBancos, transacoes,
  modoLeitura, clienteAtivo, setClienteAtivo,
  setModalBanco, setModalConta, setModalMoverConta,
}) {
  const qtdBancos = bancos.length;
  const qtdContas = contas.length;

  // Badge de papel com cor contextual
  const papelCores = {
    'Titular':    [cor, cor + '18'],
    'Cônjuge':    ['#C084FC', '#C084FC18'],
    'Filho(a)':   ['#60A5FA', '#60A5FA18'],
    'Dependente': ['#FBBF24', '#FBBF2418'],
    'Outro':      [C.textMuted, C.border],
  };
  const [papelCor, papelBg] = papelCores[membro.papel] ?? [C.textMuted, C.border];

  return (
    <div style={{
      borderRadius: RADIUS.lg,
      border: `1px solid ${C.border}`,
      overflow: 'hidden',
      background: C.card,
      transition: 'box-shadow 0.2s',
    }}>
      {/* ── Header (sempre visível) ───────────────────────────────────── */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 20px',
          borderLeft: `4px solid ${cor}`,
          cursor: 'pointer',
          userSelect: 'none',
          background: aberto ? cor + '06' : 'transparent',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = cor + '0A'}
        onMouseLeave={e => e.currentTarget.style.background = aberto ? cor + '06' : 'transparent'}
      >
        {/* Avatar */}
        <div style={{
          width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
          background: cor + '22', border: `1.5px solid ${cor}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, fontWeight: 700, color: cor,
        }}>
          {membro.nome?.[0]?.toUpperCase() ?? '?'}
        </div>

        {/* Info do membro */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: FONT.base, fontWeight: 700, color: C.text }}>
              {membro.nome}
            </span>
            {membro.papel && (
              <span style={{
                fontSize: FONT.xs, fontWeight: 600, color: papelCor,
                background: papelBg, padding: '2px 9px',
                borderRadius: RADIUS.full,
              }}>
                {membro.papel}
              </span>
            )}
          </div>
          {/* Sub-info resumida */}
          <div style={{
            fontSize: FONT.xs, color: C.textMuted, marginTop: 3,
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          }}>
            {membro.telefone && <span>📱 {membro.telefone}</span>}
            {membro.telefone && <Dot />}
            <span style={{ color: qtdBancos > 0 ? C.textMuted : C.textDim }}>
              {qtdBancos} banco{qtdBancos !== 1 ? 's' : ''}
            </span>
            <Dot />
            <span style={{ color: qtdContas > 0 ? C.textMuted : C.textDim }}>
              {qtdContas} conta{qtdContas !== 1 ? 's' : ''}
            </span>
            {totalTx > 0 && <><Dot /><span>{totalTx} transações</span></>}
          </div>
        </div>

        {/* Chevron */}
        <div style={{
          fontSize: 12, color: C.textMuted,
          transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          flexShrink: 0,
        }}>▼</div>
      </div>

      {/* ── Corpo expansível ─────────────────────────────────────────── */}
      {aberto && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: '20px 20px 20px 24px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          {/* Bancos do membro */}
          {bancos.length === 0 ? (
            <EmptyMembro
              cor={cor}
              modoLeitura={modoLeitura}
              onAddBanco={() => setModalBanco({ id: '', nome: '', nucleoId: membro.id })}
            />
          ) : (
            <>
              {bancos.map(banco => (
                <BancoSection
                  key={banco.id}
                  banco={banco}
                  membro={membro}
                  contas={contas.filter(c => c.bancoId === banco.id)}
                  transacoes={transacoes}
                  modoLeitura={modoLeitura}
                  clienteAtivo={clienteAtivo}
                  setClienteAtivo={setClienteAtivo}
                  allBancos={allBancos}
                  allContas={allContas}
                  setModalBanco={setModalBanco}
                  setModalConta={setModalConta}
                  setModalMoverConta={setModalMoverConta}
                />
              ))}

              {/* + Adicionar Banco — scoped ao membro */}
              {!modoLeitura && (
                <AddBancoBtn
                  cor={cor}
                  onClick={() => setModalBanco({ id: '', nome: '', nucleoId: membro.id })}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SEÇÃO DE BANCO (dentro do membro)
// ════════════════════════════════════════════════════════════════════════════

function BancoSection({
  banco, membro, contas, transacoes,
  modoLeitura, clienteAtivo, setClienteAtivo,
  allBancos, allContas,
  setModalBanco, setModalConta, setModalMoverConta,
}) {
  const podeExcluir = contas.length === 0;

  const excluirBanco = () => {
    if (!podeExcluir) return;
    setClienteAtivo({
      ...clienteAtivo,
      bancos: allBancos.filter(b => b.id !== banco.id),
    });
  };

  return (
    <div>
      {/* Header do banco */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 12,
        paddingBottom: 10,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <BancoLogo banco={banco.nome} size={28} radius={7} />
        <span style={{ fontSize: FONT.base, fontWeight: 700, color: C.text }}>
          {banco.nome}
        </span>
        <span style={{
          fontSize: FONT.xs, color: C.textMuted,
          background: C.border, padding: '1px 8px',
          borderRadius: RADIUS.full,
        }}>
          {contas.length} {contas.length === 1 ? 'conta' : 'contas'}
        </span>
        {!modoLeitura && (
          <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
            <MiniBtn
              title="Editar nome do banco"
              onClick={() => setModalBanco({ ...banco })}
            >✏️</MiniBtn>
            <MiniBtn
              danger
              title={podeExcluir ? 'Excluir banco' : 'Remova as contas antes de excluir'}
              onClick={excluirBanco}
              style={{ opacity: podeExcluir ? 1 : 0.35, cursor: podeExcluir ? 'pointer' : 'not-allowed' }}
            >✕</MiniBtn>
          </div>
        )}
      </div>

      {/* Grid de account chips */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10,
      }}>
        {contas.map(c => (
          <AccountChip
            key={c.id}
            conta={c}
            transacoes={transacoes}
            modoLeitura={modoLeitura}
            clienteAtivo={clienteAtivo}
            setClienteAtivo={setClienteAtivo}
            allContas={allContas}
            setModalConta={setModalConta}
            setModalMoverConta={setModalMoverConta}
          />
        ))}

        {/* + Nova Conta chip dashed */}
        {!modoLeitura && (
          <NovaContaChip
            onClick={() => setModalConta({ id: '', nome: '', bancoId: banco.id, nucleoId: membro.id, tipo: 'corrente' })}
          />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ACCOUNT CHIP
// ════════════════════════════════════════════════════════════════════════════

function AccountChip({ conta, transacoes, modoLeitura, clienteAtivo, setClienteAtivo, allContas, setModalConta, setModalMoverConta }) {
  const txCount = transacoes.filter(t => t.conta === conta.nome).length;
  const icone   = tipoIcone(conta.tipo);
  const label   = tipoLabel(conta.tipo);

  // Tint de fundo por tipo de conta
  const tintMap = {
    corrente:       ['#3B82F6', '#3B82F608'],
    poupanca:       ['#22D3A0', '#22D3A008'],
    cartao_credito: ['#C084FC', '#C084FC08'],
    investimentos:  ['#60A5FA', '#60A5FA08'],
    outro:          [C.textMuted, C.border + '30'],
  };
  const [tintColor, tintBg] = tintMap[conta.tipo] ?? tintMap.outro;

  return (
    <div style={{
      minWidth: 175, maxWidth: 220,
      padding: '12px 14px',
      background: tintBg,
      border: `1px solid ${tintColor}28`,
      borderRadius: RADIUS.md,
      display: 'flex', flexDirection: 'column', gap: 6,
      position: 'relative',
    }}>
      {/* Linha de tipo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>{icone}</span>
        <span style={{ fontSize: FONT.xs, fontWeight: 600, color: tintColor }}>{label}</span>
      </div>

      {/* Nome da conta */}
      <div style={{
        fontSize: FONT.sm, fontWeight: 700, color: C.text,
        lineHeight: 1.3,
        wordBreak: 'break-word',
      }}>
        {conta.nome}
      </div>

      {/* Contagem de transações */}
      <div style={{ fontSize: FONT.xs, color: C.textDim }}>
        {txCount > 0
          ? `${txCount} transaç${txCount === 1 ? 'ão' : 'ões'}`
          : 'Sem transações'}
      </div>

      {/* Ações — aparecem no hover via CSS não disponível em inline, então ficam sempre visíveis mas discretas */}
      {!modoLeitura && (
        <div style={{
          display: 'flex', gap: 4, marginTop: 2,
          justifyContent: 'flex-end',
        }}>
          <MiniBtn title="Mover para outro banco" onClick={() => setModalMoverConta({ conta })}>↔</MiniBtn>
          <MiniBtn title="Editar conta" onClick={() => setModalConta({ ...conta })}>✏️</MiniBtn>
          <MiniBtn
            danger
            title="Excluir conta"
            onClick={() => setClienteAtivo({ ...clienteAtivo, contas: allContas.filter(x => x.id !== conta.id) })}
          >✕</MiniBtn>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES AUXILIARES
// ════════════════════════════════════════════════════════════════════════════

function NovaContaChip({ onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        minWidth: 130,
        padding: '12px 14px',
        border: `1.5px dashed ${hover ? C.brand : C.border}`,
        borderRadius: RADIUS.md,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6,
        color: hover ? C.brand : C.textMuted,
        fontSize: FONT.sm, cursor: 'pointer',
        transition: 'border-color .15s, color .15s',
        alignSelf: 'stretch',
        minHeight: 80,
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 300 }}>+</span>
      Nova Conta
    </div>
  );
}

function AddBancoBtn({ cor, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 18px',
        background: hover ? cor + '12' : 'transparent',
        border: `1.5px dashed ${hover ? cor : C.border}`,
        borderRadius: RADIUS.md,
        color: hover ? cor : C.textMuted,
        fontSize: FONT.sm, cursor: 'pointer',
        fontFamily: "'Inter',sans-serif",
        fontWeight: 500,
        transition: 'all 0.15s',
        alignSelf: 'flex-start',
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
      Adicionar Banco
    </button>
  );
}

function EmptyMembro({ cor, modoLeitura, onAddBanco }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 10, padding: '24px 16px',
      background: cor + '06',
      borderRadius: RADIUS.md,
      border: `1px dashed ${cor}30`,
      textAlign: 'center',
    }}>
      <span style={{ fontSize: 28 }}>🏦</span>
      <div style={{ fontSize: FONT.sm, fontWeight: 600, color: C.textMuted }}>
        Nenhum banco cadastrado
      </div>
      <div style={{ fontSize: FONT.xs, color: C.textDim }}>
        Adicione uma instituição financeira para começar
      </div>
      {!modoLeitura && (
        <button
          onClick={onAddBanco}
          style={{
            marginTop: 4,
            padding: '8px 20px',
            background: cor + '18',
            border: `1px solid ${cor}40`,
            borderRadius: RADIUS.full,
            color: cor, fontSize: FONT.sm, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'Inter',sans-serif",
          }}
        >
          + Adicionar Banco
        </button>
      )}
    </div>
  );
}

function EmptyGlobal({ modoLeitura, onAddBanco }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 12, padding: '48px 24px',
      background: C.card,
      borderRadius: RADIUS.lg,
      border: `1px solid ${C.border}`,
      textAlign: 'center',
    }}>
      <span style={{ fontSize: 40 }}>🏦</span>
      <div style={{ fontSize: FONT.lg, fontWeight: 700, color: C.text }}>
        Nenhum banco cadastrado
      </div>
      <div style={{ fontSize: FONT.sm, color: C.textMuted }}>
        Adicione uma instituição financeira para começar
      </div>
      {!modoLeitura && (
        <button
          onClick={onAddBanco}
          style={{
            marginTop: 8,
            padding: '10px 28px',
            background: C.brand + '18',
            border: `1px solid ${C.brand}40`,
            borderRadius: RADIUS.full,
            color: C.brand, fontSize: FONT.base, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'Inter',sans-serif",
          }}
        >
          + Novo Banco
        </button>
      )}
    </div>
  );
}

// Fallback flat para clientes sem núcleo familiar (legado pré-wizard)
function FlatFallback({
  bancos, contas, transacoes,
  modoLeitura, clienteAtivo, setClienteAtivo,
  setModalBanco, setModalConta, setModalMoverConta,
}) {
  return (
    <>
      {!modoLeitura && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button
            onClick={() => setModalBanco({ id: '', nome: '' })}
            style={{
              padding: '8px 18px',
              background: C.brand + '18',
              border: `1px solid ${C.brand}40`,
              borderRadius: RADIUS.full,
              color: C.brand, fontSize: FONT.sm, fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Inter',sans-serif",
            }}
          >+ Novo Banco</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {bancos.map(banco => {
          const contasDoBanco = contas.filter(c => c.bancoId === banco.id);
          const podeExcluir   = contasDoBanco.length === 0;
          return (
            <div key={banco.id}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                paddingBottom: 8, marginBottom: 14,
                borderBottom: `2px solid ${C.border}`,
              }}>
                <BancoLogo banco={banco.nome} size={26} radius={6} />
                <span style={{ fontSize: FONT.lg, fontWeight: 700, color: C.text }}>{banco.nome}</span>
                <span style={{ fontSize: FONT.xs, color: C.textMuted }}>
                  {contasDoBanco.length} {contasDoBanco.length === 1 ? 'conta' : 'contas'}
                </span>
                {!modoLeitura && (
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                    <MiniBtn onClick={() => setModalBanco({ ...banco })}>✏️</MiniBtn>
                    <MiniBtn
                      danger
                      title={podeExcluir ? 'Excluir banco' : 'Remova as contas antes de excluir o banco'}
                      onClick={() => {
                        if (!podeExcluir) return;
                        setClienteAtivo({ ...clienteAtivo, bancos: bancos.filter(b => b.id !== banco.id) });
                      }}
                      style={{ opacity: podeExcluir ? 1 : 0.35, cursor: podeExcluir ? 'pointer' : 'not-allowed' }}
                    >✕</MiniBtn>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {contasDoBanco.map(c => (
                  <AccountChip
                    key={c.id}
                    conta={c}
                    transacoes={transacoes}
                    modoLeitura={modoLeitura}
                    clienteAtivo={clienteAtivo}
                    setClienteAtivo={setClienteAtivo}
                    allContas={contas}
                    setModalConta={setModalConta}
                    setModalMoverConta={setModalMoverConta}
                  />
                ))}
                {!modoLeitura && (
                  <NovaContaChip onClick={() => setModalConta({ id: '', nome: '', bancoId: banco.id, tipo: 'corrente' })} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Contas sem vínculo com banco OU membro (edge case de dados muito antigos)
function ContasSemVinculo({ contas, transacoes, modoLeitura, clienteAtivo, setClienteAtivo, setModalConta, setModalMoverConta }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{
      borderRadius: RADIUS.md,
      border: `1px solid ${C.border}`,
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setAberto(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', cursor: 'pointer',
          background: C.card,
        }}
      >
        <span style={{ fontSize: FONT.sm, fontWeight: 700, color: C.textMuted, fontStyle: 'italic' }}>
          ⚠️ Contas não vinculadas
        </span>
        <span style={{ fontSize: FONT.xs, color: C.textDim, marginLeft: 4 }}>
          ({contas.length}) — Sem banco ou membro associado
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textDim, transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </div>
      {aberto && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {contas.map(c => (
            <AccountChip
              key={c.id}
              conta={c}
              transacoes={transacoes}
              modoLeitura={modoLeitura}
              clienteAtivo={clienteAtivo}
              setClienteAtivo={setClienteAtivo}
              allContas={contas}
              setModalConta={setModalConta}
              setModalMoverConta={setModalMoverConta}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Utilidades visuais ───────────────────────────────────────────────────────

function Dot() {
  return (
    <span style={{
      width: 3, height: 3, borderRadius: '50%',
      background: C.textDim, display: 'inline-block', flexShrink: 0,
    }} />
  );
}
