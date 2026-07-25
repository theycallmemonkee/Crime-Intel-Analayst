// Small, dependency-free statistical primitives shared across Milestone 7's
// AI Intelligence endpoints. Deliberately plain arithmetic (ordinary least
// squares, z-score, min-max normalization) rather than a ML library — see
// Milestone 7 docs for why: these are honest, explainable techniques that
// match what this synthetic dataset actually supports, not an attempt to
// look more sophisticated than the data warrants.

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  residualStdDev: number;
}

// Ordinary least squares over (x, y) pairs — x is typically a month index,
// y a crime count. Used for trend direction/prediction, not a claim of
// statistical rigor beyond what a straight-line fit actually provides.
export function linearRegression(points: { x: number; y: number }[]): LinearRegressionResult {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: n === 1 ? points[0].y : 0, residualStdDev: 0 };

  const xMean = mean(points.map((p) => p.x));
  const yMean = mean(points.map((p) => p.y));
  const num = points.reduce((sum, p) => sum + (p.x - xMean) * (p.y - yMean), 0);
  const den = points.reduce((sum, p) => sum + (p.x - xMean) ** 2, 0);
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  const residuals = points.map((p) => p.y - (slope * p.x + intercept));
  const residualStdDev = stdDev(residuals);

  return { slope, intercept, residualStdDev };
}

// z-score of the last value against the mean/stddev of the *rest* of the
// series — used so a spike doesn't inflate the baseline it's being compared
// against.
export function zScore(value: number, baseline: number[]): number {
  const m = mean(baseline);
  const sd = stdDev(baseline);
  if (sd === 0) return 0;
  return (value - m) / sd;
}

// Rescales a set of raw values to 0–100 so heterogeneous components (crime
// volume, growth rate %, severity 1–10) can be combined into one composite
// score on a common scale — the standard approach for composite indices.
export function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi === lo) return values.map(() => 50); // no spread — treat as mid-scale, not 0
  return values.map((v) => ((v - lo) / (hi - lo)) * 100);
}

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export function riskBand(score: number): RiskBand {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}
