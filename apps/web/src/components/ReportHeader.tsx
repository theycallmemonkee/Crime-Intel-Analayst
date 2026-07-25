'use client';

export function ReportHeader({
  title,
  subtitle,
  generatedAt,
  generatedBy,
}: {
  title: string;
  subtitle?: string;
  generatedAt: string;
  generatedBy: string;
}) {
  return (
    <div className="report-header">
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="chart-subtitle" style={{ margin: '0.2rem 0 0' }}>{subtitle}</p>}
          <p className="report-meta">
            Generated {new Date(generatedAt).toLocaleString()} by {generatedBy}
          </p>
        </div>
        <button className="btn no-print" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
