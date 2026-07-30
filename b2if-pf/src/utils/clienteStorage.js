import { CATEGORIAS_PADRAO, REGRAS_PADRAO } from '../data/categorias.js';
import { gerarId as gerarIdSeguro } from './ids.js';

// IDs de categorias v4.0 que foram removidas/renomeadas na v5.0 e NÃO devem ser preservadas
// (todos têm aliases ocultos em CATEGORIAS_PADRAO para não corromper histórico)
const IDS_LEGADOS_REMOVIDOS = new Set([
  // Legados originais
  'transferencia', 'saque', 'recarga', 'de_outras',
  // 20 aliases v4.0 → v5.0 (ocultos em categorias.js)
  'custos_imoveis', 'educacao', 'educacao_filhos', 'material_escolar',
  'tarifas', 'funcionario', 'gasolina', 'carro', 'drogaria', 'aluguel_carro',
  'padaria', 'cuidados_pessoais', 'casa', 'decoracao', 'reforma',
  'sem_categoria', 'festa_aniversario', 'nao_lembro', 'compras_online',
]);

// Mapa de migração v4.0 → v5.0 (para transformação em tempo real)
// Fonte de verdade: CATEGORIAS_PADRAO oculto: true entries
const MAPA_MIGRACAO_V4_V5 = {
  custos_imoveis:    'manutencao_res',
  educacao:          'mensalidade_escolar',
  educacao_filhos:   'mensalidade_escolar',
  material_escolar:  'material_didatico',
  tarifas:           'impostos',
  funcionario:       'salario_diaria',
  gasolina:          'combustivel',
  carro:             'manutencao',
  drogaria:          'farmacia',
  aluguel_carro:     'viagem',
  padaria:           'supermercado',
  cuidados_pessoais: 'cosmeticos',
  casa:              'manutencao_res',
  decoracao:         'manutencao_res',
  reforma:           'manutencao_res',
  sem_categoria:     'outros',
  festa_aniversario: 'comemoracoes',
  nao_lembro:        'outros',
  compras_online:    'outros',
  saque:             'saque_fisico',
  transferencia:     'entre_contas',
  recarga:           'outros',
  de_outras:         'renda_extra',
};

// ── Sincroniza categorias do cliente com o padrão atual ───────────────────────
//
// PROTEÇÃO v5.0: clientes com setupCompleto=true (existentes) NÃO recebem
// merge automático — suas categorias são preservadas integralmente.
// Apenas clientes novos (setupCompleto=false/undefined) recebem o padrão.
//
// REGRAS DE MERGE (em ordem de prioridade):
//  1. Categorias criadas pelo usuário (id fora do padrão, não legado) → preservadas integralmente
//  2. Categorias padrão EDITADAS pelo usuário (id no padrão mas nome/grupo diferente) → preserva versão do usuário
//  3. Categorias padrão não editadas → usa versão mais recente do CATEGORIAS_PADRAO
//  4. Novas categorias adicionadas ao padrão (não existem no cliente) → acrescenta
//  5. IDs legados removidos → descartados
//
// Desta forma: renomear "Alimentação Fora" → "Refeições" sobrevive ao reload;
//              criar nova categoria customizada sobrevive ao reload/abrir cliente;
//              categorias padrão novas aparecem automaticamente.
export function sincronizarCategorias(categoriasCliente = [], setupCompleto = false) {
  // Clientes existentes (setup já concluído): preserva categorias sem alterar
  if (setupCompleto === true) return categoriasCliente;

  const idspadrao = new Set(CATEGORIAS_PADRAO.map(c => c.id));

  // Map id → categoria do cliente (para lookup rápido)
  const mapaCliente = new Map(categoriasCliente.map(c => [c.id, c]));

  // Categorias customizadas criadas pelo usuário (id fora do padrão e não legado)
  const customizadas = categoriasCliente.filter(
    c => !idspadrao.has(c.id) && !IDS_LEGADOS_REMOVIDOS.has(c.id)
  );

  // Para cada categoria padrão: usa versão do cliente SE existir (preserva edições),
  // caso contrário usa versão do padrão (deep clone para evitar mutação acidental)
  const resultado = CATEGORIAS_PADRAO.map(padrao => {
    const doCliente = mapaCliente.get(padrao.id);
    if (doCliente) {
      // Preserva integralmente o que o usuário editou (nome, grupo, tipo, etc.)
      // mas garante que campos estruturais obrigatórios existam
      return {
        ...padrao,        // base: garante campos obrigatórios da versão atual
        ...doCliente,     // sobrescreve com dados do usuário (nome renomeado, etc.)
        id: padrao.id,    // id nunca muda
      };
    }
    return JSON.parse(JSON.stringify(padrao)); // nova categoria padrão: clone limpo
  });

  // Retorna: padrões (com edições do usuário) + customizadas criadas pelo usuário
  return [...resultado, ...customizadas];
}

