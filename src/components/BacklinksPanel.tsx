import { useStore } from '../store';
import { ArrowRight, Link } from 'lucide-react';

export function BacklinksPanel() {
  const { state, dispatch, getBacklinks, extractLinks, getNoteByTitle } = useStore();
  const { activeNoteId, notes } = state;

  if (!activeNoteId) return null;

  const activeNote = notes.find(n => n.id === activeNoteId);
  if (!activeNote) return null;

  const backlinks = getBacklinks(activeNoteId);
  const outgoingLinks = extractLinks(activeNote.content);
  const outgoingNotes = outgoingLinks
    .map(title => getNoteByTitle(title))
    .filter((n): n is NonNullable<typeof n> => n !== undefined);

  return (
    <div className="flex flex-col shrink-0 overflow-hidden" style={{ width: 220, background: '#181825', borderLeft: '1px solid #232334' }}>
      <div className="px-3 py-2.5" style={{ borderBottom: '1px solid #232334' }}>
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#6c7086' }}>Backlinks</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {backlinks.length === 0 ? (
          <div className="px-3 py-6 text-center text-[10px]" style={{ color: '#313244' }}>No backlinks yet</div>
        ) : (
          backlinks.map(note => (
            <div
              key={note.id}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-xs"
              style={{ color: '#a6adc8' }}
              onClick={() => dispatch({ type: 'OPEN_TAB', payload: note.id })}
              onMouseEnter={e => { e.currentTarget.style.background = '#1e1e2e'; e.currentTarget.style.color = '#cdd6f4'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a6adc8'; }}
            >
              <ArrowRight size={10} style={{ color: '#7c6df2' }} className="shrink-0" />
              <span className="truncate">{note.title}</span>
            </div>
          ))
        )}
      </div>

      {outgoingNotes.length > 0 && (
        <>
          <div className="px-3 py-2.5" style={{ borderTop: '1px solid #232334', borderBottom: '1px solid #232334' }}>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#6c7086' }}>Outgoing</h3>
          </div>
          <div className="overflow-y-auto">
            {outgoingNotes.map(note => (
              <div
                key={note.id}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-xs"
                style={{ color: '#a6adc8' }}
                onClick={() => dispatch({ type: 'OPEN_TAB', payload: note.id })}
                onMouseEnter={e => { e.currentTarget.style.background = '#1e1e2e'; e.currentTarget.style.color = '#cdd6f4'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a6adc8'; }}
              >
                <Link size={10} style={{ color: '#45475a' }} className="shrink-0" />
                <span className="truncate">{note.title}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
