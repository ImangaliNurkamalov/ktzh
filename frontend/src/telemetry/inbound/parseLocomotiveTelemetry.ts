/**
 * Normalizes and validates backend / wire JSON into `LocomotiveTelemetry`.
 * Fills safe defaults where the API may omit optional arrays.
 */
import type {
  CommonTelemetry,
  DieselLocomotiveTelemetry,
  ElectricLocomotiveTelemetry,
  HealthStatus,
  LocomotiveAlert,
  LocomotiveHealth,
  LocomotiveTelemetry,
  LocomotiveType,
  RouteMap,
  SensorStatesMap,
  TelemetrySensorState,
} from '../../types'
import { parseErr, parseOk, type ParseResult } from './parseResult'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function asString(x: unknown, path: string): ParseResult<string> {
  if (typeof x === 'string' && x.length > 0) return parseOk(x)
  return parseErr(`${path}: expected non-empty string`)
}

function asNumber(x: unknown, path: string): ParseResult<number> {
  if (typeof x === 'number' && Number.isFinite(x)) return parseOk(x)
  if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) return parseOk(Number(x))
  return parseErr(`${path}: expected finite number`)
}

function asBoolean(x: unknown, path: string): ParseResult<boolean> {
  if (typeof x === 'boolean') return parseOk(x)
  if (x === 0 || x === 1) return parseOk(x === 1)
  if (x === '0' || x === '1') return parseOk(x === '1')
  return parseErr(`${path}: expected boolean`)
}

/** Backend TE33A-style: plain scalar or `{ value, state? }`. */
function unwrapNumber(x: unknown, path: string): ParseResult<number> {
  if (isRecord(x) && 'value' in x) return asNumber(x.value, `${path}.value`)
  return asNumber(x, path)
}

function asSensorState(x: unknown, path: string): ParseResult<TelemetrySensorState> {
  const n = asNumber(x, path)
  if (!n.ok) return n
  if (n.value !== 0 && n.value !== 1 && n.value !== 2) {
    return parseErr(`${path}: expected sensor state 0 | 1 | 2`)
  }
  return parseOk(n.value as TelemetrySensorState)
}

function optionalSensorState(rec: Record<string, unknown>, path: string): ParseResult<TelemetrySensorState | undefined> {
  if (rec.state === undefined) return parseOk(undefined)
  return asSensorState(rec.state, `${path}.state`)
}

type UnwrapNum = { value: number; state?: TelemetrySensorState }

function unwrapNumberWithState(x: unknown, path: string): ParseResult<UnwrapNum> {
  if (isRecord(x) && 'value' in x) {
    const v = asNumber(x.value, `${path}.value`)
    if (!v.ok) return v
    const st = optionalSensorState(x, path)
    if (!st.ok) return st
    return parseOk({ value: v.value, state: st.value })
  }
  const v = asNumber(x, path)
  if (!v.ok) return v
  return parseOk({ value: v.value })
}

type UnwrapBool = { value: boolean; state?: TelemetrySensorState }

function unwrapBooleanWithState(x: unknown, path: string): ParseResult<UnwrapBool> {
  if (isRecord(x) && 'value' in x) {
    const v = asBoolean(x.value, `${path}.value`)
    if (!v.ok) return v
    const st = optionalSensorState(x, path)
    if (!st.ok) return st
    return parseOk({ value: v.value, state: st.value })
  }
  const v = asBoolean(x, path)
  if (!v.ok) return v
  return parseOk({ value: v.value })
}

function putState(states: SensorStatesMap, key: string, state: TelemetrySensorState | undefined) {
  if (state !== undefined) states[key] = state
}

function routeSegment(x: unknown, path: string): ParseResult<string> {
  if (x === undefined || x === null) return parseOk('')
  if (typeof x === 'string') return parseOk(x)
  return parseErr(`${path}: expected string`)
}

const HEALTH_STATUSES = new Set<HealthStatus>(['norm', 'warning', 'critical'])
const ALERT_LEVELS = new Set(['warning', 'critical', 'info'] as const)

