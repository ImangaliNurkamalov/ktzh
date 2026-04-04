/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string
  /** `mock` | `websocket` — default mock */
  readonly VITE_TELEMETRY_MODE?: string
  /** Mock seed: `diesel` (ТЭ33А) | `electric` (KZ8A) */
  readonly VITE_MOCK_LOCO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
