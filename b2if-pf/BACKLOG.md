# B2IF — Backlog de Produto
### Planejador Financeiro PF · Versão 1.0 · Gerado em 2026-04-01

---

## Contexto do Produto

**Empresa:** B2 Inteligência Financeira  
**Usuários atuais:** 4 planejadores · ~100 clientes PF ativos  
**Meta 6 meses:** ~200 clientes  
**Meta 1 ano:** ~500 clientes  
**Modelo:** Ferramenta interna da B2, sem comercialização externa  
**Plataforma principal:** Desktop (análise completa)  
**Plataforma futura:** Mobile (acompanhamento de gastos no dia a dia)

---

## Visão de Produto

> *"Ser a central financeira do cliente B2: onde ele entende onde está, vê para onde vai, acompanha seu progresso em tempo real e é motivado a evoluir — com o planejador como guia."*

---

## Estrutura do Backlog

O backlog está organizado em **6 Épicos**, cada um com suas histórias de usuário, critérios de aceite e prioridade.

```
Épico → Histórias → Tarefas técnicas
```

**Legenda de Prioridade:**
- 🔴 **P0** — Crítico: bloqueia operação ou crescimento
- 🟠 **P1** — Alta: impacto direto na experiência do planejador/cliente
- 🟡 **P2** — Média: melhoria relevante, pode aguardar
- 🟢 **P3** — Futuro: visão de longo prazo

**Legenda de Status:**
- ✅ Concluído
- 🔄 Em andamento
- ⏳ Pendente
- 💡 Ideia/Exploração

---

## Estado Atual do MVP (Concluído ✅)

| Módulo | Status |
|--------|--------|
| Autenticação (Manager / Planejador / Cliente) | ✅ |
| Painel Manager — gestão de planejadores | ✅ |
| Hub do Planejador — carteira de clientes | ✅ |
| Dashboard Financeiro — visão anual e mensal | ✅ |
| Fluxo Financeiro — importação CSV/XLSM/PDF | ✅ |
| Categorização manual e auto por regras | ✅ |
| Planejador Financeiro — orçamento mensal | ✅ |
| Acesso de leitura para o cliente (login próprio) | ✅ |
| Gestão de acessos de cliente (criar/resetar/excluir) | ✅ |
| Modo cliente — visualização restrita (sem edição) | ✅ |
| Filtros encadeados (cascata) nas transações | ✅ |
| Deploy manual no Netlify | ✅ |

---

---

# ÉPICO 1 — Ingestão e Tratamento de Dados
> *Eliminar o gargalo manual de preparar extratos via IA externa antes de subir no sistema.*

**Por que é prioritário:** hoje cada novo extrato passa por uma IA externa antes de entrar no sistema. Com 500 clientes isso se torna inviável. É o maior gargalo operacional.

---

### E1-H1 · Upload inteligente de extratos brutos 🔴 P0 ⏳

**Como** planejador,  
**quero** enviar o extrato bruto do cliente (PDF, foto, CSV de qualquer banco) direto no sistema,  
**para que** o sistema trate, normalize e importe automaticamente, sem precisar de IA externa.

**Critérios de aceite:**
- [ ] Aceitar PDF de extrato de qualquer layout (Itaú, Bradesco, Nubank, BB, XP, Inter, etc.)
- [ ] Aceitar foto/imagem de extrato (OCR)
- [ ] Aceitar CSV em diferentes formatos de banco
- [ ] Pipeline de normalização: detectar data, valor, descrição, tipo (crédito/débito)
- [ ] Exibir pré-visualização antes de confirmar importação
- [ ] Permitir correção manual antes de salvar
- [ ] Relatório de linhas não reconhecidas

**Tarefas técnicas:**
- Integrar API de OCR (ex: Google Vision ou Tesseract) para imagens
- Construir parser universal de PDF bancário com fallback para OCR
- Criar pipeline de normalização de colunas por heurística
- Tela de pré-visualização com edição inline
- Endpoint de upload na Edge Function

---

### E1-H2 · Detecção automática de banco/formato 🟠 P1 ⏳

**Como** planejador,  
**quero** que o sistema detecte automaticamente de qual banco é o extrato,  
**para que** eu não precise escolher o formato manualmente.

