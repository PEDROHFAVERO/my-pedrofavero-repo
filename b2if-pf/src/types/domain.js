/**
 * domain.js — Interfaces de domínio do B2IF PF
 *
 * Em JavaScript puro, usamos JSDoc para documentar os tipos.
 * Quando migrarmos para TypeScript (.ts), estes comentários
 * se tornarão interfaces reais com verificação em compile-time.
 *
 * @fileoverview Tipos centrais de domínio — fonte única da verdade
 */

/**
 * @typedef {'receita' | 'despesa'} TipoTransacao
 */

/**
 * @typedef {'pendente' | 'categorizado' | 'rascunho'} StatusTransacao
 */

/**
 * @typedef {'csv' | 'pdf' | 'whatsapp' | 'manual'} OrigemTransacao
 */

/**
 * @typedef {Object} Transacao
 * @property {string}           id              - UUID único (crypto.randomUUID())
 * @property {string}           data            - YYYY-MM-DD
 * @property {string}           descricao       - Descrição original
 * @property {number}           valor           - Sempre positivo (tipo define sinal)
 * @property {TipoTransacao}    tipo            - 'receita' | 'despesa'
 * @property {string|null}      categoria       - ID da categoria interna
 * @property {string}           [subcategoria]  - Subcategoria opcional
 * @property {string}           conta           - Nome da conta/banco
 * @property {string}           [competencia]   - YYYY-MM (mês de competência)
 * @property {string}           [periodoLabel]  - Ex: "Janeiro 2026"
 * @property {number|null}      [parcelaAtual]  - Parcela atual (ex: 3)
 * @property {number|null}      [parcelaTotal]  - Total de parcelas (ex: 10)
 * @property {number}           [parcelasRestantes] - Parcelas ainda a vencer
 * @property {StatusTransacao}  status          - Estado da transação
 * @property {OrigemTransacao}  [origem]        - Fonte dos dados
 * @property {string}           [formato]       - pix | cartao_credito | cartao_debito | dinheiro | boleto | ted
 * @property {boolean}          [_duplicata]    - Flag interna: marcada como duplicata
 * @property {boolean}          [_selecionado]  - Flag interna: selecionada para importação
 */

/**
 * @typedef {Object} Categoria
 * @property {string}  id           - ID único (snake_case, ex: 'alimentacao_fora')
 * @property {string}  nome         - Nome exibido
 * @property {string}  grupo        - Grupo macro (GRUPOS.CONSUMO, etc.)
 * @property {string}  [tipo]       - 'receita' | 'despesa'
 * @property {boolean} [isCategoria] - true = categoria nível 2 (agrupa subcategorias)
 * @property {string}  [categoria]  - ID da categoria pai (nível 2)
 * @property {boolean} [oculto]     - Ocultar na UI
 */

/**
 * @typedef {Object} ContaAPagar
 * @property {string}  id            - UUID
 * @property {string}  nome          - Nome do compromisso (ex: "Aluguel")
 * @property {number}  valor         - Valor esperado
 * @property {number}  diaVencimento - Dia do mês (1-31)
 * @property {string}  categoriaId   - ID da categoria associada
 * @property {boolean} ativo         - Se está ativo
 */

/**
 * @typedef {Object} Conta
 * @property {string} id   - UUID
 * @property {string} nome - Nome da conta (ex: "Nubank", "BB")
 */

/**
 * @typedef {Object} PlanejamentoCategoria
 * @property {number} projetado - Valor projetado para o mês
 * @property {number} parcelas  - Parcelas comprometidas
 */

/**
 * @typedef {Object.<string, Object.<number, Object.<string, PlanejamentoCategoria>>>} Planejamento
 * Estrutura: { [ano: string]: { [mes: number]: { [categoriaId: string]: PlanejamentoCategoria } } }
 */

/**
 * @typedef {Object} ClienteAtivo
 * @property {string}       id            - ID do cliente (texto, nanoid legado)
 * @property {string}       nome          - Nome completo
 * @property {string}       planejador_id - UUID do planejador dono
 * @property {number}       anoAtivo      - Ano selecionado (ex: 2026)
 * @property {Transacao[]}  transacoes    - Todas as transações importadas
 * @property {Categoria[]}  categorias    - Árvore de categorias
 * @property {Planejamento} planejamento  - Orçamento por ano/mês/categoria
 * @property {ContaAPagar[]} contasAPagar - Compromissos fixos mensais
 * @property {Conta[]}      contas        - Contas/bancos cadastrados
 * @property {string}       [notas]       - Notas do planejador (HTML TipTap)
 * @property {Object}       [dados]       - Blob JSONB bruto do banco (deprecated — usar campos normalizados)
 */

/**
 * @typedef {'planejador' | 'manager'} RolePlanejador
 */

/**
 * @typedef {Object} PlanejadorPerfil
 * @property {string}         id     - UUID (= auth.users.id)
 * @property {string}         nome   - Nome
 * @property {string}         email  - Email
 * @property {RolePlanejador} role   - Papel no sistema
 * @property {boolean}        ativo  - Conta ativa
 */

/**
 * @typedef {Object} ClientePerfil
 * @property {string}  id    - UUID (= auth.users.id)
 * @property {string}  nome  - Nome
 * @property {string}  email - Email
 * @property {'cliente'} role
 * @property {boolean} ativo
 */

/**
 * @typedef {Object} Sessao
 * @property {{ id: string, email: string }} user  - Usuário autenticado
 * @property {PlanejadorPerfil | ClientePerfil | null} perfil - Perfil resolvido
 * @property {string | null}    clienteId   - Só para role=cliente
 * @property {'visualizacao' | 'editor'} [modoAcesso] - Só para role=cliente
 */

/**
 * @typedef {Object} ProcessPDFRequest
 * @property {string} textoPDF  - Texto extraído do PDF (≤15000 chars)
 * @property {string} nomeConta - Nome da conta/banco
 */

/**
 * @typedef {Object} ProcessPDFResult
 * @property {boolean}     ok          - Sucesso
 * @property {string}      tipoDoc     - 'fatura' | 'extrato'
 * @property {string}      compFatura  - YYYY-MM (só para faturas)
 * @property {string}      vencimento  - YYYY-MM-DD (só para faturas)
 * @property {Transacao[]} transacoes  - Transações processadas
 */

// Este arquivo é intencionalente só JSDoc.
// Não exporta nada em runtime — é documentação de tipos para o editor.
export {};
