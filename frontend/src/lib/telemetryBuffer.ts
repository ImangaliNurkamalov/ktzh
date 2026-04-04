import type { LocomotiveTelemetry } from '../types/locomotiveTelemetry'
import { telemetryTimestampSeconds } from './locomotiveTime'

/** Hard cap to protect memory if sample rate spikes. */
export const TELEMETRY_HISTORY_MAX_POINTS = 4000

/**
 * Drop points older than `maxAgeSec` relative to `nowSec`, then cap length.
 * Expects messages roughly sorted by time ascending.
 */
export function trimTelemetryHistory(
  messages: LocomotiveTelemetry[],
  maxAgeSec: number,
  nowSec: number
): LocomotiveTelemetry[] {
  const cutoff = nowSec - maxAgeSec
  const fresh = messages.filter((m) => telemetryTimestampSeconds(m.timestamp) >= cutoff)
  if (fresh.length <= TELEMETRY_HISTORY_MAX_POINTS) return fresh
  return fresh.slice(-TELEMETRY_HISTORY_MAX_POINTS)
}

/** Append one message and trim (single live source for charts). */
export function appendTelemetryMessage(
  previous: LocomotiveTelemetry[],
  next: LocomotiveTelemetry,
  maxAgeSec: number
): LocomotiveTelemetry[] {
  const nowSec = telemetryTimestampSeconds(next.timestamp)
  return trimTelemetryHistory([...previous, next], maxAgeSec, nowSec)
}
