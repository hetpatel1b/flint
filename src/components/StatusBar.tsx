import { useStore } from '../store';
import { HardDrive } from 'lucide-react';

function StoneLogoTiny({ size = 10 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 120" width={size} height={size * 1.2} fill="none" style={{ opacity: 0.4 }}>
      <ellipse cx="50" cy="65" rx="35" ry="45" fill="#2a2a2a" />
      <ellipse cx="50" cy="63" rx="32" ry="42" fill="#1a1a1a" />
      <path d="M35 45 L45 65 L40 85 L50 95" stroke="#333" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M45 65 L60 72 L68 85" stroke="#333" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="65" cy="50" r="2.5" fill="#e8a030" />
    </svg>
  );
}

export function StatusBar() {
  const { state } = useStore();
  const note = state.notes.find(n => n.id === state.activeNoteId);
  const words = note ? note.content.trim().split(/\s+/).filter(Boolean).length : 0;
  const chars = note ? note.content.length : 0;
  const activeVault = state.vaults.find(v => v.id === state.activeVaultId);

  return (
    <div className="flex items-center justify-between shrink-0"
      style={{ height: 24, padding: '0 12px', background: '#060606', borderTop: '1px solid #1a1a1a', fontSize: 11, color: '#333' }}>
      <div className="flex items-center gap-4">
        <span>{words} words</span>
        <span>{chars} chars</span>
        {state.hasFolderHandle && activeVault?.isFolderVault && (
          <span className="flex items-center gap-1" style={{ color: '#556655' }}>
            <HardDrive size={10} /> {activeVault.folderPath}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span style={{ color: '#444' }}>Auto-save ✓</span>
        <div className="flex items-center gap-1">
          <StoneLogoTiny size={10} />
          <span style={{ color: '#333' }}>Flint v1.0</span>
        </div>
      </div>
    </div>
  );
}
