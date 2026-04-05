import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { appendTelemetryMessage, trimTelemetryHistory } from '../lib/telemetryBuffer'
import { telemetryTimestampSeconds } from '../lib/locomotiveTime'
import type { MockLocoVariant } from '../mocks/sampleTelemetry'
import { getDashboardMock } from '../mocks/sampleTelemetry'
import type { ConnectionStatus, LocomotiveTelemetry } from '../types'
import { stepLocomotiveTelemetry } from './mockStep'
import { createMockTelemetryTransport } from './transports/mockTelemetryTransport'
import { createWebSocketTelemetryTransport } from './transports/websocketTelemetryTransport'

export type TelemetrySource = 'mock' | 'websocket'

const DEFAULT_MAX_AGE_SEC = 15 * 60

export interface TelemetryState {
  source: TelemetrySource
  connection: ConnectionStatus
  latestMessage: LocomotiveTelemetry | null
  history: LocomotiveTelemetry[]
  maxHistoryAgeSec: number
  mockVariant: MockLocoVariant
}

type TelemetryAction =
  | { type: 'TICK'; message: LocomotiveTelemetry }
  | { type: 'HELLO'; history: LocomotiveTelemetry[] }
  | { type: 'CONNECTION'; status: ConnectionStatus }
  | { type: 'SET_MOCK_VARIANT'; variant: MockLocoVariant }

function telemetryReducer(state: TelemetryState, action: TelemetryAction): TelemetryState {
  switch (action.type) {
    case 'CONNECTION':
      return { ...state, connection: action.status }
    case 'SET_MOCK_VARIANT': {
      const { latest, history } = getDashboardMock(action.variant)
      const lastT = telemetryTimestampSeconds(latest.timestamp)
      const trimmed = trimTelemetryHistory(history, state.maxHistoryAgeSec, lastT)
      const last = trimmed[trimmed.length - 1] ?? latest
      return {
        ...state,
        mockVariant: action.variant,
        latestMessage: last,
        history: trimmed.length ? trimmed : [last],
        connection: 'connected',
      }
    }
    case 'HELLO': {
      if (action.history.length === 0) {
        return { ...state, history: [], latestMessage: null, connection: 'disconnected' }
      }
      const lastT = telemetryTimestampSeconds(action.history[action.history.length - 1]!.timestamp)
      const trimmed = trimTelemetryHistory(action.history, state.maxHistoryAgeSec, lastT)
      const last = trimmed[trimmed.length - 1]!
      return {
        ...state,
        history: trimmed,
        latestMessage: last,
        connection: 'connected',
      }
    }
    case 'TICK': {
      const history = appendTelemetryMessage(state.history, action.message, state.maxHistoryAgeSec)
      return {
        ...state,
        latestMessage: action.message,
        history,
        connection: 'connected',
      }
    }
    default:
      return state
  }
}

function initialState(
  source: TelemetrySource,
  maxHistoryAgeSec: number,
  mockVariant: MockLocoVariant
): TelemetryState {
  if (source === 'websocket') {
    return {
      source: 'websocket',
      connection: 'disconnected',
      latestMessage: null,
      history: [],
      maxHistoryAgeSec,
      mockVariant,
    }
  }
  const { latest, history } = getDashboardMock(mockVariant)
  const lastT = telemetryTimestampSeconds(latest.timestamp)
  const trimmed = trimTelemetryHistory(history, maxHistoryAgeSec, lastT)
  const last = trimmed[trimmed.length - 1] ?? latest
  return {
    source: 'mock',
    connection: 'connected',
    latestMessage: last,
    history: trimmed.length ? trimmed : [last],
    maxHistoryAgeSec,
    mockVariant,
  }
}

interface TelemetryContextValue {
  state: TelemetryState
  dispatch: React.Dispatch<TelemetryAction>
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null)

export interface TelemetryProviderProps {
  children: ReactNode
  mode?: TelemetrySource
  websocketUrl?: string
  maxHistoryAgeSec?: number
  mockIntervalMs?: number
  /** Mock stream & seed: `diesel` (TE33A) or `electric` (KZ8A). */
  mockLocoVariant?: MockLocoVariant
}

export function TelemetryProvider({
  children,
  mode = 'mock',
  websocketUrl,
  maxHistoryAgeSec = DEFAULT_MAX_AGE_SEC,
  mockIntervalMs = 1000,
  mockLocoVariant = 'diesel',
}: TelemetryProviderProps) {
  const [state, dispatch] = useReducer(
    telemetryReducer,
    { mode, maxHistoryAgeSec, mockLocoVariant },
    (cfg) => initialState(cfg.mode, cfg.maxHistoryAgeSec, cfg.mockLocoVariant)
  )

  const messageRef = useRef<LocomotiveTelemetry | null>(state.latestMessage)
  messageRef.current = state.latestMessage

  useEffect(() => {
    if (mode !== 'mock') return
    const transport = createMockTelemetryTransport({
      intervalMs: mockIntervalMs,
      getLatest: () => messageRef.current,
      step: stepLocomotiveTelemetry,
    })
    transport.start((e) => {
      if (e.type === 'tick') dispatch({ type: 'TICK', message: e.message })
    })
    return () => transport.stop()
  }, [mode, mockIntervalMs])

  useEffect(() => {
    if (mode !== 'websocket') return
    const envUrl = import.meta.env.VITE_WS_URL
    const resolved = websocketUrl ?? (typeof envUrl === 'string' ? envUrl : '')
    const validUrl = typeof resolved === 'string' && resolved.trim().length > 0 ? resolved.trim() : ''
    if (!validUrl) {
      dispatch({ type: 'CONNECTION', status: 'disconnected' })
      return
    }
    const transport = createWebSocketTelemetryTransport(validUrl)
    transport.start((e) => {
      if (e.type === 'connection') dispatch({ type: 'CONNECTION', status: e.status })
      else if (e.type === 'hello') dispatch({ type: 'HELLO', history: e.history })
      else dispatch({ type: 'TICK', message: e.message })
    })
    return () => transport.stop()
  }, [mode, websocketUrl])

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>
}

export function useTelemetryStore() {
  const ctx = useContext(TelemetryContext)
  if (!ctx) throw new Error('useTelemetryStore: оберните дерево в TelemetryProvider')
  return ctx
}

export function useTelemetry() {
  const { state, dispatch } = useTelemetryStore()
  const latestMessage = state.latestMessage
  const history = state.history
  const previousMessage =
    history.length >= 2 ? history[history.length - 2]! : latestMessage

  return {
    connection: state.connection,
    source: state.source,
    latestMessage,
    history,
    previousMessage,
    maxHistoryAgeSec: state.maxHistoryAgeSec,
    mockVariant: state.mockVariant,
    setMockVariant: (variant: MockLocoVariant) => dispatch({ type: 'SET_MOCK_VARIANT', variant }),
  }
}
