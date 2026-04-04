export type MetricTrend = 'up' | 'down' | 'steady'

export const TREND_EPS = 0.08

export function getMetricTrend(prev: number, curr: number, eps = TREND_EPS): MetricTrend {
  const d = curr - prev
  if (Math.abs(d) < eps) return 'steady'
  return d > 0 ? 'up' : 'down'
}

export function formatDelta(curr: number, prev: number, decimals: number, eps = TREND_EPS): string {
  const delta = curr - prev
  if (Math.abs(delta) < eps) return '±0'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(decimals)}`
}
