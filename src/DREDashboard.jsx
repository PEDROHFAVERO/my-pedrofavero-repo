import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine
} from "recharts";

// ─── CLIENTES DATA ───────────────────────────────────────────────────────────
const CLIENTES = {
  total: 89,
  por_produto: { Master: 51, Premium: 26, Essecial: 11, "Sem produto": 1 },
  jan_count: 9,
  jan: [
    { nome: "Ademicom", produto: "Premium" },
    { nome: "G4 Solucoes Financeiras Ltda", produto: "Premium" },
    { nome: "Capital PXM", produto: "Essecial" },
    { nome: "Libre Consultoria Em Seguros E Planos De Saude Ltda", produto: "Master" },
    { nome: "Lucro Green Bpo Financeiro Ltda", produto: "Master" },
    { nome: "Mercantil Assessoria Contabil Ltda", produto: "Master" },
    { nome: "On Stage", produto: "Master" },
    { nome: "Severina Eugênia da Silva", produto: "Master" },
    { nome: "TOTAL PROTEGE CORRETORA DE PLANOS DE SAUDE - Jhonny Way", produto: "Master" },
  ],
  fev_count: 8,
  fev: [
    { nome: "VILLAGE GAS LTDA", produto: "Premium" },
    { nome: "MR Empresarial Ltda", produto: "Essecial" },
    { nome: "Double Soluçoes e Tecnologia LTDA", produto: "Master" },
    { nome: "Pay Prime", produto: "Premium" },
    { nome: "Josue Luzardo Gebrim", produto: "Master" },
    { nome: "ID FINANCAS LTDA", produto: "Master" },
    { nome: "Oráculo tecnologia", produto: "Master" },
    { nome: "AB2 Assessoria Contábil", produto: "Premium" },
  ],
  sem_data_count: 18,
  sem_data: [
    { nome: "Acad Equilibrio", produto: "Premium" },
    { nome: "Biomundo e Mundo dos Filtros", produto: "Premium" },
    { nome: "Nanos Consultoria", produto: "Master" },
    { nome: "Domus Automação", produto: "Master" },
    { nome: "Eduardo Gallo", produto: "Premium" },
    { nome: "Academias Ultra", produto: "Premium" },
    { nome: "Sync Soluções Contábeis", produto: "Premium" },
    { nome: "Only Blue", produto: "Premium" },
    { nome: "I Green", produto: "Master" },
    { nome: "Csi Saúde Integrada", produto: "Master" },
    { nome: "Ilha Brasil Comunicações", produto: "Master" },
    { nome: "Estrela Neto Soc. Individual De Advocacia", produto: "Premium" },
    { nome: "Francisco Nunes", produto: "Premium" },
    { nome: "Jofre Moreira", produto: "Master" },
    { nome: "Leonardo Batista", produto: "—" },
    { nome: "Liza Lopes", produto: "Premium" },
    { nome: "Rico Rosas", produto: "Premium" },
    { nome: "Thiago Maniglia", produto: "Master" },
  ],
  vencidos_count: 6,
  vencidos: [
    { nome: "Allmax Consultoria E Contabilidade Ltda", produto: "Premium", pagamento: "Parceria", inicio: "01/03/2025" },
    { nome: "Erica Alessandra de A. Silva", produto: "Master", pagamento: "Não sei", inicio: "06/09/2023" },
    { nome: "Escritorio Paula Lima Advogados", produto: "Master", pagamento: "Clube de Permuta", inicio: "12/11/2024" },
    { nome: "Mariana da Silveira", produto: "Master", pagamento: "Não sei", inicio: "21/05/2024" },
    { nome: "Acquacerrado", produto: "Master", pagamento: "Não sei", inicio: "13/05/2024" },
    { nome: "Comercial Du Norte", produto: "Essecial", pagamento: "12x C. Crédito", inicio: "06/04/2024" },
  ],
  atrasados_count: 3,
  atrasados: [
    { nome: "Grupo Afs Solucoes Empresariais Ltda", produto: "Premium", status: "Atraso 3 meses" },
    { nome: "NO AUGE INFLU AGÊNCIA - Maria Eduarda Costa Rodrigues", produto: "Master", status: "Atraso 2 meses" },
    { nome: "Topmedlar - WA Sales", produto: "Premium", status: "Atrasado" },
  ],
  cc_count: 31,
  cc_por_produto: { Master: 22, Premium: 5, Essecial: 4 },
  cc_clientes: [
    { nome: "Actual Assessoria Integral", produto: "Master" },
    { nome: "Ademicom", produto: "Premium" },
    { nome: "Arbrent Representacao Comercial Ltda", produto: "Master" },
    { nome: "Associacao De Tecnologia - Econoenergia", produto: "Master" },
    { nome: "Bits - Assistencia Tecnica Informatica", produto: "Master" },
    { nome: "Capital Health Corretora De Seguros Ltda", produto: "Master" },
    { nome: "Centro Oeste Construtora Ltda", produto: "Master" },
    { nome: "Cooperativa Anjo Beneficios Cppa", produto: "Premium" },
    { nome: "Correia & Souza - Sociedade De Advogados", produto: "Master" },
    { nome: "DRA AMANDAH RODRIGUES IMPLANTODONTIA", produto: "Master" },
    { nome: "Nexo", produto: "Essecial" },
    { nome: "Oráculo da Mente", produto: "Master" },
    { nome: "Libre Consultoria Em Seguros E Planos De Saude", produto: "Master" },
    { nome: "M Silva Assessoria Administrativa Ltda", produto: "Master" },
    { nome: "Mss Assessoria E Corretora De Seguros", produto: "Master" },
    { nome: "VILLAGE GAS LTDA", produto: "Premium" },
    { nome: "Nicx Consultoria Empresarial Ltda", produto: "Essecial" },
    { nome: "Pureza Multimarcas", produto: "Master" },
    { nome: "Sat Solucoes E Atendimento Tecnologicos", produto: "Master" },
    { nome: "Severina Eugênia da Silva", produto: "Master" },
    { nome: "Souto & Aurélio Advocacia", produto: "Essecial" },
    { nome: "Svl Investimentos Ltda", produto: "Master" },
    { nome: "Topmedlar - WA Sales", produto: "Premium" },
    { nome: "Todo Servicos De Arquitetura Ltda", produto: "Master" },
    { nome: "TOTAL PROTEGE - Jhonny Way", produto: "Master" },
    { nome: "Atom Gestao Inteligente", produto: "Master" },
    { nome: "Comercial Du Norte", produto: "Essecial" },
    { nome: "Josue Luzardo Gebrim", produto: "Master" },
    { nome: "ID FINANCAS LTDA", produto: "Master" },
    { nome: "Oráculo tecnologia", produto: "Master" },
    { nome: "AB2 Assessoria Contábil", produto: "Premium" },
  ],
  boleto_count: 17,
  boleto_por_produto: { Master: 10, Essecial: 4, Premium: 3 },
  boleto_clientes: [
    { nome: "Ases Contabilidade Ltda", produto: "Essecial" },
    { nome: "BOX TRAVEL AGENCIA DE TURISMO", produto: "Essecial" },
    { nome: "G4 Solucoes Financeiras Ltda", produto: "Premium" },
    { nome: "Grupo Afs Solucoes Empresariais Ltda", produto: "Premium" },
    { nome: "Hs Capital Consultoria E Corretagem De Seguros", produto: "Master" },
    { nome: "Lucro Green Bpo Financeiro Ltda", produto: "Master" },
    { nome: "Mercantil Assessoria Contabil Ltda", produto: "Master" },
    { nome: "Mulher Empreende Consultoria E Capacitacao", produto: "Master" },
    { nome: "Bioativo Ltda", produto: "Master" },
    { nome: "NO AUGE INFLU AGÊNCIA - Maria Eduarda", produto: "Master" },
    { nome: "Quivas Comercio Ltda", produto: "Master" },
    { nome: "Raiz & Traco Arquitetura E Urbanismo", produto: "Essecial" },
    { nome: "Rw Comunicacao Visual Ltda", produto: "Master" },
    { nome: "Studio De Fotografia Black Se Ltda", produto: "Master" },
    { nome: "MR Empresarial Ltda", produto: "Essecial" },
    { nome: "Double Soluçoes e Tecnologia LTDA", produto: "Master" },
    { nome: "Pay Prime", produto: "Premium" },
  ],
};

