/**
 * NotasFloat — Bloco de notas flutuante arrastável com rich text (TipTap)
 *
 * Props:
 *   open        boolean  — visível ou não
 *   onClose     fn       — fecha a janela
 *   value       string   — conteúdo HTML das notas (clienteAtivo.notas)
 *   onChange    fn(html) — chamada com debounce 800ms ao editar
 *   clienteNome string   — nome do cliente para exibir no header
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { useEffect, useRef, useState, useCallback } from 'react';
import { FileText, X, XCircle } from 'lucide-react';
import { C, FONT, RADIUS, SHADOW } from '../design/tokens.js';

// ── Posição inicial e tamanho padrão da janela ────────────────────────────────
const W = 420;
const H = 500;
const POS_KEY = 'b2if_notas_pos';

function defaultPos() {
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY));
    if (saved?.x != null && saved?.y != null) return saved;
  } catch {}
  return {
    x: Math.max(0, window.innerWidth  - W - 32),
    y: Math.max(0, window.innerHeight - H - 60),
  };
}

// ── Cores pré-definidas para o color picker ───────────────────────────────────
const CORES_TEXTO = [
  { label: 'Padrão',    value: '' },
  { label: 'Branco',    value: '#E8EDF5' },
  { label: 'Amarelo',   value: '#FBBF24' },
  { label: 'Verde',     value: '#22D3A0' },
  { label: 'Vermelho',  value: '#F87171' },
  { label: 'Azul',      value: '#60A5FA' },
  { label: 'Roxo',      value: '#C084FC' },
  { label: 'Laranja',   value: '#FB923C' },
  { label: 'Cinza',     value: '#7A90B0' },
];

const CORES_HIGHLIGHT = [
  { label: 'Nenhum',    value: null },
  { label: 'Amarelo',   value: '#7c6a00' },
  { label: 'Verde',     value: '#0a3d2a' },
  { label: 'Azul',      value: '#0f2a50' },
  { label: 'Vermelho',  value: '#4a0f0f' },
  { label: 'Roxo',      value: '#2d1a4a' },
];

// ── Botão da toolbar ──────────────────────────────────────────────────────────
function ToolBtn({ onClick, active, title, children, style = {} }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick?.(); }}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26, height: 26, border: 'none', borderRadius: RADIUS.sm,
        background: active ? C.brand + '30' : hover ? C.border : 'transparent',
        color: active ? C.brand : C.textMuted,
        cursor: 'pointer', fontSize: 12, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background .12s, color .12s',
        flexShrink: 0,
        ...style,
      }}
    >{children}</button>
  );
}

// ── Separador vertical ────────────────────────────────────────────────────────
function Sep() {
  return <div style={{ width: 1, height: 16, background: C.border, margin: '0 2px', flexShrink: 0 }} />;
}

// ── Dropdown de cores ─────────────────────────────────────────────────────────
function ColorPicker({ cores, valorAtivo, onSelecionar, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const fechar = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <ToolBtn onClick={() => setOpen(o => !o)} active={open} title="Selecionar cor">
        {children}
      </ToolBtn>
      {open && (
        <div style={{
          position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)',
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: RADIUS.md, padding: 8, zIndex: 9999,
          display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110,
          boxShadow: SHADOW.modal,
        }}>
          {cores.map(c => (
            <button
              key={c.label}
              onMouseDown={e => { e.preventDefault(); onSelecionar(c.value); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', background: 'transparent', border: 'none',
                borderRadius: RADIUS.sm, cursor: 'pointer', width: '100%',
                color: C.text, fontSize: FONT.xs,
                outline: (valorAtivo === c.value || (!valorAtivo && !c.value)) ? `1px solid ${C.brand}` : 'none',
              }}
            >
              <span style={{
                width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                background: c.value || 'transparent',
                border: c.value ? 'none' : `1px solid ${C.border}`,
              }} />
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Toolbar do editor ─────────────────────────────────────────────────────────
function Toolbar({ editor }) {
  if (!editor) return null;

  const corAtual = editor.getAttributes('textStyle').color || '';
  const highlightAtual = editor.getAttributes('highlight').color || null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
      padding: '5px 8px', borderBottom: `1px solid ${C.border}`,
      background: C.bgMid,
    }}>
      {/* Texto */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')} title="Negrito (Ctrl+B)">
        <strong>B</strong>
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')} title="Itálico (Ctrl+I)">
        <em>I</em>
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')} title="Sublinhado (Ctrl+U)">
        <span style={{ textDecoration: 'underline' }}>U</span>
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')} title="Tachado">
        <span style={{ textDecoration: 'line-through' }}>S</span>
      </ToolBtn>

      <Sep />

      {/* Tamanho do texto via heading */}
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })} title="Título grande">
        H1
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })} title="Título médio">
        H2
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })} title="Título pequeno">
        H3
      </ToolBtn>

      <Sep />

      {/* Cor do texto */}
      <ColorPicker
        cores={CORES_TEXTO}
        valorAtivo={corAtual}
        onSelecionar={v => {
          if (!v) editor.chain().focus().unsetColor().run();
          else editor.chain().focus().setColor(v).run();
        }}
      >
        <span style={{ position: 'relative', lineHeight: 1 }}>
          A
          <span style={{
            position: 'absolute', bottom: -3, left: 0, right: 0, height: 2,
            background: corAtual || C.textMuted, borderRadius: 1,
          }} />
        </span>
      </ColorPicker>

      {/* Highlight / sombreamento */}
      <ColorPicker
        cores={CORES_HIGHLIGHT}
        valorAtivo={highlightAtual}
        onSelecionar={v => {
          if (!v) editor.chain().focus().unsetHighlight().run();
          else editor.chain().focus().setHighlight({ color: v }).run();
        }}
      >
        <span style={{
          background: highlightAtual || 'transparent',
          border: highlightAtual ? 'none' : `1px solid ${C.textMuted}`,
          borderRadius: 2, padding: '0 2px', lineHeight: 1.2,
          fontSize: 10,
        }}>ab</span>
      </ColorPicker>

      <Sep />

      {/* Listas */}
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')} title="Lista com marcadores">
        ≡
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')} title="Lista numerada">
        1≡
      </ToolBtn>

      <Sep />

      {/* Alinhamento */}
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })} title="Alinhar à esquerda">
        ◧
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })} title="Centralizar">
        ◫
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })} title="Alinhar à direita">
        ◨
      </ToolBtn>

      <Sep />

      {/* Limpar formatação */}
      <ToolBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Limpar formatação">
        <XCircle size={12} />
      </ToolBtn>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function NotasFloat({ open, onClose, value, onChange, clienteNome, onForceSave }) {
  // ── Posição (arrastável) ───────────────────────────────────────────────────
  const [pos, setPos] = useState(defaultPos);
  const dragging = useRef(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  // salva posição no localStorage ao mover
  const savePos = useCallback((p) => {
    setPos(p);
    try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {}
  }, []);

  const onHeaderMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const nx = Math.max(0, Math.min(window.innerWidth  - W, e.clientX - dragOffset.current.dx));
      const ny = Math.max(0, Math.min(window.innerHeight - H, e.clientY - dragOffset.current.dy));
      savePos({ x: nx, y: ny });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [savePos]);

  // ── Auto-save com debounce ─────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  const debounceRef = useRef(null);
  const editorRef   = useRef(null); // ref para acessar editor fora do closure

  const handleUpdate = useCallback(({ editor }) => {
    editorRef.current = editor;
    setSaveStatus('dirty');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(editor.getHTML());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  }, [onChange]);

  // BUG4 FIX: flush imediato ao fechar — garante que notas pendentes sejam salvas
  // antes do componente desmontar, mesmo que o debounce de 800ms ainda não disparou
  const handleClose = useCallback(async () => {
    if (saveStatus === 'dirty' && editorRef.current) {
      clearTimeout(debounceRef.current);
      const html = editorRef.current.getHTML();
      onChange(html);                         // atualiza estado React imediatamente
      setSaveStatus('saving');
      try {
        if (onForceSave) await onForceSave(); // persiste no banco imediatamente
        setSaveStatus('saved');
        setTimeout(() => { setSaveStatus('idle'); onClose(); }, 600);
      } catch {
        setSaveStatus('error');
        setTimeout(() => { setSaveStatus('idle'); onClose(); }, 1200);
      }
    } else {
      onClose();
    }
  }, [saveStatus, onChange, onForceSave, onClose]);

  // Botão salvar manual das notas
  const handleSaveBtn = useCallback(async () => {
    if (!editorRef.current) return;
    clearTimeout(debounceRef.current);
    const html = editorRef.current.getHTML();
    onChange(html);
    setSaveStatus('saving');
    try {
      if (onForceSave) await onForceSave();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [onChange, onForceSave]);

  // ── Editor TipTap ──────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate: handleUpdate,
    editorProps: {
      attributes: {
        style: [
          'outline: none',
          'min-height: 200px',
          'padding: 12px 14px',
          'color: #111827',
          `font-size: ${FONT.base}`,
          `font-family: 'Inter', system-ui, sans-serif`,
          'line-height: 1.65',
        ].join(';'),
      },
    },
  });

  // Sincroniza conteúdo externo quando o cliente muda
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '';
    if (current !== incoming) {
      editor.commands.setContent(incoming, false);
    }
  }, [value, editor]);

  if (!open) return null;

  return (
    <>
      {/* CSS injetado para o editor */}
      <style>{`
        .notas-editor .ProseMirror { outline: none; }
        .notas-editor .ProseMirror h1 { font-size: 20px; font-weight: 700; margin: 8px 0 4px; }
        .notas-editor .ProseMirror h2 { font-size: 16px; font-weight: 700; margin: 6px 0 3px; }
        .notas-editor .ProseMirror h3 { font-size: 14px; font-weight: 700; margin: 4px 0 2px; }
        .notas-editor .ProseMirror p  { margin: 0 0 4px; }
        .notas-editor .ProseMirror ul { list-style: disc;    padding-left: 20px; margin: 4px 0; }
        .notas-editor .ProseMirror ol { list-style: decimal; padding-left: 20px; margin: 4px 0; }
        .notas-editor .ProseMirror li { margin: 2px 0; }
        .notas-editor .ProseMirror mark { border-radius: 3px; padding: 0 2px; }
        .notas-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          width: W,
          height: H,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          background: C.card,
          border: `1px solid ${C.borderLight}`,
          borderRadius: RADIUS.lg,
          boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          userSelect: dragging.current ? 'none' : 'auto',
        }}
      >
        {/* ── Header (drag handle) ──────────────────────────────────────────── */}
        <div
          onMouseDown={onHeaderMouseDown}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '0 12px', height: 40, flexShrink: 0,
            background: C.bgMid,
            borderBottom: `1px solid ${C.border}`,
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <FileText size={14} color={C.textMuted} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: FONT.sm, fontWeight: 700, color: C.text }}>Notas</span>
            {clienteNome && (
              <span style={{ fontSize: FONT.xs, color: C.textMuted, marginLeft: 6 }}>
                — {clienteNome}
              </span>
            )}
          </div>

          {/* Status de salvamento */}
          <span style={{
            fontSize: FONT.xs,
            color: saveStatus === 'saved'  ? C.rec
                 : saveStatus === 'saving' ? C.brand
                 : saveStatus === 'error'  ? '#F87171'
                 : saveStatus === 'dirty'  ? C.warn
                 : 'transparent',
            transition: 'color .3s',
            marginRight: 4,
          }}>
            {saveStatus === 'saved'  ? '✓ Salvo'
           : saveStatus === 'saving' ? 'Salvando...'
           : saveStatus === 'error'  ? '✗ Erro ao salvar'
           : saveStatus === 'dirty'  ? '● Não salvo'
           : ''}
          </span>

          {/* Botão Salvar manual */}
          {(saveStatus === 'dirty' || saveStatus === 'error') && (
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={handleSaveBtn}
              style={{
                padding: '3px 10px', border: `1px solid ${C.brand}`,
                borderRadius: RADIUS.sm, background: C.brand + '18',
                color: C.brand, cursor: 'pointer', fontSize: FONT.xs,
                fontWeight: 700, fontFamily: "'Inter',sans-serif",
                marginRight: 4,
              }}
              title="Salvar notas agora"
            >Salvar</button>
          )}

          {/* Fechar */}
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={handleClose}
            style={{
              width: 22, height: 22, border: 'none', borderRadius: RADIUS.sm,
              background: 'transparent', color: C.textMuted, cursor: 'pointer',
              fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .12s, color .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.desp + '30'; e.currentTarget.style.color = C.desp; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textMuted; }}
            title="Fechar (salva automaticamente)"
          ><X size={13} /></button>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────────────────── */}
        <Toolbar editor={editor} />

        {/* ── Área de edição ────────────────────────────────────────────────── */}
        <div
          className="notas-editor"
          style={{
            flex: 1,
            overflowY: 'auto',
            background: '#ffffff',
          }}
          onClick={() => editor?.commands.focus()}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}
