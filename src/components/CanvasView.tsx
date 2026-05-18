import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useStore } from '../store';
import { FlintLogo } from './FlintLogo';
import { Grip, RotateCcw, Search, X, Plus, Type, Trash2, FileText } from 'lucide-react';
import type { CanvasCard } from '../types';

// ─── Persistence ──────────────────────────────────────────────────────────────

function getCanvasKey(vaultId: string | null) {
  return `flint-canvas-state-${vaultId || 'default'}`;
}

interface CanvasConnection {
  id: string;
  fromCard: string;
  toCard: string;
  fromSide: 'top' | 'right' | 'bottom' | 'left';
  toSide: 'top' | 'right' | 'bottom' | 'left';
  color?: string;
}

interface CanvasPersistedState {
  connections: CanvasConnection[];
}

function loadCanvasState(vaultId: string | null): CanvasPersistedState {
  try {
    const raw = localStorage.getItem(getCanvasKey(vaultId));
    return raw ? JSON.parse(raw) : { connections: [] };
  } catch {
    return { connections: [] };
  }
}

function saveCanvasState(vaultId: string | null, data: CanvasPersistedState) {
  try {
    localStorage.setItem(getCanvasKey(vaultId), JSON.stringify(data));
  } catch {
    // ignore
  }
}

// ─── Card color palette (Obsidian-style) ──────────────────────────────────────

const CARD_COLORS = [
  { label: 'Default', border: 'rgba(255,255,255,0.09)', glow: '' },
  { label: 'Red',     border: '#c0544d',                glow: 'rgba(192,84,77,0.18)' },
  { label: 'Orange',  border: '#c07d40',                glow: 'rgba(192,125,64,0.18)' },
  { label: 'Yellow',  border: '#b09840',                glow: 'rgba(176,152,64,0.18)' },
  { label: 'Green',   border: '#4a9460',                glow: 'rgba(74,148,96,0.18)' },
  { label: 'Cyan',    border: '#3a8899',                glow: 'rgba(58,136,153,0.18)' },
  { label: 'Purple',  border: '#7c6f9f',                glow: 'rgba(124,111,159,0.18)' },
  { label: 'Pink',    border: '#9f507a',                glow: 'rgba(159,80,122,0.18)' },
];

// ─── Connection colors ────────────────────────────────────────────────────────

