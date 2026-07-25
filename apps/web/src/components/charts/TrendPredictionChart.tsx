'use client';

import { useRef, useState } from 'react';
import { TrendPrediction } from '@/lib/types';

const WIDTH = 760;
const HEIGHT = 220;
const PAD_LEFT = 34;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;

// Historical months as a solid line (same sequential-blue treatment as every
// other trend chart in this app), predicted months as a dashed continuation
// with a shaded uncertainty band (±1 residual std-dev from the regression) —
// visually distinguishing "what happened" from "what the model projects."
export function TrendPredictionChart({ data }: { data: TrendPrediction }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const points = [
    ...data.historical.map((h) => ({ label: h.month, value: h.count, upper: h.count, lower: h.count, predicted: false })),
    ...data.predicted.map((p) => ({
      label: p.month,
      value: p.predictedCount,
      upper: p.upperBound,
      lower: p.lowerBound,
      predicted: true,
    })),
  ];
  const max = Math.max(1, ...points.map((p) => p.upper));

  const coords = points.map((p, i) => ({
    ...p,
    x: PAD_LEFT + (i / (points.length - 1)) * plotW,
    y: PAD_TOP + plotH - (p.value / max) * plotH,
    yUpper: PAD_TOP + plotH - (p.upper / max) * plotH,
    yLower: PAD_TOP + plotH - (p.lower / max) * plotH,
  }));

  const historicalCount = data.historical.length;
  const historicalPath = coords
    .slice(0, historicalCount)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const predictedPath = coords
    .slice(historicalCount - 1)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const bandPoints = coords
    .slice(historicalCount - 1)
    .map((p) => `${p.x.toFixed(1)},${p.yUpper.toFixed(1)}`)
    .concat(
      coords
        .slice(historicalCount - 1)
        .reverse()
        .map((p) => `${p.x.toFixed(1)},${p.yLower.toFixed(1)}`),
    )
    .join(' ');

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (WIDTH / rect.width);
    let nearest = 0;
    let nearestDist = Infinity;
    coords.forEach((p, i) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? coords[hoverIndex] : null;

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
        aria-label="Crime trend prediction chart"
      >
        <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={PAD_TOP + plotH} y2={PAD_TOP + plotH} stroke="var(--chart-axis)" />
        <polygon points={bandPoints} fill="var(--chart-sequential-soft)" opacity={0.6} />
        <path d={historicalPath} fill="none" stroke="var(--chart-sequential)" strokeWidth={2} strokeLinecap="round" />
        <path
          d={predictedPath}
          fill="none"
          stroke="var(--chart-sequential)"
          strokeWidth={2}
          strokeDasharray="5,4"
          strokeLinecap="round"
        />
        {coords.map((p, i) => (
          <circle
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={hoverIndex === i ? 5 : p.predicted ? 3.5 : 3}
            fill={p.predicted ? 'var(--surface)' : 'var(--chart-sequential)'}
            stroke="var(--chart-sequential)"
            strokeWidth={p.predicted ? 2 : 1.5}
          />
        ))}
        {coords.map((p, i) => (
          <text key={p.label} x={p.x} y={HEIGHT - 6} fontSize={9.5} fill="var(--text-muted)" textAnchor="middle">
            {i % 2 === 0 ? p.label.slice(2) : ''}
          </text>
        ))}
        {hovered && (
          <line x1={hovered.x} x2={hovered.x} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="var(--chart-axis)" strokeDasharray="3,3" />
        )}
      </svg>
      {hovered && (
        <div className="chart-tooltip" style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%` }}>
          {hovered.label}: <strong>{hovered.value}</strong>
          {hovered.predicted && ` (${hovered.lower}–${hovered.upper})`}
        </div>
      )}
    </div>
  );
}