// ─── RECORRÊNCIA DATA ────────────────────────────────────────────────────────
const RECORRENCIA = {
  cc: [
    { nome: "Actual Assessoria Integral", produto: "Master", valor: 498 },
    { nome: "Ademicom", produto: "Premium", valor: 698 },
    { nome: "Arbrent Representacao Comercial Ltda", produto: "Master", valor: 698 },
    { nome: "Associacao De Tecnologia - Econoenergia", produto: "Master", valor: 698 },
    { nome: "Bits - Assistencia Tecnica Informatica", produto: "Master", valor: 598 },
    { nome: "Capital Health Corretora De Seguros Ltda", produto: "Master", valor: 698 },
    { nome: "Centro Oeste Construtora Ltda", produto: "Master", valor: 698 },
    { nome: "Cooperativa Anjo Beneficios Cppa", produto: "Premium", valor: 1698 },
    { nome: "Correia & Souza - Sociedade De Advogados", produto: "Master", valor: 698 },
    { nome: "DRA AMANDAH RODRIGUES IMPLANTODONTIA", produto: "Master", valor: 600 },
    { nome: "Nexo", produto: "Essecial", valor: 200 },
    { nome: "Oraculo da Mente", produto: "Master", valor: 300 },
    { nome: "Libre Consultoria Em Seguros E Planos De Saude", produto: "Master", valor: 698 },
    { nome: "M Silva Assessoria Administrativa Ltda", produto: "Master", valor: 698 },
    { nome: "Mss Assessoria E Corretora De Seguros", produto: "Master", valor: 698 },
    { nome: "VILLAGE GAS LTDA", produto: "Premium", valor: 550 },
    { nome: "Nicx Consultoria Empresarial Ltda", produto: "Essecial", valor: 498 },
    { nome: "Pureza Multimarcas", produto: "Master", valor: 498 },
    { nome: "Sat Solucoes E Atendimento Tecnologicos", produto: "Master", valor: 500 },
    { nome: "Severina Eugenia da Silva", produto: "Master", valor: 698 },
    { nome: "Souto & Aurelio Advocacia", produto: "Essecial", valor: 498 },
    { nome: "Svl Investimentos Ltda", produto: "Master", valor: 698 },
    { nome: "Topmedlar - WA Sales", produto: "Premium", valor: 1698 },
    { nome: "Todo Servicos De Arquitetura Ltda", produto: "Master", valor: 698 },
    { nome: "TOTAL PROTEGE - Jhonny Way", produto: "Master", valor: 698 },
    { nome: "Atom Gestao Inteligente", produto: "Master", valor: 698 },
    { nome: "Comercial Du Norte", produto: "Essecial", valor: 498 },
    { nome: "Josue Luzardo Gebrim", produto: "Master", valor: 698 },
    { nome: "ID FINANCAS LTDA", produto: "Master", valor: 698 },
    { nome: "Oraculo tecnologia", produto: "Master", valor: 698 },
    { nome: "AB2 Assessoria Contabil", produto: "Premium", valor: 1698 },
  ],
  boleto: [
    { nome: "Ases Contabilidade Ltda", produto: "Essecial", valor: 498 },
    { nome: "BOX TRAVEL AGENCIA DE TURISMO", produto: "Essecial", valor: 200 },
    { nome: "G4 Solucoes Financeiras Ltda", produto: "Premium", valor: 845 },
    { nome: "Grupo Afs Solucoes Empresariais Ltda", produto: "Premium", valor: 498 },
    { nome: "Hs Capital Consultoria E Corretagem De Seguros", produto: "Master", valor: 400 },
    { nome: "Lucro Green Bpo Financeiro Ltda", produto: "Master", valor: 498 },
    { nome: "Mercantil Assessoria Contabil Ltda", produto: "Master", valor: 698 },
    { nome: "Mulher Empreende Consultoria E Capacitacao", produto: "Master", valor: 698 },
    { nome: "Bioativo Ltda", produto: "Master", valor: 498 },
    { nome: "NO AUGE INFLU AGENCIA - Maria Eduarda", produto: "Master", valor: 600 },
    { nome: "Quivas Comercio Ltda", produto: "Master", valor: 498 },
    { nome: "Raiz & Traco Arquitetura E Urbanismo", produto: "Essecial", valor: 400 },
    { nome: "Rw Comunicacao Visual Ltda", produto: "Master", valor: 698 },
    { nome: "Studio De Fotografia Black Se Ltda", produto: "Master", valor: 498 },
    { nome: "MR Empresarial Ltda", produto: "Essecial", valor: 498 },
    { nome: "Double Solucoes e Tecnologia LTDA", produto: "Master", valor: 500 },
    { nome: "Pay Prime", produto: "Premium", valor: 0 },
  ],
};

