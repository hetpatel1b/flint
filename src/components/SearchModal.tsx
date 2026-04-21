import { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Search, FileText } from 'lucide-react';

export function SearchModal() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = query.trim()
    ? state.notes.filter(n =>
        n.title.toLowerCase().includes(query.toLowerCase()) ||
        n.content.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      dispatch({ type: 'OPEN_TAB', payload: results[selectedIndex].id });
      dispatch({ type: 'TOGGLE_SEARCH' });
    } else if (e.key === 'Escape') {
      dispatch({ type: 'TOGGLE_SEARCH' });
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => dispatch({ type: 'TOGGLE_SEARCH' })} />
      <div className="relative w-full max-w-lg rounded-lg shadow-2xl overflow-hidden animate-slide-in" style={{ background: '#1e1e2e', border: '1px solid #313244' }}>
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #232334' }}>
          <Search size={14} style={{ color: '#6c7086' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-[#45475a]"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#45475a', background: '#181825' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto">
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-xs" style={{ color: '#45475a' }}>
              No results for "{query}"
            </div>
          )}
          {results.map((note, idx) => (
            <div
              key={note.id}
              className="flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors"
              style={{
                background: idx === selectedIndex ? 'rgba(124,109,242,0.1)' : 'transparent',
                color: idx === selectedIndex ? '#cdd6f4' : '#a6adc8',
              }}
              onClick={() => {
                dispatch({ type: 'OPEN_TAB', payload: note.id });
                dispatch({ type: 'TOGGLE_SEARCH' });
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <FileText size={12} style={{ color: idx === selectedIndex ? '#7c6df2' : '#45475a' }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{note.title}</div>
                {note.content && (
                  <div className="text-[10px] truncate mt-0.5" style={{ color: '#45475a' }}>
                    {note.content.substring(0, 80).replace(/[#*_\[\]]/g, '')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 flex items-center gap-3 text-[10px]" style={{ borderTop: '1px solid #232334', color: '#45475a' }}>
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>Esc Close</span>
            <span className="ml-auto">{results.length} result{results.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
