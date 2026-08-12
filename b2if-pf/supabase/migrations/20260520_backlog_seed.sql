-- ── Seed: Backlog B2IF — Versão 1.0 (Abril 2026) ─────────────────────────────
-- Apaga todos os itens existentes e reinsere os do documento BACKLOG_B2IF.docx
-- Execute este script no Supabase SQL Editor

DELETE FROM public.backlog_items;

INSERT INTO public.backlog_items
  (item_id, titulo, descricao, o_que, por_que, como, area, prioridade, esforco, sprint, status, criado_por)
VALUES

-- ── ÉPICO 1 — Ingestão e Tratamento de Dados ────────────────────────────────

('E1-H1',
 'Upload inteligente de extratos brutos',
 'Como planejador, quero enviar o extrato bruto do cliente (PDF, foto, CSV de qualquer banco) direto no sistema, para que ele trate, normalize e importe automaticamente sem precisar de IA externa.',
 'Aceitar PDF de qualquer banco (Itaú, Bradesco, Nubank, BB, XP, Inter), foto/imagem via OCR e CSV em diferentes formatos bancários. Detectar data, valor, descrição e tipo automaticamente. Exibir pré-visualização antes de confirmar e permitir correção manual antes de salvar.',
 'Eliminar o gargalo manual de preparar extratos via IA externa antes de subir no sistema. Reduzir tempo de onboarding de ~30 min para ~5 min.',
 'Parser universal de PDF bancário com fallback para OCR (Google Vision ou Tesseract). Pipeline de normalização de colunas por heurística. Tela de pré-visualização com edição inline. Endpoint de upload na Edge Function.',
 'Ingestão de Dados', 'alta', 'alto', '—', 'backlog', 'Sistema'),

('E1-H2',
 'Detecção automática de banco e formato',
 'Como planejador, quero que o sistema detecte automaticamente de qual banco é o extrato, para não precisar escolher o formato manualmente.',
 'Identificar banco pelo cabeçalho/layout do arquivo. Aplicar parser específico por banco automaticamente. Fallback para parser genérico quando banco não reconhecido. Lembrar qual banco cada conta do cliente usa.',
 'Reduzir fricção no onboarding de novos clientes e novos extratos.',
 'Mapa de assinaturas por banco (header, colunas, encoding). Cache de banco por conta no perfil do cliente.',
 'Ingestão de Dados', 'media', 'medio', '—', 'backlog', 'Sistema'),

('E1-H3',
 'Integração Open Finance',
 'Como planejador, quero conectar a conta bancária do cliente via Open Finance, para que as transações sejam importadas automaticamente sem upload manual.',
 'Conectar via API Pluggy ou Belvo. Sincronização periódica automática (diária ou em tempo real). Planejador aprova/revisa antes de categorizar. Histórico de sincronizações por conta.',
 'Eliminar completamente o upload manual de extratos no longo prazo.',
 'Integração via Pluggy ou Belvo. Webhook de notificação de novas transações. Fila de aprovação no painel do planejador. Dependente de regulação Bacen e consentimento LGPD.',
 'Ingestão de Dados', 'baixa', 'alto', '—', 'backlog', 'Sistema'),

-- ── ÉPICO 2 — Acompanhamento de Gastos em Tempo Real ────────────────────────

('E2-H1',
 'Captura de gasto via WhatsApp',
 'Como cliente, quero enviar foto de cupom fiscal, áudio ou texto no WhatsApp, para que o gasto seja registrado automaticamente no meu perfil financeiro.',
 'Bot WhatsApp recebe mensagem do cliente (Twilio, Z-API ou Evolution API). Processar foto de cupom (estabelecimento, valor, data), texto livre e áudio. IA categoriza automaticamente. Confirmação de volta com saldo restante da categoria. Planejador pode revisar/corrigir.',
 'Capturar gastos do cliente no dia a dia sem depender da memória ou planilhas manuais.',
 'Configurar webhook WhatsApp Business API. Integrar OCR para cupons. Integrar Whisper ou Google Speech para áudio. GPT para interpretação de texto livre. Endpoint de entrada de transação avulsa por cliente_id.',
 'Acompanhamento em Tempo Real', 'alta', 'alto', '—', 'backlog', 'Sistema'),

