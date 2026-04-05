import type { ConnectionStatus } from '../../types'

const STYLES: Record<ConnectionStatus, string> = {
  connected:
    'bg-emerald-500/12 text-emerald-800 ring-emerald-500/30 dark:text-emerald-300 dark:ring-emerald-500/35',
  reconnecting:
    'bg-amber-500/12 text-amber-900 ring-amber-500/30 dark:text-amber-200 dark:ring-amber-500/35',
  disconnected:
    'bg-rose-500/12 text-rose-900 ring-rose-500/30 dark:text-rose-200 dark:ring-rose-500/35',
}

const LABELS: Record<ConnectionStatus, string> = {
  connected: 'Подключено',
  reconnecting: 'Переподключение…',
  disconnected: 'Нет соединения',
}

interface ConnectionBadgeProps {
  status: ConnectionStatus
}

export function ConnectionBadge({ status }: ConnectionBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STYLES[status]}`}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${
            status === 'connected'
              ? 'animate-ping bg-emerald-400'
              : status === 'reconnecting'
                ? 'animate-ping bg-amber-400'
                : ''
          }`}
        />
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            status === 'connected'
              ? 'bg-emerald-400'
              : status === 'reconnecting'
                ? 'bg-amber-400'
                : 'bg-rose-400 opacity-90'
          }`}
        />
      </span>
      {LABELS[status]}
    </span>
  )
}
