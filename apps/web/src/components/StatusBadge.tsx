import { InvestigationStatus } from '@/lib/types';

const LABELS: Record<InvestigationStatus, string> = {
  REPORTED: 'Reported',
  UNDER_INVESTIGATION: 'Under Investigation',
  CHARGESHEETED: 'Chargesheeted',
  CLOSED: 'Closed',
};

export function StatusBadge({ status }: { status: InvestigationStatus }) {
  return <span className={`badge status-${status}`}>{LABELS[status]}</span>;
}
