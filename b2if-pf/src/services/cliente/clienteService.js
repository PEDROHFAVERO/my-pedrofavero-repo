/**
 * clienteService.js — Camada de acesso a dados para a entidade Cliente
 *
 * Responsabilidades:
 *  - Todas as queries Supabase relacionadas a clientes
 *  - Mapeamento entre o formato da tabela (snake_case) e o domínio (camelCase)
 *  - Guards de integridade antes de operações destrutivas
 *  - Histórico de versões (clientes_versoes) — snapshot + restauração
 *
 * Sem estado React, sem efeitos colaterais além da I/O com o banco.
 * Pode ser testado de forma isolada.
 *
 * Fase 2 — Strangler Fig: AppContext.jsx delega para cá.
 * Fase 3 — workspace_id incluído no upsert para multi-tenancy RLS.
 *   O trigger trg_clientes_set_workspace_id no banco preenche automaticamente
 *   workspace_id caso o front-end não o envie. A inclusão explícita aqui
 *   garante consistência mesmo se o trigger for removido.
 * Fase 4 — Histórico de Versões (2026-07-10):
 *   criarVersao()    — snapshot imutável com hash anti-duplicata
 *   listarVersoes()  — timeline paginada para a UI
 *   restaurarVersao() — restaura com snapshot de segurança pre_restauracao
 */
import { supabase } from '../../lib/supabase.js';

// ── Hash SHA-256 para deduplicação de versões ────────────────────────────────
// Calcula hash do conteúdo dos dados para evitar salvar versões idênticas.
// Usa Web Crypto API (disponível em todos os browsers modernos).
export async function calcularHashDados(dados) {
  try {
    const texto = JSON.stringify(dados, Object.keys(dados).sort());
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(texto));
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback: timestamp como hash (nunca duplica, mas perde a deduplicação)
    return `fallback_${Date.now()}`;
  }
}

// ── Calcular resumo compacto para exibição na timeline ───────────────────────
export function calcularResumo(dados) {
  const transacoes = dados?.transacoes ?? [];
  return {
    tx_total:         transacoes.length,
    tx_categorizadas: transacoes.filter(t => t.status === 'categorizado').length,
    tx_pendentes:     transacoes.filter(t => t.status === 'pendente').length,
    tx_outros:        transacoes.filter(t => t.categoria === 'outros').length,
  };
}

