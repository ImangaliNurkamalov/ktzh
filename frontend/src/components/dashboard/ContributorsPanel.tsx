import type { HealthTopFactor } from '../../types'

interface ContributorsPanelProps {
  factors: HealthTopFactor[]
}

function rankStyle(rank: number) {
  if (rank === 1)
    return 'bg-rose-500/20 text-rose-800 ring-rose-500/40 dark:text-rose-300'
  if (rank === 2)
    return 'bg-amber-500/15 text-amber-900 ring-amber-500/35 dark:text-amber-200'
  if (rank === 3) return 'bg-sky-500/15 text-sky-800 ring-sky-500/35 dark:text-sky-200'
  return 'bg-slate-200 text-slate-600 ring-slate-400/80 dark:bg-slate-700/50 dark:text-slate-400 dark:ring-slate-600/50'
}

/** Bar width from negative impact (e.g. impact -10 → 90%). */
function impactBarWidth(impact: number) {
  return Math.max(0, Math.min(100, 100 + impact))
}

export function ContributorsPanel({ factors }: ContributorsPanelProps) {
  const sorted = [...factors].sort((a, b) => a.impact - b.impact).slice(0, 5)

  return (
    <div className="flex h-full flex-col rounded-xl border border-cabin-border bg-cabin-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Факторы влияния
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">Топ‑5 по вкладу</p>
        </div>
        <span className="shrink-0 rounded bg-slate-200 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-500">
          impact &lt; 0
        </span>
      </div>

      <ol className="mt-4 flex flex-1 flex-col gap-2.5">
        {sorted.map((f, idx) => {
          const rank = idx + 1
          const w = impactBarWidth(f.impact)
          return (
            <li
              key={`${f.name}-${idx}`}
              className="rounded-lg border border-cabin-border/80 bg-slate-100/90 px-3 py-2.5 dark:bg-[#0c0e14]/80"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold ring-1 ${rankStyle(rank)}`}
                >
                  {rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{f.name}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-slate-400">
                      {f.impact > 0 ? '+' : ''}
                      {f.impact}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-slate-600 to-cyan-500/90"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
