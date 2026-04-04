import type { ConnectionStatus, LocomotiveTelemetry } from '../types'

/**
 * Normalized events from any inbound transport (mock timer, WebSocket, future HTTP poll).
 * UI / `TelemetryProvider` only dispatches these — no raw strings or transport types.
 */
export type TelemetryInboundEvent =
  | { type: 'connection'; status: ConnectionStatus }
  | { type: 'hello'; history: LocomotiveTelemetry[] }
  | { type: 'tick'; message: LocomotiveTelemetry }

/**
 * Pluggable telemetry source. Transport handles sockets/timers; adapter emits `TelemetryInboundEvent`.
 */
export interface TelemetryTransport {
  start(emit: (event: TelemetryInboundEvent) => void): void
  stop(): void
}
