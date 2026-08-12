/**
 * SeletorMes.jsx — Seletor global de mês para a página Orçamento
 * Navegação: prev/next, salto direto para mês/ano via select
 * Exibição: nome do mês + ano
 */
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { MESES_FULL } from '../../data/categorias.js';
import { C, FONT, RADIUS } from '../../design/tokens.js';

export function SeletorMes({ mes, ano, onChange }) {
  // mes: 0-11 | ano: number
  const irParaMes = (novoMes, novoAno) => {
    onChange(novoMes, novoAno);
  };

  const prev = () => {
    if (mes === 0) irParaMes(11, ano - 1);
    else irParaMes(mes - 1, ano);
  };

  const next = () => {
    if (mes === 11) irParaMes(0, ano + 1);
    else irParaMes(mes + 1, ano);
  };

  // Anos disponíveis: -3 até +2 do ano atual
  const anoAtualSistema = new Date().getFullYear();
  const anos = [];
  for (let a = anoAtualSistema - 3; a <= anoAtualSistema + 2; a++) anos.push(a);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'var(--c-card)',
      border: '1px solid var(--c-border)',
      borderRadius: RADIUS.lg,
      padding: '8px 12px',
    }}>
      <Calendar size={15} color="var(--c-text-muted)" style={{ flexShrink: 0 }} />

      {/* Botão anterior */}
      <button
        onClick={prev}
        title="Mês anterior"
        style={{
          background: 'transparent',
          border: '1px solid var(--c-border)',
          borderRadius: RADIUS.sm,
          color: 'var(--c-text-muted)',
          cursor: 'pointer',
          width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-border-light)'; e.currentTarget.style.color = 'var(--c-text)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text-muted)'; }}
      >
        <ChevronLeft size={13} />
      </button>

      {/* Seletor de mês */}
      <select
        value={mes}
        onChange={e => irParaMes(Number(e.target.value), ano)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--c-text)',
          fontSize: FONT.base,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
          outline: 'none',
          minWidth: 90,
        }}
      >
        {MESES_FULL.map((m, i) => (
          <option key={i} value={i} style={{ background: 'var(--c-card)', color: 'var(--c-text)' }}>
            {m}
          </option>
        ))}
      </select>

      {/* Seletor de ano */}
      <select
        value={ano}
        onChange={e => irParaMes(mes, Number(e.target.value))}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--c-text-muted)',
          fontSize: FONT.base,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {anos.map(a => (
          <option key={a} value={a} style={{ background: 'var(--c-card)', color: 'var(--c-text)' }}>
            {a}
          </option>
        ))}
      </select>

      {/* Botão próximo */}
      <button
        onClick={next}
        title="Próximo mês"
        style={{
          background: 'transparent',
          border: '1px solid var(--c-border)',
          borderRadius: RADIUS.sm,
          color: 'var(--c-text-muted)',
          cursor: 'pointer',
          width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-border-light)'; e.currentTarget.style.color = 'var(--c-text)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text-muted)'; }}
      >
        <ChevronRight size={13} />
      </button>

      {/* Botão "Hoje" */}
      <button
        onClick={() => {
          const now = new Date();
          irParaMes(now.getMonth(), now.getFullYear());
        }}
        title="Ir para o mês atual"
        style={{
          background: 'transparent',
          border: '1px solid var(--c-border)',
          borderRadius: RADIUS.sm,
          color: 'var(--c-text-muted)',
          cursor: 'pointer',
          padding: '4px 10px',
          fontSize: FONT.xs,
          fontWeight: 600,
          fontFamily: 'inherit',
          height: 28,
          display: 'flex', alignItems: 'center',
          flexShrink: 0,
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-border-light)'; e.currentTarget.style.color = 'var(--c-text)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text-muted)'; }}
      >
        Hoje
      </button>
    </div>
  );
}
