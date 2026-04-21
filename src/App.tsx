import { useEffect, useCallback } from 'react';
import { StoreProvider, useStore } from './store';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { GraphView } from './components/GraphView';
import { SearchModal } from './components/SearchModal';
import { StatusBar } from './components/StatusBar';
import { BacklinksPanel } from './components/BacklinksPanel';
import { VaultScreen } from './components/VaultScreen';
import {
  PanelLeftOpen, PenLine, Eye, Columns2, PanelRightOpen, PanelRightClose,
  Plus, Waypoints, Search,
} from 'lucide-react';

function AppContent() {
  const { state, dispatch, createNote } = useStore();
  const { activeNoteId, viewMode, showGraphView, showSearch, sidebarOpen, rightPanelOpen, activeVaultId } = state;

  if (!activeVaultId) {
    return <VaultScreen />;
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_SEARCH' });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNote();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_GRAPH_VIEW' });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        if (viewMode === 'edit') dispatch({ type: 'SET_VIEW_MODE', payload: 'preview' });
        else if (viewMode === 'preview') dispatch({ type: 'SET_VIEW_MODE', payload: 'split' });
        else dispatch({ type: 'SET_VIEW_MODE', payload: 'edit' });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_SIDEBAR' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, createNote, viewMode]);

  const renderMainContent = useCallback(() => {
    if (!activeNoteId) {
      return (
        <div className="flex-1 flex items-center justify-center" style={{ background: '#0a0a0a' }}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <path d="M16 3L6 9v14l10 6 10-6V9L16 3z" fill="#1a1a1a" stroke="#444" strokeWidth="2"/>
              </svg>
            </div>
            <h2 className="text-base font-semibold mb-1" style={{ color: '#ccc' }}>Flint</h2>
            <p className="text-[11px] mb-6 max-w-[220px] leading-relaxed mx-auto" style={{ color: '#444' }}>
              Create a new note or select one from the sidebar.
            </p>
            <div className="flex items-center gap-2 justify-center">
              <button
                onClick={() => createNote()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-colors"
                style={{ background: '#222', color: '#aaa' }}
                onMouseEnter={e => e.currentTarget.style.background = '#333'}
                onMouseLeave={e => e.currentTarget.style.background = '#222'}
              >
                <Plus size={12} /> New Note
              </button>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] transition-colors"
                style={{ background: '#111', color: '#555', border: '1px solid #1a1a1a' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.color = '#555'; }}
              >
                <Waypoints size={12} /> Graph
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: '#0a0a0a' }}>
        <TabBar />

        {/* View mode toolbar */}
        <div className="flex items-center justify-between px-2 py-[2px]" style={{ borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}>
          <div className="flex items-center gap-0.5">
            {!sidebarOpen && (
              <button
                onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
                className="p-1 rounded transition-colors"
                style={{ color: '#555' }}
                onMouseEnter={e => e.currentTarget.style.color = '#aaa'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}
                title="Open sidebar"
              >
                <PanelLeftOpen size={13} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-0.5 rounded p-[2px]" style={{ background: '#0a0a0a' }}>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'edit' })}
              className="flex items-center gap-1 px-2 py-[3px] rounded text-[10px] font-medium transition-colors"
              style={{ background: viewMode === 'edit' ? '#222' : 'transparent', color: viewMode === 'edit' ? '#ccc' : '#555' }}
            >
              <PenLine size={10} /> Edit
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'split' })}
              className="flex items-center gap-1 px-2 py-[3px] rounded text-[10px] font-medium transition-colors"
              style={{ background: viewMode === 'split' ? '#222' : 'transparent', color: viewMode === 'split' ? '#ccc' : '#555' }}
            >
              <Columns2 size={10} /> Split
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'preview' })}
              className="flex items-center gap-1 px-2 py-[3px] rounded text-[10px] font-medium transition-colors"
              style={{ background: viewMode === 'preview' ? '#222' : 'transparent', color: viewMode === 'preview' ? '#ccc' : '#555' }}
            >
              <Eye size={10} /> Preview
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })} className="p-1 rounded transition-colors" style={{ color: '#555' }} onMouseEnter={e => e.currentTarget.style.color = '#aaa'} onMouseLeave={e => e.currentTarget.style.color = '#555'} title="Graph View">
              <Waypoints size={13} />
            </button>
            <button onClick={() => dispatch({ type: 'TOGGLE_SEARCH' })} className="p-1 rounded transition-colors" style={{ color: '#555' }} onMouseEnter={e => e.currentTarget.style.color = '#aaa'} onMouseLeave={e => e.currentTarget.style.color = '#555'} title="Search">
              <Search size={13} />
            </button>
            <button onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })} className="p-1 rounded transition-colors" style={{ color: rightPanelOpen ? '#888' : '#555' }} onMouseEnter={e => e.currentTarget.style.color = '#aaa'} onMouseLeave={e => e.currentTarget.style.color = rightPanelOpen ? '#888' : '#555'} title="Backlinks">
              {rightPanelOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {viewMode === 'edit' && <div className="flex-1 overflow-hidden"><Editor noteId={activeNoteId} /></div>}
          {viewMode === 'preview' && <div className="flex-1 overflow-hidden"><Preview noteId={activeNoteId} /></div>}
          {viewMode === 'split' && (
            <>
              <div className="flex-1 overflow-hidden" style={{ borderRight: '1px solid #1a1a1a' }}><Editor noteId={activeNoteId} /></div>
              <div className="flex-1 overflow-hidden"><Preview noteId={activeNoteId} /></div>
            </>
          )}
        </div>
      </div>
    );
  }, [activeNoteId, viewMode, sidebarOpen, rightPanelOpen, dispatch, createNote]);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0a0a0a' }}>
      <div className="flex-1 flex min-h-0">
        {/* Ribbon */}
        <div className="flex flex-col items-center py-2 gap-0.5 shrink-0" style={{ width: 40, background: '#080808', borderRight: '1px solid #1a1a1a' }}>
          <div className="mb-2 mt-1">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <path d="M16 3L6 9v14l10 6 10-6V9L16 3z" fill="#1a1a1a" stroke="#444" strokeWidth="2"/>
            </svg>
          </div>
          <RibbonButton active={sidebarOpen} onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })} title="Toggle sidebar">
            <PanelLeftOpen size={15} />
          </RibbonButton>
          <div className="w-4 my-1" style={{ borderTop: '1px solid #1a1a1a' }} />
          <RibbonButton onClick={() => createNote()} title="New note"><Plus size={15} /></RibbonButton>
          <RibbonButton onClick={() => dispatch({ type: 'TOGGLE_SEARCH' })} title="Search"><Search size={15} /></RibbonButton>
          <RibbonButton onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })} title="Graph"><Waypoints size={15} /></RibbonButton>
          <div className="flex-1" />
          <RibbonButton active={rightPanelOpen} onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })} title="Backlinks">
            <PanelRightOpen size={15} />
          </RibbonButton>
        </div>

        {sidebarOpen && <Sidebar />}
        {renderMainContent()}
        {rightPanelOpen && activeNoteId && <BacklinksPanel />}
      </div>
      <StatusBar />
      {showGraphView && <GraphView />}
      {showSearch && <SearchModal />}
    </div>
  );
}

function RibbonButton({ children, onClick, active, title }: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick} title={title}
      className="w-7 h-7 rounded flex items-center justify-center transition-colors"
      style={{ color: active ? '#888' : '#3a3a3a', background: active ? '#151515' : 'transparent' }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#777'; e.currentTarget.style.background = '#111'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.background = 'transparent'; } }}
    >
      {children}
    </button>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
