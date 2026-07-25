// Magnitude comparison across categories (crime category / district / station
// counts) — per dataviz skill, this is a "compare magnitude, low→high" job,
// so color is sequential (one hue), not categorical. The category/district/
// station name already identifies each row via the axis label, so a
// different color per bar would encode nothing and just be noise.
export interface RankedBarDatum {
  key: string;
  label: string;
  value: number;
}

export function RankedBarChart({
  data,
  onSelect,
  emptyLabel = 'No data for this filter.',
}: {
  data: RankedBarDatum[];
  onSelect?: (key: string) => void;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <p className="muted">{emptyLabel}</p>;
  }

  return (
    <div>
      {data.map((d) => (
        <div
          key={d.key}
          className={`rbar-row${onSelect ? ' clickable' : ''}`}
          onClick={onSelect ? () => onSelect(d.key) : undefined}
          role={onSelect ? 'button' : undefined}
          title={onSelect ? `View ${d.label} stations` : undefined}
        >
          <span className="rbar-label" title={d.label}>
            {d.label}
          </span>
          <span className="rbar-track">
            <span className="rbar-fill" style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
          </span>
          <span className="rbar-value">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
