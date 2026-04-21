import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { type Note, type Folder, type Vault, type ViewMode } from './types';

interface State {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  openTabs: string[];
  viewMode: ViewMode;
  showGraphView: boolean;
  showSearch: boolean;
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  activeVaultId: string | null;
  lastSaved: number | null;
  autoSaveEnabled: boolean;
}

type Action =
  | { type: 'SET_STATE'; payload: Partial<State> }
  | { type: 'ADD_NOTE'; payload: Note }
  | { type: 'UPDATE_NOTE'; payload: { id: string; content?: string; title?: string; pinned?: boolean } }
  | { type: 'DELETE_NOTE'; payload: string }
  | { type: 'ADD_FOLDER'; payload: Folder }
  | { type: 'RENAME_FOLDER'; payload: { id: string; name: string } }
  | { type: 'DELETE_FOLDER'; payload: string }
  | { type: 'TOGGLE_FOLDER'; payload: string }
  | { type: 'SET_ACTIVE_NOTE'; payload: string | null }
  | { type: 'OPEN_TAB'; payload: string }
  | { type: 'CLOSE_TAB'; payload: string }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'TOGGLE_GRAPH_VIEW' }
  | { type: 'TOGGLE_SEARCH' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_RIGHT_PANEL' }
  | { type: 'MOVE_NOTE'; payload: { noteId: string; folderId: string | null } }
  | { type: 'PIN_NOTE'; payload: string }
  | { type: 'LOAD_VAULT'; payload: State }
  | { type: 'CLEAR_VAULT' }
  | { type: 'MARK_SAVED' };

export const generateId = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
export const VAULTS_KEY = 'flint-vaults';
export const VAULT_DATA_PREFIX = 'flint-vault-';



const initialState: State = {
  notes: [],
  folders: [],
  activeNoteId: null,
  openTabs: [],
  viewMode: 'edit',
  showGraphView: false,
  showSearch: false,
  sidebarOpen: true,
  rightPanelOpen: false,
  activeVaultId: null,
  lastSaved: null,
  autoSaveEnabled: true,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };

    case 'ADD_NOTE':
      return {
        ...state,
        notes: [...state.notes, action.payload],
        activeNoteId: action.payload.id,
        openTabs: [...state.openTabs, action.payload.id],
      };

    case 'UPDATE_NOTE':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.payload.id
            ? { ...n, ...action.payload, updatedAt: Date.now() }
            : n
        ),
        lastSaved: null,
      };

    case 'DELETE_NOTE': {
      const newTabs = state.openTabs.filter((id) => id !== action.payload);
      const newActive =
        state.activeNoteId === action.payload
          ? newTabs[newTabs.length - 1] || null
          : state.activeNoteId;
      return {
        ...state,
        notes: state.notes.filter((n) => n.id !== action.payload),
        openTabs: newTabs,
        activeNoteId: newActive,
      };
    }

    case 'ADD_FOLDER':
      return { ...state, folders: [...state.folders, action.payload] };

    case 'RENAME_FOLDER':
      return {
        ...state,
        folders: state.folders.map((f) =>
          f.id === action.payload.id ? { ...f, name: action.payload.name } : f
        ),
      };

    case 'DELETE_FOLDER':
      return {
        ...state,
        folders: state.folders.filter((f) => f.id !== action.payload),
        notes: state.notes.map((n) =>
          n.folderId === action.payload ? { ...n, folderId: null } : n
        ),
      };

    case 'TOGGLE_FOLDER':
      return {
        ...state,
        folders: state.folders.map((f) =>
          f.id === action.payload ? { ...f, collapsed: !f.collapsed } : f
        ),
      };

    case 'SET_ACTIVE_NOTE':
      return { ...state, activeNoteId: action.payload };

    case 'OPEN_TAB': {
      const tabs = state.openTabs.includes(action.payload)
        ? state.openTabs
        : [...state.openTabs, action.payload];
      return { ...state, openTabs: tabs, activeNoteId: action.payload };
    }

    case 'CLOSE_TAB': {
      const idx = state.openTabs.indexOf(action.payload);
      const newTabs = state.openTabs.filter((id) => id !== action.payload);
      let newActive = state.activeNoteId;
      if (state.activeNoteId === action.payload) {
        newActive = newTabs[Math.min(idx, newTabs.length - 1)] || null;
      }
      return { ...state, openTabs: newTabs, activeNoteId: newActive };
    }

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };

    case 'TOGGLE_GRAPH_VIEW':
      return { ...state, showGraphView: !state.showGraphView };

    case 'TOGGLE_SEARCH':
      return { ...state, showSearch: !state.showSearch };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case 'TOGGLE_RIGHT_PANEL':
      return { ...state, rightPanelOpen: !state.rightPanelOpen };

    case 'MOVE_NOTE':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.payload.noteId
            ? { ...n, folderId: action.payload.folderId }
            : n
        ),
      };

    case 'PIN_NOTE':
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.payload ? { ...n, pinned: !n.pinned } : n
        ),
      };

    case 'LOAD_VAULT':
      return { ...action.payload, showSearch: false, showGraphView: false };

    case 'CLEAR_VAULT':
      return { ...initialState };

    case 'MARK_SAVED':
      return { ...state, lastSaved: Date.now() };

    default:
      return state;
  }
}

