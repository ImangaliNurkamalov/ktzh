export type HealthBand = 'good' | 'attention' | 'critical'

const GOOD_MIN = 85
const ATTENTION_MIN = 60

/** state 0 / 1 / 2 aligned bands by index */
export function getHealthBand(index: number): HealthBand {
  if (index >= GOOD_MIN) return 'good'
  if (index >= ATTENTION_MIN) return 'attention'
  return 'critical'
}

/** Tailwind classes for the health index numeral */
export function getHealthColor(index: number): string {
  switch (getHealthBand(index)) {
    case 'good':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'attention':
      return 'text-amber-600 dark:text-amber-400'
    default:
      return 'text-rose-600 dark:text-rose-400'
  }
}
