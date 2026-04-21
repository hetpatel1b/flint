import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { X } from 'lucide-react';

interface GraphNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

export function GraphView() {
  const { state, dispatch, extractLinks, getNoteByTitle } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const dragRef = useRef<{ nodeId: string | null; offsetX: number; offsetY: number }>({ nodeId: null, offsetX: 0, offsetY: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const animRef = useRef<number>(0);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const hoveredNodeRef = useRef<string | null>(null);

  const { notes } = state;

  const buildGraph = useCallback(() => {
    const edges: GraphEdge[] = [];
    const connectionCount: Record<string, number> = {};

    notes.forEach(note => {
      const links = extractLinks(note.content);
      links.forEach(linkTitle => {
        const target = getNoteByTitle(linkTitle);
        if (target && target.id !== note.id) {
          // Avoid duplicates
          const exists = edges.some(e =>
            (e.source === note.id && e.target === target.id) ||
            (e.source === target.id && e.target === note.id)
          );
          if (!exists) {
            edges.push({ source: note.id, target: target.id });
            connectionCount[note.id] = (connectionCount[note.id] || 0) + 1;
            connectionCount[target.id] = (connectionCount[target.id] || 0) + 1;
          }
        }
      });
    });

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    const nodes: GraphNode[] = notes.map((note, i) => {
      const angle = (2 * Math.PI * i) / notes.length;
      const radius = 120 + Math.random() * 80;
      return {
        id: note.id,
        title: note.title,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        connections: connectionCount[note.id] || 0,
      };
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [notes, extractLinks, getNoteByTitle]);

  useEffect(() => {
    buildGraph();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const simulate = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const damping = 0.88;
      const repulsion = 3000;
      const attraction = 0.004;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = repulsion / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx += fx;
          nodes[i].vy += fy;
          nodes[j].vx -= fx;
          nodes[j].vy -= fy;
        }
      }

      // Attraction along edges
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        source.vx += dx * attraction;
        source.vy += dy * attraction;
        target.vx -= dx * attraction;
        target.vy -= dy * attraction;
      });

      // Center gravity
      nodes.forEach(node => {
        node.vx += (cx - node.x) * 0.0004;
        node.vy += (cy - node.y) * 0.0004;
      });

      // Apply velocity
      nodes.forEach(node => {
        if (dragRef.current.nodeId === node.id) return;
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
      });

      draw();
      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [buildGraph]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const scale = scaleRef.current;
    const pan = panRef.current;

    // Clear with dark background
    ctx.fillStyle = '#0b0b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);

    // Draw edges — simple thin lines, no glow
    edges.forEach(edge => {
      const source = nodes.find(n => n.id === edge.source);
      const target = nodes.find(n => n.id === edge.target);
      if (!source || !target) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = 'rgba(124, 109, 242, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw nodes — simple circles, no glow
    nodes.forEach(node => {
      const baseRadius = 3 + Math.min(node.connections, 8) * 0.8;
      const radius = baseRadius;
      const isActive = node.id === state.activeNoteId;
      const isHovered = node.id === hoveredNodeRef.current;

      // Simple circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

      if (isActive) {
        ctx.fillStyle = '#7c6df2';
      } else if (node.connections > 0) {
        ctx.fillStyle = isHovered ? '#9a8ff5' : '#7c6df2';
      } else {
        ctx.fillStyle = isHovered ? '#585b70' : '#45475a';
      }
      ctx.fill();

      // Subtle ring on active
      if (isActive) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(124, 109, 242, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label — only show for hovered or connected nodes
      if (isHovered || node.connections > 0 || isActive) {
        ctx.font = `${isActive || isHovered ? '500' : '400'} 10px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = isActive ? '#cdd6f4' : isHovered ? '#a6adc8' : '#585b70';
        ctx.fillText(node.title, node.x, node.y + radius + 14);
      }
    });

    ctx.restore();

    // HUD
    ctx.fillStyle = '#45475a';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${nodes.length} notes · ${edges.length} links`, 12, canvas.height - 12);
  }, [state.activeNoteId]);

  const getNodeAt = useCallback((mx: number, my: number): GraphNode | null => {
    const nodes = nodesRef.current;
    const scale = scaleRef.current;
    const pan = panRef.current;
    const x = (mx - pan.x) / scale;
    const y = (my - pan.y) / scale;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const r = 3 + Math.min(nodes[i].connections, 8) * 0.8 + 6;
      const dx = nodes[i].x - x;
      const dy = nodes[i].y - y;
      if (dx * dx + dy * dy < r * r) return nodes[i];
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const node = getNodeAt(e.clientX, e.clientY);
    if (node) {
      const scale = scaleRef.current;
      const pan = panRef.current;
      dragRef.current = {
        nodeId: node.id,
        offsetX: (e.clientX - pan.x) / scale - node.x,
        offsetY: (e.clientY - pan.y) / scale - node.y,
      };
    } else {
      isPanningRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [getNodeAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const node = getNodeAt(e.clientX, e.clientY);
    hoveredNodeRef.current = node ? node.id : null;

    if (dragRef.current.nodeId) {
      const dragNode = nodesRef.current.find(n => n.id === dragRef.current.nodeId);
      if (dragNode) {
        const scale = scaleRef.current;
        const pan = panRef.current;
        dragNode.x = (e.clientX - pan.x) / scale - dragRef.current.offsetX;
        dragNode.y = (e.clientY - pan.y) / scale - dragRef.current.offsetY;
        dragNode.vx = 0;
        dragNode.vy = 0;
      }
    } else if (isPanningRef.current) {
      panRef.current.x += e.clientX - lastMouseRef.current.x;
      panRef.current.y += e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [getNodeAt]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = { nodeId: null, offsetX: 0, offsetY: 0 };
    isPanningRef.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    scaleRef.current = Math.max(0.2, Math.min(3, scaleRef.current * delta));
  }, []);

  const handleNodeClick = useCallback((e: React.MouseEvent) => {
    const node = getNodeAt(e.clientX, e.clientY);
    if (node && !dragRef.current.nodeId) {
      dispatch({ type: 'OPEN_TAB', payload: node.id });
    }
  }, [getNodeAt, dispatch]);

  return (
    <div ref={containerRef} className="flint-graph-container">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 z-10" style={{ background: '#11111b', borderBottom: '1px solid #232334' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: '#a6adc8' }}>Graph View</span>
          <span className="text-[10px]" style={{ color: '#45475a' }}>
            {notes.length} notes · {edgesRef.current.length} links
          </span>
        </div>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
          className="p-1 rounded transition-colors"
          style={{ color: '#6c7086' }}
          onMouseEnter={e => e.currentTarget.style.color = '#cdd6f4'}
          onMouseLeave={e => e.currentTarget.style.color = '#6c7086'}
        >
          <X size={16} />
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="flex-1 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleNodeClick}
        onWheel={handleWheel}
      />

      {/* Legend */}
      <div className="absolute bottom-3 right-3 rounded-lg px-3 py-2 text-[10px] space-y-1" style={{ background: 'rgba(17,17,27,0.9)', border: '1px solid #232334', color: '#585b70' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#7c6df2' }} />
          <span>Linked note</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#45475a' }} />
          <span>Orphan note</span>
        </div>
        <div style={{ color: '#313244', marginTop: 4 }}>Scroll to zoom · Drag to pan · Click to open</div>
      </div>
    </div>
  );
}
