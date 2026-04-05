import { pantographLabelRu } from '../../lib/pantographLabel'
import { getSensorAnomalyHighlightedMetricKeys } from '../../lib/sensorAnomalyAlerts'
import { sensorStateCardTone } from '../../lib/sensorStateUi'
import { formatDelta, getMetricTrend } from '../../lib/telemetryTrend'
import type { LocomotiveTelemetry, TelemetrySensorState } from '../../types'
import { isDieselTelemetry, isElectricTelemetry } from '../../types'
import { cabinDashboardMetricRows, previousForSameLoco } from './cabinMetricRows'
import { TrendGlyph, type TelemetryMetricRow } from './telemetryMetricShared'

/**
 * Цвет метрики: сначала `sensor_states` с бэка; если нет (старый/mock без полей) — пороги + `stress` в строке.
 */
function resolveMetricSensorState(
  wire: TelemetrySensorState | undefined,
  row: TelemetryMetricRow,
  current: LocomotiveTelemetry,
  previous: LocomotiveTelemetry
): TelemetrySensorState {
  if (wire !== undefined) return wire
  const curr = row.read(current)
  const prev = row.read(previous)
  const tr = getMetricTrend(prev, curr)

  if (row.key === 'oil_temp' && isDieselTelemetry(current) && curr >= 98) return 2
  if (row.key === 'coolant_temp' && isDieselTelemetry(current) && curr >= 96) return 2

  if (row.stress?.(curr, tr)) return 1
  return 0
}

/** Scenario 2: sensor noise — show attention, never critical from false spikes. */
function applySensorAnomalyCap(
  state: TelemetrySensorState,
  rowKey: string,
  anomalyKeys: Set<string>
): TelemetrySensorState {
  if (!anomalyKeys.has(rowKey)) return state
  if (state === 2) return 1
  if (state === 0) return 1
  return state
}

function NumericMetricCard({
  row,
  current,
  previous,
  sensorState,
  anomalyKeys,
  frontendNoisyKeys,
  backendSensorAnomalyKeys,
}: {
  row: TelemetryMetricRow
  current: LocomotiveTelemetry
  previous: LocomotiveTelemetry
  sensorState: TelemetrySensorState | undefined
  anomalyKeys: Set<string>
  frontendNoisyKeys: Set<string>
  backendSensorAnomalyKeys: Set<string>
}) {
  const curr = row.read(current)
  const prev = row.read(previous)
  const tr = getMetricTrend(prev, curr)
  const stress = row.stress?.(curr, tr) ?? false
  const deltaStr = formatDelta(curr, prev, row.decimals)
  const base = resolveMetricSensorState(sensorState, row, current, previous)
  const tone = sensorStateCardTone(applySensorAnomalyCap(base, row.key, anomalyKeys))
  const feNoise = frontendNoisyKeys.has(row.key)
  const beSensor = backendSensorAnomalyKeys.has(row.key) && !feNoise

  const noiseChrome = feNoise
    ? 'ring-2 ring-yellow-500/70 ring-offset-2 ring-offset-[var(--cabin-surface)] dark:ring-offset-[var(--cabin-surface)] border-yellow-500/60 bg-yellow-500/[0.12] shadow-[0_0_0_1px_rgba(234,179,8,0.28)] dark:bg-yellow-500/[0.08]'
    : beSensor
      ? 'ring-2 ring-amber-500/65 ring-offset-2 ring-offset-[var(--cabin-surface)] dark:ring-offset-[var(--cabin-surface)] border-amber-500/55 shadow-[0_0_0_1px_rgba(245,158,11,0.25)]'
      : ''

  return (
    <div
      className={`relative flex h-full min-h-[5.25rem] flex-col justify-between rounded-xl border p-3.5 ring-1 sm:min-h-[5.75rem] ${tone.shell} ${noiseChrome}`}
      role="listitem"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-slate-500 dark:text-slate-500">
            {row.label}
          </p>
          {feNoise ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span
                className="inline-flex rounded border border-yellow-600/55 bg-yellow-500/25 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-yellow-950 dark:text-yellow-100"
                title="Локальная эвристика: высокая доля шумных отсчётов в окне"
              >
                Проблема датчика
              </span>
              <span
                className="inline-flex rounded border border-yellow-600/40 bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-medium text-yellow-900 dark:text-yellow-200"
                title="Проблема может быть в датчике, а не в подсистеме локомотива"
              >
                Нестабильные показания
              </span>
            </div>
          ) : beSensor ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span
                className="inline-flex rounded border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-100"
                title="Показания датчика могут быть недостоверны"
              >
                Аномалия датчика
              </span>
              <span
                className="inline-flex rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-900 dark:text-amber-200"
                title="Высокая доля шума в потоке значений"
              >
                Нестабильные показания
              </span>
            </div>
          ) : null}
        </div>
        <TrendGlyph trend={tr} stress={stress} size="lg" />
      </div>
      <p
        className={`mt-2 font-mono text-xl font-semibold tabular-nums leading-none sm:text-2xl ${tone.value}`}
      >
        {curr.toFixed(row.decimals)}
        <span className={`ml-1.5 text-sm font-medium tabular-nums sm:text-base ${tone.unit}`}>{row.unit}</span>
      </p>
      <p className="mt-2 font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-500 sm:text-xs">
        Δ {deltaStr}
      </p>
    </div>
  )
}

