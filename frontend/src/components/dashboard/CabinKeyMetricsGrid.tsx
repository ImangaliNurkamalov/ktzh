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

function NumericMetricCard({
  row,
  current,
  previous,
  sensorState,
}: {
  row: TelemetryMetricRow
  current: LocomotiveTelemetry
  previous: LocomotiveTelemetry
  sensorState: TelemetrySensorState | undefined
}) {
  const curr = row.read(current)
  const prev = row.read(previous)
  const tr = getMetricTrend(prev, curr)
  const stress = row.stress?.(curr, tr) ?? false
  const deltaStr = formatDelta(curr, prev, row.decimals)
  const tone = sensorStateCardTone(resolveMetricSensorState(sensorState, row, current, previous))

  return (
    <div
      className={`flex h-full min-h-[5.25rem] flex-col justify-between rounded-xl border p-3.5 ring-1 sm:min-h-[5.75rem] ${tone.shell}`}
      role="listitem"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-slate-500 dark:text-slate-500">
          {row.label}
        </p>
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
  const resolved =
    sensorState !== undefined ? sensorState : value.toLowerCase() === 'fault' ? 2 : 0
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
}

/**
 * Все метрики кабины в плотной сетке у индекса здоровья (числовые ряды из `cabinMetricRows` + скольжение + токоприёмник).
 */
export function CabinKeyMetricsGrid({ message, previousMessage }: CabinKeyMetricsGridProps) {
  const prev = previousForSameLoco(message, previousMessage)
  const rows = cabinDashboardMetricRows(message)
  const slip = message.telemetry.common.wheel_slip
  const slipPrev = prev.telemetry.common.wheel_slip
  const pantograph =
    isElectricTelemetry(message) ? message.telemetry.power_system.pantograph_status : null
  const sensorStates = message.sensor_states

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
        />
      ))}
      <BoolStateCard
        label="Скольжение колёс"
        value={slip ? 'есть' : 'нет'}
        changed={slip !== slipPrev}
        sensorState={sensorStates?.wheel_slip}
      />
      {pantograph !== null ? (
        <TextStateCard label="Токоприёмник" value={pantograph} sensorState={sensorStates?.pantograph_status} />
      ) : null}
    </div>
  )
}
