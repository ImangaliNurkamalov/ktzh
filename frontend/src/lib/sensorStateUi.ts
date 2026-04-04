import type { TelemetrySensorState } from '../types'

/** Оболочка карточки метрики и цвет основного числа по `state` из JSON. */
export function sensorStateCardTone(state: TelemetrySensorState | undefined): {
  shell: string
  value: string
  unit: string
} {
  if (state === undefined) {
    return {
      shell:
        'border-cabin-border bg-[var(--cabin-card-shade)]/90 ring-slate-800/25 dark:bg-[#0c0e14]/90 dark:ring-slate-800/45',
      value: 'text-slate-900 dark:text-slate-50',
      unit: 'text-slate-500 dark:text-slate-400',
    }
  }
  if (state === 0) {
    return {
      shell:
        'border-emerald-500/40 bg-emerald-500/[0.07] ring-emerald-500/25 dark:border-emerald-500/35 dark:bg-emerald-500/[0.09]',
      value: 'text-emerald-800 dark:text-emerald-300',
      unit: 'text-emerald-700/90 dark:text-emerald-400/90',
    }
  }
  if (state === 1) {
    return {
      shell:
        'border-amber-500/45 bg-amber-500/[0.09] ring-amber-500/30 dark:border-amber-500/40 dark:bg-amber-500/[0.1]',
      value: 'text-amber-900 dark:text-amber-200',
      unit: 'text-amber-800/90 dark:text-amber-300/90',
    }
  }
  return {
    shell: 'border-rose-500/45 bg-rose-500/[0.09] ring-rose-500/35 dark:border-rose-500/45 dark:bg-rose-500/[0.1]',
    value: 'text-rose-900 dark:text-rose-300',
    unit: 'text-rose-800/90 dark:text-rose-400/90',
  }
}
