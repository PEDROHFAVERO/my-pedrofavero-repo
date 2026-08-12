/**
 * GraficoBarrasCategorias.jsx
 *
 * Gráfico de barras horizontais agrupadas por Despesas/Receitas em nível 2.
 * Clique no nome da categoria abre ModalDetalheCategoria.
 *
 * Extraído de VistaMensal.jsx (linhas 43–176).
 *
 * @module GraficoBarrasCategorias
 */
import { useState } from 'react';
import { C, FONT, RADIUS } from '../../../design/tokens.js';
import { fmtBRL, Card } from '../../UI.jsx';
import { GRUPOS } from '../../../data/categorias.js';
import { grupoColor } from '../KPICard.jsx';
import { CORES_CAT } from './coresCat.js';
import { ModalDetalheCategoria } from '../ModalDetalheCategoria.jsx';

export function GraficoBarrasCategorias({
  realizadoMes, parcelasMes, categoriasNivel2, categorias, mesesLabel,
  transacoesFiltradas, mesesSelecionados, setClienteAtivo, clienteAtivo,
}) {
  const [modalCat, setModalCat] = useState(null); // { cat2Id, cat2Nome, tipo }

  const GRUPOS_DESP = [GRUPOS.FIXAS, GRUPOS.CONSUMO, GRUPOS.DIVIDAS, GRUPOS.INVESTIMENTOS];
  const GRUPOS_REC  = [GRUPOS.RECEITAS];

  const somarPorNivel2 = (gruposFiltro, tipo) => {
    const subcats = categorias.filter(c => gruposFiltro.includes(c.grupo) && !c.oculto);
    const resultado = [];
    const nivel2Filtrado = categoriasNivel2.filter(c => gruposFiltro.includes(c.grupo));
    for (const cat2 of nivel2Filtrado) {
      const filhas = subcats.filter(c => c.categoria === cat2.id);
      let total = 0;
      for (const f of filhas) {
        const r = realizadoMes[f.id];
        if (!r) continue;
        total += tipo === 'receita' ? (r.receita || 0) : (r.despesa || 0);
        if (tipo === 'despesa') total += parcelasMes[f.id] || 0;
      }
      if (total > 0) resultado.push({ id: cat2.id, nome: cat2.nome, valor: total, grupo: cat2.grupo });
    }
    return resultado.sort((a, b) => b.valor - a.valor);
  };

  const barrasDesp = somarPorNivel2(GRUPOS_DESP, 'despesa');
  const barrasRec  = somarPorNivel2(GRUPOS_REC,  'receita');
  const totalDesp  = barrasDesp.reduce((s, b) => s + b.valor, 0);
  const totalRec   = barrasRec.reduce((s, b)  => s + b.valor, 0);
  const maxDesp    = Math.max(...barrasDesp.map(b => b.valor), 1);
  const maxRec     = Math.max(...barrasRec.map(b => b.valor), 1);

  if (totalDesp === 0 && totalRec === 0) return null;

  const corBarra = (id, grupo) => CORES_CAT[id] || grupoColor(grupo);

  const renderColuna = (titulo, barras, total, maxVal, corTitulo, tipo) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: FONT.sm, fontWeight: 700, color: corTitulo,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        marginBottom: 18, paddingBottom: 8,
        borderBottom: `2px solid ${corTitulo}40`,
      }}>{titulo}</div>

      {barras.length === 0 && (
        <div style={{ fontSize: FONT.xs, color: C.textDim, padding: '8px 0' }}>Sem dados para o período</div>
      )}
      {barras.map(b => {
        const pct     = total > 0 ? (b.valor / total * 100) : 0;
        const largura = maxVal > 0 ? (b.valor / maxVal * 100) : 0;
        const cor     = corBarra(b.id, b.grupo);
        return (
          <div key={b.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: cor, flexShrink: 0 }} />
              <span
                onClick={() => setModalCat({ cat2Id: b.id, cat2Nome: b.nome, tipo })}
                title="Ver transações"
                style={{
                  fontSize: FONT.xs, color: C.text, flex: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted',
                  textDecorationColor: cor + 'aa',
                  transition: 'color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = cor; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.text; }}
              >
                {b.nome}
              </span>
              <span style={{ fontSize: FONT.xs, color: C.textMuted, minWidth: 32, textAlign: 'right' }}>
                {pct.toFixed(1)}%
              </span>
              <span style={{ fontSize: FONT.xs, fontWeight: 600, color: cor, minWidth: 80, textAlign: 'right' }}>
                {fmtBRL(b.valor)}
              </span>
            </div>
            <div style={{ height: 8, background: C.bg, borderRadius: RADIUS.full, overflow: 'hidden', marginLeft: 18 }}>
              <div style={{
                height: '100%', width: `${largura}%`, background: cor,
                borderRadius: RADIUS.full, transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        );
      })}

      {total > 0 && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: FONT.xs, color: C.textMuted, fontWeight: 600 }}>Total</span>
          <span style={{ fontSize: FONT.base, fontWeight: 700, color: corTitulo }}>{fmtBRL(total)}</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Card padding="20px" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: FONT.base, fontWeight: 700, color: C.text, marginBottom: 20 }}>
          Distribuição por Categoria — {mesesLabel}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {renderColuna('Despesas', barrasDesp, totalDesp, maxDesp, C.desp, 'despesa')}
          {renderColuna('Receitas', barrasRec,  totalRec,  maxRec,  C.rec,  'receita')}
        </div>
      </Card>

      {modalCat && (
        <ModalDetalheCategoria
          cat2Id={modalCat.cat2Id}
          cat2Nome={modalCat.cat2Nome}
          tipo={modalCat.tipo}
          mesesSelecionados={mesesSelecionados}
          mesesLabel={mesesLabel}
          transacoesFiltradas={transacoesFiltradas}
          categorias={categorias}
          categoriasNivel2={categoriasNivel2}
          clienteAtivo={clienteAtivo}
          setClienteAtivo={setClienteAtivo}
          onClose={() => setModalCat(null)}
        />
      )}
    </>
  );
}
