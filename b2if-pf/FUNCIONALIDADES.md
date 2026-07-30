# B2IF — Planejador Financeiro PF
## Documento de Funcionalidades do Sistema

> Versão: 1.0 · Gerado em: 2026-04-01

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Perfis de Usuário](#2-perfis-de-usuário)
3. [Autenticação e Acesso](#3-autenticação-e-acesso)
4. [Painel Manager](#4-painel-manager)
5. [Hub do Planejador](#5-hub-do-planejador)
6. [Dashboard Financeiro](#6-dashboard-financeiro)
7. [Fluxo Financeiro (Categorizador)](#7-fluxo-financeiro-categorizador)
8. [Planejador Financeiro](#8-planejador-financeiro)
9. [Acesso do Cliente](#9-acesso-do-cliente)
10. [Gerenciamento de Acessos de Cliente](#10-gerenciamento-de-acessos-de-cliente)
11. [Categorias e Grupos Macro](#11-categorias-e-grupos-macro)
12. [Armazenamento e Sincronização](#12-armazenamento-e-sincronização)
13. [Tecnologias Utilizadas](#13-tecnologias-utilizadas)

---

## 1. Visão Geral

O **B2IF — Planejador Financeiro PF** é uma plataforma web para planejadores financeiros independentes gerenciarem a vida financeira de seus clientes pessoa física (PF). O sistema permite importar extratos bancários, categorizar transações, visualizar dashboards analíticos e criar projeções orçamentárias mensais.

A plataforma é **multi-tenant**: cada planejador gerencia sua própria carteira de clientes de forma isolada, com dados salvos em nuvem (Supabase) e acesso diferenciado por perfil.

---

## 2. Perfis de Usuário

O sistema possui três perfis de acesso distintos:

### 2.1 Manager
- Perfil administrativo com acesso total ao sistema.
- Gerencia todos os planejadores cadastrados.
- Pode visualizar e operar a conta de qualquer planejador ("Acessar").
- Acessa o **Painel Manager** exclusivo.

### 2.2 Planejador
- Profissional financeiro que gerencia sua carteira de clientes.
- Cria, visualiza, edita e exclui clientes.
- Importa extratos e categoriza transações.
- Cria projeções financeiras mensais.
- Gera acessos de leitura para seus clientes.

### 2.3 Cliente
- Usuário final (pessoa física) com acesso **somente leitura**.
- Acessa automaticamente seu próprio perfil financeiro após login.
- Visualiza o Dashboard e o Fluxo Financeiro sem poder editar dados.

---

## 3. Autenticação e Acesso

### 3.1 Login
- Autenticação por **e-mail e senha** via Supabase Auth.
- O sistema detecta automaticamente o perfil do usuário após o login:
  1. Verifica se o usuário tem registro em `cliente_acessos` → entra como **Cliente**.
  2. Se não, verifica registro em `planejadores` → entra como **Planejador** ou **Manager**.
- Contas desativadas recebem mensagem de erro ao tentar logar.
- Usuários não encontrados no sistema recebem mensagem orientando a contatar o planejador.

### 3.2 Sessão
- A sessão é restaurada automaticamente ao recarregar a página.
- Logout encerra a sessão no Supabase e limpa o estado local.

### 3.3 Redefinição de Senha
- Planejadores podem redefinir a própria senha via e-mail (Supabase Auth).
- O Manager pode enviar e-mail de redefinição de senha para qualquer planejador.
- O Planejador pode redefinir a senha de qualquer acesso de cliente via modal de acessos.

---

## 4. Painel Manager

Acesso exclusivo para o perfil **Manager**.

### 4.1 Listagem de Planejadores
- Lista todos os planejadores cadastrados com:
  - Avatar com inicial do nome.
  - Nome e e-mail.
  - Status: **Ativo** ou **Desativado** (badge visual).
  - Data de criação.
- Busca por nome ou e-mail em tempo real.

### 4.2 Ações por Planejador
| Ação | Descrição |
|------|-----------|
| **🔓 Acessar** | Entra no hub do planejador como se fosse ele (impersonation via `localStorage`). |
| **👥 Clientes** | Abre modal com a lista de clientes do planejador e gerenciamento de acessos. |
| **✏️ Renomear** | Altera o nome do planejador. |
| **🔑 Resetar senha** | Envia e-mail de redefinição de senha para o planejador. |
| **🚫 Desativar / ✅ Ativar** | Alterna o status da conta. |
| **🗑 Excluir** | Remove o planejador do sistema (requer confirmação). |

### 4.3 Criar Novo Planejador
- Formulário com: Nome, E-mail e Senha inicial (mínimo 6 caracteres).
- Cria conta no Supabase Auth e registro na tabela `planejadores`.

### 4.4 Barra de Manager-View
- Quando o Manager está visualizando um planejador, aparece uma barra de contexto na interface indicando qual planejador está sendo acessado.
- Botão para retornar ao Painel Manager.

---

## 5. Hub do Planejador

Tela inicial após login do planejador. Lista todos os clientes da carteira.

### 5.1 KPIs do Hub
- **Total de Clientes**: quantidade total cadastrada.
- **Ativos este mês**: clientes com dados atualizados no mês corrente.
- **Ano em Curso**: ano atual de referência.

### 5.2 Lista de Clientes
- Cards individuais por cliente, exibindo:
  - Avatar com inicial do nome.
  - Nome completo.
  - Quantidade de transações importadas.
  - Data da última atualização.
  - Botão **👤 Acessos** para gerenciar logins do cliente.
- Busca por nome em tempo real.
- Ao clicar no card, abre o cliente direto no Dashboard.

### 5.3 Criar Novo Cliente
- Modal com campo "Nome completo do cliente".
- Ao criar, o sistema instancia um cliente vazio com categorias padrão e abre o Dashboard.

---

## 6. Dashboard Financeiro

Tela analítica principal da vida financeira do cliente.

### 6.1 Abas Macro
O Dashboard é organizado em 6 abas:

| Aba | Conteúdo |
|-----|----------|
| **Visão Geral** | Resumo anual com gráficos e tabela mensal. |
| **Receitas** | Detalhamento das receitas por categoria. |
| **Despesas Fixas** | Detalhamento das despesas fixas por categoria. |
| **Consumo** | Detalhamento do consumo mensal por categoria. |
| **Dívidas** | Financiamentos, empréstimos e anuidades. |
| **Investimentos** | Investimentos, poupança e previdência. |

### 6.2 Visão Geral — Recursos

#### Seletor de Mês
- Clique em um mês para ativar o modo **mês único**.
- Clique em múltiplos meses para comparar (modo **multi-mês**).
- Botão "Limpar" retorna à visão anual.

#### Filtro por Conta
- Dropdown para filtrar todos os dados por conta bancária específica.

#### KPIs do Período Selecionado
- Receita Realizada vs. Projetada.
- Despesa Realizada vs. Projetada.
- Saldo Realizado e Projetado.
- Taxa de Poupança (%).
- Parcelas comprometidas (futuras).

#### Gráfico de Barras Mensal
- Barras lado a lado: Receita Realizada × Despesa Realizada.
- Linha de saldo mensal.
- Indicadores de parcelas futuras comprometidas.

#### Tabela Resumo Anual
- Uma linha por mês com: Receita, Despesa e Saldo (realizados e projetados).
- Linha de totais anuais.
- Destaques visuais: mês com saldo negativo em vermelho.

#### Gráfico de Gastos por Conta
- Visualização de despesas distribuídas por conta bancária ao longo dos meses.

### 6.3 Abas de Grupo (Receitas, Fixas, Consumo, Dívidas, Investimentos)
- Seletor de mês (único).
- KPIs do grupo: Projetado, Realizado, Parcelas.
- Barra de progresso por grupo (realizado vs. projetado).
- Tabela por categoria com:
  - Projetado, Realizado, Parcelas, Saldo.
  - Barra de progresso individual.
  - Destaque visual quando excede o limite.

### 6.4 Impressão
- Botão **🖨️ Imprimir PDF** aciona `window.print()` para exportar o dashboard.

---

## 7. Fluxo Financeiro (Categorizador)

Módulo de importação, categorização e análise de transações bancárias.

### 7.1 Importação de Extratos

#### Formatos suportados
| Formato | Extensão |
|---------|----------|
| CSV (OFX convertido ou export bancário) | `.csv` |
| Excel com macros | `.xlsm` |
| PDF de extrato bancário | `.pdf` |

#### Processo de importação
1. O usuário seleciona o arquivo e a conta de destino.
2. O parser identifica data, valor, descrição e tipo (crédito/débito).
3. As transações são mescladas com as existentes (sem duplicatas).
4. O sistema aplica as **Regras de Auto-categorização** automaticamente.

### 7.2 Abas do Módulo

| Aba | Descrição |
|-----|-----------|
| **Transações** | Lista completa com filtros e ações. |
| **Categorias** | Gerenciamento das categorias personalizadas. |
| **Regras** | Regras de auto-categorização por palavra-chave. |

### 7.3 Aba Transações

#### Filtros disponíveis
- **Período**: Competência (mês de lançamento) ou Data de Compra.
- **Mês**: Dropdown com todos os meses presentes nos dados.
- **Status**: Todos / Categorizadas / Sem categoria.
- **Conta**: Filtro por conta bancária.
- **Formato**: Débito, Crédito, Pix, Fatura, etc.
- **Categoria**: Multiselect com opções baseadas nos dados filtrados (cascata).
- **Busca textual**: Campo de texto que filtra pela descrição da transação.

#### Filtros de coluna (tipo Excel)
Cada coluna da tabela possui um filtro dropdown com:
- Multiselect de valores.
- Busca interna no dropdown.
- Ordenação ascendente/descendente.
- Filtros em cascata: selecionar Macro filtra as categorias disponíveis para aquele grupo.

#### Tabela de Transações
Colunas exibidas:
- Seleção (checkbox) — apenas para planejador.
- Conta.
- Formato.
- Macro (grupo).
- Categoria.
- Parcelas (n/total).
- Data.
- Valor.
- Descrição (com tooltip ao passar o mouse para textos longos).
- Ações (editar) — apenas para planejador.

#### Ações por linha (apenas planejador)
- Alterar **Macro** e **Categoria** via dropdown inline.
- Informar número de **Parcelas** (parcela atual / total).
- **Memorizar (🧠)**: cria uma regra automática a partir da descrição da transação.
- **✓**: confirma categorização manualmente.

#### Ações em lote (apenas planejador)
- Selecionar todas as transações visíveis.
- **Categorizar selecionadas**: aplica macro + categoria a todas de uma vez.
- **Excluir selecionadas**: remove as transações selecionadas.

#### Auto-categorização
- Botão **Auto** aplica todas as regras cadastradas a todas as transações sem categoria.
- Disponível apenas para planejadores.

#### Edição individual
- Modal de edição com: Descrição, Conta, Formato, Macro, Categoria, Data, Valor, Parcelas.

### 7.4 Aba Categorias

#### Estrutura
- Categorias agrupadas por **Macro** (grupo).
- Cada categoria exibe: nome, quantidade de transações vinculadas e tipo (receita/despesa).

#### Ações (apenas planejador)
- **+ Nova Categoria**: cria categoria customizada com nome, macro e tipo.
- **+ Adicionar** por grupo: atalho para criar categoria dentro de um grupo específico.
- **Editar** (✏️): altera nome, macro e tipo de uma categoria.
- **Excluir** (✕): remove categoria (transações vinculadas ficam sem categoria).

### 7.5 Aba Regras

Regras de auto-categorização por palavra-chave.

#### Campos de uma regra
- **Palavra-chave**: texto que será buscado na descrição da transação.
- **Categoria**: categoria a ser aplicada quando a palavra-chave for encontrada.
- **Prioridade**: número que define a ordem de aplicação (menor = maior prioridade).

#### Ações (apenas planejador)
- **+ Nova Regra**: cria regra manualmente.
- **Editar** e **Excluir** regras existentes.
- O sistema inclui **regras padrão** pré-cadastradas (iFood, Rappi, Salário, Supermercado, etc.).

### 7.6 Contas Bancárias

Gerenciadas dentro do Fluxo Financeiro.

#### Campos de uma conta
- Nome da conta.
- Banco (nome da instituição).
- Tipo: Conta Corrente, Poupança, Crédito, Investimento, Carteira, Outro.

#### Ações (apenas planejador)
- **+ Nova Conta**: cadastra nova conta bancária.
- **Editar** e **Excluir** contas existentes.
- Total de transações por conta exibido no card.

### 7.7 Virtualização de Lista
- Listas longas de transações são **virtualizadas**: apenas as linhas visíveis na tela são renderizadas, garantindo performance mesmo com milhares de transações.

---

## 8. Planejador Financeiro

Módulo de orçamento e projeção financeira mensal.

### 8.1 Seletor de Mês
- Botões com os 12 meses do ano.
- O mês ativo é destacado visualmente.

### 8.2 KPIs do Mês
- Receitas Projetadas.
- Despesas Projetadas.
- Saldo Projetado.
- Saldo Realizado.

### 8.3 Tabela de Planejamento por Grupo
Para cada grupo macro (Receitas, Fixas, Consumo, Dívidas, Investimentos):
- Cabeçalho do grupo com totais (Projetado, Realizado, Parcelas).
- Barra de progresso do grupo.
- Linhas por categoria com:
  - Campo editável de **valor projetado**.
  - Valor realizado (vindo das transações importadas).
  - Parcelas comprometidas.
  - Saldo (projetado − realizado).
  - Barra de progresso individual.

### 8.4 Iniciar Projeção
Modal com duas opções:
- **Usar médias históricas**: preenche os valores projetados automaticamente com a média dos meses anteriores.
- **Iniciar do zero**: preenche todos os valores com R$ 0,00.

### 8.5 Salvar / Replicar Projeção
Modal que permite:
- **Replicar até dezembro**: copia os valores projetados do mês ativo para todos os meses seguintes.
- Ação de confirmação com descrição clara do impacto.

### 8.6 Limpar Grupo
- Botão por grupo para zerar todos os valores projetados do grupo no mês ativo.
- Requer confirmação.

---

## 9. Acesso do Cliente

Quando um cliente faz login, o sistema entra automaticamente em **modo leitura** (read-only).

### 9.1 O que o cliente vê

| Módulo | Acesso |
|--------|--------|
| **Dashboard** | ✅ Acesso completo (visualização). |
| **Fluxo Financeiro** | ✅ Acesso completo (visualização). |
| **Planejador** | ✅ Acesso completo (visualização). |

### 9.2 Restrições no modo cliente

#### Dashboard
- Sem restrições de visualização. Todas as abas e filtros disponíveis.

#### Fluxo Financeiro — Transações
- ❌ Sem checkbox de seleção.
- ❌ Sem barra de ações em lote (categorizar/excluir selecionados).
- ❌ Sem botão "Auto".
- ❌ Sem dropdowns editáveis de Macro, Categoria e Parcelas (exibição somente texto).
- ❌ Sem botões Memorizar e Editar por linha.
- ❌ Coluna "Ações" oculta.
- ✅ Filtros e busca funcionam normalmente.

#### Fluxo Financeiro — Categorias
- ❌ Sem botão "+ Nova Categoria".
- ❌ Sem botões "+ Adicionar" por grupo.
- ❌ Sem botões Editar e Excluir categorias.

#### Fluxo Financeiro — Contas
- ❌ Sem botão "+ Nova Conta".
- ❌ Sem botões Editar e Excluir contas.

#### Planejador Financeiro
- ❌ Sem botão "Iniciar Projeção".
- ❌ Sem botão "Salvar Projeção".
- ❌ Campos de valor projetado apenas para leitura.

---

## 10. Gerenciamento de Acessos de Cliente

Disponível para **Planejador** (no Hub) e **Manager** (no Painel Manager → modal Clientes).

### 10.1 Listar Acessos
- Exibe todos os logins vinculados ao cliente com: nome, e-mail e data de criação.

### 10.2 Criar Acesso
- Formulário: **Nome**, **E-mail** e **Senha** (mínimo 6 caracteres).
- O sistema cria a conta no Supabase Auth via **Edge Function** `admin-cliente` (com service role key).
- Registra o vínculo na tabela `cliente_acessos`.

### 10.3 Resetar Senha
- Permite definir uma nova senha para um acesso de cliente específico.
- Processado via Edge Function `admin-cliente`.

### 10.4 Excluir Acesso
- Requer confirmação.
- Remove o usuário do Supabase Auth e o registro em `cliente_acessos`.
- Processado via Edge Function `admin-cliente`.

---

## 11. Categorias e Grupos Macro

### 11.1 Grupos Macro

| Grupo | Tipo |
|-------|------|
| **Receitas** | Receita |
| **Despesas Fixas** | Despesa |
| **Consumo Mensal** | Despesa |
| **Dívidas** | Despesa |
| **Investimentos** | Despesa |
| **Fluxo Interno** | Neutro (transferências entre contas) |

### 11.2 Categorias Padrão por Grupo

#### Receitas
Salário, Freelance / Renda Extra, Aluguel Recebido, Rendimentos, Reembolso, Outros Recebimentos.

#### Despesas Fixas
Moradia, Aluguel, Contas de Casa, Celular, Assinaturas, Escola / Faculdade, Plano de Saúde, Academia, Impostos / Taxas, Custos de Imóvel, Outras Fixas, Trabalho.

#### Consumo Mensal
Alimentação Fora, Supermercado, Padaria / Café, Transporte, Gasolina / Combustível, Carro, Saúde / Consulta, Drogaria / Farmácia, Beleza, Vestuário, Lazer, Viagem, Papelaria, Decoração / Casa, Compras Online, Compras Gerais, Outros Consumos, Pets, Presentes, Doações, Esporte, Livro / Curso, Reforma.

#### Dívidas
Financiamento de Cartão, Empréstimo, Financiamento, Anuidade, Tarifas Bancárias.

#### Investimentos
Investimento, Poupança, Previdência.

#### Fluxo Interno
Entre contas.

### 11.3 Categorias Customizadas
Cada planejador pode criar categorias personalizadas para seus clientes, vinculadas a qualquer grupo macro existente.

---

## 12. Armazenamento e Sincronização

### 12.1 Banco de Dados (Supabase)

#### Tabelas principais

| Tabela | Conteúdo |
|--------|----------|
| `planejadores` | Perfis dos planejadores e manager (id, nome, email, role, ativo). |
| `clientes` | Dados dos clientes (id, planejador_id, nome, dados JSON completo). |
| `cliente_acessos` | Vínculos entre usuários Auth e clientes (user_id → cliente_id). |

#### Estrutura do JSON de cliente
O campo `dados` em `clientes` armazena o estado completo do cliente:
- `transacoes[]`: lista de transações com data, valor, descrição, conta, formato, categoria, macro, parcelas.
- `categorias[]`: categorias customizadas do cliente.
- `contas[]`: contas bancárias cadastradas.
- `planejamento{}`: orçamento por ano → mês → categoria (projetado + parcelas).
- `anoAtivo`: ano de referência ativo.
- `regras[]`: regras de auto-categorização personalizadas.

### 12.2 Row Level Security (RLS)

- **Planejadores**: cada planejador acessa apenas seus próprios clientes.
- **Manager**: acessa todos os registros de todas as tabelas.
- **Clientes**: leem apenas o próprio registro via função `SECURITY DEFINER` que quebra recursão.

### 12.3 Edge Function `admin-cliente`
Função serverless no Supabase para operações administrativas que requerem `service_role`:
- Criar usuário Auth para acesso de cliente.
- Resetar senha de acesso de cliente.
- Excluir usuário Auth de acesso de cliente.

### 12.4 Salvamento automático
- Alterações nos dados do cliente são salvas automaticamente via **debounce de 1 segundo**.
- Flush imediato ao fechar/minimizar a aba (`beforeunload` + `visibilitychange`).
- No modo leitura (cliente), nenhum dado é gravado.

---

## 13. Tecnologias Utilizadas

| Tecnologia | Uso |
|------------|-----|
| **React 18** | Interface do usuário (SPA). |
| **Vite** | Build tool e dev server. |
| **Supabase** | Backend as a Service: Auth, Database (PostgreSQL), Edge Functions. |
| **PapaParse** | Parsing de arquivos CSV. |
| **SheetJS (xlsx)** | Parsing de arquivos Excel (.xlsm). |
| **PDF.js** | Parsing de extratos em PDF. |
| **Inter** | Tipografia principal (Google Fonts). |

---

*Documento gerado automaticamente a partir do código-fonte do projeto B2IF — Planejador Financeiro PF.*