interface StoreContextType {
  state: State;
  dispatch: React.Dispatch<Action>;
  createNote: (folderId?: string | null, title?: string) => string;
  extractLinks: (content: string) => string[];
  getBacklinks: (noteId: string) => Note[];
  getNoteByTitle: (title: string) => Note | undefined;
  vaults: Vault[];
  createVault: (name: string, color?: string) => string;
  openVault: (vaultId: string) => void;
  deleteVault: (vaultId: string) => void;
  renameVault: (vaultId: string, name: string) => void;
  closeVault: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

function getNewVaultState(vaultId: string): State {
  return {
    notes: [{
      id: 'note-first',
      title: 'Welcome to your Vault',
      content: `# Welcome to your new vault

This is your fresh workspace in **Flint**. Start writing, linking, and building your knowledge graph.

## Quick Tips
- Use \`[[double brackets]]\` to link notes
- Press \`Ctrl+G\` for graph view
- Press \`Ctrl+N\` for a new note
- Auto-save is enabled — your work is always saved

Happy writing!
`,
      folderId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: true,
    }],
    folders: [],
    activeNoteId: 'note-first',
    openTabs: ['note-first'],
    viewMode: 'edit',
    showGraphView: false,
    showSearch: false,
    sidebarOpen: true,
    rightPanelOpen: false,
    activeVaultId: vaultId,
    lastSaved: Date.now(),
    autoSaveEnabled: true,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const initializedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [vaults, setVaults] = React.useState<Vault[]>(() => {
    try {
      const saved = localStorage.getItem(VAULTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // On mount: try to reopen last vault, but do NOT auto-create
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (state.activeVaultId) return;

    try {
      const savedVaults: Vault[] = JSON.parse(localStorage.getItem(VAULTS_KEY) || '[]');
      if (savedVaults.length > 0) {
        const lastVault = [...savedVaults].sort((a, b) => b.lastOpened - a.lastOpened)[0];
        const saved = localStorage.getItem(VAULT_DATA_PREFIX + lastVault.id);
        if (saved) {
          const parsed = JSON.parse(saved);
          dispatch({ type: 'LOAD_VAULT', payload: { ...parsed, activeVaultId: lastVault.id } });
        } else {
          dispatch({ type: 'LOAD_VAULT', payload: getNewVaultState(lastVault.id) });
        }
      }
      // If no vaults exist, user stays on vault screen — no auto-create
    } catch { /* ignore */ }
  }, []);

  // Auto-save: debounce 800ms after any state change
  useEffect(() => {
    if (!state.activeVaultId) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        const toSave = { ...state, showSearch: false, showGraphView: false, lastSaved: Date.now() };
        localStorage.setItem(VAULT_DATA_PREFIX + state.activeVaultId, JSON.stringify(toSave));
        dispatch({ type: 'MARK_SAVED' });
      } catch { /* storage full */ }
    }, 800);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [state]);

  // Save vaults list
  useEffect(() => {
    localStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
  }, [vaults]);

  const createVault = useCallback((name: string, color: string = '#444444'): string => {
    const id = generateId();
    const vault: Vault = {
      id,
      name,
      path: `~/.flint/vaults/${name.toLowerCase().replace(/\s+/g, '-')}`,
      createdAt: Date.now(),
      lastOpened: Date.now(),
      color,
    };
    setVaults(prev => [...prev, vault]);
    dispatch({ type: 'LOAD_VAULT', payload: getNewVaultState(id) });
    return id;
  }, []);

  const openVault = useCallback((vaultId: string) => {
    try {
      const saved = localStorage.getItem(VAULT_DATA_PREFIX + vaultId);
      if (saved) {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'LOAD_VAULT', payload: { ...parsed, activeVaultId: vaultId } });
      } else {
        dispatch({ type: 'LOAD_VAULT', payload: getNewVaultState(vaultId) });
      }
      setVaults(prev => prev.map(v => v.id === vaultId ? { ...v, lastOpened: Date.now() } : v));
    } catch {
      dispatch({ type: 'LOAD_VAULT', payload: getNewVaultState(vaultId) });
    }
  }, []);

