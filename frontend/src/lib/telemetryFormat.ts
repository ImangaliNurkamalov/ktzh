import { formatIsoTime } from './locomotiveTime'

export function formatIsoClock(iso: string): string {
  return formatIsoTime(iso)
}

export function formatIsoDateTime(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Epoch seconds (legacy helpers / charts). */
export function formatEpochSeconds(t: number): string {
  return new Date(t * 1000).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
