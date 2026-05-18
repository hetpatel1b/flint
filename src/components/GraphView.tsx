import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useStore } from '../store';
import { FlintLogo } from './FlintLogo';
import { X, ZoomIn, ZoomOut, RotateCcw, Search, Maximize2, Settings, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  conns: number;
}

interface GEdge {
  from: string;
  to: string;
}

type LayoutMode = 'force' | 'ring';

// ─── Constants (matching Obsidian's real palette from the screenshot) ─────────

const OBS_BG        = '#0d0d0d';
const OBS_BLUE      = '#4a9ef5';          // Obsidian's selection / highlight blue
const OBS_NODE_BASE = '#c8cdd6';          // the muted white-gray nodes in the image
const GRID_DOT      = 'rgba(255,255,255,0.032)';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) || 0;
  const g = parseInt(c.substring(2, 4), 16) || 0;
  const b = parseInt(c.substring(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getSettingsKey(vaultId: string | null) {
  return `flint-graph-settings-${vaultId || 'default'}`;
}
function loadSettings(vaultId: string | null) {
  try { const r = localStorage.getItem(getSettingsKey(vaultId)); return r ? JSON.parse(r) : null; }
  catch { return null; }
}
function saveSettings(vaultId: string | null, s: Record<string, unknown>) {
  try { localStorage.setItem(getSettingsKey(vaultId), JSON.stringify(s)); } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphView() {
  const { state, dispatch } = useStore();

  // Mutable refs shared with the render loop — no re-renders needed
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const nodesRef      = useRef<GNode[]>([]);
  const edgesRef      = useRef<GEdge[]>([]);
  const dragRef       = useRef<string | null>(null);
  const wasDragRef    = useRef(false);
  const panRef        = useRef({ x: 0, y: 0, dragging: false, sx: 0, sy: 0 });
  const zoomRef       = useRef(1);
  const animRef       = useRef(0);
  const hoverRef      = useRef<string | null>(null);
  const sizeRef       = useRef({ w: 0, h: 0 });
  const layoutModeRef = useRef<LayoutMode>('force');
  // Simulation cool-down: 1 = hot, 0 = frozen. Avoids wasting CPU when settled.
  const alphaRef      = useRef(1);

  // UI state
  const [query,        setQuery]        = useState('');
  const [stats,        setStats]        = useState({ nodes: 0, edges: 0 });
  const [zoom,         setZoom]         = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layoutMode,   setLayoutMode]   = useState<LayoutMode>('force');

  // Appearance settings (persisted per-vault)
  const saved = useMemo(() => loadSettings(state.activeVaultId), [state.activeVaultId]);
  const [nodeColor,     setNodeColor]     = useState<string>(saved?.nodeColor     ?? OBS_NODE_BASE);
  const [activeColor,   setActiveColor]   = useState<string>(saved?.activeColor   ?? OBS_BLUE);
  const [lineColor,     setLineColor]     = useState<string>(saved?.lineColor     ?? '#6b7280');
  const [nodeBaseSize,  setNodeBaseSize]  = useState<number>(saved?.nodeBaseSize  ?? 5);
  const [connBoost,     setConnBoost]     = useState<number>(saved?.connBoost     ?? 1.5);
  const [lineWidth,     setLineWidth]     = useState<number>(saved?.lineWidth     ?? 1);
  const [lineOpacity,   setLineOpacity]   = useState<number>(saved?.lineOpacity   ?? 0.5);
  const [showAllLabels, setShowAllLabels] = useState<boolean>(saved?.showAllLabels ?? false);
  const [repulsion,     setRepulsion]     = useState<number>(saved?.repulsion     ?? 120);
  const [linkDist,      setLinkDist]      = useState<number>(saved?.linkDist      ?? 85);

  // Mirror settings into a ref so the render loop always reads current values
  const sRef = useRef({ nodeColor, activeColor, lineColor, nodeBaseSize, connBoost, lineWidth, lineOpacity, showAllLabels, repulsion, linkDist });
  useEffect(() => {
    sRef.current = { nodeColor, activeColor, lineColor, nodeBaseSize, connBoost, lineWidth, lineOpacity, showAllLabels, repulsion, linkDist };
    saveSettings(state.activeVaultId, sRef.current);
    alphaRef.current = 1; // reheat so changes are visible
  }, [nodeColor, activeColor, lineColor, nodeBaseSize, connBoost, lineWidth, lineOpacity, showAllLabels, repulsion, linkDist, state.activeVaultId]);

  useEffect(() => { layoutModeRef.current = layoutMode; alphaRef.current = 1; }, [layoutMode]);

  // ── Build graph ─────────────────────────────────────────────────────────────

  const buildGraph = useCallback(() => {
    const titleMap = new Map(state.notes.map(n => [n.title.toLowerCase(), n.id]));
    const adjMap: Record<string, Set<string>> = {};
    state.notes.forEach(n => { adjMap[n.id] = new Set(); });
    state.notes.forEach(n => {
      for (const m of n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g)) {
        const tid = titleMap.get(m[1].toLowerCase());
        if (tid && tid !== n.id) {
          adjMap[n.id].add(tid);
          if (adjMap[tid]) adjMap[tid].add(n.id);
        }
      }
    });

    const { w, h } = sizeRef.current;
    const cx = w / 2 || 500, cy = h / 2 || 400;
    const existing = new Map(nodesRef.current.map(n => [n.id, { x: n.x, y: n.y }]));

    nodesRef.current = state.notes.map(note => {
      const conns = adjMap[note.id]?.size || 0;
      const old   = existing.get(note.id);
      // Spread new nodes in a small cluster so force-directed can settle naturally
      const angle = Math.random() * Math.PI * 2;
      const r     = 40 + Math.random() * 160;
      return {
        id: note.id, title: note.title, conns,
        x: old?.x ?? cx + Math.cos(angle) * r,
        y: old?.y ?? cy + Math.sin(angle) * r,
        vx: 0, vy: 0,
      };
    });

    const edgeSet = new Set<string>();
    edgesRef.current = [];
    state.notes.forEach(n => {
      for (const m of n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g)) {
        const tid = titleMap.get(m[1].toLowerCase());
        if (tid && tid !== n.id) {
          const key = [n.id, tid].sort().join('~');
          if (!edgeSet.has(key)) { edgeSet.add(key); edgesRef.current.push({ from: n.id, to: tid }); }
        }
      }
    });

    setStats({ nodes: nodesRef.current.length, edges: edgesRef.current.length });
    alphaRef.current = 1;
  }, [state.notes]);

  // ── Resize ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width; canvas.height = rect.height;
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  // ── Ring layout helper (used as extra forces when mode === 'ring') ──────────

  const ringForces = useCallback(() => {
    const nodes = nodesRef.current;
    const { w, h } = sizeRef.current;
    const cx = w / 2, cy = h / 2;
    const spread = sRef.current.linkDist * 3.2;
    const sorted = [...nodes].sort((a, b) => b.conns - a.conns);

    nodes.forEach(node => {
      const ring = node.conns >= 5 ? 0 : node.conns >= 3 ? 1 : node.conns >= 1 ? 2 : 3;
      const ring_r = spread * [0.22, 0.52, 0.88, 1.3][ring];
      const rNodes = sorted.filter(n =>
        ring === 0 ? n.conns >= 5 :
        ring === 1 ? n.conns >= 3 && n.conns < 5 :
        ring === 2 ? n.conns >= 1 && n.conns < 3 :
        n.conns === 0
      );
      const idx   = rNodes.findIndex(n => n.id === node.id);
      const count = rNodes.length;
      const angle = count > 0 ? (idx / count) * Math.PI * 2 - Math.PI / 2 : 0;
      node.vx += (cx + Math.cos(angle) * ring_r - node.x) * 0.07;
      node.vy += (cy + Math.sin(angle) * ring_r - node.y) * 0.07;
    });
  }, []);

  // ── Main animation loop ─────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let running = true;

    const getNode = (id: string) => nodesRef.current.find(n => n.id === id);

    // ── Physics (Obsidian's n-body + spring model) ──────────────────────────
    const simulate = () => {
      const alpha = alphaRef.current;
      if (alpha < 0.0015) return; // frozen — skip CPU work

      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const s     = sRef.current;
      const { w, h } = sizeRef.current;
      const cx = w / 2, cy = h / 2;

      if (layoutModeRef.current === 'force') {
        // Many-body repulsion — identical to Obsidian's d3-force charge
        const rep = s.repulsion * 90 * alpha;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx   = nodes[j].x - nodes[i].x;
            const dy   = nodes[j].y - nodes[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const f    = rep / (dist * dist + 0.5); // soft-floor prevents blow-up
            const fx   = (dx / dist) * f;
            const fy   = (dy / dist) * f;
            nodes[i].vx -= fx; nodes[i].vy -= fy;
            nodes[j].vx += fx; nodes[j].vy += fy;
          }
        }

        // Link springs
        const natLen = s.linkDist;
        for (const e of edges) {
          const a = getNode(e.from), b = getNode(e.to);
          if (!a || !b) continue;
          const dx   = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const f    = (dist - natLen) * 0.065 * alpha;
          const fx   = (dx / dist) * f, fy = (dy / dist) * f;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }

        // Centering gravity (very light — lets graph breathe)
        for (const n of nodes) {
          n.vx += (cx - n.x) * 0.00035 * alpha;
          n.vy += (cy - n.y) * 0.00035 * alpha;
        }
      } else {
        ringForces();
      }

      // Integrate + Obsidian-style velocity decay (0.4 = strong damping → settles fast)
      for (const n of nodes) {
        if (n.id === dragRef.current) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.55;
        n.vy *= 0.55;
        const spd = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        const cap = 14 * alpha;
        if (spd > cap) { n.vx = n.vx / spd * cap; n.vy = n.vy / spd * cap; }
        n.x += n.vx;
        n.y += n.vy;
      }

      alphaRef.current *= 0.992; // exponential cool-down
    };

    // ── Draw ────────────────────────────────────────────────────────────────
    const draw = () => {
      if (!running) return;
      simulate();

      const w = canvas.width, h = canvas.height;
      const z = zoomRef.current;
      const p = panRef.current;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const s = sRef.current;
      const q = query.toLowerCase();

      // Background
      ctx.fillStyle = OBS_BG;
      ctx.fillRect(0, 0, w, h);

      // Dot grid — same density as Obsidian
      const GS = 28 * z;
      if (GS > 5) {
        ctx.fillStyle = GRID_DOT;
        const ox = ((p.x % GS) + GS) % GS;
        const oy = ((p.y % GS) + GS) % GS;
        for (let x = ox; x < w; x += GS)
          for (let y = oy; y < h; y += GS) {
            ctx.beginPath(); ctx.arc(x, y, 0.85, 0, Math.PI * 2); ctx.fill();
          }
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(z, z);

      // ── Determine focused node: hover > open tab ───────────────────────
      const focusId = hoverRef.current ?? state.activeNoteId ?? null;

      // Build connected-to-focus sets
      const connectedNodes = new Set<string>();
      const connectedEdgeIdx = new Set<number>();
      if (focusId) {
        edges.forEach((e, i) => {
          if (e.from === focusId || e.to === focusId) {
            connectedNodes.add(e.from === focusId ? e.to : e.from);
            connectedEdgeIdx.add(i);
          }
        });
      }

      const hasFocus = focusId !== null;
      const isMatch  = (n: GNode) => !q || n.title.toLowerCase().includes(q);

      // ── PASS 1: dim edges (all non-highlighted) ────────────────────────
      ctx.lineWidth = s.lineWidth / z;
      for (let i = 0; i < edges.length; i++) {
        if (connectedEdgeIdx.has(i)) continue;
        const a = getNode(edges[i].from), b = getNode(edges[i].to);
        if (!a || !b || (q && !isMatch(a) && !isMatch(b))) continue;

        // When something is focused, all other edges fade hard (exact Obsidian behaviour)
        const opacity = hasFocus ? s.lineOpacity * 0.12 : s.lineOpacity;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(180,185,200,${opacity})`;
        ctx.stroke();
      }

      // ── PASS 2: blue highlighted edges ────────────────────────────────
      if (hasFocus) {
        ctx.lineWidth = (s.lineWidth + 0.5) / z;
        for (const i of connectedEdgeIdx) {
          const a = getNode(edges[i].from), b = getNode(edges[i].to);
          if (!a || !b) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          // Obsidian blue lines: visible but not loud — 0.5 opacity is exactly right
          ctx.strokeStyle = hexToRgba(OBS_BLUE, 0.5);
          ctx.stroke();
        }
      }

      // ── PASS 3: nodes ─────────────────────────────────────────────────
      for (const n of nodes) {
        if (q && !isMatch(n)) continue;

        const isFocus     = n.id === focusId;
        const isConnected = connectedNodes.has(n.id);
        const isOpenNote  = n.id === state.activeNoteId;

        // Radius — more connections → slightly larger, like Obsidian
        const boost  = Math.min(n.conns * s.connBoost * 0.45, s.nodeBaseSize * 2);
        const radius = s.nodeBaseSize + boost;

        // Very subtle glow on focused node only — Obsidian keeps this minimal
        if (isFocus) {
          const gr = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 3.2);
          gr.addColorStop(0, hexToRgba(OBS_BLUE, 0.14));
          gr.addColorStop(1, hexToRgba(OBS_BLUE, 0));
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = gr;
          ctx.fill();
        }

        // Node fill colour
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);

        if (isFocus || isOpenNote) {
          // Focused / active: slightly blue-white tint — matches the screenshot
          ctx.fillStyle = '#d6e0f5';
        } else if (isConnected) {
          // Neighbour nodes stay at full brightness
          ctx.fillStyle = hasFocus
            ? hexToRgba(s.nodeColor, 0.88)
            : hexToRgba(s.nodeColor, 0.78);
        } else if (n.conns === 0) {
          // Orphan: very dim — almost invisible when something is focused
          ctx.fillStyle = hasFocus
            ? hexToRgba(s.nodeColor, 0.08)
            : hexToRgba(s.nodeColor, 0.3);
        } else {
          // Normal connected nodes: fade when something else is focused
          ctx.fillStyle = hasFocus
            ? hexToRgba(s.nodeColor, 0.14)
            : hexToRgba(s.nodeColor, 0.72);
        }
        ctx.fill();

        // Thin blue ring on focused node
        if (isFocus) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius + 2 / z, 0, Math.PI * 2);
          ctx.strokeStyle = hexToRgba(OBS_BLUE, 0.42);
          ctx.lineWidth   = 1.2 / z;
          ctx.stroke();
        }

        // ── Label ────────────────────────────────────────────────────────
        const showLabel = s.showAllLabels || isFocus || isConnected || isOpenNote;
        if (!showLabel) continue;

        const fs   = (isFocus ? 12 : 10.5) / z;
        const text = n.title.length > 30 ? n.title.slice(0, 28) + '…' : n.title;
        ctx.font      = `${isFocus ? '500' : '400'} ${fs}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';

        const tw   = ctx.measureText(text).width;
        const tx   = n.x;
        const ty   = n.y + radius + 13 / z;
        const pH   = 5 / z, pV = 2.5 / z;

        // Pill label background
        const bx = tx - tw / 2 - pH, by = ty - fs;
        const bw = tw + pH * 2,       bh = fs + pV * 2;
        const br = 3 / z;
        ctx.fillStyle = 'rgba(8,8,8,0.72)';
        ctx.beginPath();
        ctx.moveTo(bx + br, by);
        ctx.lineTo(bx + bw - br, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
        ctx.lineTo(bx + bw, by + bh - br);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
        ctx.lineTo(bx + br, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
        ctx.lineTo(bx, by + br);
        ctx.quadraticCurveTo(bx, by, bx + br, by);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = isFocus
          ? 'rgba(255,255,255,0.92)'
          : isConnected
          ? 'rgba(210,218,235,0.78)'
          : 'rgba(175,182,200,0.52)';
        ctx.fillText(text, tx, ty);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [state.activeNoteId, state.notes, query, layoutMode, ringForces]);

  // ── Hit-test ────────────────────────────────────────────────────────────────

  const getNodeAt = useCallback((mx: number, my: number) => {
    const z = zoomRef.current, p = panRef.current;
    const wx = (mx - p.x) / z, wy = (my - p.y) / z;
    const s = sRef.current;
    for (const n of [...nodesRef.current].reverse()) {
      const boost = Math.min(n.conns * s.connBoost * 0.45, s.nodeBaseSize * 2);
      const r     = s.nodeBaseSize + boost + 6;
      if ((wx - n.x) ** 2 + (wy - n.y) ** 2 < r * r) return n;
    }
    return null;
  }, []);

  // ── Mouse / wheel ────────────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    wasDragRef.current = false;
    if (node) { dragRef.current = node.id; alphaRef.current = Math.max(alphaRef.current, 0.4); }
    else {
      panRef.current.dragging = true;
      panRef.current.sx = e.clientX - panRef.current.x;
      panRef.current.sy = e.clientY - panRef.current.y;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (dragRef.current) {
      wasDragRef.current = true;
      const z = zoomRef.current, p = panRef.current;
      const node = nodesRef.current.find(n => n.id === dragRef.current);
      if (node) { node.x = (mx - p.x) / z; node.y = (my - p.y) / z; node.vx = 0; node.vy = 0; }
      alphaRef.current = Math.max(alphaRef.current, 0.5);
    } else if (panRef.current.dragging) {
      panRef.current.x = e.clientX - panRef.current.sx;
      panRef.current.y = e.clientY - panRef.current.sy;
    } else {
      const node = getNodeAt(mx, my);
      hoverRef.current = node?.id || null;
      canvasRef.current!.style.cursor = node ? 'pointer' : 'grab';
    }
  };

  const handleMouseUp  = () => { dragRef.current = null; panRef.current.dragging = false; };

  const handleClick = (e: React.MouseEvent) => {
    if (wasDragRef.current) { wasDragRef.current = false; return; }
    const rect = canvasRef.current!.getBoundingClientRect();
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (node) dispatch({ type: 'OPEN_TAB', payload: node.id });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const oldZ = zoomRef.current;
    const newZ = Math.max(0.08, Math.min(6, oldZ * (e.deltaY > 0 ? 0.92 : 1.09)));
    panRef.current.x = mx - (mx - panRef.current.x) * (newZ / oldZ);
    panRef.current.y = my - (my - panRef.current.y) * (newZ / oldZ);
    zoomRef.current  = newZ;
    setZoom(newZ);
  };

  const doZoom = (delta: number) => {
    const cx = sizeRef.current.w / 2, cy = sizeRef.current.h / 2;
    const oldZ = zoomRef.current;
    const newZ = Math.max(0.08, Math.min(6, oldZ + delta));
    panRef.current.x = cx - (cx - panRef.current.x) * (newZ / oldZ);
    panRef.current.y = cy - (cy - panRef.current.y) * (newZ / oldZ);
    zoomRef.current  = newZ;
    setZoom(newZ);
  };

  const resetView = () => {
    zoomRef.current  = 1;
    panRef.current   = { x: 0, y: 0, dragging: false, sx: 0, sy: 0 };
    alphaRef.current = 1;
    setZoom(1);
    buildGraph();
  };

  const centerGraph = () => {
    if (!nodesRef.current.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodesRef.current.forEach(n => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    panRef.current.x = sizeRef.current.w / 2 - ((minX + maxX) / 2) * zoomRef.current;
    panRef.current.y = sizeRef.current.h / 2 - ((minY + maxY) / 2) * zoomRef.current;
  };

  // ── Style tokens ─────────────────────────────────────────────────────────────

  const border = 'rgba(255,255,255,0.07)';
  const panel  = 'rgba(18,18,18,0.97)';
  const tMain  = 'rgba(255,255,255,0.82)';
  const tDim   = 'rgba(255,255,255,0.32)';
  const tSub   = 'rgba(255,255,255,0.52)';
  const iBg    = 'rgba(255,255,255,0.04)';

  const iconBtn = (fn: () => void, icon: React.ReactNode, title: string) => (
    <button
      onClick={fn} title={title}
      style={{ width: 32, height: 32, background: 'none', border: 'none', color: tDim, cursor: 'pointer', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,158,245,0.13)'; e.currentTarget.style.color = tMain; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = tDim; }}
    >{icon}</button>
  );

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 animate-fade-in" style={{ zIndex: 110, background: OBS_BG }}>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}    onMouseLeave={handleMouseUp}
        onClick={handleClick}        onWheel={handleWheel}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab' }}
      />

      {/* ── Top header bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between" style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '8px 14px',
        background: panel, borderBottom: `1px solid ${border}`,
        backdropFilter: 'blur(14px)', zIndex: 10,
      }}>
        <div className="flex items-center gap-3">
          <FlintLogo size={14} />
          <span style={{ fontSize: 12, fontWeight: 600, color: tSub, letterSpacing: 0.2 }}>Graph View</span>
          <span style={{ fontSize: 10, color: tDim, background: iBg, padding: '2px 8px', borderRadius: 4, border: `1px solid ${border}` }}>
            {stats.nodes} nodes · {stats.edges} links
          </span>

          {/* Force / Ring layout toggle */}
          <div style={{ display: 'flex', background: iBg, border: `1px solid ${border}`, borderRadius: 6, padding: 2, gap: 2 }}>
            {(['force', 'ring'] as LayoutMode[]).map(m => (
              <button key={m} onClick={() => setLayoutMode(m)} style={{
                padding: '3px 10px', borderRadius: 4, border: 'none', fontSize: 10,
                fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                background: layoutMode === m ? OBS_BLUE : 'none',
                color: layoutMode === m ? '#fff' : tDim,
              }}>
                {m === 'force' ? 'Force' : 'Ring'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2" style={{ padding: '5px 10px', background: iBg, border: `1px solid ${border}`, borderRadius: 6 }}>
            <Search size={11} style={{ color: tDim }} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter nodes…"
              style={{ background: 'none', border: 'none', outline: 'none', color: tMain, fontSize: 12, width: 130, fontFamily: 'inherit' }} />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: tDim, cursor: 'pointer', display: 'flex', padding: 0 }}>
                <X size={11} />
              </button>
            )}
          </div>

          <span style={{ fontSize: 10, color: tDim, minWidth: 38, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(zoom * 100)}%
          </span>

          <button onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
            style={{ background: 'none', border: 'none', color: tDim, cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 4 }}
            onMouseEnter={e => { e.currentTarget.style.color = tMain; e.currentTarget.style.background = iBg; }}
            onMouseLeave={e => { e.currentTarget.style.color = tDim; e.currentTarget.style.background = 'none'; }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Settings panel ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 52, right: 12, width: 232,
        background: panel, backdropFilter: 'blur(14px)',
        border: `1px solid ${border}`, borderRadius: 8,
        overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
      }}>
        <button onClick={() => setSettingsOpen(o => !o)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 12px', background: 'none', border: 'none', color: tMain, cursor: 'pointer',
          borderBottom: settingsOpen ? `1px solid ${border}` : 'none',
        }}>
          <div className="flex items-center gap-2">
            <Settings size={12} style={{ color: tDim }} />
            <span style={{ fontSize: 11, fontWeight: 500 }}>Appearance</span>
          </div>
          {settingsOpen ? <ChevronDown size={12} style={{ color: tDim }} /> : <ChevronRight size={12} style={{ color: tDim }} />}
        </button>

        {settingsOpen && (
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '62vh', overflowY: 'auto' }}>

            {/* Nodes */}
            <section>
              <p style={{ fontSize: 9, fontWeight: 700, color: tDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Nodes</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { l: 'Colour', el: <input type="color" value={nodeColor}   onChange={e => setNodeColor(e.target.value)}   style={{ width: 22, height: 18, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }} /> },
                  { l: 'Active', el: <input type="color" value={activeColor} onChange={e => setActiveColor(e.target.value)} style={{ width: 22, height: 18, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }} /> },
                ].map(({ l, el }) => (
                  <div key={l} className="flex items-center gap-2">
                    <span style={{ fontSize: 11, color: tSub, width: 58 }}>{l}</span>{el}
                  </div>
                ))}
                {([
                  { l: 'Size',  min: 2,  max: 12, st: 0.5, v: nodeBaseSize, s: setNodeBaseSize as (v: number) => void },
                  { l: 'Boost', min: 0,  max: 4,  st: 0.2, v: connBoost,    s: setConnBoost    as (v: number) => void },
                ] as const).map(({ l, min, max, st, v, s }) => (
                  <div key={l} className="flex items-center gap-2">
                    <span style={{ fontSize: 11, color: tSub, width: 58 }}>{l}</span>
                    <input type="range" min={min} max={max} step={st} value={v} onChange={e => s(parseFloat(e.target.value))} style={{ flex: 1, accentColor: OBS_BLUE }} />
                    <span style={{ fontSize: 10, color: tDim, width: 22, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Lines */}
            <section>
              <p style={{ fontSize: 9, fontWeight: 700, color: tDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Lines</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, color: tSub, width: 58 }}>Colour</span>
                  <input type="color" value={lineColor} onChange={e => setLineColor(e.target.value)} style={{ width: 22, height: 18, border: 'none', borderRadius: 3, padding: 0, cursor: 'pointer' }} />
                </div>
                {([
                  { l: 'Width',   min: 0.3, max: 3,  st: 0.1,  v: lineWidth,   s: setLineWidth   as (v: number) => void, fmt: undefined },
                  { l: 'Opacity', min: 0.05,max: 1,  st: 0.05, v: lineOpacity, s: setLineOpacity as (v: number) => void, fmt: (x: number) => x.toFixed(2) },
                ] as const).map(({ l, min, max, st, v, s, fmt }) => (
                  <div key={l} className="flex items-center gap-2">
                    <span style={{ fontSize: 11, color: tSub, width: 58 }}>{l}</span>
                    <input type="range" min={min} max={max} step={st} value={v} onChange={e => s(parseFloat(e.target.value))} style={{ flex: 1, accentColor: OBS_BLUE }} />
                    <span style={{ fontSize: 10, color: tDim, width: 28, textAlign: 'right' }}>{fmt ? fmt(v) : v}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Physics */}
            <section>
              <p style={{ fontSize: 9, fontWeight: 700, color: tDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Physics</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {([
                  { l: 'Repulsion', min: 30, max: 300, st: 10, v: repulsion, s: setRepulsion as (v: number) => void },
                  { l: 'Link dist', min: 30, max: 200, st: 5,  v: linkDist,  s: setLinkDist  as (v: number) => void },
                ] as const).map(({ l, min, max, st, v, s }) => (
                  <div key={l} className="flex items-center gap-2">
                    <span style={{ fontSize: 11, color: tSub, width: 58 }}>{l}</span>
                    <input type="range" min={min} max={max} step={st} value={v} onChange={e => s(parseInt(e.target.value))} style={{ flex: 1, accentColor: OBS_BLUE }} />
                    <span style={{ fontSize: 10, color: tDim, width: 28, textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
                <label className="flex items-center gap-2" style={{ fontSize: 11, color: tSub, cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={showAllLabels} onChange={e => setShowAllLabels(e.target.checked)} style={{ accentColor: OBS_BLUE }} />
                  Show all labels
                </label>
              </div>
            </section>

            {/* Reset */}
            <button
              onClick={() => {
                setNodeColor(OBS_NODE_BASE); setActiveColor(OBS_BLUE); setLineColor('#6b7280');
                setNodeBaseSize(5); setConnBoost(1.5); setLineWidth(1); setLineOpacity(0.5);
                setShowAllLabels(false); setRepulsion(120); setLinkDist(85);
              }}
              style={{ width: '100%', padding: '7px 0', background: iBg, border: `1px solid ${border}`, borderRadius: 6, color: tSub, cursor: 'pointer', fontSize: 11 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,158,245,0.12)'; e.currentTarget.style.color = tMain; }}
              onMouseLeave={e => { e.currentTarget.style.background = iBg; e.currentTarget.style.color = tSub; }}
            >
              Reset to defaults
            </button>
          </div>
        )}
      </div>

      {/* ── Zoom controls ───────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 16, right: 12,
        display: 'flex', flexDirection: 'column', gap: 1,
        background: panel, border: `1px solid ${border}`,
        borderRadius: 8, padding: 3, backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
      }}>
        {iconBtn(() => doZoom(0.25),  <ZoomIn    size={13} />, 'Zoom in'      )}
        {iconBtn(() => doZoom(-0.25), <ZoomOut   size={13} />, 'Zoom out'     )}
        {iconBtn(centerGraph,          <Maximize2 size={13} />, 'Center graph' )}
        {iconBtn(resetView,            <RotateCcw size={13} />, 'Reset view'   )}
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 16, left: 12,
        background: panel, border: `1px solid ${border}`,
        borderRadius: 8, padding: '10px 13px',
        backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
      }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: tDim, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.9 }}>Legend</p>
        {[
          { size: 8,   bg: '#d6e0f5',    opacity: 1,    label: 'Focused / open' },
          { size: 6.5, bg: OBS_NODE_BASE,opacity: 0.82, label: 'Connected' },
          { size: 4,   bg: OBS_NODE_BASE,opacity: 0.28, label: 'Orphan' },
        ].map(({ size, bg, opacity, label }) => (
          <div key={label} className="flex items-center gap-2" style={{ marginBottom: 5 }}>
            <div style={{ width: size, height: size, borderRadius: '50%', background: bg, opacity, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: tSub }}>{label}</span>
          </div>
        ))}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${border}`, fontSize: 9, color: tDim, lineHeight: 1.7 }}>
          Scroll to zoom · Drag to pan<br />Click node to open
        </div>
      </div>
    </div>
  );
}
