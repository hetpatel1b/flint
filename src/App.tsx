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
  PanelLeftOpen,
  PenLine,
  Eye,
  Columns2,
  PanelRightOpen,
  PanelRightClose,
  Plus,
  Waypoints,
  Search,
} from 'lucide-react';

function AppContent() {
  const { state, dispatch, createNote } = useStore();
  const { activeNoteId, viewMode, showGraphView, showSearch, sidebarOpen, rightPanelOpen, activeVaultId } = state;

  // Show vault screen if no vault is active
  if (!activeVaultId) {
    return <VaultScreen />;
  }

  // Keyboard shortcuts
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
        <div className="flex-1 flex items-center justify-center" style={{ background: '#1e1e2e' }}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(124,109,242,0.08)' }}>
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <path d="M16 2L4 10v12l12 8 12-8V10L16 2z" fill="#2a2a3c" stroke="#7c6df2" strokeWidth="1.5"/>
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">Flint</h2>
            <p className="text-xs mb-6 max-w-[250px] leading-relaxed" style={{ color: '#6c7086' }}>
              Create a new note or select one from the sidebar to begin.
            </p>
            <div className="flex items-center gap-2 justify-center">
              <button
                onClick={() => createNote()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium text-white transition-colors"
                style={{ background: '#7c6df2' }}
                onMouseEnter={e => e.currentTarget.style.background = '#8b7ff3'}
                onMouseLeave={e => e.currentTarget.style.background = '#7c6df2'}
              >
                <Plus size={13} />
                New Note
              </button>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs transition-colors"
                style={{ background: '#181825', color: '#6c7086', border: '1px solid #232334' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#313244'; e.currentTarget.style.color = '#a6adc8'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#232334'; e.currentTarget.style.color = '#6c7086'; }}
              >
                <Waypoints size={13} />
                Graph
              </button>
            </div>
            <div className="mt-6 flex items-center justify-center gap-3 text-[10px]" style={{ color: '#313244' }}>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded" style={{ background: '#181825', border: '1px solid #232334' }}>Ctrl+N</kbd>
                New
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded" style={{ background: '#181825', border: '1px solid #232334' }}>Ctrl+G</kbd>
                Graph
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded" style={{ background: '#181825', border: '1px solid #232334' }}>Ctrl+⇧+F</kbd>
                Search
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: '#1e1e2e' }}>
        <TabBar />

        {/* View mode toolbar */}
        <div className="flex items-center justify-between px-2 py-0.5" style={{ borderBottom: '1px solid #232334', background: '#181825' }}>
          <div className="flex items-center gap-0.5">
            {!sidebarOpen && (
              <button
                onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
                className="p-1 rounded transition-colors"
                style={{ color: '#6c7086' }}
                onMouseEnter={e => e.currentTarget.style.color = '#cdd6f4'}
                onMouseLeave={e => e.currentTarget.style.color = '#6c7086'}
                title="Open sidebar"
              >
                <PanelLeftOpen size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-0.5 rounded-md p-0.5" style={{ background: '#11111b' }}>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'edit' })}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
              style={{
                background: viewMode === 'edit' ? '#7c6df2' : 'transparent',
                color: viewMode === 'edit' ? 'white' : '#6c7086',
              }}
            >
              <PenLine size={11} />
              Edit
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'split' })}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
              style={{
                background: viewMode === 'split' ? '#7c6df2' : 'transparent',
                color: viewMode === 'split' ? 'white' : '#6c7086',
              }}
            >
              <Columns2 size={11} />
              Split
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'preview' })}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
              style={{
                background: viewMode === 'preview' ? '#7c6df2' : 'transparent',
                color: viewMode === 'preview' ? 'white' : '#6c7086',
              }}
            >
              <Eye size={11} />
              Preview
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
              className="p-1 rounded transition-colors"
              style={{ color: '#6c7086' }}
              onMouseEnter={e => e.currentTarget.style.color = '#cdd6f4'}
              onMouseLeave={e => e.currentTarget.style.color = '#6c7086'}
              title="Graph View (Ctrl+G)"
            >
              <Waypoints size={14} />
            </button>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_SEARCH' })}
              className="p-1 rounded transition-colors"
              style={{ color: '#6c7086' }}
              onMouseEnter={e => e.currentTarget.style.color = '#cdd6f4'}
              onMouseLeave={e => e.currentTarget.style.color = '#6c7086'}
              title="Search (Ctrl+Shift+F)"
            >
              <Search size={14} />
            </button>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
              className="p-1 rounded transition-colors"
              style={{ color: rightPanelOpen ? '#7c6df2' : '#6c7086' }}
              onMouseEnter={e => e.currentTarget.style.color = '#cdd6f4'}
              onMouseLeave={e => e.currentTarget.style.color = rightPanelOpen ? '#7c6df2' : '#6c7086'}
              title="Toggle backlinks"
            >
              {rightPanelOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {viewMode === 'edit' && (
            <div className="flex-1 overflow-hidden">
              <Editor noteId={activeNoteId} />
            </div>
          )}
          {viewMode === 'preview' && (
            <div className="flex-1 overflow-hidden">
              <Preview noteId={activeNoteId} />
            </div>
          )}
          {viewMode === 'split' && (
            <>
              <div className="flex-1 overflow-hidden" style={{ borderRight: '1px solid #232334' }}>
                <Editor noteId={activeNoteId} />
              </div>
              <div className="flex-1 overflow-hidden">
                <Preview noteId={activeNoteId} />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }, [activeNoteId, viewMode, sidebarOpen, rightPanelOpen, dispatch, createNote]);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#1e1e2e' }}>
      <div className="flex-1 flex min-h-0">
        {/* Ribbon — thin vertical icon bar like Obsidian */}
        <div className="flex flex-col items-center py-2 gap-0.5 shrink-0" style={{ width: 44, background: '#11111b', borderRight: '1px solid #232334' }}>
          {/* Logo */}
          <div className="mb-2 mt-1">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L4 10v12l12 8 12-8V10L16 2z" fill="#1e1e2e" stroke="#7c6df2" strokeWidth="2"/>
            </svg>
          </div>

          <RibbonButton
            active={sidebarOpen}
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            title="Toggle sidebar (Ctrl+\\)"
          >
            <PanelLeftOpen size={16} />
          </RibbonButton>

          <div className="w-5 my-1" style={{ borderTop: '1px solid #232334' }} />

          <RibbonButton
            onClick={() => createNote()}
            title="New note (Ctrl+N)"
          >
            <Plus size={16} />
          </RibbonButton>

          <RibbonButton
            onClick={() => dispatch({ type: 'TOGGLE_SEARCH' })}
            title="Search (Ctrl+Shift+F)"
          >
            <Search size={16} />
          </RibbonButton>

          <RibbonButton
            onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
            title="Graph View (Ctrl+G)"
          >
            <Waypoints size={16} />
          </RibbonButton>

          <div className="flex-1" />

          <RibbonButton
            active={rightPanelOpen}
            onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
            title="Toggle backlinks"
          >
            <PanelRightOpen size={16} />
          </RibbonButton>
        </div>

        {/* Sidebar */}
        {sidebarOpen && <Sidebar />}

        {/* Main Content */}
        {renderMainContent()}

        {/* Right Panel */}
        {rightPanelOpen && activeNoteId && <BacklinksPanel />}
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Modals */}
      {showGraphView && <GraphView />}
      {showSearch && <SearchModal />}
    </div>
  );
}

function RibbonButton({ children, onClick, active, title }: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
      style={{
        color: active ? '#7c6df2' : '#585b70',
        background: active ? 'rgba(124,109,242,0.08)' : 'transparent',
      }}
      onMouseEnter={e => {
        if (!active) { e.currentTarget.style.color = '#a6adc8'; e.currentTarget.style.background = '#1e1e2e'; }
      }}
      onMouseLeave={e => {
        if (!active) { e.currentTarget.style.color = '#585b70'; e.currentTarget.style.background = 'transparent'; }
      }}
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
