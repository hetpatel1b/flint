import { useState } from 'react';
import { useStore } from '../store';
import { Plus, FolderOpen, Trash2, Clock, ChevronRight, Shield, HardDrive, X } from 'lucide-react';

const VAULT_COLORS = ['#7c6df2', '#f38ba8', '#a6e3a1', '#89b4fa', '#f9e2af', '#fab387', '#89dceb', '#cba6f7'];

export function VaultScreen() {
  const { vaults, createVault, openVault, deleteVault } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [vaultColor, setVaultColor] = useState('#7c6df2');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!vaultName.trim()) return;
    createVault(vaultName.trim(), vaultColor);
    setVaultName('');
    setVaultColor('#7c6df2');
    setShowCreate(false);
  };

  const sortedVaults = [...vaults].sort((a, b) => b.lastOpened - a.lastOpened);

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: '#11111b' }}>
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4" style={{ background: 'rgba(124, 109, 242, 0.1)' }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L4 10v12l12 8 12-8V10L16 2z" fill="#1e1e2e" stroke="#7c6df2" strokeWidth="1.5"/>
              <path d="M16 2v28M4 10l12 8 12-8M4 22l12-4 12 4" stroke="#7c6df2" strokeWidth="1" opacity="0.4"/>
              <path d="M10 6l6-2 6 2" stroke="#7c6df2" strokeWidth="0.8" opacity="0.3"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1.5">Flint</h1>
          <p className="text-sm" style={{ color: '#6c7086' }}>A local-first knowledge base. Your data. Your control.</p>
        </div>

        {/* Security badges */}
        <div className="flex items-center justify-center gap-6 mb-8 text-xs" style={{ color: '#6c7086' }}>
          <div className="flex items-center gap-1.5">
            <Shield size={12} style={{ color: '#a6e3a1' }} />
            <span>Stored locally</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive size={12} style={{ color: '#89b4fa' }} />
            <span>No cloud. No tracking.</span>
          </div>
        </div>

        {/* Create new vault */}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-3 p-3.5 rounded-lg border transition-all text-left mb-5 group"
            style={{ borderColor: '#2a2a3c', background: '#181825' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,109,242,0.3)'; e.currentTarget.style.background = '#1e1e2e'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3c'; e.currentTarget.style.background = '#181825'; }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,109,242,0.1)' }}>
              <Plus size={16} style={{ color: '#7c6df2' }} />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: '#cdd6f4' }}>Create new vault</div>
              <div className="text-xs" style={{ color: '#6c7086' }}>Start a new knowledge base</div>
            </div>
            <ChevronRight size={14} className="ml-auto" style={{ color: '#45475a' }} />
          </button>
        ) : (
          <div className="p-4 rounded-lg border mb-5 animate-slide-in" style={{ borderColor: 'rgba(124,109,242,0.2)', background: '#181825' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">New Vault</h3>
              <button onClick={() => setShowCreate(false)} style={{ color: '#6c7086' }} className="hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
            <input
              type="text"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Vault name..."
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors mb-3"
              style={{ background: '#11111b', border: '1px solid #2a2a3c' }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(124,109,242,0.5)'}
              onBlur={e => e.currentTarget.style.borderColor = '#2a2a3c'}
              autoFocus
            />
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs" style={{ color: '#6c7086' }}>Color:</span>
              {VAULT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setVaultColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${vaultColor === c ? 'scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ background: c, borderColor: vaultColor === c ? 'white' : 'transparent' }}
                />
              ))}
            </div>
            <button
              onClick={handleCreate}
              disabled={!vaultName.trim()}
              className="w-full py-2 rounded-lg font-medium text-sm transition-colors text-white disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: '#7c6df2' }}
              onMouseEnter={e => { if (vaultName.trim()) e.currentTarget.style.background = '#8b7ff3'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#7c6df2'; }}
            >
              Create Vault
            </button>
          </div>
        )}

        {/* Vault list */}
        {sortedVaults.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-2 px-1" style={{ color: '#6c7086' }}>
              Your Vaults ({sortedVaults.length})
            </h3>
            {sortedVaults.map((vault) => (
              <div
                key={vault.id}
                className="group flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all"
                style={{ borderColor: '#2a2a3c', background: '#181825' }}
                onClick={() => openVault(vault.id)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#313244'; e.currentTarget.style.background = '#1e1e2e'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3c'; e.currentTarget.style.background = '#181825'; }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${vault.color}15` }}
                >
                  <FolderOpen size={14} style={{ color: vault.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: '#cdd6f4' }}>{vault.name}</div>
                  <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: '#6c7086' }}>
                    <span className="flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(vault.lastOpened).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {deletingId === vault.id ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteVault(vault.id); setDeletingId(null); }}
                        className="p-1 rounded text-xs transition-colors"
                        style={{ color: '#f38ba8' }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                        className="p-1 rounded text-xs transition-colors"
                        style={{ color: '#6c7086' }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(vault.id); }}
                      className="p-1 rounded transition-colors"
                      style={{ color: '#45475a' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f38ba8'}
                      onMouseLeave={e => e.currentTarget.style.color = '#45475a'}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <ChevronRight size={12} style={{ color: '#45475a' }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {vaults.length === 0 && !showCreate && (
          <div className="text-center py-10">
            <FolderOpen size={36} className="mx-auto mb-3" style={{ color: '#2a2a3c' }} />
            <p className="text-sm" style={{ color: '#45475a' }}>No vaults yet. Create one to get started.</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-10 text-xs" style={{ color: '#313244' }}>
          <p>Flint v1.0.0 — Local-first, secure, forever free.</p>
        </div>
      </div>
    </div>
  );
}
