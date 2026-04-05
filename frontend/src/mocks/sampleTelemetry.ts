import type {
  DieselLocomotiveTelemetry,
  ElectricLocomotiveTelemetry,
  LocomotiveTelemetry,
  LocomotiveType,
  RouteMap,
  TelemetrySensorState,
} from '../types/locomotiveTelemetry'
import { telemetryTimestampSeconds } from '../lib/locomotiveTime'
import { trimTelemetryHistory } from '../lib/telemetryBuffer'

/** Mock dashboard switcher — diesel (TE33A). */
export const MOCK_DIESEL_LOCOMOTIVE_ID = 'TE33A-0154' as const
/** Mock dashboard switcher — electric (KZ8A). */
export const MOCK_ELECTRIC_LOCOMOTIVE_ID = 'KZ8A-0021' as const

/** Демо `route_map` в формате бэкенда. */
export const DEMO_ROUTE_MAP: RouteMap = {
  initial_point: 'Астана',
  last_point: 'Караганда',
  next_point: 'Балхаш',
  end_point: 'Алматы',
  distance_to_next_km: 150.2,
  eta_next_minutes: 125,
  total_distance_left_km: 924.6,
  total_eta_minutes: 735,
  total_progress_percent: 35.0,
}

/** `route_map` для демо KZ8A (как в актуальном JSON электровоза). */
export const DEMO_ROUTE_MAP_KZ8A: RouteMap = {
  initial_point: 'Астана',
  last_point: 'Балхаш',
  next_point: 'Шу',
  end_point: 'Алматы',
  distance_to_next_km: 150.0,
  eta_next_minutes: 100,
  total_distance_left_km: 350.0,
  total_eta_minutes: 233,
  total_progress_percent: 65.0,
}

/** Static sample — field names match backend JSON (TE33A / diesel). */
export const MOCK_TE33A_SAMPLE: DieselLocomotiveTelemetry = {
  timestamp: '2026-04-04T13:22:35.000Z',
  locomotive_id: MOCK_DIESEL_LOCOMOTIVE_ID,
  type: 'diesel',
  health: {
    index: 82,
    status: 'warning',
    top_factors: [
      { name: 'Температура масла', impact: -10 },
      { name: 'Давление в ТМ', impact: -8 },
    ],
  },
  telemetry: {
    common: {
      speed_actual: 75.4,
      speed_target: 80.0,
      traction_force_kn: 320,
      wheel_slip: false,
      coordinates: { lat: 51.169392, lng: 71.449074 },
      brakes: { tm_pressure: 4.8, gr_pressure: 8.5, tc_pressure: 1.2 },
      temperatures: { bearings_max: 65.2, cabin: 22.0 },
      board_voltage: 110,
    },
    power_system: {
      diesel_rpm: 850,
      fuel_level_percent: 42.5,
      fuel_consumption_lh: 210,
      oil_pressure: 4.2,
      oil_temp: 94.0,
      coolant_temp: 88.5,
    },
  },
  route_map: DEMO_ROUTE_MAP,
  /** Как в wire JSON `{ value, state }` — для демо без WebSocket. */
  sensor_states: {
    speed_actual: 0 as TelemetrySensorState,
    speed_target: 0,
    traction_force_kn: 0,
    wheel_slip: 0,
    tm_pressure: 1,
    gr_pressure: 0,
    tc_pressure: 0,
    bearings_max: 0,
    cabin: 0,
    board_voltage: 0,
    diesel_rpm: 0,
    fuel_level_percent: 0,
    fuel_consumption_lh: 0,
    oil_pressure: 0,
    oil_temp: 1,
    coolant_temp: 0,
  },
  /** Демо сценарий 2: шум датчика масла (не обязательно поломка узла). */
  alerts: [
    {
      id: 'demo-oil-sensor-noise',
      level: 'warning',
      code: 'sensor_noise',
      category: 'sensor',
      message:
        'Высокий уровень шума датчика масла. Возможна неисправность сенсора.',
    },
  ],
}