**Critérios de aceite:**
- [ ] Identificar banco pelo cabeçalho/layout do arquivo
- [ ] Aplicar parser específico por banco automaticamente
- [ ] Fallback para parser genérico quando banco não reconhecido
- [ ] Histórico de parsers por cliente (lembra qual banco cada conta usa)

---

### E1-H3 · Integração Open Finance (visão futura) 🟢 P3 💡

**Como** planejador,  
**quero** conectar a conta bancária do cliente via Open Finance,  
**para que** as transações sejam importadas automaticamente sem upload manual.

**Critérios de aceite:**
- [ ] Conectar via API Belvo, Pluggy ou similar
- [ ] Sincronização periódica automática (diária ou em tempo real)
- [ ] Planejador aprova/revisa antes de categorizar
- [ ] Histórico de sincronizações por conta

**Nota:** Dependente de regulação Bacen e consentimento do cliente (LGPD).

---

---

# ÉPICO 2 — Acompanhamento de Gastos em Tempo Real
> *Capturar gastos do cliente no dia a dia e atualizar automaticamente o sistema, dando visibilidade ao cliente de quanto já gastou das suas metas mensais.*

**Por que é prioritário:** é a funcionalidade que fecha o ciclo — o cliente não espera a sessão mensal para saber como está. É o maior diferencial percebido.

---

### E2-H1 · Captura de gasto via WhatsApp 🔴 P0 ⏳

**Como** cliente,  
**quero** enviar uma foto de cupom fiscal, áudio ou texto no WhatsApp,  
**para que** o gasto seja registrado automaticamente no meu perfil financeiro.

**Critérios de aceite:**
- [ ] Bot WhatsApp (via Twilio, Z-API ou similar) recebe mensagem do cliente
- [ ] Processar foto de cupom: extrair estabelecimento, valor, data
- [ ] Processar texto: "gastei 40 reais no lanche" → transação criada
- [ ] Processar áudio: transcrever e interpretar
- [ ] IA categoriza automaticamente (com base nas regras do cliente)
- [ ] Confirmação enviada de volta: "✅ R$ 40,00 em Alimentação Fora registrado. Restam R$ 960,00 na sua meta de Lanche."
- [ ] Planejador pode revisar/corrigir gastos enviados pelo cliente

**Tarefas técnicas:**
- Configurar webhook WhatsApp Business API
- Integrar OCR para cupons fiscais
- Integrar Whisper (OpenAI) ou Google Speech para áudio
- Integrar GPT para interpretação de texto livre
- Criar endpoint de entrada de transação avulsa por cliente_id
- Sistema de resposta automática com saldo restante da categoria

---

### E2-H2 · Painel "Hoje" no app mobile 🟠 P1 ⏳

**Como** cliente,  
**quero** ver no celular quanto já gastei hoje e no mês em cada categoria,  
**para que** eu tome decisões conscientes no momento do gasto.

**Critérios de aceite:**
- [ ] Tela simplificada mobile com barras de progresso por categoria
- [ ] Destaque para categorias próximas ou acima da meta
- [ ] Últimas transações do dia
- [ ] Saldo disponível por macro (Consumo, Fixas, etc.)
- [ ] Funciona como PWA (sem precisar de app store)

---

### E2-H3 · Notificações proativas de meta 🟡 P2 ⏳

**Como** cliente,  
**quero** receber alertas quando estou chegando perto do limite de uma categoria,  
**para que** eu possa ajustar meu comportamento antes de estourar.

**Critérios de aceite:**
- [ ] Alerta ao atingir 80% da meta de uma categoria
- [ ] Alerta ao ultrapassar a meta
- [ ] Canal configurável: WhatsApp, push notification (PWA) ou e-mail
- [ ] Planejador define quais categorias têm alerta ativo por cliente

---

---

# ÉPICO 3 — Gamificação e Progresso do Cliente
> *Dar ao cliente uma visão lúdica e motivadora do seu progresso financeiro, transformando o planejamento em uma jornada com marcos visíveis.*

---

### E3-H1 · Definição de Objetivos e Metas Financeiras 🟠 P1 ⏳

**Como** planejador,  
**quero** cadastrar objetivos financeiros para o cliente (ex: reserva de emergência, viagem, imóvel, aposentadoria),  
**para que** o cliente veja para onde está indo e o que já conquistou.

