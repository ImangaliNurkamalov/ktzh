/**
 * WebSocket transport: connection lifecycle + reconnect. Parsing is delegated to
 * `telemetry/inbound` so wire format changes stay out of this file.
 */
import { parseTelemetryWireMessage } from '../telemetry/inbound'
import type { ConnectionStatus, LocomotiveTelemetry } from '../types'

const RECONNECT_BASE_MS = 1200
const RECONNECT_MAX_MS = 12_000

export interface TelemetryWebSocketHandlers {
  onConnection: (status: ConnectionStatus) => void
  onHello: (history: LocomotiveTelemetry[]) => void
  onTick: (message: LocomotiveTelemetry) => void
}

export interface TelemetryWebSocketServiceOptions extends TelemetryWebSocketHandlers {
  url: string
}

export interface TelemetryWebSocketController {
  start: () => void
  stop: () => void
}

export function createTelemetryWebSocketService(
  options: TelemetryWebSocketServiceOptions
): TelemetryWebSocketController {
  const { url, onConnection, onHello, onTick } = options

  let ws: WebSocket | null = null
  let stopped = true
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const clearReconnect = () => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const scheduleReconnect = () => {
    clearReconnect()
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** reconnectAttempt)
    reconnectAttempt += 1
    reconnectTimer = setTimeout(() => connect(), delay)
  }

  function connect() {
    if (stopped) return
    try {
      onConnection('reconnecting')
      ws = new WebSocket(url)

      ws.onopen = () => {
        reconnectAttempt = 0
        onConnection('connected')
      }

      ws.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : String(event.data)
        const parsed = parseTelemetryWireMessage(raw)
        if (!parsed.ok) return
        const msg = parsed.value
        if (msg.kind === 'hello') {
          onHello(msg.history)
          return
        }
        onTick(msg.payload)
      }

      ws.onerror = () => {}

      ws.onclose = () => {
        onConnection('disconnected')
        ws = null
        if (!stopped) scheduleReconnect()
      }
    } catch {
      onConnection('disconnected')
      if (!stopped) scheduleReconnect()
    }
  }

  return {
    start: () => {
      stopped = false
      reconnectAttempt = 0
      clearReconnect()
      connect()
    },
    stop: () => {
      stopped = true
      clearReconnect()
      ws?.close()
      ws = null
      onConnection('disconnected')
    },
  }
}
