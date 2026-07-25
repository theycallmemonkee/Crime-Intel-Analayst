// Per dataviz skill (`choosing-a-form.md`): "a single current value (+ maybe
// a trend)" is a stat tile, not a one-bar bar chart. Used for Total Crimes,
// Active Investigations, Closed Cases, and Crime Growth.
export function StatTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: number | string;
  delta?: { pct: number | null; caption: string };
}) {
  let deltaClass = 'flat';
  let deltaText = '—';
  if (delta && delta.pct !== null) {
    deltaClass = delta.pct > 0 ? 'good' : delta.pct < 0 ? 'bad' : 'flat';
    deltaText = `${delta.pct > 0 ? '+' : ''}${delta.pct}% ${delta.caption}`;
  } else if (delta) {
    deltaText = delta.caption;
  }

  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {delta && <div className={`stat-delta ${deltaClass}`}>{deltaText}</div>}
    </div>
  );
}
