// Categorias padrão B2IF — versão 5.0
// Estrutura hierárquica: Macro → Categoria → Subcategoria
//
// GRUPOS  = macros (nível 1)
// CATEGORIAS_PADRAO contém dois tipos de objetos:
//   • isCategoria: true  → Categoria intermediária (nível 2, agrupador visual)
//   • isCategoria: false → Subcategoria (nível 3, onde as transações são lançadas)
//     └ campo `categoria` aponta para o id da categoria intermediária pai
//
// v5.0 — Reestruturação conceitual: Despesas Fixas → Despesas Essenciais
//
// ERROS CORRIGIDOS DA v4.0:
//   • Nome "Saúde" duplicado (cat_saude_fixa e cat_saude) → unificados em cat_saude em Essenciais
//   • Nome "Educação" duplicado (cat_educ_fixa e subcat educacao) → subcat renomeada para 'Mensalidade Escolar'
//   • Nome "Assinaturas" duplicado (cat e subcat com mesmo nome) → subcat renomeada dentro de novo contexto
//   • Nome "Transporte" duplicado (cat_transp_fixo e cat_transporte) → unificados em cat_transporte em Essenciais
//   • Nome "Funcionário" duplicado (cat e subcat com mesmo nome) → subcat era redundante, removida
//   • Nome "Lazer" duplicado (cat_lazer e subcat lazer) → subcat renomeada para 'Lazer Diverso'
//   • Nome "Casa" duplicado (cat_casa e subcat casa) → cat_casa vira alias oculto
//   • Nome "Pets" duplicado (cat_pets e subcat pets) → subcat renomeada para 'Gastos com Pet'
//   • Nome "Doações" duplicado (cat_doacoes e subcat doacoes) → subcat renomeada para 'Doações/Dízimo'
//   • gasolina e combustivel duplicados semanticamente → gasolina vira alias de combustivel
//   • outros e sem_categoria coexistiam em Não Essencial → sem_categoria vira alias de outros
//   • farmacia e drogaria (alias) com mesmo nome visível → drogaria continua alias oculto
//
// MUDANÇAS ESTRUTURAIS v5.0:
//   • GRUPOS.FIXAS renomeado para 'Despesas Essenciais' (conceito ampliado)
//   • Receitas: 3 categorias novas (Receita Fixa, Receita Variável, Receitas Pontuais)
//     substitui Trabalho CLT / Renda Variável / Entradas Não Recorrentes
//   • Saúde: unificada em Essenciais (antes dividida em Fixas+Consumo)
//     + Academia migrou de Bem-estar/Consumo para Saúde/Essenciais
//   • Transporte: unificado em Essenciais (antes IPVA em Fixas e resto no Consumo)
//   • Alimentação: supermercado/feira/açougue → Essenciais; restaurante/delivery → Consumo
//   • Educação: reestruturada em Essenciais com subcats claras
//   • Custos Profissionais e Impostos: substitui Assinaturas + Obrigações (eram confusos)
//   • Funcionários: Prestador de Serviços adicionado
//   • Consumo Mensal: Bem-estar ampliado + Vestuário/Acessórios entram aqui
//   • Lazer: Streaming vira subcategoria própria
//   • Pets: subcat renomeada para 'Gastos com Pet'
//   • Livre: substitui 'Não Essencial' + absorve Livros/Cursos
//   • Dívidas: Empréstimos Bancários e Particulares separados; Juros ampliado
//   • Investimentos: dividido em 'Aportes' e 'Custos e Taxas'
//   • Fluxo Interno: Saque Físico e Pagamento de Fatura adicionados
//
// REGRA DE ALIASES (oculto: true):
//   IDs que somem da nova estrutura mas possuem transações históricas no banco.
//   Não aparecem na UI mas resolvem lançamentos antigos.
//   São mantidos indefinidamente para não corromper histórico.

export const MESES      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                           'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const GRUPOS = {
  RECEITAS:      'Receitas',
  FIXAS:         'Despesas Essenciais',   // v5.0: era 'Despesas Fixas'
  CONSUMO:       'Consumo Mensal',
  DIVIDAS:       'Dívidas',
  INVESTIMENTOS: 'Investimentos',
  INTERNO:       'Fluxo Interno',
};

