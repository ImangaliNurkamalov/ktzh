/**
 * Frontend-only noisy / faulty sensor heuristic (hackathon demo).
 *
 * Heuristic (rolling window, last N samples for the current locomotive):
 *
 * 1) Temperature metrics (`oil_temp` diesel, `transformer_temp` electric):
 *    - Compute window median M and absolute deviations |x_i - M|.
 *    - Let spread = median of those deviations (robust scale).
 *    - Point i is suspicious if |x_i - M| > max(4 × spread, 4°C) so we ignore
 *      tiny jitter but catch repeated spikes vs the bulk of the window.
 *    - noiseRatio = (# suspicious points) / N. If noiseRatio ≥ 0.2 and N ≥ minSamples,
 *      mark the metric as unstable (possible sensor issue).
 *
 * 2) `speed_actual` (optional secondary):
 *    - Look at consecutive deltas d_i = |v_i - v_{i-1}|.
 *    - Let m = median(d_i). Mark both endpoints of a step suspicious if
 *      d_i > max(20 km/h, 4 × m) (unrealistic one-tick jump vs typical motion).
 *    - noiseRatio = (# indices that appear in any suspicious step) / N, same 0.2 gate.
 *
 * No ML; all client-side from `history` snapshots.
 */

import { getSensorAnomalyHighlightedMetricKeys } from './sensorAnomalyAlerts'
import type { LocomotiveAlert, LocomotiveTelemetry } from '../types'
import { isDieselTelemetry, isElectricTelemetry } from '../types'

export const NOISY_SENSOR_WINDOW = 28
export const NOISY_SENSOR_MIN_SAMPLES = 14
export const NOISY_RATIO_THRESHOLD = 0.2

export type NoisySensorMetricKey = 'oil_temp' | 'transformer_temp' | 'speed_actual'

export interface NoisyDetection {
  isNoisy: boolean
  noiseRatio: number
  suspiciousIndexes: number[]
}

export interface NoisyMetricSummary {
  key: NoisySensorMetricKey
  noiseRatio: number
  alertMessage: string
}

export interface FrontendNoisySensorResult {
  /** Metric row keys to tint in the cabin grid / speed card */
  noisyKeys: Set<string>
  /** Per-metric detail for tooltips / debugging */
  metrics: NoisyMetricSummary[]
  /** Short lines for the health card (warning tone, non-critical) */
  healthNotes: string[]
}

