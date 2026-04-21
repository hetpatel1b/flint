import { useState } from 'react';
import { useStore } from '../store';
import {
  ChevronRight, ChevronDown, FileText, FolderPlus, Plus, Trash2, Pin, LogOut, Search,
} from 'lucide-react';

export function Sidebar() {
  const { state, dispatch, createNote, closeVault } = useStore();
  const { notes, folders, activeNoteId } = state;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'note' | 'folder'; id: string } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  const pinnedNotes = notes.filter(n => n.pinned);
  const rootNotes = notes.filter(n => !n.folderId && !n.pinned);
  const getFolderNotes = (folderId: string) => notes.filter(n => n.folderId === folderId);

  const handleContextMenu = (e: React.MouseEvent, type: 'note' | 'folder', id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id });
  };

  const closeContextMenu = () => setContextMenu(null);

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden select-none"
      style={{ width: 250, background: '#0d0d0d', borderRight: '1px solid #1a1a1a' }}
      onClick={closeContextMenu}
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid #1a1a1a' }}>
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 32 32" fill="none">
            <path d="M16 3L6 9v14l10 6 10-6V9L16 3z" fill="#1a1a1a" stroke="#444" strokeWidth="2"/>
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#555' }}>Explorer</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => createNote()} className="p-1 rounded transition-colors" style={{ color: '#555' }} onMouseEnter={e => e.currentTarget.style.color = '#aaa'} onMouseLeave={e => e.currentTarget.style.color = '#555'} title="New note">
            <Plus size={13} />
          </button>
          <button onClick={() => setShowNewFolder(true)} className="p-1 rounded transition-colors" style={{ color: '#555' }} onMouseEnter={e => e.currentTarget.style.color = '#aaa'} onMouseLeave={e => e.currentTarget.style.color = '#555'} title="New folder">
            <FolderPlus size={13} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5">
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-[11px] transition-colors"
          style={{ background: '#0a0a0a', color: '#444', border: '1px solid #1a1a1a' }}
          onClick={() => dispatch({ type: 'TOGGLE_SEARCH' })}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a2a'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#1a1a1a'}
        >
          <Search size={10} />
          <span>Quick search...</span>
          <span className="ml-auto text-[8px]" style={{ color: '#333' }}>⇧⌘F</span>
        </div>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="px-2 py-1">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFolderName.trim()) {
                dispatch({ type: 'ADD_FOLDER', payload: { id: Math.random().toString(36).substring(2, 11), name: newFolderName.trim(), parentId: null, collapsed: false } });
                setNewFolderName('');
                setShowNewFolder(false);
              }
              if (e.key === 'Escape') { setNewFolderName(''); setShowNewFolder(false); }
            }}
            placeholder="Folder name..."
            className="w-full rounded px-2 py-1 text-[11px] outline-none"
            style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#bbb' }}
            autoFocus
          />
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-0.5">
        {pinnedNotes.length > 0 && (
          <div className="mb-0.5">
            <div className="flex items-center gap-1.5 px-3 py-1 text-[9px] font-semibold uppercase tracking-widest" style={{ color: '#333' }}>
              <Pin size={7} />
              Pinned
            </div>
            {pinnedNotes.map(note => (
              <NoteItem key={note.id} note={note} isActive={note.id === activeNoteId} onClick={() => dispatch({ type: 'OPEN_TAB', payload: note.id })} onContextMenu={(e) => handleContextMenu(e, 'note', note.id)} />
            ))}
          </div>
        )}

        {rootNotes.map(note => (
          <NoteItem key={note.id} note={note} isActive={note.id === activeNoteId} onClick={() => dispatch({ type: 'OPEN_TAB', payload: note.id })} onContextMenu={(e) => handleContextMenu(e, 'note', note.id)} />
        ))}

        {folders.map(folder => {
          const folderNotes = getFolderNotes(folder.id);
          return (
            <div key={folder.id} className="mb-0.5">
              <div
                className="flex items-center gap-1 px-3 py-1 text-[11px] cursor-pointer transition-colors"
                style={{ color: '#777' }}
                onClick={() => dispatch({ type: 'TOGGLE_FOLDER', payload: folder.id })}
                onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
                onMouseEnter={e => e.currentTarget.style.background = '#111'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {folder.collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                <span className="truncate flex-1">{folder.name}</span>
                <span className="text-[8px]" style={{ color: '#333' }}>{folderNotes.length}</span>
              </div>
              {!folder.collapsed && folderNotes.map(note => (
                <NoteItem key={note.id} note={note} isActive={note.id === activeNoteId} onClick={() => dispatch({ type: 'OPEN_TAB', payload: note.id })} onContextMenu={(e) => handleContextMenu(e, 'note', note.id)} indent />
              ))}
            </div>
          );
        })}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div className="fixed z-50 rounded-lg py-1 text-[11px] min-w-[140px]" style={{ background: '#151515', border: '1px solid #222', left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.type === 'note' ? (
            <>
              <button onClick={() => { dispatch({ type: 'PIN_NOTE', payload: contextMenu.id }); closeContextMenu(); }} className="w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors" style={{ color: '#888' }} onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Pin size={10} /> Pin/Unpin
              </button>
              <button onClick={() => { dispatch({ type: 'DELETE_NOTE', payload: contextMenu.id }); closeContextMenu(); }} className="w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors" style={{ color: '#666' }} onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Trash2 size={10} /> Delete
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { createNote(contextMenu.id); closeContextMenu(); }} className="w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors" style={{ color: '#888' }} onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Plus size={10} /> New note
              </button>
              <button onClick={() => { dispatch({ type: 'DELETE_FOLDER', payload: contextMenu.id }); closeContextMenu(); }} className="w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors" style={{ color: '#666' }} onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Trash2 size={10} /> Delete folder
              </button>
            </>
          )}
        </div>
      )}

      {/* Close vault */}
      <div className="p-1.5" style={{ borderTop: '1px solid #1a1a1a' }}>
        <button
          onClick={closeVault}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors"
          style={{ color: '#444' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.color = '#888'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#444'; }}
        >
          <LogOut size={10} /> Close vault
        </button>
      </div>
    </div>
  );
}

function NoteItem({ note, isActive, onClick, onContextMenu, indent }: {
  note: { id: string; title: string }; isActive: boolean; onClick: () => void; onContextMenu: (e: React.MouseEvent) => void; indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-[3px] text-[11px] cursor-pointer transition-colors ${indent ? 'pl-7' : ''}`}
      style={{ background: isActive ? '#151515' : 'transparent', color: isActive ? '#ccc' : '#777' }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#111'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <FileText size={11} style={{ color: isActive ? '#777' : '#3a3a3a', flexShrink: 0 }} />
      <span className="truncate">{note.title}</span>
    </div>
  );
}