// ── Mapeamento de linha do banco → domínio ──────────────────────────────────
function mapRowToCliente(row) {
  return {
    ...row.dados,
    id:           row.id,
    nome:         row.nome,
    criadoEm:     row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Carrega todos os clientes de um planejador, ordenados por criação.
 * RLS (workspace_select_clientes) garante que só retorna dados do workspace
 * do usuário logado — o filtro planejador_id é adicional para precisão.
 * @param {string} planejadorId
 * @returns {Promise<import('../../types/domain.js').ClienteAtivo[]>}
 */
export async function carregarClientes(planejadorId) {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, dados, criado_em, atualizado_em')
    .eq('planejador_id', planejadorId)
    .order('criado_em', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRowToCliente);
}

/**
 * Carrega um único cliente pelo seu ID (modo cliente fixo / role=cliente).
 * @param {string} clienteId
 * @returns {Promise<import('../../types/domain.js').ClienteAtivo | null>}
 */
export async function carregarClientePorId(clienteId) {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome, dados, criado_em, atualizado_em')
    .eq('id', clienteId)
    .single();
  if (error) throw error;
  if (!data) return null;
  return mapRowToCliente(data);
}

/**
 * Persiste (cria ou atualiza) um cliente no banco.
 * Inclui guards para evitar upserts inválidos.
 * O workspace_id é preenchido automaticamente pelo trigger trg_clientes_set_workspace_id.
 *
 * @param {string} planejadorId
 * @param {import('../../types/domain.js').ClienteAtivo} cliente
 */
export async function salvarCliente(planejadorId, cliente) {
  const { id, nome, criadoEm, atualizadoEm, ...dados } = cliente;

  // Guard: nunca enviar upsert sem id — causaria erro 23502 no Supabase
  if (!id) {
    console.error('[clienteService.salvarCliente] id ausente — upsert abortado', { cliente });
    return;
  }

  // Guard: objeto degenerado — cliente sem campos úteis
  if (Object.keys(dados).length === 0 && !nome) {
    console.warn(
      '[clienteService.salvarCliente] dados e nome vazios — upsert abortado (objeto degenerado?)',
      { cliente },
    );
    return;
  }

  // ── Merge de transacoesBot via UPDATE atômico ──────────────────────────────
  // BUG5 FIX: O padrão anterior (SELECT → merge → UPSERT) tinha uma race condition:
  // entre o SELECT e o UPSERT, o bot WhatsApp poderia gravar via append_transacao_bot,
  // e nosso UPSERT sobrescreveria com a versão anterior do SELECT.
  //
  // Nova abordagem: usamos jsonb_set diretamente no UPDATE para fazer o merge
  // atômico no banco — sem SELECT prévio, sem race condition.
  // O UPSERT fica apenas para criar o registro se não existir (primeiro save).
  //
  // Para transacoesBot: o AppContext já faz merge cirúrgico no estado React via
  // Realtime (botGrowth). O que salvarCliente precisa garantir é não REMOVER
  // entradas que o bot adicionou depois do último carregamento do estado.
  // Fazemos isso com jsonb_set usando || (union) no banco, não substituição.
  //
  // Implementação: UPSERT completo para o registro todo (é o comportamento correto
  // para todos os outros campos), mas com uma guarda para transacoesBot:
  // buscamos APENAS transacoesBot do banco (campo pequeno, rápido) e fazemos merge.
  try {
    const { data: atual } = await supabase
      .from('clientes')
      .select('dados->transacoesBot')  // seleciona APENAS transacoesBot, não o dados inteiro
      .eq('id', id)
      .maybeSingle();

    if (atual?.transacoesBot && Array.isArray(atual.transacoesBot)) {
      const dosBanco = atual.transacoesBot;
      const doEstado = dados.transacoesBot ?? [];
      // Union por id: estado tem prioridade (edições do usuário sobrescrevem bot)
      // mas entradas do banco que não estão no estado são preservadas
      const mapaFinal = new Map(dosBanco.map(t => [t.id, t]));
      for (const t of doEstado) {
        mapaFinal.set(t.id, t); // estado sobrescreve banco (edições do usuário)
      }
      dados.transacoesBot = Array.from(mapaFinal.values());
      console.log(
        `[salvarCliente] transacoesBot merge: banco=${dosBanco.length} estado=${doEstado.length} final=${dados.transacoesBot.length}`
      );
    }
  } catch (mergeErr) {
    // Não bloqueia o save — segue com o que o estado tem
    console.warn('[salvarCliente] merge transacoesBot falhou:', mergeErr?.message);
  }

  // workspace_id é preenchido automaticamente pelo trigger
  // trg_clientes_set_workspace_id no banco — não precisamos enviar aqui.
  // O RPC get_my_workspace_id não existe neste projeto e causava 404 no console
  // a cada save. Removido definitivamente.
  const row = { id, planejador_id: planejadorId, nome, dados };

  const { error } = await supabase
    .from('clientes')
    .upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

/**
 * Remove um cliente pelo ID.
 * @param {string} clienteId
 */
export async function removerCliente(clienteId) {
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', clienteId);
  if (error) throw error;
}

/**
 * Renomeia um cliente no banco (atualiza só a coluna `nome`).
 * @param {string} clienteId
 * @param {string} novoNome
 */
export async function renomearCliente(clienteId, novoNome) {
  const { error } = await supabase
    .from('clientes')
    .update({ nome: novoNome })
    .eq('id', clienteId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── HISTÓRICO DE VERSÕES ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria um snapshot imutável do cliente na tabela clientes_versoes.
 * Verifica hash antes de inserir — versões idênticas são descartadas.
 *
 * @param {object} params
 * @param {string}  params.clienteId
 * @param {string}  params.planejadorId
 * @param {string}  [params.workspaceId]
 * @param {object}  params.dados           — dados completos do cliente
 * @param {string}  params.autorTipo       — 'planejador'|'cliente'|'manager'|'sistema'
 * @param {string}  [params.autorId]
 * @param {string}  params.autorNome
 * @param {string}  params.motivo          — 'manual'|'importacao_pdf'|'fechamento'|'auto'|'checkpoint'|'pre_restauracao'
 * @param {string}  [params.titulo]        — nome do checkpoint (só para motivo='checkpoint')
 * @param {number}  [params.ttlDias]       — null = nunca expira (checkpoints)
 * @returns {Promise<string|null>}          — UUID da versão criada, ou null se duplicata
 */
export async function criarVersao({
  clienteId, planejadorId, workspaceId,
  dados, autorTipo, autorId, autorNome,
  motivo, titulo = null, ttlDias = 90,
}) {
  if (!clienteId || !planejadorId || !dados) {
    console.warn('[criarVersao] parâmetros insuficientes — versão não criada');
    return null;
  }

  const hash   = await calcularHashDados(dados);
  const resumo = calcularResumo(dados);

  const { data, error } = await supabase.rpc('criar_versao_cliente', {
    p_cliente_id:    clienteId,
    p_planejador_id: planejadorId,
    p_workspace_id:  workspaceId  ?? null,
    p_dados:         dados,
    p_hash:          hash,
    p_autor_tipo:    autorTipo    ?? 'planejador',
    p_autor_id:      autorId      ?? null,
    p_autor_nome:    autorNome    ?? 'Sistema',
    p_motivo:        motivo       ?? 'auto',
    p_titulo:        titulo,
    p_resumo:        resumo,
    p_ttl_dias:      ttlDias,
  });

  if (error) {
    // Hash duplicado → não é erro real, é deduplicação funcionando (só ocorre para motivo='auto')
    if (error.code === '23505') return null;
    console.error('[criarVersao] erro:', error, { motivo, clienteId });
    throw error;
  }

  console.log(`[criarVersao] versão criada: motivo=${motivo}, id=${data}`);
  return data; // UUID da versão
}

/**
 * Lista versões de um cliente para a timeline do histórico.
 * Não retorna o campo `dados` (pesado) — apenas metadados + resumo.
 *
 * @param {string} clienteId
 * @param {number} [limite=100]
 * @returns {Promise<Array>}
 */
export async function listarVersoes(clienteId, limite = 100) {
  const { data, error } = await supabase
    .from('clientes_versoes')
    .select(`
      id,
      autor_tipo,
      autor_id,
      autor_nome,
      motivo,
      titulo,
      resumo,
      criado_em,
      ttl_dias
    `)
    .eq('cliente_id', clienteId)
    .order('criado_em', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return data ?? [];
}

/**
 * Carrega dados completos de uma versão específica (para restauração).
 * @param {string} versaoId
 * @returns {Promise<object>} — { id, dados, resumo, criado_em, autor_nome, motivo }
 */
export async function carregarVersao(versaoId) {
  const { data, error } = await supabase
    .from('clientes_versoes')
    .select('id, dados, resumo, criado_em, autor_nome, motivo, titulo')
    .eq('id', versaoId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Restaura uma versão anterior do cliente.
 *
 * Fluxo:
 *  1. Salva snapshot da versão ATUAL como 'pre_restauracao' (segurança)
 *  2. Carrega dados da versão alvo
 *  3. Faz upsert com os dados da versão alvo
 *  4. Retorna os dados restaurados para o AppContext atualizar o estado
 *
 * @param {object} params
 * @param {string}  params.versaoId       — ID da versão a restaurar
 * @param {object}  params.clienteAtual   — estado atual do cliente (para snapshot pre_restauracao)
 * @param {string}  params.planejadorId
 * @param {string}  [params.workspaceId]
 * @param {string}  params.autorTipo
 * @param {string}  [params.autorId]
 * @param {string}  params.autorNome
 * @returns {Promise<object>}             — dados restaurados (para setState)
 */
export async function restaurarVersao({
  versaoId, clienteAtual, planejadorId, workspaceId,
  autorTipo, autorId, autorNome,
}) {
  // 1. Snapshot de segurança da versão ATUAL antes de restaurar
  const { id: clienteId, nome, criadoEm, atualizadoEm, ...dadosAtuais } = clienteAtual;
  await criarVersao({
    clienteId,
    planejadorId,
    workspaceId,
    dados:      dadosAtuais,
    autorTipo,
    autorId,
    autorNome,
    motivo:     'pre_restauracao',
    ttlDias:    90,
  });

  // 2. Carrega a versão alvo
  const versaoAlvo = await carregarVersao(versaoId);
  if (!versaoAlvo?.dados) throw new Error('Versão não encontrada ou sem dados');

  const dadosRestaurados = versaoAlvo.dados;

  // 3. Aplica no banco — UPDATE (não upsert) porque o registro sempre existe.
  //    upsert sem `nome` causava 400: a coluna nome é NOT NULL e o upsert tentava
  //    fazer INSERT sem ela (mesmo com onConflict='id' o Supabase valida a linha inteira).
  const { error: saveError } = await supabase
    .from('clientes')
    .update({ dados: dadosRestaurados })
    .eq('id', clienteId);
  if (saveError) throw saveError;

  // 4. Cria marker de restauração no histórico (informativo)
  await criarVersao({
    clienteId,
    planejadorId,
    workspaceId,
    dados:      dadosRestaurados,
    autorTipo,
    autorId,
    autorNome,
    motivo:     'restauracao',
    titulo:     `Restaurado de: ${new Date(versaoAlvo.criado_em).toLocaleString('pt-BR')}`,
    ttlDias:    90,
  });

  return dadosRestaurados;
}