const ALL_MONTHS = ["Jan", "Fev", "Mar"];

const rawData = {
  rec_op:   { re: [27041, 36380.76, 2094],    fc: [37000, 45286, 53830] },
  aporte:   { re: [25000, 49600, 11600],       fc: [50000, 50000, 50000] },
  custo:    { re: [20418.13, 16850.88, 150],   fc: [26500, 27650, 28800] },
  desp_fix: { re: [47300.63, 30887.98, 11600], fc: [46900, 43400, 43400] },
  desp_var: { re: [1123.07, 5145.41, 0],       fc: [2100, 2100, 2100] },
  desp_fin: { re: [44.9, 801.33, 56.48],       fc: [0, 0, 0] },
  desp_trib:{ re: [1600.09, 0, 0],             fc: [4030, 4775.74, 5544.7] },
};

const rawCatDesp = {
  "Pessoas":      [30900, 18188, 0],
  "Escritório":   [26125, 0, 0],
  "Eventos":      [18600, 6553, 0],
  "Consultorias": [7500, 7500, 0],
  "Ajuste Caixa": [28954, 0, 0],
  "Pessoas (OP)": [4300, 2000, 0],
  "Logística":    [2350, 2250, 0],
  "Tecnologia":   [0, 4346, 0],
};
const rawCatRec = {
  "Aporte":         [25000, 49600, 11600],
  "Master":         [19580, 22583, 0],
  "Premium Board":  [5241, 15074, 0],
  "Essencial":      [1800, 996, 0],
  "Estacionamento": [160, 80, 0],
};

const C = {
  rec: "#22D3A0", recFc: "#22D3A033",
  desp: "#F87171", despFc: "#F8717133",
  aporte: "#60A5FA",
  resultado: "#FBBF24",
  bg: "#0B0F1A", card: "#131929", border: "#1E2D45",
  text: "#E2E8F0", muted: "#64748B",
};
const PIE_D = ["#F87171","#FB923C","#FBBF24","#A78BFA","#60A5FA","#34D399","#F472B6","#94A3B8"];
const PIE_R = ["#22D3A0","#60A5FA","#A78BFA","#FBBF24","#F472B6"];

const fmt = v => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0}).format(v);
const fmtK = v => Math.abs(v)>=1000 ? `R$${(v/1000).toFixed(0)}k` : fmt(v);
const sum = arr => arr.reduce((a,b)=>a+b,0);
const pctDiff = (re,fc) => fc ? ((re-fc)/Math.abs(fc)*100) : null;

const Tip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:"#1E2D45",border:"1px solid #2D4A6E",borderRadius:8,padding:"10px 14px",fontSize:12}}>
      <p style={{color:"#94A3B8",marginBottom:6,fontWeight:600}}>{label}</p>
      {payload.map((p,i)=>(
        <div key={i} style={{color:p.color,marginBottom:3}}>{p.name}: <strong>{fmt(p.value)}</strong></div>
      ))}
    </div>
  );
};