// ── Migração de transações legadas v4.0 → v5.0 ──────────────────────────────────
//
// Transforma IDs de categoria legados em IDs v5.0 ativos.
// Chamada em abrirCliente() e na restauração de sessão para garantir que
// qualquer transação antiga (importada antes da migração) resolva corretamente.
// Opera sobre cópia — nunca muta o array original.
export function migrarTransacoesLegadas(transacoes = []) {
  if (!transacoes?.length) return transacoes;
  let houveMigracao = false;
  const migradas = transacoes.map(t => {
    const novaCategoria = MAPA_MIGRACAO_V4_V5[t.categoria];
    if (!novaCategoria) return t;
    houveMigracao = true;
    return { ...t, categoria: novaCategoria };
  });
  if (houveMigracao) {
    console.log('[migrarTransacoesLegadas] Transações migradas de v4.0 → v5.0');
  }
  return migradas;
}

// ── Estado inicial de um cliente ──────────────────────────────────────────────
export function criarClienteVazio(nome = 'Novo Cliente') {
  return {
    id: gerarId(),
    nome,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    setupCompleto: false, // false = cliente novo (passa pelo wizard); true = já configurado
    // Pessoas do núcleo familiar/clientes do planejador
    // Cada entrada: { id, nome, telefone }
    // telefone usado para vinculação automática com bot WhatsApp
    nucleoFamiliar: [],
    categorias: JSON.parse(JSON.stringify(CATEGORIAS_PADRAO)),
    regras: JSON.parse(JSON.stringify(REGRAS_PADRAO)),
    bancos: [],          // { id, nome }
    contas: [],          // { id, nome, bancoId, tipo, nucleoId }  (nucleoId → nucleoFamiliar[].id)
    transacoes: [],      // array de transações categorizadas (fonte oficial: extrato/fatura)
    transacoesBot: [],   // rascunhos de lançamentos via WhatsApp (fonte comportamental — não entra no Planejador)
    contasAPagar: [],    // compromissos fixos cadastrados pelo planejador: [{ id, nome, valor, diaVencimento, categoriaId, ativo, observacao }]
    planejamento: {},    // { 2026: { jan: { catId: { projetado, parcelas } } } }
    anoAtivo: new Date().getFullYear(),
    notas: '',           // HTML — bloco de notas livre por cliente
  };
}

// ── Persistência no Hub (localStorage) ───────────────────────────────────────
const HUB_KEY = 'b2if_pf_hub';

export function carregarHub() {
  try {
    const raw = localStorage.getItem(HUB_KEY);
    if (!raw) return { clientes: [] };
    return JSON.parse(raw);
  } catch {
    return { clientes: [] };
  }
}

export function salvarHub(hub) {
  localStorage.setItem(HUB_KEY, JSON.stringify(hub));
}

export function adicionarClienteHub(hub, cliente) {
  return { ...hub, clientes: [...hub.clientes, cliente] };
}

export function removerClienteHub(hub, clienteId) {
  return { ...hub, clientes: hub.clientes.filter(c => c.id !== clienteId) };
}

export function atualizarClienteHub(hub, cliente) {
  return {
    ...hub,
    clientes: hub.clientes.map(c =>
      c.id === cliente.id ? { ...cliente, atualizadoEm: new Date().toISOString() } : c
    ),
  };
}

// ── Export / Import de cliente (arquivo JSON) ─────────────────────────────────
export function exportarCliente(cliente) {
  const blob = new Blob(
    [JSON.stringify(cliente, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `b2if_${slugify(cliente.nome)}_${hoje()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importarClienteDeArquivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const dados = JSON.parse(e.target.result);
        // validação mínima
        if (!dados.id || !dados.nome || !dados.transacoes) {
          reject(new Error('Arquivo inválido: não parece um cliente B2IF PF'));
          return;
        }
        resolve(dados);
      } catch {
        reject(new Error('Erro ao ler arquivo JSON'));
      }
    };
    reader.readAsText(file);
  });
}

// ── Link de leitura ───────────────────────────────────────────────────────────
export function gerarLinkLeitura(cliente) {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(cliente))));
  return `${window.location.origin}${window.location.pathname}?view=${encoded}`;
}

export function lerClienteDoLink() {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('view');
    if (!encoded) return null;
    return JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch {
    return null;
  }
}

// ── Utilitários ───────────────────────────────────────────────────────────────
// gerarId usa crypto.randomUUID() — CSPRNG, substitui Math.random().toString(36)
// Re-exportado daqui para manter compatibilidade com todos os importadores existentes.
export function gerarId() {
  return gerarIdSeguro();
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}
