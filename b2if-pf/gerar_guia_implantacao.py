#!/usr/bin/env python3
"""
Gerador do Guia de Implantação White Label — Planejador PF
Produz um PDF ultra-detalhado com passo a passo completo de implantação.
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.colors import HexColor
import datetime

# ── Paleta de cores ───────────────────────────────────────────────────────────
TEAL      = HexColor('#00B8A9')
TEAL_DARK = HexColor('#008F84')
TEAL_BG   = HexColor('#E6F7F6')
DARK_BG   = HexColor('#0B0F1A')
CARD      = HexColor('#131929')
TEXT      = HexColor('#1A2235')
MUTED     = HexColor('#4A6080')
WARN      = HexColor('#F59E0B')
WARN_BG   = HexColor('#FFFBEB')
RED       = HexColor('#EF4444')
RED_BG    = HexColor('#FEF2F2')
GREEN     = HexColor('#22C55E')
GREEN_BG  = HexColor('#F0FDF4')
BLUE      = HexColor('#3B82F6')
BLUE_BG   = HexColor('#EFF6FF')
GRAY_BG   = HexColor('#F8F9FA')
GRAY_LINE = HexColor('#E2E8F0')
CODE_BG   = HexColor('#1E2D45')
CODE_TEXT = HexColor('#A8D5FF')
STEP_NUM  = HexColor('#00B8A9')
WHITE     = colors.white

PW, PH = A4
MARGIN_L = 18*mm
MARGIN_R = 18*mm
CONTENT_W = PW - MARGIN_L - MARGIN_R

# ── Estilos ───────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

def make_style(name, **kwargs):
    base = kwargs.pop('parent', 'Normal')
    s = ParagraphStyle(name, parent=styles[base], **kwargs)
    return s

S = {
    'title': make_style('title',
        fontSize=26, fontName='Helvetica-Bold',
        textColor=WHITE, leading=32, spaceAfter=4),
    'subtitle': make_style('subtitle',
        fontSize=13, fontName='Helvetica',
        textColor=HexColor('#B2D8D5'), leading=18),
    'h1': make_style('h1',
        fontSize=16, fontName='Helvetica-Bold',
        textColor=TEAL_DARK, leading=20, spaceBefore=14, spaceAfter=6),
    'h2': make_style('h2',
        fontSize=13, fontName='Helvetica-Bold',
        textColor=TEXT, leading=17, spaceBefore=10, spaceAfter=4),
    'h3': make_style('h3',
        fontSize=11, fontName='Helvetica-Bold',
        textColor=TEXT, leading=15, spaceBefore=6, spaceAfter=3),
    'body': make_style('body',
        fontSize=9.5, fontName='Helvetica',
        textColor=TEXT, leading=15, spaceAfter=4, alignment=TA_JUSTIFY),
    'body_left': make_style('body_left',
        fontSize=9.5, fontName='Helvetica',
        textColor=TEXT, leading=15, spaceAfter=3, alignment=TA_LEFT),
    'bold': make_style('bold',
        fontSize=9.5, fontName='Helvetica-Bold',
        textColor=TEXT, leading=15, spaceAfter=3),
    'muted': make_style('muted',
        fontSize=8.5, fontName='Helvetica',
        textColor=MUTED, leading=13, spaceAfter=2),
    'code': make_style('code',
        fontSize=8, fontName='Courier',
        textColor=CODE_TEXT, leading=12, spaceAfter=0,
        leftIndent=0, rightIndent=0),
    'code_comment': make_style('code_comment',
        fontSize=8, fontName='Courier',
        textColor=HexColor('#6A8FA8'), leading=12, spaceAfter=0),
    'warn_text': make_style('warn_text',
        fontSize=9, fontName='Helvetica-Bold',
        textColor=HexColor('#92400E'), leading=13),
    'tip_text': make_style('tip_text',
        fontSize=9, fontName='Helvetica',
        textColor=HexColor('#1E40AF'), leading=13),
    'tip_title': make_style('tip_title',
        fontSize=9, fontName='Helvetica-Bold',
        textColor=HexColor('#1E40AF'), leading=13),
    'ok_text': make_style('ok_text',
        fontSize=9, fontName='Helvetica',
        textColor=HexColor('#166534'), leading=13),
    'step_label': make_style('step_label',
        fontSize=9, fontName='Helvetica-Bold',
        textColor=WHITE, leading=12, alignment=TA_CENTER),
    'item': make_style('item',
        fontSize=9.5, fontName='Helvetica',
        textColor=TEXT, leading=15, spaceAfter=2,
        leftIndent=12),
    'item_bold': make_style('item_bold',
        fontSize=9.5, fontName='Helvetica-Bold',
        textColor=TEXT, leading=15, spaceAfter=2,
        leftIndent=12),
    'center': make_style('center',
        fontSize=9, fontName='Helvetica',
        textColor=MUTED, leading=13, alignment=TA_CENTER),
    'toc_item': make_style('toc_item',
        fontSize=10, fontName='Helvetica',
        textColor=TEXT, leading=16, leftIndent=8),
    'toc_num': make_style('toc_num',
        fontSize=10, fontName='Helvetica-Bold',
        textColor=TEAL, leading=16),
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def sp(h=4): return Spacer(1, h*mm)

def hr(color=GRAY_LINE, thickness=0.5): 
    return HRFlowable(width='100%', thickness=thickness, color=color, spaceAfter=4)

def code_block(lines, width=None):
    """Bloco de código com fundo escuro."""
    if width is None:
        width = CONTENT_W
    rows = []
    for line in lines:
        if line.startswith('#') or line.startswith('--'):
            rows.append([Paragraph(line, S['code_comment'])])
        else:
            rows.append([Paragraph(line if line else ' ', S['code'])])
    t = Table(rows, colWidths=[width - 14])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CODE_BG),
        ('ROUNDEDCORNERS', [6]),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('RIGHTPADDING',  (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS',(0,0),(-1,-1),[CODE_BG]),
    ]))
    return t

def callout(icon, title, body_lines, bg=BLUE_BG, border=BLUE, title_style=None, body_style=None):
    """Caixa de destaque (dica, aviso, etc.)."""
    ts = title_style or S['tip_title']
    bs = body_style or S['tip_text']
    content = [[Paragraph(f'{icon}  <b>{title}</b>', ts)]]
    for line in body_lines:
        content.append([Paragraph(line, bs)])
    t = Table(content, colWidths=[CONTENT_W - 10])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg),
        ('BOX',        (0,0), (-1,-1), 1.5, border),
        ('ROUNDEDCORNERS', [6]),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('RIGHTPADDING',  (0,0), (-1,-1), 10),
        ('ROWBACKGROUNDS',(0,0),(-1,-1),[bg]),
    ]))
    return t

def warning(body_lines):
    return callout('⚠️', 'ATENÇÃO', body_lines,
                   bg=WARN_BG, border=WARN,
                   title_style=S['warn_text'], body_style=S['warn_text'])

def tip(title, body_lines):
    return callout('💡', title, body_lines)

def success(body_lines):
    return callout('✅', 'Como confirmar o sucesso', body_lines,
                   bg=GREEN_BG, border=GREEN,
                   title_style=S['ok_text'], body_style=S['ok_text'])

def step_header(num, title, time_min):
    """Cabeçalho de passo numerado."""
    badge = Table([[Paragraph(str(num), S['step_label'])]],
                  colWidths=[8*mm], rowHeights=[8*mm])
    badge.setStyle(TableStyle([
        ('BACKGROUND', (0,0),(-1,-1), TEAL),
        ('ROUNDEDCORNERS',[20]),
        ('VALIGN', (0,0),(-1,-1),'MIDDLE'),
        ('ALIGN',  (0,0),(-1,-1),'CENTER'),
        ('TOPPADDING',    (0,0),(-1,-1), 0),
        ('BOTTOMPADDING', (0,0),(-1,-1), 0),
        ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
    ]))
    time_p = Paragraph(f'⏱ {time_min}', S['muted'])
    title_p = Paragraph(title, S['h1'])
    header = Table(
        [[badge, title_p, time_p]],
        colWidths=[10*mm, CONTENT_W - 32*mm, 22*mm]
    )
    header.setStyle(TableStyle([
        ('VALIGN',        (0,0),(-1,-1),'MIDDLE'),
        ('ALIGN',         (2,0),(2,0),'RIGHT'),
        ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
        ('TOPPADDING',    (0,0),(-1,-1), 2),
        ('BOTTOMPADDING', (0,0),(-1,-1), 2),
    ]))
    rule = HRFlowable(width='100%', thickness=2, color=TEAL, spaceAfter=8)
    return [header, rule]

def key_value_table(rows, key_w=None):
    """Tabela de dois campos: chave | valor."""
    if key_w is None:
        key_w = CONTENT_W * 0.38
    val_w = CONTENT_W - key_w
    data = []
    for k, v in rows:
        data.append([
            Paragraph(k, S['bold']),
            Paragraph(v, S['body_left']),
        ])
    t = Table(data, colWidths=[key_w, val_w])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), GRAY_BG),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [GRAY_BG, WHITE]),
        ('BOX',    (0,0), (-1,-1), 0.5, GRAY_LINE),
        ('GRID',   (0,0), (-1,-1), 0.3, GRAY_LINE),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    return t

def env_table(rows):
    """Tabela das variáveis de ambiente."""
    header = [Paragraph(h, S['bold']) for h in ['Variável', 'Obrig.', 'Descrição', 'Exemplo']]
    data = [header]
    col_w = [CONTENT_W*0.30, CONTENT_W*0.08, CONTENT_W*0.32, CONTENT_W*0.30]
    for var, req, desc, ex in rows:
        data.append([
            Paragraph(f'<font name="Courier" size="8">{var}</font>', S['body_left']),
            Paragraph(req, S['bold']),
            Paragraph(desc, S['body_left']),
            Paragraph(f'<font name="Courier" size="8">{ex}</font>', S['muted']),
        ])
    t = Table(data, colWidths=col_w)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TEAL),
        ('TEXTCOLOR',  (0,0), (-1,0), WHITE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [GRAY_BG, WHITE]),
        ('BOX',    (0,0), (-1,-1), 0.5, GRAY_LINE),
        ('GRID',   (0,0), (-1,-1), 0.3, GRAY_LINE),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 7),
        ('RIGHTPADDING',  (0,0), (-1,-1), 7),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    return t

def checklist(items):
    """Lista de checklist com quadradinhos."""
    rows = []
    for item in items:
        rows.append([
            Paragraph('□', S['body']),
            Paragraph(item, S['body_left']),
        ])
    t = Table(rows, colWidths=[6*mm, CONTENT_W - 8*mm])
    t.setStyle(TableStyle([
        ('VALIGN',        (0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
        ('TOPPADDING',    (0,0),(-1,-1), 1),
        ('BOTTOMPADDING', (0,0),(-1,-1), 1),
    ]))
    return t

def numbered_list(items):
    rows = []
    for i, item in enumerate(items, 1):
        if isinstance(item, tuple):
            label, detail = item
            rows.append([Paragraph(f'<b>{i}.</b>', S['body']),
                          Paragraph(f'<b>{label}</b> — {detail}', S['body_left'])])
        else:
            rows.append([Paragraph(f'<b>{i}.</b>', S['body']),
                          Paragraph(item, S['body_left'])])
    t = Table(rows, colWidths=[6*mm, CONTENT_W - 8*mm])
    t.setStyle(TableStyle([
        ('VALIGN',        (0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
        ('TOPPADDING',    (0,0),(-1,-1), 2),
        ('BOTTOMPADDING', (0,0),(-1,-1), 2),
    ]))
    return t

# ── Cabeçalho e rodapé de página ─────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Faixa superior
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, h - 11*mm, w, 11*mm, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.setFont('Helvetica-Bold', 9)
    canvas.drawString(MARGIN_L, h - 7*mm, 'Planejador PF — Guia de Implantação White Label')
    canvas.setFillColor(HexColor('#7A90B0'))
    canvas.setFont('Helvetica', 8)
    canvas.drawRightString(w - MARGIN_R, h - 7*mm,
                           f'Modelo C · {datetime.date.today().strftime("%d/%m/%Y")}')
    # Rodapé
    canvas.setStrokeColor(GRAY_LINE)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN_L, 12*mm, w - MARGIN_R, 12*mm)
    canvas.setFillColor(MUTED)
    canvas.setFont('Helvetica', 7.5)
    canvas.drawString(MARGIN_L, 8*mm, 'Documento de uso interno — não distribuir externamente.')
    canvas.drawRightString(w - MARGIN_R, 8*mm, f'Página {doc.page}')
    canvas.restoreState()

def on_first_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Fundo escuro na capa
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, h*0.62, w, h*0.38, fill=1, stroke=0)
    # Barra colorida
    canvas.setFillColor(TEAL)
    canvas.rect(0, h*0.62, w, 3*mm, fill=1, stroke=0)
    canvas.restoreState()

# ── CONTEÚDO ─────────────────────────────────────────────────────────────────
def build_pdf(path):
    doc = SimpleDocTemplate(
        path,
        pagesize=A4,
        leftMargin=MARGIN_L, rightMargin=MARGIN_R,
        topMargin=16*mm, bottomMargin=18*mm,
        title='Guia de Implantação White Label — Planejador PF',
        author='B2IF Assessoria',
    )

    story = []

    # ══════════════════════════════════════════════════════════════════
    # CAPA
    # ══════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 58*mm))
    story.append(Paragraph('Guia de Implantação', S['title']))
    story.append(Paragraph('White Label — Modelo C', S['subtitle']))
    story.append(sp(2))
    story.append(Paragraph('Planejador PF · Sistema de Planejamento Financeiro Pessoal', S['subtitle']))
    story.append(sp(8))

    # Tabela resumo de capa
    cover_data = [
        ['Documento', 'Guia de Implantação para Novo Cliente'],
        ['Versão',    '1.0 — Modelo C (banco isolado por cliente)'],
        ['Gerado em', datetime.date.today().strftime('%d de %B de %Y')],
        ['Tempo total', '~45 minutos por instalação'],
        ['Pré-requisito', 'Node.js 18+, Git, conta Supabase, conta Netlify/Vercel'],
    ]
    cover_table = Table(
        [[Paragraph(k, S['bold']), Paragraph(v, S['body_left'])] for k, v in cover_data],
        colWidths=[CONTENT_W*0.30, CONTENT_W*0.70]
    )
    cover_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), HexColor('#1A2235')),
        ('TEXTCOLOR',  (0,0), (-1,-1), WHITE),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [HexColor('#1A2235'), HexColor('#0F1420')]),
        ('BOX',    (0,0), (-1,-1), 1, TEAL),
        ('GRID',   (0,0), (-1,-1), 0.3, HexColor('#1E2D45')),
        ('TOPPADDING',    (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('RIGHTPADDING',  (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(cover_table)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # SUMÁRIO
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph('Sumário', S['h1']))
    story.append(hr(TEAL, 2))
    story.append(sp(2))

    toc_items = [
        ('01', 'Visão geral e arquitetura do Modelo C', '3'),
        ('02', 'O que você vai precisar (pré-requisitos)', '3'),
        ('03', 'PASSO 1 — Criar o projeto Supabase', '4'),
        ('04', 'PASSO 2 — Executar o script SQL de setup', '5'),
        ('05', 'PASSO 3 — Criar o usuário Manager', '6'),
        ('06', 'PASSO 4 — Implantar a Edge Function admin-cliente', '7'),
        ('07', 'PASSO 5 — Configurar identidade visual (.env)', '8'),
        ('08', 'PASSO 6 — Gerar o build de produção', '9'),
        ('09', 'PASSO 7 — Deploy no Netlify (recomendado)', '10'),
        ('10', 'PASSO 8 — Configurar domínio personalizado', '11'),
        ('11', 'PASSO 9 — Verificação e testes finais', '12'),
        ('12', 'Referência rápida das variáveis de ambiente', '13'),
        ('13', 'Solução de problemas comuns', '13'),
        ('14', 'Atualizações e manutenção', '14'),
        ('15', 'Checklist completo de implantação', '14'),
    ]
    for num, title, page in toc_items:
        row = Table(
            [[Paragraph(num, S['toc_num']), Paragraph(title, S['toc_item']),
              Paragraph(page, S['muted'])]],
            colWidths=[10*mm, CONTENT_W - 22*mm, 12*mm]
        )
        row.setStyle(TableStyle([
            ('VALIGN',        (0,0),(-1,-1),'MIDDLE'),
            ('TOPPADDING',    (0,0),(-1,-1), 3),
            ('BOTTOMPADDING', (0,0),(-1,-1), 3),
            ('LEFTPADDING',   (0,0),(-1,-1), 0),
            ('RIGHTPADDING',  (0,0),(-1,-1), 0),
            ('ALIGN',         (2,0),(2,0),'RIGHT'),
        ]))
        story.append(row)
        story.append(hr())

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # SEÇÃO 1 — VISÃO GERAL
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph('Visão Geral — Modelo C (Banco Isolado)', S['h1']))
    story.append(hr(TEAL, 2))
    story.append(sp(2))

    story.append(Paragraph(
        'O <b>Modelo C</b> é a arquitetura recomendada para comercializar o Planejador PF '
        'como white label. Cada cliente final recebe sua própria instância completamente '
        'isolada: banco de dados, autenticação, front-end e domínio. Os dados de um cliente '
        'jamais ficam no mesmo banco de dados de outro cliente.',
        S['body']
    ))
    story.append(sp(3))

    arch = [
        ['Componente', 'Por cliente', 'Gerenciado por'],
        ['Banco de dados (Supabase)', '✅ Exclusivo', 'Supabase (plano Free ou Pro)'],
        ['Autenticação de usuários', '✅ Exclusivo', 'Supabase Auth'],
        ['Edge Function admin-cliente', '✅ Exclusivo', 'Supabase Edge Functions'],
        ['Front-end (React + Vite)', '✅ Build dedicado', 'Netlify / Vercel / CF Pages'],
        ['Domínio', '✅ Personalizado', 'DNS do cliente ou Netlify'],
        ['Logo e identidade visual', '✅ Customizado', 'Arquivo .env + pasta public/'],
        ['Código-fonte', '🔄 Compartilhado', 'GitHub (seu repositório)'],
    ]
    arch_table = Table(
        [[Paragraph(c, S['bold'] if i==0 else S['body_left']) for c in row]
         for i, row in enumerate(arch)],
        colWidths=[CONTENT_W*0.38, CONTENT_W*0.22, CONTENT_W*0.40]
    )
    arch_table.setStyle(TableStyle([
        ('BACKGROUND',   (0,0), (-1,0), TEAL),
        ('TEXTCOLOR',    (0,0), (-1,0), WHITE),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[GRAY_BG, WHITE]),
        ('BOX',   (0,0),(-1,-1), 0.5, GRAY_LINE),
        ('GRID',  (0,0),(-1,-1), 0.3, GRAY_LINE),
        ('TOPPADDING',    (0,0),(-1,-1), 5),
        ('BOTTOMPADDING', (0,0),(-1,-1), 5),
        ('LEFTPADDING',   (0,0),(-1,-1), 8),
        ('RIGHTPADDING',  (0,0),(-1,-1), 8),
        ('VALIGN', (0,0),(-1,-1),'MIDDLE'),
    ]))
    story.append(arch_table)
    story.append(sp(4))

    story.append(Paragraph('Pré-requisitos', S['h2']))
    story.append(numbered_list([
        ('Node.js 18 ou superior', 'Baixe em nodejs.org — verifique com <font name="Courier">node -v</font>'),
        ('Git instalado', 'git.scm.com — verifique com <font name="Courier">git --version</font>'),
        ('Repositório clonado', 'Ter o código do Planejador PF na sua máquina'),
        ('Conta Supabase', 'Gratuita em supabase.com — plano Free é suficiente para começar'),
        ('Conta Netlify', 'Gratuita em netlify.com — suporta domínio customizado'),
        ('Supabase CLI', 'Instalado via npm — instruções no Passo 4'),
        ('Logo do cliente', 'Arquivo PNG ou SVG quadrado, mín. 128×128 px'),
    ]))
    story.append(sp(2))
    story.append(tip('Plano Supabase recomendado',
        ['O plano <b>Free</b> suporta até 50.000 usuários ativos mensais e 500 MB de banco.',
         'Para clientes com grande volume de transações, considere o plano <b>Pro</b> (US$25/mês).',
         'O plano Free tem <b>pausa automática</b> após 7 dias sem acesso — no Pro isso não acontece.']))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # PASSO 1
    # ══════════════════════════════════════════════════════════════════
    for elem in step_header(1, 'Criar o projeto Supabase', '5 min'):
        story.append(elem)

    story.append(Paragraph(
        'Cada cliente recebe um projeto Supabase próprio. Este projeto será o banco de dados '
        'exclusivo dele — nenhuma informação de outros clientes ficará aqui.',
        S['body']
    ))
    story.append(sp(3))

    story.append(Paragraph('1.1 — Criar conta e projeto', S['h3']))
    story.append(numbered_list([
        'Acesse <b>https://app.supabase.com</b> e faça login (ou crie uma conta gratuita).',
        'No painel principal, clique no botão verde <b>"New Project"</b> (canto superior direito).',
        'Selecione a organização onde o projeto ficará (ou crie uma nova clicando em "New Organization").',
    ]))
    story.append(sp(3))

    story.append(Paragraph('1.2 — Preencher os dados do projeto', S['h3']))
    story.append(key_value_table([
        ('<b>Name</b>',              'Nome curto do cliente, sem espaços. Ex: <font name="Courier">empresa-abc-pf</font>'),
        ('<b>Database Password</b>', 'Gere uma senha forte (clique em "Generate a password"). <b>SALVE EM LOCAL SEGURO</b> — será necessária se precisar conectar ao banco diretamente.'),
        ('<b>Region</b>',            'Escolha a região mais próxima do cliente. Para clientes brasileiros: <b>South America (São Paulo)</b> — código <font name="Courier">sa-east-1</font>'),
        ('<b>Pricing Plan</b>',      'Free para começar. Pode migrar para Pro depois sem perder dados.'),
    ]))
    story.append(sp(2))
    story.append(Paragraph('Clique em <b>"Create new project"</b>. O Supabase levará de 1 a 2 minutos para provisionar o banco.', S['body']))
    story.append(sp(3))

    story.append(Paragraph('1.3 — Coletar as credenciais', S['h3']))
    story.append(Paragraph(
        'Após o projeto ser criado, vá em <b>Settings</b> (ícone de engrenagem no menu esquerdo) '
        '→ <b>API</b>. Você verá:',
        S['body']
    ))
    story.append(sp(2))
    story.append(key_value_table([
        ('<b>Project URL</b>',         'Ex: <font name="Courier">https://abcdefghij.supabase.co</font> — copie e salve. Esta é a VITE_SUPABASE_URL.'),
        ('<b>Project API Keys → anon public</b>', 'Chave longa começando com <font name="Courier">eyJ...</font>. Esta é a VITE_SUPABASE_ANON_KEY. <b>NÃO confunda com a service_role key</b> — a anon key é a pública.'),
        ('<b>Project ID</b>',          'Aparece na URL do painel e em Settings → General. Ex: <font name="Courier">abcdefghij</font>. Será usado no Supabase CLI no Passo 4.'),
    ]))
    story.append(sp(2))
    story.append(warning([
        'A chave <b>service_role</b> (também visível na mesma tela) tem poder de administrador.',
        'NUNCA coloque a service_role no front-end. Use apenas a <b>anon</b> key no arquivo .env.',
    ]))
    story.append(success([
        'Você tem em mãos: Project URL, anon key e Project ID.',
        'O projeto aparece com status "Active" no painel do Supabase.',
    ]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # PASSO 2
    # ══════════════════════════════════════════════════════════════════
    for elem in step_header(2, 'Executar o script SQL de setup', '5 min'):
        story.append(elem)

    story.append(Paragraph(
        'O script <b>setup_supabase.sql</b> (na raiz do repositório) cria todas as tabelas, '
        'índices e políticas de segurança (RLS) necessárias. É idempotente — pode ser '
        'executado múltiplas vezes sem erro.',
        S['body']
    ))
    story.append(sp(3))

    story.append(Paragraph('2.1 — Abrir o SQL Editor', S['h3']))
    story.append(numbered_list([
        'No painel do projeto Supabase, clique em <b>SQL Editor</b> no menu lateral esquerdo (ícone de banco de dados com código).',
        'Clique em <b>"New query"</b> no topo da área de conteúdo.',
        'Uma área de texto em branco aparecerá.',
    ]))
    story.append(sp(3))

    story.append(Paragraph('2.2 — Executar o script', S['h3']))
    story.append(numbered_list([
        'Abra o arquivo <font name="Courier">setup_supabase.sql</font> no seu computador (está na raiz do projeto).',
        'Selecione todo o conteúdo (<b>Ctrl+A</b> ou <b>Cmd+A</b>).',
        'Copie (<b>Ctrl+C</b> ou <b>Cmd+C</b>).',
        'Cole no SQL Editor do Supabase (<b>Ctrl+V</b> ou <b>Cmd+V</b>).',
        'Clique no botão verde <b>"Run"</b> (ou pressione <b>Ctrl+Enter</b>).',
    ]))
    story.append(sp(3))

    story.append(Paragraph('2.3 — O script cria automaticamente', S['h3']))
    story.append(key_value_table([
        ('<b>Tabela planejadores</b>', 'Armazena o manager e todos os planejadores da instância. Campos: id, nome, email, role (manager/planejador), ativo, criado_em.'),
        ('<b>Tabela clientes</b>',     'Um registro por cliente do planejador. O campo <font name="Courier">dados</font> (JSONB) armazena todas as transações, planejamento, regras e categorias.'),
        ('<b>Tabela cliente_acessos</b>', 'Logins que o cliente usa para acessar o sistema no modo leitura. Cada cliente pode ter múltiplos logins (ex: casal).'),
        ('<b>Row Level Security (RLS)</b>', 'Garante que cada usuário só acessa os dados que lhe pertencem. Planejador vê seus clientes, cliente vê apenas o seu próprio dashboard.'),
        ('<b>Políticas (11 no total)</b>', 'Definem exatamente quais operações cada perfil pode fazer: manager vê tudo, planejador vê seus clientes, cliente só lê.'),
    ]))
    story.append(sp(2))
    story.append(success([
        'O painel de resultados do SQL Editor mostra: <font name="Courier">Setup concluído com sucesso!</font>',
        'Vá em <b>Table Editor</b> no menu esquerdo e confirme que as tabelas aparecem: planejadores, clientes, cliente_acessos.',
    ]))
    story.append(sp(2))
    story.append(warning([
        'Se aparecer um erro de permissão, verifique se você está no projeto correto (nome do projeto aparece no topo do painel).',
        'Erros do tipo "already exists" são normais se o script for rodado mais de uma vez — o script usa IF NOT EXISTS e DROP POLICY IF EXISTS.',
    ]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # PASSO 3
    # ══════════════════════════════════════════════════════════════════
    for elem in step_header(3, 'Criar o usuário Manager', '5 min'):
        story.append(elem)

    story.append(Paragraph(
        'O <b>Manager</b> é o super-usuário da instância: ele cria e gerencia os planejadores '
        '(que por sua vez gerenciam os clientes). Geralmente é você ou o responsável pela '
        'empresa do cliente.',
        S['body']
    ))
    story.append(sp(3))

    story.append(Paragraph('3.1 — Criar o usuário no Supabase Auth', S['h3']))
    story.append(numbered_list([
        'No painel do Supabase, clique em <b>Authentication</b> no menu lateral (ícone de pessoa).',
        'Clique em <b>Users</b> na barra superior.',
        'Clique no botão <b>"Add user"</b> (ou "Invite user") → escolha <b>"Create new user"</b>.',
        'Preencha: <b>Email</b> (email definitivo do manager) e <b>Password</b> (senha provisória de 8+ caracteres).',
        'Marque a opção <b>"Auto Confirm User"</b> para evitar que um e-mail de verificação seja enviado.',
        'Clique em <b>"Create User"</b>.',
    ]))
    story.append(sp(3))

    story.append(Paragraph('3.2 — Copiar o UUID do usuário criado', S['h3']))
    story.append(Paragraph(
        'Após criar o usuário, ele aparecerá na lista. Clique nele para abrir os detalhes. '
        'Copie o campo <b>"User UID"</b> — é um código no formato '
        '<font name="Courier">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</font>. '
        'Este é o ID que será usado no banco de dados.',
        S['body']
    ))
    story.append(sp(3))

    story.append(Paragraph('3.3 — Registrar o Manager na tabela planejadores', S['h3']))
    story.append(Paragraph(
        'Volte ao <b>SQL Editor</b> e execute o comando abaixo, substituindo os valores:',
        S['body']
    ))
    story.append(sp(2))
    story.append(code_block([
        '-- SUBSTITUA os três valores abaixo antes de executar:',
        "INSERT INTO public.planejadores (id, nome, email, role, ativo)",
        "VALUES (",
        "  'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- UUID copiado do Auth",
        "  'Nome Completo do Manager',               -- nome real",
        "  'email@empresa.com',                      -- email usado no login",
        "  'manager',",
        "  true",
        ") ON CONFLICT (id) DO NOTHING;",
    ]))
    story.append(sp(2))
    story.append(success([
        'Execute <font name="Courier">SELECT * FROM public.planejadores;</font> no SQL Editor.',
        'Deve aparecer uma linha com role = "manager" e ativo = true.',
        'Faça login no sistema com o email e senha criados — você será direcionado ao Painel Manager.',
    ]))
    story.append(sp(2))
    story.append(tip('Por que dois passos?',
        ['O Supabase separa a autenticação (quem pode fazer login) do banco de dados (quem tem qual perfil).',
         'O primeiro passo cria o login no sistema de autenticação.',
         'O segundo passo registra esse login como "manager" na tabela de negócio.',
         'Sem o segundo passo, o usuário consegue fazer login mas o sistema exibe "Usuário não encontrado".']))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # PASSO 4
    # ══════════════════════════════════════════════════════════════════
    for elem in step_header(4, 'Implantar a Edge Function admin-cliente', '10 min'):
        story.append(elem)

    story.append(Paragraph(
        'A <b>Edge Function admin-cliente</b> é uma função serverless que roda no Supabase. '
        'Ela é necessária para criar, resetar senhas e excluir os logins dos clientes finais '
        '(operações que exigem permissão de administrador e não podem ser feitas pelo front-end).',
        S['body']
    ))
    story.append(sp(3))

    story.append(Paragraph('4.1 — Instalar o Supabase CLI', S['h3']))
    story.append(Paragraph('Execute no terminal (uma vez por máquina):', S['body']))
    story.append(sp(1))
    story.append(code_block([
        '# Instala o Supabase CLI globalmente via npm',
        'npm install -g supabase',
        '',
        '# Confirme a instalação',
        'supabase --version',
        '# Deve exibir algo como: 1.x.x',
    ]))
    story.append(sp(2))
    story.append(tip('Alternativa sem npm',
        ['macOS/Linux: <font name="Courier">brew install supabase/tap/supabase</font>',
         'Windows: baixe o executável em github.com/supabase/cli/releases']))
    story.append(sp(3))

    story.append(Paragraph('4.2 — Autenticar no Supabase CLI', S['h3']))
    story.append(code_block([
        '# Abre o navegador para autenticar com sua conta Supabase',
        'supabase login',
        '',
        '# Um código será exibido no terminal.',
        '# Cole-o na página que abrir no navegador e clique em "Confirm".',
    ]))
    story.append(sp(3))

    story.append(Paragraph('4.3 — Navegar até o projeto e vincular ao Supabase', S['h3']))
    story.append(code_block([
        '# Navegue até a pasta do projeto no seu computador',
        'cd /caminho/para/b2if-pf',
        '',
        '# Vincule o CLI ao projeto Supabase do cliente',
        '# Substitua SEU_PROJECT_ID pelo ID obtido no Passo 1.3',
        'supabase link --project-ref SEU_PROJECT_ID',
        '',
        '# O CLI pedirá a senha do banco (a que você criou no Passo 1.2)',
        '# Digite-a e pressione Enter.',
    ]))
    story.append(sp(3))

    story.append(Paragraph('4.4 — Fazer o deploy da Edge Function', S['h3']))
    story.append(code_block([
        '# Implanta a função admin-cliente no Supabase do cliente',
        'supabase functions deploy admin-cliente',
        '',
        '# Saída esperada:',
        '# Deploying Function admin-cliente (script size: XXX KB)',
        '# Done.',
    ]))
    story.append(sp(2))
    story.append(success([
        'No painel do Supabase, vá em <b>Edge Functions</b> no menu lateral.',
        'A função <font name="Courier">admin-cliente</font> deve aparecer com status <b>Active</b>.',
        'Clique nela para ver os logs — se não houver erros, está correta.',
    ]))
    story.append(sp(2))
    story.append(warning([
        'Se o deploy falhar com "function not found", verifique se você está na pasta correta do projeto.',
        'O arquivo da função está em: <font name="Courier">supabase/functions/admin-cliente/index.ts</font>',
        'Se aparecer erro de autenticação, execute <font name="Courier">supabase login</font> novamente.',
    ]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # PASSO 5
    # ══════════════════════════════════════════════════════════════════
    for elem in step_header(5, 'Configurar identidade visual (.env)', '5 min'):
        story.append(elem)

    story.append(Paragraph(
        'O arquivo <b>.env</b> é onde toda a personalização do cliente fica: credenciais do '
        'banco, nome da empresa, cor da marca e logo. Este arquivo <b>não vai para o GitHub</b> '
        '— fica apenas na sua máquina durante o build.',
        S['body']
    ))
    story.append(sp(3))

    story.append(Paragraph('5.1 — Criar o arquivo .env', S['h3']))
    story.append(code_block([
        '# Na pasta do projeto:',
        'cp .env.example .env',
        '',
        '# Abra o arquivo no seu editor de texto favorito:',
        'code .env           # VS Code',
        '# OU',
        'notepad .env        # Windows',
        '# OU',
        'nano .env           # Terminal Linux/macOS',
    ]))
    story.append(sp(3))

    story.append(Paragraph('5.2 — Preencher cada variável', S['h3']))
    story.append(env_table([
        ('VITE_SUPABASE_URL',      '✅', 'URL do projeto Supabase (Passo 1.3)',
         'https://abcxyz.supabase.co'),
        ('VITE_SUPABASE_ANON_KEY', '✅', 'Chave anon pública (Passo 1.3)',
         'eyJhbGciOiJI...'),
        ('VITE_APP_NAME',          '✅', 'Nome exibido no header e no PDF',
         'Empresa ABC PF'),
        ('VITE_APP_SUBTITLE',      '➖', 'Subtítulo na tela de login',
         'Planejador Financeiro'),
        ('VITE_APP_COMPANY',       '➖', 'Nome no rodapé da tela de login',
         'Empresa ABC Assessoria'),
        ('VITE_APP_TAGLINE',       '➖', 'Tagline no rodapé do login',
         'Sistema de Uso Interno'),
        ('VITE_BRAND_COLOR',       '➖', 'Cor principal em hex (auto-gera variantes)',
         '#1A56DB'),
        ('VITE_LOGO_FILE',         '➖', 'Nome do logo em public/ (sem barra)',
         'logo-empresa.png'),
    ]))
    story.append(sp(3))

    story.append(Paragraph('5.3 — Adicionar o logo do cliente', S['h3']))
    story.append(numbered_list([
        'Obtenha o logo do cliente em formato <b>PNG, SVG ou WebP</b>.',
        'O logo deve ser <b>quadrado</b> (ou com fundo transparente). Tamanho ideal: 128×128 px ou maior.',
        f'Copie o arquivo para a pasta <font name="Courier">public/</font> do projeto.',
        'Renomeie para coincidir com o valor de <font name="Courier">VITE_LOGO_FILE</font> no .env.',
    ]))
    story.append(sp(2))
    story.append(Paragraph(
        '<b>Exemplo:</b> se o .env tem <font name="Courier">VITE_LOGO_FILE=logo-abc.png</font>, '
        'o arquivo deve estar em <font name="Courier">public/logo-abc.png</font>.',
        S['body']
    ))
    story.append(sp(2))
    story.append(tip('Cores para identidades visuais comuns',
        ['Azul corporativo: <font name="Courier">#1A56DB</font>',
         'Verde financeiro: <font name="Courier">#059669</font>',
         'Roxo premium: <font name="Courier">#7C3AED</font>',
         'Vermelho energia: <font name="Courier">#DC2626</font>',
         'Laranja dinâmico: <font name="Courier">#EA580C</font>',
         'As variantes escura e clara são calculadas automaticamente — não precisa especificar.']))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # PASSO 6
    # ══════════════════════════════════════════════════════════════════
    for elem in step_header(6, 'Gerar o build de produção', '5 min'):
        story.append(elem)

    story.append(Paragraph(
        'O build converte o código React em arquivos estáticos HTML, CSS e JavaScript '
        'otimizados para produção. Neste momento as variáveis do .env são incorporadas '
        'diretamente nos arquivos — por isso cada cliente tem um build separado.',
        S['body']
    ))
    story.append(sp(3))

    story.append(code_block([
        '# Certifique-se de estar na pasta do projeto',
        'cd /caminho/para/b2if-pf',
        '',
        '# Instale as dependências (apenas na primeira vez ou após npm install)',
        'npm install',
        '',
        '# Gere o build de produção',
        'npm run build',
        '',
        '# Saída esperada (sem erros):',
        '# vite v8.x.x building client environment for production...',
        '# ✓ 279 modules transformed.',
        '# dist/index.html         1.17 kB',
        '# dist/assets/...         ...',
        '# ✓ built in X.XXs',
    ]))
    story.append(sp(3))

    story.append(Paragraph('O que foi gerado', S['h3']))
    story.append(key_value_table([
        ('<b>dist/</b>',               'Pasta com todos os arquivos de produção. É esta pasta que vai para o servidor.'),
        ('<b>dist/index.html</b>',     'Ponto de entrada da aplicação.'),
        ('<b>dist/assets/</b>',        'JavaScript, CSS e imagens otimizadas e com hash no nome (para cache busting).'),
        ('<b>dist/_redirects</b>',     'Regra de roteamento SPA para Netlify (redireciona todas as rotas para index.html).'),
        ('<b>dist/manifest.json</b>',  'Manifesto PWA (permite instalar o app na tela inicial do celular).'),
    ]))
    story.append(sp(2))
    story.append(warning([
        'Se aparecer algum erro no build, verifique se o arquivo .env está na pasta raiz do projeto.',
        'Erros de "module not found" geralmente indicam que <font name="Courier">npm install</font> não foi executado.',
        'Não edite os arquivos dentro de dist/ manualmente — eles são sobrescritos a cada novo build.',
    ]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # PASSO 7
    # ══════════════════════════════════════════════════════════════════
    for elem in step_header(7, 'Deploy no Netlify (recomendado)', '8 min'):
        story.append(elem)

    story.append(Paragraph(
        'O <b>Netlify</b> é a plataforma de deploy recomendada por ter plano gratuito generoso, '
        'suporte nativo a SPA (Single Page Application), SSL automático e domínios personalizados. '
        'O processo abaixo descreve o deploy via <b>drag-and-drop</b> (sem GitHub), '
        'e depois a opção via GitHub para deploys automáticos.',
        S['body']
    ))
    story.append(sp(3))

    story.append(Paragraph('7.1 — Deploy rápido via drag-and-drop (sem GitHub)', S['h3']))
    story.append(numbered_list([
        'Acesse <b>https://app.netlify.com</b> e faça login.',
        'Na tela inicial, você verá uma área cinza com o texto <b>"Drag and drop your site output folder here"</b>.',
        'Abra o explorador de arquivos do seu computador e navegue até a pasta <font name="Courier">dist/</font> do projeto.',
        'Arraste a pasta <font name="Courier">dist/</font> inteira e solte na área cinza do Netlify.',
        'O Netlify fará o upload automaticamente (leva ~20–30 segundos para projetos normais).',
        'Após o upload, o Netlify gera uma URL temporária no formato <font name="Courier">https://nome-aleatorio.netlify.app</font>.',
        'Clique na URL para testar o sistema.',
    ]))
    story.append(sp(3))

    story.append(Paragraph('7.2 — Deploy via GitHub (automático — recomendado para produção)', S['h3']))
    story.append(numbered_list([
        'No Netlify, clique em <b>"Add new site"</b> → <b>"Import an existing project"</b>.',
        'Clique em <b>"Deploy with GitHub"</b> e autorize o Netlify a acessar seu repositório.',
        'Selecione o repositório <b>my-pedrofavero-repo</b>.',
        'Configure o build: <b>Base directory</b>: <font name="Courier">b2if-pf</font> · <b>Build command</b>: <font name="Courier">npm run build</font> · <b>Publish directory</b>: <font name="Courier">b2if-pf/dist</font>.',
        'Vá em <b>Site Settings → Environment Variables</b> e adicione todas as variáveis do .env do cliente (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, etc.).',
        'Clique em <b>"Deploy site"</b>. A partir daí, cada push para a branch main dispara um novo deploy automaticamente.',
    ]))
    story.append(sp(2))
    story.append(tip('Qual método usar?',
        ['<b>Drag-and-drop</b>: ideal para começar, testar, ou quando há um único cliente. Mais simples.',
         '<b>GitHub</b>: ideal para produção. Cada atualização no código é publicada automaticamente.',
         'Você pode começar com drag-and-drop e migrar para GitHub depois sem perder a URL.']))
    story.append(success([
        'O site abre e exibe a tela de login com o logo e a cor do cliente.',
        'O título na aba do navegador mostra o nome correto (VITE_APP_NAME).',
    ]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # PASSO 8
    # ══════════════════════════════════════════════════════════════════
    for elem in step_header(8, 'Configurar domínio personalizado', '8 min'):
        story.append(elem)

    story.append(Paragraph(
        'Por padrão o Netlify gera um subdomínio aleatório. Para o cliente ter um endereço '
        'profissional como <font name="Courier">pf.empresa.com.br</font>, siga os passos abaixo.',
        S['body']
    ))
    story.append(sp(3))

    story.append(Paragraph('8.1 — Acessar as configurações de domínio', S['h3']))
    story.append(numbered_list([
        'No painel do site no Netlify, vá em <b>Domain Management</b> (ou "Set up a custom domain").',
        'Clique em <b>"Add a domain"</b>.',
        'Digite o domínio desejado, ex: <font name="Courier">pf.empresa.com.br</font>.',
        'Clique em <b>"Verify"</b> e depois em <b>"Add domain"</b>.',
    ]))
    story.append(sp(3))

    story.append(Paragraph('8.2 — Opções de configuração DNS', S['h3']))
    story.append(Paragraph('<b>Opção A — Subdomínio (mais comum):</b> ex. pf.empresa.com.br', S['h3']))
    story.append(Paragraph(
        'Adicione um registro <b>CNAME</b> no DNS do cliente apontando para o endereço Netlify:',
        S['body']
    ))
    story.append(sp(1))
    story.append(code_block([
        '# No painel de DNS do cliente (ex: Registro.br, GoDaddy, Cloudflare):',
        'Tipo:   CNAME',
        'Nome:   pf          (ou www, ou qualquer subdomínio)',
        'Valor:  nome-aleatorio.netlify.app',
        'TTL:    3600 (ou "Automático")',
    ]))
    story.append(sp(2))
    story.append(Paragraph('<b>Opção B — Domínio raiz:</b> ex. empresa.com.br (sem www)', S['h3']))
    story.append(code_block([
        '# Adicione um registro A apontando para o IP do Netlify:',
        'Tipo:  A',
        'Nome:  @ (ou domínio raiz)',
        'Valor: 75.2.60.5',
        'TTL:   3600',
    ]))
    story.append(sp(3))

    story.append(Paragraph('8.3 — SSL automático', S['h3']))
    story.append(Paragraph(
        'Após o DNS propagar (pode levar de 5 minutos a 24 horas), o Netlify provisiona '
        'automaticamente um certificado SSL gratuito via <b>Let\'s Encrypt</b>. '
        'O site ficará acessível via HTTPS sem custo adicional.',
        S['body']
    ))
    story.append(sp(2))
    story.append(tip('Como verificar a propagação do DNS',
        ['Acesse <b>https://dnschecker.org</b> e pesquise o domínio do cliente.',
         'Quando todos os pontos do mapa ficarem verdes, a propagação foi concluída.',
         'Após a propagação, o Netlify emite o SSL automaticamente em ~2 minutos.']))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # PASSO 9
    # ══════════════════════════════════════════════════════════════════
    for elem in step_header(9, 'Verificação e testes finais', '5 min'):
        story.append(elem)

    story.append(Paragraph(
        'Antes de entregar o acesso ao cliente, percorra este roteiro de verificação '
        'para garantir que tudo está funcionando corretamente.',
        S['body']
    ))
    story.append(sp(3))

    story.append(Paragraph('9.1 — Checklist de verificação', S['h3']))
    story.append(checklist([
        'O site abre na URL correta (domínio personalizado ou .netlify.app)',
        'A tela de login exibe o logo correto do cliente',
        'A cor da marca (botões, highlights) está correta',
        'O nome do app no header e no rodapé estão corretos',
        'Login como Manager funciona (email e senha do Passo 3)',
        'O Painel Manager abre corretamente com lista de planejadores vazia',
        'Criar um planejador de teste funciona',
        'Login com o planejador de teste funciona e abre o Hub',
        'Criar um cliente de teste no Hub funciona',
        'Abrir o cliente e ir para o Planejador funciona',
        'O botão "Gerar PDF" aparece no Planejador (com uma projeção ativa)',
        'O PDF é gerado com o nome e cor corretos do cliente',
        'Criar um acesso de cliente via modal de acessos funciona',
        'Login como cliente (modo leitura) funciona e exibe apenas Dashboard e Fluxo',
        'O SSL está ativo (cadeado verde na barra de endereço)',
    ]))
    story.append(sp(3))

    story.append(Paragraph('9.2 — Criar o usuário Manager definitivo (se necessário)', S['h3']))
    story.append(Paragraph(
        'Se o Manager do cliente quiser usar o próprio email, repita o Passo 3 com o email '
        'definitivo dele. Você pode excluir o usuário de teste depois em '
        '<b>Authentication → Users</b> no Supabase.',
        S['body']
    ))
    story.append(sp(3))

    story.append(Paragraph('9.3 — Entregar as credenciais ao cliente', S['h3']))
    story.append(key_value_table([
        ('<b>URL do sistema</b>',   'A URL do Netlify ou o domínio personalizado configurado'),
        ('<b>Email do Manager</b>', 'O email cadastrado no Passo 3'),
        ('<b>Senha provisória</b>', 'A senha criada no Passo 3 (oriente o cliente a trocá-la no primeiro acesso via painel Supabase Authentication → Users → Reset password)'),
        ('<b>Documentação</b>',     'Envie o PDF de documentação do sistema (B2IF_PF_Documentacao.pdf) para o cliente ter a referência de uso'),
    ]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # REFERÊNCIA RÁPIDA
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph('Referência Rápida — Variáveis de Ambiente', S['h1']))
    story.append(hr(TEAL, 2))
    story.append(sp(2))
    story.append(Paragraph(
        'Conteúdo completo do arquivo .env para uma nova instância (substitua os valores):',
        S['body']
    ))
    story.append(sp(1))
    story.append(code_block([
        '# ─────────────────────────────────────────────────────────────',
        '# Planejador PF — .env para NOME DA EMPRESA',
        '# Gerado em: ' + datetime.date.today().strftime('%d/%m/%Y'),
        '# ─────────────────────────────────────────────────────────────',
        '',
        '# Supabase (obrigatório)',
        'VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co',
        'VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        '',
        '# Identidade visual',
        'VITE_APP_NAME=Nome da Empresa PF',
        'VITE_APP_SUBTITLE=Planejador Financeiro',
        'VITE_APP_COMPANY=Nome da Empresa Assessoria',
        'VITE_APP_TAGLINE=Sistema de Uso Interno',
        '',
        '# Marca',
        'VITE_BRAND_COLOR=#00B8A9',
        'VITE_LOGO_FILE=logo-empresa.png',
    ]))

    story.append(sp(4))

    # ══════════════════════════════════════════════════════════════════
    # SOLUÇÃO DE PROBLEMAS
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph('Solução de Problemas Comuns', S['h1']))
    story.append(hr(TEAL, 2))
    story.append(sp(2))

    problems = [
        ('"Usuário não encontrado no sistema"',
         'O usuário existe em Authentication mas não na tabela planejadores. '
         'Execute o INSERT do Passo 3.3 com o UUID correto.'),
        ('"Sem permissão" ao criar acesso de cliente',
         'A Edge Function admin-cliente não foi implantada ou falhou. '
         'Execute novamente: supabase functions deploy admin-cliente'),
        ('Logo não aparece (ícone quebrado)',
         'Verifique se o arquivo está em public/ com exatamente o nome definido em '
         'VITE_LOGO_FILE (incluindo maiúsculas/minúsculas).'),
        ('Cor da marca não mudou',
         'O build precisa ser refeito após alterar o .env: npm run build. '
         'Faça também um hard refresh no navegador (Ctrl+Shift+R).'),
        ('Tela em branco após o deploy',
         'Verifique se o arquivo dist/_redirects existe e contém: /* /index.html 200. '
         'No Netlify, confirme que o Publish directory está configurado como dist.'),
        ('Supabase parou de responder (plano Free)',
         'O Supabase pausa projetos Free após 7 dias sem acesso. '
         'Acesse o painel do projeto e clique em "Restore". Para evitar, upgrade para Pro ou '
         'acesse o sistema ao menos uma vez por semana.'),
        ('npm run build falha com "VITE_SUPABASE_URL is not defined"',
         'O arquivo .env não está na pasta raiz do projeto (junto com package.json). '
         'Verifique com: ls -la | grep .env'),
        ('Supabase CLI: "Error: Not linked to a Supabase project"',
         'Execute supabase link --project-ref SEU_PROJECT_ID na pasta do projeto. '
         'O Project ID está em Settings → General no painel do Supabase.'),
    ]
    for title, solution in problems:
        story.append(KeepTogether([
            Paragraph(f'❌  {title}', S['bold']),
            Paragraph(f'→  {solution}', S['body']),
            sp(2),
        ]))

    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════════
    # MANUTENÇÃO
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph('Atualizações e Manutenção', S['h1']))
    story.append(hr(TEAL, 2))
    story.append(sp(2))

    story.append(Paragraph('Atualizar o sistema para um cliente existente:', S['h3']))
    story.append(code_block([
        '# 1. Baixar as atualizações do repositório',
        'cd /caminho/para/b2if-pf',
        'git pull origin main',
        '',
        '# 2. O arquivo .env já está configurado — não precisa alterar',
        '',
        '# 3. Gerar novo build',
        'npm run build',
        '',
        '# 4. Republicar no Netlify',
        '# Opção A (drag-and-drop): arraste a nova pasta dist/ para o Netlify',
        '# Opção B (GitHub): o push já disparou o deploy automaticamente',
    ]))
    story.append(sp(3))

    story.append(Paragraph('Gerenciar múltiplos clientes', S['h3']))
    story.append(Paragraph(
        'Para organizar múltiplos clientes, recomendamos uma pasta de configurações fora do repositório:',
        S['body']
    ))
    story.append(sp(1))
    story.append(code_block([
        '# Estrutura sugerida fora do repositório:',
        'clientes/',
        '  empresa-abc/',
        '    .env            # credenciais e visual da empresa ABC',
        '    logo-abc.png    # logo da empresa ABC',
        '  empresa-xyz/',
        '    .env            # credenciais e visual da empresa XYZ',
        '    logo-xyz.png    # logo da empresa XYZ',
        '',
        '# Para fazer build do cliente ABC:',
        'cp clientes/empresa-abc/.env b2if-pf/.env',
        'cp clientes/empresa-abc/logo-abc.png b2if-pf/public/logo-abc.png',
        'cd b2if-pf && npm run build',
        '# → dist/ contém o build da empresa ABC',
    ]))
    story.append(sp(4))

    # ══════════════════════════════════════════════════════════════════
    # CHECKLIST FINAL
    # ══════════════════════════════════════════════════════════════════
    story.append(Paragraph('Checklist Completo de Implantação', S['h1']))
    story.append(hr(TEAL, 2))
    story.append(sp(2))

    summary_data = [
        ['Passo', 'Ação', 'Feito?', 'Tempo'],
        ['1', 'Criar projeto Supabase e coletar URL + anon key + Project ID', '□', '5 min'],
        ['2', 'Executar setup_supabase.sql no SQL Editor', '□', '5 min'],
        ['3A', 'Criar usuário Manager em Authentication → Users', '□', '3 min'],
        ['3B', 'Executar INSERT na tabela planejadores com UUID do Manager', '□', '2 min'],
        ['4A', 'npm install -g supabase && supabase login', '□', '3 min'],
        ['4B', 'supabase link --project-ref SEU_PROJECT_ID', '□', '2 min'],
        ['4C', 'supabase functions deploy admin-cliente', '□', '3 min'],
        ['5A', 'cp .env.example .env e preencher todas as variáveis', '□', '3 min'],
        ['5B', 'Copiar logo do cliente para public/', '□', '1 min'],
        ['6', 'npm run build (sem erros)', '□', '2 min'],
        ['7', 'Deploy da pasta dist/ no Netlify', '□', '5 min'],
        ['8', 'Configurar domínio personalizado (CNAME no DNS)', '□', '5 min'],
        ['9A', 'Testar login como Manager', '□', '2 min'],
        ['9B', 'Testar criação de planejador e cliente', '□', '2 min'],
        ['9C', 'Testar geração de PDF no Planejador', '□', '2 min'],
        ['9D', 'Entregar URL e credenciais ao cliente', '□', '—'],
    ]
    summary_table = Table(
        [[Paragraph(c, S['bold'] if i==0 else S['body_left']) for c in row]
         for i, row in enumerate(summary_data)],
        colWidths=[CONTENT_W*0.08, CONTENT_W*0.62, CONTENT_W*0.10, CONTENT_W*0.20]
    )
    summary_table.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0), TEAL),
        ('TEXTCOLOR',     (0,0), (-1,0), WHITE),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[GRAY_BG, WHITE]),
        ('BOX',   (0,0),(-1,-1), 0.5, GRAY_LINE),
        ('GRID',  (0,0),(-1,-1), 0.3, GRAY_LINE),
        ('TOPPADDING',    (0,0),(-1,-1), 5),
        ('BOTTOMPADDING', (0,0),(-1,-1), 5),
        ('LEFTPADDING',   (0,0),(-1,-1), 8),
        ('RIGHTPADDING',  (0,0),(-1,-1), 8),
        ('VALIGN', (0,0),(-1,-1),'MIDDLE'),
        ('ALIGN',  (2,0),(2,-1),'CENTER'),
        ('ALIGN',  (3,0),(3,-1),'CENTER'),
        ('FONTSIZE', (2,1),(2,-1), 14),
    ]))
    story.append(summary_table)
    story.append(sp(4))
    story.append(hr(TEAL, 1.5))
    story.append(sp(2))
    story.append(Paragraph(
        'Tempo total estimado: <b>~45 minutos</b> para o primeiro cliente · '
        '<b>~20 minutos</b> a partir do segundo.',
        S['center']
    ))
    story.append(sp(1))
    story.append(Paragraph(
        'Dúvidas ou problemas? Consulte a seção "Solução de Problemas" ou entre em contato com o suporte técnico.',
        S['center']
    ))

    # ── Build ─────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=on_first_page, onLaterPages=on_page)
    print(f'PDF gerado: {path}')


if __name__ == '__main__':
    build_pdf('/home/user/webapp/b2if-pf/Guia_Implantacao_WhiteLabel.pdf')
