'use client';

import { useRef, useState } from 'react';

export interface TrendPoint {
  label: string;
  value: number;
}

const WIDTH = 760;
const HEIGHT = 200;
const PAD_LEFT = 34;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;

// Trend-over-time: single series, sequential hue, thin 2px line with rounded
// caps, ≥8px hover targets, and a crosshair+tooltip — dataviz skill treats
// the hover layer on line/area charts as non-optional, not a nice-to-have.
export function TrendLineChart({ data }: { data: TrendPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(1, ...data.map((d) => d.value));

  const points = data.map((d, i) => ({
    x: PAD_LEFT + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW),
    y: PAD_TOP + plotH - (d.value / max) * plotH,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  // 4 gridline steps
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
        role="img"
        aria-label="Monthly crime trend line chart"
      >
        {gridSteps.map((s) => {
          const y = PAD_TOP + plotH - s * plotH;
          return (
            <line
              key={s}
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y}
              y2={y}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
          );
        })}
        <line
          x1={PAD_LEFT}
          x2={PAD_LEFT}
          y1={PAD_TOP}
          y2={PAD_TOP + plotH}
          stroke="var(--chart-axis)"
          strokeWidth={1}
        />
        <line
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={PAD_TOP + plotH}
          y2={PAD_TOP + plotH}
          stroke="var(--chart-axis)"
          strokeWidth={1}
        />

        <path d={pathD} fill="none" stroke="var(--chart-sequential)" strokeWidth={2} strokeLinecap="round" />

        {points.map((p, i) => (
          <circle
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={hoverIndex === i ? 5 : 3}
            fill="var(--chart-sequential)"
            stroke="var(--surface)"
            strokeWidth={1.5}
          />
        ))}

        {points.map((p, i) => (
          <text key={p.label} x={p.x} y={HEIGHT - 6} fontSize={10} fill="var(--text-muted)" textAnchor="middle">
            {i % 2 === 0 || data.length <= 6 ? p.label : ''}
          </text>
        ))}

        {hovered && (
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="var(--chart-axis)"
            strokeWidth={1}
            strokeDasharray="3,3"
          />
        )}
      </svg>
      {hovered && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(hovered.x / WIDTH) * 100}%`,
            top: `${(hovered.y / HEIGHT) * 100}%`,
          }}
        >
          {hovered.label}: <strong>{hovered.value}</strong>
        </div>
      )}
    </div>
  );
}
