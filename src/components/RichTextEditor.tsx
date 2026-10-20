/**
 * Tiptap editor for editor-authored HTML. Loaded lazily (see LazyRichTextEditor) so the
 * ProseMirror bundle only downloads when someone opens an edit modal.
 *
 * Uncontrolled: `value` seeds the document on mount; remount with a new `key` to reset it.
 */
import React, { useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export interface RichTextEditorProps {
  /** Initial HTML. */
  value: string;
  onChange: (html: string) => void;
  /** 'bullets' keeps the content a single bullet list (homepage cards). */
  variant?: 'bullets' | 'paragraphs';
  placeholder?: string;
  ariaLabel?: string;
}

const normalizeUrl = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^(https?:|mailto:)/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  variant = 'paragraphs',
  ariaLabel,
}) => {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  // useEditor keeps its first onUpdate; read the latest callback through a ref.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
        },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'rte-content',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChangeRef.current(e.getHTML()),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      underline: e?.isActive('underline') ?? false,
      bulletList: e?.isActive('bulletList') ?? false,
      orderedList: e?.isActive('orderedList') ?? false,
      link: e?.isActive('link') ?? false,
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
    }),
  });

  if (!editor) return null;

  const openLink = () => {
    setLinkUrl(editor.getAttributes('link').href || '');
    setLinkError('');
    setLinkOpen(true);
  };

  const applyLink = () => {
    const href = normalizeUrl(linkUrl);
    if (!href) {
      setLinkError('Enter a web address, e.g. https://example.com');
      return;
    }
    const chain = editor.chain().focus().extendMarkRange('link');
    if (editor.state.selection.empty && !editor.isActive('link')) {
      // Nothing selected: insert the address itself as the link text.
      chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkOpen(false);
  };

  const button = (
    label: string,
    title: string,
    active: boolean,
    onClick: () => void,
    disabled = false
  ) => (
    <button
      type="button"
      className={`rte-btn${active ? ' is-active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting">
        {button('B', 'Bold', state.bold, () => editor.chain().focus().toggleBold().run())}
        {button('I', 'Italic', state.italic, () => editor.chain().focus().toggleItalic().run())}
        {button('U', 'Underline', state.underline, () => editor.chain().focus().toggleUnderline().run())}
        {variant === 'paragraphs' && (
          <>
            <span className="rte-sep" aria-hidden="true" />
            {button('• List', 'Bulleted list', state.bulletList, () =>
              editor.chain().focus().toggleBulletList().run()
            )}
            {button('1. List', 'Numbered list', state.orderedList, () =>
              editor.chain().focus().toggleOrderedList().run()
            )}
          </>
        )}
        <span className="rte-sep" aria-hidden="true" />
        {button('🔗 Link', state.link ? 'Edit link' : 'Add link', state.link || linkOpen, openLink)}
        <span className="rte-sep" aria-hidden="true" />
        {button('↶', 'Undo', false, () => editor.chain().focus().undo().run(), !state.canUndo)}
        {button('↷', 'Redo', false, () => editor.chain().focus().redo().run(), !state.canRedo)}
      </div>

      {linkOpen && (
        <div className="rte-link-row">
          <input
            type="url"
            value={linkUrl}
            placeholder="https://…"
            autoFocus
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              } else if (e.key === 'Escape') {
                setLinkOpen(false);
              }
            }}
          />
          <button type="button" className="rte-link-apply" onClick={applyLink}>
            Apply
          </button>
          {state.link && (
            <button type="button" className="rte-link-remove" onClick={removeLink}>
              Remove
            </button>
          )}
          <button type="button" className="rte-link-cancel" onClick={() => setLinkOpen(false)}>
            Cancel
          </button>
          {linkError && <span className="rte-link-error">{linkError}</span>}
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
