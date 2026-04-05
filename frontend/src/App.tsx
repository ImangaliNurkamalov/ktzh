import { useMemo } from 'react'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { DashboardPage } from './pages/DashboardPage'
import type { MockLocoVariant } from './mocks/sampleTelemetry'
import { ThemeProvider } from './theme/ThemeContext'
import { TelemetryProvider, type TelemetrySource } from './telemetry'

function App() {
  /** WebSocket only if URL is set; otherwise mock (demo-safe when backend is down). */
  const mode = useMemo((): TelemetrySource => {
    const wantWs = import.meta.env.VITE_TELEMETRY_MODE === 'websocket'
    const url = import.meta.env.VITE_WS_URL
    if (wantWs && typeof url === 'string' && url.trim().length > 0) return 'websocket'
    return 'mock'
  }, [])

  const mockLocoVariant = useMemo((): MockLocoVariant => {
    const v = import.meta.env.VITE_MOCK_LOCO
    return v === 'electric' ? 'electric' : 'diesel'
  }, [])

  return (
    <TelemetryProvider mode={mode} mockLocoVariant={mockLocoVariant}>
      <ThemeProvider>
        <DashboardLayout>
          <DashboardPage />
        </DashboardLayout>
      </ThemeProvider>
    </TelemetryProvider>
  )
}

export default App