const CONN_COLORS = [
  '#6b7280', '#7c6f9f', '#4a9460', '#c0544d', '#3a8899', '#c07d40',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSidePt(card: CanvasCard, side: 'top' | 'right' | 'bottom' | 'left') {
  switch (side) {
    case 'top':    return { x: card.x + card.w / 2,  y: card.y };
    case 'bottom': return { x: card.x + card.w / 2,  y: card.y + card.h };
    case 'left':   return { x: card.x,               y: card.y + card.h / 2 };
    case 'right':  return { x: card.x + card.w,      y: card.y + card.h / 2 };
  }
}

function nearestSide(
  fromCard: CanvasCard,
  fromSide: 'top' | 'right' | 'bottom' | 'left',
  toCard: CanvasCard
): 'top' | 'right' | 'bottom' | 'left' {
  const from = getSidePt(fromCard, fromSide);
  const sides: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left'];
  let best: 'top' | 'right' | 'bottom' | 'left' = 'left';
  let bestDist = Infinity;
  for (const s of sides) {
    const pt = getSidePt(toCard, s);
    const d = Math.hypot(pt.x - from.x, pt.y - from.y);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

function bezierPath(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.abs(x2 - x1) * 0.55 + 40;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CanvasView() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const canvasDragRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Connection dragging state
  const connDragRef = useRef<{
    fromCard: string;
    fromSide: 'top' | 'right' | 'bottom' | 'left';
    mx: number;
    my: number;
  } | null>(null);
  const [connDrag, setConnDrag] = useState<{
    fromCard: string;
    fromSide: 'top' | 'right' | 'bottom' | 'left';
    mx: number;
    my: number;
  } | null>(null);

  // Card color picker open state
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);

  // Connections stored in localStorage
  const activeVaultId = state.activeVaultId;
  const [connections, setConnections] = useState<CanvasConnection[]>(
    () => loadCanvasState(activeVaultId).connections
  );

  useEffect(() => {
    saveCanvasState(activeVaultId, { connections });
  }, [connections, activeVaultId]);

  const workspace = activeVaultId ? state.vaultData[activeVaultId] : null;
  const cards = workspace?.canvasCards || [];

  // Card color map stored in localStorage
  const [cardColors, setCardColors] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(`flint-canvas-colors-${activeVaultId || 'default'}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        `flint-canvas-colors-${activeVaultId || 'default'}`,
        JSON.stringify(cardColors)
      );
    } catch {}
  }, [cardColors, activeVaultId]);

  const updateCards = useCallback((newCards: CanvasCard[]) => {
    dispatch({ type: 'UPDATE_CANVAS_CARDS', payload: newCards });
  }, [dispatch]);

  // Initial layout
  useEffect(() => {
    if (activeVaultId && cards.length === 0 && state.notes.length > 0) {
      const initialCards: CanvasCard[] = state.notes.slice(0, 20).map((note, index) => {
        const col = index % 4;
        const row = Math.floor(index / 4);
        return {
          id: note.id,
          type: 'note',
          noteId: note.id,
          x: 60 + col * 300,
          y: 80 + row * 200,
          w: 240,
          h: 140,
        };
      });
      updateCards(initialCards);
    }
  }, [activeVaultId]);

  const filteredCards = useMemo(() => {
    if (!query.trim()) return cards;
    const q = query.toLowerCase();
    return cards.filter(card => {
      if (card.type === 'note' && card.noteId) {
        const note = state.notes.find(n => n.id === card.noteId);
        return note && (
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q)
        );
      }
      return card.content?.toLowerCase().includes(q);
    });
  }, [cards, query, state.notes]);

  // Wikilink edges (auto from note content)
  const wikilinkEdges = useMemo(() => {
    const filteredIds = new Set(filteredCards.map(c => c.id));
    const noteTitleIdMap = new Map(state.notes.map(note => [note.title.toLowerCase(), note.id]));
    const pairs = new Set<string>();
    const list: Array<{ from: string; to: string }> = [];
    filteredCards.forEach(card => {
      if (card.type !== 'note' || !card.noteId) return;
      const note = state.notes.find(n => n.id === card.noteId);
      if (!note) return;
      const matches = note.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const match of matches) {
        const targetId = noteTitleIdMap.get(match[1].toLowerCase());
        if (!targetId || !filteredIds.has(targetId) || targetId === note.id) continue;
        const key = [note.id, targetId].sort().join('::');
        if (pairs.has(key)) continue;
        pairs.add(key);
        list.push({ from: note.id, to: targetId });
      }
    });
    return list;
  }, [filteredCards, state.notes]);

  const updateCard = (id: string, updates: Partial<CanvasCard>) => {
    updateCards(cards.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addTextCard = () => {
    const newCard: CanvasCard = {
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'text',
      content: '',
      x: Math.round((400 - pan.x) / zoom),
      y: Math.round((300 - pan.y) / zoom),
      w: 240,
      h: 150,
    };
    updateCards([...cards, newCard]);
  };

  const deleteCard = (id: string) => {
    updateCards(cards.filter(c => c.id !== id));
    setConnections(prev => prev.filter(c => c.fromCard !== id && c.toCard !== id));
    setCardColors(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (colorPickerOpen === id) setColorPickerOpen(null);
  };

  const deleteConnection = (id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
  };

  // ── Mouse handlers ────────────────────────────────────────────────────────

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      updateCard(dragRef.current.id, {
        x: Math.round((e.clientX - pan.x - dragRef.current.offsetX) / zoom),
        y: Math.round((e.clientY - pan.y - dragRef.current.offsetY) / zoom),
      });
    } else if (canvasDragRef.current) {
      setPan({
        x: e.clientX - canvasDragRef.current.x,
        y: e.clientY - canvasDragRef.current.y,
      });
    } else if (connDragRef.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = (e.clientX - rect.left - pan.x) / zoom;
      const my = (e.clientY - rect.top - pan.y) / zoom;
      connDragRef.current.mx = mx;
      connDragRef.current.my = my;
      setConnDrag({ ...connDragRef.current });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    // Check if connection drag ended on another card
    if (connDragRef.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = (e.clientX - rect.left - pan.x) / zoom;
      const my = (e.clientY - rect.top - pan.y) / zoom;

      // Find card under cursor
      const target = filteredCards.find(c =>
        c.id !== connDragRef.current!.fromCard &&
        mx >= c.x && mx <= c.x + c.w &&
        my >= c.y && my <= c.y + c.h
      );

      if (target) {
        const fromCard = filteredCards.find(c => c.id === connDragRef.current!.fromCard);
        if (fromCard) {
          const toSide = nearestSide(fromCard, connDragRef.current!.fromSide, target);
          const newConn: CanvasConnection = {
            id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            fromCard: connDragRef.current!.fromCard,
            toCard: target.id,
            fromSide: connDragRef.current!.fromSide,
            toSide,
            color: CONN_COLORS[connections.length % CONN_COLORS.length],
          };
          setConnections(prev => [...prev, newConn]);
        }
      }
    }

    dragRef.current = null;
    canvasDragRef.current = null;
    connDragRef.current = null;
    setConnDrag(null);
    if (containerRef.current) containerRef.current.style.cursor = 'default';
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    setColorPickerOpen(null);
    canvasDragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Math.max(0.15, Math.min(4, zoom * delta));
      setPan(p => ({
        x: mx - (mx - p.x) * (newZoom / zoom),
        y: my - (my - p.y) * (newZoom / zoom),
      }));
      setZoom(newZoom);
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const resetLayout = () => {
    if (confirm('Reset canvas layout? All card positions, connections, and text cards will be cleared.')) {
      updateCards([]);
      setConnections([]);
      setCardColors({});
      setPan({ x: 0, y: 0 });
      setZoom(1);
    }
  };

  const findCard = (id: string) => filteredCards.find(c => c.id === id);

  // ── Obsidian color palette ─────────────────────────────────────────────────
  const borderColorDefault = 'rgba(255,255,255,0.07)';
  const surfaceBg = 'rgba(22,22,22,0.97)';
  const surfaceBgActive = 'rgba(30,28,38,0.98)';

  // ─── Render connection SVG path ───────────────────────────────────────────
  const renderConnections = () => {
    const allEdges: JSX.Element[] = [];

    // Wikilink auto-edges (dashed)
    wikilinkEdges.forEach(edge => {
      const from = findCard(edge.from);
      const to = findCard(edge.to);
      if (!from || !to) return;
      const p1 = getSidePt(from, 'right');
      const p2 = getSidePt(to, 'left');
      allEdges.push(
        <g key={`wiki-${edge.from}-${edge.to}`}>
          <path
            d={bezierPath(p1.x, p1.y, p2.x, p2.y)}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1 / zoom}
            strokeDasharray={`${4 / zoom} ${4 / zoom}`}
            fill="none"
            markerEnd="url(#arrow-dim)"
          />
        </g>
      );
    });

    // Manual connections (solid, colored, deletable)
    connections.forEach(conn => {
      const from = findCard(conn.fromCard);
      const to = findCard(conn.toCard);
      if (!from || !to) return;
      const p1 = getSidePt(from, conn.fromSide);
      const p2 = getSidePt(to, conn.toSide);
      const color = conn.color || '#7c6f9f';
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      allEdges.push(
        <g key={conn.id}>
          {/* Invisible fat hit target */}
          <path
            d={bezierPath(p1.x, p1.y, p2.x, p2.y)}
            stroke="transparent"
            strokeWidth={12 / zoom}
            fill="none"
            style={{ cursor: 'pointer' }}
            onClick={() => deleteConnection(conn.id)}
          />
          <path
            d={bezierPath(p1.x, p1.y, p2.x, p2.y)}
            stroke={color}
            strokeWidth={1.5 / zoom}
            fill="none"
            strokeOpacity={0.75}
            markerEnd={`url(#arrow-colored-${conn.id})`}
            style={{ pointerEvents: 'none' }}
          />
          {/* Delete badge at midpoint */}
          <g
            transform={`translate(${midX}, ${midY})`}
            style={{ cursor: 'pointer' }}
            onClick={() => deleteConnection(conn.id)}
          >
            <circle r={7 / zoom} fill="rgba(18,18,18,0.9)" stroke={color} strokeWidth={1 / zoom} />
            <text
              x={0} y={1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8 / zoom}
              fill={color}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              ×
            </text>
          </g>
        </g>
      );
    });

    return allEdges;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 animate-fade-in overflow-hidden select-none"
      style={{ zIndex: 110, background: '#0d0d0d' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Obsidian-style fine dot grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.045) 0.8px, transparent 0.8px)`,
          backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
          backgroundPosition: `${pan.x % (28 * zoom)}px ${pan.y % (28 * zoom)}px`,
          pointerEvents: 'none',
        }}
      />

      {/* SVG layer: connections + live drag line */}
      <svg
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        <defs>
          {/* Dim arrow for wikilinks */}
          <marker id="arrow-dim" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L7,3.5 z" fill="rgba(255,255,255,0.15)" />
          </marker>
          {/* Colored arrows for manual connections */}
          {connections.map(conn => (
            <marker
              key={conn.id}
              id={`arrow-colored-${conn.id}`}
              markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"
            >
              <path d="M0,0 L0,7 L7,3.5 z" fill={conn.color || '#7c6f9f'} fillOpacity={0.75} />
            </marker>
          ))}
          {/* Live drag arrow */}
          <marker id="arrow-live" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L7,3.5 z" fill="#a78bfa" fillOpacity={0.8} />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {renderConnections()}

          {/* Live connection drag preview */}
          {connDrag && (() => {
            const fromCard = findCard(connDrag.fromCard);
            if (!fromCard) return null;
            const p1 = getSidePt(fromCard, connDrag.fromSide);
            return (
              <path
                d={bezierPath(p1.x, p1.y, connDrag.mx, connDrag.my)}
                stroke="#a78bfa"
                strokeWidth={1.5 / zoom}
                strokeDasharray={`${5 / zoom} ${3 / zoom}`}
                fill="none"
                strokeOpacity={0.7}
                markerEnd="url(#arrow-live)"
              />
            );
          })()}
        </g>
      </svg>

      {/* Canvas cards */}
      <div
        style={{
          position: 'absolute', inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        onMouseDown={handleCanvasMouseDown}
      >
        {filteredCards.map(card => {
          const isNote = card.type === 'note';
          const note = isNote ? state.notes.find(n => n.id === card.noteId) : null;
          const isActive = isNote && note?.id === state.activeNoteId;

          const previewLines = isNote && note
            ? note.content
                .split('\n')
                .filter(line => line.trim() && !line.startsWith('#'))
                .slice(0, 6)
                .join('\n')
            : '';

          const titleLine = isNote && note
            ? note.content.split('\n').find(l => l.startsWith('# '))?.replace(/^# /, '') || note.title
            : 'Text Note';

          const colorIdx = cardColors[card.id] ?? 0;
          const cardColor = CARD_COLORS[colorIdx];
          const isColorPickerOpen = colorPickerOpen === card.id;

          const cardBorder = isActive
            ? 'rgba(167,139,250,0.5)'
            : cardColor.border;

          const SIDES: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left'];
          const sideStyle = (side: 'top' | 'right' | 'bottom' | 'left'): React.CSSProperties => {
            const base: React.CSSProperties = {
              position: 'absolute',
              background: '#a78bfa',
              borderRadius: '50%',
              width: 10 / zoom,
              height: 10 / zoom,
              zIndex: 5,
              cursor: 'crosshair',
              opacity: 0,
              transition: 'opacity 0.1s',
              transform: 'translate(-50%, -50%)',
            };
            if (side === 'top')    return { ...base, top: 0, left: '50%' };
            if (side === 'bottom') return { ...base, bottom: -10 / zoom, left: '50%', transform: 'translate(-50%, 0)' };
            if (side === 'left')   return { ...base, top: '50%', left: 0 };
            return { ...base, top: '50%', right: -10 / zoom, left: 'auto', transform: 'translate(0, -50%)' };
          };

          return (
            <div
              key={card.id}
              className="canvas-card-root"
              style={{
                position: 'absolute',
                left: card.x,
                top: card.y,
                width: card.w,
                minHeight: card.h,
                background: isActive ? surfaceBgActive : surfaceBg,
                border: `${1 / zoom}px solid ${cardBorder}`,
                borderRadius: 6 / zoom,
                boxShadow: isActive
                  ? `0 0 0 ${2 / zoom}px rgba(167,139,250,0.12), 0 8px 32px rgba(0,0,0,0.6)`
                  : cardColor.glow
                  ? `0 0 0 ${1 / zoom}px ${cardColor.glow}, 0 4px 18px rgba(0,0,0,0.5)`
                  : '0 4px 18px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'visible',
              }}
              onClick={e => {
                e.stopPropagation();
                setColorPickerOpen(null);
              }}
            >
              {/* Connection dots — shown on hover via CSS */}
              <style>{`
                .canvas-card-root:hover .conn-dot { opacity: 0.75 !important; }
                .conn-dot:hover { opacity: 1 !important; background: #c4b5fd !important; }
              `}</style>

              {SIDES.map(side => (
                <div
                  key={side}
                  className="conn-dot"
                  style={sideStyle(side)}
                  title={`Connect from ${side}`}
                  onMouseDown={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    const rect = containerRef.current!.getBoundingClientRect();
                    const fromCard = filteredCards.find(c => c.id === card.id)!;
                    const pt = getSidePt(fromCard, side);
                    connDragRef.current = { fromCard: card.id, fromSide: side, mx: pt.x, my: pt.y };
                    setConnDrag({ fromCard: card.id, fromSide: side, mx: pt.x, my: pt.y });
                  }}
                />
              ))}

              {/* Card header */}
              <div
                onMouseDown={e => {
                  e.stopPropagation();
                  dragRef.current = {
                    id: card.id,
                    offsetX: e.clientX - pan.x - card.x * zoom,
                    offsetY: e.clientY - pan.y - card.y * zoom,
                  };
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `${6 / zoom}px ${8 / zoom}px`,
                  borderBottom: `${1 / zoom}px solid rgba(255,255,255,0.04)`,
                  cursor: 'grab',
                  background: 'rgba(0,0,0,0.25)',
                  flexShrink: 0,
                  borderRadius: `${6 / zoom}px ${6 / zoom}px 0 0`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 / zoom, minWidth: 0, flex: 1 }}>
                  <Grip size={9 / zoom} style={{ color: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
                  {isNote && <FileText size={9 / zoom} style={{ color: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />}
                  <span style={{
                    fontSize: 11 / zoom,
                    fontWeight: 500,
                    color: isActive ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.52)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {titleLine}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 2 / zoom, flexShrink: 0 }}>
                  {/* Color picker toggle */}
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation();
                      setColorPickerOpen(prev => prev === card.id ? null : card.id);
                    }}
                    title="Card color"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: `${2 / zoom}px`, display: 'flex', borderRadius: 3 / zoom,
                    }}
                  >
                    <div style={{
                      width: 9 / zoom, height: 9 / zoom, borderRadius: '50%',
                      background: cardColor.border === 'rgba(255,255,255,0.09)'
                        ? 'rgba(255,255,255,0.2)'
                        : cardColor.border,
                      border: `${1 / zoom}px solid rgba(255,255,255,0.2)`,
                    }} />
                  </button>

                  {isNote && (
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => {
                        e.stopPropagation();
                        dispatch({ type: 'OPEN_TAB', payload: card.noteId! });
                      }}
                      title="Open note"
                      style={{
                        background: 'none', border: 'none',
                        color: 'rgba(255,255,255,0.22)', cursor: 'pointer',
                        padding: `${2 / zoom}px`, display: 'flex', borderRadius: 3 / zoom,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = 'rgba(255,255,255,0.22)';
                        e.currentTarget.style.background = 'none';
                      }}
                    >
                      <Plus size={10 / zoom} />
                    </button>
                  )}
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); deleteCard(card.id); }}
                    title="Remove from canvas"
                    style={{
                      background: 'none', border: 'none',
                      color: 'rgba(255,255,255,0.22)', cursor: 'pointer',
                      padding: `${2 / zoom}px`, display: 'flex', borderRadius: 3 / zoom,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = 'rgba(200,70,70,0.85)';
                      e.currentTarget.style.background = 'rgba(200,70,70,0.1)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'rgba(255,255,255,0.22)';
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    <Trash2 size={10 / zoom} />
                  </button>
                </div>
              </div>

              {/* Color picker dropdown */}
              {isColorPickerOpen && (
                <div
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: (36 / zoom),
                    right: 0,
                    background: 'rgba(18,18,18,0.97)',
                    border: `${1 / zoom}px solid rgba(255,255,255,0.1)`,
                    borderRadius: 7 / zoom,
                    padding: 8 / zoom,
                    display: 'flex',
                    gap: 6 / zoom,
                    zIndex: 20,
                    boxShadow: `0 8px 28px rgba(0,0,0,0.7)`,
                  }}
                >
                  {CARD_COLORS.map((col, idx) => (
                    <div
                      key={col.label}
                      title={col.label}
                      onClick={() => {
                        setCardColors(prev => ({ ...prev, [card.id]: idx }));
                        setColorPickerOpen(null);
                      }}
                      style={{
                        width: 14 / zoom, height: 14 / zoom,
                        borderRadius: '50%',
                        background: col.border === 'rgba(255,255,255,0.09)'
                          ? 'rgba(255,255,255,0.18)'
                          : col.border,
                        cursor: 'pointer',
                        border: colorIdx === idx
                          ? `${2 / zoom}px solid rgba(255,255,255,0.7)`
                          : `${1 / zoom}px solid rgba(255,255,255,0.15)`,
                        transition: 'transform 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    />
                  ))}
                </div>
              )}

              {/* Card body */}
              <div style={{
                padding: `${8 / zoom}px ${10 / zoom}px`,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
              }}>
                {isNote ? (
                  <div style={{
                    fontSize: 11 / zoom,
                    color: 'rgba(255,255,255,0.42)',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflow: 'hidden',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}>
                    {previewLines.slice(0, 220) || (
                      <span style={{ color: 'rgba(255,255,255,0.18)', fontStyle: 'italic' }}>
                        Empty note
                      </span>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={card.content || ''}
                    onChange={e => updateCard(card.id, { content: e.target.value })}
                    onMouseDown={e => e.stopPropagation()}
                    placeholder="Write something..."
                    style={{
                      flex: 1,
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      outline: 'none',
                      color: 'rgba(255,255,255,0.68)',
                      fontSize: 11 / zoom,
                      resize: 'none',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                      lineHeight: 1.65,
                      minHeight: 90 / zoom,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Header toolbar */}
      <div
        className="flex items-center justify-between"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '9px 14px',
          background: 'rgba(13,13,13,0.94)',
          borderBottom: `1px solid ${borderColorDefault}`,
          backdropFilter: 'blur(14px)',
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-3">
          <FlintLogo size={14} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.2 }}>
            Canvas
          </span>
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.28)',
            background: 'rgba(255,255,255,0.04)',
            padding: '2px 8px', borderRadius: 4,
            border: `1px solid ${borderColorDefault}`,
          }}>
            {filteredCards.length} cards · {wikilinkEdges.length + connections.length} links
          </span>

          {/* Add text card */}
          <button
            onClick={addTextCard}
            title="Add text card"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${borderColorDefault}`,
              color: 'rgba(255,255,255,0.45)',
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: 5,
              fontSize: 11,
              display: 'flex', alignItems: 'center', gap: 5,
              letterSpacing: 0.1,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(124,111,159,0.15)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.82)';
              e.currentTarget.style.borderColor = 'rgba(124,111,159,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.45)';
              e.currentTarget.style.borderColor = borderColorDefault;
            }}
          >
            <Type size={11} />
            Add card
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2" style={{
            padding: '5px 10px',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${borderColorDefault}`,
            borderRadius: 6,
          }}>
            <Search size={11} style={{ color: 'rgba(255,255,255,0.28)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter cards..."
              style={{
                background: 'none', border: 'none', outline: 'none',
                color: 'rgba(255,255,255,0.8)', fontSize: 12, width: 150,
                fontFamily: 'inherit',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.28)', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Zoom */}
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.28)',
            fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'center',
          }}>
            {Math.round(zoom * 100)}%
          </span>

          {/* Reset */}
          <button
            onClick={resetLayout}
            title="Reset layout"
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.28)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', fontSize: 11, padding: '4px 6px', borderRadius: 4,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.28)';
              e.currentTarget.style.background = 'none';
            }}
          >
            <RotateCcw size={13} />
          </button>

          {/* Close */}
          <button
            onClick={() => dispatch({ type: 'TOGGLE_CANVAS_VIEW' })}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.28)', cursor: 'pointer',
              display: 'flex', padding: 4, borderRadius: 4,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.28)';
              e.currentTarget.style.background = 'none';
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Hint bar */}
      <div style={{
        position: 'absolute', bottom: 12, left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 10, color: 'rgba(255,255,255,0.18)',
        display: 'flex', gap: 10,
        pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        <span>Scroll to pan</span>
        <span>·</span>
        <span>Ctrl+Scroll to zoom</span>
        <span>·</span>
        <span>Drag header to move</span>
        <span>·</span>
        <span>Hover card edge to connect</span>
      </div>
    </div>
  );
}
