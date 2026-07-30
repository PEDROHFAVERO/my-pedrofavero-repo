#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador de Documentação PDF Completa — B2IF PF
Planejador Financeiro Pessoal
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import Flowable
import datetime

# ── Paleta de cores B2IF ──────────────────────────────────────────────────────
BRAND   = colors.HexColor('#6366F1')   # índigo/violeta
REC     = colors.HexColor('#22C55E')   # verde (receitas)
DESP    = colors.HexColor('#EF4444')   # vermelho (despesas)
YELLOW  = colors.HexColor('#EAB308')   # amarelo
INFO    = colors.HexColor('#3B82F6')   # azul
PURPLE  = colors.HexColor('#A78BFA')   # lilás
BG      = colors.HexColor('#0F0F14')   # fundo escuro
CARD    = colors.HexColor('#1A1A24')   # card
BORDER  = colors.HexColor('#2D2D3D')   # borda
TEXT    = colors.HexColor('#E8E8F0')   # texto principal
MUTED   = colors.HexColor('#8B8BA0')   # texto secundário

# Cores para tabelas (modo claro para melhor leitura no PDF)
PDF_BG      = colors.white
PDF_HEADER  = colors.HexColor('#4F46E5')   # indigo escuro
PDF_ROW1    = colors.HexColor('#F8F7FF')   # lilás muito claro
PDF_ROW2    = colors.white
PDF_BORDER  = colors.HexColor('#E0DFFF')
PDF_TEXT    = colors.HexColor('#1E1B4B')
PDF_MUTED   = colors.HexColor('#6B7280')
PDF_GREEN   = colors.HexColor('#16A34A')
PDF_RED     = colors.HexColor('#DC2626')
PDF_BLUE    = colors.HexColor('#1D4ED8')
PDF_YELLOW  = colors.HexColor('#CA8A04')
PDF_PURPLE  = colors.HexColor('#7C3AED')
PDF_ORANGE  = colors.HexColor('#D97706')

PAGE_W, PAGE_H = A4

# ── Estilos ───────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def S(name, **kwargs):
    base = styles.get(name, styles['Normal'])
    return ParagraphStyle(name + '_custom_' + str(id(kwargs)), parent=base, **kwargs)

TITLE_MAIN = S('Title',
    fontSize=32, textColor=PDF_HEADER, fontName='Helvetica-Bold',
    alignment=TA_CENTER, spaceAfter=6, leading=38)

TITLE_SUB = S('Normal',
    fontSize=13, textColor=PDF_MUTED, fontName='Helvetica',
    alignment=TA_CENTER, spaceAfter=4, leading=16)

H1 = S('Heading1',
    fontSize=20, textColor=PDF_HEADER, fontName='Helvetica-Bold',
    spaceBefore=20, spaceAfter=8, leading=24,
    borderPadding=(0,0,4,0))

H2 = S('Heading2',
    fontSize=15, textColor=PDF_BLUE, fontName='Helvetica-Bold',
    spaceBefore=14, spaceAfter=6, leading=18)

H3 = S('Heading3',
    fontSize=12, textColor=PDF_PURPLE, fontName='Helvetica-Bold',
    spaceBefore=10, spaceAfter=4, leading=15)

H4 = S('Heading4',
    fontSize=11, textColor=PDF_TEXT, fontName='Helvetica-Bold',
    spaceBefore=8, spaceAfter=3, leading=14)

BODY = S('Normal',
    fontSize=10, textColor=PDF_TEXT, fontName='Helvetica',
    spaceAfter=5, leading=15, alignment=TA_JUSTIFY)

BODY_L = S('Normal',
    fontSize=10, textColor=PDF_TEXT, fontName='Helvetica',
    spaceAfter=4, leading=15, alignment=TA_LEFT)

BULLET = S('Normal',
    fontSize=10, textColor=PDF_TEXT, fontName='Helvetica',
    spaceAfter=3, leading=14, leftIndent=12,
    bulletIndent=0)

BULLET2 = S('Normal',
    fontSize=9.5, textColor=PDF_MUTED, fontName='Helvetica',
    spaceAfter=3, leading=13, leftIndent=24,
    bulletIndent=12)

NOTE = S('Normal',
    fontSize=9, textColor=PDF_MUTED, fontName='Helvetica-Oblique',
    spaceAfter=4, leading=13, leftIndent=8,
    borderPadding=(4,4,4,8))

CODE = S('Normal',
    fontSize=9, textColor=PDF_BLUE, fontName='Courier',
    spaceAfter=3, leading=13, backColor=colors.HexColor('#EEF2FF'),
    borderPadding=(3,6,3,6), leftIndent=6)

CAPTION = S('Normal',
    fontSize=8.5, textColor=PDF_MUTED, fontName='Helvetica-Oblique',
    alignment=TA_CENTER, spaceAfter=6, leading=12)

def tbl_style(header_color=PDF_HEADER, row1=PDF_ROW1, row2=PDF_ROW2):
    return TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), header_color),
        ('TEXTCOLOR',    (0,0), (-1,0), colors.white),
        ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0), (-1,0), 9),
        ('ALIGN',        (0,0), (-1,0), 'CENTER'),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[row1, row2]),
        ('FONTNAME',     (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE',     (0,1), (-1,-1), 9),
        ('GRID',         (0,0), (-1,-1), 0.5, PDF_BORDER),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ])

def colored_box(text, color, bg=None):
    """Parágrafo com fundo colorido leve"""
    bg_hex = bg or colors.HexColor(int(color.hexval().replace('#',''), 16) & 0xFFFFFF | 0x1A000000)
    return Paragraph(text, S('Normal',
        fontSize=10, textColor=color, fontName='Helvetica-Bold',
        backColor=colors.HexColor(str(color).replace('#','') if hasattr(color,'hexval') else '#EEF2FF'),
        borderPadding=(5,8,5,8), leading=15, spaceAfter=6))

def box(text, border_color=PDF_BLUE, bg_color=None):
    bc = bg_color or colors.HexColor('#EFF6FF')
    return Paragraph(text, S('Normal',
        fontSize=10, textColor=PDF_TEXT, fontName='Helvetica',
        backColor=bc, borderPadding=(6,10,6,10),
        leading=15, spaceAfter=8,
        borderColor=border_color, borderWidth=1))

def section_divider(color=PDF_HEADER):
    return HRFlowable(width='100%', thickness=2, color=color, spaceAfter=4, spaceBefore=4)

def thin_divider():
    return HRFlowable(width='100%', thickness=0.5, color=PDF_BORDER, spaceAfter=3, spaceBefore=3)

def P(txt, style=None):
    return Paragraph(txt, style or BODY)

def B(txt):
    return f'<b>{txt}</b>'

def C_tag(txt, color):
    return f'<font color="{color}">{txt}</font>'

# ══════════════════════════════════════════════════════════════════════════════
# CONTEÚDO DO DOCUMENTO
# ══════════════════════════════════════════════════════════════════════════════

