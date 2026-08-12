// PageBotWhatsapp.jsx — Tela "Bot WhatsApp" na conta do cliente
// Aparece após "Fluxo Financeiro" no menu do planejador
// Abas: Conexão | Lembretes | Limites & Metas | Mensagens
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Smartphone, Link2, Bell, Target, MessageCircle, Mic, Image, FileText, Video, Trash2, RefreshCw, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { C, RADIUS } from '../design/tokens.js';
import { GRUPOS, CATEGORIAS_PADRAO } from '../data/categorias.js';
import { supabase } from '../lib/supabase.js';
import { isFaturaAnterior } from '../utils/parser.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const FONT = { xs: '13px', sm: '14px', md: '16px' };

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const today = () => new Date().toLocaleDateString('pt-BR');

// ── Componente principal ──────────────────────────────────────────────────────
const ABAS_BOT = [
  { id: 'conexao',   label: 'Conexão',        Icon: Link2 },
  { id: 'lembretes', label: 'Lembretes',       Icon: Bell },
  { id: 'limites',   label: 'Limites & Metas', Icon: Target },
  { id: 'mensagens', label: 'Mensagens',       Icon: MessageCircle },
];

export default function PageBotWhatsapp() {
  const { clienteAtivo, setClienteAtivo } = useApp();
  const [abaAtiva, setAbaAtiva] = useState('conexao');

  if (!clienteAtivo) return null;

  const abas = ABAS_BOT;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 32px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Smartphone size={22} /> Bot WhatsApp
        </h1>
        <p style={{ fontSize: FONT.xs, color: C.textMuted, margin: '6px 0 0', lineHeight: 1.5 }}>
          Capture despesas, envie resumos e configure alertas direto pelo WhatsApp.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 28 }}>
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAbaAtiva(a.id)}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: abaAtiva === a.id ? `2px solid ${C.brand}` : '2px solid transparent',
              color: abaAtiva === a.id ? C.brand : C.textMuted,
              fontWeight: abaAtiva === a.id ? 700 : 500,
              fontSize: FONT.sm,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              whiteSpace: 'nowrap',
            }}
          ><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><a.Icon size={13} />{a.label}</span></button>
        ))}
      </div>

      {/* Conteúdo das abas */}
      {abaAtiva === 'conexao'   && <AbaConexao />}
      {abaAtiva === 'lembretes' && <AbaLembretes />}
      {abaAtiva === 'limites'   && <AbaLimitesMetas />}
      {abaAtiva === 'mensagens' && <AbaMensagens />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA: CONEXÃO
// ─────────────────────────────────────────────────────────────────────────────
function AbaConexao() {
  const { clienteAtivo, setClienteAtivo } = useApp();
  const bot = clienteAtivo.botWhatsapp || {};

  // ── Estado da lista de números ────────────────────────────────────────────
  const [numeros, setNumeros]           = useState([]);
  const [loadingNumeros, setLoading]    = useState(false);

  // ── Formulário: adicionar número ──────────────────────────────────────────
  const [novoNome, setNovoNome]         = useState('');
  const [novoTel,  setNovoTel]          = useState('');
  const [salvando, setSalvando]         = useState(false);
  const [erro,     setErro]             = useState('');
  const [ok,       setOk]               = useState('');

  // ── Carregar lista do Supabase ────────────────────────────────────────────
  const recarregar = useCallback(async () => {
    if (!clienteAtivo?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('cliente_telefones')
      .select('id, telefone, nome, ativo, criado_em')
      .eq('cliente_id', clienteAtivo.id)
      .order('criado_em', { ascending: true });
    setNumeros((data || []).filter(n => n.ativo));
    setLoading(false);
  }, [clienteAtivo?.id]);

  useEffect(() => { recarregar(); }, [recarregar]);

  // ── Normalizar telefone → sempre com prefixo 55 (igual ao webhook) ─────────
  // Cobre todos os casos brasileiros:
  //   • 13 dígitos com 55  → mantém      (5561998934546)
  //   • 12 dígitos com 55  → mantém      (556198934546)
  //   • 11 dígitos sem 55  → adiciona 55 (61998934546 → 5561998934546)
  //   • 10 dígitos sem 55  → adiciona 55 (6198934546  → 556198934546)
  //   • 12 dígitos sem 55  → adiciona 55 (caso incomum: DDI outro país)
  const normalizarTel = (raw) => {
    const n = String(raw).replace(/\D/g, '');
    if (n.startsWith('55') && n.length >= 12) return n;   // já tem DDI BR
    if (n.length >= 10 && n.length <= 12)     return '55' + n; // adiciona DDI
    return n;
  };

  // ── Adicionar / vincular número ───────────────────────────────────────────
  const adicionarNumero = async () => {
    setErro(''); setOk('');
    const raw    = novoTel.replace(/\D/g, '');
    const numero = normalizarTel(raw);  // garante prefixo 55
    const nome   = novoNome.trim();
    if (!nome)                          { setErro('Informe o nome do titular.'); return; }
    if (!raw || raw.length < 10)        { setErro('Número inválido. Informe DDD + número (ex.: 61 99999-9999).'); return; }
    // Valida comprimento final após normalizar
    if (numero.length < 12 || numero.length > 13) { setErro('Número inválido. Verifique o DDD e os dígitos.'); return; }

    setSalvando(true);

    // 1) Garante que existe uma bot_sessions ativa para este cliente.
    //    Sempre verifica — independente de quantos números já existem —
    //    pois o 2º, 3º número do mesmo cliente também precisa da sessão ativa.
    {
      // Bug fix: busca planejador_id SEMPRE, não só no primeiro número
      const { data: clienteDB } = await supabase
        .from('clientes').select('planejador_id').eq('id', clienteAtivo.id).maybeSingle();

      const planejadorId = clienteDB?.planejador_id ?? null;

      // Verifica se já existe sessão (ativa ou inativa) para reativar em vez de duplicar
      const { data: sessaoExistente } = await supabase
        .from('bot_sessions')
        .select('id, ativo')
        .eq('cliente_id', clienteAtivo.id)
        .maybeSingle();

      if (sessaoExistente?.id) {
        // Reativa sessão existente se estiver inativa (ou apenas atualiza telefone)
        if (!sessaoExistente.ativo) {
          await supabase.from('bot_sessions')
            .update({ telefone: numero, ativo: true, atualizado_em: new Date().toISOString() })
            .eq('id', sessaoExistente.id);
        }
      } else {
        // Bug fix: valida planejadorId antes do insert (coluna assessor_id é NOT NULL)
        if (!planejadorId) {
          console.error('[bot_sessions] planejador_id não encontrado para cliente', clienteAtivo.id);
          setErro('Erro interno: planejador não encontrado. Contate o suporte.');
          setSalvando(false);
          return;
        }
        // Cria nova sessão com cliente_id como chave natural
        const { error: sessErr } = await supabase.from('bot_sessions').insert({
          telefone: numero,
          cliente_id: clienteAtivo.id,
          assessor_id: planejadorId,
          ativo: true,
          primeira_msg_enviada: false,
        });
        if (sessErr) {
          console.error('[bot_sessions] insert:', sessErr.message);
          setErro('Erro ao ativar o bot: ' + sessErr.message);
          setSalvando(false);
          return;
        }
      }

      // Atualiza estado local do cliente para mostrar "Conectado"
      setClienteAtivo({
        ...clienteAtivo,
        botWhatsapp: { ...bot, telefone: numero, ativo: true, vinculadoEm: today() },
      });
    }

    // 2) cliente_telefones — lookup do webhook para identificar o remetente.
    //    Usa upsert por (cliente_id, telefone) para não criar duplicatas nem sobrescrever
    //    entradas de outros clientes com o mesmo número (número compartilhado é raro
    //    mas deve ser tratado de forma isolada por cliente).
    const { error } = await supabase.from('cliente_telefones').upsert({
      cliente_id: clienteAtivo.id,
      telefone: numero,   // sempre com 55
      nome,
      ativo: true,
    }, { onConflict: 'cliente_id,telefone', ignoreDuplicates: false });

    if (error) {
      setErro('Erro ao salvar: ' + error.message);
    } else {
      setNovoNome(''); setNovoTel('');
      setOk(`✅ ${nome} vinculado! (${numero})`);
      setTimeout(() => setOk(''), 4000);
      await recarregar();
    }
    setSalvando(false);
  };

  // ── Remover número ────────────────────────────────────────────────────────
  const removerNumero = async (id, numero, nome) => {
    setErro(''); setOk('');

    // Desativa APENAS este número em cliente_telefones (não mexe nos outros)
    await supabase.from('cliente_telefones').update({ ativo: false }).eq('id', id);

    // Verifica quantos números ativos sobram após a remoção
    const restantes = numeros.filter(n => n.ativo && n.id !== id);

    if (restantes.length === 0) {
      // Último número removido → desativa a sessão bot deste cliente
      await supabase.from('bot_sessions')
        .update({ ativo: false, atualizado_em: new Date().toISOString() })
        .eq('cliente_id', clienteAtivo.id)
        .eq('ativo', true); // só toca a sessão ativa, evita sobrescrever histórico
      setClienteAtivo({ ...clienteAtivo, botWhatsapp: { ...bot, ativo: false, telefone: '' } });
    } else {
      // Ainda há números → se o número removido era o telefone principal da sessão,
      // atualiza a sessão para usar o próximo número disponível
      const { data: sessao } = await supabase
        .from('bot_sessions')
        .select('id, telefone')
        .eq('cliente_id', clienteAtivo.id)
        .eq('ativo', true)
        .maybeSingle();
      if (sessao && sessao.telefone === numero) {
        await supabase.from('bot_sessions')
          .update({ telefone: restantes[0].telefone, atualizado_em: new Date().toISOString() })
          .eq('id', sessao.id);
      }
    }

    setOk(`${nome} removido.`);
    setTimeout(() => setOk(''), 3000);
    await recarregar();
  };

  // Bot está ativo se há pelo menos 1 número na lista
  const ativo        = numeros.length > 0;
  const numerosAtivos = numeros;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Status ─────────────────────────────────────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: ativo ? C.green : C.textDim,
          }} />
          <div>
            <span style={{ fontSize: FONT.sm, color: ativo ? C.green : C.textMuted, fontWeight: 700 }}>
              {ativo ? 'Conectado' : 'Desconectado'}
            </span>
            {ativo && (
              <span style={{ fontSize: FONT.xs, color: C.textMuted, marginLeft: 10 }}>
                {numerosAtivos.length} número{numerosAtivos.length !== 1 ? 's' : ''} vinculado{numerosAtivos.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* ── Lista + Adicionar ───────────────────────────────────────────────── */}
      <Card title="Números vinculados">
        <p style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
          Cada número tem um nome (ex.: João, Maria) que identifica quem fez o lançamento.
          O nome aparece na coluna <strong>Conta</strong> do fluxo financeiro.
          O primeiro número cadastrado ativa o bot.
        </p>

        {/* Lista */}
        {loadingNumeros ? (
          <div style={{ fontSize: FONT.xs, color: C.textMuted, padding: '8px 0' }}>Carregando...</div>
        ) : numerosAtivos.length === 0 ? (
          <div style={{
            fontSize: FONT.xs, color: C.textMuted, fontStyle: 'italic',
            background: C.bgMid, borderRadius: RADIUS.md, padding: '12px 16px', marginBottom: 16,
          }}>
            Nenhum número vinculado. Adicione abaixo para ativar o bot.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {numerosAtivos.map((n, i) => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: C.bgMid, borderRadius: RADIUS.md, padding: '10px 14px', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Smartphone size={18} color={C.brand} />
                  <div>
                    <div style={{ fontSize: FONT.sm, fontWeight: 600, color: C.text }}>{n.nome}</div>
                    <div style={{ fontSize: FONT.xs, color: C.textMuted }}>+55 {formatPhone(n.telefone)}</div>
                  </div>
                  {/* Badge "BOT ATIVO" no primeiro número (lista já vem ordenada por criado_em asc;
                      a sessão fica ativa enquanto houver pelo menos 1 número na lista) */}
                  {i === 0 && ativo && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, background: C.brand + '25',
                      color: C.brand, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap',
                    }}>BOT ATIVO</span>
                  )}
                </div>
                <button
                  onClick={() => removerNumero(n.id, n.telefone, n.nome)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: 18, padding: '2px 6px', lineHeight: 1 }}
                  title={`Remover ${n.nome}`}
                ><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Formulário adicionar */}
        <div style={{ borderTop: numerosAtivos.length > 0 ? `1px solid ${C.border}` : 'none', paddingTop: numerosAtivos.length > 0 ? 14 : 0 }}>
          <Label>Adicionar número</Label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <input
              type="text"
              placeholder="Nome (ex.: Maria)"
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && adicionarNumero()}
              style={{ ...inputStyle, minWidth: 140, flex: '1 1 140px' }}
            />
            <input
              type="tel"
              placeholder="(61) 99999-9999"
              value={novoTel}
              onChange={e => setNovoTel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && adicionarNumero()}
              style={{ ...inputStyle, minWidth: 160, flex: '1 1 160px' }}
            />
            <button
              onClick={adicionarNumero}
              disabled={salvando}
              style={btnStyle(C.brand, C.brand + '20')}
            >
              {salvando ? 'Salvando...' : '+ Vincular'}
            </button>
          </div>
          {erro && <div style={{ fontSize: FONT.xs, color: C.red,   marginTop: 8 }}>{erro}</div>}
          {ok   && <div style={{ fontSize: FONT.xs, color: C.green, marginTop: 8 }}>{ok}</div>}
        </div>
      </Card>

      {/* ── Como funciona ───────────────────────────────────────────────────── */}
      <Card title="Como o cliente usa o Bot">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { icon: '💬', t: 'Texto livre',   d: '"Gastei 45 no uber" → lançado automaticamente' },
            { icon: '📷', t: 'Foto de nota',  d: 'Foto do cupom ou boleto → OCR extrai o valor' },
            { icon: '🎙️', t: 'Áudio',         d: 'Mensagem de voz → transcrição + categorização' },
            { icon: '📄', t: 'Extrato PDF',   d: 'Upload do PDF → todas as transações importadas' },
            { icon: '📊', t: '"resumo"',       d: 'Bot envia resumo de gastos dos últimos 7 dias' },
            { icon: '❓', t: '"ajuda"',        d: 'Bot mostra as opções disponíveis' },
          ].map(({ icon, t, d }) => (
            <div key={t} style={{ background: C.bgMid, borderRadius: RADIUS.md, padding: '14px 16px' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: FONT.xs, fontWeight: 700, color: C.text, marginBottom: 4 }}>{t}</div>
              <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA: LEMBRETES
// ─────────────────────────────────────────────────────────────────────────────
function AbaLembretes() {
  const { clienteAtivo, setClienteAtivo } = useApp();
  const bot = clienteAtivo.botWhatsapp || {};
  const lembretes = bot.lembretes || defaultLembretes();
  const [novo, setNovo] = useState({ texto: '', dia: 1, horario: '09:00', ativo: true });
  const [adicionando, setAdicionando] = useState(false);

  const atualizar = (novoLembretes) => {
    setClienteAtivo({ ...clienteAtivo, botWhatsapp: { ...bot, lembretes: novoLembretes } });
  };

  const toggleLembrete = (id) => {
    atualizar(lembretes.map(l => l.id === id ? { ...l, ativo: !l.ativo } : l));
  };

  const removerLembrete = (id) => {
    atualizar(lembretes.filter(l => l.id !== id));
  };

  const adicionarNovo = () => {
    if (!novo.texto.trim()) return;
    atualizar([...lembretes, { ...novo, id: Date.now().toString() }]);
    setNovo({ texto: '', dia: 1, horario: '09:00', ativo: true });
    setAdicionando(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card title="Lembretes automáticos">
        <p style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
          O bot envia mensagens automáticas no dia e horário configurados. Use para lembrar o cliente
          de registrar gastos, enviar extrato ou confirmar reunião.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lembretes.map(l => (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: C.bgMid, borderRadius: RADIUS.md, padding: '12px 16px', gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: FONT.sm, color: l.ativo ? C.text : C.textDim, fontWeight: 500 }}>
                  {l.texto}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
                  Todo dia {l.dia} às {l.horario}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Toggle value={l.ativo} onChange={() => toggleLembrete(l.id)} />
                {!l.fixo && (
                  <button onClick={() => removerLembrete(l.id)} style={{
                    background: 'transparent', border: 'none', color: C.textMuted,
                    cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4,
                  }}>✕</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {adicionando ? (
          <div style={{ marginTop: 16, background: C.bgMid, borderRadius: RADIUS.md, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Label>Texto da mensagem</Label>
            <input
              placeholder="Ex: Não esqueça de registrar seus gastos dessa semana! 😊"
              value={novo.texto}
              onChange={e => setNovo({ ...novo, texto: e.target.value })}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <Label>Dia do mês (1–28)</Label>
                <input
                  type="number" min={1} max={28} value={novo.dia}
                  onChange={e => setNovo({ ...novo, dia: +e.target.value })}
                  style={{ ...inputStyle, width: 80 }}
                />
              </div>
              <div>
                <Label>Horário</Label>
                <input
                  type="time" value={novo.horario}
                  onChange={e => setNovo({ ...novo, horario: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={adicionarNovo} style={btnStyle(C.brand, C.brand + '20')}>Adicionar</button>
              <button onClick={() => setAdicionando(false)} style={btnStyle(C.textMuted, C.border)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdicionando(true)} style={{ ...btnStyle(C.brand, C.brand + '15'), marginTop: 14 }}>
            + Novo lembrete
          </button>
        )}
      </Card>
    </div>
  );
}

function defaultLembretes() {
  return [
    { id: 'l1', texto: '☕ Lembrete semanal: já registrou seus gastos dessa semana?', dia: 7, horario: '09:00', ativo: true, fixo: true },
    { id: 'l2', texto: '📄 Hora de enviar o extrato do mês! Encaminhe o PDF aqui no WhatsApp.', dia: 28, horario: '10:00', ativo: true, fixo: true },
    { id: 'l3', texto: '📅 Lembrete de reunião mensal com seu planejador esta semana!', dia: 25, horario: '08:00', ativo: false, fixo: true },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA: LIMITES & METAS
// ─────────────────────────────────────────────────────────────────────────────
function AbaLimitesMetas() {
  const { clienteAtivo, setClienteAtivo } = useApp();
  const { planejamento, anoAtivo, transacoes = [], categorias = [], botWhatsapp = {} } = clienteAtivo;

  const anoStr = String(anoAtivo || new Date().getFullYear());
  const mesAtual = new Date().getMonth();
  const planMes = planejamento?.[anoStr]?.[mesAtual] || {};

  // Alertas habilitados por categoria
  const alertas = botWhatsapp.alertas || {};

  const toggleAlerta = (catId) => {
    setClienteAtivo({
      ...clienteAtivo,
      botWhatsapp: {
        ...botWhatsapp,
        alertas: { ...alertas, [catId]: !alertas[catId] },
      },
    });
  };

  // Calcular realizado no mês atual
  // Usa competencia (igual ao Dashboard) em vez de data da compra.
  // Exclui faturas de mês anterior (compras em mês diferente da competência,
  // que não são parcelas futuras) — Problema 2 / Caminho B.
  const realizado = useMemo(() => {
    const mes = new Date().getMonth();   // 0-based
    const ano = new Date().getFullYear();
    const r = {};
    (transacoes || []).forEach(t => {
      // Filtro por competencia (igual ao Dashboard)
      const comp = t.competencia || (t.data ? t.data.slice(0, 7) : null);
      if (!comp) return;
      const [tAno, tMes] = comp.split('-');
      if (parseInt(tAno) !== ano || parseInt(tMes) - 1 !== mes) return;
      // Ignora faturas de mês anterior (compra em Abr, competência Mai)
      if (isFaturaAnterior(t)) return;
      const isDespesa = t.tipo === 'despesa' || (t.tipo == null && t.valor < 0);
      if (isDespesa) {
        const cid = t.categoria || 'outros';
        r[cid] = (r[cid] || 0) + Math.abs(t.valor);
      }
    });
    return r;
  }, [transacoes]);

  // Categorias com limite definido no Planejador
  const cats = useMemo(() => {
    return (categorias.length ? categorias : CATEGORIAS_PADRAO)
      .filter(c => c.tipo === 'despesa' && !c.isCategoria && !c.oculto && planMes[c.id]?.projetado > 0)
      .map(c => ({
        ...c,
        projetado: planMes[c.id]?.projetado || 0,
        // realizado[c.id] usa t.categoria (não t.categoriaId) — ver cálculo acima
        realizado: realizado[c.id] || 0,
      }));
  }, [categorias, planMes, realizado]);

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card title={`Limites de categorias — ${meses[mesAtual]}/${anoStr}`}>
        <p style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
          Limites definidos no <strong style={{ color: C.text }}>Planejador</strong>. Ative o alerta
          para receber aviso pelo WhatsApp ao atingir 80% e 100% do limite.
        </p>
        {cats.length === 0 ? (
          <div style={{ fontSize: FONT.xs, color: C.textMuted, padding: '20px 0', textAlign: 'center' }}>
            Nenhum limite definido no Planejador para este mês.<br />
            Acesse a aba <strong style={{ color: C.text }}>Planejador</strong> para configurar projeções.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cats.map(c => {
              const pct = c.projetado > 0 ? Math.min(100, (c.realizado / c.projetado) * 100) : 0;
              const cor = pct >= 100 ? C.red : pct >= 80 ? C.yellow : C.green;
              return (
                <div key={c.id} style={{ background: C.bgMid, borderRadius: RADIUS.md, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: FONT.sm, color: C.text, fontWeight: 500 }}>{c.nome}</span>
                      <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>
                        {fmt(c.realizado)} / {fmt(c.projetado)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: cor, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
                      <Toggle value={!!alertas[c.id]} onChange={() => toggleAlerta(c.id)} />
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 5, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: cor, transition: 'width 0.4s', borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Metas de economia">
        <p style={{ fontSize: FONT.xs, color: C.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
          Metas definidas no <strong style={{ color: C.text }}>Planejador</strong> (Receitas x Despesas).
          O bot envia o progresso quando o cliente digitar <em>"metas"</em> no WhatsApp.
        </p>
        <MetasResumo />
      </Card>
    </div>
  );
}

function MetasResumo() {
  const { clienteAtivo } = useApp();
  const { planejamento, anoAtivo, transacoes = [] } = clienteAtivo;
  const anoStr = String(anoAtivo || new Date().getFullYear());
  const mesAtual = new Date().getMonth();
  const planMes = planejamento?.[anoStr]?.[mesAtual] || {};

  const recCats = CATEGORIAS_PADRAO.filter(c => c.tipo === 'receita' && !c.isCategoria && !c.oculto);
  const despCats = CATEGORIAS_PADRAO.filter(c => c.tipo === 'despesa' && !c.isCategoria && !c.oculto);

  const soma = (cats, field) => cats.reduce((s, c) => s + (planMes[c.id]?.[field] || 0), 0);
  const somaTx = (cats) => {
    const mes = new Date().getMonth();   // 0-based
    const ano = new Date().getFullYear();
    const catIds = new Set(cats.map(c => c.id));
    return (transacoes || [])
      .filter(t => {
        // Filtro por competencia (igual ao Dashboard)
        const comp = t.competencia || (t.data ? t.data.slice(0, 7) : null);
        if (!comp) return false;
        const [tAno, tMes] = comp.split('-');
        if (parseInt(tAno) !== ano || parseInt(tMes) - 1 !== mes) return false;
        // Ignora faturas de mês anterior
        if (isFaturaAnterior(t)) return false;
        return catIds.has(t.categoria);
      })
      .reduce((s, t) => s + Math.abs(t.valor), 0);
  };

  const recProj = soma(recCats, 'projetado');
  const despProj = soma(despCats, 'projetado');
  const saldoProj = recProj - despProj;
  const recReal = somaTx(recCats);
  const despReal = somaTx(despCats);
  const saldoReal = recReal - despReal;

  const rows = [
    { label: 'Receitas projetadas', v: recProj, cor: C.rec },
    { label: 'Despesas projetadas', v: despProj, cor: C.desp },
    { label: 'Saldo projetado', v: saldoProj, cor: saldoProj >= 0 ? C.rec : C.desp, bold: true },
    { label: 'Receitas realizadas', v: recReal, cor: C.rec },
    { label: 'Despesas realizadas', v: despReal, cor: C.desp },
    { label: 'Saldo atual', v: saldoReal, cor: saldoReal >= 0 ? C.rec : C.desp, bold: true },
  ];

  if (recProj === 0 && despProj === 0) {
    return (
      <div style={{ fontSize: FONT.xs, color: C.textMuted, padding: '20px 0', textAlign: 'center' }}>
        Nenhuma projeção definida no Planejador para este mês.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map(r => (
        <div key={r.label} style={{
          display: 'flex', justifyContent: 'space-between', padding: '8px 14px',
          background: C.bgMid, borderRadius: RADIUS.sm,
          borderTop: r.bold ? `1px solid ${C.border}` : undefined,
        }}>
          <span style={{ fontSize: FONT.xs, color: C.textMuted }}>{r.label}</span>
          <span style={{ fontSize: FONT.xs, color: r.cor, fontWeight: r.bold ? 700 : 500 }}>
            {fmt(r.v)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA: MENSAGENS
// ─────────────────────────────────────────────────────────────────────────────
// ── Ícone por tipo de mensagem ────────────────────────────────────────────────
function tipoIcon(tipo) {
  switch (tipo) {
    case 'audio':
    case 'voice':    return '🎤';
    case 'image':    return '🖼️';
    case 'document': return '📄';
    case 'video':    return '🎥';
    case 'sticker':  return '🐱';
    default:         return '';
  }
}

function AbaMensagens() {
  const { clienteAtivo, setClienteAtivo } = useApp();
  const bot = clienteAtivo.botWhatsapp || {};
  const chatRef = useRef(null);

  // ── Números vinculados (para saber se bot está ativo) ─────────────────────
  const [numerosVinculados, setNumerosVinculados] = useState([]);
  useEffect(() => {
    if (!clienteAtivo?.id) return;
    supabase
      .from('cliente_telefones')
      .select('id, telefone, nome, ativo')
      .eq('cliente_id', clienteAtivo.id)
      .eq('ativo', true)
      .then(({ data }) => setNumerosVinculados(data || []));
  }, [clienteAtivo?.id]);

  const ativo = numerosVinculados.length > 0;
  const telefoneEnvio = bot.telefone || numerosVinculados[0]?.telefone || '';

  // ── Session ID do cliente ──────────────────────────────────────────────────
  // Estratégia: buscar via telefone ativo → bot_sessions.telefone
  // Evita depender de RLS por assessor_id (que pode ser de outro usuário/teste)
  const [sessionId, setSessionId] = useState(null);
  useEffect(() => {
    if (!clienteAtivo?.id) return;

    // Passo 1: pegar telefones ativos do cliente
    supabase
      .from('cliente_telefones')
      .select('telefone')
      .eq('cliente_id', clienteAtivo.id)
      .eq('ativo', true)
      .then(async ({ data: tels }) => {
        if (!tels || tels.length === 0) return;

        // Passo 2: buscar sessão pelo telefone (sem depender de assessor_id)
        const telefones = tels.map(t => t.telefone);
        const { data: sess } = await supabase
          .from('bot_sessions')
          .select('id, atualizado_em')
          .in('telefone', telefones)
          .order('atualizado_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        setSessionId(sess?.id ?? null);
      });
  }, [clienteAtivo?.id]);

  // ── Mensagens reais do bot_messages ──────────────────────────────────────
  const [mensagens, setMensagens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [ultimaAtualiz, setUltimaAtualiz] = useState(null);

  const carregarMensagens = useCallback(async (sid) => {
    if (!sid) return;
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('bot_messages')
        .select('id, de, tipo, conteudo, meta, criado_em')
        .eq('session_id', sid)
        .order('criado_em', { ascending: true })
        .limit(300);
      if (!error && data) {
        setMensagens(data);
        setUltimaAtualiz(new Date());
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carrega quando temos o sessionId
  useEffect(() => {
    if (!sessionId) { setMensagens([]); return; }
    carregarMensagens(sessionId);
  }, [sessionId, carregarMensagens]);

  // Auto-refresh a cada 15s enquanto a aba está visível
  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(() => carregarMensagens(sessionId), 15000);
    return () => clearInterval(timer);
  }, [sessionId, carregarMensagens]);

  // Scroll automático para o fundo quando chegam mensagens novas
  useEffect(() => {
    if (chatRef.current && mensagens.length > 0) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [mensagens.length]);

  // ── Stats derivados ───────────────────────────────────────────────────────
  const totalMensagens = mensagens.length;
  const ultimaAtividade = mensagens.length > 0
    ? mensagens[mensagens.length - 1].criado_em
    : bot.ultimaAtividade;
  const transacoesWpp = (clienteAtivo.transacoes || []).filter(t => t.origem === 'whatsapp').length;

  // ── Envio manual ──────────────────────────────────────────────────────────
  const [texto, setTexto] = useState('');
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    if (!texto.trim() || !ativo) return;
    const msgTexto = texto.trim();
    setTexto('');

    // Otimisticamente adiciona a mensagem local
    const otimista = {
      id: `opt-${Date.now()}`,
      de: 'bot',
      tipo: 'text',
      conteudo: msgTexto,
      criado_em: new Date().toISOString(),
    };
    setMensagens(prev => [...prev, otimista]);

    // Envia pelo WhatsApp via Supabase Functions (usa invoke para evitar CORS)
    try {
      const { error: fnErr } = await supabase.functions.invoke('whatsapp-webhook', {
        body: { _envio_manual: true, telefone: telefoneEnvio, mensagem: msgTexto },
      });
      if (fnErr) console.error('[AbaMensagens] Erro ao enviar WPP:', fnErr);
    } catch (e) {
      console.error('[AbaMensagens] Erro ao enviar WPP:', e);
    }

    setEnviado(true);
    setTimeout(() => setEnviado(false), 2000);
    // Recarrega após 3s para pegar o que foi salvo no banco
    if (sessionId) setTimeout(() => carregarMensagens(sessionId), 3000);
  };

  const telefoneDisplay = telefoneEnvio ? `+55 ${formatPhone(telefoneEnvio)}` : '—';

  // ── Formatação de hora da mensagem ────────────────────────────────────────
  function fmtHora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const hoje = new Date();
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoje.toDateString())  return hora;
    if (d.toDateString() === ontem.toDateString()) return `ontem ${hora}`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + hora;
  }

  // ── Label do separador de dia ─────────────────────────────────────────────
  function labelDia(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const hoje = new Date();
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    if (d.toDateString() === hoje.toDateString())  return 'Hoje';
    if (d.toDateString() === ontem.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  }

  // ── Intercala separadores de dia entre mensagens ──────────────────────────
  const itensChat = [];
  let diaAtual = null;
  for (const m of mensagens) {
    const dia = m.criado_em ? new Date(m.criado_em).toDateString() : null;
    if (dia && dia !== diaAtual) {
      diaAtual = dia;
      itensChat.push({ _separador: true, label: labelDia(m.criado_em), key: `sep-${dia}` });
    }
    itensChat.push(m);
  }

  const semMensagens = mensagens.length === 0 && !carregando;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Status cards ─────────────────────────────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Info label="Número vinculado" value={telefoneDisplay} />
          <Info label="Última atividade" value={
            ultimaAtividade
              ? new Date(ultimaAtividade).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
              : '—'
          } />
          <Info label="Total de mensagens" value={String(totalMensagens)} />
          <Info label="Transações via WPP" value={String(transacoesWpp)} />
          {/* Botão atualizar + horário do último fetch */}
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <button
              onClick={() => sessionId && carregarMensagens(sessionId)}
              disabled={carregando || !sessionId}
              style={{
                ...btnStyle(C.brand, C.brand + '15', carregando || !sessionId),
                fontSize: 12, padding: '5px 12px',
              }}
            >
              {carregando
                ? <><Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Atualizando…</>
                : <><RefreshCw size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Atualizar</>}
            </button>
            {ultimaAtualiz && (
              <span style={{ fontSize: 10, color: C.textMuted }}>
                atualizado às {ultimaAtualiz.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* ── Histórico de conversa ─────────────────────────────────────────── */}
      <Card title="Histórico de conversa">

        {/* Área do chat estilo WhatsApp */}
        <div
          ref={chatRef}
          style={{
            height: 460, overflowY: 'auto', display: 'flex', flexDirection: 'column',
            gap: 2, padding: '10px 6px', marginBottom: 16,
            background: '#0d1f17',
            borderRadius: RADIUS.sm,
            border: `1px solid ${C.border}`,
          }}
        >
          {/* Carregando */}
          {carregando && mensagens.length === 0 && (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: '60px 20px', fontSize: 13 }}>
              Carregando histórico de mensagens…
            </div>
          )}

          {/* Sem sessão criada ainda */}
          {!carregando && !sessionId && (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: '60px 20px', fontSize: 13, lineHeight: 1.8 }}>
              {ativo
                ? 'Nenhuma conversa encontrada ainda. Assim que o cliente enviar a primeira mensagem pelo WhatsApp, ela aparecerá aqui automaticamente.'
                : 'Nenhuma mensagem ainda. Vincule o número na aba Conexão para ativar o bot.'}
            </div>
          )}

          {/* Sessão existe mas não tem mensagens */}
          {!carregando && sessionId && semMensagens && (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: '60px 20px', fontSize: 13 }}>
              Nenhuma mensagem ainda nesta sessão.
            </div>
          )}

          {/* Lista de mensagens + separadores */}
          {itensChat.map((item) => {

            // ── Separador de dia ──────────────────────────────────────────
            if (item._separador) {
              return (
                <div key={item.key} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', margin: '6px 0',
                }}>
                  <div style={{ flex: 1, height: 1, background: '#2d4a3a' }} />
                  <span style={{
                    fontSize: 10, color: '#6b9e82', fontWeight: 600,
                    background: '#1a3028', padding: '3px 12px', borderRadius: 12,
                    border: '1px solid #2d4a3a', whiteSpace: 'nowrap',
                  }}>{item.label}</span>
                  <div style={{ flex: 1, height: 1, background: '#2d4a3a' }} />
                </div>
              );
            }

            // ── Bolha de mensagem ─────────────────────────────────────────
            const m = item;
            const isBot     = m.de === 'bot';
            const isCliente = m.de === 'cliente';
            const icon      = tipoIcon(m.tipo);

            // Bots ficam na direita (verde), clientes na esquerda (cinza)
            const alignRight  = isBot;
            const bubbleBg    = isBot ? '#1f4d35' : '#1e2d27';
            const bubbleBdr   = isBot ? '#2d6a4f' : '#2d3d35';
            const labelColor  = isBot ? '#4ade80' : '#9ca3af';
            const remetente   = isBot ? 'Bot' : isCliente ? 'Cliente' : 'Sistema';

            // Conteúdo textual da mensagem
            let conteudo = m.conteudo || '';
            if (m.tipo !== 'text' && !conteudo) conteudo = `[${m.tipo}]`;

            return (
              <div key={m.id} style={{
                display: 'flex',
                justifyContent: alignRight ? 'flex-end' : 'flex-start',
                padding: '3px 10px',
              }}>
                <div style={{
                  maxWidth: '72%',
                  background: bubbleBg,
                  border: `1px solid ${bubbleBdr}`,
                  borderRadius: isBot
                    ? '14px 14px 4px 14px'
                    : '14px 14px 14px 4px',
                  padding: '8px 12px 7px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}>
                  {/* Remetente + hora */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'baseline', gap: 14, marginBottom: 5,
                  }}>
                    <span style={{ fontSize: 10, color: labelColor, fontWeight: 700, lineHeight: 1 }}>
                      {remetente}
                    </span>
                    <span style={{ fontSize: 9, color: '#6b7280', whiteSpace: 'nowrap', lineHeight: 1 }}>
                      {fmtHora(m.criado_em)}
                    </span>
                  </div>

                  {/* Corpo da mensagem */}
                  <div style={{
                    fontSize: 13, color: '#e2e8f0',
                    lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {icon ? <span style={{ marginRight: 4 }}>{icon}</span> : null}
                    {conteudo}
                  </div>

                  {/* Badge de tipo para mídia */}
                  {m.tipo && m.tipo !== 'text' && (
                    <div style={{
                      marginTop: 5, fontSize: 9, color: '#6b7280',
                      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em',
                    }}>
                      {m.tipo}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Enviar mensagem manual ────────────────────────────────────── */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <Label>Enviar mensagem manual ao cliente</Label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input
              placeholder={ativo ? 'Digite uma mensagem...' : 'Vincule o número primeiro...'}
              disabled={!ativo}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviar()}
              style={{ ...inputStyle, flex: 1, minWidth: 200, opacity: ativo ? 1 : 0.5 }}
            />
            <button
              onClick={enviar}
              disabled={!ativo || !texto.trim()}
              style={btnStyle(C.brand, C.brand + '20', !ativo || !texto.trim())}
            >
              {enviado
                ? <><CheckCircle2 size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />Enviado</>
                : 'Enviar ↗'}
            </button>
          </div>
          {!ativo && (
            <p style={{ fontSize: 11, color: C.yellow, marginTop: 6 }}>
              Número não vinculado. Acesse a aba <strong>Conexão</strong> para vincular.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function demoMensagens() {
  return [
    { id: 'd1', de: 'cliente', texto: 'Gastei 45 no almoço hoje', hora: '12:32' },
    { id: 'd2', de: 'bot', texto: '✅ Lançado: R$ 45,00 em Alimentação Fora (12/04). Quer ajustar a categoria?', hora: '12:32' },
    { id: 'd3', de: 'cliente', texto: 'resumo', hora: '18:05' },
    { id: 'd4', de: 'bot', texto: '📊 Resumo de Abril/2026\n💰 Receitas: R$ 8.200\n💸 Gastos: R$ 5.340\n✅ Saldo: R$ 2.860\n\nTop 3 gastos:\n1. Supermercado R$ 1.200\n2. Aluguel R$ 2.500\n3. Combustível R$ 380', hora: '18:05' },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes utilitários
// ─────────────────────────────────────────────────────────────────────────────
function Card({ title, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, padding: '20px 24px' }}>
      {title && <h3 style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>{title}</h3>}
      {children}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{children}</div>;
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: FONT.sm, color: C.text, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={onChange} style={{
      width: 40, height: 22, borderRadius: 11, background: value ? C.brand : C.border,
      border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: C.white,
        position: 'absolute', top: 3, left: value ? 21 : 3, transition: 'left 0.2s',
      }} />
    </button>
  );
}

const inputStyle = {
  background: C.bgMid, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
  color: C.text, fontSize: FONT.sm, padding: '8px 12px',
  fontFamily: "'Inter', sans-serif", outline: 'none',
};

const btnStyle = (color, bg, disabled = false) => ({
  background: bg, border: `1px solid ${color}44`, borderRadius: RADIUS.sm,
  color: color, fontSize: FONT.sm, padding: '8px 16px',
  cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: "'Inter', sans-serif",
  fontWeight: 600, opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap', transition: 'opacity 0.2s',
});

function formatPhone(num = '') {
  let n = String(num).replace(/\D/g, '');
  // Remove prefixo 55 (Brasil) se presente para exibir apenas DDD+número
  if (n.startsWith('55') && n.length >= 12) n = n.slice(2);
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  return n;
}