function parseHealthTopFactors(x: unknown, path: string): ParseResult<LocomotiveHealth['top_factors']> {
  if (!Array.isArray(x)) return parseErr(`${path}: top_factors must be an array`)
  const out: LocomotiveHealth['top_factors'] = []
  for (let i = 0; i < x.length; i++) {
    const el = x[i]
    if (!isRecord(el)) return parseErr(`${path}[${i}]: expected object`)
    const name = asString(el.name, `${path}[${i}].name`)
    if (!name.ok) return name
    const impact = asNumber(el.impact, `${path}[${i}].impact`)
    if (!impact.ok) return impact
    out.push({ name: name.value, impact: impact.value })
  }
  return parseOk(out)
}

function parseHealth(x: unknown, path: string): ParseResult<LocomotiveHealth> {
  if (!isRecord(x)) return parseErr(`${path}: expected object`)
  const index = asNumber(x.index, `${path}.index`)
  if (!index.ok) return index
  if (typeof x.status !== 'string' || !HEALTH_STATUSES.has(x.status as HealthStatus)) {
    return parseErr(`${path}.status: expected norm | warning | critical`)
  }
  const status = x.status as HealthStatus
  const factorsRaw = x.top_factors
  const factors =
    factorsRaw === undefined
      ? parseOk([] as LocomotiveHealth['top_factors'])
      : parseHealthTopFactors(factorsRaw, `${path}.top_factors`)
  if (!factors.ok) return factors
  return parseOk({ index: index.value, status, top_factors: factors.value })
}

function parseAlerts(x: unknown, path: string): ParseResult<LocomotiveAlert[]> {
  if (x === undefined) return parseOk([])
  if (!Array.isArray(x)) return parseErr(`${path}: alerts must be an array`)
  const out: LocomotiveAlert[] = []
  for (let i = 0; i < x.length; i++) {
    const el = x[i]
    if (!isRecord(el)) return parseErr(`${path}[${i}]: expected object`)
    const id = asString(el.id, `${path}[${i}].id`)
    if (!id.ok) return id
    if (typeof el.level !== 'string' || !ALERT_LEVELS.has(el.level as LocomotiveAlert['level'])) {
      return parseErr(`${path}[${i}].level: invalid alert level`)
    }
    const message = asString(el.message, `${path}[${i}].message`)
    if (!message.ok) return message
    const alert: LocomotiveAlert = {
      id: id.value,
      level: el.level as LocomotiveAlert['level'],
      message: message.value,
    }
    if (el.value !== undefined) {
      const v = asNumber(el.value, `${path}[${i}].value`)
      if (!v.ok) return v
      alert.value = v.value
    }
    if (el.at !== undefined) {
      const at = asString(el.at, `${path}[${i}].at`)
      if (!at.ok) return at
      alert.at = at.value
    }
    if (el.action_hint !== undefined) {
      const h = asString(el.action_hint, `${path}[${i}].action_hint`)
      if (!h.ok) return h
      alert.action_hint = h.value
    }
    out.push(alert)
  }
  return parseOk(out)
}

/** Подстановка, если `telemetry.common.coordinates` нет в JSON. */
const DEFAULT_COORDINATES = { lat: 51.169392, lng: 71.449074 }

