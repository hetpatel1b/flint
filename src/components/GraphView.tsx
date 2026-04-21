import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '../store';
import { X, Play, RotateCcw } from 'lucide-react';

interface GraphNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number;
  pinned: boolean;
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
  const simulationAlphaRef = useRef(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const animPhaseRef = useRef(0);
  const animNodeIdxRef = useRef(0);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { notes } = state;

  const buildGraph = useCallback(() => {
    const edges: GraphEdge[] = [];
    const connectionCount: Record<string, number> = {};

    notes.forEach(note => {
      const links = extractLinks(note.content);
      links.forEach(linkTitle => {
        const target = getNoteByTitle(linkTitle);
        if (target && target.id !== note.id) {
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
      const radius = 150 + Math.random() * 80;
      return {
        id: note.id,
        title: note.title,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        connections: connectionCount[note.id] || 0,
        pinned: false,
      };
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
    simulationAlphaRef.current = 1;
  }, [notes, extractLinks, getNoteByTitle]);

  // Animation: sequential spin/connect effect
  const startAnimation = useCallback(() => {
    setIsAnimating(true);
    animPhaseRef.current = 0;
    animNodeIdxRef.current = 0;
    const nodes = nodesRef.current;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    // Phase 1: Scatter nodes to center then outward with spin
    nodes.forEach(n => {
      n.x = cx + (Math.random() - 0.5) * 10;
      n.y = cy + (Math.random() - 0.5) * 10;
      n.vx = 0;
      n.vy = 0;
    });

    simulationAlphaRef.current = 1;

    // Animate nodes appearing one by one
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= nodes.length) {
        clearInterval(interval);
        // After all nodes appear, let simulation settle
        simulationAlphaRef.current = 1;
        setTimeout(() => setIsAnimating(false), 2000);
        return;
      }
      const node = nodes[idx];
      const angle = (2 * Math.PI * idx) / nodes.length;
      node.vx = Math.cos(angle) * 3;
      node.vy = Math.sin(angle) * 3;
      idx++;
    }, 80);

    animTimerRef.current = interval;
  }, []);

  const resetGraph = useCallback(() => {
    if (animTimerRef.current) clearInterval(animTimerRef.current);
    setIsAnimating(false);
    buildGraph();
  }, [buildGraph]);

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
      if (nodes.length === 0) {
        animRef.current = requestAnimationFrame(simulate);
        return;
      }

      // Decay alpha
      if (simulationAlphaRef.current > 0.001) {
        simulationAlphaRef.current *= 0.995;
      }

      const alpha = Math.max(simulationAlphaRef.current, 0.05);
      const damping = 0.85;
      const repulsion = 4000;
      const attraction = 0.005;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = repulsion * alpha / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (!nodes[i].pinned) { nodes[i].vx += fx; nodes[i].vy += fy; }
          if (!nodes[j].pinned) { nodes[j].vx -= fx; nodes[j].vy -= fy; }
        }
      }

      // Attraction along edges — stronger pull between linked notes
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const force = attraction * alpha;
        if (!source.pinned) { source.vx += dx * force; source.vy += dy * force; }
        if (!target.pinned) { target.vx -= dx * force; target.vy -= dy * force; }
      });

      // Center gravity
      nodes.forEach(node => {
        if (!node.pinned) {
          node.vx += (cx - node.x) * 0.0003 * alpha;
          node.vy += (cy - node.y) * 0.0003 * alpha;
        }
      });

      // Apply velocity
      nodes.forEach(node => {
        if (node.pinned || dragRef.current.nodeId === node.id) return;
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
      });

      // When dragging, apply force to connected nodes
      if (dragRef.current.nodeId) {
        const dragNode = nodes.find(n => n.id === dragRef.current.nodeId);
        if (dragNode) {
          edges.forEach(edge => {
            let connected: GraphNode | undefined;
            if (edge.source === dragNode.id) connected = nodes.find(n => n.id === edge.target);
            else if (edge.target === dragNode.id) connected = nodes.find(n => n.id === edge.source);
            if (connected && !connected.pinned) {
              const dx = dragNode.x - connected.x;
              const dy = dragNode.y - connected.y;
              connected.vx += dx * 0.003;
              connected.vy += dy * 0.003;
            }
          });
        }
      }

      draw();
      animRef.current = requestAnimationFrame(simulate);
    };

    animRef.current = requestAnimationFrame(simulate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
      if (animTimerRef.current) clearInterval(animTimerRef.current);
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

    // Pure black background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);

    // Draw edges — simple thin gray lines
    edges.forEach(edge => {
      const source = nodes.find(n => n.id === edge.source);
      const target = nodes.find(n => n.id === edge.target);
      if (!source || !target) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    // Draw nodes — simple flat circles
    nodes.forEach(node => {
      const baseRadius = 3 + Math.min(node.connections, 6) * 1;
      const isActive = node.id === state.activeNoteId;
      const isHovered = node.id === hoveredNodeRef.current;

      // Outer ring for active
      if (isActive) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, baseRadius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Main dot
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseRadius, 0, Math.PI * 2);

      if (isActive) {
        ctx.fillStyle = '#aaa';
      } else if (node.connections > 0) {
        ctx.fillStyle = isHovered ? '#888' : '#555';
      } else {
        ctx.fillStyle = isHovered ? '#444' : '#2a2a2a';
      }
      ctx.fill();

      // Label
      if (isHovered || isActive || node.connections > 2) {
        ctx.font = `${isActive || isHovered ? '500' : '400'} 9px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = isActive ? '#ccc' : isHovered ? '#999' : '#444';
        ctx.fillText(node.title, node.x, node.y + baseRadius + 12);
      }
    });

    ctx.restore();

    // HUD
    ctx.fillStyle = '#333';
    ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
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
      const r = 3 + Math.min(nodes[i].connections, 6) * 1 + 8;
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
      node.pinned = true;
      simulationAlphaRef.current = Math.max(simulationAlphaRef.current, 0.3);
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
        // Connected nodes will be pulled via the simulation force
      }
    } else if (isPanningRef.current) {
      panRef.current.x += e.clientX - lastMouseRef.current.x;
      panRef.current.y += e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [getNodeAt]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.nodeId) {
      const dragNode = nodesRef.current.find(n => n.id === dragRef.current.nodeId);
      if (dragNode) dragNode.pinned = false;
    }
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
      <div className="flex items-center justify-between px-3 py-1.5 z-10" style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium" style={{ color: '#777' }}>Graph View</span>
          <span className="text-[9px]" style={{ color: '#333' }}>
            {notes.length} notes · {edgesRef.current.length} links
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={startAnimation}
            disabled={isAnimating}
            className="p-1 rounded transition-colors"
            style={{ color: isAnimating ? '#444' : '#555' }}
            onMouseEnter={e => e.currentTarget.style.color = '#999'}
            onMouseLeave={e => e.currentTarget.style.color = isAnimating ? '#444' : '#555'}
            title="Animate graph"
          >
            <Play size={13} />
          </button>
          <button
            onClick={resetGraph}
            className="p-1 rounded transition-colors"
            style={{ color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.color = '#999'}
            onMouseLeave={e => e.currentTarget.style.color = '#555'}
            title="Reset layout"
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={() => dispatch({ type: 'TOGGLE_GRAPH_VIEW' })}
            className="p-1 rounded transition-colors"
            style={{ color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.color = '#999'}
            onMouseLeave={e => e.currentTarget.style.color = '#555'}
          >
            <X size={14} />
          </button>
        </div>
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
      <div className="absolute bottom-3 right-3 rounded-lg px-3 py-2 text-[9px] space-y-1" style={{ background: 'rgba(10,10,10,0.95)', border: '1px solid #1a1a1a', color: '#444' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#555' }} />
          <span>Linked note</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#2a2a2a' }} />
          <span>Orphan note</span>
        </div>
        <div style={{ color: '#2a2a2a', marginTop: 4 }}>Scroll to zoom · Drag to move · Click to open</div>
      </div>
    </div>
  );
}