('E2-H2',
 'Painel mobile "Hoje" (PWA)',
 'Como cliente, quero ver no celular quanto já gastei hoje e no mês por categoria, para tomar decisões conscientes no momento do gasto.',
 'Tela mobile com barras de progresso por categoria. Destaque para categorias próximas ou acima da meta. Últimas transações do dia. Saldo disponível por macro (Consumo, Fixas, etc.). Funciona como PWA sem precisar de app store.',
 'Dar ao cliente visibilidade do seu progresso financeiro fora da sessão mensal.',
 'PWA com Service Worker. Componentes mobile-first. Dados em tempo real via Supabase Realtime ou polling curto.',
 'Acompanhamento em Tempo Real', 'media', 'alto', '—', 'backlog', 'Sistema'),

('E2-H3',
 'Notificações proativas de meta',
 'Como cliente, quero receber alertas quando estou chegando perto do limite de uma categoria, para ajustar meu comportamento antes de estourar.',
 'Alerta ao atingir 80% da meta de uma categoria. Alerta ao ultrapassar a meta. Canal configurável: WhatsApp, push (PWA) ou e-mail. Planejador define quais categorias têm alerta por cliente.',
 'Dar ao cliente controle proativo sobre os gastos, reduzindo estouro de metas.',
 'Job agendado (cron) que verifica progresso das categorias. Integração com canal de notificação configurado. Painel de configuração de alertas por categoria no perfil do cliente.',
 'Acompanhamento em Tempo Real', 'media', 'medio', '—', 'backlog', 'Sistema'),

-- ── ÉPICO 3 — Gamificação e Progresso do Cliente ────────────────────────────

('E3-H1',
 'Objetivos e Metas Financeiras',
 'Como planejador, quero cadastrar objetivos financeiros para o cliente (reserva de emergência, viagem, imóvel, aposentadoria), para que ele veja para onde está indo e o que já conquistou.',
 'Criar objetivo com nome, valor alvo, prazo e ícone/foto. Vincular a categoria de Investimentos. Calcular progresso automaticamente. Exibir % concluído e valor atual vs alvo. Calcular aporte mensal necessário. Alertar quando aporte do mês não foi feito.',
 'Dar ao cliente uma visão concreta de seus objetivos e o motivar a manter os aportes.',
 'Tabela goals no Supabase vinculada ao cliente. Cálculo de progresso baseado nas transações categorizadas. Componente visual de progresso no dashboard do cliente.',
 'Gamificação e Progresso', 'media', 'alto', '—', 'backlog', 'Sistema'),

('E3-H2',
 'Dashboard Gamificado',
 'Como cliente, quero ver meu progresso financeiro de forma visual e motivadora, para me sentir engajado com minha evolução.',
 'Linha do tempo de evolução patrimonial. Conquistas desbloqueadas ("Primeiro mês sem estourar meta", "3 meses com saldo positivo"). Score financeiro mensal 0–100. Comparativo mês a mês. Animações simples ao atingir uma meta.',
 'Aumentar engajamento e retenção do cliente através de gamificação.',
 'Score calculado a partir de adimplência às metas, saldo positivo e aportes realizados. Biblioteca de conquistas/badges. Animações CSS simples. Lista de badges definida com equipe B2.',
 'Gamificação e Progresso', 'media', 'alto', '—', 'backlog', 'Sistema'),

('E3-H3',
 'Relatório Mensal Automático pós-sessão',
 'Como planejador, quero gerar e enviar automaticamente um relatório pós-sessão, para que o cliente saia da reunião com resumo claro do que foi discutido e os próximos passos.',
 'PDF com panorama do mês anterior, desvios da meta, evolução do score e objetivos em andamento. Campo para ajustes propostos, deveres de casa e alvos do próximo mês. Envio automático por e-mail ou WhatsApp ao clicar "Fechar sessão". Cliente acessa histórico de relatórios. Layout profissional com branding B2.',
 'Formalizar a entrega de valor da sessão e manter o cliente engajado entre sessões.',
 'Geração de PDF com html2canvas ou jsPDF. Template com branding B2. Integração com e-mail (SendGrid/Resend) ou WhatsApp para envio. Tabela session_reports no Supabase.',
 'Gamificação e Progresso', 'media', 'alto', '—', 'backlog', 'Sistema'),

