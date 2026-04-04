import { formatIsoClock } from '../../lib/telemetryFormat'
import { formatDelta, getMetricTrend, type MetricTrend } from '../../lib/telemetryTrend'
import type { LocomotiveTelemetry } from '../../types'

export interface TelemetryMetricRow {
  key: string
  label: string
  unit: string
  decimals: number
  read: (m: LocomotiveTelemetry) => number
  stress?: (curr: number, trend: MetricTrend) => boolean
}

export function TrendGlyph({
  trend,
  stress,
  size = 'md',
}: {
  trend: MetricTrend
  stress?: boolean
  size?: 'md' | 'lg'
}) {
  const base =
    size === 'lg'
      ? 'flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold'
      : 'flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold'
  if (trend === 'steady') {
    return (
      <span className={`${base} bg-slate-200 text-slate-500 dark:bg-slate-800`} title="Без изменений">
        —
      </span>
    )
  }
  const up = trend === 'up'
  const color = stress
    ? 'bg-amber-500/20 text-amber-900 ring-1 ring-amber-500/30 dark:text-amber-200'
    : up
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
      : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
  return (
    <span className={`${base} ${color}`} title={up ? 'Рост' : 'Снижение'}>
      {up ? '▲' : '▼'}
    </span>
  )
}

interface TelemetryMetricCardsProps {
  sectionTitle: string
  subtitle?: string
  rows: TelemetryMetricRow[]
  current: LocomotiveTelemetry
  previous: LocomotiveTelemetry
}

export function TelemetryMetricCards({
  sectionTitle,
  subtitle,
  rows,
  current,
  previous,
}: TelemetryMetricCardsProps) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {sectionTitle}
          </p>
          {subtitle ? <p className="text-[10px] text-slate-600">{subtitle}</p> : null}
        </div>
        <p className="font-mono text-[10px] text-slate-600">
          Δ vs пред. тик · {formatIsoClock(current.timestamp)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {rows.map((row) => {
          const curr = row.read(current)
          const prev = row.read(previous)
          const tr = getMetricTrend(prev, curr)
          const stress = row.stress?.(curr, tr) ?? false
          const deltaStr = formatDelta(curr, prev, row.decimals)

          return (
            <div
              key={row.key}
              className="group relative overflow-hidden rounded-lg border border-cabin-border bg-gradient-to-b from-cabin-surface to-[var(--cabin-card-shade)] p-3 ring-0 transition-all hover:border-slate-400 hover:ring-1 hover:ring-slate-400/40 dark:hover:border-slate-600 dark:hover:ring-slate-600/30"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium text-slate-500">{row.label}</p>
                <TrendGlyph trend={tr} stress={stress} />
              </div>
              <p className="mt-2 font-mono text-lg font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white sm:text-xl">
                {curr.toFixed(row.decimals)}
                <span className="ml-1 text-sm font-normal text-slate-500">{row.unit}</span>
              </p>
              <p className="mt-1 font-mono text-[10px] tabular-nums text-slate-600">{deltaStr}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