**Critérios de aceite:**
- [ ] Criar objetivo com: nome, valor alvo, prazo, ícone/foto
- [ ] Vincular objetivo a uma categoria de Investimentos específica
- [ ] Calcular progresso automaticamente com base nos aportes realizados
- [ ] Exibir % concluído e valor atual vs. alvo
- [ ] Calcular aporte mensal necessário para atingir no prazo
- [ ] Alertar quando aporte do mês não foi feito

---

### E3-H2 · Dashboard de Progresso Gamificado 🟡 P2 ⏳

**Como** cliente,  
**quero** ver meu progresso financeiro de forma visual e motivadora,  
**para que** eu me sinta engajado com minha evolução.

**Critérios de aceite:**
- [ ] "Linha do tempo" de evolução patrimonial desde o início do planejamento
- [ ] Conquistas desbloqueadas (ex: "Primeiro mês sem estourar meta 🎯", "3 meses com saldo positivo 🏆")
- [ ] Score financeiro mensal (0–100) calculado por: adimplência às metas, saldo positivo, aportes realizados
- [ ] Comparativo mês a mês: "Em Janeiro você gastou R$ 500 a mais em Consumo que em Dezembro"
- [ ] Animações simples ao atingir uma meta

---

### E3-H3 · Relatório Mensal Automático pós-sessão 🟠 P1 ⏳

**Como** planejador,  
**quero** gerar e enviar automaticamente um relatório pós-sessão para o cliente,  
**para que** ele saia da reunião com um resumo claro do que foi discutido e os próximos passos.

**Critérios de aceite:**
- [ ] Relatório em PDF gerado com: panorama do mês anterior, desvios da meta, evolução do score, objetivos em andamento
- [ ] Campo para planejador adicionar: ajustes propostos, deveres de casa, alvos do próximo mês
- [ ] Envio automático por e-mail ou WhatsApp após o planejador clicar em "Fechar sessão"
- [ ] Cliente acessa histórico de relatórios dentro do sistema
- [ ] Layout profissional com branding B2

---

### E3-H4 · Simulador de Aposentadoria e Objetivos de Longo Prazo 🟡 P2 ⏳

**Como** planejador,  
**quero** realizar simulações de aposentadoria e objetivos de longo prazo diretamente no sistema,  
**para que** o cliente visualize cenários e tome decisões baseadas em dados.

**Critérios de aceite:**
- [ ] Simulador de aposentadoria: idade atual, idade desejada, patrimônio atual, aporte mensal, taxa de rendimento → patrimônio projetado
- [ ] Modo "usufruto total" (gastar tudo) e "usufruto parcial" (preservar capital)
- [ ] Projeção de renda mensal na aposentadoria
- [ ] Simulador de objetivo: "Quero comprar um imóvel de R$ 500k em 5 anos. Quanto preciso poupar por mês?"
- [ ] Gráfico de projeção com e sem inflação
- [ ] Salvar simulações no perfil do cliente

---

---

# ÉPICO 4 — IA Integrada ao Sistema
> *Um assistente de IA que conversa com planejadores e clientes, interpreta os dados do sistema e oferece insights automáticos.*

---

### E4-H1 · Assistente IA para o Planejador 🟡 P2 ⏳

**Como** planejador,  
**quero** perguntar à IA sobre os dados de um cliente,  
**para que** eu tenha insights rápidos sem precisar analisar tabelas manualmente.

**Exemplos de uso:**
- "Qual categoria mais cresceu no último trimestre para a Maria?"
- "O João está no caminho certo para atingir a reserva de emergência?"
- "Quais clientes estouraram a meta de Consumo em Março?"

**Critérios de aceite:**
- [ ] Chat embutido no sistema (por cliente ou visão geral)
- [ ] Contexto da IA inclui: transações, categorias, planejamento, objetivos e histórico do cliente
- [ ] Respostas com dados reais do sistema (não genéricas)
- [ ] Sugestões proativas: "Notei que o cliente X não fez aporte em Investimentos este mês"
- [ ] IA pode gerar rascunho de relatório pós-sessão

---

### E4-H2 · Assistente IA para o Cliente 🟡 P2 ⏳

**Como** cliente,  
**quero** perguntar ao assistente sobre minha situação financeira,  
**para que** eu entenda meus dados sem precisar esperar a próxima sessão com o planejador.

