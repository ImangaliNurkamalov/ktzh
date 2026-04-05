import type { LocomotiveTelemetry } from '../../types'

/** Допуск км/ч: выше лимита считаем превышением (шум измерений). */
const OVERSPEED_MARGIN_KPH = 1

const NODE_ROLES = ['start', 'last', 'next', 'end'] as const

const NODE_ROLE_LABEL_RU: Record<(typeof NODE_ROLES)[number], string> = {
  start: 'Начало',
  last: 'Пройдено',
  next: 'Далее',
  end: 'Конечная',
}

/** Центры 4 узлов на линии (% ширины блока) — совпадают с колонками flex/grid. */
const NODE_CENTER_PCT = [12.5, 37.5, 62.5, 87.5] as const

/** Отступ маркера от центров узлов 2–3 (% ширины): левый сильнее — точка визуально правее «Пройдено». */
const LEG_MARKER_LEFT_INSET_PCT = 8
const LEG_MARKER_RIGHT_INSET_PCT = 2

function telemetrySourceLabel(source: string): string {
  if (source === 'mock') return 'мок'
  if (source === 'websocket') return 'веб-сокет'
  return source
}

function alongTrackT(lat: number, lng: number): number {
  const x = (lat * 1_000_000 + lng * 999_983) % 1_000_000
  return (x % 1000) / 1000
}

function nodeNames(message: LocomotiveTelemetry): [string, string, string, string] {
  const rm = message.route_map
  if (!rm) return ['—', '—', '—', '—']

  const next = rm.next_point.trim() || 'Следующая'
  const end = rm.end_point.trim() || 'Конечная'

  return [
    rm.initial_point.trim() || 'Астана',
    rm.last_point.trim() || 'Балхаш',
    next,
    end,
  ]
}

interface TrackRoutePanelProps {
  message: LocomotiveTelemetry
  source: string
  historyPoints: number
  maxHistoryAgeMin: number
}

/**
 * Полноширинная карточка маршрута: время прибытия, скорость, линия с узлами start → last → next → end и маркер положения.
 */
export function TrackRoutePanel({ message, source, historyPoints, maxHistoryAgeMin }: TrackRoutePanelProps) {
  const { lat, lng } = message.telemetry.common.coordinates
  const actual = message.telemetry.common.speed_actual
  const limit = message.telemetry.common.speed_target
  const overspeed = actual > limit + OVERSPEED_MARGIN_KPH
  const rm = message.route_map
  const names = nodeNames(message)

  const progressT = rm
    ? Math.max(0, Math.min(1, rm.total_progress_percent / 100))
    : alongTrackT(lat, lng)

  /**
   * Маркер состава — на перегоне «Пройдено → Далее» (между 2-м и 3-м узлом),
   * позиция по прогрессу вдоль этого отрезка (а не от самого начала линии).
   */
  const legStart = NODE_CENTER_PCT[1] + LEG_MARKER_LEFT_INSET_PCT
  const legEnd = NODE_CENTER_PCT[2] - LEG_MARKER_RIGHT_INSET_PCT
  const markerLeftPercent = rm
    ? legStart + progressT * (legEnd - legStart)
    : 6.25 + progressT * 87.5

  return (
    <section
      className="rounded-xl border border-cabin-border bg-gradient-to-b from-cabin-surface to-[var(--cabin-gradient-to)] p-5 ring-1 ring-slate-300/90 dark:ring-slate-800/60"
      aria-label="Маршрут и положение поезда"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Маршрут</p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
            {rm
              ? `${rm.initial_point.trim() || 'Астана'} → ${rm.end_point.trim() || 'Алматы'}`
              : 'Участок (демо по координатам)'}
          </p>
        </div>
        {overspeed ? (
          <span className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-200 ring-1 ring-rose-500/40">
            Превышение лимита
          </span>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-8 border-t border-cabin-border pt-6 dark:border-slate-800/80">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Время прибытия</p>
          {rm ? (
            <div className="mt-2 space-y-1">
              <p className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {rm.eta_next_minutes}
                <span className="ml-1 text-sm font-normal text-slate-500">мин</span>
                <span className="ml-2 text-sm font-sans font-normal text-slate-600 dark:text-slate-400">
                  до {rm.next_point}
                </span>
              </p>
              {rm.total_eta_minutes !== undefined ? (
                <p className="text-xs text-slate-500">
                  До конечной ({rm.end_point}):{' '}
                  <span className="font-mono text-slate-600 dark:text-slate-300">{rm.total_eta_minutes} мин</span>
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Нет данных маршрута</p>
          )}
        </div>

        <div className="text-right sm:text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Скорость</p>
          <p
            className={`mt-2 font-mono text-3xl font-semibold tabular-nums ${
              overspeed ? 'text-rose-400' : 'text-slate-900 dark:text-slate-50'
            }`}
          >
            {actual.toFixed(1)}
            <span className="ml-1 text-base font-normal text-slate-500">км/ч</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Лимит{' '}
            <span className="font-mono text-slate-600 dark:text-slate-400">{limit.toFixed(1)} км/ч</span>
          </p>
        </div>
      </div>

      <div className="relative mt-10 px-1">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Линия пути</p>
        <div className="relative">
          <div className="relative h-10 w-full">
            <div
              className="pointer-events-none absolute left-[6.25%] right-[6.25%] top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-slate-500/50 dark:bg-slate-600"
              aria-hidden
            />
            <div
              className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${markerLeftPercent}%` }}
              aria-label={`Текущее положение на маршруте, около ${Math.round(progressT * 100)}% пути`}
            >
              <div
                className="h-5 w-5 rounded-full border-2 border-cyan-200 bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.65)] dark:border-cyan-100"
                role="presentation"
              />
            </div>
            <div className="absolute inset-0 flex">
              {NODE_ROLES.map((role) => (
                <div key={role} className="flex flex-1 items-center justify-center">
                  <div
                    className="z-10 h-4 w-4 shrink-0 rounded-full border-2 border-slate-400 bg-[var(--cabin-surface)] dark:border-slate-500 dark:bg-slate-950"
                    aria-hidden
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1">
            {NODE_ROLES.map((role, i) => (
              <div key={`${role}-label`} className="flex flex-col items-center text-center">
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {NODE_ROLE_LABEL_RU[role]}
                </span>
                <span
                  className="mt-1 max-w-[min(100%,7rem)] truncate px-0.5 text-xs font-medium leading-tight text-slate-700 dark:text-slate-300"
                  title={names[i]}
                >
                  {names[i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-8 border-t border-cabin-border pt-4 text-[10px] text-slate-500 dark:border-slate-800/80">
        <span className="font-mono text-slate-400">{message.type === 'diesel' ? 'ТЭ33А' : 'KZ8A'}</span>
        <span className="mx-1.5">·</span>
        <span className="font-mono text-slate-400">{telemetrySourceLabel(source)}</span>
        <span className="mx-1.5">·</span>
        буфер <span className="font-mono text-slate-400">{historyPoints}</span> т. · ≈{maxHistoryAgeMin} мин
      </p>
    </section>
  )
}