('E3-H4',
 'Simulador de Aposentadoria e Objetivos de Longo Prazo',
 'Como planejador, quero realizar simulações de aposentadoria e objetivos de longo prazo diretamente no sistema, para que o cliente visualize cenários e tome decisões baseadas em dados.',
 'Simulador de aposentadoria: idade atual, desejada, patrimônio atual, aporte mensal, taxa → patrimônio projetado. Modo usufruto total e parcial. Projeção de renda mensal. Simulador de objetivo ("Imóvel de R$500k em 5 anos"). Gráfico de projeção com e sem inflação. Salvar simulações no perfil do cliente.',
 'Dar ao planejador ferramentas de análise de longo prazo dentro do sistema, sem depender de planilhas externas.',
 'Fórmulas financeiras de juros compostos. Gráfico interativo (Recharts ou Chart.js). Tabela simulations no Supabase.',
 'Gamificação e Progresso', 'media', 'alto', '—', 'backlog', 'Sistema'),

-- ── ÉPICO 4 — IA Integrada ao Sistema ───────────────────────────────────────

('E4-H1',
 'Assistente IA para o Planejador',
 'Como planejador, quero perguntar à IA sobre os dados de um cliente, para ter insights rápidos sem precisar analisar tabelas manualmente.',
 'Chat embutido no sistema por cliente ou visão geral. Contexto inclui transações, categorias, planejamento, objetivos e histórico. Respostas com dados reais. Sugestões proativas de anomalias. IA pode gerar rascunho de relatório pós-sessão.',
 'Aumentar eficiência do planejador na preparação e condução das sessões.',
 'RAG (Retrieval-Augmented Generation) com dados do cliente no contexto. Integração com OpenAI GPT-4 ou Gemini. Edge Function para processar o chat. Definir modelo com equipe (GPT-4, Gemini, Claude).',
 'IA Integrada', 'media', 'alto', '—', 'backlog', 'Sistema'),

('E4-H2',
 'Assistente IA para o Cliente',
 'Como cliente, quero perguntar ao assistente sobre minha situação financeira, para entender meus dados sem precisar esperar a próxima sessão com o planejador.',
 'Chat disponível na área do cliente (desktop e mobile). Responde apenas com base nos dados do próprio cliente. Tom motivador e didático, não técnico. Não sugere produtos financeiros (compliance).',
 'Dar ao cliente acesso a insights financeiros personalizados entre as sessões.',
 'Mesma infraestrutura do assistente do planejador, com escopo restrito ao cliente autenticado. Guardrails de compliance (sem sugestão de produtos). Tom configurável por prompt.',
 'IA Integrada', 'media', 'alto', '—', 'backlog', 'Sistema'),

('E4-H3',
 'Transcrição e Resumo Automático de Sessões',
 'Como planejador, quero gravar e transcrever automaticamente a sessão com o cliente via Google Meet, para ter o resumo salvo no perfil do cliente sem precisar tomar notas manualmente.',
 'Integração com Google Meet API para captura de transcrição. IA gera resumo estruturado: tópicos discutidos, decisões tomadas, próximos passos. Resumo salvo no perfil do cliente com data. Planejador pode editar antes de salvar. Histórico de sessões acessível.',
 'Eliminar a necessidade de tomar notas manuais durante as sessões.',
 'Google Meet API para captura de áudio/transcrição. Whisper ou Google Speech-to-Text para transcrição. GPT para estruturação do resumo. Tabela session_transcripts no Supabase.',
 'IA Integrada', 'baixa', 'alto', '—', 'backlog', 'Sistema'),

-- ── ÉPICO 5 — Integração Google Workspace ───────────────────────────────────

('E5-H1',
 'Agenda Google integrada ao sistema',
 'Como planejador, quero ver e gerenciar minha agenda do Google Calendar dentro do sistema, para não precisar alternar entre ferramentas durante o atendimento.',
 'Visualização semanal/mensal da agenda no painel do planejador. Criar, editar e cancelar compromissos. Vincular evento a um cliente do sistema. Notificação 15 min antes da sessão. Link automático do Meet inserido no evento.',
 'Centralizar agenda e atendimento no mesmo sistema, reduzindo troca de contexto.',
 'Google Calendar API via OAuth. Componente de calendário embedded. Vinculação evento ↔ cliente por campo customizado. Notificação via push ou WhatsApp.',
 'Google Workspace', 'media', 'alto', '—', 'backlog', 'Sistema'),