export const CATEGORIAS_PADRAO = [

  // ════════════════════════════════════════════════════════════════════════════
  // RECEITAS
  // v5.0: Trabalho CLT → Receita Fixa (neutro para CLT, PJ e autônomos)
  //       Renda Variável → Receita Variável (sem mudança de ID de subcats)
  //       Entradas Não Recorrentes → Receitas Pontuais
  // ════════════════════════════════════════════════════════════════════════════

  // ── Receita Fixa ────────────────────────────────────────────────────────────
  { id: 'cat_receita_fixa',    nome: 'Receita Fixa',             grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: true },
  { id: 'salario',             nome: 'Salário',                  grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_receita_fixa' },
  { id: 'ferias',              nome: 'Férias',                   grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_receita_fixa' },
  { id: 'decimo_terceiro',     nome: '13º Salário',              grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_receita_fixa' },
  { id: 'pro_labore',          nome: 'Pró-labore',               grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_receita_fixa' },

  // ── Receita Variável ────────────────────────────────────────────────────────
  { id: 'cat_renda_variavel',  nome: 'Receita Variável',         grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: true },
  { id: 'dividendos',          nome: 'Distribuição de Lucros',   grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_renda_variavel' },
  { id: 'rec_investimentos',   nome: 'Rendimentos Financeiros',  grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_renda_variavel' },
  { id: 'renda_extra',         nome: 'Renda Extra',              grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_renda_variavel' },
  { id: 'aluguel_rec',         nome: 'Aluguel Recebido',         grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_renda_variavel' },

  // ── Receitas Pontuais ───────────────────────────────────────────────────────
  { id: 'cat_entradas_nr',     nome: 'Receitas Pontuais',        grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: true },
  { id: 'bonus_plr',           nome: 'Bônus/PLR',                grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_entradas_nr' },
  { id: 'reembolso',           nome: 'Reembolso',                grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_entradas_nr' },
  { id: 'emprestimo_rec',      nome: 'Empréstimos Recebidos',    grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_entradas_nr' },
  { id: 'restituicao_irpf',    nome: 'Restituição do IRPF',      grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_entradas_nr' },
  { id: 'resgates',            nome: 'Resgates',                 grupo: GRUPOS.RECEITAS,      tipo: 'receita',  isCategoria: false, categoria: 'cat_entradas_nr' },


  // ════════════════════════════════════════════════════════════════════════════
  // DESPESAS ESSENCIAIS (era "Despesas Fixas")
  // v5.0: conceito ampliado — inclui consumos essenciais variáveis
  // ════════════════════════════════════════════════════════════════════════════

  // ── Moradia ──────────────────────────────────────────────────────────────────
  { id: 'cat_moradia',         nome: 'Moradia',                  grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: true },
  { id: 'aluguel_prest',       nome: 'Aluguel/Prestação',        grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia' },
  { id: 'condominio',          nome: 'Condomínio',               grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia' },
  { id: 'iptu',                nome: 'IPTU',                     grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia' },
  { id: 'energia',             nome: 'Energia',                  grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia' },
  { id: 'agua',                nome: 'Água',                     grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia' },
  { id: 'gas',                 nome: 'Gás',                      grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia' },
  { id: 'internet',            nome: 'Internet',                 grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia' },
  { id: 'telefone',            nome: 'Telefone',                 grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia' },
  { id: 'celular',             nome: 'Celular',                  grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia' },
  { id: 'manutencao_res',      nome: 'Manutenção Residencial',   grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia' },

  // ── Saúde ─────────────────────────────────────────────────────────────────
  // v5.0: unifica cat_saude_fixa (Fixas) + cat_saude (Consumo) em um único cat_saude em Essenciais
  // Academia migrou de Bem-estar/Consumo para cá (Q1 confirmado)
  { id: 'cat_saude',           nome: 'Saúde',                    grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: true },
  { id: 'saude',               nome: 'Plano de Saúde',           grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_saude' },
  { id: 'plano_odonto',        nome: 'Plano Odontológico',       grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_saude' },
  { id: 'farmacia',            nome: 'Drogaria/Farmácia',        grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_saude' },
  { id: 'consulta',            nome: 'Consultas/Exames',         grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_saude' },
  { id: 'academia',            nome: 'Academia',                 grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_saude' },

  // ── Seguros ───────────────────────────────────────────────────────────────
  { id: 'cat_seguros',         nome: 'Seguros',                  grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: true },
  { id: 'seguro_vida',         nome: 'Seguro de Vida',           grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_seguros' },
  { id: 'seguro_carro',        nome: 'Seguro de Carro',          grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_seguros' },
  { id: 'seguro_res',          nome: 'Seguro Residencial',       grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_seguros' },

  // ── Educação ─────────────────────────────────────────────────────────────
  // v5.0: educacao (subcat genérica antiga) vira alias oculto;
  //       educacao_filhos vira alias de mensalidade_escolar
  { id: 'cat_educ_fixa',       nome: 'Educação',                 grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: true },
  { id: 'faculdade_mba',       nome: 'Faculdade/MBA',            grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_educ_fixa' },
  { id: 'mensalidade_escolar', nome: 'Mensalidade Escolar',      grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_educ_fixa' },
  { id: 'material_didatico',   nome: 'Material Didático',        grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_educ_fixa' },
  { id: 'transp_escolar',      nome: 'Transporte Escolar',       grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_educ_fixa' },

  // ── Custos Profissionais e Impostos ───────────────────────────────────────
  // v5.0: substitui cat_assinaturas + cat_obrigacoes (ambas tinham nomes duplicados internos)
  { id: 'cat_custos_prof',     nome: 'Custos Profissionais e Impostos', grupo: GRUPOS.FIXAS,  tipo: 'despesa',  isCategoria: true },
  { id: 'assinaturas',         nome: 'Assinaturas de Softwares', grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_custos_prof' },
  { id: 'anuidade',            nome: 'Anuidades de Conselhos',   grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_custos_prof' },
  { id: 'impostos',            nome: 'Impostos/Taxas',           grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_custos_prof' },

  // ── Transporte ────────────────────────────────────────────────────────────
  // v5.0: unifica cat_transp_fixo (só IPVA) + cat_transporte (resto no Consumo)
  { id: 'cat_transporte',      nome: 'Transporte',               grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: true },
  { id: 'ipva',                nome: 'IPVA',                     grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_transporte' },
  { id: 'passagem',            nome: 'Passagem/Transporte Público', grupo: GRUPOS.FIXAS,      tipo: 'despesa',  isCategoria: false, categoria: 'cat_transporte' },
  { id: 'combustivel',         nome: 'Combustível',              grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_transporte' },
  { id: 'manutencao',          nome: 'Manutenção Veicular',      grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_transporte' },
  { id: 'estacionamento',      nome: 'Estacionamento/Vaga',      grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_transporte' },
  { id: 'lava_jato',           nome: 'Lava-Jato',                grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_transporte' },
  { id: 'uber',                nome: 'Uber/99/Táxi',             grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_transporte' },
  { id: 'aluguel_financ_veiculo', nome: 'Aluguel/Financ. Veículo', grupo: GRUPOS.FIXAS,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_transporte' },

  // ── Funcionários ─────────────────────────────────────────────────────────
  { id: 'cat_funcionario',     nome: 'Funcionários',             grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: true },
  { id: 'salario_diaria',      nome: 'Salário/Diária',           grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_funcionario' },
  { id: 'encargos',            nome: 'Encargos Trabalhistas',    grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_funcionario' },
  { id: 'prestador',           nome: 'Prestador de Serviços',    grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_funcionario' },

  // ── Alimentação Essencial ─────────────────────────────────────────────────
  // v5.0: supermercado/feira/açougue migram de Consumo para Essenciais
  { id: 'cat_alim_essencial',  nome: 'Alimentação',              grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: true },
  { id: 'supermercado',        nome: 'Supermercado',             grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_alim_essencial' },
  { id: 'feira',               nome: 'Feira',                    grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_alim_essencial' },
  { id: 'acougue',             nome: 'Açougue',                  grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_alim_essencial' },


  // ════════════════════════════════════════════════════════════════════════════
  // CONSUMO MENSAL
  // v5.0: redesenhado — foco em consumo discricionário e qualidade de vida
  // ════════════════════════════════════════════════════════════════════════════

  // ── Alimentação (Consumo) ─────────────────────────────────────────────────
  { id: 'cat_alimentacao',     nome: 'Alimentação (Consumo)',    grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: true },
  { id: 'alimentacao_fora',    nome: 'Restaurante/Delivery',     grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_alimentacao' },

  // ── Bem-estar ─────────────────────────────────────────────────────────────
  // v5.0: academia saiu; vestuário e acessórios entraram
  { id: 'cat_bem_estar',       nome: 'Bem-estar',                grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: true },
  { id: 'personal',            nome: 'Personal Trainer',         grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_bem_estar' },
  { id: 'esporte',             nome: 'Esportes/Hobby',           grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_bem_estar' },
  { id: 'beleza',              nome: 'Beleza/Salão/Barbearia',   grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_bem_estar' },
  { id: 'cosmeticos',          nome: 'Cosméticos/Cuidados Pessoais', grupo: GRUPOS.CONSUMO,   tipo: 'despesa',  isCategoria: false, categoria: 'cat_bem_estar' },
  { id: 'vestuario',           nome: 'Vestuário',                grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_bem_estar' },
  { id: 'acessorios',          nome: 'Acessórios',               grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_bem_estar' },

  // ── Lazer ─────────────────────────────────────────────────────────────────
  // v5.0: lazer (subcat) renomeada para 'Lazer Diverso'; streaming vira subcat própria
  { id: 'cat_lazer',           nome: 'Lazer',                    grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: true },
  { id: 'lazer',               nome: 'Lazer Diverso',            grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_lazer' },
  { id: 'streaming',           nome: 'Serviços de Streaming',    grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_lazer' },
  { id: 'viagem',              nome: 'Viagens',                  grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_lazer' },
  { id: 'clube',               nome: 'Clube/Associações',        grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_lazer' },

  // ── Pets ──────────────────────────────────────────────────────────────────
  // v5.0: subcat 'pets' renomeada para 'Gastos com Pet' (era duplicata do nome da cat)
  { id: 'cat_pets',            nome: 'Pets',                     grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: true },
  { id: 'pets',                nome: 'Gastos com Pet',           grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_pets' },

  // ── Doações ───────────────────────────────────────────────────────────────
  // v5.0: subcat 'doacoes' renomeada para 'Doações/Dízimo' (era duplicata do nome da cat)
  { id: 'cat_doacoes',         nome: 'Doações',                  grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: true },
  { id: 'doacoes',             nome: 'Doações/Dízimo',           grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_doacoes' },

  // ── Livre ─────────────────────────────────────────────────────────────────
  // v5.0: substitui 'Não Essencial' + absorve Livros/Cursos (Q2)
  // Vestuário e Acessórios migraram para Bem-estar
  { id: 'cat_nao_essencial',   nome: 'Livre',                    grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: true },
  { id: 'presente',            nome: 'Presentes',                grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_nao_essencial' },
  { id: 'papelaria',           nome: 'Papelaria',                grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_nao_essencial' },
  { id: 'comemoracoes',        nome: 'Comemorações/Festas',      grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_nao_essencial' },
  { id: 'livro_curso',         nome: 'Livros/Cursos',            grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_nao_essencial' },
  { id: 'outros',              nome: 'Outros Consumos',          grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_nao_essencial' },


  // ════════════════════════════════════════════════════════════════════════════
  // ALIASES DE COMPATIBILIDADE — IDs removidos ou movidos na v5.0
  // oculto: true → invisíveis na UI, mas resolvem transações históricas
  // ════════════════════════════════════════════════════════════════════════════

  // --- Receitas ---
  // cat_trabalho_clt → cat_receita_fixa (apenas a cat pai mudou; subcats mantiveram IDs)
  // bonus_plr mudou de cat pai: trabalho_clt → entradas_nr (OK, ID mantido)
  // juros_rec sumiu (nenhum cliente deve ter receita de juros categorizados assim — sem alias necessário)
  // dividendos renomeado para 'Distribuição de Lucros' (ID mantido, nome updated via merge)

  // --- Despesas Essenciais ---
  // custos_imoveis (Custos Imóveis) → manutencao_res (Manutenção Residencial) [ID novo, alias para o antigo]
  { id: 'custos_imoveis',      nome: 'Manutenção Residencial',   grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia',       oculto: true },
  // cat_saude_fixa some — subcats migradas: saude, farmacia, consulta, academia já têm IDs mantidos em cat_saude
  // drogaria era alias de farmacia — mantém
  { id: 'drogaria',            nome: 'Drogaria/Farmácia',        grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_saude',         oculto: true },
  // educacao (subcat genérica) → mensalidade_escolar
  { id: 'educacao',            nome: 'Mensalidade Escolar',      grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_educ_fixa',     oculto: true },
  // educacao_filhos → mensalidade_escolar
  { id: 'educacao_filhos',     nome: 'Mensalidade Escolar',      grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_educ_fixa',     oculto: true },
  // material_escolar (era em Livros e Cursos/Consumo) → material_didatico em Educação/Essenciais
  { id: 'material_escolar',    nome: 'Material Didático',        grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_educ_fixa',     oculto: true },
  // cat_assinaturas some → assinaturas migrou para cat_custos_prof (ID mantido)
  // cat_obrigacoes some; tarifas absorvida por impostos
  { id: 'tarifas',             nome: 'Impostos/Taxas',           grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_custos_prof',   oculto: true },
  // cat_transp_fixo some → ipva migrou para cat_transporte (ID mantido)
  // funcionario (subcat redundante, mesmo nome da cat) → salario_diaria
  { id: 'funcionario',         nome: 'Salário/Diária',           grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_funcionario',   oculto: true },
  // cat_alimentacao (era Consumo) → cat_alim_essencial (Essenciais) — supermercado/ID mantidos
  // gasolina era duplicata semântica de combustivel
  { id: 'gasolina',            nome: 'Combustível',              grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_transporte',    oculto: true },
  // carro era subcat vaga em Consumo/Transporte — sem equivalente direto
  { id: 'carro',               nome: 'Manutenção Veicular',      grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_transporte',    oculto: true },
  // aluguel_carro some (nenhuma cat equivalente na nova lista — mapeado para Lazer/Viagens)
  { id: 'aluguel_carro',       nome: 'Viagens',                  grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_lazer',         oculto: true },

  // --- Consumo Mensal ---
  // padaria era Alimentação/Consumo — mapeada para Alimentação Essencial (supermercado)
  { id: 'padaria',             nome: 'Supermercado',             grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_alim_essencial', oculto: true },
  // cuidados_pessoais unificada em cosmeticos (novo nome 'Cosméticos/Cuidados Pessoais')
  { id: 'cuidados_pessoais',   nome: 'Cosméticos/Cuidados Pessoais', grupo: GRUPOS.CONSUMO,  tipo: 'despesa',  isCategoria: false, categoria: 'cat_bem_estar',     oculto: true },
  // cat_casa some (Q3: decoracao e reforma ficam ocultas)
  { id: 'casa',                nome: 'Manutenção Residencial',   grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia',       oculto: true },
  { id: 'decoracao',           nome: 'Manutenção Residencial',   grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia',       oculto: true },
  { id: 'reforma',             nome: 'Manutenção Residencial',   grupo: GRUPOS.FIXAS,         tipo: 'despesa',  isCategoria: false, categoria: 'cat_moradia',       oculto: true },
  // cat_educ_var (Livros e Cursos) some — livro_curso migrou para Livre (ID mantido)
  // cat_saques some — saque migra para Fluxo Interno
  { id: 'saque',               nome: 'Saque Físico',             grupo: GRUPOS.INTERNO,       tipo: 'neutro',   isCategoria: false, categoria: 'cat_fluxo_interno', oculto: true },
  // sem_categoria era duplicata de outros (Q: auditoria identificou)
  { id: 'sem_categoria',       nome: 'Outros Consumos',          grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_nao_essencial', oculto: true },
  // festa_aniversario absorvida por comemoracoes
  { id: 'festa_aniversario',   nome: 'Comemorações/Festas',      grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_nao_essencial', oculto: true },
  // nao_lembro → outros (alias da v4)
  { id: 'nao_lembro',          nome: 'Outros Consumos',          grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_nao_essencial', oculto: true },
  // compras_online → outros (alias da v4)
  { id: 'compras_online',      nome: 'Outros Consumos',          grupo: GRUPOS.CONSUMO,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_nao_essencial', oculto: true },


  // ════════════════════════════════════════════════════════════════════════════
  // DÍVIDAS
  // v5.0: Empréstimos separado em Bancários e Particulares; Juros com descrição melhor
  // ════════════════════════════════════════════════════════════════════════════

  { id: 'cat_dividas',         nome: 'Dívidas',                  grupo: GRUPOS.DIVIDAS,       tipo: 'despesa',  isCategoria: true },
  { id: 'fin_cartao',          nome: 'Financiamento de Cartão/Rotativo', grupo: GRUPOS.DIVIDAS, tipo: 'despesa', isCategoria: false, categoria: 'cat_dividas' },
  { id: 'emprestimo',          nome: 'Empréstimos Bancários',    grupo: GRUPOS.DIVIDAS,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_dividas' },
  { id: 'emprestimo_part',     nome: 'Empréstimos Particulares', grupo: GRUPOS.DIVIDAS,       tipo: 'despesa',  isCategoria: false, categoria: 'cat_dividas' },
  { id: 'juros_div',           nome: 'Juros e Tarifas por Atraso', grupo: GRUPOS.DIVIDAS,     tipo: 'despesa',  isCategoria: false, categoria: 'cat_dividas' },


  // ════════════════════════════════════════════════════════════════════════════
  // INVESTIMENTOS
  // v5.0: dividido em Aportes e Custos e Taxas
  // ════════════════════════════════════════════════════════════════════════════

  // ── Aportes ───────────────────────────────────────────────────────────────
  { id: 'cat_investimentos',   nome: 'Aportes',                  grupo: GRUPOS.INVESTIMENTOS, tipo: 'despesa',  isCategoria: true },
  { id: 'reserva',             nome: 'Reserva de Emergência',    grupo: GRUPOS.INVESTIMENTOS, tipo: 'despesa',  isCategoria: false, categoria: 'cat_investimentos' },
  { id: 'investimento',        nome: 'Aplicações Gerais',        grupo: GRUPOS.INVESTIMENTOS, tipo: 'despesa',  isCategoria: false, categoria: 'cat_investimentos' },
  { id: 'previdencia',         nome: 'Previdência Privada',      grupo: GRUPOS.INVESTIMENTOS, tipo: 'despesa',  isCategoria: false, categoria: 'cat_investimentos' },

  // ── Custos e Taxas ────────────────────────────────────────────────────────
  { id: 'cat_custos_invest',   nome: 'Custos e Taxas',           grupo: GRUPOS.INVESTIMENTOS, tipo: 'despesa',  isCategoria: true },
  { id: 'custodia',            nome: 'Custódia',                 grupo: GRUPOS.INVESTIMENTOS, tipo: 'despesa',  isCategoria: false, categoria: 'cat_custos_invest' },
  { id: 'custos_op',           nome: 'Custos Operacionais/Corretagem', grupo: GRUPOS.INVESTIMENTOS, tipo: 'despesa', isCategoria: false, categoria: 'cat_custos_invest' },
  { id: 'iof',                 nome: 'IOF',                      grupo: GRUPOS.INVESTIMENTOS, tipo: 'despesa',  isCategoria: false, categoria: 'cat_custos_invest' },
  { id: 'ir',                  nome: 'IR',                       grupo: GRUPOS.INVESTIMENTOS, tipo: 'despesa',  isCategoria: false, categoria: 'cat_custos_invest' },
  { id: 'perdas',              nome: 'Perdas',                   grupo: GRUPOS.INVESTIMENTOS, tipo: 'despesa',  isCategoria: false, categoria: 'cat_custos_invest' },


  // ════════════════════════════════════════════════════════════════════════════
  // FLUXO INTERNO
  // v5.0: Saque Físico e Pagamento de Fatura adicionados
  // ════════════════════════════════════════════════════════════════════════════

  { id: 'cat_fluxo_interno',   nome: 'Movimentações Internas',   grupo: GRUPOS.INTERNO,       tipo: 'neutro',   isCategoria: true },
  { id: 'entre_contas',        nome: 'Transferência Entre Contas', grupo: GRUPOS.INTERNO,     tipo: 'neutro',   isCategoria: false, categoria: 'cat_fluxo_interno' },
  { id: 'saque_fisico',        nome: 'Saque Físico',             grupo: GRUPOS.INTERNO,       tipo: 'neutro',   isCategoria: false, categoria: 'cat_fluxo_interno' },
  { id: 'pgto_fatura',         nome: 'Pagamento de Fatura',      grupo: GRUPOS.INTERNO,       tipo: 'neutro',   isCategoria: false, categoria: 'cat_fluxo_interno' },

];

// ─── Helpers de consulta ────────────────────────────────────────────────────────

/** Retorna apenas as categorias intermediárias (isCategoria: true) */
export const CATEGORIAS_NIVEL2 = CATEGORIAS_PADRAO.filter(c => c.isCategoria === true);

/** Retorna apenas as subcategorias (isCategoria: false) — lançamentos reais */
export const SUBCATEGORIAS = CATEGORIAS_PADRAO.filter(c => c.isCategoria === false);

/**
 * Dado um array de categorias do cliente (pode incluir customizadas),
 * retorna as subcategorias agrupadas por categoria intermediária.
 */
export function agruparPorCategoria(categorias) {
  const cats = categorias ?? CATEGORIAS_PADRAO;
  const subs = cats.filter(c => !c.isCategoria);
  const result = {};
  for (const s of subs) {
    const key = s.categoria ?? 'cat_nao_essencial';
    if (!result[key]) result[key] = [];
    result[key].push(s);
  }
  return result;
}

/**
 * Dado um id de subcategoria, retorna o id da categoria pai.
 */
export function categoriaPai(subcatId, categorias) {
  const cats = categorias ?? CATEGORIAS_PADRAO;
  const found = cats.find(c => c.id === subcatId);
  return found?.categoria ?? null;
}

/**
 * Dado um id de subcategoria, retorna o objeto da categoria pai.
 */
export function categoriaPaiObj(subcatId, categorias) {
  const cats = categorias ?? CATEGORIAS_PADRAO;
  const sub = cats.find(c => c.id === subcatId);
  if (!sub?.categoria) return null;
  return cats.find(c => c.id === sub.categoria) ?? null;
}


// ─── Regras padrão de auto-categorização (keyword → subcategoria id) ──────────
// v5.0: atualizadas para refletir nova estrutura
export const REGRAS_PADRAO = [

  // Receitas
  { keyword: 'salario',           categoria: 'salario',          prioridade: 1 },
  { keyword: 'salário',           categoria: 'salario',          prioridade: 1 },
  { keyword: 'pagamento rh',      categoria: 'salario',          prioridade: 1 },
  { keyword: 'holerite',          categoria: 'salario',          prioridade: 1 },
  { keyword: 'pro labore',        categoria: 'pro_labore',       prioridade: 1 },
  { keyword: 'pró-labore',        categoria: 'pro_labore',       prioridade: 1 },
  { keyword: 'prolabore',         categoria: 'pro_labore',       prioridade: 1 },
  { keyword: 'ferias',            categoria: 'ferias',           prioridade: 1 },
  { keyword: 'férias',            categoria: 'ferias',           prioridade: 1 },
  { keyword: '13 salario',        categoria: 'decimo_terceiro',  prioridade: 1 },
  { keyword: '13º',               categoria: 'decimo_terceiro',  prioridade: 1 },
  { keyword: 'bonus',             categoria: 'bonus_plr',        prioridade: 2 },
  { keyword: 'bônus',             categoria: 'bonus_plr',        prioridade: 2 },
  { keyword: 'plr',               categoria: 'bonus_plr',        prioridade: 2 },
  { keyword: 'reembolso',         categoria: 'reembolso',        prioridade: 2 },
  { keyword: 'restituicao irpf',  categoria: 'restituicao_irpf', prioridade: 1 },
  { keyword: 'restituição',       categoria: 'restituicao_irpf', prioridade: 2 },
  { keyword: 'resgate',           categoria: 'resgates',         prioridade: 2 },
  { keyword: 'rendimento',        categoria: 'rec_investimentos', prioridade: 2 },
  { keyword: 'dividendo',         categoria: 'dividendos',       prioridade: 2 },
  { keyword: 'lucro',             categoria: 'dividendos',       prioridade: 3 },
  { keyword: 'aluguel recebido',  categoria: 'aluguel_rec',      prioridade: 1 },
  { keyword: 'renda extra',       categoria: 'renda_extra',      prioridade: 2 },

  // Moradia
  { keyword: 'aluguel',          categoria: 'aluguel_prest',     prioridade: 2 },
  { keyword: 'condominio',       categoria: 'condominio',        prioridade: 1 },
  { keyword: 'condomínio',       categoria: 'condominio',        prioridade: 1 },
  { keyword: 'iptu',             categoria: 'iptu',              prioridade: 1 },
  { keyword: 'energia',          categoria: 'energia',           prioridade: 1 },
  { keyword: 'luz',              categoria: 'energia',           prioridade: 2 },
  { keyword: 'enel',             categoria: 'energia',           prioridade: 1 },
  { keyword: 'cpfl',             categoria: 'energia',           prioridade: 1 },
  { keyword: 'agua',             categoria: 'agua',              prioridade: 1 },
  { keyword: 'água',             categoria: 'agua',              prioridade: 1 },
  { keyword: 'sabesp',           categoria: 'agua',              prioridade: 1 },
  { keyword: 'gas',              categoria: 'gas',               prioridade: 2 },
  { keyword: 'gás',              categoria: 'gas',               prioridade: 2 },
  { keyword: 'comgas',           categoria: 'gas',               prioridade: 1 },
  { keyword: 'internet',         categoria: 'internet',          prioridade: 1 },
  { keyword: 'claro',            categoria: 'internet',          prioridade: 2 },
  { keyword: 'vivo',             categoria: 'celular',           prioridade: 2 },
  { keyword: 'tim ',             categoria: 'celular',           prioridade: 2 },
  { keyword: 'oi ',              categoria: 'celular',           prioridade: 2 },
  { keyword: 'telefone',         categoria: 'telefone',          prioridade: 2 },
  { keyword: 'celular',          categoria: 'celular',           prioridade: 2 },

  // Saúde
  { keyword: 'plano de saude',   categoria: 'saude',             prioridade: 1 },
  { keyword: 'plano saude',      categoria: 'saude',             prioridade: 1 },
  { keyword: 'unimed',           categoria: 'saude',             prioridade: 1 },
  { keyword: 'amil',             categoria: 'saude',             prioridade: 1 },
  { keyword: 'bradesco saude',   categoria: 'saude',             prioridade: 1 },
  { keyword: 'sulamerica',       categoria: 'saude',             prioridade: 1 },
  { keyword: 'odonto',           categoria: 'plano_odonto',      prioridade: 1 },
  { keyword: 'farmacia',         categoria: 'farmacia',          prioridade: 1 },
  { keyword: 'drogaria',         categoria: 'farmacia',          prioridade: 1 },
  { keyword: 'droga',            categoria: 'farmacia',          prioridade: 2 },
  { keyword: 'consulta',         categoria: 'consulta',          prioridade: 2 },
  { keyword: 'exame',            categoria: 'consulta',          prioridade: 2 },
  { keyword: 'academia',         categoria: 'academia',          prioridade: 1 },
  { keyword: 'smart fit',        categoria: 'academia',          prioridade: 1 },

  // Seguros
  { keyword: 'seguro vida',      categoria: 'seguro_vida',       prioridade: 1 },
  { keyword: 'seguro auto',      categoria: 'seguro_carro',      prioridade: 1 },
  { keyword: 'seguro carro',     categoria: 'seguro_carro',      prioridade: 1 },
  { keyword: 'seguro residencial', categoria: 'seguro_res',      prioridade: 1 },

  // Educação
  { keyword: 'faculdade',        categoria: 'faculdade_mba',     prioridade: 1 },
  { keyword: 'mba',              categoria: 'faculdade_mba',     prioridade: 1 },
  { keyword: 'escola',           categoria: 'mensalidade_escolar', prioridade: 2 },
  { keyword: 'colegio',          categoria: 'mensalidade_escolar', prioridade: 2 },
  { keyword: 'colégio',          categoria: 'mensalidade_escolar', prioridade: 2 },
  { keyword: 'mensalidade',      categoria: 'mensalidade_escolar', prioridade: 3 },
  { keyword: 'transporte escolar', categoria: 'transp_escolar',  prioridade: 1 },

  // Custos Profissionais
  { keyword: 'software',         categoria: 'assinaturas',       prioridade: 2 },
  { keyword: 'assinatura',       categoria: 'assinaturas',       prioridade: 2 },
  { keyword: 'anuidade',         categoria: 'anuidade',          prioridade: 2 },
  { keyword: 'imposto',          categoria: 'impostos',          prioridade: 2 },
  { keyword: 'irrf',             categoria: 'impostos',          prioridade: 1 },
  { keyword: 'darf',             categoria: 'impostos',          prioridade: 1 },

  // Transporte
  { keyword: 'ipva',             categoria: 'ipva',              prioridade: 1 },
  { keyword: 'combustivel',      categoria: 'combustivel',       prioridade: 1 },
  { keyword: 'combustível',      categoria: 'combustivel',       prioridade: 1 },
  { keyword: 'gasolina',         categoria: 'combustivel',       prioridade: 1 },
  { keyword: 'etanol',           categoria: 'combustivel',       prioridade: 1 },
  { keyword: 'posto ',           categoria: 'combustivel',       prioridade: 2 },
  { keyword: 'manutencao',       categoria: 'manutencao',        prioridade: 2 },
  { keyword: 'manutenção',       categoria: 'manutencao',        prioridade: 2 },
  { keyword: 'oficina',          categoria: 'manutencao',        prioridade: 2 },
  { keyword: 'estacionamento',   categoria: 'estacionamento',    prioridade: 1 },
  { keyword: 'parking',          categoria: 'estacionamento',    prioridade: 1 },
  { keyword: 'lava jato',        categoria: 'lava_jato',         prioridade: 1 },
  { keyword: 'lava-jato',        categoria: 'lava_jato',         prioridade: 1 },
  { keyword: 'uber',             categoria: 'uber',              prioridade: 1 },
  { keyword: '99 ',              categoria: 'uber',              prioridade: 2 },
  { keyword: 'taxi',             categoria: 'uber',              prioridade: 2 },
  { keyword: 'táxi',             categoria: 'uber',              prioridade: 2 },
  { keyword: 'metro',            categoria: 'passagem',          prioridade: 1 },
  { keyword: 'metrô',            categoria: 'passagem',          prioridade: 1 },
  { keyword: 'onibus',           categoria: 'passagem',          prioridade: 1 },
  { keyword: 'ônibus',           categoria: 'passagem',          prioridade: 1 },
  { keyword: 'bilhete unico',    categoria: 'passagem',          prioridade: 1 },
  { keyword: 'passagem',         categoria: 'passagem',          prioridade: 2 },

  // Funcionários
  { keyword: 'diarista',         categoria: 'salario_diaria',    prioridade: 1 },
  { keyword: 'faxineira',        categoria: 'salario_diaria',    prioridade: 1 },
  { keyword: 'encargo',          categoria: 'encargos',          prioridade: 2 },
  { keyword: 'fgts',             categoria: 'encargos',          prioridade: 1 },
  { keyword: 'inss',             categoria: 'encargos',          prioridade: 1 },

  // Alimentação Essencial
  { keyword: 'supermercado',     categoria: 'supermercado',      prioridade: 1 },
  { keyword: 'mercado',          categoria: 'supermercado',      prioridade: 2 },
  { keyword: 'carrefour',        categoria: 'supermercado',      prioridade: 1 },
  { keyword: 'extra ',           categoria: 'supermercado',      prioridade: 1 },
  { keyword: 'pao de acucar',    categoria: 'supermercado',      prioridade: 1 },
  { keyword: 'atacadao',         categoria: 'supermercado',      prioridade: 1 },
  { keyword: 'atacadão',         categoria: 'supermercado',      prioridade: 1 },
  { keyword: 'hortifruti',       categoria: 'feira',             prioridade: 1 },
  { keyword: 'feira',            categoria: 'feira',             prioridade: 2 },
  { keyword: 'acougue',          categoria: 'acougue',           prioridade: 1 },
  { keyword: 'açougue',          categoria: 'acougue',           prioridade: 1 },

  // Alimentação Consumo
  { keyword: 'restaurante',      categoria: 'alimentacao_fora',  prioridade: 1 },
  { keyword: 'ifood',            categoria: 'alimentacao_fora',  prioridade: 1 },
  { keyword: 'delivery',         categoria: 'alimentacao_fora',  prioridade: 1 },
  { keyword: 'mcdonalds',        categoria: 'alimentacao_fora',  prioridade: 1 },
  { keyword: 'burger king',      categoria: 'alimentacao_fora',  prioridade: 1 },
  { keyword: 'starbucks',        categoria: 'alimentacao_fora',  prioridade: 1 },
  { keyword: 'lanchonete',       categoria: 'alimentacao_fora',  prioridade: 2 },
  { keyword: 'pizzaria',         categoria: 'alimentacao_fora',  prioridade: 1 },
  { keyword: 'padaria',          categoria: 'alimentacao_fora',  prioridade: 2 },

  // Bem-estar
  { keyword: 'personal',         categoria: 'personal',          prioridade: 1 },
  { keyword: 'salao',            categoria: 'beleza',            prioridade: 2 },
  { keyword: 'salão',            categoria: 'beleza',            prioridade: 2 },
  { keyword: 'barbearia',        categoria: 'beleza',            prioridade: 1 },
  { keyword: 'cabeleireiro',     categoria: 'beleza',            prioridade: 1 },
  { keyword: 'estetica',         categoria: 'beleza',            prioridade: 2 },
  { keyword: 'estética',         categoria: 'beleza',            prioridade: 2 },
  { keyword: 'vestuario',        categoria: 'vestuario',         prioridade: 2 },
  { keyword: 'vestuário',        categoria: 'vestuario',         prioridade: 2 },
  { keyword: 'roupa',            categoria: 'vestuario',         prioridade: 2 },
  { keyword: 'calçado',          categoria: 'vestuario',         prioridade: 2 },
  { keyword: 'calcado',          categoria: 'vestuario',         prioridade: 2 },
  { keyword: 'zara',             categoria: 'vestuario',         prioridade: 1 },
  { keyword: 'renner',           categoria: 'vestuario',         prioridade: 1 },
  { keyword: 'c&a',              categoria: 'vestuario',         prioridade: 1 },

  // Lazer
  { keyword: 'netflix',          categoria: 'streaming',         prioridade: 1 },
  { keyword: 'spotify',          categoria: 'streaming',         prioridade: 1 },
  { keyword: 'amazon prime',     categoria: 'streaming',         prioridade: 1 },
  { keyword: 'disney',           categoria: 'streaming',         prioridade: 1 },
  { keyword: 'hbo',              categoria: 'streaming',         prioridade: 1 },
  { keyword: 'apple tv',         categoria: 'streaming',         prioridade: 1 },
  { keyword: 'youtube premium',  categoria: 'streaming',         prioridade: 1 },
  { keyword: 'viagem',           categoria: 'viagem',            prioridade: 2 },
  { keyword: 'hotel',            categoria: 'viagem',            prioridade: 2 },
  { keyword: 'airbnb',           categoria: 'viagem',            prioridade: 1 },
  { keyword: 'clube',            categoria: 'clube',             prioridade: 2 },

  // Pets
  { keyword: 'pet shop',         categoria: 'pets',              prioridade: 1 },
  { keyword: 'veterinario',      categoria: 'pets',              prioridade: 1 },
  { keyword: 'veterinário',      categoria: 'pets',              prioridade: 1 },
  { keyword: 'racao',            categoria: 'pets',              prioridade: 1 },
  { keyword: 'ração',            categoria: 'pets',              prioridade: 1 },

  // Doações
  { keyword: 'dizimo',           categoria: 'doacoes',           prioridade: 1 },
  { keyword: 'dízimo',           categoria: 'doacoes',           prioridade: 1 },
  { keyword: 'doacao',           categoria: 'doacoes',           prioridade: 2 },
  { keyword: 'doação',           categoria: 'doacoes',           prioridade: 2 },

  // Livre
  { keyword: 'presente',         categoria: 'presente',          prioridade: 2 },
  { keyword: 'papelaria',        categoria: 'papelaria',         prioridade: 2 },
  { keyword: 'livraria',         categoria: 'livro_curso',       prioridade: 1 },
  { keyword: 'livro',            categoria: 'livro_curso',       prioridade: 2 },
  { keyword: 'curso',            categoria: 'livro_curso',       prioridade: 2 },
  { keyword: 'udemy',            categoria: 'livro_curso',       prioridade: 1 },

  // Dívidas
  { keyword: 'financiamento',    categoria: 'fin_cartao',        prioridade: 2 },
  { keyword: 'emprestimo',       categoria: 'emprestimo',        prioridade: 2 },
  { keyword: 'empréstimo',       categoria: 'emprestimo',        prioridade: 2 },
  { keyword: 'juros',            categoria: 'juros_div',         prioridade: 3 },

  // Investimentos
  { keyword: 'aporte',           categoria: 'investimento',      prioridade: 2 },
  { keyword: 'aplicacao',        categoria: 'investimento',      prioridade: 2 },
  { keyword: 'aplicação',        categoria: 'investimento',      prioridade: 2 },
  { keyword: 'previdencia',      categoria: 'previdencia',       prioridade: 1 },
  { keyword: 'previdência',      categoria: 'previdencia',       prioridade: 1 },
  { keyword: 'reserva',          categoria: 'reserva',           prioridade: 2 },
  { keyword: 'tesouro',          categoria: 'investimento',      prioridade: 2 },
  { keyword: 'custodia',         categoria: 'custodia',          prioridade: 2 },
  { keyword: 'custódia',         categoria: 'custodia',          prioridade: 2 },
  { keyword: 'corretagem',       categoria: 'custos_op',         prioridade: 1 },
  { keyword: 'iof',              categoria: 'iof',               prioridade: 1 },
  { keyword: 'imposto renda',    categoria: 'ir',                prioridade: 1 },

  // Fluxo Interno
  { keyword: 'transferencia',    categoria: 'entre_contas',      prioridade: 3 },
  { keyword: 'transferência',    categoria: 'entre_contas',      prioridade: 3 },
  { keyword: 'ted ',             categoria: 'entre_contas',      prioridade: 3 },
  { keyword: 'doc ',             categoria: 'entre_contas',      prioridade: 3 },
  { keyword: 'pix ',             categoria: 'entre_contas',      prioridade: 3 },
  { keyword: 'saque',            categoria: 'saque_fisico',      prioridade: 2 },
  { keyword: 'pagamento fatura', categoria: 'pgto_fatura',       prioridade: 1 },
  { keyword: 'fatura cartao',    categoria: 'pgto_fatura',       prioridade: 1 },
  { keyword: 'fatura cartão',    categoria: 'pgto_fatura',       prioridade: 1 },

];