function BoolStateCard({
  label,
  value,
  changed,
  sensorState,
}: {
  label: string
  value: string
  changed: boolean
  sensorState: TelemetrySensorState | undefined
}) {
  const resolved = sensorState !== undefined ? sensorState : value === 'есть' ? 1 : 0
  const tone = sensorStateCardTone(resolved)

  return (
    <div
      className={`flex h-full min-h-[5.25rem] flex-col justify-between rounded-xl border p-3.5 ring-1 sm:min-h-[5.75rem] ${tone.shell}`}
      role="listitem"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-lg font-semibold sm:text-xl ${tone.value}`}>{value}</p>
      <div className="mt-2 min-h-[1.25rem]">
        {changed ? (
          <p className="text-[10px] text-slate-500 sm:text-xs">Изменение vs пред. тик</p>
        ) : null}
      </div>
    </div>
  )
}

function TextStateCard({
  label,
  value,
  sensorState,
}: {
  label: string
  value: string
  sensorState: TelemetrySensorState | undefined
}) {
  const v = value.toLowerCase()
  const resolved =
    sensorState !== undefined ? sensorState : v === 'fault' || v === 'неисправность' ? 2 : 0
  const tone = sensorStateCardTone(resolved)
  return (
    <div
      className={`flex h-full min-h-[5.25rem] flex-col justify-between rounded-xl border p-3.5 ring-1 sm:min-h-[5.75rem] ${tone.shell}`}
      role="listitem"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
        {label}
      </p>
      <p className={`mt-2 font-mono text-lg font-semibold sm:text-xl ${tone.value}`}>{value}</p>
      <div className="mt-2 min-h-[1.25rem]" aria-hidden />
    </div>
  )
}

export interface CabinKeyMetricsGridProps {
  message: LocomotiveTelemetry
  previousMessage: LocomotiveTelemetry
  /** Rolling-window frontend noise detection (dashboard-only) */
  frontendNoisyKeys?: Set<string>
}

/**
 * Все метрики кабины в плотной сетке у индекса здоровья (числовые ряды из `cabinMetricRows` + скольжение + токоприёмник).
 */
export function CabinKeyMetricsGrid({ message, previousMessage, frontendNoisyKeys }: CabinKeyMetricsGridProps) {
  const prev = previousForSameLoco(message, previousMessage)
  const rows = cabinDashboardMetricRows(message)
  const slip = message.telemetry.common.wheel_slip
  const slipPrev = prev.telemetry.common.wheel_slip
  const pantograph =
    isElectricTelemetry(message) ? message.telemetry.power_system.pantograph_status : null
  const sensorStates = message.sensor_states
  const backendSensorAnomalyKeys = getSensorAnomalyHighlightedMetricKeys(message)
  const feKeys = frontendNoisyKeys ?? new Set<string>()
  const capKeys = new Set([...backendSensorAnomalyKeys, ...feKeys])

  return (
    <div
      className="grid h-full min-h-0 auto-rows-[minmax(5.25rem,1fr)] grid-cols-2 gap-3 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-3 sm:gap-3 lg:grid-cols-3 lg:gap-3.5 xl:grid-cols-4 2xl:grid-cols-4"
      role="list"
      aria-label="Показатели кабины"
    >
      {rows.map((row) => (
        <NumericMetricCard
          key={row.key}
          row={row}
          current={message}
          previous={prev}
          sensorState={sensorStates?.[row.key]}
          anomalyKeys={capKeys}
          frontendNoisyKeys={feKeys}
          backendSensorAnomalyKeys={backendSensorAnomalyKeys}
        />
      ))}
      <BoolStateCard
        label="Скольжение колёс"
        value={slip ? 'есть' : 'нет'}
        changed={slip !== slipPrev}
        sensorState={sensorStates?.wheel_slip}
      />
      {pantograph !== null ? (
        <TextStateCard
          label="Токоприёмник"
          value={pantographLabelRu(String(pantograph))}
          sensorState={sensorStates?.pantograph_status}
        />
      ) : null}
    </div>
  )
}