  const deleteVault = useCallback((vaultId: string) => {
    setVaults(prev => prev.filter(v => v.id !== vaultId));
    localStorage.removeItem(VAULT_DATA_PREFIX + vaultId);
    if (state.activeVaultId === vaultId) {
      dispatch({ type: 'CLEAR_VAULT' });
    }
  }, [state.activeVaultId]);

  const renameVault = useCallback((vaultId: string, name: string) => {
    setVaults(prev => prev.map(v => v.id === vaultId ? { ...v, name } : v));
  }, []);

  const closeVault = useCallback(() => {
    if (state.activeVaultId) {
      const toSave = { ...state, showSearch: false, showGraphView: false };
      localStorage.setItem(VAULT_DATA_PREFIX + state.activeVaultId, JSON.stringify(toSave));
    }
    dispatch({ type: 'CLEAR_VAULT' });
  }, [state]);

  const extractLinks = useCallback((content: string): string[] => {
    const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const links: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      links.push(match[1].trim());
    }
    return links;
  }, []);

  const getNoteByTitle = useCallback(
    (title: string): Note | undefined => {
      return state.notes.find(
        (n) => n.title.toLowerCase() === title.toLowerCase()
      );
    },
    [state.notes]
  );

  const getBacklinks = useCallback(
    (noteId: string): Note[] => {
      const note = state.notes.find((n) => n.id === noteId);
      if (!note) return [];
      return state.notes.filter((n) => {
        if (n.id === noteId) return false;
        const links = extractLinks(n.content);
        return links.some(
          (link) => link.toLowerCase() === note.title.toLowerCase()
        );
      });
    },
    [state.notes, extractLinks]
  );

  const createNote = useCallback(
    (folderId?: string | null, title?: string): string => {
      const id = generateId();
      const note: Note = {
        id,
        title: title || 'Untitled',
        content: '',
        folderId: folderId ?? null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      dispatch({ type: 'ADD_NOTE', payload: note });
      return id;
    },
    []
  );

  return (
    <StoreContext.Provider
      value={{
        state, dispatch, createNote, extractLinks, getBacklinks, getNoteByTitle,
        vaults, createVault, openVault, deleteVault, renameVault, closeVault,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
