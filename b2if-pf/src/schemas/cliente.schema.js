/**
 * cliente.schema.js — Zod schemas para validação nas fronteiras de dados
 *
 * Uso:
 *   import { ClienteSchema, TransacaoSchema } from '../schemas/cliente.schema.js';
 *   const resultado = ClienteSchema.safeParse(dadosDoBanco);
 *   if (!resultado.success) throw new Error(resultado.error.message);
 */
import { z } from 'zod';

// ── Transação ─────────────────────────────────────────────────────────────────
export const TransacaoSchema = z.object({
  id:             z.string().min(1),
  data:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser YYYY-MM-DD'),
  descricao:      z.string().min(1),
  valor:          z.number(),
  tipo:           z.enum(['receita', 'despesa', 'neutro']),
  categoria:      z.string().nullable().optional(),
  subcategoria:   z.string().optional(),
  conta:          z.string().default(''),
  competencia:    z.string().regex(/^\d{4}-\d{2}$/).optional().nullable(),
  periodoLabel:   z.string().optional(),
  parcelaAtual:   z.number().int().nullable().optional(),
  parcelaTotal:   z.number().int().nullable().optional(),
  parcelasRestantes: z.number().int().optional(),
  status:         z.enum(['pendente', 'categorizado', 'rascunho']).default('pendente'),
  origem:         z.enum(['csv', 'pdf', 'whatsapp', 'manual']).optional(),
  formato:        z.string().optional(),
  _duplicata:     z.boolean().optional(),
  _selecionado:   z.boolean().optional(),
}).passthrough(); // permite campos extras sem falhar (retrocompat)

// ── Categoria ─────────────────────────────────────────────────────────────────
export const CategoriaSchema = z.object({
  id:          z.string().min(1),
  nome:        z.string().min(1),
  grupo:       z.string(),
  tipo:        z.enum(['receita', 'despesa', 'neutro']).optional(),
  isCategoria: z.boolean().optional(),
  categoria:   z.string().optional(),
  oculto:      z.boolean().optional(),
}).passthrough();

// ── Conta a Pagar ─────────────────────────────────────────────────────────────
export const ContaAPagarSchema = z.object({
  id:            z.string().min(1),
  nome:          z.string().min(1),
  valor:         z.number().nonnegative(),
  diaVencimento: z.number().int().min(1).max(31),
  categoriaId:   z.string().optional().default(''),
  ativo:         z.boolean().default(true),
}).passthrough();

// ── Conta/Banco ───────────────────────────────────────────────────────────────
export const ContaSchema = z.object({
  id:   z.string(),
  nome: z.string().min(1),
}).passthrough();

// ── Planejamento ──────────────────────────────────────────────────────────────
export const PlanejamentoCategoriaSchema = z.object({
  projetado: z.number().default(0),
  parcelas:  z.number().default(0),
});

// ── Cliente (validação completa dos dados do banco) ───────────────────────────
export const ClienteSchema = z.object({
  id:           z.string().min(1),
  nome:         z.string().min(1),
  planejador_id: z.string().uuid('planejador_id deve ser UUID'),
  anoAtivo:     z.number().int().min(2020).max(2099).default(new Date().getFullYear()),
  transacoes:   z.array(TransacaoSchema).default([]),
  categorias:   z.array(CategoriaSchema).default([]),
  planejamento: z.record(z.record(z.record(PlanejamentoCategoriaSchema))).default({}),
  contasAPagar: z.array(ContaAPagarSchema).default([]),
  contas:       z.array(ContaSchema).default([]),
  notas:        z.string().optional().nullable(),
}).passthrough();

// ── Resposta da Edge Function process-pdf ────────────────────────────────────
export const ProcessPDFResultSchema = z.object({
  ok:         z.boolean(),
  tipoDoc:    z.enum(['fatura', 'extrato']).default('extrato'),
  compFatura: z.string().optional().default(''),
  vencimento: z.string().optional().default(''),
  transacoes: z.array(TransacaoSchema).default([]),
  aviso:      z.string().optional(), // presente quando o PDF foi muito longo e processado parcialmente
});

// ── Resultado de importação de Metas (Planejador) ─────────────────────────────
export const MetaItemSchema = z.object({
  nomeMD:       z.string(),
  tipo:         z.enum(['receita', 'despesa', 'investimento']).default('despesa'),
  metas:        z.record(z.number()).default({}),
  catIdSugerido: z.string().nullable().optional(),
  nomeSugerido:  z.string().nullable().optional(),
  confianca:    z.number().min(0).max(1).default(0),
  macroSugerido: z.string().default('Consumo Mensal'),
  status:       z.enum(['mapeado', 'revisar', 'novo']).default('revisar'),
  catIdFinal:   z.string().nullable().optional(),
}).passthrough();

export const ProcessMetasResultSchema = z.object({
  ok:    z.boolean(),
  meses: z.array(z.string()),
  itens: z.array(MetaItemSchema),
});

// ── Helpers de validação segura ───────────────────────────────────────────────

/**
 * Valida e retorna dados seguros ou lança erro estruturado.
 * @template T
 * @param {import('zod').ZodSchema<T>} schema
 * @param {unknown} data
 * @param {string} [contexto]
 * @returns {T}
 */
export function validar(schema, data, contexto = 'dados') {
  const resultado = schema.safeParse(data);
  if (!resultado.success) {
    const erros = resultado.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`[Validação] ${contexto} inválido — ${erros}`);
  }
  return resultado.data;
}

/**
 * Valida dados sem lançar erro — retorna { ok, data, erros }.
 * @template T
 * @param {import('zod').ZodSchema<T>} schema
 * @param {unknown} data
 * @returns {{ ok: boolean, data: T | null, erros: string[] }}
 */
export function validarSafe(schema, data) {
  const resultado = schema.safeParse(data);
  if (!resultado.success) {
    return {
      ok: false,
      data: null,
      erros: resultado.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    };
  }
  return { ok: true, data: resultado.data, erros: [] };
}
