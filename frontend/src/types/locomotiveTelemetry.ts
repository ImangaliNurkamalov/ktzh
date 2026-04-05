/**
 * Canonical UI model: TE33A (diesel) & KZ8A (electric).
 * Wire JSON may use flat scalars or `{ value, state? }` for numeric/boolean fields
 * (diesel & electric); `pantograph_status` may be a string or `{ value: string, state? }`;
 * `timestamp`, `alerts`, `health.top_factors`, `route_map` segments may be omitted — see inbound parser.
 */

export type LocomotiveType = 'diesel' | 'electric'

/** Сенсор с бэкенда: 0 — норма, 1 — внимание, 2 — критично. */
export type TelemetrySensorState = 0 | 1 | 2

/** Ключи совпадают с `TelemetryMetricRow.key` в кабине + `wheel_slip`, `pantograph_status`. */
export type SensorStatesMap = Partial<Record<string, TelemetrySensorState>>

export type HealthStatus = 'norm' | 'warning' | 'critical'

export interface HealthTopFactor {
  name: string
  impact: number
}

export interface LocomotiveHealth {
  index: number
  status: HealthStatus
  top_factors: HealthTopFactor[]
}

export type AlertLevel = 'warning' | 'critical' | 'info'

export interface LocomotiveAlert {
  id: string
  level: AlertLevel
  message: string
  value?: number
  /** Optional; if absent, UI may fall back to parent message timestamp. */
  at?: string
  action_hint?: string
  /**
   * Optional machine-readable kind from backend (e.g. `sensor_noise`).
   * Frontend falls back to `message` keyword heuristics when absent.
   */
  code?: string
  /** Optional grouping, e.g. `sensor` vs subsystem faults. */
  category?: string
}

export interface TelemetryCoordinates {
  lat: number
  lng: number
}

export interface TelemetryBrakes {
  tm_pressure: number
  gr_pressure: number
  tc_pressure: number
}

export interface TelemetryTemperatures {
  bearings_max: number
  cabin: number
}

export interface CommonTelemetry {
  speed_actual: number
  speed_target: number
  traction_force_kn: number
  wheel_slip: boolean
  /**
   * WGS‑84. Если бэкенд не присылает `coordinates`, парсер подставляет точку по умолчанию (Астана).
   */
  coordinates: TelemetryCoordinates
  brakes: TelemetryBrakes
  temperatures: TelemetryTemperatures
  board_voltage: number
}

export interface DieselPowerSystem {
  diesel_rpm: number
  fuel_level_percent: number
  fuel_consumption_lh: number
  oil_pressure: number
  oil_temp: number
  coolant_temp: number
}

export type PantographStatus = 'raised' | 'lowered' | 'fault' | string

/** Маршрут / участок пути (опционально, с бэкенда). */
export interface RouteMap {
  initial_point: string
  last_point: string
  next_point: string
  end_point: string
  distance_to_next_km: number
  eta_next_minutes: number
  /** Остаток пути до конечной точки маршрута, км (если есть в данных). */
  total_distance_left_km?: number
  /** Оценка времени до конечной точки маршрута, мин (если есть в данных). */
  total_eta_minutes?: number
  /** 0–100, доля пройденного маршрута. */
  total_progress_percent: number
}

export interface ElectricPowerSystem {
  catenary_voltage_kv: number
  pantograph_status: PantographStatus
  traction_current_a: number
  transformer_temp: number
  converter_temp?: number
}

export interface DieselLocomotiveTelemetry {
  timestamp: string
  locomotive_id: string
  type: 'diesel'
  health: LocomotiveHealth
  telemetry: {
    common: CommonTelemetry
    power_system: DieselPowerSystem
  }
  alerts: LocomotiveAlert[]
  route_map?: RouteMap
  /** Если в JSON были `{ value, state }`, здесь состояния по ключам метрик. */
  sensor_states?: SensorStatesMap
}

export interface ElectricLocomotiveTelemetry {
  timestamp: string
  locomotive_id: string
  type: 'electric'
  health: LocomotiveHealth
  telemetry: {
    common: CommonTelemetry
    power_system: ElectricPowerSystem
  }
  alerts: LocomotiveAlert[]
  route_map?: RouteMap
  sensor_states?: SensorStatesMap
}

export type LocomotiveTelemetry = DieselLocomotiveTelemetry | ElectricLocomotiveTelemetry

export interface LocomotiveHelloMessage {
  type: 'hello'
  history: LocomotiveTelemetry[]
}

export interface LocomotiveTickMessage {
  type: 'tick'
  payload: LocomotiveTelemetry
}

export type LocomotiveWsMessage = LocomotiveHelloMessage | LocomotiveTickMessage

export function isDieselTelemetry(t: LocomotiveTelemetry): t is DieselLocomotiveTelemetry {
  return t.type === 'diesel'
}

export function isElectricTelemetry(t: LocomotiveTelemetry): t is ElectricLocomotiveTelemetry {
  return t.type === 'electric'
}
