import { useStore } from '../store';
import { Lock } from 'lucide-react';

export function StatusBar() {
  const { state } = useStore();
  const { activeNoteId, notes, viewMode } = state;
  const activeNote = notes.find(n => n.id === activeNoteId);

  return (
    <div className="flex items-center justify-between px-3 py-1 shrink-0 select-none text-[10px]" style={{ background: '#181825', borderTop: '1px solid #232334', color: '#45475a' }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <svg width="10" height="10" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L4 10v12l12 8 12-8V10L16 2z" fill="#2a2a3c" stroke="#7c6df2" strokeWidth="2.5"/>
          </svg>
          <span style={{ color: '#6c7086' }}>Flint</span>
        </div>
        <div className="flex items-center gap-1">
          <Lock size={8} style={{ color: '#a6e3a1' }} />
          <span>Local vault</span>
        </div>
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
