import { getHealthBand, getHealthColor, type HealthBand } from '../../lib/healthColor'
import type { LocomotiveHealth } from '../../types'

const BAND_STYLES: Record<
  HealthBand,
  { ring: string; glowDark: string; label: string; dot: string; bar: string; blur: string; border: string }
> = {
  good: {
    border: 'border-emerald-500/25',
    ring: 'ring-emerald-500/30',
    glowDark: 'dark:shadow-[0_0_40px_-8px_rgba(52,211,153,0.35)]',
    label: 'text-emerald-800 dark:text-emerald-300',
    dot: 'bg-emerald-400',
    bar: 'bg-gradient-to-r from-emerald-600 to-emerald-400',
    blur: '#34d399',
  },
  attention: {
    border: 'border-amber-500/25',
    ring: 'ring-amber-500/30',
    glowDark: 'dark:shadow-[0_0_40px_-8px_rgba(251,191,36,0.3)]',
    label: 'text-amber-900 dark:text-amber-200',
    dot: 'bg-amber-400',
    bar: 'bg-gradient-to-r from-amber-600 to-amber-400',
    blur: '#fbbf24',
  },
  critical: {
    border: 'border-rose-500/25',
    ring: 'ring-rose-500/30',
    glowDark: 'dark:shadow-[0_0_40px_-8px_rgba(251,113,133,0.35)]',
    label: 'text-rose-900 dark:text-rose-200',
    dot: 'bg-rose-400',
    bar: 'bg-gradient-to-r from-rose-600 to-rose-400',
    blur: '#fb7185',
  },
}

const BAND_LABELS: Record<HealthBand, string> = {
  good: 'Норма',
  attention: 'Внимание',
  critical: 'Критично',
}

function buildSummary(health: LocomotiveHealth): string {
  if (health.top_factors.length === 0) {
    return `Индекс ${health.index}/100. Отклонений по ключевым факторам не зафиксировано.`
  }
  const names = health.top_factors.map((f) => f.name).join(', ')
  return `Индекс ${health.index}/100. Основные факторы: ${names}.`
}

interface HealthScoreCardProps {
  health: LocomotiveHealth
  /** `focus` — крупный индекс для левой колонки дашборда (без боковой сводки). */
  variant?: 'full' | 'focus'
}

export function HealthScoreCard({ health, variant = 'full' }: HealthScoreCardProps) {
  const band = getHealthBand(health.index)
  const palette = BAND_STYLES[band]
  const scoreColor = getHealthColor(health.index)
  const pct = Math.max(0, Math.min(100, health.index))
  const summary = buildSummary(health)
  const focus = variant === 'focus'

  return (
    <div
      className={`relative flex h-full min-h-[240px] flex-col overflow-hidden rounded-xl border bg-gradient-to-br from-cabin-surface to-[var(--cabin-gradient-to)] p-5 ring-1 shadow-none sm:min-h-[280px] ${palette.border} ${palette.ring} ${palette.glowDark}`}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-20 blur-2xl"
        style={{ background: palette.blur }}
      />

      <div
        className={`relative z-[1] flex flex-1 flex-col ${focus ? '' : 'gap-4 sm:flex-row sm:items-start sm:justify-between'}`}
      >
        <div className={focus ? 'flex flex-1 flex-col justify-center' : ''}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Индекс здоровья
          </p>
          <div className={`mt-2 flex flex-wrap items-baseline gap-3 ${focus ? 'mt-4' : ''}`}>
            <p
              className={`font-mono font-bold tabular-nums leading-none ${scoreColor} ${
                focus ? 'text-6xl sm:text-7xl' : 'text-5xl sm:text-6xl'
              }`}
              aria-label={`Индекс здоровья ${Math.round(health.index)} из 100`}
            >
              {Math.round(health.index)}
            </p>
            <span className="font-mono text-sm text-slate-500">/ 100</span>
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-slate-200/90 px-2.5 py-1 ring-1 ring-slate-300/90 dark:bg-slate-900/80 dark:ring-slate-700/80">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${palette.dot}`} aria-hidden />
            <span className={`text-xs font-semibold ${palette.label}`}>{BAND_LABELS[band]}</span>
          </div>
        </div>

        {!focus ? (
          <div className="sm:max-w-[min(100%,22rem)] sm:text-right" role="note">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Сводка</p>
            <p className="mt-1.5 text-sm leading-snug text-slate-600 dark:text-slate-300">{summary}</p>
          </div>
        ) : null}
      </div>

      {focus ? (
        <p className="relative z-[1] mt-4 text-xs leading-snug text-slate-600 dark:text-slate-400" role="note">
          {summary}
        </p>
      ) : null}

      <div
        className={`relative z-[1] h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800/90 ${focus ? 'mt-auto' : 'mt-5'}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${palette.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