**Critérios de aceite:**
- [ ] Chat disponível na área do cliente (desktop e mobile)
- [ ] Responde apenas com base nos dados do próprio cliente
- [ ] Tom motivador e didático (não técnico)
- [ ] Exemplos: "Quanto gastei em Lazer este mês?", "Estou no caminho certo para minha meta de viagem?"
- [ ] Não pode sugerir produtos financeiros (compliance)

---

### E4-H3 · Transcrição e Resumo Automático de Sessões 🟢 P3 ⏳

**Como** planejador,  
**quero** gravar e transcrever automaticamente a sessão com o cliente via Google Meet/Zoom,  
**para que** eu tenha o resumo salvo no perfil do cliente sem precisar tomar notas manualmente.

**Critérios de aceite:**
- [ ] Integração com Google Meet API para captura de transcrição
- [ ] IA gera resumo estruturado: tópicos discutidos, decisões tomadas, próximos passos
- [ ] Resumo salvo no perfil do cliente com data da sessão
- [ ] Planejador pode editar antes de salvar
- [ ] Histórico de sessões acessível no sistema

---

---

# ÉPICO 5 — Integração Google Workspace
> *Central de produtividade do planejador: agenda, sessões, documentos e comunicação dentro do sistema.*

---

### E5-H1 · Agenda Google integrada ao sistema 🟡 P2 ⏳

**Como** planejador,  
**quero** ver e gerenciar minha agenda do Google Calendar dentro do sistema,  
**para que** eu não precise alternar entre ferramentas durante o atendimento.

**Critérios de aceite:**
- [ ] Visualização semanal/mensal da agenda no painel do planejador
- [ ] Criar, editar e cancelar compromissos
- [ ] Vincular evento a um cliente do sistema
- [ ] Notificação 15 min antes da sessão
- [ ] Link automático do Meet inserido no evento

---

### E5-H2 · Google Drive — documentos do cliente 🟢 P3 ⏳

**Como** planejador,  
**quero** acessar e salvar documentos do cliente diretamente no Google Drive pelo sistema,  
**para que** tudo fique centralizado no perfil do cliente.

**Critérios de aceite:**
- [ ] Pasta no Drive criada automaticamente ao criar novo cliente
- [ ] Upload de documentos (contratos, declarações, extratos) pelo sistema
- [ ] Visualização de arquivos do Drive dentro do perfil do cliente
- [ ] Relatórios pós-sessão salvos automaticamente na pasta do cliente

---

### E5-H3 · Gmail — comunicação centralizada 🟢 P3 ⏳

**Como** planejador,  
**quero** enviar e-mails para o cliente diretamente do sistema,  
**para que** toda comunicação fique registrada no histórico do cliente.

**Critérios de aceite:**
- [ ] Enviar e-mail usando conta Gmail do planejador via OAuth
- [ ] Templates pré-definidos: pós-sessão, lembrete de sessão, alerta de meta
- [ ] Histórico de e-mails enviados no perfil do cliente
- [ ] Resposta do cliente notifica o planejador no sistema

---

---

# ÉPICO 6 — Infraestrutura, Qualidade e Escalabilidade
> *Garantir que o sistema suporte o crescimento para 500 clientes com estabilidade, segurança e agilidade de deploy.*

---

### E6-H1 · Migração para ambiente de produção 🔴 P0 🔄

**Como** time B2,  
**quero** ter um ambiente de produção separado e estável,  
**para que** os dados reais dos clientes fiquem isolados do ambiente de desenvolvimento.

**Critérios de aceite:**
- [ ] Novo projeto Supabase de produção criado
- [ ] Script de migração de schema (tabelas, RLS, funções) executado
- [ ] Edge Functions implantadas no projeto de produção
- [ ] Variáveis de ambiente configuradas no Netlify
- [ ] DNS configurado (domínio próprio)
- [ ] Backup automático habilitado no Supabase

---

### E6-H2 · Deploy automatizado via GitHub 🟡 P2 ⏳

**Como** time B2,  
**quero** que o deploy seja feito automaticamente ao fazer push na branch main,  
**para que** novas versões cheguem em produção sem processo manual.

**Critérios de aceite:**
- [ ] Repositório GitHub conectado ao Netlify
- [ ] Branch `main` → deploy automático em produção
- [ ] Branch `develop` → deploy automático em staging
- [ ] Notificação de sucesso/falha no deploy

