import type { LocomotiveTelemetry } from '../../types'
import type { TelemetryInboundEvent, TelemetryTransport } from '../telemetryServiceTypes'

export interface MockTelemetryTransportOptions {
  intervalMs: number
  getLatest: () => LocomotiveTelemetry | null
  step: (prev: LocomotiveTelemetry) => LocomotiveTelemetry
}

/**
 * Mock stream: periodic ticks from the current in-memory snapshot (no wire format).
 */
export function createMockTelemetryTransport(options: MockTelemetryTransportOptions): TelemetryTransport {
  let timer: ReturnType<typeof setInterval> | null = null

  return {
    start(emit: (event: TelemetryInboundEvent) => void) {
      if (timer !== null) return
      timer = window.setInterval(() => {
        const prev = options.getLatest()
        if (!prev) return
        emit({ type: 'tick', message: options.step(prev) })
      }, options.intervalMs)
    },
    stop() {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}