function parseCommon(x: unknown, path: string): ParseResult<{
  common: CommonTelemetry
  states: SensorStatesMap
}> {
  if (!isRecord(x)) return parseErr(`${path}: expected object`)
  const states: SensorStatesMap = {}

  const speed_actual = unwrapNumberWithState(x.speed_actual, `${path}.speed_actual`)
  if (!speed_actual.ok) return speed_actual
  putState(states, 'speed_actual', speed_actual.value.state)

  const speed_target = unwrapNumberWithState(x.speed_target, `${path}.speed_target`)
  if (!speed_target.ok) return speed_target
  putState(states, 'speed_target', speed_target.value.state)

  const traction_force_kn = unwrapNumberWithState(x.traction_force_kn, `${path}.traction_force_kn`)
  if (!traction_force_kn.ok) return traction_force_kn
  putState(states, 'traction_force_kn', traction_force_kn.value.state)

  const wheel_slip = unwrapBooleanWithState(x.wheel_slip, `${path}.wheel_slip`)
  if (!wheel_slip.ok) return wheel_slip
  putState(states, 'wheel_slip', wheel_slip.value.state)

  let coordinates = DEFAULT_COORDINATES
  if (x.coordinates !== undefined) {
    if (!isRecord(x.coordinates)) return parseErr(`${path}.coordinates: expected object`)
    const lat = unwrapNumber(x.coordinates.lat, `${path}.coordinates.lat`)
    if (!lat.ok) return lat
    const lng = unwrapNumber(x.coordinates.lng, `${path}.coordinates.lng`)
    if (!lng.ok) return lng
    coordinates = { lat: lat.value, lng: lng.value }
  }
  if (!isRecord(x.brakes)) return parseErr(`${path}.brakes: expected object`)
  const tm = unwrapNumberWithState(x.brakes.tm_pressure, `${path}.brakes.tm_pressure`)
  if (!tm.ok) return tm
  putState(states, 'tm_pressure', tm.value.state)
  const gr = unwrapNumberWithState(x.brakes.gr_pressure, `${path}.brakes.gr_pressure`)
  if (!gr.ok) return gr
  putState(states, 'gr_pressure', gr.value.state)
  const tc = unwrapNumberWithState(x.brakes.tc_pressure, `${path}.brakes.tc_pressure`)
  if (!tc.ok) return tc
  putState(states, 'tc_pressure', tc.value.state)

  if (!isRecord(x.temperatures)) return parseErr(`${path}.temperatures: expected object`)
  const bearings_max = unwrapNumberWithState(x.temperatures.bearings_max, `${path}.temperatures.bearings_max`)
  if (!bearings_max.ok) return bearings_max
  putState(states, 'bearings_max', bearings_max.value.state)
  const cabin = unwrapNumberWithState(x.temperatures.cabin, `${path}.temperatures.cabin`)
  if (!cabin.ok) return cabin
  putState(states, 'cabin', cabin.value.state)

  const board_voltage = unwrapNumberWithState(x.board_voltage, `${path}.board_voltage`)
  if (!board_voltage.ok) return board_voltage
  putState(states, 'board_voltage', board_voltage.value.state)

  return parseOk({
    common: {
      speed_actual: speed_actual.value.value,
      speed_target: speed_target.value.value,
      traction_force_kn: traction_force_kn.value.value,
      wheel_slip: wheel_slip.value.value,
      coordinates,
      brakes: { tm_pressure: tm.value.value, gr_pressure: gr.value.value, tc_pressure: tc.value.value },
      temperatures: { bearings_max: bearings_max.value.value, cabin: cabin.value.value },
      board_voltage: board_voltage.value.value,
    },
    states,
  })
}

function parseDieselPower(x: unknown, path: string): ParseResult<{
  power_system: DieselLocomotiveTelemetry['telemetry']['power_system']
  states: SensorStatesMap
}> {
  if (!isRecord(x)) return parseErr(`${path}: expected object`)
  const states: SensorStatesMap = {}

  const diesel_rpm = unwrapNumberWithState(x.diesel_rpm, `${path}.diesel_rpm`)
  if (!diesel_rpm.ok) return diesel_rpm
  putState(states, 'diesel_rpm', diesel_rpm.value.state)
  const fuel_level_percent = unwrapNumberWithState(x.fuel_level_percent, `${path}.fuel_level_percent`)
  if (!fuel_level_percent.ok) return fuel_level_percent
  putState(states, 'fuel_level_percent', fuel_level_percent.value.state)
  const fuel_consumption_lh = unwrapNumberWithState(x.fuel_consumption_lh, `${path}.fuel_consumption_lh`)
  if (!fuel_consumption_lh.ok) return fuel_consumption_lh
  putState(states, 'fuel_consumption_lh', fuel_consumption_lh.value.state)
  const oil_pressure = unwrapNumberWithState(x.oil_pressure, `${path}.oil_pressure`)
  if (!oil_pressure.ok) return oil_pressure
  putState(states, 'oil_pressure', oil_pressure.value.state)
  const oil_temp = unwrapNumberWithState(x.oil_temp, `${path}.oil_temp`)
  if (!oil_temp.ok) return oil_temp
  putState(states, 'oil_temp', oil_temp.value.state)
  const coolant_temp = unwrapNumberWithState(x.coolant_temp, `${path}.coolant_temp`)
  if (!coolant_temp.ok) return coolant_temp
  putState(states, 'coolant_temp', coolant_temp.value.state)

  return parseOk({
    power_system: {
      diesel_rpm: diesel_rpm.value.value,
      fuel_level_percent: fuel_level_percent.value.value,
      fuel_consumption_lh: fuel_consumption_lh.value.value,
      oil_pressure: oil_pressure.value.value,
      oil_temp: oil_temp.value.value,
      coolant_temp: coolant_temp.value.value,
    },
    states,
  })
}