const KpiCard = ({label,real,fc,color,icon}) => {
  const diff = pctDiff(real,fc);
  const ahead = diff>=0;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",
      display:"flex",flexDirection:"column",gap:8,borderTop:`3px solid ${color}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600}}>{label}</span>
        <span style={{fontSize:18}}>{icon}</span>
      </div>
      <div style={{fontSize:22,fontWeight:800,color,letterSpacing:"-0.02em"}}>{fmt(real)}</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:11,color:C.muted}}>FC: {fmt(fc)}</span>
        {diff!==null&&(
          <span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:20,
            background:ahead?"#22D3A020":"#F8717120",color:ahead?"#22D3A0":"#F87171"}}>
            {ahead?"▲":"▼"} {Math.abs(diff).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
};

export default function DREDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMonths, setSelectedMonths] = useState([0,1,2]);
  const [clientesSubTab, setClientesSubTab] = useState("resumo");

  const toggleMonth = i => {
    setSelectedMonths(prev =>
      prev.includes(i)
        ? prev.length>1 ? prev.filter(m=>m!==i) : prev
        : [...prev,i].sort()
    );
  };

  const idx = selectedMonths;
  const months = idx.map(i=>ALL_MONTHS[i]);
  const periodLabel = idx.length===3 ? "Jan–Mar 2026"
    : idx.map(i=>ALL_MONTHS[i]).join(", ")+" 2026";

  const fil = useMemo(()=>{
    const sl = key => idx.map(i=>rawData[key].re[i]);
    const sf = key => idx.map(i=>rawData[key].fc[i]);
    const rec_op_re=sl("rec_op"), rec_op_fc=sf("rec_op");
    const aporte_re=sl("aporte"), aporte_fc=sf("aporte");
    const custo_re=sl("custo"), custo_fc=sf("custo");
    const dfix_re=sl("desp_fix"), dfix_fc=sf("desp_fix");
    const dvar_re=sl("desp_var"), dvar_fc=sf("desp_var");
    const dfin_re=sl("desp_fin");
    const dtrib_re=sl("desp_trib"), dtrib_fc=sf("desp_trib");
    const totalDespRe=idx.map((_,j)=>custo_re[j]+dfix_re[j]+dvar_re[j]+dfin_re[j]+dtrib_re[j]);
    const totalDespFc=idx.map((_,j)=>custo_fc[j]+dfix_fc[j]+dvar_fc[j]+dtrib_fc[j]);
    const resultOpRe=idx.map((_,j)=>rec_op_re[j]-totalDespRe[j]);
    const resultOpFc=idx.map((_,j)=>rec_op_fc[j]-totalDespFc[j]);
    const resultTotRe=idx.map((_,j)=>resultOpRe[j]+aporte_re[j]);
    const resultTotFc=idx.map((_,j)=>resultOpFc[j]+aporte_fc[j]);
    const catDesp=Object.entries(rawCatDesp).map(([name,v])=>({name,value:Math.round(idx.reduce((a,i)=>a+v[i],0))})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value);
    const catRec=Object.entries(rawCatRec).map(([name,v])=>({name,value:Math.round(idx.reduce((a,i)=>a+v[i],0))})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value);
    const monthly=months.map((m,j)=>({mes:m,"Receita Real":Math.round(rec_op_re[j]),"Receita FC":Math.round(rec_op_fc[j]),"Despesa Real":Math.round(totalDespRe[j]),"Despesa FC":Math.round(totalDespFc[j])}));
    const resultChart=months.map((m,j)=>({mes:m,"Op. Real":Math.round(resultOpRe[j]),"Op. FC":Math.round(resultOpFc[j]),"c/ Aporte Real":Math.round(resultTotRe[j]),"c/ Aporte FC":Math.round(resultTotFc[j])}));
    const despBreak=months.map((m,j)=>({mes:m,"Custos Op.":Math.round(custo_re[j]),"Desp. Fixas":Math.round(dfix_re[j]),"Desp. Variáveis":Math.round(dvar_re[j]),"Desp. Financ.":Math.round(dfin_re[j]),"Tributos":Math.round(dtrib_re[j])}));
    const kpis={
      recOpRe:sum(rec_op_re),recOpFc:sum(rec_op_fc),
      aporteRe:sum(aporte_re),aporteFc:sum(aporte_fc),
      despRe:sum(totalDespRe),despFc:sum(totalDespFc),
      resultOpRe:sum(resultOpRe),resultOpFc:sum(resultOpFc),
      resultTotRe:sum(resultTotRe),resultTotFc:sum(resultTotFc),
      custoRe:sum(custo_re),custoFc:sum(custo_fc),
      dfixRe:sum(dfix_re),dfixFc:sum(dfix_fc),
      dvarRe:sum(dvar_re),dvarFc:sum(dvar_fc),
      dfinRe:sum(dfin_re),dtribRe:sum(dtrib_re),dtribFc:sum(dtrib_fc),
    };
    return {kpis,monthly,resultChart,despBreak,catDesp,catRec,rec_op_re,rec_op_fc,aporte_re,aporte_fc,totalDespRe,totalDespFc,resultOpRe,resultOpFc,resultTotRe,resultTotFc};
  },[selectedMonths]);

  const {kpis}=fil;
  const tabs=[{id:"overview",label:"📊 Overview"},{id:"receitas",label:"💚 Receitas"},{id:"despesas",label:"🔴 Despesas"},{id:"resultado",label:"💰 Resultado"},{id:"clientes",label:"👥 Clientes"},{id:"recorrencia",label:"🔁 Recorrência"}];

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",padding:"24px",boxSizing:"border-box"}}>

      {/* HEADER */}
      <div style={{marginBottom:20,borderBottom:`1px solid ${C.border}`,paddingBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12,marginBottom:16}}>
          <div>
            <div style={{fontSize:11,color:C.muted,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:4}}>DRE • Líderes do Brasil</div>
            <h1 style={{margin:0,fontSize:24,fontWeight:800,letterSpacing:"-0.03em"}}>
              Painel Financeiro <span style={{color:C.rec}}>{periodLabel}</span>
            </h1>
          </div>
          <div style={{background:"#22D3A015",border:"1px solid #22D3A030",borderRadius:8,padding:"6px 14px",fontSize:11,color:"#22D3A0",fontWeight:600,alignSelf:"flex-start"}}>
            ● Realizado + Confirmado
          </div>
        </div>

        {/* ── FILTRO DE MÊS ── */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 16px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginRight:2}}>
              🗓 Filtrar período:
            </span>
            {ALL_MONTHS.map((m,i)=>{
              const active=selectedMonths.includes(i);
              return (
                <button key={m} onClick={()=>toggleMonth(i)} style={{
                  padding:"6px 20px",borderRadius:20,border:`1px solid ${active?C.rec:C.border}`,
                  cursor:"pointer",fontSize:13,fontWeight:700,
                  background:active?C.rec+"22":"transparent",
                  color:active?C.rec:C.muted,transition:"all 0.18s",
                }}>
                  {m}
                </button>
              );
            })}
            <button onClick={()=>setSelectedMonths([0,1,2])} style={{
              padding:"6px 16px",borderRadius:20,border:`1px solid ${C.border}`,
              cursor:"pointer",fontSize:12,fontWeight:600,background:"transparent",color:C.muted,
            }}>
              Todos
            </button>

            {/* pills resumo */}
            <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:11,padding:"4px 10px",borderRadius:12,background:C.rec+"15",color:C.rec,fontWeight:600}}>
                Rec {fmt(kpis.recOpRe)}
              </span>
              <span style={{fontSize:11,padding:"4px 10px",borderRadius:12,background:C.desp+"15",color:C.desp,fontWeight:600}}>
                Desp {fmt(kpis.despRe)}
              </span>
              <span style={{fontSize:11,padding:"4px 10px",borderRadius:12,
                background:kpis.resultOpRe>=0?"#FBBF2415":"#F8717115",
                color:kpis.resultOpRe>=0?"#FBBF24":"#F87171",fontWeight:600}}>
                Result {fmt(kpis.resultOpRe)}
              </span>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
              padding:"6px 16px",borderRadius:20,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,
              background:activeTab===t.id?C.rec:C.card,
              color:activeTab===t.id?"#0B0F1A":C.muted,transition:"all 0.2s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* OVERVIEW */}
      {activeTab==="overview"&&(
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:12}}>
            <KpiCard label="Receita Operacional" real={kpis.recOpRe} fc={kpis.recOpFc} color={C.rec} icon="📈"/>
            <KpiCard label="Aporte de Capital" real={kpis.aporteRe} fc={kpis.aporteFc} color={C.aporte} icon="💼"/>
            <KpiCard label="Total Despesas" real={kpis.despRe} fc={kpis.despFc} color={C.desp} icon="📉"/>
            <KpiCard label="Result. Operacional" real={kpis.resultOpRe} fc={kpis.resultOpFc} color="#FBBF24" icon="⚡"/>
            <KpiCard label="Result. c/ Aporte" real={kpis.resultTotRe} fc={kpis.resultTotFc} color="#A78BFA" icon="💰"/>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            <h3 style={{margin:"0 0 16px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Receita vs Despesa — Realizado × Forecast</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fil.monthly} barCategoryGap="25%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45"/>
                <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:12}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11,color:C.muted}}/>
                <Bar dataKey="Receita Real" fill={C.rec} radius={[4,4,0,0]}/>
                <Bar dataKey="Receita FC" fill={C.recFc} radius={[4,4,0,0]}/>
                <Bar dataKey="Despesa Real" fill={C.desp} radius={[4,4,0,0]}/>
                <Bar dataKey="Despesa FC" fill={C.despFc} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            <h3 style={{margin:"0 0 16px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Evolução do Resultado</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={fil.resultChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45"/>
                <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:12}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11,color:C.muted}}/>
                <ReferenceLine y={0} stroke="#FFFFFF20" strokeDasharray="4 4"/>
                <Line type="monotone" dataKey="c/ Aporte Real" stroke="#A78BFA" strokeWidth={2.5} dot={{r:5,fill:"#A78BFA"}}/>
                <Line type="monotone" dataKey="c/ Aporte FC" stroke="#A78BFA44" strokeWidth={2} strokeDasharray="5 5" dot={false}/>
                <Line type="monotone" dataKey="Op. Real" stroke="#FBBF24" strokeWidth={2.5} dot={{r:5,fill:"#FBBF24"}}/>
                <Line type="monotone" dataKey="Op. FC" stroke="#FBBF2444" strokeWidth={2} strokeDasharray="5 5" dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* RECEITAS */}
      {activeTab==="receitas"&&(
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
            <KpiCard label="Receita Op." real={kpis.recOpRe} fc={kpis.recOpFc} color={C.rec} icon="📈"/>
            <KpiCard label="Aporte" real={kpis.aporteRe} fc={kpis.aporteFc} color={C.aporte} icon="💼"/>
            <KpiCard label="Receita Total" real={kpis.recOpRe+kpis.aporteRe} fc={kpis.recOpFc+kpis.aporteFc} color="#34D399" icon="💵"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <h3 style={{margin:"0 0 16px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Receita Op. por Mês</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={months.map((m,j)=>({mes:m,Realizado:Math.round(fil.rec_op_re[j]),Forecast:Math.round(fil.rec_op_fc[j])}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45"/>
                  <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:12}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={fmtK} tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11}}/>
                  <Bar dataKey="Realizado" fill={C.rec} radius={[4,4,0,0]}/>
                  <Bar dataKey="Forecast" fill={C.recFc} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <h3 style={{margin:"0 0 16px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Composição Receita</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={fil.catRec} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} fontSize={10}>
                    {fil.catRec.map((_,i)=><Cell key={i} fill={PIE_R[i%PIE_R.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v=>fmt(v)}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            <h3 style={{margin:"0 0 16px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Aporte — Realizado × Forecast</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={months.map((m,j)=>({mes:m,Realizado:Math.round(fil.aporte_re[j]),Forecast:Math.round(fil.aporte_fc[j])}))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45"/>
                <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:12}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="Realizado" fill={C.aporte} radius={[4,4,0,0]}/>
                <Bar dataKey="Forecast" fill={C.aporte+"44"} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* DESPESAS */}
      {activeTab==="despesas"&&(
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12}}>
            {[{label:"Custos Op.",re:kpis.custoRe,fc:kpis.custoFc,color:"#FB923C"},{label:"Desp. Fixas",re:kpis.dfixRe,fc:kpis.dfixFc,color:"#A78BFA"},{label:"Desp. Variáveis",re:kpis.dvarRe,fc:kpis.dvarFc,color:"#FBBF24"},{label:"Desp. Financeiras",re:kpis.dfinRe,fc:0,color:"#60A5FA"},{label:"Tributos",re:kpis.dtribRe,fc:kpis.dtribFc,color:"#94A3B8"}].map(k=><KpiCard key={k.label} label={k.label} real={k.re} fc={k.fc} color={k.color} icon="📌"/>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <h3 style={{margin:"0 0 16px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Composição Despesas (Empilhado)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={fil.despBreak}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45"/>
                  <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:12}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={fmtK} tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:10}}/>
                  <Bar dataKey="Custos Op." stackId="a" fill="#FB923C"/>
                  <Bar dataKey="Desp. Fixas" stackId="a" fill="#A78BFA"/>
                  <Bar dataKey="Desp. Variáveis" stackId="a" fill="#FBBF24"/>
                  <Bar dataKey="Desp. Financ." stackId="a" fill="#60A5FA"/>
                  <Bar dataKey="Tributos" stackId="a" fill="#94A3B8" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <h3 style={{margin:"0 0 16px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Top Categorias</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={fil.catDesp} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name,percent})=>`${(percent*100).toFixed(0)}%`} fontSize={10}>
                    {fil.catDesp.map((_,i)=><Cell key={i} fill={PIE_D[i%PIE_D.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v=>fmt(v)}/><Legend wrapperStyle={{fontSize:10}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            <h3 style={{margin:"0 0 16px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Total Despesas — Realizado × Forecast</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={months.map((m,j)=>({mes:m,Realizado:Math.round(fil.totalDespRe[j]),Forecast:Math.round(fil.totalDespFc[j])}))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45"/>
                <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:12}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="Realizado" fill={C.desp} radius={[4,4,0,0]}/>
                <Bar dataKey="Forecast" fill={C.despFc} radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* RESULTADO */}
      {activeTab==="resultado"&&(
        <div style={{display:"flex",flexDirection:"column",gap:20}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
            <KpiCard label="Result. Operacional" real={kpis.resultOpRe} fc={kpis.resultOpFc} color="#FBBF24" icon="⚡"/>
            <KpiCard label="Result. c/ Aporte" real={kpis.resultTotRe} fc={kpis.resultTotFc} color="#A78BFA" icon="💰"/>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            <h3 style={{margin:"0 0 16px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Resultado Mensal — Operacional × c/ Aporte</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={months.map((m,j)=>({mes:m,"Op. Realizado":Math.round(fil.resultOpRe[j]),"Op. Forecast":Math.round(fil.resultOpFc[j]),"c/ Aporte Realizado":Math.round(fil.resultTotRe[j]),"c/ Aporte Forecast":Math.round(fil.resultTotFc[j])}))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45"/>
                <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:12}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={fmtK} tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11}}/>
                <ReferenceLine y={0} stroke="#FFFFFF30"/>
                <Bar dataKey="Op. Realizado" fill="#FBBF24" radius={[4,4,0,0]}/>
                <Bar dataKey="Op. Forecast" fill="#FBBF2433" radius={[4,4,0,0]}/>
                <Bar dataKey="c/ Aporte Realizado" fill="#A78BFA" radius={[4,4,0,0]}/>
                <Bar dataKey="c/ Aporte Forecast" fill="#A78BFA44" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            <h3 style={{margin:"0 0 16px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Resumo DRE — {periodLabel}</h3>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr>{["Linha","Forecast","Realizado","Δ Valor","Δ %"].map(h=>(
                  <th key={h} style={{textAlign:h==="Linha"?"left":"right",padding:"8px 12px",color:C.muted,fontSize:11,fontWeight:700,borderBottom:`1px solid ${C.border}`,textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {[
                  {label:"Receita Operacional",re:kpis.recOpRe,fc:kpis.recOpFc,color:C.rec},
                  {label:"Aporte de Capital",re:kpis.aporteRe,fc:kpis.aporteFc,color:C.aporte},
                  {label:"Total Despesas + Custos",re:kpis.despRe,fc:kpis.despFc,color:C.desp,neg:true},
                  {label:"Resultado Operacional",re:kpis.resultOpRe,fc:kpis.resultOpFc,color:"#FBBF24",bold:true},
                  {label:"Resultado c/ Aporte",re:kpis.resultTotRe,fc:kpis.resultTotFc,color:"#A78BFA",bold:true},
                ].map((r,i)=>{
                  const delta=r.re-r.fc;
                  const dp=r.fc?(delta/Math.abs(r.fc)*100):null;
                  const isGood=r.neg?delta<=0:delta>=0;
                  return (
                    <tr key={i} style={{borderBottom:`1px solid ${C.border}20`,background:i%2?"#FFFFFF05":"transparent"}}>
                      <td style={{padding:"10px 12px",color:r.color,fontWeight:r.bold?700:400}}>{r.label}</td>
                      <td style={{padding:"10px 12px",textAlign:"right",color:C.muted}}>{fmt(r.fc)}</td>
                      <td style={{padding:"10px 12px",textAlign:"right",color:r.color,fontWeight:r.bold?700:400}}>{fmt(r.re)}</td>
                      <td style={{padding:"10px 12px",textAlign:"right",color:isGood?"#22D3A0":"#F87171"}}>{delta>=0?"+":""}{fmt(delta)}</td>
                      <td style={{padding:"10px 12px",textAlign:"right"}}>
                        {dp!==null&&<span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:isGood?"#22D3A015":"#F8717115",color:isGood?"#22D3A0":"#F87171"}}>{delta>=0?"▲":"▼"} {Math.abs(dp).toFixed(1)}%</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CLIENTES */}
      {activeTab==="clientes"&&(()=>{
        const subTab = clientesSubTab;
        const setSubTab = setClientesSubTab;
        const PROD_COLORS = { Master:"#60A5FA", Premium:"#A78BFA", Essecial:"#22D3A0", "Sem produto":"#64748B" };
        const prodPill = (p) => (
          <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,fontWeight:700,
            background: PROD_COLORS[p]+"22", color: PROD_COLORS[p]||"#94A3B8"}}>
            {p||"—"}
          </span>
        );
        const MiniCard = ({label, value, sub, color}) => (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px",
            borderTop:`3px solid ${color}`}}>
            <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600,marginBottom:6}}>{label}</div>
            <div style={{fontSize:28,fontWeight:800,color,letterSpacing:"-0.02em"}}>{value}</div>
            {sub&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>{sub}</div>}
          </div>
        );
        const subTabs = [
          {id:"resumo",label:"📋 Resumo"},
          {id:"novas",label:"🟢 Novas Entradas"},
          {id:"pendentes",label:"⚠️ Atenção"},
          {id:"pagamento",label:"💳 Formas de Pagto"},
        ];
        const ClienteTable = ({data, cols}) => (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr>{cols.map(c=>(
                <th key={c.key} style={{textAlign:"left",padding:"8px 10px",color:C.muted,fontSize:10,
                  fontWeight:700,borderBottom:`1px solid ${C.border}`,textTransform:"uppercase",letterSpacing:"0.08em"}}>
                  {c.label}
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {data.map((r,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${C.border}15`,background:i%2?"#FFFFFF04":"transparent"}}>
                  {cols.map(c=>(
                    <td key={c.key} style={{padding:"8px 10px",color:c.key==="produto"?undefined:C.text}}>
                      {c.key==="produto" ? prodPill(r[c.key]) : r[c.key]||"—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
        return (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {/* sub-tabs */}
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {subTabs.map(t=>(
                <button key={t.id} onClick={()=>setSubTab(t.id)} style={{
                  padding:"5px 14px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                  background:subTab===t.id?"#60A5FA":C.card,
                  color:subTab===t.id?"#0B0F1A":C.muted,transition:"all 0.2s",
                }}>{t.label}</button>
              ))}
            </div>

            {/* RESUMO */}
            {subTab==="resumo"&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
                  <MiniCard label="Total Clientes" value={CLIENTES.total} sub="base ativa" color="#60A5FA"/>
                  <MiniCard label="Master" value={CLIENTES.por_produto.Master} sub={`${((CLIENTES.por_produto.Master/CLIENTES.total)*100).toFixed(0)}% da base`} color="#60A5FA"/>
                  <MiniCard label="Premium" value={CLIENTES.por_produto.Premium} sub={`${((CLIENTES.por_produto.Premium/CLIENTES.total)*100).toFixed(0)}% da base`} color="#A78BFA"/>
                  <MiniCard label="Essecial" value={CLIENTES.por_produto.Essecial} sub={`${((CLIENTES.por_produto.Essecial/CLIENTES.total)*100).toFixed(0)}% da base`} color="#22D3A0"/>
                  <MiniCard label="Vencidos" value={CLIENTES.vencidos_count} sub="contratos vencidos" color="#F87171"/>
                  <MiniCard label="Atrasados" value={CLIENTES.atrasados_count} sub="mensalidades em atraso" color="#FB923C"/>
                  <MiniCard label="Sem Data" value={CLIENTES.sem_data_count} sub="sem data de início" color="#FBBF24"/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                    <h3 style={{margin:"0 0 14px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Distribuição por Produto</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={Object.entries(CLIENTES.por_produto).filter(([,v])=>v>0).map(([k,v])=>({name:k,value:v}))}
                          dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                          label={({name,value,percent})=>`${name}: ${value} (${(percent*100).toFixed(0)}%)`} fontSize={10}>
                          {Object.keys(CLIENTES.por_produto).map((k,i)=>(
                            <Cell key={i} fill={PROD_COLORS[k]||"#64748B"}/>
                          ))}
                        </Pie>
                        <Tooltip/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                    <h3 style={{margin:"0 0 14px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>Alertas de Atenção</h3>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {[
                        {label:"🔴 Vencidos",count:CLIENTES.vencidos_count,color:"#F87171",names:CLIENTES.vencidos.map(v=>v.nome)},
                        {label:"🟡 Atrasados",count:CLIENTES.atrasados_count,color:"#FB923C",names:CLIENTES.atrasados.map(v=>v.nome)},
                        {label:"⚪ Sem data início",count:CLIENTES.sem_data_count,color:"#FBBF24",names:[]},
                      ].map((item,i)=>(
                        <div key={i} style={{background:"#FFFFFF08",borderRadius:8,padding:"10px 14px",borderLeft:`3px solid ${item.color}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom: item.names.length ? 6 : 0}}>
                            <span style={{fontSize:12,fontWeight:700,color:item.color}}>{item.label}</span>
                            <span style={{fontSize:18,fontWeight:800,color:item.color}}>{item.count}</span>
                          </div>
                          {item.names.length>0&&(
                            <div style={{fontSize:10,color:C.muted,lineHeight:1.6}}>
                              {item.names.join(" • ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NOVAS ENTRADAS */}
            {subTab==="novas"&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  {[
                    {mes:"Janeiro 2026", count:CLIENTES.jan_count, data:CLIENTES.jan, color:"#22D3A0"},
                    {mes:"Fevereiro 2026", count:CLIENTES.fev_count, data:CLIENTES.fev, color:"#60A5FA"},
                  ].map(({mes,count,data,color})=>(
                    <div key={mes} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,borderTop:`3px solid ${color}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                        <h3 style={{margin:0,fontSize:13,color:C.text,fontWeight:700}}>📅 {mes}</h3>
                        <span style={{fontSize:22,fontWeight:800,color}}>{count} novos</span>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {data.map((c,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                            padding:"6px 10px",borderRadius:6,background:"#FFFFFF06"}}>
                            <span style={{fontSize:12,color:C.text}}>{c.nome}</span>
                            {prodPill(c.produto)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                  <h3 style={{margin:"0 0 14px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>
                    ⚠️ Sem data de início — {CLIENTES.sem_data_count} clientes
                  </h3>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:6}}>
                    {CLIENTES.sem_data.map((c,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                        padding:"6px 10px",borderRadius:6,background:"#FBBF2408",border:"1px solid #FBBF2420"}}>
                        <span style={{fontSize:12,color:C.text}}>{c.nome}</span>
                        {prodPill(c.produto)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ATENÇÃO: VENCIDOS + ATRASADOS */}
            {subTab==="pendentes"&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,borderTop:"3px solid #F87171"}}>
                  <h3 style={{margin:"0 0 14px",fontSize:13,color:"#F87171",fontWeight:700}}>🔴 Clientes Vencidos — {CLIENTES.vencidos_count}</h3>
                  <ClienteTable data={CLIENTES.vencidos} cols={[{key:"nome",label:"Cliente"},{key:"produto",label:"Produto"},{key:"pagamento",label:"Pagamento"},{key:"inicio",label:"Início"}]}/>
                </div>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,borderTop:"3px solid #FB923C"}}>
                  <h3 style={{margin:"0 0 14px",fontSize:13,color:"#FB923C",fontWeight:700}}>🟡 Atrasados — {CLIENTES.atrasados_count}</h3>
                  <ClienteTable data={CLIENTES.atrasados} cols={[{key:"nome",label:"Cliente"},{key:"produto",label:"Produto"},{key:"status",label:"Status"}]}/>
                </div>
              </div>
            )}

            {/* FORMAS DE PAGAMENTO */}
            {subTab==="pagamento"&&(
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  {[
                    {label:"12x Cartão de Crédito", count:CLIENTES.cc_count, por_produto:CLIENTES.cc_por_produto, clientes:CLIENTES.cc_clientes, color:"#A78BFA"},
                    {label:"12x Boleto", count:CLIENTES.boleto_count, por_produto:CLIENTES.boleto_por_produto, clientes:CLIENTES.boleto_clientes, color:"#60A5FA"},
                  ].map(({label,count,por_produto,clientes,color})=>(
                    <div key={label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,borderTop:`3px solid ${color}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                        <h3 style={{margin:0,fontSize:13,color:C.text,fontWeight:700}}>💳 {label}</h3>
                        <span style={{fontSize:22,fontWeight:800,color}}>{count}</span>
                      </div>
                      {/* por produto */}
                      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                        {Object.entries(por_produto).map(([prod,cnt])=>(
                          <div key={prod} style={{padding:"4px 12px",borderRadius:20,
                            background:PROD_COLORS[prod]+"22",border:`1px solid ${PROD_COLORS[prod]}44`,
                            fontSize:12,fontWeight:700,color:PROD_COLORS[prod]}}>
                            {prod}: {cnt}
                          </div>
                        ))}
                      </div>
                      {/* lista clientes */}
                      <div style={{maxHeight:320,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                        {clientes.map((c,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                            padding:"5px 10px",borderRadius:6,background:"#FFFFFF05",fontSize:11}}>
                            <span style={{color:C.text}}>{c.nome}</span>
                            {prodPill(c.produto)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* RECORRÊNCIA */}
      {activeTab==="recorrencia"&&(()=>{
        const PROD_COLORS = { Master:"#60A5FA", Premium:"#A78BFA", Essecial:"#22D3A0" };
        const prodPill = (p) => (
          <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,fontWeight:700,
            background:(PROD_COLORS[p]||"#64748B")+"22",color:PROD_COLORS[p]||"#94A3B8"}}>
            {p||"—"}
          </span>
        );
        const totalCC  = RECORRENCIA.cc.reduce((a,c)=>a+c.valor,0);
        const totalBol = RECORRENCIA.boleto.reduce((a,c)=>a+c.valor,0);
        const total    = totalCC + totalBol;
        const totalAnual = total * 12;
        const todos = [...RECORRENCIA.cc, ...RECORRENCIA.boleto];
        const porProd = {};
        todos.forEach(c=>{
          if(!porProd[c.produto]) porProd[c.produto]={count:0,valor:0};
          porProd[c.produto].count++;
          porProd[c.produto].valor+=c.valor;
        });
        const pieData = Object.entries(porProd).map(([name,d])=>({name,value:d.valor,count:d.count}));
        const produtosUnicos = [...new Set(todos.map(c=>c.produto))];
        const barData = produtosUnicos.map(prod=>({
          produto: prod,
          "Cartao": RECORRENCIA.cc.filter(c=>c.produto===prod).reduce((a,c)=>a+c.valor,0),
          "Boleto": RECORRENCIA.boleto.filter(c=>c.produto===prod).reduce((a,c)=>a+c.valor,0),
        }));
        return (
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {/* KPI CARDS */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12}}>
              {[
                {label:"Total Recorrência/mês", valor:total,      color:"#22D3A0", icon:"🔁", sub:`${todos.filter(c=>c.valor>0).length} clientes ativos`},
                {label:"12x Cartão de Crédito", valor:totalCC,    color:"#A78BFA", icon:"💳", sub:`${RECORRENCIA.cc.length} clientes`},
                {label:"12x Boleto",            valor:totalBol,   color:"#60A5FA", icon:"📋", sub:`${RECORRENCIA.boleto.length} clientes`},
                {label:"Recorrência Anual",     valor:totalAnual, color:"#FBBF24", icon:"📅", sub:"projeção 12 meses"},
              ].map(({label,valor,color,icon,sub})=>(
                <div key={label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,
                  padding:"16px 20px",display:"flex",flexDirection:"column",gap:6,borderTop:`3px solid ${color}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:11,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",fontWeight:600}}>{label}</span>
                    <span style={{fontSize:18}}>{icon}</span>
                  </div>
                  <div style={{fontSize:22,fontWeight:800,color,letterSpacing:"-0.02em"}}>{fmt(valor)}</div>
                  <div style={{fontSize:11,color:C.muted}}>{sub}</div>
                </div>
              ))}
            </div>

            {/* GRAFICOS */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <h3 style={{margin:"0 0 14px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>
                  Recorrência por Produto
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                      label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} fontSize={10}>
                      {pieData.map((entry,i)=>(
                        <Cell key={i} fill={PROD_COLORS[entry.name]||"#94A3B8"}/>
                      ))}
                    </Pie>
                    <Tooltip formatter={v=>fmt(v)}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <h3 style={{margin:"0 0 14px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>
                  Cartão vs Boleto por Produto
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2D45"/>
                    <XAxis dataKey="produto" tick={{fill:C.muted,fontSize:12}} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={fmtK} tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                    <Tooltip content={<Tip/>}/><Legend wrapperStyle={{fontSize:11}}/>
                    <Bar dataKey="Cartao" name="Cartão" fill="#A78BFA" radius={[4,4,0,0]}/>
                    <Bar dataKey="Boleto" fill="#60A5FA" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* RESUMO POR PRODUTO */}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
              <h3 style={{margin:"0 0 14px",fontSize:12,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em"}}>
                Resumo por Produto
              </h3>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}>
                {Object.entries(porProd).sort((a,b)=>b[1].valor-a[1].valor).map(([prod,{count,valor}])=>(
                  <div key={prod} style={{background:"#FFFFFF06",borderRadius:10,padding:"14px 16px",
                    borderLeft:`3px solid ${PROD_COLORS[prod]||"#94A3B8"}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      {prodPill(prod)}
                      <span style={{fontSize:12,color:C.muted,fontWeight:600}}>{count} clientes</span>
                    </div>
                    <div style={{fontSize:22,fontWeight:800,color:PROD_COLORS[prod]||"#94A3B8"}}>{fmt(valor)}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:4}}>{fmt(valor*12)}/ano</div>
                  </div>
                ))}
              </div>
            </div>

            {/* TABELAS DETALHADAS */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {[
                {label:"💳 12x Cartão de Crédito", color:"#A78BFA", data:RECORRENCIA.cc,    subtotal:totalCC},
                {label:"📋 12x Boleto",            color:"#60A5FA", data:RECORRENCIA.boleto, subtotal:totalBol},
              ].map(({label,color,data,subtotal})=>(
                <div key={label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,borderTop:`3px solid ${color}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <h3 style={{margin:0,fontSize:13,color:C.text,fontWeight:700}}>{label}</h3>
                    <span style={{fontSize:18,fontWeight:800,color}}>{fmt(subtotal)}</span>
                  </div>
                  <div style={{maxHeight:360,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                    {data.map((c,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                        padding:"7px 10px",borderRadius:6,background:"#FFFFFF05",gap:8}}>
                        <span style={{fontSize:11,color:C.text,flex:1,minWidth:0,overflow:"hidden",
                          textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.nome}</span>
                        <span style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                          {prodPill(c.produto)}
                          <span style={{fontSize:12,fontWeight:700,
                            color:c.valor>0?color:C.muted,minWidth:72,textAlign:"right"}}>
                            {c.valor>0?fmt(c.valor):"⚠️ s/ valor"}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,
                    display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:C.muted}}>
                      {data.length} clientes · {data.filter(c=>c.valor>0).length} com valor
                    </span>
                    <span style={{fontSize:12,fontWeight:700,color}}>{fmt(subtotal)}/mês</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div style={{marginTop:28,paddingTop:14,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <span style={{fontSize:10,color:C.muted}}>Líderes do Brasil • Meu Dinheiro + Forecast LdB</span>
        <span style={{fontSize:10,color:C.muted}}>Mar 2026 parcial — apenas lançamentos conciliados disponíveis</span>
      </div>
    </div>
  );
}
