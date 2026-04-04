import type { LocomotiveTelemetry } from '../../types'
import { normalizeLocomotiveTelemetry } from './parseLocomotiveTelemetry'
import { parseErr, parseOk, type ParseResult } from './parseResult'

/** Normalized wire shapes after JSON parse — UI / reducer consume these only. */
export type ParsedWireHello = { kind: 'hello'; history: LocomotiveTelemetry[] }
export type ParsedWireTick = { kind: 'tick'; payload: LocomotiveTelemetry }
export type ParsedWireMessage = ParsedWireHello | ParsedWireTick

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/**
 * Parses an already-decoded JSON value (tests + non-string transports).
 */
export function parseTelemetryJsonValue(parsed: unknown): ParseResult<ParsedWireMessage> {
  if (!isRecord(parsed)) return parseErr('root: expected object')

  if (parsed.type === 'hello' && Array.isArray(parsed.history)) {
    const history: LocomotiveTelemetry[] = []
    for (let i = 0; i < parsed.history.length; i++) {
      const n = normalizeLocomotiveTelemetry(parsed.history[i])
      if (!n.ok) return parseErr(`history[${i}]: ${n.reason}`)
      history.push(n.value)
    }
    return parseOk({ kind: 'hello', history })
  }

  if (parsed.type === 'tick' && parsed.payload !== null && typeof parsed.payload === 'object') {
    const n = normalizeLocomotiveTelemetry(parsed.payload)
    if (!n.ok) return parseErr(`tick.payload: ${n.reason}`)
    return parseOk({ kind: 'tick', payload: n.value })
  }

  const bare = normalizeLocomotiveTelemetry(parsed)
  if (bare.ok) return parseOk({ kind: 'tick', payload: bare.value })

  return parseErr(bare.reason)
}

/**
 * Parses WebSocket `message.data` (string) into hello / tick / bare locomotive document.
 */
export function parseTelemetryWireMessage(raw: string): ParseResult<ParsedWireMessage> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return parseErr('invalid JSON')
  }
  return parseTelemetryJsonValue(parsed)
}