('E5-H2',
 'Google Drive — documentos do cliente',
 'Como planejador, quero acessar e salvar documentos do cliente diretamente no Google Drive pelo sistema, para que tudo fique centralizado no perfil do cliente.',
 'Pasta no Drive criada automaticamente ao criar novo cliente. Upload de documentos (contratos, declarações, extratos) pelo sistema. Visualização de arquivos do Drive dentro do perfil do cliente. Relatórios pós-sessão salvos automaticamente na pasta do cliente.',
 'Centralizar documentação do cliente sem precisar abrir o Google Drive separadamente.',
 'Google Drive API via OAuth. Criação automática de pasta com template de estrutura. Listagem e upload de arquivos integrados ao perfil do cliente.',
 'Google Workspace', 'baixa', 'alto', '—', 'backlog', 'Sistema'),

('E5-H3',
 'Gmail — comunicação centralizada',
 'Como planejador, quero enviar e-mails para o cliente diretamente do sistema, para que toda comunicação fique registrada no histórico do cliente.',
 'Enviar e-mail usando conta Gmail do planejador via OAuth. Templates pré-definidos: pós-sessão, lembrete de sessão, alerta de meta. Histórico de e-mails enviados no perfil do cliente. Resposta do cliente notifica o planejador no sistema.',
 'Centralizar comunicação e manter histórico completo no perfil do cliente.',
 'Gmail API via OAuth. Editor de e-mail com templates. Webhook de resposta para notificação no sistema. Tabela client_emails no Supabase.',
 'Google Workspace', 'baixa', 'medio', '—', 'backlog', 'Sistema'),

-- ── ÉPICO 6 — Infraestrutura e Escalabilidade ───────────────────────────────

('E6-H1',
 'Migração para ambiente de produção',
 'Como time B2, quero ter um ambiente de produção separado e estável, para que os dados reais dos clientes fiquem isolados do ambiente de desenvolvimento.',
 'Supabase produção criado e configurado. Schema, RLS e Edge Functions migrados. Variáveis de ambiente configuradas no Netlify/Cloudflare. Domínio próprio configurado. Backup automático habilitado.',
 'Garantir que os dados reais dos clientes estejam em ambiente seguro e isolado.',
 'Criar projeto Supabase produção separado. Script de migração de schema. Configuração de variáveis de ambiente. DNS e domínio personalizado.',
 'Infraestrutura', 'alta', 'medio', '—', 'backlog', 'Sistema'),

('E6-H2',
 'Deploy automatizado via GitHub',
 'Como time B2, quero que o deploy seja feito automaticamente ao fazer push na branch main, para que novas versões cheguem em produção sem processo manual.',
 'Repositório GitHub conectado ao Netlify/Cloudflare. Branch main → deploy automático em produção. Branch develop → deploy automático em staging. Notificação de sucesso/falha no deploy.',
 'Eliminar deploy manual e reduzir risco de erro humano no processo de publicação.',
 'GitHub Actions ou integração nativa Cloudflare Pages com GitHub. Configuração de branches protegidas. Notificação via Slack ou e-mail.',
 'Infraestrutura', 'media', 'baixo', '—', 'backlog', 'Sistema'),

('E6-H3',
 'LGPD — Consentimento e gestão de dados',
 'Como empresa B2, quero ter controles mínimos de LGPD implementados, para que estejamos em conformidade ao crescer a base de clientes.',
 'Tela de aceite de termos de uso e política de privacidade no primeiro login do cliente. Exportar todos os dados de um cliente (direito de portabilidade). Excluir completamente um cliente e todos seus dados. Log de acesso: quem acessou qual perfil e quando.',
 'Estar em conformidade com a LGPD antes de escalar para 500 clientes.',
 'Modal de consentimento no primeiro login. Endpoint de exportação de dados em JSON/CSV. Soft delete com cascade nas tabelas relacionadas. Tabela de audit log.',
 'Infraestrutura', 'media', 'medio', '—', 'backlog', 'Sistema'),

('E6-H4',
 'Monitoramento e alertas de erro',
 'Como time B2, quero ser alertado quando algo quebra em produção, para corrigir antes que o planejador ou cliente perceba.',
 'Integrar Sentry (ou similar) para captura de erros de frontend. Alertas por e-mail quando erro crítico ocorrer. Log de erros nas Edge Functions do Supabase.',
 'Detectar e corrigir problemas em produção antes que afete usuários.',
 'Integrar Sentry com React (ErrorBoundary + SDK). Configurar alertas por severidade. Habilitar logging estruturado nas Edge Functions do Supabase.',
 'Infraestrutura', 'media', 'medio', '—', 'backlog', 'Sistema');