def build_document():
    story = []

    # ── CAPA ──────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 3*cm))
    story.append(Paragraph('B2IF PF', TITLE_MAIN))
    story.append(Paragraph('Planejador Financeiro Pessoal', TITLE_SUB))
    story.append(Spacer(1, 0.5*cm))
    story.append(section_divider(PDF_HEADER))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('Documentação Técnica e Funcional Completa', S('Normal',
        fontSize=14, textColor=PDF_PURPLE, fontName='Helvetica-Bold',
        alignment=TA_CENTER, spaceAfter=4)))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(f'Versão MVP · Gerado em {datetime.date.today().strftime("%d/%m/%Y")}', S('Normal',
        fontSize=11, textColor=PDF_MUTED, fontName='Helvetica', alignment=TA_CENTER)))
    story.append(Spacer(1, 1*cm))

    # Resumo executivo na capa
    story.append(box(
        '<b>Sobre este documento:</b> Esta documentação descreve de forma completa o sistema '
        'B2IF PF — Planejador Financeiro Pessoal. Cobre arquitetura, perfis de usuário, '
        'fluxos de navegação, todas as telas com seus componentes e gráficos, '
        'regras de negócio, banco de dados, segurança e tecnologias utilizadas. '
        'É suficiente para que uma pessoa que nunca acessou o sistema compreenda '
        'integralmente seu funcionamento.',
        PDF_HEADER, colors.HexColor('#EEF2FF')
    ))

    story.append(Spacer(1, 1*cm))
    story.append(Paragraph('B2 Inteligência Financeira · Sistema de Uso Interno', S('Normal',
        fontSize=10, textColor=PDF_MUTED, fontName='Helvetica', alignment=TA_CENTER)))
    story.append(PageBreak())

    # ── ÍNDICE ─────────────────────────────────────────────────────────────────
    story.append(Paragraph('Índice', H1))
    story.append(section_divider())

    toc_data = [
        ['#', 'Seção', 'Pág.'],
        ['1', 'Visão Geral do Sistema', '3'],
        ['2', 'Arquitetura e Tecnologias', '4'],
        ['3', 'Perfis de Usuário', '5'],
        ['4', 'Autenticação e Roteamento', '6'],
        ['5', 'Tela: Login', '7'],
        ['6', 'Tela: Painel Manager', '8'],
        ['7', 'Tela: Hub do Planejador', '10'],
        ['8', 'Tela: Dashboard Financeiro', '12'],
        ['8.1', '   Visão Geral Anual — Gráficos e Tabelas', '13'],
        ['8.2', '   Visão Mensal / Multi-Mês', '16'],
        ['8.3', '   Abas de Macro-Categorias', '18'],
        ['9', 'Tela: Fluxo Financeiro (Categorizador)', '19'],
        ['9.1', '   Aba Transações', '20'],
        ['9.2', '   Aba Contas', '23'],
        ['9.3', '   Aba Categorias', '24'],
        ['10', 'Tela: Planejador Financeiro', '25'],
        ['11', 'Modal: Gerenciar Acessos do Cliente', '27'],
        ['12', 'Banco de Dados (Supabase)', '28'],
        ['13', 'Segurança e Permissões (RLS)', '30'],
        ['14', 'Regras de Negócio', '31'],
        ['15', 'Categorias e Grupos Financeiros', '33'],
        ['16', 'Importação de Arquivos', '35'],
        ['17', 'Modo Cliente (Leitura)', '36'],
        ['18', 'Fluxos de Uso por Perfil', '37'],
        ['19', 'Glossário', '39'],
    ]
    tbl = Table(toc_data, colWidths=[1.2*cm, 13*cm, 1.8*cm])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',   (0,0),(-1,0), PDF_HEADER),
        ('TEXTCOLOR',    (0,0),(-1,0), colors.white),
        ('FONTNAME',     (0,0),(-1,0), 'Helvetica-Bold'),
        ('FONTSIZE',     (0,0),(-1,0), 9),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[PDF_ROW1, PDF_ROW2]),
        ('FONTNAME',     (0,1),(-1,-1), 'Helvetica'),
        ('FONTSIZE',     (0,1),(-1,-1), 9),
        ('GRID',         (0,0),(-1,-1), 0.3, PDF_BORDER),
        ('TOPPADDING',   (0,0),(-1,-1), 4),
        ('BOTTOMPADDING',(0,0),(-1,-1), 4),
        ('LEFTPADDING',  (0,0),(-1,-1), 6),
        ('ALIGN',        (0,0),(0,-1), 'CENTER'),
        ('ALIGN',        (2,0),(2,-1), 'CENTER'),
    ]))
    story.append(tbl)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 1. VISÃO GERAL
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('1. Visão Geral do Sistema', H1))
    story.append(section_divider())

    story.append(P(
        'O <b>B2IF PF</b> (B2 Inteligência Financeira — Planejador Financeiro Pessoal) é uma '
        'aplicação web de uso interno da empresa <b>B2 Inteligência Financeira</b>, desenvolvida '
        'para que planejadores financeiros gerenciem, analisem e acompanhem as finanças de seus '
        'clientes pessoas físicas. O sistema roda 100% no navegador (SPA — Single Page Application) '
        'com backend em nuvem (Supabase).'
    ))

    story.append(Paragraph('Objetivos Principais', H2))
    objetivos = [
        ('Centralizar dados financeiros', 'Armazenar e organizar todas as transações financeiras dos clientes em um único lugar, acessível por planejadores e pelos próprios clientes.'),
        ('Categorização inteligente', 'Importar extratos de múltiplos bancos (CSV, XLSM, PDF) e classificar automaticamente cada transação por categoria e grupo macro-financeiro.'),
        ('Visualização estratégica', 'Oferecer dashboards visuais ricos — gráficos de linhas, barras, donut — para análise de receitas, despesas, saldo e tendências.'),
        ('Planejamento orçamentário', 'Permitir que o planejador defina limites mensais por categoria, compare com o realizado e projete o ano inteiro.'),
        ('Acesso controlado ao cliente', 'Dar ao cliente acesso somente-leitura ao seu próprio dashboard e extrato, sem poder editar dados.'),
        ('Gestão hierárquica', 'O Manager controla todos os planejadores; cada planejador cuida de sua carteira de clientes.'),
    ]
    for titulo, desc in objetivos:
        story.append(P(f'<b>• {titulo}:</b> {desc}'))

    story.append(Paragraph('Escopo do MVP', H2))
    story.append(P(
        'O MVP (Minimum Viable Product) atual contempla desktop como plataforma principal. '
        'Mobile está previsto em versão futura. O sistema suporta:'
    ))
    mvp_itens = [
        '4 planejadores ativos e ~100 clientes PF cadastrados',
        'Importação de extratos: CSV genérico, XLSM (Excel), PDF bancário',
        'Categorização manual e automática por regras aprendidas',
        'Dashboard anual e mensal com gráficos interativos',
        'Planejador financeiro mensal com projeção de valores',
        'Acesso hierárquico: Manager > Planejador > Cliente',
        'Gerenciamento de logins de clientes pelo planejador',
        'Deploy via Netlify (frontend) + Supabase (backend/banco)',
    ]
    for item in mvp_itens:
        story.append(P(f'  ✓  {item}', BULLET))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 2. ARQUITETURA E TECNOLOGIAS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('2. Arquitetura e Tecnologias', H1))
    story.append(section_divider())

    story.append(Paragraph('Stack Tecnológico', H2))
    tech_data = [
        ['Camada', 'Tecnologia', 'Finalidade'],
        ['Frontend', 'React 18 (Vite)', 'Interface web — SPA sem roteador externo'],
        ['Linguagem', 'JavaScript (JSX)', 'Todo o código frontend'],
        ['Estilos', 'Inline styles + tokens', 'Design system proprietário (tokens.js)'],
        ['Estado', 'React Context + Hooks', 'AppContext (dados cliente), AuthContext (auth)'],
        ['Backend / BaaS', 'Supabase (PostgreSQL)', 'Banco de dados, autenticação, RLS, Edge Functions'],
        ['Autenticação', 'Supabase Auth', 'JWT, login/senha, gerenciamento de usuários'],
        ['Edge Functions', 'Supabase Edge Functions', 'admin-cliente — operações administrativas seguras'],
        ['Parsing CSV', 'PapaParse', 'Leitura e parsing de arquivos CSV'],
        ['Parsing XLSX', 'SheetJS (xlsx)', 'Leitura de planilhas Excel/XLSM'],
        ['Parsing PDF', 'PDF.js (pdfjs-dist)', 'Extração de texto de PDFs bancários'],
        ['Deploy', 'Netlify (CDN global)', 'Hospedagem do frontend buildado'],
        ['Virtualização', 'Hook customizado (useVirtualList)', 'Renderização eficiente de listas longas'],
    ]
    tbl = Table(tech_data, colWidths=[3.5*cm, 5*cm, 8.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Estrutura de Arquivos', H2))
    story.append(P('O projeto segue a estrutura abaixo dentro do diretório <b>src/</b>:'))

    struct_data = [
        ['Diretório / Arquivo', 'Descrição'],
        ['src/main.jsx', 'Ponto de entrada da aplicação'],
        ['src/App.jsx', 'Roteador principal — detecta sessão e renderiza a página correta'],
        ['src/design/tokens.js', 'Sistema de design: cores (C), fontes (FONT), bordas (RADIUS)'],
        ['src/context/AuthContext.jsx', 'Contexto de autenticação, papéis, funções de gerenciar planejadores/clientes'],
        ['src/context/AppContext.jsx', 'Contexto de dados: hub de clientes, cliente ativo, sync Supabase'],
        ['src/lib/supabase.js', 'Instância única do cliente Supabase'],
        ['src/pages/PageLogin.jsx', 'Tela de login'],
        ['src/pages/PageManagerHub.jsx', 'Painel do Manager — gerencia planejadores'],
        ['src/pages/PageHub.jsx', 'Hub do Planejador — lista de clientes'],
        ['src/pages/PageDashboard.jsx', 'Dashboard financeiro do cliente'],
        ['src/pages/PageCategorizador.jsx', 'Fluxo financeiro — importação e categorização'],
        ['src/pages/PagePlanejador.jsx', 'Planejador mensal com orçamento'],
        ['src/components/UI.jsx', 'Componentes reutilizáveis (botões, cards, modais, KPIs...)'],
        ['src/components/ModalAcessos.jsx', 'Modal para gerenciar logins de clientes'],
        ['src/utils/parser.js', 'Utilitários de parsing, cálculos financeiros, auto-categorização'],
        ['src/utils/pdfParser.js', 'Parser específico para extratos PDF'],
        ['src/utils/clienteStorage.js', 'Utilitários de criação e sincronização de clientes'],
        ['src/data/categorias.js', 'Definição de grupos e categorias padrão'],
        ['src/data/mapeamentos.js', 'Mapeamento de nomes de planilha → IDs internos'],
        ['public/manifest.json', 'PWA manifest (ícones, nome)'],
        ['public/_redirects', 'Regra Netlify para SPA routing (/* → /index.html 200)'],
    ]
    tbl = Table(struct_data, colWidths=[7*cm, 10*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 3. PERFIS DE USUÁRIO
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('3. Perfis de Usuário', H1))
    story.append(section_divider())

    story.append(P(
        'O sistema possui três perfis hierárquicos distintos. Cada perfil tem acesso, '
        'permissões e visões diferentes dentro da plataforma.'
    ))

    perfis_data = [
        ['Perfil', 'Identificação', 'Acesso a', 'Permissões'],
        ['Manager', 'Registro na tabela planejadores com role = manager',
         'Painel Manager (PageManagerHub)',
         'CRUD completo de planejadores; acesso ao hub de qualquer planejador; migrar/excluir clientes; gerenciar acessos de clientes'],
        ['Planejador', 'Registro na tabela planejadores com role = planejador',
         'Hub (PageHub) + todas as telas do cliente',
         'CRUD de clientes próprios; importar dados; categorizar; planejar; criar logins para clientes'],
        ['Cliente', 'Registro na tabela cliente_acessos vinculado a um cliente',
         'Dashboard + Fluxo (modo leitura)',
         'Apenas visualização — sem editar dados, sem importar, sem criar/excluir registros'],
    ]
    tbl = Table(perfis_data, colWidths=[2.5*cm, 4.5*cm, 4*cm, 6*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph('Hierarquia e Impersonação', H2))
    story.append(P(
        'O Manager possui um recurso especial chamado <b>"Acessar Hub"</b>: ao clicar neste botão '
        'em um planejador específico, o sistema armazena o ID desse planejador em '
        '<b>localStorage</b> (chave: manager_viewing) e redireciona para o Hub. '
        'A partir desse momento, o Manager enxerga todos os clientes daquele planejador '
        'e pode operar como se fosse ele — sem precisar fazer login com as credenciais do planejador. '
        'Para sair da impersonação, basta limpar o localStorage ou fazer logout.'
    ))

    story.append(Paragraph('Ativação/Desativação de Planejadores', H2))
    story.append(P(
        'O Manager pode <b>desativar</b> um planejador (campo ativo = false na tabela planejadores). '
        'Um planejador desativado não consegue fazer login — o sistema retorna a mensagem '
        '"Conta desativada". Ele pode ser reativado a qualquer momento pelo Manager.'
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 4. AUTENTICAÇÃO E ROTEAMENTO
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('4. Autenticação e Roteamento', H1))
    story.append(section_divider())

    story.append(Paragraph('Fluxo de Autenticação', H2))
    story.append(P(
        'A autenticação utiliza o <b>Supabase Auth</b> com e-mail e senha (signInWithPassword). '
        'Após o login bem-sucedido, o sistema executa a função <b>resolverSessao</b> que determina '
        'o perfil do usuário verificando duas tabelas em ordem de prioridade:'
    ))
    auth_steps = [
        '1. Verifica tabela <b>cliente_acessos</b> → se encontrar, o usuário é um <b>Cliente</b>',
        '2. Verifica tabela <b>planejadores</b> → se encontrar, é <b>Planejador</b> ou <b>Manager</b> (campo role)',
        '3. Se não encontrar em nenhuma → erro "Usuário não encontrado no sistema"',
        '4. Se encontrar mas <b>ativo = false</b> → erro "Conta desativada"',
    ]
    for step in auth_steps:
        story.append(P(step, BULLET))

    story.append(Paragraph('Roteamento (App.jsx)', H2))
    story.append(P(
        'O App.jsx funciona como roteador sem biblioteca externa. Ele lê o estado da sessão '
        '(do AuthContext) e decide qual página renderizar:'
    ))
    routing_data = [
        ['Condição', 'Página Renderizada'],
        ['Sem sessão (não logado)', 'PageLogin — tela de login'],
        ['Sessão carregando', 'Spinner de carregamento central'],
        ['role = manager', 'PageManagerHub — painel do manager'],
        ['role = planejador ou manager impersonando', 'PageHub → PageDashboard / PageCategorizador / PagePlanejador'],
        ['role = cliente', 'Direto no Dashboard do cliente (modo leitura) — sem hub'],
    ]
    tbl = Table(routing_data, colWidths=[8*cm, 9*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Persistência de Sessão', H2))
    story.append(P(
        'O Supabase Auth persiste automaticamente o token JWT no localStorage do navegador. '
        'Ao recarregar a página, o sistema recupera a sessão via <b>supabase.auth.getSession()</b> '
        'e resolve o perfil novamente — sem necessidade de novo login enquanto o token for válido.'
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 5. TELA: LOGIN
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('5. Tela: Login (PageLogin)', H1))
    story.append(section_divider())

    story.append(P(
        'É a primeira tela que qualquer usuário vê. Apresenta o logo B2IF, título "B2IF PF — '
        'Planejador Financeiro" e um formulário centralizado na tela.'
    ))

    story.append(Paragraph('Componentes da Tela', H2))
    login_comp = [
        ['Elemento', 'Descrição'],
        ['Logo B2IF', 'Imagem /logo-light.png (72x72px), centralizada no topo'],
        ['Título', '"B2IF PF" em fonte grande + subtítulo "Planejador Financeiro" em cinza'],
        ['Campo E-mail', 'Input tipo email com autocomplete, placeholder "seu@email.com"'],
        ['Campo Senha', 'Input tipo password com botão olho (mostrar/ocultar senha)'],
        ['Botão Entrar', 'Estado loading com texto "Entrando..." e desabilitado durante a requisição'],
        ['Mensagem de erro', 'Card vermelho com a mensagem de erro abaixo do formulário'],
        ['Rodapé', '"B2IF Assessoria · Sistema de Uso Interno" em cinza claro'],
    ]
    tbl = Table(login_comp, colWidths=[4.5*cm, 12.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Validações', H2))
    valids = [
        'E-mail e senha são obrigatórios (validação frontend antes de chamar API)',
        'E-mail é convertido para lowercase antes do envio',
        'Conta desativada gera mensagem "Conta desativada. Contacte o seu planejador."',
        'Usuário não encontrado gera mensagem "Usuário não encontrado no sistema. Contacte o seu planejador."',
        'Erros do Supabase Auth são repassados diretamente na mensagem de erro',
    ]
    for v in valids:
        story.append(P(f'• {v}', BULLET))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 6. TELA: PAINEL MANAGER
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('6. Tela: Painel Manager (PageManagerHub)', H1))
    story.append(section_divider())

    story.append(P(
        'Exclusiva para o perfil Manager. É o centro de controle de todos os planejadores '
        'da plataforma. Permite criar, gerenciar e monitorar as contas dos profissionais '
        'que usam o sistema.'
    ))

    story.append(Paragraph('Layout da Tela', H2))
    story.append(P(
        '<b>Header (topo fixo):</b> Logo B2IF + badge "Manager" em roxo + nome do manager logado + '
        'botão "Sair". O header fica fixo (sticky) no topo durante o scroll.'
    ))
    story.append(P(
        '<b>Corpo principal:</b> Título "Painel Manager" + subtítulo + botão "+ Novo Planejador" '
        '(destaque em azul, canto superior direito).'
    ))
    story.append(P(
        '<b>Barra de busca:</b> Campo de texto para filtrar planejadores por nome ou e-mail em tempo real.'
    ))
    story.append(P(
        '<b>Lista de planejadores:</b> Cards horizontais, um por planejador, com avatar circular, '
        'nome, e-mail, data de criação e botões de ação.'
    ))

    story.append(Paragraph('Card de Planejador', H2))
    card_data = [
        ['Elemento', 'Descrição'],
        ['Avatar', 'Círculo com a inicial do nome do planejador, fundo roxo claro'],
        ['Nome', 'Em negrito; se desativado, exibe badge vermelho "Desativado"'],
        ['E-mail', 'Abaixo do nome, em cinza'],
        ['Data de criação', 'Texto menor "Criado em DD/MM/AAAA"'],
        ['Card inteiro', 'Opacity 50% quando planejador está desativado'],
    ]
    tbl = Table(card_data, colWidths=[3.5*cm, 13.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Botões de Ação por Planejador', H2))
    actions_data = [
        ['Botão', 'Cor', 'Função'],
        ['Acessar', 'Azul (brand)', 'Impersona o planejador — abre modal de confirmação e redireciona para o hub dele'],
        ['Clientes', 'Roxo', 'Abre modal com lista de clientes do planejador + ações por cliente'],
        ['Renomear', 'Cinza', 'Abre modal com campo para novo nome'],
        ['Resetar senha', 'Cinza', 'Envia e-mail de redefinição de senha para o e-mail do planejador'],
        ['Desativar / Ativar', 'Cinza', 'Alterna o status ativo/inativo do planejador instantaneamente'],
        ['Excluir', 'Vermelho', 'Confirma e exclui permanentemente o planejador e todos seus dados'],
    ]
    tbl = Table(actions_data, colWidths=[3*cm, 2.5*cm, 11.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Modal: Novo Planejador', H2))
    story.append(P(
        'Formulário com campos: <b>Nome</b> (texto), <b>E-mail</b> (email), <b>Senha Inicial</b> '
        '(mínimo 6 caracteres). Ao confirmar, o sistema cria o usuário no Supabase Auth '
        'e insere o registro na tabela planejadores via Edge Function admin-cliente.'
    ))

    story.append(Paragraph('Modal: Clientes do Planejador', H2))
    story.append(P(
        'Lista todos os clientes vinculados ao planejador selecionado (leitura direta da tabela '
        '<b>clientes</b> filtrando por planejador_id). Para cada cliente:'
    ))
    clientes_actions = [
        'Acessos: abre o ModalAcessos para gerenciar logins do cliente',
        'Migrar: transfere o cliente para outro planejador (atualiza planejador_id)',
        'Excluir: apaga o cliente e todos seus dados permanentemente',
    ]
    for a in clientes_actions:
        story.append(P(f'• {a}', BULLET))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 7. TELA: HUB DO PLANEJADOR
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('7. Tela: Hub do Planejador (PageHub)', H1))
    story.append(section_divider())

    story.append(P(
        'É a "home" do planejador após o login. Apresenta sua carteira de clientes '
        'e permite criar novos clientes, gerenciar acessos e abrir o dossiê financeiro de cada um.'
    ))

    story.append(Paragraph('Layout da Tela', H2))
    story.append(P(
        '<b>Header:</b> Logo B2IF + "Planejador Financeiro PF" em roxo + botão "+ Novo Cliente" no canto direito.'
    ))
    story.append(P(
        '<b>Cards KPI (3 colunas):</b>'
    ))
    kpi_data = [
        ['KPI', 'Cor', 'Conteúdo'],
        ['Total de Clientes', 'Azul (brand)', 'Contagem total de clientes cadastrados pelo planejador'],
        ['Ativos este mês', 'Verde', 'Clientes com atualizadoEm no mês/ano atual'],
        ['Ano em Curso', 'Azul info', 'Número do ano atual (ex: 2026)'],
    ]
    tbl = Table(kpi_data, colWidths=[4.5*cm, 3*cm, 9.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 0.3*cm))
    story.append(P(
        '<b>Campo de busca:</b> Aparece quando há pelo menos 1 cliente. Filtra em tempo real '
        'pelo nome do cliente (case-insensitive).'
    ))
    story.append(P(
        '<b>Grid de clientes:</b> Cards em grid responsivo (auto-fill, mínimo 300px por coluna).'
    ))

    story.append(Paragraph('Card de Cliente', H2))
    client_card = [
        ['Elemento', 'Descrição'],
        ['Avatar circular', 'Inicial do nome em maiúsculo, fundo roxo claro com borda roxa'],
        ['Nome do cliente', 'Fonte grande, negrito'],
        ['Contador de transações', '"X transações importadas" ou "Sem dados importados ainda"'],
        ['Data de atualização', '"Atualizado em DD/MM/AAAA" em cinza pequeno'],
        ['Botão Acessos', 'Canto superior direito — abre modal de gerenciamento de logins'],
        ['Click no card', 'Abre o dossiê do cliente → redireciona para o Dashboard'],
    ]
    tbl = Table(client_card, colWidths=[4*cm, 13*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Modal: Novo Cliente', H2))
    story.append(P(
        'Formulário simples com campo <b>Nome completo do cliente</b>. Ao confirmar, o sistema '
        'cria um objeto cliente vazio com ID UUID, categorias padrão sincronizadas e salva '
        'imediatamente no Supabase. Em seguida, abre o dashboard do cliente recém-criado.'
    ))

    story.append(Paragraph('Sincronização com Supabase', H2))
    story.append(P(
        'Ao carregar o hub, a aplicação busca todos os clientes do planejador na tabela '
        '<b>clientes</b> (filtro por planejador_id). Os dados de cada cliente ficam armazenados '
        'no campo JSONB <b>dados</b> da tabela. Qualquer alteração é salva com debounce de 1 segundo '
        '(para não sobrecarregar requisições durante edições rápidas). Há também um flush forçado '
        'quando o usuário fecha a aba (evento beforeunload) ou coloca a aba em background '
        '(evento visibilitychange).'
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 8. TELA: DASHBOARD FINANCEIRO
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('8. Tela: Dashboard Financeiro (PageDashboard)', H1))
    story.append(section_divider())

    story.append(P(
        'O Dashboard é a tela analítica principal do sistema. Exibe o panorama financeiro completo '
        'de um cliente — receitas, despesas por categoria, saldo, tendências e comparativos '
        'entre planejado e realizado. É a tela que o cliente vê quando faz login.'
    ))

    story.append(Paragraph('Estrutura Principal', H2))
    story.append(P(
        '<b>Header:</b> Título "Dashboard" + subtítulo dinâmico (nome do cliente + período selecionado) '
        '+ filtro de conta (dropdown "Todas as contas") + botão "Imprimir PDF" (window.print()).'
    ))

    story.append(Paragraph('Barra de Abas Macro', H2))
    story.append(P(
        'No topo da área de conteúdo há 6 abas clicáveis, cada uma com cor própria:'
    ))
    abas_data = [
        ['Aba', 'Cor', 'Conteúdo'],
        ['Visão Geral', 'Azul/brand', 'Panorama anual ou mensal consolidado'],
        ['Receitas', 'Verde', 'Detalhamento de todas as categorias de receita'],
        ['Despesas Fixas', 'Laranja', 'Aluguel, contas, assinaturas, escola, etc.'],
        ['Consumo', 'Amarelo', 'Alimentação, transporte, lazer, saúde, etc.'],
        ['Dívidas', 'Vermelho', 'Financiamentos, dívidas de cartão'],
        ['Investimentos', 'Ciano/verde-azul', 'Aportes e rendimentos de investimentos'],
    ]
    tbl = Table(abas_data, colWidths=[3.5*cm, 3*cm, 10.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('Seletor de Período (só na aba Visão Geral)', H2))
    story.append(P(
        'Abaixo das abas, na Visão Geral, há uma barra de botões de mês:'
    ))
    periodo_items = [
        'Botão "Ano": seleciona todos os meses → exibe visão anual acumulada',
        'Botões Jan–Dez: podem ser selecionados individualmente ou em conjunto (multi-seleção)',
        'Quando 0 meses selecionados → modo Anual',
        'Quando 1 ou mais meses selecionados → modo Mensal/Multi-Mês',
        'Cor dos botões de mês: verde (saldo positivo), vermelho (saldo negativo), cinza (sem dados), azul (selecionado)',
    ]
    for item in periodo_items:
        story.append(P(f'• {item}', BULLET))

    story.append(PageBreak())

    # 8.1 VISTA ANUAL
    story.append(Paragraph('8.1  Visão Geral Anual — Gráficos e Tabelas', H2))
    story.append(thin_divider())

    story.append(Paragraph('KPIs Anuais (5 cards em linha)', H3))
    kpi_anual = [
        ['KPI', 'Valor Exibido', 'Sub-valor', 'Cor'],
        ['Receitas no Ano', 'Total realizado no ano', 'Projetado (em italico)', 'Verde'],
        ['Despesas no Ano', 'Total realizado no ano', 'Projetado', 'Vermelho'],
        ['Saldo Acumulado', 'Receitas - Despesas realizadas', 'Projetado', 'Verde ou vermelho'],
        ['Média Mensal (Saldo)', 'Saldo total / nº meses com dados', 'Nº meses realizados', 'Verde ou vermelho'],
        ['Taxa de Economia', '% saldo / receita', '✅ Meta atingida (≥10%) ou ⚠️ Abaixo de 10%', 'Verde ou amarelo'],
    ]
    tbl = Table(kpi_anual, colWidths=[4.5*cm, 4.5*cm, 4*cm, 4*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('Gráfico 1: Linhas por Grupo Macro (Série Temporal)', H3))
    story.append(P(
        'Gráfico vetorial SVG customizado (sem biblioteca externa). Exibe a evolução ao longo '
        'dos 12 meses com <b>5 séries de linhas</b>:'
    ))
    linhas_data = [
        ['Série', 'Cor', 'Representa'],
        ['Receitas', 'Verde', 'Total de receitas realizadas por mês'],
        ['Despesas Fixas', 'Laranja', 'Total de despesas fixas por mês'],
        ['Consumo', 'Amarelo', 'Total de consumo por mês'],
        ['Dívidas', 'Vermelho', 'Total de dívidas por mês'],
        ['Investimentos', 'Ciano', 'Total de investimentos por mês'],
    ]
    tbl = Table(linhas_data, colWidths=[3.5*cm, 3*cm, 10.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 0.2*cm))
    story.append(P('Características do gráfico de linhas:'))
    linhas_features = [
        'Pontos reais: círculo preenchido — pontos projetados: círculo vazio tracejado',
        'Tooltip ao hover: exibe nome do mês, grupo e valor formatado em R$',
        'Clique em ponto ou área do mês: seleciona o mês e entra no modo Mensal',
        'Eixo Y automático com máximo = maior valor entre todas as séries',
        'Eixo X: meses Jan–Dez com separadores verticais tracejados',
        'Legenda colorida abaixo do gráfico com nome de cada série',
    ]
    for f in linhas_features:
        story.append(P(f'• {f}', BULLET))

    story.append(Paragraph('Gráfico 2: Parcelamentos Futuros Comprometidos', H3))
    story.append(P(
        'Card lateral (320px) ao lado do gráfico de linhas. Exibe um gráfico de barras horizontais '
        'com o valor de parcelas futuras comprometidas por mês (provenientes de compras parceladas '
        'já realizadas mas com parcelas ainda não vencidas). Destaca em cor diferente '
        'os meses com mais comprometimento.'
    ))

    story.append(Paragraph('Gráfico 3: Barras Receita vs Despesa por Mês', H3))
    story.append(P(
        'Gráfico SVG de barras verticais agrupadas (1 barra receita + 1 barra despesa por mês). '
        'Características:'
    ))
    barras_features = [
        'Barra verde = receitas realizadas',
        'Barra vermelha = despesas totais realizadas',
        'Linha pontilhada roxa = despesas projetadas',
        'Linha pontilhada laranja = parcelas futuras comprometidas',
        'Valores no topo de cada barra',
        'Clique em qualquer barra do mês → entra no modo Mensal',
        'Eixo Y com marcações automáticas em R$ mil',
    ]
    for f in barras_features:
        story.append(P(f'• {f}', BULLET))

    story.append(Paragraph('Gráfico 4: Gastos por Conta e Mês (Stacked)', H3))
    story.append(P(
        'Gráfico SVG de barras empilhadas verticais, exibindo a evolução mensal dos gastos '
        'segmentados por conta bancária. Útil para visualizar qual conta mais pesa em cada mês. '
        'Cada conta tem uma cor automática. Inclui legenda e modo projetado/realizado.'
    ))

    story.append(Paragraph('Tabela: Fluxo Mensal Anual', H3))
    story.append(P(
        'Tabela completa Jan→Dez com as seguintes colunas:'
    ))
    tabela_cols = [
        ['Coluna', 'Conteúdo'],
        ['Mês', 'Nome do mês (negrito se tem dados reais, cinza se projetado)'],
        ['Receitas', 'Total de receitas do mês em verde'],
        ['Desp. Fixas', 'Total de despesas fixas + % da receita'],
        ['Consumo', 'Total de consumo + % da receita'],
        ['Dívidas', 'Total de dívidas + % da receita'],
        ['Invest.', 'Total de investimentos + % da receita'],
        ['Saldo', 'Receitas - Despesas + % da receita'],
        ['Status', '✅ (saldo positivo) / 🔴 (negativo) / 📋 (projetado) / — (sem dados)'],
    ]
    tbl = Table(tabela_cols, colWidths=[3*cm, 14*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 0.2*cm))
    story.append(P(
        '<b>Rodapé (TOTAL):</b> Soma de todo o ano. Cada célula exibe o total realizado em negrito '
        'e, quando há projeção, o total realizado+projetado em itálico logo abaixo. '
        'Clique em qualquer linha da tabela → entra no modo Mensal daquele mês.'
    ))

    story.append(PageBreak())

    # 8.2 VISTA MENSAL
    story.append(Paragraph('8.2  Visão Mensal / Multi-Mês', H2))
    story.append(thin_divider())

    story.append(P(
        'Ativada ao selecionar 1 ou mais meses. Modo multi-mês: os valores são somados '
        'dos meses selecionados. Modo single: exibe o mês individual.'
    ))

    story.append(Paragraph('KPIs do Período Selecionado (4 cards)', H3))
    kpi_mensal = [
        ['KPI', 'Conteúdo'],
        ['Receitas no Período', 'Soma das receitas realizadas nos meses selecionados'],
        ['Despesas no Período', 'Soma de todas as despesas nos meses selecionados'],
        ['Saldo Realizado', 'Receitas - Despesas efetivas'],
        ['Taxa de Poupança', '(Saldo / Receitas) × 100 — indica percentual guardado'],
    ]
    tbl = Table(kpi_mensal, colWidths=[5*cm, 12*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('Gráfico: Donut de Composição de Despesas', H3))
    story.append(P(
        'Gráfico SVG circular (donut) exibindo a proporção de cada grupo macro na composição '
        'total das despesas do período. Cada fatia tem a cor do grupo correspondente. '
        'No centro: valor total de despesas. Legenda lateral com nome, valor e percentual.'
    ))

    story.append(Paragraph('Tabela Detalhada por Categoria', H3))
    story.append(P(
        'Tabela expandível organizada por grupo macro. Para cada categoria:'
    ))
    cat_cols = [
        ['Coluna', 'Conteúdo'],
        ['Categoria', 'Nome da categoria'],
        ['Projetado', 'Valor planejado para o período'],
        ['Parcelas', 'Parcelas comprometidas (violeta)'],
        ['Realizado', 'Valor efetivamente registrado (verde/vermelho)'],
        ['Livre', 'Projetado - Parcelas - Realizado (verde se positivo, vermelho se estourado)'],
        ['Progresso', 'Barra de progresso visual (0–100%)'],
    ]
    tbl = Table(cat_cols, colWidths=[3.5*cm, 13.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(PageBreak())

    # 8.3 VISTA MACRO
    story.append(Paragraph('8.3  Abas de Macro-Categorias', H2))
    story.append(thin_divider())

    story.append(P(
        'Ao clicar em uma aba específica (Receitas, Despesas Fixas, Consumo, Dívidas ou Investimentos), '
        'o sistema exibe a visão detalhada daquele grupo no ano inteiro.'
    ))

    story.append(Paragraph('KPIs do Grupo (4 cards)', H3))
    kpi_macro = [
        ['KPI', 'Conteúdo'],
        ['Total Realizado no Ano', 'Soma de todos os meses realizados do grupo'],
        ['Total Projetado no Ano', 'Soma dos valores planejados do grupo'],
        ['Parcelas Comprometidas', 'Total de parcelas futuras do grupo'],
        ['Execução Orçamentária', 'Semáforo 🟢🟡🔴 comparando ritmo de gasto vs. ritmo esperado pelo calendário'],
    ]
    tbl = Table(kpi_macro, colWidths=[5.5*cm, 11.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 0.2*cm))
    story.append(P(
        '<b>Semáforo de Execução:</b> Calcula o percentual de execução real vs. o percentual esperado '
        'pelo calendário (meses passados / 12). Exemplo: se estamos em julho (7/12 = 58% do ano) e '
        'o grupo consumiu 70% do orçamento projetado → ritmo de 120% → acima do esperado → 🔴.'
    ))

    story.append(Paragraph('Gráfico de Colunas por Categoria', H3))
    story.append(P(
        'Gráfico SVG de barras agrupadas: para cada categoria do grupo, exibe barra de '
        'realizado (cor do grupo) e barra de projetado (cinza). Permite comparar visualmente '
        'onde o orçamento está sendo ultrapassado ou subutilizado.'
    ))

    story.append(Paragraph('Tabela Mensal por Categoria', H3))
    story.append(P(
        'Tabela com as categorias nas linhas e os 12 meses nas colunas. '
        'Meses realizados: valor em cor da categoria. Meses projetados: valor em itálico cinza. '
        'Linha de total no rodapé.'
    ))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 9. TELA: FLUXO FINANCEIRO
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('9. Tela: Fluxo Financeiro — Categorizador (PageCategorizador)', H1))
    story.append(section_divider())

    story.append(P(
        'É onde os dados brutos entram no sistema. O planejador importa extratos bancários, '
        'revisa as transações, categoriza-as (manual ou automaticamente) e organiza '
        'as contas do cliente. É a ferramenta mais complexa do sistema.'
    ))

    story.append(Paragraph('Header da Ferramenta', H2))
    story.append(P(
        'Exibe o nome do cliente como título, badge com "X transações · Y% categorizadas" '
        '(verde se 100%, amarelo se parcial). Botões de ação:'
    ))
    header_actions = [
        'Exportar CSV: baixa as transações formatadas (com BOM UTF-8 para compatibilidade com Excel)',
        'Importar: abre o seletor de arquivo (aceita .csv, .xlsx, .xlsm, .pdf)',
    ]
    for a in header_actions:
        story.append(P(f'• {a}', BULLET))

    story.append(Paragraph('Abas Internas', H2))
    story.append(P('A ferramenta tem 3 abas dentro da página:'))
    abas_cat = [
        ['Aba', 'Conteúdo'],
        ['Transações', 'Tabela principal com todas as transações importadas (virtualizada)'],
        ['Contas', 'Gerenciamento das contas bancárias cadastradas do cliente'],
        ['Categorias', 'Gerenciamento das categorias personalizadas do cliente'],
    ]
    tbl = Table(abas_cat, colWidths=[4*cm, 13*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(PageBreak())

    # 9.1 ABA TRANSAÇÕES
    story.append(Paragraph('9.1  Aba: Transações', H2))
    story.append(thin_divider())

    story.append(Paragraph('Cards de Estatísticas Rápidas (4 cards)', H3))
    stats_data = [
        ['Stat', 'Cor', 'Conteúdo'],
        ['Total', 'Azul info', 'Número total de transações (com indicador de filtro ativo)'],
        ['Categorizados', 'Verde', 'Quantas transações já têm categoria'],
        ['Sem categoria', 'Amarelo ou verde', 'Quantas estão pendentes (amarelo > 0, verde = 0)'],
        ['Saldo (filtro atual)', 'Verde ou vermelho', 'Soma receitas - despesas do conjunto filtrado atualmente'],
    ]
    tbl = Table(stats_data, colWidths=[3.5*cm, 3*cm, 10.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Barra de Filtros', H3))
    story.append(P(
        'Linha única com todos os filtros — todos na mesma linha para otimizar espaço. '
        'Os filtros funcionam em <b>cascata</b>: cada filtro aplicado restringe as opções '
        'dos filtros seguintes:'
    ))
    filtros_data = [
        ['Filtro', 'Tipo', 'Opções'],
        ['Competência / Data Compra', 'Toggle buttons', 'Alterna o campo de data usado para filtrar por período'],
        ['Período', 'Dropdown', 'Lista de mês/ano disponíveis nas transações importadas'],
        ['Status', 'Dropdown', 'Todos / Sem categoria / Categorizados'],
        ['Conta', 'Dropdown', 'Lista das contas presentes nos dados filtrados'],
        ['Formato', 'Dropdown', 'Crédito / Débito / PIX / TED etc.'],
        ['Buscar', 'Input texto', 'Busca full-text na descrição da transação'],
        ['Auto-categorizar', 'Botão verde', 'Aplica regras aprendidas a todas as transações sem categoria'],
    ]
    tbl = Table(filtros_data, colWidths=[4.5*cm, 3*cm, 9.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Indicador de Filtros Ativos', H3))
    story.append(P(
        'Se houver qualquer filtro de coluna (ColFilter) ativo, aparece um chip azul '
        '"X filtro(s) de coluna ativo(s) [Limpar]" acima da tabela.'
    ))

    story.append(Paragraph('Tabela de Transações (Virtualizada)', H3))
    story.append(P(
        'A tabela renderiza apenas as linhas visíveis na viewport + buffer (usando useVirtualList). '
        'Isso garante performance com milhares de transações. Colunas:'
    ))
    tabela_trans = [
        ['Coluna', 'Largura', 'Conteúdo'],
        ['Checkbox', '36px', 'Seleção individual; header = selecionar/deselecionar todos'],
        ['Conta', '110px', 'Filtro ColFilter — nome da conta bancária'],
        ['Data', '80px', 'Data da transação (DD/MM/AAAA)'],
        ['Valor', '90px', 'Valor em R$ — verde (receita) / vermelho (despesa)'],
        ['Descrição', 'auto (expande)', 'Texto da transação — truncado com tooltip no hover para descrições longas'],
        ['Formato', '80px', 'ColFilter — Débito, Crédito, PIX, TED, etc.'],
        ['Macro', '120px', 'ColFilter + Dropdown — grupo macro (Receitas, Consumo...)'],
        ['Categoria', '150px', 'ColFilter + Dropdown — categoria específica'],
        ['Parc.', '70px', 'ColFilter numérico — "X/Y" (parcela atual / total) se parcelado'],
        ['Ações', '80px', 'Botões Editar e Excluir (oculto no modo cliente)'],
    ]
    tbl = Table(tabela_trans, colWidths=[3*cm, 2*cm, 12*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 0.2*cm))
    story.append(P(
        '<b>ColFilter</b> (filtro de coluna estilo Excel): ao clicar no cabeçalho da coluna, '
        'abre um dropdown com lista de valores únicos da coluna + caixa de busca interna + '
        'ordenação (A-Z, Z-A ou numérico). Permite marcar/desmarcar valores individualmente '
        'ou "Selecionar todos". Ícone azul no cabeçalho indica filtro ativo.'
    ))

    story.append(Paragraph('Ações na Linha de Transação', H3))
    row_actions = [
        ['Ação', 'Como', 'Efeito'],
        ['Editar', 'Botão ✏️ na coluna Ações', 'Abre modal com campos editáveis: data, valor, descrição, conta, formato, macro, categoria, parcelas'],
        ['Excluir', 'Botão 🗑️ na coluna Ações', 'Remove a transação imediatamente (sem confirmação)'],
        ['Memorizar regra', 'Botão ⚡ (mini) no campo categoria', 'Salva a associação descrição→categoria como regra automática para uso futuro'],
        ['Trocar macro', 'Dropdown na coluna Macro', 'Redefine o grupo macro e limpa a categoria (forçando recategorização)'],
        ['Trocar categoria', 'Dropdown na coluna Categoria', 'Muda a categoria e marca status como "categorizado"'],
    ]
    tbl = Table(row_actions, colWidths=[3*cm, 4*cm, 10*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Barra de Ações em Lote (Multi-Seleção)', H3))
    story.append(P(
        'Aparece logo abaixo da barra de filtros quando há transações selecionadas. Exibe:'
    ))
    lote_items = [
        'Contador "X selecionadas"',
        'Dropdown "Categorizar como..." — aplica a categoria escolhida a todas as selecionadas',
        'Botão "Excluir selecionadas" (vermelho) — remove todas de uma vez',
        'Botão "Limpar seleção" — desmarca todas',
    ]
    for item in lote_items:
        story.append(P(f'• {item}', BULLET))

    story.append(Paragraph('Auto-Categorização', H3))
    story.append(P(
        'O botão "Auto-categorizar" executa o algoritmo de auto-categorização que:'
    ))
    auto_steps = [
        '1. Percorre todas as transações sem categoria',
        '2. Para cada uma, verifica as regras salvas do cliente (campo regras no objeto cliente)',
        '3. Regras de texto: se a descrição contém o termo da regra → aplica a categoria',
        '4. Regras padrão (REGRAS_PADRAO): mapeamentos pré-definidos como "netflix" → "assinaturas"',
        '5. Se não há regra → transação continua sem categoria',
    ]
    for step in auto_steps:
        story.append(P(step, BULLET))

    story.append(PageBreak())

    # 9.2 ABA CONTAS
    story.append(Paragraph('9.2  Aba: Contas', H2))
    story.append(thin_divider())

    story.append(P(
        'Gerencia as contas bancárias/cartões do cliente. Cada conta tem nome, tipo e cor '
        '(para identificação visual nos gráficos).'
    ))
    contas_ops = [
        ['Operação', 'Descrição'],
        ['Adicionar conta', 'Nome livre + tipo (Corrente, Poupança, Cartão de Crédito, Investimento) + cor customizável'],
        ['Editar conta', 'Altera nome, tipo ou cor inline'],
        ['Excluir conta', 'Remove a conta; transações vinculadas perdem a referência de conta'],
        ['Visualização', 'Lista de cards com nome, tipo e cor da conta'],
    ]
    tbl = Table(contas_ops, colWidths=[4*cm, 13*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('9.3  Aba: Categorias', H2))
    story.append(thin_divider())

    story.append(P(
        'Gerencia as categorias personalizadas do cliente. O sistema inicializa cada cliente '
        'com as categorias padrão (CATEGORIAS_PADRAO), mas o planejador pode adicionar, '
        'renomear ou excluir categorias.'
    ))
    cats_ops = [
        ['Operação', 'Descrição'],
        ['Nova categoria', 'Nome + grupo macro (Receitas, Fixas, Consumo, Dívidas, Investimentos) + tipo (receita/despesa)'],
        ['Renomear', 'Click inline no nome → edição direta'],
        ['Excluir', 'Remove a categoria; transações vinculadas ficam sem categoria'],
        ['Visualização', 'Lista agrupada por macro com cores distintivas'],
    ]
    tbl = Table(cats_ops, colWidths=[4*cm, 13*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 10. TELA: PLANEJADOR
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('10. Tela: Planejador Financeiro (PagePlanejador)', H1))
    story.append(section_divider())

    story.append(P(
        'Ferramenta de planejamento e orçamento mensal. Permite definir quanto se espera '
        'gastar/receber em cada categoria no mês selecionado, e acompanhar em tempo real '
        'quanto já foi realizado versus o planejado.'
    ))

    story.append(Paragraph('Seletor de Mês', H2))
    story.append(P(
        'Linha com 12 botões (Jan–Dez). O mês selecionado fica em azul. '
        'Padrão: mês atual do sistema.'
    ))

    story.append(Paragraph('KPIs do Mês Selecionado (4 cards)', H2))
    kpi_plan = [
        ['KPI', 'Conteúdo'],
        ['Receitas Projetadas', 'Soma dos valores planejados em categorias de receita'],
        ['Despesas Projetadas', 'Soma dos valores planejados em categorias de despesa'],
        ['Saldo Projetado', 'Receitas proj. - Despesas proj. (verde/vermelho)'],
        ['Saldo Realizado', 'Receitas reais - Despesas reais do mês (verde/vermelho)'],
    ]
    tbl = Table(kpi_plan, colWidths=[5*cm, 12*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Botões de Ação', H2))
    plan_buttons = [
        ['Botão', 'Quando aparece', 'Ação'],
        ['Iniciar Projeção', 'Sempre (modo edição)', 'Abre modal com 2 opções: preencher com médias históricas ou valores zerados'],
        ['Salvar Projeção', 'Quando mês tem projeção (modo edição)', 'Abre modal perguntando se quer replicar para todos os meses restantes até Dezembro'],
    ]
    tbl = Table(plan_buttons, colWidths=[3.5*cm, 4*cm, 9.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Tabela de Planejamento por Grupo', H2))
    story.append(P(
        'Se o mês não tem projeção → exibe card vazio com botão "Iniciar Projeção". '
        'Se tem projeção → exibe uma tabela por grupo macro. '
        'Cada grupo tem um header colorido com o nome, totais e botão "Limpar". '
        'Dentro, as linhas de categoria:'
    ))
    plan_cols = [
        ['Coluna', 'Conteúdo'],
        ['Categoria', 'Nome da categoria'],
        ['Projetado', 'Input numérico editável (ou valor somente leitura no modo cliente)'],
        ['Parcelas', 'Valor comprometido em parcelas futuras (em violeta)'],
        ['Realizado', 'Valor já registrado nas transações (verde para receita, vermelho para despesa)'],
        ['Livre', 'Projetado - Parcelas - Realizado (verde se positivo = tem margem, vermelho se estourado)'],
        ['Progresso', 'Barra de progresso 0–100%+ com cor variando conforme % de execução'],
    ]
    tbl = Table(plan_cols, colWidths=[3.5*cm, 13.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 0.2*cm))
    story.append(P(
        '<b>Médias Históricas:</b> Calculadas automaticamente com base em todos os meses realizados '
        'exceto o ano ativo (para não contaminar a projeção com dados do próprio período). '
        'São usadas para inicializar a projeção com valores mais realistas.'
    ))
    story.append(P(
        '<b>Replicar até Dezembro:</b> Copia os valores projetados do mês atual para todos os meses '
        'seguintes (mesAtivo+1 até mês 11), preservando as parcelas futuras de cada mês destino.'
    ))
    story.append(P(
        '<b>Limpar grupo:</b> Zera todos os valores projetados de um grupo no mês ativo, '
        'com confirmação inline (dois botões Confirmar/Cancelar aparecem no lugar do botão Limpar).'
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 11. MODAL: GERENCIAR ACESSOS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('11. Modal: Gerenciar Acessos do Cliente (ModalAcessos)', H1))
    story.append(section_divider())

    story.append(P(
        'Modal acessível via botão "Acessos" no card de cliente no Hub ou no modal de '
        'clientes do Manager. Permite que o planejador crie, gerencie e remova logins '
        'de acesso ao dashboard para os clientes.'
    ))

    story.append(Paragraph('Funcionalidades', H2))
    acessos_ops = [
        ['Operação', 'Descrição'],
        ['Listar acessos', 'Exibe todos os logins criados para o cliente com nome e e-mail'],
        ['Criar novo acesso', 'Formulário: Nome, E-mail, Senha (mín. 6 chars) — cria usuário no Supabase Auth via Edge Function'],
        ['Resetar senha', 'Campo nova senha + confirmação — atualiza a senha do acesso selecionado'],
        ['Excluir acesso', 'Modal de confirmação → remove o usuário do Supabase Auth e da tabela cliente_acessos'],
    ]
    tbl = Table(acessos_ops, colWidths=[4*cm, 13*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 0.3*cm))
    story.append(P(
        'Todas as operações de acesso (criar, resetar senha, excluir) são realizadas via '
        '<b>Edge Function</b> (admin-cliente) hospedada no Supabase, pois requerem '
        'permissões de administrador do Auth que não devem ser expostas no frontend.'
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 12. BANCO DE DADOS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('12. Banco de Dados (Supabase / PostgreSQL)', H1))
    story.append(section_divider())

    story.append(Paragraph('Diagrama de Tabelas', H2))
    story.append(P(
        'O banco tem 3 tabelas principais além das tabelas internas do Supabase Auth (auth.users):'
    ))

    # Tabela planejadores
    story.append(Paragraph('Tabela: planejadores', H3))
    plan_tbl = [
        ['Campo', 'Tipo', 'Descrição'],
        ['id', 'UUID (PK)', 'Referência ao auth.users.id — mesmo ID do usuário de autenticação'],
        ['nome', 'TEXT NOT NULL', 'Nome do planejador'],
        ['email', 'TEXT NOT NULL UNIQUE', 'E-mail de login'],
        ['role', 'TEXT', '"planejador" ou "manager"'],
        ['ativo', 'BOOLEAN DEFAULT true', 'Se false, não pode fazer login'],
        ['criado_em', 'TIMESTAMPTZ', 'Data de criação automática'],
    ]
    tbl = Table(plan_tbl, colWidths=[3.5*cm, 4.5*cm, 9*cm])
    tbl.setStyle(tbl_style(PDF_PURPLE))
    story.append(tbl)

    # Tabela clientes
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('Tabela: clientes', H3))
    cli_tbl = [
        ['Campo', 'Tipo', 'Descrição'],
        ['id', 'UUID (PK)', 'Identificador único do cliente'],
        ['planejador_id', 'UUID (FK)', 'Referência ao planejadores.id — dono do cliente'],
        ['nome', 'TEXT NOT NULL', 'Nome completo do cliente'],
        ['dados', 'JSONB', 'Objeto JSON com TODOS os dados financeiros do cliente (ver abaixo)'],
        ['criado_em', 'TIMESTAMPTZ', 'Data de criação'],
        ['atualizado_em', 'TIMESTAMPTZ', 'Última atualização (trigger automático no Supabase)'],
    ]
    tbl = Table(cli_tbl, colWidths=[3.5*cm, 4.5*cm, 9*cm])
    tbl.setStyle(tbl_style(PDF_GREEN))
    story.append(tbl)

    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph('Estrutura do campo dados (JSONB)', H3))
    story.append(P(
        'O campo <b>dados</b> é um objeto JSON que armazena todo o histórico financeiro do cliente. '
        'Estrutura:'
    ))
    dados_struct = [
        ['Campo JSON', 'Tipo JS', 'Descrição'],
        ['transacoes', 'Array', 'Lista de todas as transações importadas (ver estrutura abaixo)'],
        ['categorias', 'Array', 'Lista de categorias personalizadas do cliente'],
        ['planejamento', 'Object', 'Chaves = ano (ex: "2026") → objeto com planejamento mensal por categoria'],
        ['contas', 'Array', 'Lista de contas bancárias do cliente'],
        ['regras', 'Array', 'Regras de auto-categorização aprendidas'],
        ['anoAtivo', 'Number', 'Ano selecionado no sistema (ex: 2026)'],
    ]
    tbl = Table(dados_struct, colWidths=[3.5*cm, 3*cm, 10.5*cm])
    tbl.setStyle(tbl_style(colors.HexColor('#475569')))
    story.append(tbl)

    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph('Estrutura de uma Transação', H3))
    trans_struct = [
        ['Campo', 'Tipo', 'Exemplo'],
        ['id', 'String UUID', '"abc123-..."'],
        ['data', 'String YYYY-MM-DD', '"2026-03-15"'],
        ['competencia', 'String YYYY-MM', '"2026-03" (mês de referência)'],
        ['valor', 'Number', '250.00'],
        ['tipo', 'String', '"despesa" ou "receita"'],
        ['descricao', 'String', '"SUPERMERCADO EXTRA"'],
        ['categoria', 'String ou null', '"alimentacao" (ID da categoria)'],
        ['status', 'String', '"categorizado" ou "pendente"'],
        ['conta', 'String', '"Nubank Crédito"'],
        ['formato', 'String', '"Crédito", "Débito", "PIX", "TED"'],
        ['parcelaAtual', 'Number ou null', '1 (primeira parcela de N)'],
        ['parcelaTotal', 'Number ou null', '12 (compra em 12x)'],
        ['subcategoria', 'String', 'Subcategoria livre (campo opcional)'],
    ]
    tbl = Table(trans_struct, colWidths=[3.5*cm, 3.5*cm, 10*cm])
    tbl.setStyle(tbl_style(colors.HexColor('#475569')))
    story.append(tbl)

    # Tabela cliente_acessos
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('Tabela: cliente_acessos', H3))
    acessos_tbl = [
        ['Campo', 'Tipo', 'Descrição'],
        ['id', 'UUID (PK)', 'Identificador do acesso'],
        ['cliente_id', 'UUID (FK)', 'Referência ao clientes.id'],
        ['user_id', 'UUID (FK)', 'Referência ao auth.users.id — o login do cliente'],
        ['nome', 'TEXT', 'Nome de exibição do acesso (pessoa que usa esse login)'],
        ['criado_em', 'TIMESTAMPTZ', 'Data de criação do acesso'],
    ]
    tbl = Table(acessos_tbl, colWidths=[3.5*cm, 4.5*cm, 9*cm])
    tbl.setStyle(tbl_style(PDF_ORANGE))
    story.append(tbl)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 13. SEGURANÇA E RLS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('13. Segurança e Permissões (RLS)', H1))
    story.append(section_divider())

    story.append(P(
        'O Supabase utiliza <b>Row Level Security (RLS)</b> do PostgreSQL para garantir que '
        'cada usuário acesse apenas os dados que lhe pertencem, mesmo que alguém tente '
        'manipular as queries no frontend.'
    ))

    story.append(Paragraph('Políticas RLS por Tabela', H2))
    rls_data = [
        ['Tabela', 'Política', 'Regra'],
        ['planejadores', 'SELECT', 'Planejador só vê seu próprio registro; Manager vê todos'],
        ['planejadores', 'INSERT/UPDATE/DELETE', 'Apenas via Edge Function (service_role key)'],
        ['clientes', 'SELECT', 'Planejador vê clientes onde planejador_id = auth.uid()'],
        ['clientes', 'INSERT', 'Planejador só insere com planejador_id = auth.uid()'],
        ['clientes', 'UPDATE/DELETE', 'Planejador só altera seus próprios clientes'],
        ['clientes', 'SELECT (cliente)', 'Cliente vê apenas o registro onde id = seu cliente_id'],
        ['cliente_acessos', 'SELECT', 'Planejador vê acessos dos seus clientes; cliente vê o próprio'],
        ['cliente_acessos', 'INSERT/UPDATE/DELETE', 'Apenas via Edge Function (service_role key)'],
    ]
    tbl = Table(rls_data, colWidths=[3.5*cm, 3.5*cm, 10*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Edge Function: admin-cliente', H2))
    story.append(P(
        'Operações administrativas que requerem service_role (permissão de admin do Auth) '
        'são realizadas exclusivamente via Edge Function hospedada no Supabase. '
        'A função recebe a action (criar usuário, listar acessos, resetar senha, excluir) '
        'e executa com o service_role key que nunca é exposto ao browser.'
    ))
    story.append(P(
        '<b>Ações suportadas pela Edge Function:</b>'
    ))
    edge_actions = [
        'criar_planejador: Cria usuário no Auth + insere na tabela planejadores',
        'renomear_planejador: Atualiza o campo nome',
        'toggle_ativo: Alterna o campo ativo',
        'excluir_planejador: Remove o usuário do Auth + exclui da tabela',
        'criar_acesso_cliente: Cria usuário no Auth + insere em cliente_acessos',
        'listar_acessos: Busca todos os acessos de um cliente',
        'resetar_senha_cliente: Atualiza a senha do usuário no Auth',
        'excluir_acesso: Remove o usuário do Auth + da tabela cliente_acessos',
    ]
    for a in edge_actions:
        story.append(P(f'• {a}', BULLET))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 14. REGRAS DE NEGÓCIO
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('14. Regras de Negócio', H1))
    story.append(section_divider())

    story.append(Paragraph('Parcelamentos', H2))
    story.append(P(
        'O sistema identifica transações parceladas (campo parcelaAtual/parcelaTotal) e '
        'calcula automaticamente as <b>parcelas futuras comprometidas</b>:'
    ))
    parcelas_rules = [
        'Uma transação parcelada com compra em Jan/2026 1/12 gera projeções de parcelas para Fev–Dez/2026',
        'As parcelas futuras aparecem em cor violeta nas tabelas do Planejador e Dashboard',
        'O valor comprometido é deduzido do "Livre" de cada categoria no mês correspondente',
        'Parcelas além de dezembro do ano ativo são desconsideradas (não aparecem)',
        'A lógica usa o campo competencia (não data de compra) para posicionar cada parcela no mês correto',
    ]
    for r in parcelas_rules:
        story.append(P(f'• {r}', BULLET))

    story.append(Paragraph('Auto-Categorização por Regras', H2))
    story.append(P(
        'O sistema aprende com o planejador. Ao clicar no botão ⚡ (memorizar) após '
        'categorizar uma transação, salva uma regra no objeto do cliente:'
    ))
    story.append(P(
        '<b>Regra de texto:</b> { termo: "SUPERMERCADO EXTRA", catId: "alimentacao" } — '
        'qualquer transação com esse trecho na descrição é categorizada automaticamente.'
    ))
    story.append(P(
        '<b>Regras padrão (REGRAS_PADRAO):</b> Mapeamentos pré-definidos para nomes comuns '
        'como "netflix" → "assinaturas", "uber" → "transporte", "farmacia" → "drogaria".'
    ))
    story.append(P(
        '<b>Prioridade:</b> Regras do cliente > Regras padrão. Regras do cliente podem sobrescrever '
        'os mapeamentos padrão para customizar conforme os hábitos de cada cliente.'
    ))

    story.append(Paragraph('Filtros em Cascata', H2))
    story.append(P(
        'Os filtros da aba Transações funcionam em cascata (waterfall filtering):'
    ))
    cascata_steps = [
        'Filtro de tempo (Competência ou Data Compra) → define o campo de data usado',
        'Filtro de período (mês/ano) → restringe as transações ao período',
        'Filtro de status (todos/sem cat./categorizados) → restringe por categorização',
        'Filtro de conta → mostra só contas que existem no conjunto já filtrado',
        'Filtro de formato → mostra só formatos existentes no conjunto já filtrado',
        'Filtros ColFilter (Conta, Formato, Macro, Categoria, Parc.) → filtros visuais de coluna',
        'Busca por texto → filtra por substring na descrição',
    ]
    for step in cascata_steps:
        story.append(P(f'• {step}', BULLET))

    story.append(Paragraph('Sincronização de Categorias', H2))
    story.append(P(
        'Ao abrir um cliente, o sistema executa <b>sincronizarCategorias()</b> que:'
    ))
    sync_rules = [
        'Verifica se o cliente tem todas as categorias padrão cadastradas',
        'Adiciona categorias que foram incluídas nas CATEGORIAS_PADRAO após a criação do cliente',
        'Mantém categorias personalizadas do cliente intactas',
        'Preserva customizações de nome feitas pelo planejador',
    ]
    for r in sync_rules:
        story.append(P(f'• {r}', BULLET))

    story.append(Paragraph('Saldo e Cálculo do Fluxo', H2))
    story.append(P(
        'O sistema separa cada transação como <b>receita</b> ou <b>despesa</b> com base no campo tipo. '
        'Os cálculos do dashboard somam:'
    ))
    calculo_rules = [
        'Realizado = transações importadas com data no período selecionado',
        'Projetado = valores inseridos manualmente no Planejador para o mês',
        'Saldo = Receitas realizadas - Todas as despesas realizadas',
        'Taxa de Economia = Saldo / Receitas × 100',
        'Parcelas futuras = calculadas separadamente e adicionadas como comprometimento',
    ]
    for r in calculo_rules:
        story.append(P(f'• {r}', BULLET))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 15. CATEGORIAS E GRUPOS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('15. Categorias e Grupos Financeiros', H1))
    story.append(section_divider())

    story.append(Paragraph('Grupos Macro (GRUPOS)', H2))
    grupos_data = [
        ['Grupo', 'Cor', 'Descrição'],
        ['Receitas', 'Verde', 'Todas as entradas financeiras: salário, freelance, aluguel recebido, rendimentos...'],
        ['Despesas Fixas', 'Laranja', 'Gastos recorrentes previsíveis: moradia, aluguel, contas, celular, escola...'],
        ['Consumo Mensal', 'Amarelo', 'Gastos variáveis do dia a dia: alimentação, transporte, saúde, lazer...'],
        ['Dívidas', 'Vermelho', 'Financiamentos e dívidas: financiamento de cartão...'],
        ['Investimentos', 'Ciano/Verde-azul', 'Aportes e movimentações de investimento'],
        ['Fluxo Interno', 'Cinza', 'Transferências internas (neutraliza impacto no saldo)'],
    ]
    tbl = Table(grupos_data, colWidths=[3.5*cm, 3*cm, 10.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Categorias Padrão por Grupo', H2))

    story.append(Paragraph('Receitas', H3))
    rec_cats = [
        ['ID', 'Nome', 'Tipo'],
        ['salario', 'Salário', 'receita'],
        ['freelance', 'Freelance / Renda Extra', 'receita'],
        ['aluguel_rec', 'Aluguel Recebido', 'receita'],
        ['rendimentos', 'Rendimentos', 'receita'],
        ['reembolso', 'Reembolso', 'receita'],
        ['outros_rec', 'Outros Recebimentos', 'receita'],
    ]
    tbl = Table(rec_cats, colWidths=[4*cm, 6*cm, 7*cm])
    tbl.setStyle(tbl_style(PDF_GREEN))
    story.append(tbl)

    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph('Despesas Fixas', H3))
    fix_cats = [
        ['ID', 'Nome', 'Tipo'],
        ['moradia', 'Moradia (Casa / Moradia)', 'despesa'],
        ['aluguel', 'Aluguel', 'despesa'],
        ['contas', 'Contas de Casa', 'despesa'],
        ['celular', 'Celular', 'despesa'],
        ['assinaturas', 'Assinaturas', 'despesa'],
        ['escola', 'Escola / Faculdade', 'despesa'],
        ['plano_saude', 'Plano de Saúde', 'despesa'],
        ['academia', 'Academia', 'despesa'],
        ['impostos', 'Impostos / Taxas', 'despesa'],
        ['custos_imoveis', 'Custos de Imóveis', 'despesa'],
        ['outras_fixas', 'Outras Fixas', 'despesa'],
        ['trabalho', 'Custos de Trabalho', 'despesa'],
    ]
    tbl = Table(fix_cats, colWidths=[4*cm, 6*cm, 7*cm])
    tbl.setStyle(tbl_style(PDF_ORANGE))
    story.append(tbl)

    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph('Consumo Mensal', H3))
    cons_cats = [
        ['ID', 'Nome', 'Tipo'],
        ['alimentacao_fora', 'Alimentação Fora', 'despesa'],
        ['alimentacao', 'Alimentação (Mercado)', 'despesa'],
        ['padaria', 'Padaria', 'despesa'],
        ['transporte', 'Transporte', 'despesa'],
        ['gasolina', 'Gasolina', 'despesa'],
        ['carro', 'Carro', 'despesa'],
        ['saude', 'Saúde', 'despesa'],
        ['drogaria', 'Drogaria', 'despesa'],
        ['beleza', 'Beleza', 'despesa'],
        ['vestuario', 'Vestuário', 'despesa'],
        ['lazer', 'Lazer', 'despesa'],
        ['viagem', 'Viagem', 'despesa'],
        ['papelaria', 'Papelaria', 'despesa'],
        ['decoracao', 'Decoração', 'despesa'],
        ['compras_online', 'Compras Online', 'despesa'],
        ['compras', 'Compras Gerais', 'despesa'],
        ['outros', 'Outros', 'despesa'],
        ['pets', 'Pets', 'despesa'],
        ['presente', 'Presente', 'despesa'],
        ['doacoes', 'Doações', 'despesa'],
        ['esporte', 'Esporte', 'despesa'],
        ['livro_curso', 'Livros / Cursos', 'despesa'],
        ['reforma', 'Reforma', 'despesa'],
    ]
    tbl = Table(cons_cats, colWidths=[4*cm, 6*cm, 7*cm])
    tbl.setStyle(tbl_style(colors.HexColor('#B45309')))
    story.append(tbl)

    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph('Dívidas', H3))
    div_cats = [
        ['ID', 'Nome', 'Tipo'],
        ['fin_cartao', 'Financiamento Cartão', 'despesa'],
    ]
    tbl = Table(div_cats, colWidths=[4*cm, 6*cm, 7*cm])
    tbl.setStyle(tbl_style(PDF_RED))
    story.append(tbl)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 16. IMPORTAÇÃO DE ARQUIVOS
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('16. Importação de Arquivos', H1))
    story.append(section_divider())

    story.append(P(
        'O sistema aceita 3 formatos de extrato bancário. A importação é feita pelo botão '
        '"Importar" na tela do Categorizador. Múltiplos arquivos podem ser importados '
        'simultaneamente — as transações são mescladas sem duplicatas (baseado em hash).'
    ))

    story.append(Paragraph('Formatos Suportados', H2))
    import_data = [
        ['Formato', 'Extensão', 'Parser', 'Observações'],
        ['CSV Genérico', '.csv', 'PapaParse', 'Detecta automaticamente o separador (vírgula ou ponto-e-vírgula). Espera colunas: data, descrição, valor, tipo'],
        ['Excel/XLSM', '.xlsx, .xlsm', 'SheetJS', 'Usa a planilha mapeada internamente. Suporta mapeamento de nomes de macro e categoria via MACRO_MAP e CAT_MAP'],
        ['PDF Bancário', '.pdf', 'PDF.js', 'Extrai texto linha por linha, identifica padrões de data/valor/descrição. Suporta diferentes layouts de extrato'],
    ]
    tbl = Table(import_data, colWidths=[2.5*cm, 2.5*cm, 2.5*cm, 9.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Paragraph('Processo de Importação', H2))
    import_steps = [
        '1. Usuário clica em "Importar" e seleciona o(s) arquivo(s)',
        '2. Cada arquivo é parseado conforme sua extensão (CSV → PapaParse, XLSM → SheetJS, PDF → PDF.js)',
        '3. As transações parseadas são normalizadas (campos obrigatórios, formatação de data, conversão de valor)',
        '4. Aplicado filtro de duplicatas: transações com o mesmo hash (data+valor+descrição+conta) são ignoradas',
        '5. As novas transações são mescladas com as existentes',
        '6. A auto-categorização é disparada automaticamente nas transações novas sem categoria',
        '7. O cliente é salvo no Supabase (debounce 1s)',
    ]
    for step in import_steps:
        story.append(P(step, BULLET))

    story.append(Paragraph('Mapeamento de Categorias (XLSM)', H2))
    story.append(P(
        'Para importação de planilhas XLSM geradas pela B2, o sistema usa dois mapas:'
    ))
    story.append(P(
        '<b>MACRO_MAP:</b> Traduz nomes de grupo da planilha para IDs internos. '
        'Ex: "consumo mensal", "consumo" → "Consumo Mensal"'
    ))
    story.append(P(
        '<b>CAT_MAP:</b> Traduz nomes de categoria da planilha para IDs internos. '
        'Ex: "salário", "salario" → "salario"; '
        '"freelance / renda extra", "freelance/renda extra" → "freelance"'
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 17. MODO CLIENTE
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('17. Modo Cliente (Leitura)', H1))
    story.append(section_divider())

    story.append(P(
        'Quando um usuário do tipo <b>cliente</b> faz login, ele acessa diretamente o Dashboard '
        'do seu próprio dossiê financeiro, em modo somente leitura. '
        'O sistema checa o role no login e, se for cliente, não mostra o hub — '
        'vai direto para as telas financeiras.'
    ))

    story.append(Paragraph('O que o cliente PODE ver', H2))
    pode_ver = [
        'Dashboard completo: todos os gráficos, KPIs, tabelas anuais e mensais',
        'Fluxo Financeiro (Categorizador): tabela de transações, abas Contas e Categorias',
        'Planejador: visualização dos valores planejados e realizados',
        'Tooltip de descrição: ao passar o mouse sobre uma descrição truncada, exibe o texto completo',
    ]
    for item in pode_ver:
        story.append(P(f'✓  {item}', BULLET))

    story.append(Paragraph('O que o cliente NÃO pode fazer', H2))
    nao_pode = [
        'Importar ou exportar arquivos',
        'Editar ou excluir transações',
        'Criar, editar ou excluir categorias',
        'Editar valores no Planejador (campos são somente leitura)',
        'Iniciar projeção ou salvar projeção',
        'Criar/editar contas bancárias',
        'Aplicar auto-categorização',
        'Usar multi-seleção ou ações em lote',
    ]
    for item in nao_pode:
        story.append(P(f'✗  {item}', BULLET))

    story.append(Paragraph('Implementação do Modo Leitura', H2))
    story.append(P(
        'O AppContext recebe a prop <b>modoClienteFixo=true</b> quando o usuário é um cliente. '
        'Isso define <b>modoLeitura=true</b> em todo o contexto. Cada componente verifica '
        'o valor de modoLeitura antes de renderizar botões de edição ou campos editáveis. '
        'A sincronização com Supabase é bloqueada (nenhuma escrita ocorre).'
    ))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 18. FLUXOS DE USO POR PERFIL
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('18. Fluxos de Uso por Perfil', H1))
    story.append(section_divider())

    story.append(Paragraph('Fluxo do Manager', H2))
    manager_flow = [
        ('Login', 'Acessa o sistema com seu e-mail/senha'),
        ('Painel Manager', 'Visualiza lista de todos os planejadores'),
        ('Criar planejador', 'Clica "+ Novo Planejador", preenche nome/e-mail/senha inicial e confirma'),
        ('Gerenciar planejador', 'Renomeia, reseta senha, ativa/desativa ou exclui um planejador'),
        ('Ver clientes', 'Clica "Clientes" em um planejador → vê lista de clientes com opções'),
        ('Migrar cliente', 'Seleciona "Migrar" em um cliente → escolhe o planejador destino → confirma'),
        ('Impersonar', 'Clica "Acessar" em um planejador → confirma → vê o hub desse planejador'),
        ('Gerenciar acesso', 'Clica "Acessos" num cliente → cria/exclui login de cliente'),
    ]
    for i, (passo, desc) in enumerate(manager_flow, 1):
        story.append(P(f'<b>{i}. {passo}:</b> {desc}'))

    story.append(Paragraph('Fluxo do Planejador', H2))
    planejador_flow = [
        ('Login', 'Acessa com e-mail/senha → vai direto para o Hub'),
        ('Hub', 'Vê sua lista de clientes com KPIs e pode criar novo cliente'),
        ('Abrir cliente', 'Clica no card → vai para o Dashboard do cliente'),
        ('Importar dados', 'Vai para Fluxo Financeiro → clica Importar → seleciona arquivo CSV/XLSM/PDF'),
        ('Categorizar', 'Na tabela de transações, usa dropdowns de Macro/Categoria + botão Memorizar'),
        ('Auto-categorizar', 'Clica Auto-categorizar para aplicar regras em lote'),
        ('Planejar', 'Vai para Planejador → seleciona mês → clica Iniciar Projeção → preenche valores'),
        ('Analisar', 'Volta ao Dashboard → navega abas Visão Geral, Receitas, Consumo, etc.'),
        ('Criar acesso', 'No Hub, clica Acessos no card de um cliente → cria login para o cliente'),
    ]
    for i, (passo, desc) in enumerate(planejador_flow, 1):
        story.append(P(f'<b>{i}. {passo}:</b> {desc}'))

    story.append(Paragraph('Fluxo do Cliente', H2))
    cliente_flow = [
        ('Login', 'Acessa com e-mail/senha criado pelo planejador → vai direto para o Dashboard'),
        ('Dashboard', 'Vê o panorama financeiro anual: KPIs, gráficos de linhas, barras, tabela de meses'),
        ('Navegar abas', 'Clica em Receitas, Consumo, etc. para ver detalhes por grupo'),
        ('Selecionar mês', 'Clica em um ou mais meses na barra de período → vê detalhes mensais'),
        ('Ver transações', 'Vai para Fluxo Financeiro → visualiza transações com filtros (somente leitura)'),
        ('Ver planejamento', 'Vai para Planejador → vê valores projetados vs realizados (somente leitura)'),
        ('Imprimir', 'Clica "Imprimir PDF" para exportar o dashboard atual como PDF'),
    ]
    for i, (passo, desc) in enumerate(cliente_flow, 1):
        story.append(P(f'<b>{i}. {passo}:</b> {desc}'))
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════════════
    # 19. GLOSSÁRIO
    # ══════════════════════════════════════════════════════════════════════════
    story.append(Paragraph('19. Glossário', H1))
    story.append(section_divider())

    glossario = [
        ['Termo', 'Definição'],
        ['B2IF', 'B2 Inteligência Financeira — empresa proprietária do sistema'],
        ['PF', 'Pessoa Física — segmento de clientes atendidos pelo sistema'],
        ['MVP', 'Minimum Viable Product — versão mínima funcional do produto'],
        ['SPA', 'Single Page Application — aplicação de página única sem recarregamento'],
        ['BaaS', 'Backend as a Service — Supabase provê backend completo sem servidor próprio'],
        ['RLS', 'Row Level Security — política de segurança a nível de linha no PostgreSQL'],
        ['JWT', 'JSON Web Token — token de autenticação usado pelo Supabase Auth'],
        ['JSONB', 'Tipo de dado JSON binário do PostgreSQL, permite indexação e queries eficientes'],
        ['Edge Function', 'Função serverless executada na borda da rede, usada para operações admin'],
        ['Impersonação', 'Recurso que permite ao Manager acessar o sistema "como" um planejador'],
        ['Macro-categoria', 'Agrupamento de categorias: Receitas, Fixas, Consumo, Dívidas, Investimentos'],
        ['Competência', 'Mês/ano de referência contábil de uma transação (pode diferir da data de compra)'],
        ['Parcelas futuras', 'Parcelas de compras parceladas ainda não vencidas, usadas como comprometimento'],
        ['Projetado', 'Valor planejado/orçado para o período, inserido manualmente no Planejador'],
        ['Realizado', 'Valor efetivamente ocorrido, proveniente das transações importadas'],
        ['Hub', 'Tela principal do planejador com a lista de todos os seus clientes'],
        ['Virtualização', 'Técnica de renderizar só os itens visíveis de uma lista longa (useVirtualList)'],
        ['Debounce', 'Atraso intencional antes de executar uma ação repetida, para reduzir requisições'],
        ['Flush', 'Salvamento forçado imediato de dados antes de um evento de saída da página'],
        ['ColFilter', 'Componente de filtro de coluna estilo Excel com dropdown, busca e ordenação'],
        ['Auto-categorização', 'Processo automático de atribuir categorias a transações com base em regras'],
        ['Cascata (filtros)', 'Cada filtro aplicado restringe as opções dos filtros subsequentes'],
        ['Taxa de Economia', 'Percentual do saldo em relação à receita total — mede capacidade de poupar'],
        ['Semáforo de execução', 'Indicador 🟢🟡🔴 que compara o ritmo de gastos real vs. esperado pelo calendário'],
        ['Sync/Sincronização', 'Processo de salvar dados do cliente no Supabase em segundo plano'],
    ]
    tbl = Table(glossario, colWidths=[4.5*cm, 12.5*cm])
    tbl.setStyle(tbl_style())
    story.append(tbl)

    story.append(Spacer(1, 1*cm))
    story.append(section_divider(PDF_HEADER))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        f'Documentação gerada automaticamente em {datetime.date.today().strftime("%d/%m/%Y")} · '
        'B2IF PF — Planejador Financeiro Pessoal · B2 Inteligência Financeira',
        S('Normal', fontSize=9, textColor=PDF_MUTED, fontName='Helvetica', alignment=TA_CENTER)
    ))

    return story


# ══════════════════════════════════════════════════════════════════════════════
# GERAÇÃO DO PDF
# ══════════════════════════════════════════════════════════════════════════════

def on_first_page(canvas, doc):
    canvas.saveState()
    # Fundo da capa
    canvas.setFillColor(colors.HexColor('#F5F3FF'))
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Barra superior
    canvas.setFillColor(PDF_HEADER)
    canvas.rect(0, PAGE_H - 8*mm, PAGE_W, 8*mm, fill=1, stroke=0)
    # Barra inferior
    canvas.rect(0, 0, PAGE_W, 6*mm, fill=1, stroke=0)
    canvas.restoreState()

def on_later_pages(canvas, doc):
    canvas.saveState()
    # Cabeçalho
    canvas.setFillColor(colors.HexColor('#F8F7FF'))
    canvas.rect(0, PAGE_H - 14*mm, PAGE_W, 14*mm, fill=1, stroke=0)
    canvas.setFillColor(PDF_HEADER)
    canvas.rect(0, PAGE_H - 2*mm, PAGE_W, 2*mm, fill=1, stroke=0)
    canvas.setFont('Helvetica-Bold', 8)
    canvas.setFillColor(PDF_HEADER)
    canvas.drawString(2*cm, PAGE_H - 10*mm, 'B2IF PF — Documentação Técnica e Funcional')
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(PDF_MUTED)
    canvas.drawRightString(PAGE_W - 2*cm, PAGE_H - 10*mm, f'Página {doc.page}')
    # Rodapé
    canvas.setFillColor(colors.HexColor('#F8F7FF'))
    canvas.rect(0, 0, PAGE_W, 10*mm, fill=1, stroke=0)
    canvas.setFillColor(PDF_HEADER)
    canvas.rect(0, 0, PAGE_W, 1.5*mm, fill=1, stroke=0)
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(PDF_MUTED)
    canvas.drawCentredString(PAGE_W/2, 3.5*mm, 'B2 Inteligência Financeira · Sistema de Uso Interno · Confidencial')
    canvas.restoreState()

if __name__ == '__main__':
    output_path = '/home/user/webapp/b2if-pf/B2IF_PF_Documentacao.pdf'
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2.2*cm,
        bottomMargin=1.8*cm,
        title='B2IF PF — Documentação Técnica e Funcional',
        author='B2 Inteligência Financeira',
        subject='Sistema Planejador Financeiro Pessoal',
    )

    story = build_document()
    doc.build(story, onFirstPage=on_first_page, onLaterPages=on_later_pages)
    print(f'PDF gerado com sucesso: {output_path}')
