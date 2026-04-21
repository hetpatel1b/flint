import { useStore } from '../store';
import { Lock, Check, Loader } from 'lucide-react';

export function StatusBar() {
  const { state } = useStore();
  const { activeNoteId, notes, viewMode, lastSaved } = state;
  const activeNote = notes.find(n => n.id === activeNoteId);

  // Show save status
  const isSaved = lastSaved && (Date.now() - lastSaved < 3000);
  // isSaving = !lastSaved || (Date.now() - lastSaved >= 3000);

  return (
    <div className="flex items-center justify-between px-3 py-[3px] shrink-0 select-none text-[9px]" style={{ background: '#080808', borderTop: '1px solid #1a1a1a', color: '#444' }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <svg width="9" height="9" viewBox="0 0 32 32" fill="none">
            <path d="M16 3L6 9v14l10 6 10-6V9L16 3z" fill="#1a1a1a" stroke="#444" strokeWidth="2"/>
          </svg>
          <span style={{ color: '#555' }}>Flint</span>
        </div>
        <div className="flex items-center gap-1">
          <Lock size={7} style={{ color: '#555' }} />
          <span>Local vault</span>
        </div>
        {activeNote && (
          <div className="flex items-center gap-1">
            {isSaved ? (
              <>
                <Check size={7} style={{ color: '#555' }} />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Loader size={7} className="animate-pulse-slow" style={{ color: '#444' }} />
                <span>Auto-saving</span>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {activeNote && (
          <>
            <span>{activeNote.content.split(/\s+/).filter(Boolean).length} words</span>
            <span>{activeNote.content.length} chars</span>
          </>
        )}
        <span className="capitalize">{viewMode}</span>
      </div>
    </div>
  );
}
