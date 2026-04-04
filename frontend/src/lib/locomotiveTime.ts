/** Epoch seconds from ISO `timestamp` on locomotive messages. */
export function telemetryTimestampSeconds(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms / 1000 : Date.now() / 1000
}

export function formatIsoTime(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
