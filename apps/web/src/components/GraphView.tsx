'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  SimulationNodeDatum,
} from 'd3-force';
import Link from 'next/link';

export interface GraphViewNode {
  id: string;
  label: string;
  type: string;
}
export interface GraphViewEdge {
  source: string;
  target: string;
  label?: string;
  weight?: number;
}

const TYPE_COLOR: Record<string, string> = {
  PERSON: '#2a78d6',
  CRIME: '#e34948',
  VEHICLE: '#eb6834',
  WEAPON: '#4a3aa7',
  PHONE: '#1baf7a',
  ADDRESS: '#eda100',
};

const TYPE_RADIUS: Record<string, number> = {
  PERSON: 9,
  CRIME: 7,
  VEHICLE: 6,
  WEAPON: 6,
  PHONE: 5,
  ADDRESS: 5,
};

interface SimNode extends SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
}

const WIDTH = 720;
const HEIGHT = 480;

// A small, focused force-directed link chart — d3-force for the physics
// simulation only, plain SVG for rendering (same "one focused library, hand
// -rolled rendering" pattern as the Leaflet map in Milestone 5). This is the
// actual visual signature of "Network & Link Analysis": nodes are people/
// crimes/vehicles/etc., edges are how they're connected, and the layout
// itself surfaces clusters that a table never would.
export function GraphView({
  nodes,
  edges,
  centerNodeId,
  personLinkBase = '/persons/view',
}: {
  nodes: GraphViewNode[];
  edges: GraphViewEdge[];
  centerNodeId?: string;
  personLinkBase?: string;
}) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; nodes: SimNode[] } | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);

  const key = useMemo(() => nodes.map((n) => n.id).join(',') + '|' + edges.length, [nodes, edges]);

  useEffect(() => {
    if (nodes.length === 0) {
      setPositions(null);
      return;
    }
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const nodeIds = new Set(simNodes.map((n) => n.id));
    const simEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    // forceCenter only recenters the *average* position of the whole graph —
    // it does nothing to stop an individual weakly-connected node (common in
    // a 20+ member community with sparse edges) from being repelled by
    // forceManyBody out past the visible viewBox. forceX/forceY add a mild
    // per-node pull toward the canvas center so every node stays on-screen
    // regardless of how connected it is; the render-time clamp below is the
    // hard backstop in case physics still pushes one out of bounds.
    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<SimNode, GraphViewEdge>(simEdges as any)
          .id((d) => d.id)
          .distance(50),
      )
      .force('charge', forceManyBody().strength(-120))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force('x', forceX<SimNode>(WIDTH / 2).strength(0.06))
      .force('y', forceY<SimNode>(HEIGHT / 2).strength(0.06))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => (TYPE_RADIUS[d.type] ?? 6) + 6),
      )
      .stop();

    for (let i = 0; i < 300; i++) sim.tick();

    simNodesRef.current = simNodes;
    const MARGIN = 16;
    const clampX = (x: number) => Math.min(WIDTH - MARGIN, Math.max(MARGIN, x));
    const clampY = (y: number) => Math.min(HEIGHT - MARGIN, Math.max(MARGIN, y));
    const posMap = new Map(simNodes.map((n) => [n.id, { x: clampX(n.x ?? WIDTH / 2), y: clampY(n.y ?? HEIGHT / 2) }]));
    setPositions(posMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function onDragStart(id: string, e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id, nodes: simNodesRef.current };
  }
  function onDragMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const node = dragRef.current.nodes.find((n) => n.id === dragRef.current!.id);
    if (node) {
      node.x = x;
      node.y = y;
      setPositions(new Map(dragRef.current.nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])));
    }
  }
  function onDragEnd() {
    dragRef.current = null;
  }

  if (!positions) return <p className="muted">No graph data.</p>;

  const edgeLines = edges
    .filter((e) => positions.has(e.source) && positions.has(e.target))
    .map((e, i) => {
      const s = positions.get(e.source)!;
      const t = positions.get(e.target)!;
      return { ...e, s, t, key: `${e.source}-${e.target}-${i}` };
    });

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        role="img"
        aria-label="Link analysis graph"
        style={{ background: 'var(--surface)', borderRadius: 8, touchAction: 'none' }}
      >
        {edgeLines.map((e) => (
          <line
            key={e.key}
            x1={e.s.x}
            y1={e.s.y}
            x2={e.t.x}
            y2={e.t.y}
            stroke="var(--border)"
            strokeWidth={e.weight ? Math.min(4, 1 + e.weight * 0.6) : 1.2}
          />
        ))}
        {nodes.map((n) => {
          const pos = positions.get(n.id);
          if (!pos) return null;
          const isCenter = n.id === centerNodeId;
          const radius = (TYPE_RADIUS[n.type] ?? 6) + (isCenter ? 3 : 0);
          return (
            <g
              key={n.id}
              transform={`translate(${pos.x},${pos.y})`}
              onPointerDown={(e) => onDragStart(n.id, e)}
              onMouseEnter={() => setHoverId(n.id)}
              onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
              style={{ cursor: 'grab' }}
            >
              <circle
                r={radius}
                fill={TYPE_COLOR[n.type] ?? '#898781'}
                stroke={isCenter ? 'var(--primary-dark)' : 'var(--surface)'}
                strokeWidth={isCenter ? 2.5 : 1.5}
              />
              {(n.type === 'PERSON' || hoverId === n.id) && (
                <text
                  x={radius + 4}
                  y={4}
                  fontSize={10}
                  fill="var(--text)"
                  style={{ pointerEvents: 'none', fontWeight: isCenter ? 700 : 400 }}
                >
                  {n.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="status-legend" style={{ marginTop: '0.5rem' }}>
        {Object.entries(TYPE_COLOR).map(([type, color]) => (
          <div key={type} className="status-legend-item">
            <span className="status-swatch" style={{ background: color }} />
            <span>{type}</span>
          </div>
        ))}
      </div>
      {hoverId && nodes.find((n) => n.id === hoverId)?.type === 'PERSON' && (
        <p className="muted" style={{ marginTop: '0.4rem' }}>
          <Link href={`${personLinkBase}?id=${hoverId}`}>View person record →</Link>
        </p>
      )}
    </div>
  );
}
