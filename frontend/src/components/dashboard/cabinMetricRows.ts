/**
 * Row definitions for «Кабина» panels — single source for diesel / electric splits.
 */
import type { LocomotiveTelemetry } from '../../types'
import { isDieselTelemetry, isElectricTelemetry } from '../../types'
import type { TelemetryMetricRow } from './telemetryMetricShared'

export const CABIN_SPEED_ROWS: TelemetryMetricRow[] = [
  {
    key: 'speed_actual',
    label: 'Скорость факт',
    unit: 'км/ч',
    decimals: 1,
    read: (m) => m.telemetry.common.speed_actual,
  },
  {
    key: 'speed_target',
    label: 'Скорость цель',
    unit: 'км/ч',
    decimals: 1,
    read: (m) => m.telemetry.common.speed_target,
  },
  {
    key: 'traction_force_kn',
    label: 'Тяговое усилие',
    unit: 'кН',
    decimals: 0,
    read: (m) => m.telemetry.common.traction_force_kn,
  },
]

export const CABIN_BRAKE_PRESSURE_ROWS: TelemetryMetricRow[] = [
  {
    key: 'tm_pressure',
    label: 'Давл. ТМ',
    unit: 'бар',
    decimals: 2,
    read: (m) => m.telemetry.common.brakes.tm_pressure,
  },
  {
    key: 'gr_pressure',
    label: 'Давл. ГР',
    unit: 'бар',
    decimals: 1,
    read: (m) => m.telemetry.common.brakes.gr_pressure,
  },
  {
    key: 'tc_pressure',
    label: 'Давл. ТЦ',
    unit: 'бар',
    decimals: 1,
    read: (m) => m.telemetry.common.brakes.tc_pressure,
  },
]

export const CABIN_AMBIENT_TEMP_ROWS: TelemetryMetricRow[] = [
  {
    key: 'bearings_max',
    label: 'Подшипники max',
    unit: '°C',
    decimals: 1,
    read: (m) => m.telemetry.common.temperatures.bearings_max,
  },
  {
    key: 'cabin',
    label: 'Кабина',
    unit: '°C',
    decimals: 1,
    read: (m) => m.telemetry.common.temperatures.cabin,
  },
]

export const CABIN_BOARD_VOLTAGE_ROWS: TelemetryMetricRow[] = [
  {
    key: 'board_voltage',
    label: 'Бортсеть',
    unit: 'В',
    decimals: 0,
    read: (m) => m.telemetry.common.board_voltage,
  },
]

export const CABIN_DIESEL_FUEL_ENERGY_ROWS: TelemetryMetricRow[] = [
  {
    key: 'diesel_rpm',
    label: 'Обороты дизеля',
    unit: 'об/мин',
    decimals: 0,
    read: (m) => (isDieselTelemetry(m) ? m.telemetry.power_system.diesel_rpm : 0),
  },
  {
    key: 'fuel_level_percent',
    label: 'Уровень топлива',
    unit: '%',
    decimals: 1,
    read: (m) => (isDieselTelemetry(m) ? m.telemetry.power_system.fuel_level_percent : 0),
    stress: (curr, tr) => tr === 'down' && curr < 25,
  },
  {
    key: 'fuel_consumption_lh',
    label: 'Расход топлива',
    unit: 'л/ч',
    decimals: 0,
    read: (m) => (isDieselTelemetry(m) ? m.telemetry.power_system.fuel_consumption_lh : 0),
  },
]

export const CABIN_DIESEL_ENGINE_PT_ROWS: TelemetryMetricRow[] = [
  {
    key: 'oil_pressure',
    label: 'Давление масла',
    unit: 'бар',
    decimals: 1,
    read: (m) => (isDieselTelemetry(m) ? m.telemetry.power_system.oil_pressure : 0),
    stress: (curr) => curr < 3.0,
  },
  {
    key: 'oil_temp',
    label: 'Температура масла',
    unit: '°C',
    decimals: 1,
    read: (m) => (isDieselTelemetry(m) ? m.telemetry.power_system.oil_temp : 0),
    stress: (curr) => curr >= 92,
  },
  {
    key: 'coolant_temp',
    label: 'ОЖ дизеля',
    unit: '°C',
    decimals: 1,
    read: (m) => (isDieselTelemetry(m) ? m.telemetry.power_system.coolant_temp : 0),
    stress: (curr) => curr >= 92,
  },
]

export const CABIN_ELECTRIC_ENERGY_ROWS: TelemetryMetricRow[] = [
  {
    key: 'catenary_voltage_kv',
    label: 'Напряжение КС',
    unit: 'кВ',
    decimals: 1,
    read: (m) => (isElectricTelemetry(m) ? m.telemetry.power_system.catenary_voltage_kv : 0),
    stress: (curr, tr) => tr === 'down' && curr < 24.8,
  },
  {
    key: 'traction_current_a',
    label: 'Ток ТЭД',
    unit: 'А',
    decimals: 0,
    read: (m) => (isElectricTelemetry(m) ? m.telemetry.power_system.traction_current_a : 0),
  },
]

export const CABIN_ELECTRIC_TRANSFORMER_ROWS: TelemetryMetricRow[] = [
  {
    key: 'transformer_temp',
    label: 'Темп. трансформатора',
    unit: '°C',
    decimals: 1,
    read: (m) => (isElectricTelemetry(m) ? m.telemetry.power_system.transformer_temp : 0),
    stress: (curr) => curr > 80,
  },
]

export const CABIN_ELECTRIC_CONVERTER_ROW: TelemetryMetricRow = {
  key: 'converter_temp',
  label: 'Темп. конвертеров',
  unit: '°C',
  decimals: 1,
  read: (m) =>
    isElectricTelemetry(m) && m.telemetry.power_system.converter_temp !== undefined
      ? m.telemetry.power_system.converter_temp
      : 0,
}

/** Все числовые ряды для сетки кабины рядом с индексом здоровья (порядок: движение → тормоза → среда → силовая установка). */
export function cabinDashboardMetricRows(message: LocomotiveTelemetry): TelemetryMetricRow[] {
  const common: TelemetryMetricRow[] = [
    ...CABIN_SPEED_ROWS,
    ...CABIN_BRAKE_PRESSURE_ROWS,
    ...CABIN_AMBIENT_TEMP_ROWS,
    ...CABIN_BOARD_VOLTAGE_ROWS,
  ]
  if (isDieselTelemetry(message)) {
    return [...common, ...CABIN_DIESEL_FUEL_ENERGY_ROWS, ...CABIN_DIESEL_ENGINE_PT_ROWS]
  }
  if (isElectricTelemetry(message)) {
    const rows: TelemetryMetricRow[] = [
      ...common,
      ...CABIN_ELECTRIC_ENERGY_ROWS,
      ...CABIN_ELECTRIC_TRANSFORMER_ROWS,
    ]
    if (message.telemetry.power_system.converter_temp !== undefined) {
      rows.push(CABIN_ELECTRIC_CONVERTER_ROW)
    }
    return rows
  }
  return common
}

export function previousForSameLoco(
  current: LocomotiveTelemetry,
  previousMessage: LocomotiveTelemetry
): LocomotiveTelemetry {
  if (current.type === 'diesel' && isDieselTelemetry(previousMessage)) return previousMessage
  if (current.type === 'electric' && isElectricTelemetry(previousMessage)) return previousMessage
  return current
}