function parseElectricPower(x: unknown, path: string): ParseResult<{
  power_system: ElectricLocomotiveTelemetry['telemetry']['power_system']
  states: SensorStatesMap
}> {
  if (!isRecord(x)) return parseErr(`${path}: expected object`)
  const states: SensorStatesMap = {}

  const catenary_voltage_kv = unwrapNumberWithState(x.catenary_voltage_kv, `${path}.catenary_voltage_kv`)
  if (!catenary_voltage_kv.ok) return catenary_voltage_kv
  putState(states, 'catenary_voltage_kv', catenary_voltage_kv.value.state)

  let pantograph_status: string
  let pantograph_state: TelemetrySensorState | undefined
  if (typeof x.pantograph_status === 'string') {
    pantograph_status = x.pantograph_status
  } else if (isRecord(x.pantograph_status) && 'value' in x.pantograph_status) {
    const v = x.pantograph_status.value
    if (typeof v !== 'string') return parseErr(`${path}.pantograph_status.value: expected string`)
    pantograph_status = v
    const st = optionalSensorState(x.pantograph_status as Record<string, unknown>, `${path}.pantograph_status`)
    if (!st.ok) return st
    pantograph_state = st.value
  } else {
    return parseErr(`${path}.pantograph_status: expected string or { value: string }`)
  }
  putState(states, 'pantograph_status', pantograph_state)

  const traction_current_a = unwrapNumberWithState(x.traction_current_a, `${path}.traction_current_a`)
  if (!traction_current_a.ok) return traction_current_a
  putState(states, 'traction_current_a', traction_current_a.value.state)
  const transformer_temp = unwrapNumberWithState(x.transformer_temp, `${path}.transformer_temp`)
  if (!transformer_temp.ok) return transformer_temp
  putState(states, 'transformer_temp', transformer_temp.value.state)

  const out: ElectricLocomotiveTelemetry['telemetry']['power_system'] = {
    catenary_voltage_kv: catenary_voltage_kv.value.value,
    pantograph_status,
    traction_current_a: traction_current_a.value.value,
    transformer_temp: transformer_temp.value.value,
  }
  if (x.converter_temp !== undefined) {
    const c = unwrapNumberWithState(x.converter_temp, `${path}.converter_temp`)
    if (!c.ok) return c
    putState(states, 'converter_temp', c.value.state)
    out.converter_temp = c.value.value
  }
  return parseOk({ power_system: out, states })
}

