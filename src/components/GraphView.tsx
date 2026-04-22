import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { X, ZoomIn, ZoomOut, RotateCcw, Play, Pause } from 'lucide-react';

interface GNode { id: string; title: string; x: number; y: number; vx: number; vy: number; conns: number; }
interface GEdge { from: string; to: string; }

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
  const sizeRef = useRef({ w: 0, h: 0 });

  const buildGraph = useCallback(() => {
    const links: Record<string, Set<string>> = {};
    state.notes.forEach(n => { links[n.id] = new Set(); });
    state.notes.forEach(n => {
      const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const m of matches) {
        const target = state.notes.find(nt => nt.title.toLowerCase() === m[1].toLowerCase());
        if (target && target.id !== n.id) {
          links[n.id].add(target.id);
          links[target.id].add(n.id);
        }
      }
    });

    const cx = sizeRef.current.w / 2;
    const cy = sizeRef.current.h / 2;
    nodesRef.current = state.notes.map((n) => ({
      id: n.id, title: n.title,
      x: cx + (Math.random() - 0.5) * 400,
      y: cy + (Math.random() - 0.5) * 400,
      vx: 0, vy: 0,
      conns: links[n.id]?.size || 0,
    }));

    const edgeSet = new Set<string>();
    edgesRef.current = [];
    state.notes.forEach(n => {
      const matches = n.content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
      for (const m of matches) {
        const target = state.notes.find(nt => nt.title.toLowerCase() === m[1].toLowerCase());
        if (target && target.id !== n.id) {
          const key = [n.id, target.id].sort().join('-');
          if (!edgeSet.has(key)) { edgeSet.add(key); edgesRef.current.push({ from: n.id, to: target.id }); }
        }
      }
    });
  }, [state.notes]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let running = true;

    function getNode(id: string) { return nodesRef.current.find(n => n.id === id); }

    function simulate() {
      if (!physicsRef.current) return;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const cx = sizeRef.current.w / 2;
      const cy = sizeRef.current.h / 2;

      // Repulsion between all pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const f = 3000 / (d * d);
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          nodes[i].vx -= fx; nodes[i].vy -= fy;
          nodes[j].vx += fx; nodes[j].vy += fy;
        }
      }

      // Spring forces along edges
      for (const e of edges) {
        const a = getNode(e.from); const b = getNode(e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x; const dy = b.y - a.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const f = (d - 150) * 0.006;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.0003;
        n.vy += (cy - n.y) * 0.0003;
      }

      // Apply velocity with heavy damping
      for (const n of nodes) {
        if (n.id === dragRef.current) {
          n.vx = 0; n.vy = 0;
          continue;
        }
        n.vx *= 0.6; // strong damping
        n.vy *= 0.6;
        // Clamp velocity
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > 10) { n.vx = (n.vx / speed) * 10; n.vy = (n.vy / speed) * 10; }
        n.x += n.vx; n.y += n.vy;
      }
    }

    function draw() {
      if (!running) return;
      simulate();

      const w = canvas!.width; const h = canvas!.height;
      const z = zoomRef.current; const p = panRef.current;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      ctx!.clearRect(0, 0, w, h);

      // Background
      ctx!.fillStyle = '#050505';
      ctx!.fillRect(0, 0, w, h);

      // Grid dots
      ctx!.fillStyle = '#0c0c0c';
      const gs = 40 * z;
      const ox = ((p.x % gs) + gs) % gs;
      const oy = ((p.y % gs) + gs) % gs;
      for (let x = ox; x < w; x += gs) {
        for (let y = oy; y < h; y += gs) {
          ctx!.beginPath();
          ctx!.arc(x, y, 1, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.scale(z, z);

      // Edges
      for (const e of edges) {
        const a = getNode(e.from); const b = getNode(e.to);
        if (!a || !b) continue;
        const isHover = hoverRef.current === e.from || hoverRef.current === e.to;
        ctx!.beginPath();
        ctx!.strokeStyle = isHover ? '#444' : '#1a1a1a';
        ctx!.lineWidth = isHover ? 1.5 : 0.8;
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }

      // Nodes
      const activeId = state.activeNoteId;
      for (const n of nodes) {
        const r = 3 + Math.min(n.conns, 15) * 1.5;
        const isActive = n.id === activeId;
        const isHover = n.id === hoverRef.current;

        // Outer glow for active
        if (isActive) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r + 8, 0, Math.PI * 2);
          ctx!.fillStyle = 'rgba(150,150,150,0.08)';
          ctx!.fill();
        }

        // Node circle
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);

        if (isActive) {
          ctx!.fillStyle = '#bbb';
          ctx!.strokeStyle = '#888';
          ctx!.lineWidth = 2;
          ctx!.fill(); ctx!.stroke();
        } else if (n.conns > 0) {
          const b = 60 + Math.min(n.conns, 12) * 12;
          ctx!.fillStyle = `rgb(${b},${b},${b})`;
          ctx!.fill();
        } else {
          ctx!.fillStyle = '#2a2a2a';
          ctx!.fill();
        }

        // Hover ring
        if (isHover && !isActive) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
          ctx!.strokeStyle = '#555';
          ctx!.lineWidth = 1;
          ctx!.stroke();
        }

        // Labels — show for connected, hovered, or active
        if (n.conns > 0 || isHover || isActive) {
          ctx!.fillStyle = isActive ? '#eee' : isHover ? '#ccc' : '#444';
          ctx!.font = `${isActive ? 'bold 11' : '10'}px -apple-system, system-ui, sans-serif`;
          ctx!.textAlign = 'center';
          ctx!.fillText(n.title, n.x, n.y + r + 14);
        }
      }

      ctx!.restore();
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [state.activeNoteId, state.notes, buildGraph]);

  const getNodeAt = useCallback((mx: number, my: number) => {
    const z = zoomRef.current; const p = panRef.current;
    const wx = (mx - p.x) / z; const wy = (my - p.y) / z;
    for (const n of [...nodesRef.current].reverse()) {
      const r = 3 + Math.min(n.conns, 15) * 1.5 + 8;
      if ((wx - n.x) ** 2 + (wy - n.y) ** 2 < r * r) return n;
    }
    return null;
  }, []);

  const handleDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    wasDragRef.current = false;
    if (n) {
      dragRef.current = n.id;
      // Zero velocity when grabbed
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
      const z = zoomRef.current; const p = panRef.current;
      const n = nodesRef.current.find(nd => nd.id === dragRef.current);
      if (n) {
        n.x = (e.clientX - rect.left - p.x) / z;
        n.y = (e.clientY - rect.top - p.y) / z;
        n.vx = 0; n.vy = 0;
      }
    } else if (panRef.current.dragging) {
      panRef.current.x = e.clientX - panRef.current.sx;
      panRef.current.y = e.clientY - panRef.current.sy;
    } else {
      const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      hoverRef.current = n ? n.id : null;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = n ? 'pointer' : 'default';
      }
    }
  };

  const handleUp = () => {
    if (dragRef.current) {
      // Zero velocity on release so node stays put
      const n = nodesRef.current.find(nd => nd.id === dragRef.current);
      if (n) { n.vx = 0; n.vy = 0; }
    }
    dragRef.current = null;
    panRef.current.dragging = false;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (wasDragRef.current) { wasDragRef.current = false; return; }
    const rect = canvasRef.current!.getBoundingClientRect();
    const n = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (n) dispatch({ type: 'OPEN_TAB', payload: n.id });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.max(0.2, Math.min(4, zoomRef.current - e.deltaY * 0.001));
  };

  const reset = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0, dragging: false, sx: 0, sy: 0 };
    buildGraph();
  };

  const animate = () => {
    const cx = sizeRef.current.w / 2; const cy = sizeRef.current.h / 2;
    nodesRef.current.forEach(n => { n.x = cx; n.y = cy; n.vx = 0; n.vy = 0; });
    nodesRef.current.forEach((n, i) => {
      setTimeout(() => {
        const angle = (i / nodesRef.current.length) * Math.PI * 2;
        const dist = 80 + n.conns * 30;
        n.x = cx + Math.cos(angle) * dist;
        n.y = cy + Math.sin(angle) * dist;
        n.vx = (Math.random() - 0.5) * 2;
        n.vy = (Math.random() - 0.5) * 2;
      }, i * 100);
    });
  };

  const togglePhysics = () => { physicsRef.current = !physicsRef.current; };

  return (
    <div className="fixed inset-0 animate-fade-in" style={{ zIndex: 100, background: '#050505' }}>
      <canvas ref={canvasRef}
        onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp}
        onClick={handleClick} onWheel={handleWheel}
        style={{ display: 'block' }} />

      {/* Header */}
      <div className="flex items-center justify-between" style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 16px', background: 'rgba(5,5,5,0.9)', borderBottom: '1px solid #111' }}>
        <div className="flex items-center gap-2">
          <img src="/flint-logo.png" alt="Flint" style={{ width: 16, height: 16, borderRadius: 3 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Graph View</span>
          <span style={{ fontSize: 10, color: '#333' }}>{nodesRef.current.length} nodes · {edgesRef.current.length} links</span>
        </div>
        <button onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
          style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', display: 'flex' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#999'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#444'; }}>
          <X size={18} />
        </button>
      </div>

      {/* Controls */}
      <div style={{ position: 'absolute', top: 48, right: 16, display: 'flex', flexDirection: 'column', gap: 2, background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 8, padding: 4 }}>
        {[
          { icon: <ZoomIn size={14} />, action: () => { zoomRef.current = Math.min(4, zoomRef.current + 0.2); }, title: 'Zoom in' },
          { icon: <ZoomOut size={14} />, action: () => { zoomRef.current = Math.max(0.2, zoomRef.current - 0.2); }, title: 'Zoom out' },
          { icon: <RotateCcw size={14} />, action: reset, title: 'Reset' },
          { icon: physicsRef.current ? <Pause size={14} /> : <Play size={14} />, action: togglePhysics, title: physicsRef.current ? 'Pause physics' : 'Resume physics' },
          { icon: <Play size={14} />, action: animate, title: 'Animate' },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} title={btn.title}
            style={{ width: 32, height: 32, background: 'none', border: 'none', color: '#555', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#141414'; e.currentTarget.style.color = '#999'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#555'; }}>
            {btn.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
