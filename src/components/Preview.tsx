import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore } from '../store';

export function Preview({ noteId }: { noteId: string }) {
  const { state, dispatch, getNoteByTitle, createNote } = useStore();
  const note = state.notes.find(n => n.id === noteId);

  const processedContent = useMemo(() => {
    if (!note) return '';
    return note.content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, alias) => {
      const display = alias || target;
      const exists = getNoteByTitle(target.trim());
      return `<span class="wiki-link ${exists ? '' : 'unresolved'}" data-target="${target.trim()}">${display}</span>`;
    });
  }, [note, getNoteByTitle]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('wiki-link')) {
      const linkTarget = target.getAttribute('data-target');
      if (linkTarget) {
        const existingNote = getNoteByTitle(linkTarget);
        if (existingNote) {
          dispatch({ type: 'OPEN_TAB', payload: existingNote.id });
        } else {
          createNote(null, linkTarget);
        }
      }
    }
  };

  if (!note) return null;

  return (
    <div className="flint-preview" onClick={handleClick}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          input: ({ ...props }) => <input {...props} style={{ accentColor: '#7c6df2' }} />,
          pre: ({ children }) => (
            <pre style={{ background: '#11111b', border: '1px solid #2a2a3c', borderRadius: 6, padding: 16, overflowX: 'auto', margin: '1em 0' }}>
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code style={{ background: '#313244', color: '#7c6df2', padding: '0.15em 0.4em', borderRadius: 3, fontSize: '0.875em', fontFamily: 'monospace' }}>
                {children}
              </code>
            ) : (
              <code style={{ fontSize: 13, lineHeight: 1.6, fontFamily: 'monospace' }}>{children}</code>
            );
          },
          a: ({ href, children }) => (
            <a href={href} style={{ color: '#7c6df2', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote style={{ borderLeft: '3px solid #7c6df2', background: 'rgba(124,109,242,0.05)', padding: '0.5em 1em', margin: '1em 0', borderRadius: '0 4px 4px 0', color: '#a6adc8' }}>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '1em 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th style={{ background: '#11111b', textAlign: 'left', padding: '8px 12px', border: '1px solid #2a2a3c', fontWeight: 600, color: '#cdd6f4', fontSize: 12 }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ padding: '8px 12px', border: '1px solid #2a2a3c', color: '#a6adc8' }}>
              {children}
            </td>
          ),
          hr: () => <hr style={{ border: 'none', borderTop: '1px solid #2a2a3c', margin: '2em 0' }} />,
        }}
        allowedElements={['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'input', 'span', 'div']}
        rehypePlugins={[]}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
