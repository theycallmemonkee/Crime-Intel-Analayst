export interface StatusDatum {
  status: string;
  label: string;
  count: number;
  color: string;
}

// Part-to-whole across 4 categories → one stacked bar, categorical color in a
// FIXED order (workflow order: Reported → Under Investigation →
// Chargesheeted → Closed), never reordered by filters. 4 series crosses the
// CVD floor (dataviz skill's series-count ladder), so direct labels in the
// legend are mandatory here, not optional — color never carries this alone.
export function StatusStackedBar({ data }: { data: StatusDatum[] }) {
  const total = Math.max(1, data.reduce((sum, d) => sum + d.count, 0));

  return (
    <div>
      <div className="status-stack">
        {data.map((d) =>
          d.count > 0 ? (
            <div
              key={d.status}
              className="status-segment"
              style={{ width: `${(d.count / total) * 100}%`, background: d.color }}
              title={`${d.label}: ${d.count}`}
            />
          ) : null,
        )}
      </div>
      <div className="status-legend">
        {data.map((d) => (
          <div key={d.status} className="status-legend-item">
            <span className="status-swatch" style={{ background: d.color }} />
            <span>
              {d.label} — <strong>{d.count}</strong> ({total > 0 ? Math.round((d.count / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