---

### E6-H3 · LGPD — Consentimento e gestão de dados 🟠 P1 ⏳

**Como** empresa B2,  
**quero** ter controles mínimos de LGPD implementados,  
**para que** estejamos em conformidade ao crescer a base de clientes.

**Critérios de aceite:**
- [ ] Tela de aceite de termos de uso e política de privacidade no primeiro login do cliente
- [ ] Possibilidade de exportar todos os dados de um cliente (direito de portabilidade)
- [ ] Possibilidade de excluir completamente um cliente e todos seus dados
- [ ] Log de acesso: quem acessou qual perfil e quando
- [ ] Dados sensíveis criptografados em repouso

---

### E6-H4 · Monitoramento e alertas de erro 🟡 P2 ⏳

**Como** time B2,  
**quero** ser alertado quando algo quebra em produção,  
**para que** eu possa corrigir antes que o planejador ou cliente perceba.

**Critérios de aceite:**
- [ ] Integrar Sentry (ou similar) para captura de erros de frontend
- [ ] Alertas por e-mail/Slack quando erro crítico ocorrer
- [ ] Dashboard de uptime e performance
- [ ] Log de erros nas Edge Functions do Supabase

---

---

## Roadmap por Marcos

### 🏁 Marco 0 — MVP Desktop (CONCLUÍDO ✅)
**Objetivo:** Sistema funcional para planejadores e clientes lerem dados financeiros.

| | |
|---|---|
| Período | Março 2026 |
| Planejadores | 4 |
| Clientes | ~100 |
| Entregável | Sistema rodando no Netlify com acesso de cliente |

---

### 🚀 Marco 1 — Produção Estável
**Objetivo:** Migrar para produção com ambiente separado, LGPD básico e relatório pós-sessão.

| Item | Épico | Prioridade |
|------|-------|-----------|
| Migração Supabase produção | E6-H1 | 🔴 P0 |
| Relatório pós-sessão (PDF + envio) | E3-H3 | 🟠 P1 |
| LGPD básico (consentimento + exclusão) | E6-H3 | 🟠 P1 |
| Deploy automatizado GitHub | E6-H2 | 🟡 P2 |

**Meta:** Abril/Maio 2026 · 4 planejadores · 100–150 clientes

---

### 🎯 Marco 2 — Ingestão Inteligente de Dados
**Objetivo:** Eliminar o gargalo manual de tratamento de extratos.

| Item | Épico | Prioridade |
|------|-------|-----------|
| Upload inteligente de extratos brutos | E1-H1 | 🔴 P0 |
| Detecção automática de banco/formato | E1-H2 | 🟠 P1 |
| Pré-visualização e correção antes de importar | E1-H1 | 🔴 P0 |

**Meta:** Maio/Junho 2026 · reduzir tempo de onboarding de extrato de ~30min para ~5min

---

### 📱 Marco 3 — Captura de Gastos em Tempo Real
**Objetivo:** Cliente registra gastos via WhatsApp e vê progresso das metas em tempo real.

| Item | Épico | Prioridade |
|------|-------|-----------|
| Bot WhatsApp (foto, texto, áudio) | E2-H1 | 🔴 P0 |
| Painel mobile "Hoje" (PWA) | E2-H2 | 🟠 P1 |
| Notificações de meta (80% e 100%) | E2-H3 | 🟡 P2 |

**Meta:** Julho/Agosto 2026 · diferencial de produto · suporte a ~200 clientes

---

### 🏆 Marco 4 — Gamificação e Objetivos
**Objetivo:** Cliente vê sua evolução de forma motivadora e tem metas claras de longo prazo.

| Item | Épico | Prioridade |
|------|-------|-----------|
| Objetivos e metas financeiras | E3-H1 | 🟠 P1 |
| Dashboard gamificado (score, conquistas) | E3-H2 | 🟡 P2 |
| Simulador de aposentadoria | E3-H4 | 🟡 P2 |

**Meta:** Setembro/Outubro 2026 · retenção e engajamento do cliente · ~300 clientes

---

### 🤖 Marco 5 — IA e Google Workspace
**Objetivo:** Planejador ganha superpoderes de análise; gestão centralizada no sistema.

