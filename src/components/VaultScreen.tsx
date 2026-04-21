import { useState } from 'react';
import { useStore } from '../store';
import { Plus, FolderOpen, Trash2, Clock, ChevronRight, Shield, HardDrive, X } from 'lucide-react';

const VAULT_COLORS = ['#555', '#666', '#777', '#888', '#4a4a4a', '#5a5a5a', '#6a6a6a', '#3a3a3a'];

export function VaultScreen() {
  const { vaults, createVault, openVault, deleteVault } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [vaultColor, setVaultColor] = useState('#555');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!vaultName.trim()) return;
    createVault(vaultName.trim(), vaultColor);
    setVaultName('');
    setVaultColor('#555');
    setShowCreate(false);
  };

  const sortedVaults = [...vaults].sort((a, b) => b.lastOpened - a.lastOpened);

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: '#0a0a0a' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5" style={{ background: '#151515', border: '1px solid #222' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 3L6 9v14l10 6 10-6V9L16 3z" fill="#1a1a1a" stroke="#444" strokeWidth="1.5"/>
              <path d="M16 3v26M6 9l10 6 10-6M6 23l10-5 10 5" stroke="#333" strokeWidth="0.8" opacity="0.5"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mb-1">Flint</h1>
          <p className="text-xs" style={{ color: '#555' }}>Local-first knowledge base. Your data. Your control.</p>
        </div>

        {/* Security badges */}
        <div className="flex items-center justify-center gap-6 mb-8 text-[10px]" style={{ color: '#444' }}>
          <div className="flex items-center gap-1.5">
            <Shield size={10} style={{ color: '#555' }} />
            <span>Stored locally</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive size={10} style={{ color: '#555' }} />
            <span>No cloud</span>
          </div>
        </div>

        {/* Create new vault */}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left mb-4 group"
            style={{ borderColor: '#1e1e1e', background: '#111' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.background = '#151515'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.background = '#111'; }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#1a1a1a' }}>
              <Plus size={16} style={{ color: '#666' }} />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: '#bbb' }}>Create new vault</div>
              <div className="text-[10px]" style={{ color: '#555' }}>Start a new knowledge base</div>
            </div>
            <ChevronRight size={14} className="ml-auto" style={{ color: '#333' }} />
          </button>
        ) : (
          <div className="p-4 rounded-lg border mb-4 animate-slide-in" style={{ borderColor: '#2a2a2a', background: '#111' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: '#ccc' }}>New Vault</h3>
              <button onClick={() => setShowCreate(false)} style={{ color: '#555' }} className="hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: '#555' }}>Vault Name</label>
              <input
                type="text"
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="My Knowledge Base..."
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors"
                style={{ background: '#0a0a0a', border: '1px solid #222' }}
                onFocus={e => e.currentTarget.style.borderColor = '#444'}
                onBlur={e => e.currentTarget.style.borderColor = '#222'}
                autoFocus
              />
            </div>
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: '#555' }}>Storage Path</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: '#0a0a0a', border: '1px solid #222', color: '#555' }}>
                <HardDrive size={11} />
                <span>~/.flint/vaults/{vaultName.toLowerCase().replace(/\s+/g, '-') || 'my-vault'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px]" style={{ color: '#555' }}>Color:</span>
              {VAULT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setVaultColor(c)}
                  className="w-5 h-5 rounded-full border-2 transition-all"
                  style={{ background: c, borderColor: vaultColor === c ? '#999' : 'transparent' }}
                />
              ))}
            </div>
            <button
              onClick={handleCreate}
              disabled={!vaultName.trim()}
              className="w-full py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: '#2a2a2a', color: '#ccc' }}
              onMouseEnter={e => { if (vaultName.trim()) e.currentTarget.style.background = '#333'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a'; }}
            >
              Create Vault
            </button>
          </div>
        )}

        {/* Vault list */}
        {sortedVaults.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-[9px] font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: '#444' }}>
              Your Vaults
            </h3>
            {sortedVaults.map((vault) => (
              <div
                key={vault.id}
                className="group flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all"
                style={{ borderColor: '#1a1a1a', background: '#111' }}
                onClick={() => openVault(vault.id)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.background = '#151515'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.background = '#111'; }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#1a1a1a' }}>
                  <FolderOpen size={14} style={{ color: '#666' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: '#bbb' }}>{vault.name}</div>
                  <div className="flex items-center gap-3 text-[10px] mt-0.5" style={{ color: '#444' }}>
                    <span className="flex items-center gap-1">
                      <Clock size={8} />
                      {new Date(vault.lastOpened).toLocaleDateString()}
                    </span>
                    <span>{vault.path}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {deletingId === vault.id ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteVault(vault.id); setDeletingId(null); }}
                        className="p-1 rounded text-[10px]"
                        style={{ color: '#888' }}
                      >Yes</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                        className="p-1 rounded text-[10px]"
                        style={{ color: '#555' }}
                      >No</button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(vault.id); }}
                      className="p-1 rounded transition-colors"
                      style={{ color: '#333' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#888'}
                      onMouseLeave={e => e.currentTarget.style.color = '#333'}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
                <ChevronRight size={12} style={{ color: '#333' }} />
              </div>
            ))}
          </div>
        )}

        {vaults.length === 0 && !showCreate && (
          <div className="text-center py-12">
            <FolderOpen size={36} className="mx-auto mb-3" style={{ color: '#1e1e1e' }} />
            <p className="text-xs" style={{ color: '#444' }}>No vaults yet. Create one to get started.</p>
          </div>
        )}

        <div className="text-center mt-10 text-[10px]" style={{ color: '#222' }}>
          <p>Flint v1.0.0 — Local-first, secure, forever free.</p>
        </div>
      </div>
    </div>
  );
}
