import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { X, Type, Save, AlignLeft, Hash, WrapText, CheckSquare, Download, Upload, Trash2, Info } from 'lucide-react';

interface Settings {
  fontSize: number;
  spellCheck: boolean;
  autoSave: boolean;
  showLineNumbers: boolean;
  tabSize: number;
  wordWrap: boolean;
}

const SETTINGS_KEY = 'flint-settings';
const DEFAULT_SETTINGS: Settings = {
  fontSize: 14, spellCheck: false, autoSave: true, showLineNumbers: false, tabSize: 2, wordWrap: true,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function SettingsPanel() {
  const { state, dispatch } = useStore();
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [tab, setTab] = useState<'editor' | 'vault' | 'about'>('editor');

  useEffect(() => { saveSettings(settings); }, [settings]);

  // Apply font size to editor style
  useEffect(() => {
    const style = document.getElementById('flint-dynamic-style');
    if (style) {
      style.textContent = `.flint-editor { font-size: ${settings.fontSize}px; tab-size: ${settings.tabSize}; ${settings.wordWrap ? '' : 'white-space: pre; overflow-x: auto;'} }`;
    }
  }, [settings.fontSize, settings.tabSize, settings.wordWrap]);

  const close = () => dispatch({ type: 'TOGGLE_SETTINGS' });

  const exportData = () => {
    const data = localStorage.getItem('flint-data') || '{}';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'flint-vault-export.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (data.vaults) {
            dispatch({ type: 'SET_STATE', payload: data });
            close();
          }
        } catch { alert('Invalid file format'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const clearAll = () => {
    if (confirm('This will delete ALL your vaults and notes. Are you sure?')) {
      localStorage.removeItem('flint-data');
      localStorage.removeItem('flint-settings');
      window.location.reload();
    }
  };

  const vault = state.vaults.find(v => v.id === state.activeVaultId);
  const noteCount = state.notes.length;
  const folderCount = state.folders.length;
  const totalLinks = state.notes.reduce((acc, n) => {
    const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
    let count = 0;
    for (const m of matches) {
      if (state.notes.find(nt => nt.title.toLowerCase() === m[1].toLowerCase())) count++;
    }
    return acc + count;
  }, 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={close}>
      <div style={{ width: 520, maxHeight: '80vh', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '14px 18px', borderBottom: '1px solid #1a1a1a' }}>
          <div className="flex items-center gap-2">
            <img src="/flint-logo.png" alt="Flint" style={{ width: 18, height: 18, borderRadius: 4 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#aaa' }}>Settings</span>
          </div>
          <button onClick={close} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', display: 'flex' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#888'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#444'; }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid #1a1a1a' }}>
          {(['editor', 'vault', 'about'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, textTransform: 'capitalize',
                color: tab === t ? '#999' : '#444',
                borderBottom: tab === t ? '2px solid #666' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '18px', overflowY: 'auto', maxHeight: 'calc(80vh - 110px)' }}>

          {tab === 'editor' && (
            <div className="flex flex-col gap-5">
              <SettingRow icon={<Type size={14} />} label="Font size" value={`${settings.fontSize}px`}>
                <input type="range" min={10} max={24} value={settings.fontSize}
                  onChange={e => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
                  style={{ flex: 1, accentColor: '#666' }} />
              </SettingRow>
              <SettingRow icon={<Hash size={14} />} label="Tab size" value={`${settings.tabSize}`}>
                <input type="range" min={2} max={8} step={2} value={settings.tabSize}
                  onChange={e => setSettings(s => ({ ...s, tabSize: parseInt(e.target.value) }))}
                  style={{ flex: 1, accentColor: '#666' }} />
              </SettingRow>
              <SettingRow icon={<WrapText size={14} />} label="Word wrap">
                <Toggle checked={settings.wordWrap} onChange={v => setSettings(s => ({ ...s, wordWrap: v }))} />
              </SettingRow>
              <SettingRow icon={<Save size={14} />} label="Auto-save">
                <Toggle checked={settings.autoSave} onChange={v => setSettings(s => ({ ...s, autoSave: v }))} />
              </SettingRow>
              <SettingRow icon={<CheckSquare size={14} />} label="Spell check">
                <Toggle checked={settings.spellCheck} onChange={v => setSettings(s => ({ ...s, spellCheck: v }))} />
              </SettingRow>
              <SettingRow icon={<AlignLeft size={14} />} label="Line numbers">
                <Toggle checked={settings.showLineNumbers} onChange={v => setSettings(s => ({ ...s, showLineNumbers: v }))} />
              </SettingRow>
            </div>
          )}

          {tab === 'vault' && (
            <div className="flex flex-col gap-5">
              <div style={{ padding: 14, background: '#0d0d0d', borderRadius: 8, border: '1px solid #1a1a1a' }}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Current Vault</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#aaa', marginBottom: 10 }}>{vault?.name || 'None'}</div>
                <div className="flex gap-4" style={{ fontSize: 11, color: '#444' }}>
                  <span>{noteCount} notes</span>
                  <span>{folderCount} folders</span>
                  <span>{totalLinks} links</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={exportData}
                  className="flex items-center gap-2"
                  style={{ padding: '10px 14px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 6, color: '#777', cursor: 'pointer', fontSize: 12, textAlign: 'left', width: '100%' }}>
                  <Download size={14} /> Export vault data
                </button>
                <button onClick={importData}
                  className="flex items-center gap-2"
                  style={{ padding: '10px 14px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 6, color: '#777', cursor: 'pointer', fontSize: 12, textAlign: 'left', width: '100%' }}>
                  <Upload size={14} /> Import vault data
                </button>
                <button onClick={clearAll}
                  className="flex items-center gap-2"
                  style={{ padding: '10px 14px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 6, color: '#664444', cursor: 'pointer', fontSize: 12, textAlign: 'left', width: '100%' }}>
                  <Trash2 size={14} /> Clear all data
                </button>
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className="flex flex-col gap-4" style={{ textAlign: 'center', paddingTop: 20 }}>
              <img src="/flint-logo.png" alt="Flint" style={{ width: 48, height: 48, borderRadius: 12, margin: '0 auto', border: '1px solid #1a1a1a' }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#999' }}>Flint</div>
                <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Version 1.0.0</div>
              </div>
              <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
                A secure, local-first knowledge base.<br />
                All data stays on your device. No cloud. No tracking.
              </div>
              <div style={{ fontSize: 10, color: '#333', marginTop: 8 }}>
                <Info size={10} style={{ display: 'inline', marginRight: 4 }} />
                Built with React, Vite & TypeScript
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingRow({ icon, label, value, children }: { icon: React.ReactNode; label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span style={{ color: '#444', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 12, color: '#777', flex: 1 }}>{label}</span>
      {value && <span style={{ fontSize: 11, color: '#444', marginRight: 8 }}>{value}</span>}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
        background: checked ? '#444' : '#1a1a1a', position: 'relative',
        transition: 'background 0.2s', border: `1px solid ${checked ? '#555' : '#222'}`,
      }}>
      <div style={{
        width: 14, height: 14, borderRadius: 7, background: checked ? '#ccc' : '#444',
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        transition: 'all 0.2s',
      }} />
    </div>
  );
}
