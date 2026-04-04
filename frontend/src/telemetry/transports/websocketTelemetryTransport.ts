import { createTelemetryWebSocketService } from '../../services/telemetryWebSocketService'
import type { TelemetryInboundEvent, TelemetryTransport } from '../telemetryServiceTypes'

/**
 * WebSocket transport: reconnect loop lives in `telemetryWebSocketService`; payloads are parsed there via the inbound adapter.
 */
export function createWebSocketTelemetryTransport(url: string): TelemetryTransport {
  let client: ReturnType<typeof createTelemetryWebSocketService> | null = null

  return {
    start(emit: (event: TelemetryInboundEvent) => void) {
      client?.stop()
      client = null
      client = createTelemetryWebSocketService({
        url,
        onConnection: (status) => emit({ type: 'connection', status }),
        onHello: (history) => emit({ type: 'hello', history }),
        onTick: (message) => emit({ type: 'tick', message }),
      })
      client.start()
    },
    stop() {
      client?.stop()
      client = null
    },
  }
}
