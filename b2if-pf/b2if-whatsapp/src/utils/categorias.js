/**
 * Mapa de categorias padrão B2IF v2.0
 * Espelha exatamente o arquivo src/data/categorias.js do desktop.
 */
export const CATEGORIAS_PADRAO = [
  // Receitas
  { id: 'salario',           nome: 'Salário',                   grupo: 'Receitas' },
  { id: 'ferias',            nome: 'Férias',                    grupo: 'Receitas' },
  { id: 'decimo_terceiro',   nome: '13º Salário',               grupo: 'Receitas' },
  { id: 'bonus_plr',         nome: 'Bônus/PLR',                 grupo: 'Receitas' },
  { id: 'juros_rec',         nome: 'Juros',                     grupo: 'Receitas' },
  { id: 'dividendos',        nome: 'Dividendos',                grupo: 'Receitas' },
  { id: 'rec_investimentos', nome: 'Receitas de Investimentos', grupo: 'Receitas' },
  { id: 'renda_extra',       nome: 'Renda extra',               grupo: 'Receitas' },
  { id: 'aluguel_rec',       nome: 'Aluguel recebido',          grupo: 'Receitas' },
  { id: 'reembolso',         nome: 'Reembolso',                 grupo: 'Receitas' },
  { id: 'emprestimo_rec',    nome: 'Empréstimos',               grupo: 'Receitas' },
  // Despesas Fixas
  { id: 'aluguel_prest',     nome: 'Aluguel/Prestação',         grupo: 'Despesas Fixas' },
  { id: 'condominio',        nome: 'Condomínio',                grupo: 'Despesas Fixas' },
  { id: 'energia',           nome: 'Energia',                   grupo: 'Despesas Fixas' },
  { id: 'agua',              nome: 'Água',                      grupo: 'Despesas Fixas' },
  { id: 'gas',               nome: 'Gás',                       grupo: 'Despesas Fixas' },
  { id: 'telefone',          nome: 'Telefone',                  grupo: 'Despesas Fixas' },
  { id: 'internet',          nome: 'Internet',                  grupo: 'Despesas Fixas' },
  { id: 'iptu',              nome: 'IPTU',                      grupo: 'Despesas Fixas' },
  { id: 'custos_imoveis',    nome: 'Custos imóveis',            grupo: 'Despesas Fixas' },
  { id: 'ipva',              nome: 'IPVA',                      grupo: 'Despesas Fixas' },
  { id: 'funcionario',       nome: 'Funcionário',               grupo: 'Despesas Fixas' },
  { id: 'salario_diaria',    nome: 'Salário/Diária',            grupo: 'Despesas Fixas' },
  { id: 'encargos',          nome: 'Encargos',                  grupo: 'Despesas Fixas' },
  { id: 'educacao',          nome: 'Educação',                  grupo: 'Despesas Fixas' },
  { id: 'faculdade_mba',     nome: 'Faculdade/MBA',             grupo: 'Despesas Fixas' },
  { id: 'educacao_filhos',   nome: 'Educação Filhos',           grupo: 'Despesas Fixas' },
  { id: 'assinaturas',       nome: 'Assinaturas',               grupo: 'Despesas Fixas' },
  { id: 'seguro_vida',       nome: 'Seguro de Vida',            grupo: 'Despesas Fixas' },
  { id: 'seguro_carro',      nome: 'Seguro de Carro',           grupo: 'Despesas Fixas' },
  { id: 'seguro_res',        nome: 'Seguro Residencial',        grupo: 'Despesas Fixas' },
  { id: 'anuidade',          nome: 'Anuidade',                  grupo: 'Despesas Fixas' },
  { id: 'celular',           nome: 'Celular',                   grupo: 'Despesas Fixas' },
  { id: 'tarifas',           nome: 'Tarifas',                   grupo: 'Despesas Fixas' },
  { id: 'impostos',          nome: 'Impostos',                  grupo: 'Despesas Fixas' },
  // Consumo Mensal
  { id: 'supermercado',      nome: 'Supermercado',              grupo: 'Consumo Mensal' },
  { id: 'alimentacao_fora',  nome: 'Alimentação Fora',          grupo: 'Consumo Mensal' },
  { id: 'padaria',           nome: 'Padaria',                   grupo: 'Consumo Mensal' },
  { id: 'gasolina',          nome: 'Gasolina',                  grupo: 'Consumo Mensal' },
  { id: 'combustivel',       nome: 'Combustível',               grupo: 'Consumo Mensal' },
  { id: 'uber',              nome: 'Uber',                      grupo: 'Consumo Mensal' },
  { id: 'carro',             nome: 'Carro',                     grupo: 'Consumo Mensal' },
  { id: 'manutencao',        nome: 'Manutenção',                grupo: 'Consumo Mensal' },
  { id: 'estacionamento',    nome: 'Estacionamento',            grupo: 'Consumo Mensal' },
  { id: 'aluguel_carro',     nome: 'Aluguel de Carro',          grupo: 'Consumo Mensal' },
  { id: 'drogaria',          nome: 'Drogaria',                  grupo: 'Consumo Mensal' },
  { id: 'farmacia',          nome: 'Farmácia',                  grupo: 'Consumo Mensal' },
  { id: 'saude',             nome: 'Saúde',                     grupo: 'Consumo Mensal' },
  { id: 'consulta',          nome: 'Consulta',                  grupo: 'Consumo Mensal' },
  { id: 'academia',          nome: 'Academia',                  grupo: 'Consumo Mensal' },
  { id: 'personal',          nome: 'Personal',                  grupo: 'Consumo Mensal' },
  { id: 'esporte',           nome: 'Esporte',                   grupo: 'Consumo Mensal' },
  { id: 'beleza',            nome: 'Beleza',                    grupo: 'Consumo Mensal' },
  { id: 'cosmeticos',        nome: 'Cosméticos',                grupo: 'Consumo Mensal' },
  { id: 'cuidados_pessoais', nome: 'Cuidados Pessoais',         grupo: 'Consumo Mensal' },
  { id: 'vestuario',         nome: 'Vestuário',                 grupo: 'Consumo Mensal' },
  { id: 'lazer',             nome: 'Lazer',                     grupo: 'Consumo Mensal' },
  { id: 'viagem',            nome: 'Viagem',                    grupo: 'Consumo Mensal' },
  { id: 'comemoracoes',      nome: 'Comemorações',              grupo: 'Consumo Mensal' },
  { id: 'festa_aniversario', nome: 'Festa de Aniversário',      grupo: 'Consumo Mensal' },
  { id: 'clube',             nome: 'Clube',                     grupo: 'Consumo Mensal' },
  { id: 'compras_online',    nome: 'Compras Online',            grupo: 'Consumo Mensal' },
  { id: 'presente',          nome: 'Presente',                  grupo: 'Consumo Mensal' },
  { id: 'casa',              nome: 'Casa',                      grupo: 'Consumo Mensal' },
  { id: 'decoracao',         nome: 'Decoração',                 grupo: 'Consumo Mensal' },
  { id: 'reforma',           nome: 'Reforma',                   grupo: 'Consumo Mensal' },
  { id: 'papelaria',         nome: 'Papelaria',                 grupo: 'Consumo Mensal' },
  { id: 'livro_curso',       nome: 'Livro/Curso',               grupo: 'Consumo Mensal' },
  { id: 'material_escolar',  nome: 'Material Escolar',          grupo: 'Consumo Mensal' },
  { id: 'pets',              nome: 'Pets',                      grupo: 'Consumo Mensal' },
  { id: 'doacoes',           nome: 'Doações',                   grupo: 'Consumo Mensal' },
  { id: 'saque',             nome: 'Saque',                     grupo: 'Consumo Mensal' },
  { id: 'outros',            nome: 'Outros',                    grupo: 'Consumo Mensal' },
  { id: 'nao_lembro',        nome: 'Não Lembro',                grupo: 'Consumo Mensal' },
  { id: 'sem_categoria',     nome: 'Sem categoria',             grupo: 'Consumo Mensal' },
  // Dívidas
  { id: 'fin_cartao',        nome: 'Financiamento de Cartão',   grupo: 'Dívidas' },
  { id: 'emprestimo',        nome: 'Empréstimos',               grupo: 'Dívidas' },
  { id: 'juros_div',         nome: 'Juros',                     grupo: 'Dívidas' },
  // Investimentos
  { id: 'investimento',      nome: 'Investimentos',             grupo: 'Investimentos' },
  { id: 'previdencia',       nome: 'Previdência Privada',       grupo: 'Investimentos' },
  { id: 'reserva',           nome: 'Reserva de Emergência',     grupo: 'Investimentos' },
  { id: 'custodia',          nome: 'Custódia',                  grupo: 'Investimentos' },
  { id: 'custos_op',         nome: 'Custos Operacionais',       grupo: 'Investimentos' },
  { id: 'iof',               nome: 'IOF',                       grupo: 'Investimentos' },
  { id: 'ir',                nome: 'IR',                        grupo: 'Investimentos' },
  { id: 'perdas',            nome: 'Perdas',                    grupo: 'Investimentos' },
  // Fluxo Interno
  { id: 'entre_contas',      nome: 'Entre Contas',              grupo: 'Fluxo Interno' },
];

function normalizar(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function resolverCategoria(nomeOuId) {
  const n = normalizar(nomeOuId);
  const porId   = CATEGORIAS_PADRAO.find(c => c.id === n);
  if (porId) return porId.id;
  const porNome = CATEGORIAS_PADRAO.find(c => normalizar(c.nome) === n);
  if (porNome) return porNome.id;
  const parcial = CATEGORIAS_PADRAO.find(c => normalizar(c.nome).includes(n) || n.includes(normalizar(c.nome)));
  if (parcial) return parcial.id;
  return 'outros';
}

export function nomeCategoria(id) {
  return CATEGORIAS_PADRAO.find(c => c.id === id)?.nome || id;
}
