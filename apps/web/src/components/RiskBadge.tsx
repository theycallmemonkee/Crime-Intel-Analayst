import { RiskBand } from '@/lib/types';

const LABELS: Record<RiskBand, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export function RiskBadge({ band }: { band: RiskBand }) {
  return <span className={`risk-badge risk-${band}`}>{LABELS[band]}</span>;
}

export function RiskBar({ score, band }: { score: number; band: RiskBand }) {
  return (
    <span className="risk-bar-track">
      <span className={`risk-bar-fill risk-${band}`} style={{ width: `${Math.max(2, score)}%` }} />
    </span>
  );
}
