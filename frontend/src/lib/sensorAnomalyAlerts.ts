import type { LocomotiveAlert, LocomotiveTelemetry } from '../types'
import { isDieselTelemetry, isElectricTelemetry } from '../types'

/** Backend can send any of these (case-insensitive) to mark sensor-quality issues. */
const SENSOR_ANOMALY_CODES = new Set([
  'sensor_noise',
  'noisy_sensor',
  'sensor_fault_suspected',
  'sensor_degradation',
  'sensor_anomaly',
  /** Frontend rolling-window heuristic (dashboard-only) */
  'frontend_noisy_sensor',
])

/** Message fragments — scenario 2 «умная диагностика» + common variants. */
const SENSOR_ANOMALY_MESSAGE_MARKERS = [
  'шум датчика',
  'уровень шума датчика',
  'неисправность сенсора',
  'неисправность датчика',
  'возможна неисправность сенсора',
  'возможна неисправность датчика',
  'sensor noise',
  'faulty sensor',
  'noisy sensor',
  'abnormal transformer temperature sensor',
  'sensor fault',
]

function codeImpliesSensorAnomaly(alert: LocomotiveAlert): boolean {
  const c = alert.code?.trim().toLowerCase()
  if (!c) return false
  if (SENSOR_ANOMALY_CODES.has(c)) return true
  return c.includes('sensor') && (c.includes('noise') || c.includes('fault') || c.includes('anomaly'))
}

function categoryImpliesSensor(alert: LocomotiveAlert): boolean {
  const cat = alert.category?.trim().toLowerCase()
  return cat === 'sensor' || cat === 'sensor_quality'
}

/**
 * True when the alert describes unstable / faulty sensor output (scenario 2),
 * not necessarily a real subsystem failure.
 */
export function isSensorAnomalyAlert(alert: LocomotiveAlert): boolean {
  if (codeImpliesSensorAnomaly(alert) || categoryImpliesSensor(alert)) return true
  const m = alert.message.toLowerCase()
  return SENSOR_ANOMALY_MESSAGE_MARKERS.some((frag) => m.includes(frag))
}

/** Metric card key to tint when this alert is a sensor anomaly for the current loco type. */
export function sensorAnomalyMetricKeyForAlert(
  message: LocomotiveTelemetry,
  alert: LocomotiveAlert
): 'oil_temp' | 'transformer_temp' | 'speed_actual' | null {
  if (!isSensorAnomalyAlert(alert)) return null
  const m = alert.message.toLowerCase()
  if (isDieselTelemetry(message)) {
    if (m.includes('трансформатор') || m.includes('transformer')) return null
    if (
      m.includes('speed') ||
      m.includes('скорост') ||
      m.includes('скорости') ||
      m.includes('датчик скорости')
    )
      return 'speed_actual'
    return 'oil_temp'
  }
  if (isElectricTelemetry(message)) {
    if (m.includes('масл') || m.includes('oil temp') || m.includes('oil_temp')) return null
    if (
      m.includes('speed') ||
      m.includes('скорост') ||
      m.includes('скорости') ||
      m.includes('датчик скорости')
    )
      return 'speed_actual'
    return 'transformer_temp'
  }
  return null
}

export function getSensorAnomalyHighlightedMetricKeys(message: LocomotiveTelemetry): Set<string> {
  const keys = new Set<string>()
  for (const a of message.alerts) {
    const k = sensorAnomalyMetricKeyForAlert(message, a)
    if (k) keys.add(k)
  }
  return keys
}

/**
 * UI should not present sensor-noise as locomotive-critical by default.
 * Returns a level for badges: sensor anomalies cap at `warning`.
 */
export function displayAlertLevel(alert: LocomotiveAlert): LocomotiveAlert['level'] {
  if (isSensorAnomalyAlert(alert) && alert.level === 'critical') return 'warning'
  return alert.level
}

/**
 * Extra UI line: scenario 2 is sensor-quality, not necessarily subsystem failure.
 * English copy for demo clarity; backend message may already be RU.
 */
export function sensorAnomalyUiSubtitle(
  alert: LocomotiveAlert,
  message: LocomotiveTelemetry
): string | null {
  if (!isSensorAnomalyAlert(alert)) return null
  const m = alert.message.toLowerCase()
  if (
    m.includes('speed') ||
    m.includes('скорост') ||
    m.includes('скорости') ||
    m.includes('датчик скорости')
  ) {
    return 'Возможна неисправность датчика скорости — проверьте источник сигнала, прежде чем связывать с вождением.'
  }
  if (isDieselTelemetry(message)) return 'Возможна неисправность датчика температуры масла.'
  if (isElectricTelemetry(message)) return 'Зафиксирован повышенный шум датчика температуры трансформатора.'
  return null
}

/** One-line copy for AlertsPanel (RU, matches cabin tone). */
export function sensorIssueShortExplanation(
  message: LocomotiveTelemetry,
  alert?: LocomotiveAlert
): string {
  const m = alert?.message.toLowerCase() ?? ''
  if (
    m.includes('speed') ||
    m.includes('скорост') ||
    m.includes('скорости') ||
    m.includes('датчик скорости')
  ) {
    return 'Скачки скорости в потоке данных похожи на шум датчика — проверьте канал скорости, а не только режим вождения.'
  }
  if (m.includes('трансформатор') || m.includes('transformer')) {
    return 'Показания датчика могут быть недостоверны — не путайте шум сенсора с перегревом трансформатора.'
  }
  if (isDieselTelemetry(message)) {
    return 'Показания датчика могут «плавать» из‑за шума — проверьте сенсор, прежде чем считать проблему в масляной системе.'
  }
  if (isElectricTelemetry(message)) {
    return 'Показания датчика могут быть недостоверны — не путайте шум сенсора с перегревом трансформатора.'
  }
  return 'Высокая доля аномальных отсчётов с датчика — приоритет: диагностика сенсора.'
}
