import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '../store';
import { FlintLogo } from './FlintLogo';
import { 
  X, ZoomIn, ZoomOut, RotateCcw, Play, Pause, Search, 
  Settings, ChevronDown, ChevronRight, Eye, EyeOff, Sparkles
} from 'lucide-react';

interface GNode { 
  id: string; 
  title: string; 
  x: number; 
  y: number; 
  vx: number; 
  vy: number; 
  conns: number; 
  group: string;
  targetX?: number;
  targetY?: number;
}
interface GEdge { from: string; to: string; }

function graphColorKey(vaultId: string | null) {
  return `flint-graph-colors-${vaultId || 'default'}`;
}

// Generate a consistent color for a group
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 60%, 65%)`;
}

export function GraphView() {
  const { state, dispatch } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GNode[]>([]);
  const edgesRef = useRef<GEdge[]>([]);
  const dragRef = useRef<string | null>(null);
  const wasDragRef = useRef(false);
  const panRef = useRef({ x: 0, y: 0, dragging: false, sx: 0, sy: 0 });
  const zoomRef = useRef(1);
  const animRef = useRef(0);
  const physicsRef = useRef(true);
  const hoverRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const groupTargetRef = useRef<Record<string, { x: number; y: number }>>({});
  const sizeRef = useRef({ w: 0, h: 0 });
  const timeRef = useRef(0);
  
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0 });
  const [filterQuery, setFilterQuery] = useState('');
  const [depthFilter, setDepthFilter] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(true);
  
  // Display settings
  const [showLabels, setShowLabels] = useState<'none' | 'hover' | 'all'>('hover');
  const [showOrphans, setShowOrphans] = useState(true);
  const [showArrows, setShowArrows] = useState(false);
  const [colorByGroup, setColorByGroup] = useState(true);
  
  // Force settings
  const [nodeSize, setNodeSize] = useState(4);
  const [linkDistance, setLinkDistance] = useState(120);
  const [repelForce, setRepelForce] = useState(100);
  const [centerForce, setCenterForce] = useState(0.05);
  const [linkForce, setLinkForce] = useState(0.4);
  
  const [groupColors, setGroupColors] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(graphColorKey(state.activeVaultId));
      setGroupColors(raw ? JSON.parse(raw) as Record<string, string> : {});
    } catch {
      setGroupColors({});
    }
  }, [state.activeVaultId]);

  useEffect(() => {
    try {
      localStorage.setItem(graphColorKey(state.activeVaultId), JSON.stringify(groupColors));
    } catch {
      // ignore
    }
  }, [groupColors, state.activeVaultId]);

  const buildGraph = useCallback(() => {
    const links: Record<string, Set<string>> = {};
    const noteTitleIdMap = new Map(state.notes.map(n => [n.title.toLowerCase(), n.id]));

    state.notes.forEach(n => { links[n.id] = new Set(); });
    state.notes.forEach(n => {
      const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const m of matches) {
        const targetId = noteTitleIdMap.get(m[1].toLowerCase());
        if (targetId && targetId !== n.id) {
          links[n.id].add(targetId);
          links[targetId].add(n.id);
        }
      }
    });

    const cx = sizeRef.current.w / 2 || 400;
    const cy = sizeRef.current.h / 2 || 300;

    const deriveGroup = (note: typeof state.notes[number]) => {
      if (note.folderId) {
        const folder = state.folders.find(f => f.id === note.folderId);
        return folder?.name || 'root';
      }
      if (note.filePath && note.filePath.includes('/')) {
        const parts = note.filePath.split('/');
        if (parts.length > 1) return parts[0];
      }
      return 'root';
    };

    const groups = Array.from(new Set(state.notes.map(deriveGroup)));
    const targetMap: Record<string, { x: number; y: number }> = {};
    groups.forEach((g, i) => {
      const angle = (i / Math.max(groups.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(sizeRef.current.w, sizeRef.current.h) * 0.25;
      targetMap[g] = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      };
    });
    groupTargetRef.current = targetMap;

    // Preserve positions for existing nodes
    const existingPositions = new Map(nodesRef.current.map(n => [n.id, { x: n.x, y: n.y }]));

    nodesRef.current = state.notes.map((n) => {
      const group = deriveGroup(n);
      const existing = existingPositions.get(n.id);
      const target = targetMap[group] || { x: cx, y: cy };
      
      return {
        group,
        id: n.id, 
        title: n.title,
        x: existing?.x ?? target.x + (Math.random() - 0.5) * 100,
        y: existing?.y ?? target.y + (Math.random() - 0.5) * 100,
        vx: 0, 
        vy: 0,
        conns: links[n.id]?.size || 0,
      };
    });

    const edgeSet = new Set<string>();
    edgesRef.current = [];
    state.notes.forEach(n => {
      const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const m of matches) {
        const targetId = noteTitleIdMap.get(m[1].toLowerCase());
        if (targetId && targetId !== n.id) {
          const key = [n.id, targetId].sort().join('-');
          if (!edgeSet.has(key)) { 
            edgeSet.add(key); 
            edgesRef.current.push({ from: n.id, to: targetId }); 
          }
        }
      }
    });

    setGraphStats({ nodes: nodesRef.current.length, edges: edgesRef.current.length });
  }, [state.notes, state.folders]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      sizeRef.current = { w: rect.width, h: rect.height };
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    let running = true;

    function getNode(id: string) { return nodesRef.current.find(n => n.id === id); }

    function getVisibleNodeIds(): Set<string> | null {
      if (depthFilter === 0) return null;
      const activeId = state.activeNoteId;
      if (!activeId) return null;
      const visible = new Set<string>();
      const queue: Array<{ id: string; depth: number }> = [{ id: activeId, depth: 0 }];
      const visited = new Set<string>([activeId]);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        visible.add(curr.id);
        if (curr.depth >= depthFilter) continue;
        for (const edge of edgesRef.current) {
          let neighborId: string | null = null;
          if (edge.from === curr.id) neighborId = edge.to;
          else if (edge.to === curr.id) neighborId = edge.from;
          if (neighborId && !visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push({ id: neighborId, depth: curr.depth + 1 });
          }
        }
      }
      return visible;
    }

    function simulate() {
      if (!physicsRef.current) return;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const cx = sizeRef.current.w / 2;
      const cy = sizeRef.current.h / 2;

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (repelForce * repelForce) / (d * d);
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Springs
      for (const e of edges) {
        const a = getNode(e.from);
        const b = getNode(e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (d - linkDistance) * linkForce * 0.01;
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (cx - n.x) * centerForce * 0.001;
        n.vy += (cy - n.y) * centerForce * 0.001;
      }

      // Apply & dampen
      for (const n of nodes) {
        if (n.id === dragRef.current) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx *= 0.6;
        n.vy *= 0.6;
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > 8) {
          n.vx = (n.vx / speed) * 8;
          n.vy = (n.vy / speed) * 8;
        }
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    function draw() {
      if (!running) return;
      timeRef.current += 0.016;
      simulate();

      const w = sizeRef.current.w;
      const h = sizeRef.current.h;
      const z = zoomRef.current;
      const p = panRef.current;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      // Background gradient - Obsidian style dark
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.8);
      bgGrad.addColorStop(0, '#1a1a2e');
      bgGrad.addColorStop(0.5, '#16161a');
      bgGrad.addColorStop(1, '#0f0f12');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle grid pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 1;
      const gridSize = 50 * z;
      if (gridSize > 15) {
        const offsetX = (p.x % gridSize + gridSize) % gridSize;
        const offsetY = (p.y % gridSize + gridSize) % gridSize;
        for (let x = offsetX; x < w; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = offsetY; y < h; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }

      const visibleIds = getVisibleNodeIds();
      const queryLower = filterQuery.toLowerCase();
      const matchesFilter = (n: GNode) => !queryLower || n.title.toLowerCase().includes(queryLower);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(z, z);

      // Draw edges with glow
      for (const e of edges) {
        const a = getNode(e.from);
        const b = getNode(e.to);
        if (!a || !b) continue;
        if (!showOrphans && (a.conns === 0 || b.conns === 0)) continue;
        if (visibleIds && (!visibleIds.has(a.id) || !visibleIds.has(b.id))) continue;
        if (queryLower && !matchesFilter(a) && !matchesFilter(b)) continue;

        const isHover = hoverRef.current === e.from || hoverRef.current === e.to;
        const isActive = state.activeNoteId === e.from || state.activeNoteId === e.to;
        const isSelected = selectedRef.current === e.from || selectedRef.current === e.to;

        // Edge glow for highlighted states
        if (isHover || isActive || isSelected) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = isActive 
            ? 'rgba(136, 192, 208, 0.3)' 
            : isHover 
            ? 'rgba(180, 142, 173, 0.25)' 
            : 'rgba(163, 190, 140, 0.2)';
          ctx.lineWidth = isActive ? 4 : 3;
          ctx.stroke();
        }

        // Main edge line
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = isActive 
          ? 'rgba(136, 192, 208, 0.8)' 
          : isHover 
          ? 'rgba(180, 142, 173, 0.6)' 
          : isSelected 
          ? 'rgba(163, 190, 140, 0.5)'
          : 'rgba(94, 129, 172, 0.25)';
        ctx.lineWidth = isActive ? 1.5 : isHover ? 1.2 : 0.8;
        ctx.stroke();

        // Arrow
        if (showArrows) {
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          const arrowSize = 6;
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(arrowSize, 0);
          ctx.lineTo(-arrowSize, -arrowSize / 2);
          ctx.lineTo(-arrowSize, arrowSize / 2);
          ctx.closePath();
          ctx.fillStyle = 'rgba(94, 129, 172, 0.4)';
          ctx.fill();
          ctx.restore();
        }
      }

      // Draw nodes
      const activeId = state.activeNoteId;
      
      // Sort: orphans first, then by connections, active last
      const sortedNodes = [...nodes].sort((a, b) => {
        if (a.id === activeId) return 1;
        if (b.id === activeId) return -1;
        if (a.conns === 0 && b.conns > 0) return -1;
        if (b.conns === 0 && a.conns > 0) return 1;
        return a.conns - b.conns;
      });

      for (const n of sortedNodes) {
        if (!showOrphans && n.conns === 0) continue;
        if (visibleIds && !visibleIds.has(n.id)) continue;
        
        const dimmed = queryLower && !matchesFilter(n);
        if (dimmed) continue;

        const baseSize = nodeSize + Math.sqrt(n.conns) * 1.5;
        const isActive = n.id === activeId;
        const isHover = n.id === hoverRef.current;
        const isSelected = n.id === selectedRef.current;
        const isOrphan = n.conns === 0;

        // Get node color
        let nodeColor: string;
        if (isActive) {
          nodeColor = '#88c0d0';
        } else if (colorByGroup && groupColors[n.group]) {
          nodeColor = groupColors[n.group];
        } else if (colorByGroup) {
          nodeColor = stringToColor(n.group);
        } else if (isOrphan) {
          nodeColor = '#4c566a';
        } else {
          nodeColor = '#81a1c1';
        }

        // Outer glow for active/hovered nodes
        if (isActive || isHover || isSelected) {
          const glowSize = baseSize * (isActive ? 3 : 2.2);
          const glowGrad = ctx.createRadialGradient(n.x, n.y, baseSize * 0.5, n.x, n.y, glowSize);
          
          if (isActive) {
            glowGrad.addColorStop(0, 'rgba(136, 192, 208, 0.4)');
            glowGrad.addColorStop(0.4, 'rgba(136, 192, 208, 0.15)');
            glowGrad.addColorStop(1, 'rgba(136, 192, 208, 0)');
          } else if (isHover) {
            glowGrad.addColorStop(0, 'rgba(180, 142, 173, 0.3)');
            glowGrad.addColorStop(0.5, 'rgba(180, 142, 173, 0.1)');
            glowGrad.addColorStop(1, 'rgba(180, 142, 173, 0)');
          } else {
            glowGrad.addColorStop(0, 'rgba(163, 190, 140, 0.25)');
            glowGrad.addColorStop(0.5, 'rgba(163, 190, 140, 0.08)');
            glowGrad.addColorStop(1, 'rgba(163, 190, 140, 0)');
          }
          
          ctx.beginPath();
          ctx.arc(n.x, n.y, glowSize, 0, Math.PI * 2);
          ctx.fillStyle = glowGrad;
          ctx.fill();
        }

        // Pulsing effect for active node
        if (isActive) {
          const pulse = Math.sin(timeRef.current * 3) * 0.15 + 0.85;
          const pulseGrad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, baseSize * 1.8 * pulse);
          pulseGrad.addColorStop(0, 'rgba(136, 192, 208, 0.2)');
          pulseGrad.addColorStop(1, 'rgba(136, 192, 208, 0)');
          ctx.beginPath();
          ctx.arc(n.x, n.y, baseSize * 1.8 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = pulseGrad;
          ctx.fill();
        }

        // Inner glow / ambient
        if (!isOrphan) {
          const innerGlow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, baseSize * 1.2);
          innerGlow.addColorStop(0, nodeColor + '40');
          innerGlow.addColorStop(1, nodeColor + '00');
          ctx.beginPath();
          ctx.arc(n.x, n.y, baseSize * 1.2, 0, Math.PI * 2);
          ctx.fillStyle = innerGlow;
          ctx.fill();
        }

        // Main node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, baseSize, 0, Math.PI * 2);
        
        // Gradient fill for depth
        const nodeGrad = ctx.createRadialGradient(
          n.x - baseSize * 0.3, 
          n.y - baseSize * 0.3, 
          0, 
          n.x, 
          n.y, 
          baseSize * 1.2
        );
        
        if (isOrphan) {
          nodeGrad.addColorStop(0, '#5e6779');
          nodeGrad.addColorStop(1, '#3b4252');
        } else {
          nodeGrad.addColorStop(0, nodeColor);
          nodeGrad.addColorStop(1, shadeColor(nodeColor, -30));
        }
        
        ctx.fillStyle = nodeGrad;
        ctx.fill();

        // Subtle border
        if (isActive || isHover || isSelected) {
          ctx.strokeStyle = isActive ? '#88c0d0' : isHover ? '#b48ead' : '#a3be8c';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Labels
        const shouldShowLabel = 
          showLabels === 'all' || 
          (showLabels === 'hover' && (isHover || isActive || isSelected));
        
        if (shouldShowLabel) {
          const fontSize = isActive ? 11 : isHover ? 10 : 9;
          ctx.font = `${isActive ? '600' : '500'} ${fontSize}px Inter, -apple-system, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          
          // Text background for readability
          const textWidth = ctx.measureText(n.title).width;
          const textPadding = 4;
          const textY = n.y + baseSize + 14;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.beginPath();
          ctx.roundRect(
            n.x - textWidth / 2 - textPadding,
            textY - fontSize + 2,
            textWidth + textPadding * 2,
            fontSize + 4,
            3
          );
          ctx.fill();
          
          // Text
          ctx.fillStyle = isActive ? '#eceff4' : isHover ? '#d8dee9' : '#b8c5d4';
          ctx.fillText(n.title, n.x, textY);
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    }

    // Helper function to darken colors
    function shadeColor(color: string, percent: number): string {
      if (color.startsWith('hsl')) {
        const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (match) {
          const l = Math.max(0, Math.min(100, parseInt(match[3]) + percent));
          return `hsl(${match[1]}, ${match[2]}%, ${l}%)`;
        }
      }
      // For hex colors
      const num = parseInt(color.replace('#', ''), 16);
      const r = Math.max(0, Math.min(255, (num >> 16) + percent));
      const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + percent));
      const b = Math.max(0, Math.min(255, (num & 0x0000FF) + percent));
      return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    }

    animRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [state.activeNoteId, state.notes, buildGraph, filterQuery, depthFilter, nodeSize, linkDistance, 
      repelForce, centerForce, linkForce, showLabels, showOrphans, showArrows, colorByGroup, groupColors]);

  const getNodeAt = useCallback((mx: number, my: number) => {
    const z = zoomRef.current;
    const p = panRef.current;
    const wx = (mx - p.x) / z;
    const wy = (my - p.y) / z;
    for (const n of [...nodesRef.current].reverse()) {
      const r = (nodeSize + Math.sqrt(n.conns) * 1.5) + 8;
      if ((wx - n.x) ** 2 + (wy - n.y) ** 2 < r * r) return n;
    }
    return null;
  }, [nodeSize]);

  const handleDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    wasDragRef.current = false;
    if (n) {
      dragRef.current = n.id;
      const node = nodesRef.current.find(nd => nd.id === n.id);
      if (node) { node.vx = 0; node.vy = 0; }
    } else {
      panRef.current.dragging = true;
      panRef.current.sx = e.clientX - panRef.current.x;
      panRef.current.sy = e.clientY - panRef.current.y;
    }
  };

  const handleMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    if (dragRef.current) {
      wasDragRef.current = true;
      const z = zoomRef.current;
      const p = panRef.current;
      const n = nodesRef.current.find(nd => nd.id === dragRef.current);
      if (n) {
        n.x = (e.clientX - rect.left - p.x) / z;
        n.y = (e.clientY - rect.top - p.y) / z;
        n.vx = 0;
        n.vy = 0;
      }
    } else if (panRef.current.dragging) {
      panRef.current.x = e.clientX - panRef.current.sx;
      panRef.current.y = e.clientY - panRef.current.sy;
    } else {
      const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      hoverRef.current = n ? n.id : null;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = n ? 'pointer' : 'grab';
      }
    }
  };

  const handleUp = () => {
    if (dragRef.current) {
      const n = nodesRef.current.find(nd => nd.id === dragRef.current);
      if (n) { n.vx = 0; n.vy = 0; }
    }
    dragRef.current = null;
    panRef.current.dragging = false;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'grab';
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (wasDragRef.current) { wasDragRef.current = false; return; }
    const rect = canvasRef.current!.getBoundingClientRect();
    const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (n) {
      selectedRef.current = n.id;
      dispatch({ type: 'OPEN_TAB', payload: n.id });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const oldZoom = zoomRef.current;
    const newZoom = Math.max(0.1, Math.min(6, oldZoom * (1 - e.deltaY * 0.001)));
    
    // Zoom toward cursor
    panRef.current.x = mx - (mx - panRef.current.x) * (newZoom / oldZoom);
    panRef.current.y = my - (my - panRef.current.y) * (newZoom / oldZoom);
    
    zoomRef.current = newZoom;
  };

  const reset = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0, dragging: false, sx: 0, sy: 0 };
    buildGraph();
  };

  const togglePhysics = () => { physicsRef.current = !physicsRef.current; };

  // Get unique groups for legend
  const groups = [...new Set(nodesRef.current.map(n => n.group))];

  return (
    <div className="fixed inset-0" style={{ zIndex: 100, background: '#0f0f12' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onClick={handleClick}
        onWheel={handleWheel}
        style={{ display: 'block', cursor: 'grab' }}
      />

      {/* Header */}
      <div 
        className="flex items-center justify-between"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: 'linear-gradient(to bottom, rgba(22, 22, 26, 0.95), rgba(22, 22, 26, 0.8))',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(67, 76, 94, 0.3)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FlintLogo size={16} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#eceff4' }}>Graph</span>
          </div>
          
          {/* Search */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(46, 52, 64, 0.6)',
              border: '1px solid rgba(67, 76, 94, 0.4)',
              borderRadius: 8,
              padding: '6px 12px',
            }}
          >
            <Search size={14} style={{ color: '#6b7280' }} />
            <input
              type="text"
              placeholder="Filter nodes..."
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                color: '#d8dee9',
                fontSize: 12,
                outline: 'none',
                width: 140,
              }}
            />
          </div>

          {/* Stats */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 11,
              color: '#6b7280',
            }}
          >
            <span><strong style={{ color: '#81a1c1' }}>{graphStats.nodes}</strong> nodes</span>
            <span><strong style={{ color: '#88c0d0' }}>{graphStats.edges}</strong> links</span>
          </div>
        </div>

        <button
          onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
          style={{
            background: 'rgba(46, 52, 64, 0.5)',
            border: '1px solid rgba(67, 76, 94, 0.4)',
            color: '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            padding: 6,
            borderRadius: 6,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(67, 76, 94, 0.5)';
            e.currentTarget.style.color = '#d8dee9';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(46, 52, 64, 0.5)';
            e.currentTarget.style.color = '#6b7280';
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Settings Panel */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          right: 16,
          width: 260,
          background: 'rgba(22, 22, 26, 0.92)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(67, 76, 94, 0.3)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            background: 'none',
            border: 'none',
            color: '#d8dee9',
            cursor: 'pointer',
            borderBottom: settingsOpen ? '1px solid rgba(67, 76, 94, 0.3)' : 'none',
          }}
        >
          <div className="flex items-center gap-2">
            <Settings size={14} style={{ color: '#81a1c1' }} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>Settings</span>
          </div>
          {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {settingsOpen && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Display Settings */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Display
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="flex items-center gap-3" style={{ fontSize: 11, color: '#b8c5d4', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showOrphans}
                    onChange={e => setShowOrphans(e.target.checked)}
                    style={{ accentColor: '#81a1c1' }}
                  />
                  Show orphan nodes
                </label>
                
                <label className="flex items-center gap-3" style={{ fontSize: 11, color: '#b8c5d4', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showArrows}
                    onChange={e => setShowArrows(e.target.checked)}
                    style={{ accentColor: '#81a1c1' }}
                  />
                  Show arrows
                </label>
                
                <label className="flex items-center gap-3" style={{ fontSize: 11, color: '#b8c5d4', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={colorByGroup}
                    onChange={e => setColorByGroup(e.target.checked)}
                    style={{ accentColor: '#81a1c1' }}
                  />
                  Color by group
                </label>

                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, color: '#6b7280', width: 50 }}>Labels</span>
                  <select
                    value={showLabels}
                    onChange={e => setShowLabels(e.target.value as 'none' | 'hover' | 'all')}
                    style={{
                      flex: 1,
                      background: 'rgba(46, 52, 64, 0.5)',
                      border: '1px solid rgba(67, 76, 94, 0.4)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      color: '#b8c5d4',
                      fontSize: 11,
                      outline: 'none',
                    }}
                  >
                    <option value="none">None</option>
                    <option value="hover">On hover</option>
                    <option value="all">Always</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, color: '#6b7280', width: 50 }}>Depth</span>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    value={depthFilter}
                    onChange={e => setDepthFilter(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: '#81a1c1' }}
                  />
                  <span style={{ fontSize: 10, color: '#81a1c1', width: 16, textAlign: 'right' }}>
                    {depthFilter === 0 ? '∞' : depthFilter}
                  </span>
                </div>
              </div>
            </div>

            {/* Forces */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Forces
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Node size', value: nodeSize, set: setNodeSize, min: 2, max: 10, step: 0.5 },
                  { label: 'Link distance', value: linkDistance, set: setLinkDistance, min: 40, max: 300, step: 10 },
                  { label: 'Repel force', value: repelForce, set: setRepelForce, min: 20, max: 300, step: 10 },
                  { label: 'Center force', value: centerForce, set: setCenterForce, min: 0, max: 0.2, step: 0.01 },
                  { label: 'Link force', value: linkForce, set: setLinkForce, min: 0, max: 1, step: 0.05 },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span style={{ fontSize: 10, color: '#6b7280', width: 70 }}>{s.label}</span>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={s.value}
                      onChange={e => s.set(parseFloat(e.target.value))}
                      style={{ flex: 1, accentColor: '#5e81ac' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={togglePhysics}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  background: physicsRef.current ? 'rgba(163, 190, 140, 0.15)' : 'rgba(191, 97, 106, 0.15)',
                  border: `1px solid ${physicsRef.current ? 'rgba(163, 190, 140, 0.3)' : 'rgba(191, 97, 106, 0.3)'}`,
                  borderRadius: 6,
                  color: physicsRef.current ? '#a3be8c' : '#bf616a',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {physicsRef.current ? <Pause size={12} /> : <Play size={12} />}
                {physicsRef.current ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={reset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  background: 'rgba(67, 76, 94, 0.3)',
                  border: '1px solid rgba(67, 76, 94, 0.4)',
                  borderRadius: 6,
                  color: '#81a1c1',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Zoom Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          background: 'rgba(22, 22, 26, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(67, 76, 94, 0.3)',
          borderRadius: 8,
          padding: 4,
        }}
      >
        {[
          { icon: <ZoomIn size={16} />, action: () => { zoomRef.current = Math.min(6, zoomRef.current * 1.3); } },
          { icon: <ZoomOut size={16} />, action: () => { zoomRef.current = Math.max(0.1, zoomRef.current / 1.3); } },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            style={{
              width: 36,
              height: 36,
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(67, 76, 94, 0.4)';
              e.currentTarget.style.color = '#d8dee9';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            {btn.icon}
          </button>
        ))}
      </div>

      {/* Group Legend */}
      {colorByGroup && groups.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            background: 'rgba(22, 22, 26, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(67, 76, 94, 0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            maxWidth: 200,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Groups
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groups.slice(0, 8).map(group => (
              <div key={group} className="flex items-center gap-2">
                <input
                  type="color"
                  value={groupColors[group] || stringToColor(group)}
                  onChange={e => setGroupColors(prev => ({ ...prev, [group]: e.target.value }))}
                  style={{
                    width: 14,
                    height: 14,
                    border: 'none',
                    borderRadius: 3,
                    padding: 0,
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: 11, color: '#b8c5d4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {group}
                </span>
              </div>
            ))}
            {groups.length > 8 && (
              <span style={{ fontSize: 10, color: '#6b7280' }}>+{groups.length - 8} more</span>
            )}
          </div>
        </div>
      )}

      {/* Keyboard hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 10,
          color: '#4b5563',
          display: 'flex',
          gap: 12,
        }}
      >
        <span>Scroll to zoom</span>
        <span>•</span>
        <span>Drag to pan</span>
        <span>•</span>
        <span>Click node to open</span>
      </div>
    </div>
  );
}
