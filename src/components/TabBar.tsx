import { useStore } from '../store';
import { X, FileText } from 'lucide-react';

export function TabBar() {
  const { state, dispatch } = useStore();
  const { openTabs, activeNoteId, notes } = state;

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center overflow-x-auto shrink-0" style={{ background: '#181825', borderBottom: '1px solid #232334' }}>
      {openTabs.map(tabId => {
        const note = notes.find(n => n.id === tabId);
        if (!note) return null;
        const isActive = tabId === activeNoteId;
        return (
          <div
            key={tabId}
            className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer group shrink-0 transition-colors text-xs"
            style={{
              background: isActive ? '#1e1e2e' : 'transparent',
              color: isActive ? '#cdd6f4' : '#6c7086',
              borderRight: '1px solid #232334',
              borderBottom: isActive ? '2px solid #7c6df2' : '2px solid transparent',
            }}
            onClick={() => dispatch({ type: 'OPEN_TAB', payload: tabId })}
            onMouseEnter={e => {
              if (!isActive) { e.currentTarget.style.background = '#1e1e2e'; e.currentTarget.style.color = '#a6adc8'; }
            }}
            onMouseLeave={e => {
              if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6c7086'; }
            }}
          >
            <FileText size={11} style={{ color: isActive ? '#7c6df2' : '#45475a' }} />
            <span className="max-w-[120px] truncate">{note.title}</span>
            {isActive && note.content !== undefined && (
              <span className="w-1 h-1 rounded-full" style={{ background: '#7c6df2' }} />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'CLOSE_TAB', payload: tabId });
              }}
              className="ml-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
              style={{ color: '#6c7086' }}
              onMouseEnter={e => e.currentTarget.style.color = '#cdd6f4'}
              onMouseLeave={e => e.currentTarget.style.color = '#6c7086'}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
