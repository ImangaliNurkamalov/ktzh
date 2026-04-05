import {
  displayAlertLevel,
  isSensorAnomalyAlert,
  sensorAnomalyUiSubtitle,
  sensorIssueShortExplanation,
} from '../../lib/sensorAnomalyAlerts'
import type { LocomotiveAlert, LocomotiveTelemetry } from '../../types'

const LEVEL_STYLES: Record<
  LocomotiveAlert['level'],
  { bar: string; left: string; badge: string; text: string }
> = {
  info: {
    bar: 'border-cabin-border bg-[var(--cabin-card-shade)]/80 dark:bg-[#0e1018]/90',
    left: 'border-l-[3px] border-l-sky-500',
    badge: 'bg-sky-500/20 text-sky-800 dark:text-sky-200',
    text: 'text-slate-700 dark:text-slate-300',
  },
  warning: {
    bar: 'border-cabin-border bg-[var(--cabin-card-shade)]/80 dark:bg-[#0e1018]/90',
    left: 'border-l-[3px] border-l-amber-500',
    badge: 'bg-amber-500/20 text-amber-900 dark:text-amber-200',
    text: 'text-slate-800 dark:text-slate-200',
  },
  critical: {
    bar: 'border-cabin-border bg-[var(--cabin-card-shade)]/80 dark:bg-[#0e1018]/90',
    left: 'border-l-[3px] border-l-rose-500',
    badge: 'bg-rose-500/20 text-rose-900 dark:text-rose-200',
    text: 'text-slate-800 dark:text-slate-200',
  },
}

const SENSOR_ALERT_SHELL =
  'border border-amber-500/45 bg-amber-500/[0.09] ring-1 ring-amber-500/25 dark:border-amber-500/35 dark:bg-amber-500/[0.08] dark:ring-amber-500/20'

const SENSOR_ALERT_ACCENT = 'border-l-[4px] border-l-amber-400 dark:border-l-amber-400'

export interface AlertsPanelProps {
  alerts: LocomotiveAlert[]
  message: LocomotiveTelemetry
}

export function AlertsPanel({ alerts, message }: AlertsPanelProps) {
  if (alerts.length === 0) return null

  return (
    <section
      className="rounded-xl border border-cabin-border bg-gradient-to-br from-cabin-surface to-[var(--cabin-gradient-to)] p-4 ring-1 ring-slate-800/15 dark:ring-slate-800/35"
      aria-label="Алерты"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Алерты</p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {alerts.map((a) => {
          const sensor = isSensorAnomalyAlert(a)
          const level = displayAlertLevel(a)
          const pal = LEVEL_STYLES[level]
          const subtitle = sensorAnomalyUiSubtitle(a, message)
          const sensorExplanation = sensorIssueShortExplanation(message, a)
          const feLocal = a.code === 'frontend_noisy_sensor'

          if (sensor) {
            return (
              <li
                key={a.id}
                className={`rounded-lg pl-3 pr-3 py-3 ${feLocal ? 'border border-yellow-500/45 bg-yellow-500/[0.1] ring-1 ring-yellow-500/25 dark:border-yellow-500/35 dark:bg-yellow-500/[0.08] dark:ring-yellow-500/18' : SENSOR_ALERT_SHELL} ${feLocal ? 'border-l-[4px] border-l-yellow-500 dark:border-l-yellow-400' : SENSOR_ALERT_ACCENT}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-[0.14em] ${feLocal ? 'text-yellow-900 dark:text-yellow-200' : 'text-amber-800 dark:text-amber-200'}`}
                  >
                    {feLocal ? 'Диагностика панели' : 'Проблема датчика'}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${feLocal ? 'bg-yellow-500/25 text-yellow-950 dark:text-yellow-100' : 'bg-amber-500/25 text-amber-950 dark:text-amber-100'}`}
                  >
                    Внимание
                  </span>
                </div>
                <p
                  className={`mt-2 text-xs leading-snug ${feLocal ? 'text-yellow-950/90 dark:text-yellow-100/90' : 'text-amber-950/90 dark:text-amber-100/90'}`}
                >
                  {sensorExplanation}
                </p>
                <p
                  className={`mt-2 border-t pt-2 text-sm font-medium text-slate-800 dark:text-slate-100 ${feLocal ? 'border-yellow-500/30' : 'border-amber-500/25'}`}
                >
                  {a.message}
                </p>
                {subtitle ? (
                  <p
                    className={`mt-1 text-[11px] italic ${feLocal ? 'text-yellow-900/80 dark:text-yellow-200/85' : 'text-amber-900/75 dark:text-amber-200/80'}`}
                  >
                    {subtitle}
                  </p>
                ) : null}
                {a.action_hint ? (
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{a.action_hint}</p>
                ) : null}
              </li>
            )
          }

          return (
            <li
              key={a.id}
              className={`rounded-lg border px-3 py-2.5 pl-3 ${pal.bar} ${pal.left}`}
            >
              <div className="flex flex-wrap items-center gap-2 pl-0.5">
                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${pal.badge}`}>
                  {level === 'warning' ? 'Внимание' : level === 'critical' ? 'Критично' : 'Инфо'}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Система локомотива
                </span>
              </div>
              <p className={`mt-1.5 pl-0.5 text-sm font-medium ${pal.text}`}>{a.message}</p>
              {a.action_hint ? (
                <p className="mt-1 pl-0.5 text-xs text-slate-600 dark:text-slate-400">{a.action_hint}</p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