function parseRouteMap(x: unknown, path: string): ParseResult<RouteMap> {
  if (!isRecord(x)) return parseErr(`${path}: expected object`)
  const initial_point = routeSegment(x.initial_point, `${path}.initial_point`)
  if (!initial_point.ok) return initial_point
  const last_point = routeSegment(x.last_point, `${path}.last_point`)
  if (!last_point.ok) return last_point
  const next_point = asString(x.next_point, `${path}.next_point`)
  if (!next_point.ok) return next_point
  const end_point = asString(x.end_point, `${path}.end_point`)
  if (!end_point.ok) return end_point
  const distance_to_next_km = unwrapNumber(x.distance_to_next_km, `${path}.distance_to_next_km`)
  if (!distance_to_next_km.ok) return distance_to_next_km
  const eta_next_minutes = unwrapNumber(x.eta_next_minutes, `${path}.eta_next_minutes`)
  if (!eta_next_minutes.ok) return eta_next_minutes
  let total_progress = 0
  if (x.total_progress_percent !== undefined) {
    const tp = unwrapNumber(x.total_progress_percent, `${path}.total_progress_percent`)
    if (!tp.ok) return tp
    total_progress = tp.value
  }

  const out: RouteMap = {
    initial_point: initial_point.value,
    last_point: last_point.value,
    next_point: next_point.value,
    end_point: end_point.value,
    distance_to_next_km: distance_to_next_km.value,
    eta_next_minutes: Math.max(0, Math.round(eta_next_minutes.value)),
    total_progress_percent: Math.max(0, Math.min(100, total_progress)),
  }

  if (x.total_distance_left_km !== undefined) {
    const d = unwrapNumber(x.total_distance_left_km, `${path}.total_distance_left_km`)
    if (!d.ok) return d
    out.total_distance_left_km = Math.max(0, d.value)
  }
  if (x.total_eta_minutes !== undefined) {
    const e = unwrapNumber(x.total_eta_minutes, `${path}.total_eta_minutes`)
    if (!e.ok) return e
    out.total_eta_minutes = Math.max(0, Math.round(e.value))
  }

  return parseOk(out)
}

function attachOptionalRouteMap<T extends LocomotiveTelemetry>(
  doc: T,
  input: Record<string, unknown>
): ParseResult<T> {
  if (input.route_map === undefined) return parseOk(doc)
  const rm = parseRouteMap(input.route_map, 'route_map')
  if (!rm.ok) return rm
  return parseOk({ ...doc, route_map: rm.value })
}

/**
 * Validates `unknown` (typically JSON) and returns a typed `LocomotiveTelemetry`.
 */
export function normalizeLocomotiveTelemetry(input: unknown): ParseResult<LocomotiveTelemetry> {
  if (!isRecord(input)) return parseErr('root: expected object')

  const timestamp =
    input.timestamp === undefined || input.timestamp === null
      ? parseOk(new Date().toISOString())
      : asString(input.timestamp, 'timestamp')
  if (!timestamp.ok) return timestamp
  const locomotive_id = asString(input.locomotive_id, 'locomotive_id')
  if (!locomotive_id.ok) return locomotive_id
  if (input.type !== 'diesel' && input.type !== 'electric') {
    return parseErr('type: expected diesel | electric')
  }
  const type = input.type as LocomotiveType

  const health = parseHealth(input.health, 'health')
  if (!health.ok) return health
  const alerts = parseAlerts(input.alerts, 'alerts')
  if (!alerts.ok) return alerts

  if (!isRecord(input.telemetry)) return parseErr('telemetry: expected object')
  const common = parseCommon(input.telemetry.common, 'telemetry.common')
  if (!common.ok) return common

  if (type === 'diesel') {
    const ps = parseDieselPower(input.telemetry.power_system, 'telemetry.power_system')
    if (!ps.ok) return ps
    const sensor_states = { ...common.value.states, ...ps.value.states }
    const doc: DieselLocomotiveTelemetry = {
      timestamp: timestamp.value,
      locomotive_id: locomotive_id.value,
      type: 'diesel',
      health: health.value,
      telemetry: { common: common.value.common, power_system: ps.value.power_system },
      alerts: alerts.value,
      ...(Object.keys(sensor_states).length > 0 ? { sensor_states } : {}),
    }
    return attachOptionalRouteMap(doc, input)
  }

  const ps = parseElectricPower(input.telemetry.power_system, 'telemetry.power_system')
  if (!ps.ok) return ps
  const sensor_states = { ...common.value.states, ...ps.value.states }
  const doc: ElectricLocomotiveTelemetry = {
    timestamp: timestamp.value,
    locomotive_id: locomotive_id.value,
    type: 'electric',
    health: health.value,
    telemetry: { common: common.value.common, power_system: ps.value.power_system },
    alerts: alerts.value,
    ...(Object.keys(sensor_states).length > 0 ? { sensor_states } : {}),
  }
  return attachOptionalRouteMap(doc, input)
}
