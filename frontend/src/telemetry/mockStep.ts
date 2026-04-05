import type {
  DieselLocomotiveTelemetry,
  ElectricLocomotiveTelemetry,
  LocomotiveTelemetry,
  SensorStatesMap,
} from '../types'
import { isDieselTelemetry, isElectricTelemetry } from '../types'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function noise(scale = 1) {
  return (Math.random() - 0.5) * scale
}

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

/** После шага мока обновить динамические `sensor_states` по фактическим значениям. */
function refreshDieselSensorStates(m: DieselLocomotiveTelemetry) {
  const s: SensorStatesMap = { ...(m.sensor_states ?? {}) }
  const ps = m.telemetry.power_system
  s.oil_temp = ps.oil_temp >= 98 ? 2 : ps.oil_temp >= 92 ? 1 : 0
  s.coolant_temp = ps.coolant_temp >= 96 ? 2 : ps.coolant_temp >= 92 ? 1 : 0
  s.fuel_level_percent = ps.fuel_level_percent < 25 ? 1 : 0
  s.oil_pressure = ps.oil_pressure < 3 ? 1 : 0
  m.sensor_states = s
}

function refreshElectricSensorStates(m: ElectricLocomotiveTelemetry) {
  const s: SensorStatesMap = { ...(m.sensor_states ?? {}) }
  const ps = m.telemetry.power_system
  s.catenary_voltage_kv = ps.catenary_voltage_kv < 24.8 ? 1 : 0
  s.transformer_temp = ps.transformer_temp > 80 ? 1 : 0
  m.sensor_states = s
}

/**
 * Advance one mock tick; preserves locomotive `type` and schema shape.
 */
export function stepLocomotiveTelemetry(prev: LocomotiveTelemetry): LocomotiveTelemetry {
  const next = deepClone(prev)
  const prevSec = Date.parse(prev.timestamp) / 1000
  next.timestamp = new Date((Number.isFinite(prevSec) ? prevSec : Date.now() / 1000) * 1000 + 1000).toISOString()

  if (next.route_map) {
    const rm = next.route_map
    next.route_map = {
      ...rm,
      total_progress_percent: clamp(rm.total_progress_percent + 0.04 + noise(0.02), 0, 99.5),
      distance_to_next_km: clamp(rm.distance_to_next_km - 0.1 + noise(0.06), 0, 999),
      eta_next_minutes: Math.max(0, Math.round(rm.eta_next_minutes - 0.2 + noise(0.6))),
      ...(rm.total_distance_left_km !== undefined
        ? {
            total_distance_left_km: clamp(rm.total_distance_left_km - 0.12 + noise(0.08), 0, 9999),
          }
        : {}),
      ...(rm.total_eta_minutes !== undefined
        ? {
            total_eta_minutes: Math.max(0, Math.round(rm.total_eta_minutes - 0.25 + noise(0.7))),
          }
        : {}),
    }
  }

  const c = next.telemetry.common
  c.speed_actual = clamp(c.speed_actual + Math.sin(Date.now() / 4000) * 0.4 + noise(0.35), 40, 110)
  // Occasional one-tick speed jumps so the dashboard’s rolling-window noise heuristic can fire (demo / mock only).
  if (Math.random() < 0.2) {
    c.speed_actual = clamp(
      c.speed_actual + (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 18),
      40,
      110
    )
  }
  c.brakes.tm_pressure = clamp(c.brakes.tm_pressure + noise(0.03), 4.2, 5.5)
  c.board_voltage = clamp(c.board_voltage + noise(0.4), 102, 118)

  if (isDieselTelemetry(next)) {
    const ps = next.telemetry.power_system
    ps.diesel_rpm = clamp(Math.round(ps.diesel_rpm + noise(25)), 650, 950)
    ps.fuel_level_percent = clamp(ps.fuel_level_percent - 0.04 + noise(0.02), 15, 60)
    ps.fuel_consumption_lh = clamp(ps.fuel_consumption_lh + noise(8), 150, 260)
    ps.oil_pressure = clamp(ps.oil_pressure + noise(0.06), 2.0, 5.2)
    ps.oil_temp = clamp(ps.oil_temp + (c.speed_actual > 85 ? 0.05 : -0.02) + noise(0.15), 78, 102)
    if (Math.random() < 0.2) {
      ps.oil_temp = clamp(ps.oil_temp + 5.5 + Math.random() * 8, 78, 102)
    }
    ps.coolant_temp = clamp(ps.coolant_temp + noise(0.12), 78, 98)
    next.health.index = clamp(
      Math.round(next.health.index + (ps.oil_temp > 95 ? -1 : 0) + noise(0.8)),
      45,
      99
    )
    next.alerts = deepClone(prev.alerts)
    refreshDieselSensorStates(next)
    return next
  }

  if (isElectricTelemetry(next)) {
    const ps = next.telemetry.power_system
    ps.catenary_voltage_kv = clamp(ps.catenary_voltage_kv + noise(0.12), 23.5, 28.5)
    ps.traction_current_a = clamp(Math.round(ps.traction_current_a + noise(22)), 280, 560)
    ps.transformer_temp = clamp(ps.transformer_temp + noise(0.2), 58, 88)
    if (Math.random() < 0.2) {
      ps.transformer_temp = clamp(ps.transformer_temp + 5 + Math.random() * 9, 58, 88)
    }
    next.health.index = clamp(Math.round(next.health.index + noise(0.4)), 80, 100)
    next.alerts = deepClone(prev.alerts)
    refreshElectricSensorStates(next)
    return next
  }

  return next
}
