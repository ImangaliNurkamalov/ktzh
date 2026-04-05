const SPEED_MARGIN_KPH = 1

export interface CabinSpeedCardProps {
  actualKph: number
  targetKph: number
  /** Rolling-window heuristic: unstable speed readings (sensor noise) */
  speedSensorUnstable?: boolean
}

/**
 * Отдельная карточка «Скорость» слева от сетки метрик (визуально как второй тайл рядом с индексом здоровья).
 */
export function CabinSpeedCard({ actualKph, targetKph, speedSensorUnstable }: CabinSpeedCardProps) {
  const overspeed = actualKph > targetKph + SPEED_MARGIN_KPH

  const shell =
    speedSensorUnstable && !overspeed
      ? 'border-yellow-500/55 ring-yellow-500/35 bg-yellow-500/[0.06] dark:bg-yellow-500/[0.05] dark:shadow-[0_0_28px_-10px_rgba(234,179,8,0.22)]'
      : overspeed
        ? 'border-rose-500/35 ring-rose-500/25 dark:shadow-[0_0_28px_-10px_rgba(251,113,133,0.35)]'
        : 'border-cyan-500/25 ring-cyan-500/20 dark:border-cyan-500/30 dark:shadow-[0_0_32px_-12px_rgba(34,211,238,0.2)]'

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl border bg-gradient-to-br from-cabin-surface to-[var(--cabin-gradient-to)] p-5 ring-1 shadow-none ${shell}`}
      aria-label="Скорость и лимит участка"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-15 blur-2xl"
        style={{ background: overspeed ? '#fb7185' : '#22d3ee' }}
      />
      <div className="relative z-[1]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Скорость</p>
          {speedSensorUnstable ? (
            <span className="rounded border border-yellow-600/50 bg-yellow-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-yellow-950 dark:text-yellow-100">
              Проблема датчика
            </span>
          ) : null}
        </div>
        <p
          className={`mt-3 font-mono text-4xl font-bold tabular-nums leading-none sm:text-5xl ${
            overspeed ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-50'
          }`}
        >
          {actualKph.toFixed(1)}
          <span className="ml-1 text-lg font-semibold text-slate-500 sm:text-xl">км/ч</span>
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Лимит{' '}
          <span className="font-mono text-slate-700 dark:text-slate-300">{targetKph.toFixed(1)} км/ч</span>
        </p>
        {overspeed ? (
          <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">Выше лимита</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">В пределах лимита</p>
        )}
      </div>
    </div>
  )
}