/** Static sample — как обновлённый JSON KZ8A (координаты в моке — дефолт парсера, в API могут отсутствовать). */
export const MOCK_KZ8A_SAMPLE: ElectricLocomotiveTelemetry = {
  timestamp: '2026-04-04T13:22:36.000Z',
  locomotive_id: MOCK_ELECTRIC_LOCOMOTIVE_ID,
  type: 'electric',
  health: {
    index: 95,
    status: 'norm',
    top_factors: [{ name: 'Температура трансформатора', impact: -5 }],
  },
  route_map: DEMO_ROUTE_MAP_KZ8A,
  telemetry: {
    common: {
      speed_actual: 90.2,
      speed_target: 90.0,
      traction_force_kn: 450,
      wheel_slip: false,
      coordinates: { lat: 51.169392, lng: 71.449074 },
      brakes: { tm_pressure: 5.0, gr_pressure: 9.0, tc_pressure: 0.0 },
      temperatures: { bearings_max: 58.4, cabin: 21.5 },
      board_voltage: 110,
    },
    power_system: {
      catenary_voltage_kv: 27.2,
      pantograph_status: 'raised',
      traction_current_a: 480,
      transformer_temp: 75.0,
    },
  },
  sensor_states: {
    speed_actual: 0 as TelemetrySensorState,
    speed_target: 0,
    traction_force_kn: 0,
    wheel_slip: 0,
    tm_pressure: 0,
    gr_pressure: 0,
    tc_pressure: 0,
    bearings_max: 0,
    cabin: 0,
    board_voltage: 0,
    catenary_voltage_kv: 0,
    traction_current_a: 0,
    transformer_temp: 0,
    pantograph_status: 0,
  },
  alerts: [
    {
      id: 'demo-transformer-sensor-noise',
      level: 'warning',
      code: 'sensor_noise',
      category: 'sensor',
      message:
        'Высокий уровень шума датчика трансформатора. Возможна неисправность сенсора.',
    },
  ],
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function noise(scale = 1) {
  return (Math.random() - 0.5) * scale
}

function isoFromSeconds(sec: number): string {
  return new Date(sec * 1000).toISOString()
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

/** Build synthetic history ending at the given sample (same locomotive type). */
export function buildLocomotiveHistory(
  variant: LocomotiveType,
  points = 90,
  intervalSec = 1
): LocomotiveTelemetry[] {
  const end = Date.now() / 1000
  const start = end - (points - 1) * intervalSec
  const out: LocomotiveTelemetry[] = []

  if (variant === 'diesel') {
    const base = deepClone(MOCK_TE33A_SAMPLE)
    for (let i = 0; i < points; i++) {
      const t = start + i * intervalSec
      const u = i / Math.max(1, points - 1)
      const phase = i * 0.09
      const row = deepClone(base)
      row.timestamp = isoFromSeconds(t)
      row.telemetry.common.speed_actual = clamp(68 + u * 8 + Math.sin(phase) * 3, 55, 88)
      row.telemetry.common.speed_target = 80
      row.telemetry.common.brakes.tm_pressure = clamp(4.75 + Math.sin(phase * 0.5) * 0.2, 4.3, 5.2)
      row.telemetry.power_system.diesel_rpm = clamp(780 + u * 90 + Math.sin(phase) * 40, 650, 920)
      row.telemetry.power_system.fuel_level_percent = clamp(48 - u * 8 + noise(0.2), 28, 55)
      row.telemetry.power_system.fuel_consumption_lh = clamp(195 + Math.sin(phase * 1.1) * 25, 160, 240)
      row.telemetry.power_system.oil_pressure = clamp(4.0 + noise(0.08), 3.2, 4.8)
      row.telemetry.power_system.oil_temp = clamp(86 + u * 6 + Math.sin(phase * 0.8) * 2, 80, 98)
      row.telemetry.power_system.coolant_temp = clamp(84 + u * 4 + Math.sin(phase) * 1.5, 78, 94)
      row.health.index = clamp(Math.round(78 + u * 6 + noise(2)), 55, 95)
      if (row.route_map) {
        row.route_map = {
          ...row.route_map,
          total_progress_percent: clamp(22 + u * 18 + noise(0.4), 0, 92),
          distance_to_next_km: clamp(195 - u * 55 + noise(1.2), 8, 220),
          eta_next_minutes: Math.max(8, Math.round(155 - u * 45 + noise(4))),
          total_distance_left_km: clamp(980 - u * 120 + noise(2), 50, 1200),
          total_eta_minutes: Math.max(60, Math.round(780 - u * 90 + noise(8))),
        }
      }
      out.push(row)
    }
    return out
  }

  const base = deepClone(MOCK_KZ8A_SAMPLE)
  for (let i = 0; i < points; i++) {
    const t = start + i * intervalSec
    const u = i / Math.max(1, points - 1)
    const phase = i * 0.1
    const row = deepClone(base)
    row.timestamp = isoFromSeconds(t)
    row.telemetry.common.speed_actual = clamp(82 + u * 10 + Math.sin(phase) * 2, 70, 100)
    row.telemetry.common.speed_target = 90
    row.telemetry.power_system.catenary_voltage_kv = clamp(25.5 + u * 1.2 + Math.sin(phase * 0.4) * 0.4, 24, 27.8)
    row.telemetry.power_system.traction_current_a = clamp(400 + u * 90 + Math.sin(phase * 1.2) * 40, 320, 520)
    row.telemetry.power_system.transformer_temp = clamp(68 + u * 8 + Math.sin(phase) * 2, 62, 82)
    row.health.index = clamp(Math.round(92 + noise(1.5)), 85, 99)
    if (row.route_map) {
      row.route_map = {
        ...row.route_map,
        total_progress_percent: clamp(25 + u * 20 + noise(0.35), 0, 94),
        distance_to_next_km: clamp(188 - u * 50 + noise(1), 10, 210),
        eta_next_minutes: Math.max(10, Math.round(148 - u * 42 + noise(3))),
        total_distance_left_km: clamp(960 - u * 110 + noise(2), 55, 1150),
        total_eta_minutes: Math.max(55, Math.round(760 - u * 85 + noise(7))),
      }
    }
    out.push(row)
  }
  return out
}

export type MockLocoVariant = LocomotiveType

/** Initial buffer + latest message for dashboard seed (mock mode). */
export function getDashboardMock(variant: MockLocoVariant = 'diesel'): {
  latest: LocomotiveTelemetry
  history: LocomotiveTelemetry[]
} {
  const history = buildLocomotiveHistory(variant, 120, 1)
  const latest = deepClone(history[history.length - 1]!)
  const lastT = telemetryTimestampSeconds(latest.timestamp)
  const trimmed = trimTelemetryHistory(history, 15 * 60, lastT)
  return { latest: trimmed[trimmed.length - 1]!, history: trimmed }
}
