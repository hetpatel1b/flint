import { useState } from 'react';
import { useStore } from '../store';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FolderPlus,
  Plus,
  Trash2,
  Pin,
  LogOut,
  Search,
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

  const handleCreateNote = (folderId?: string | null) => {
    createNote(folderId);
  };

  const closeContextMenu = () => setContextMenu(null);

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden select-none"
      style={{ width: 260, background: '#181825', borderRight: '1px solid #232334' }}
      onClick={closeContextMenu}
    >
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #232334' }}>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L4 10v12l12 8 12-8V10L16 2z" fill="#2a2a3c" stroke="#7c6df2" strokeWidth="2"/>
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6c7086' }}>Files</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleCreateNote()}
            className="p-1 rounded transition-colors"
            style={{ color: '#6c7086' }}
            onMouseEnter={e => e.currentTarget.style.color = '#cdd6f4'}
            onMouseLeave={e => e.currentTarget.style.color = '#6c7086'}
            title="New note"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setShowNewFolder(true)}
            className="p-1 rounded transition-colors"
            style={{ color: '#6c7086' }}
            onMouseEnter={e => e.currentTarget.style.color = '#cdd6f4'}
            onMouseLeave={e => e.currentTarget.style.color = '#6c7086'}
            title="New folder"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      {/* Quick search */}
      <div className="px-2 py-1.5">
        <div
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs transition-colors"
          style={{ background: '#11111b', color: '#6c7086', border: '1px solid #232334' }}
          onClick={() => dispatch({ type: 'TOGGLE_SEARCH' })}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#313244'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#232334'}
        >
          <Search size={11} />
          <span>Quick search...</span>
          <span className="ml-auto text-[9px]" style={{ color: '#45475a' }}>Ctrl+Shift+F</span>
        </div>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="px-2 py-1.5">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFolderName.trim()) {
                dispatch({
                  type: 'ADD_FOLDER',
                  payload: {
                    id: Math.random().toString(36).substring(2, 11),
                    name: newFolderName.trim(),
                    parentId: null,
                    collapsed: false,
                  },
                });
                setNewFolderName('');
                setShowNewFolder(false);
              }
              if (e.key === 'Escape') {
                setNewFolderName('');
                setShowNewFolder(false);
              }
            }}
            placeholder="Folder name..."
            className="w-full rounded px-2 py-1.5 text-xs text-white outline-none"
            style={{ background: '#11111b', border: '1px solid #313244' }}
            autoFocus
          />
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-0.5">
        {/* Pinned section */}
        {pinnedNotes.length > 0 && (
          <div className="mb-0.5">
            <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#45475a' }}>
              <Pin size={8} />
              Pinned
            </div>
            {pinnedNotes.map(note => (
              <NoteItem
                key={note.id}
                note={note}
                isActive={note.id === activeNoteId}
                onClick={() => dispatch({ type: 'OPEN_TAB', payload: note.id })}
                onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
              />
            ))}
          </div>
        )}

        {/* Root notes */}
        {rootNotes.map(note => (
          <NoteItem
            key={note.id}
            note={note}
            isActive={note.id === activeNoteId}
            onClick={() => dispatch({ type: 'OPEN_TAB', payload: note.id })}
            onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
          />
        ))}

        {/* Folders */}
        {folders.map(folder => {
          const folderNotes = getFolderNotes(folder.id);
          return (
            <div key={folder.id} className="mb-0.5">
              <div
                className="flex items-center gap-1 px-3 py-1 text-xs cursor-pointer transition-colors group"
                style={{ color: '#a6adc8' }}
                onClick={() => dispatch({ type: 'TOGGLE_FOLDER', payload: folder.id })}
                onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
                onMouseEnter={e => e.currentTarget.style.background = '#1e1e2e'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {folder.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span className="truncate flex-1">{folder.name}</span>
                <span className="text-[9px]" style={{ color: '#45475a' }}>{folderNotes.length}</span>
              </div>
              {!folder.collapsed && folderNotes.map(note => (
                <NoteItem
                  key={note.id}
                  note={note}
                  isActive={note.id === activeNoteId}
                  onClick={() => dispatch({ type: 'OPEN_TAB', payload: note.id })}
                  onContextMenu={(e) => handleContextMenu(e, 'note', note.id)}
                  indent
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Close vault */}
      <div className="p-1.5" style={{ borderTop: '1px solid #232334' }}>
        <button
          onClick={closeVault}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors"
          style={{ color: '#6c7086' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1e1e2e'; e.currentTarget.style.color = '#cdd6f4'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6c7086'; }}
        >
          <LogOut size={11} />
          Close vault
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed rounded-lg shadow-2xl py-1 z-[200] min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y, background: '#1e1e2e', border: '1px solid #313244' }}
        >
          {contextMenu.type === 'note' && (
            <>
              <button
                onClick={() => {
                  dispatch({ type: 'PIN_NOTE', payload: contextMenu.id });
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                style={{ color: '#a6adc8' }}
                onMouseEnter={e => e.currentTarget.style.background = '#252536'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Pin size={11} />
                {notes.find(n => n.id === contextMenu.id)?.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                onClick={() => {
                  dispatch({ type: 'DELETE_NOTE', payload: contextMenu.id });
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                style={{ color: '#f38ba8' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(243,139,168,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Trash2 size={11} />
                Delete
              </button>
            </>
          )}
          {contextMenu.type === 'folder' && (
            <>
              <button
                onClick={() => {
                  handleCreateNote(contextMenu.id);
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                style={{ color: '#a6adc8' }}
                onMouseEnter={e => e.currentTarget.style.background = '#252536'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Plus size={11} />
                New note here
              </button>
              <button
                onClick={() => {
                  dispatch({ type: 'DELETE_FOLDER', payload: contextMenu.id });
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                style={{ color: '#f38ba8' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(243,139,168,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Trash2 size={11} />
                Delete folder
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NoteItem({ note, isActive, onClick, onContextMenu, indent }: {
  note: { id: string; title: string };
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-[3px] cursor-pointer transition-colors text-xs ${
        indent ? 'pl-7' : 'pl-5'
      }`}
      style={{
        background: isActive ? 'rgba(124, 109, 242, 0.1)' : 'transparent',
        borderRight: isActive ? '2px solid #7c6df2' : '2px solid transparent',
        color: isActive ? '#cdd6f4' : '#a6adc8',
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={e => {
        if (!isActive) e.currentTarget.style.background = '#1e1e2e';
      }}
      onMouseLeave={e => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <FileText size={12} style={{ color: isActive ? '#7c6df2' : '#45475a' }} />
      <span className="truncate">{note.title}</span>
    </div>
  );
}
