import { useState, useMemo } from 'react';
import { FileText, BarChart3, BookOpen, CheckCircle2, AlertTriangle } from 'lucide-react';
import { C, FONT, RADIUS } from '../../design/tokens.js';
import { Btn } from '../UI.jsx';

// ── ExportModal ─────────────────────────────────────────────────────────────
// mesesDisponiveis: array de strings "YYYY-MM" ordenadas
// contas: array de objetos { nome } do clienteAtivo
function ExportModal({ transacoes, contas, mesesDisponiveis, onCSV, onXLSX, onPDF, onClose }) {
  const minMes = mesesDisponiveis[0] || '';
  const maxMes = mesesDisponiveis[mesesDisponiveis.length - 1] || '';
  const [inicio, setInicio] = useState(minMes);
  const [fim, setFim] = useState(maxMes);
  const [contasSel, setContasSel] = useState(new Set()); // Set vazio = todas
  const [loadingXLSX, setLoadingXLSX] = useState(false);

  // Nomes de conta únicos presentes nas transações
  const contasNomes = useMemo(() => {
    const nomes = [...new Set(transacoes.map(t => t.conta).filter(Boolean))].sort();
    // Usa nomes das contas cadastradas se disponíveis, senão usa o que está nas transações
    const cadastradas = (contas || []).map(c => c.nome).filter(Boolean);
    const todos = [...new Set([...cadastradas, ...nomes])].sort();
    return todos;
  }, [transacoes, contas]);

  function toggleConta(nome) {
    setContasSel(prev => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome); else next.add(nome);
      return next;
    });
  }

  // Helper: resolve competência de uma transação → "YYYY-MM"
  function compDe(t) {
    if (t.competencia) return t.competencia.slice(0, 7);
    if (t.periodoLabel) {
      const mesesAbrev = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      const [nomMes, ano] = t.periodoLabel.split('/');
      const idxMes = mesesAbrev.indexOf((nomMes || '').toLowerCase());
      if (idxMes >= 0 && ano) return `${ano}-${String(idxMes + 1).padStart(2, '0')}`;
    }
    if (t.data) return t.data.slice(0, 7);
    return null;
  }

  // Aplica filtros de período + conta
  function aplicarFiltros(lista) {
    return lista.filter(t => {
      const comp = compDe(t);
      if (!comp || comp < inicio || comp > fim) return false;
      if (contasSel.size > 0 && !contasSel.has(t.conta || '')) return false;
      return true;
    });
  }

  // Quantidade de lançamentos com filtros aplicados
  const qtdNoIntervalo = useMemo(() => {
    if (!inicio || !fim) return 0;
    return aplicarFiltros(transacoes).length;
  }, [transacoes, inicio, fim, contasSel]);

  // Formata "YYYY-MM" → "MM/YYYY"
  function fmtMes(ym) {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    return `${m}/${y}`;
  }

  const valido = inicio && fim && inicio <= fim && qtdNoIntervalo > 0;

  async function handleXLSX() {
    setLoadingXLSX(true);
    try { await onXLSX(inicio, fim, contasSel); } finally { setLoadingXLSX(false); }
    onClose();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.xl, padding: '32px 36px', minWidth: 400, maxWidth: 500, width: '100%' }}>
        {/* Título */}
        <div style={{ fontSize: FONT.lg, fontWeight: 800, color: C.text, marginBottom: 4 }}>Exportar Transações</div>
        <div style={{ fontSize: FONT.sm, color: C.textMuted, marginBottom: 24 }}>
          Selecione o período e o formato de exportação.
        </div>

        {/* Seleção de intervalo por mês de competência */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: FONT.xs, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Competência início</div>
            <select
              value={inicio}
              onChange={e => { setInicio(e.target.value); if (e.target.value > fim) setFim(e.target.value); }}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: RADIUS.md,
                border: `1px solid ${C.border}`, background: C.bg,
                color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif",
                boxSizing: 'border-box', cursor: 'pointer',
              }}
            >
              {mesesDisponiveis.map(m => (
                <option key={m} value={m}>{fmtMes(m)}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: FONT.xs, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Competência fim</div>
            <select
              value={fim}
              onChange={e => { setFim(e.target.value); if (e.target.value < inicio) setInicio(e.target.value); }}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: RADIUS.md,
                border: `1px solid ${C.border}`, background: C.bg,
                color: C.text, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif",
                boxSizing: 'border-box', cursor: 'pointer',
              }}
            >
              {mesesDisponiveis.map(m => (
                <option key={m} value={m}>{fmtMes(m)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filtro de contas — dropdown com checkboxes */}
        {contasNomes.length > 1 && (
          <ContaDropdown
            contasNomes={contasNomes}
            contasSel={contasSel}
            onToggle={toggleConta}
            onLimpar={() => setContasSel(new Set())}
          />
        )}

        {/* Contador de transações no período */}
        <div style={{ fontSize: FONT.xs, color: qtdNoIntervalo > 0 ? C.rec : C.textMuted, marginBottom: 24, minHeight: 18 }}>
          {inicio && fim && inicio <= fim
            ? qtdNoIntervalo > 0
              ? `${qtdNoIntervalo} lançamento${qtdNoIntervalo !== 1 ? 's' : ''} selecionado${qtdNoIntervalo !== 1 ? 's' : ''}`
              : 'Nenhum lançamento neste período/conta'
            : 'Selecione um intervalo válido'}
        </div>

        {/* Botões de formato */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* CSV */}
          <button
            disabled={!valido}
            onClick={() => { onCSV(inicio, fim, contasSel); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px', borderRadius: RADIUS.md,
              border: `1.5px solid ${valido ? C.rec : C.border}`,
              background: valido ? C.rec + '10' : 'transparent',
              color: valido ? C.rec : C.textMuted,
              fontWeight: 700, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif",
              cursor: valido ? 'pointer' : 'not-allowed', textAlign: 'left',
              opacity: valido ? 1 : 0.5, transition: 'all 0.15s',
            }}
          >
            <FileText size={22} />
            <div>
              <div>CSV</div>
              <div style={{ fontWeight: 400, fontSize: FONT.xs, opacity: 0.75 }}>Planilha simples, compatível com Excel e Google Sheets</div>
            </div>
          </button>

          {/* Padrão MD (XLSX) */}
          <button
            disabled={!valido || loadingXLSX}
            onClick={handleXLSX}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px', borderRadius: RADIUS.md,
              border: `1.5px solid ${valido ? C.brand : C.border}`,
              background: valido ? C.brand + '10' : 'transparent',
              color: valido ? C.brand : C.textMuted,
              fontWeight: 700, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif",
              cursor: (valido && !loadingXLSX) ? 'pointer' : 'not-allowed', textAlign: 'left',
              opacity: (valido && !loadingXLSX) ? 1 : 0.5, transition: 'all 0.15s',
            }}
          >
            <BarChart3 size={22} />
            <div>
              <div>{loadingXLSX ? 'Gerando...' : 'Padrão MD (.xlsx)'}</div>
              <div style={{ fontWeight: 400, fontSize: FONT.xs, opacity: 0.75 }}>Preenche o template padrão MeuDinheiro com todas as colunas</div>
            </div>
          </button>

          {/* PDF */}
          <button
            disabled={!valido}
            onClick={() => { onPDF(inicio, fim, contasSel); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px', borderRadius: RADIUS.md,
              border: `1.5px solid ${valido ? '#E11D48' : C.border}`,
              background: valido ? '#E11D4810' : 'transparent',
              color: valido ? '#E11D48' : C.textMuted,
              fontWeight: 700, fontSize: FONT.sm, fontFamily: "'Inter',sans-serif",
              cursor: valido ? 'pointer' : 'not-allowed', textAlign: 'left',
              opacity: valido ? 1 : 0.5, transition: 'all 0.15s',
            }}
          >
            <BookOpen size={22} />
            <div>
              <div>PDF</div>
              <div style={{ fontWeight: 400, fontSize: FONT.xs, opacity: 0.75 }}>Tabela formatada para impressão ou arquivamento</div>
            </div>
          </button>
        </div>

        {/* Cancelar */}
        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: 20, padding: '10px', borderRadius: RADIUS.md,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.textMuted, fontWeight: 600, fontSize: FONT.sm,
            fontFamily: "'Inter',sans-serif", cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export { ExportModal };