| Item | Épico | Prioridade |
|------|-------|-----------|
| Assistente IA para o planejador | E4-H1 | 🟡 P2 |
| Assistente IA para o cliente | E4-H2 | 🟡 P2 |
| Agenda Google integrada | E5-H1 | 🟡 P2 |
| Transcrição automática de sessões | E4-H3 | 🟢 P3 |
| Google Drive por cliente | E5-H2 | 🟢 P3 |

**Meta:** Q1 2027 · ~500 clientes · eficiência operacional máxima

---

### 🌐 Marco 6 — Open Finance
**Objetivo:** Importação automática de transações sem upload manual.

| Item | Épico | Prioridade |
|------|-------|-----------|
| Integração Open Finance (Pluggy/Belvo) | E1-H3 | 🟢 P3 |
| Sincronização automática por conta | E1-H3 | 🟢 P3 |

**Meta:** 2027 · dependente de maturidade regulatória e consentimento dos clientes

---

---

## Resumo Visual do Roadmap

```
2026
 Abr/Mai ── Marco 1: Produção Estável + Relatório Pós-Sessão
 Mai/Jun ── Marco 2: Ingestão Inteligente de Extratos
 Jul/Ago ── Marco 3: WhatsApp + Gastos em Tempo Real + PWA Mobile
 Set/Out ── Marco 4: Gamificação + Objetivos + Simuladores

2027
 Jan/Mar ── Marco 5: IA Assistente + Google Workspace
 Mid 2027 ─ Marco 6: Open Finance
```

---

## Backlog Priorizado (ordem de execução sugerida)

| # | Item | Épico | Marco | Prioridade |
|---|------|-------|-------|-----------|
| 1 | Migração Supabase produção | E6-H1 | M1 | 🔴 P0 |
| 2 | Relatório pós-sessão PDF | E3-H3 | M1 | 🟠 P1 |
| 3 | LGPD básico | E6-H3 | M1 | 🟠 P1 |
| 4 | Upload inteligente de extratos | E1-H1 | M2 | 🔴 P0 |
| 5 | Detecção automática de banco | E1-H2 | M2 | 🟠 P1 |
| 6 | Bot WhatsApp captura de gastos | E2-H1 | M3 | 🔴 P0 |
| 7 | PWA Mobile — painel "Hoje" | E2-H2 | M3 | 🟠 P1 |
| 8 | Notificações de meta | E2-H3 | M3 | 🟡 P2 |
| 9 | Objetivos e metas financeiras | E3-H1 | M4 | 🟠 P1 |
| 10 | Dashboard gamificado | E3-H2 | M4 | 🟡 P2 |
| 11 | Simulador de aposentadoria | E3-H4 | M4 | 🟡 P2 |
| 12 | Deploy automatizado GitHub | E6-H2 | M1 | 🟡 P2 |
| 13 | Monitoramento e alertas | E6-H4 | — | 🟡 P2 |
| 14 | Assistente IA planejador | E4-H1 | M5 | 🟡 P2 |
| 15 | Assistente IA cliente | E4-H2 | M5 | 🟡 P2 |
| 16 | Agenda Google | E5-H1 | M5 | 🟡 P2 |
| 17 | Transcrição de sessões | E4-H3 | M5 | 🟢 P3 |
| 18 | Google Drive por cliente | E5-H2 | M5 | 🟢 P3 |
| 19 | Gmail centralizado | E5-H3 | M5 | 🟢 P3 |
| 20 | Open Finance | E1-H3 | M6 | 🟢 P3 |

---

## Perguntas em Aberto (a definir antes de cada marco)

| Questão | Relevante para |
|---------|---------------|
| Qual provedor de WhatsApp Business? (Twilio, Z-API, Evolution API) | Marco 3 |
| PWA ou app nativo (React Native)? | Marco 3 |
| Qual modelo de IA? (OpenAI GPT-4, Gemini, Claude) | Marco 5 |
| Conta Google corporativa da B2 para integração? | Marco 5 |
| Consentimento Open Finance: fluxo com o cliente | Marco 6 |
| Score financeiro: fórmula de cálculo a definir com a equipe B2 | Marco 4 |
| Conquistas/badges: lista a definir com a equipe B2 | Marco 4 |

---

*Documento vivo — atualizar a cada marco concluído.*  
*Próxima revisão sugerida: após conclusão do Marco 1.*