function median(values: number[]): number {
  const n = values.length
  if (n === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(n / 2)
  return n % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** Public helper: inspect a numeric series */
export function detectNoisySensor(
  values: number[],
  kind: 'temperature' | 'speed'
): NoisyDetection {
  const n = values.length
  if (n < NOISY_SENSOR_MIN_SAMPLES) {
    return { isNoisy: false, noiseRatio: 0, suspiciousIndexes: [] }
  }

  if (kind === 'temperature') {
    const med = median(values)
    const absDev = values.map((v) => Math.abs(v - med))
    const spread = median(absDev)
    const scale = spread > 1e-6 ? spread : 0.0001
    const suspiciousIndexes: number[] = []
    for (let i = 0; i < n; i++) {
      const thresh = Math.max(4 * scale, 4)
      if (absDev[i]! > thresh) suspiciousIndexes.push(i)
    }
    const noiseRatio = suspiciousIndexes.length / n
    return {
      isNoisy: noiseRatio >= NOISY_RATIO_THRESHOLD,
      noiseRatio,
      suspiciousIndexes,
    }
  }

  // speed: unrealistic jumps between consecutive samples
  const badIdx = new Set<number>()
  const diffs: number[] = []
  for (let i = 1; i < n; i++) {
    diffs.push(Math.abs(values[i]! - values[i - 1]!))
  }
  const medDiff = median(diffs)
  const base = medDiff > 1e-6 ? medDiff : 0.5
  for (let i = 1; i < n; i++) {
    const d = Math.abs(values[i]! - values[i - 1]!)
    if (d > Math.max(20, 4 * base)) {
      badIdx.add(i)
      badIdx.add(i - 1)
    }
  }
  const suspiciousIndexes = [...badIdx].sort((a, b) => a - b)
  const noiseRatio = badIdx.size / n
  return {
    isNoisy: noiseRatio >= NOISY_RATIO_THRESHOLD,
    noiseRatio,
    suspiciousIndexes,
  }
}

function sameLocoFilter(history: LocomotiveTelemetry[], latest: LocomotiveTelemetry): LocomotiveTelemetry[] {
  const id = latest.locomotive_id
  const t = latest.type
  return history.filter((m) => m.locomotive_id === id && m.type === t)
}

function tailSeries(
  slice: LocomotiveTelemetry[],
  read: (m: LocomotiveTelemetry) => number,
  maxLen: number
): number[] {
  const tail = slice.slice(-maxLen)
  return tail.map(read).filter((v) => typeof v === 'number' && Number.isFinite(v))
}

function backendAlreadyCoversMetric(message: LocomotiveTelemetry, key: NoisySensorMetricKey): boolean {
  return getSensorAnomalyHighlightedMetricKeys(message).has(key)
}

/** Avoid duplicate warnings when backend already sent a sensor-quality alert for that metric */
export function computeFrontendNoisySensorResult(
  history: LocomotiveTelemetry[],
  latest: LocomotiveTelemetry
): FrontendNoisySensorResult {
  const slice = sameLocoFilter(history, latest)
  const windowed = slice.slice(-NOISY_SENSOR_WINDOW)
  if (windowed.length < NOISY_SENSOR_MIN_SAMPLES) {
    return { noisyKeys: new Set(), metrics: [], healthNotes: [] }
  }

  const noisyKeys = new Set<string>()
  const metrics: NoisyMetricSummary[] = []
  const healthNotes: string[] = []

  const speedSeries = tailSeries(windowed, (m) => m.telemetry.common.speed_actual, NOISY_SENSOR_WINDOW)
  const speedDet = detectNoisySensor(speedSeries, 'speed')
  if (
    speedDet.isNoisy &&
    !backendAlreadyCoversMetric(latest, 'speed_actual')
  ) {
    noisyKeys.add('speed_actual')
    const pct = Math.round(speedDet.noiseRatio * 100)
    metrics.push({
      key: 'speed_actual',
      noiseRatio: speedDet.noiseRatio,
      alertMessage: `Возможна неисправность датчика скорости: нестабильные показания (~${pct}% шумных отсчётов в окне)`,
    })
  }

  if (isDieselTelemetry(latest)) {
    const oil = tailSeries(
      windowed,
      (m) => (isDieselTelemetry(m) ? m.telemetry.power_system.oil_temp : NaN),
      NOISY_SENSOR_WINDOW
    ).filter((v) => Number.isFinite(v))
    const oilDet = detectNoisySensor(oil, 'temperature')
    if (oilDet.isNoisy && !backendAlreadyCoversMetric(latest, 'oil_temp')) {
      noisyKeys.add('oil_temp')
      const pct = Math.round(oilDet.noiseRatio * 100)
      metrics.push({
        key: 'oil_temp',
        noiseRatio: oilDet.noiseRatio,
        alertMessage: `Возможна неисправность датчика температуры масла: нестабильные показания (~${pct}% шумных отсчётов)`,
      })
    }
  }

  if (isElectricTelemetry(latest)) {
    const tt = tailSeries(
      windowed,
      (m) => (isElectricTelemetry(m) ? m.telemetry.power_system.transformer_temp : NaN),
      NOISY_SENSOR_WINDOW
    ).filter((v) => Number.isFinite(v))
    const ttDet = detectNoisySensor(tt, 'temperature')
    if (ttDet.isNoisy && !backendAlreadyCoversMetric(latest, 'transformer_temp')) {
      noisyKeys.add('transformer_temp')
      const pct = Math.round(ttDet.noiseRatio * 100)
      metrics.push({
        key: 'transformer_temp',
        noiseRatio: ttDet.noiseRatio,
        alertMessage: `Возможна неисправность датчика температуры трансформатора: около ${pct}% шумных отсчётов в окне`,
      })
    }
  }

  if (metrics.length > 0) {
    healthNotes.push(
      'Обнаружена возможная проблема датчика. Индекс здоровья может искажаться из‑за нестабильных показаний сенсоров.'
    )
  }

  return { noisyKeys, metrics, healthNotes }
}

export function buildFrontendNoisyAlerts(metrics: NoisyMetricSummary[]): LocomotiveAlert[] {
  return metrics.map((m, i) => ({
    id: `frontend-noisy-${m.key}-${i}`,
    level: 'warning' as const,
    message: m.alertMessage,
    code: 'frontend_noisy_sensor',
    category: 'sensor',
  }))
}
