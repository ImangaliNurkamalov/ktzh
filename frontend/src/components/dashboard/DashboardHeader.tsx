import { ConnectionBadge } from './ConnectionBadge'
import type { ConnectionStatus, LocomotiveType } from '../../types'
import { useTheme } from '../../theme/ThemeContext'

const TYPE_LABELS: Record<LocomotiveType, string> = {
  diesel: 'Тепловоз (дизель)',
  electric: 'Электровоз',
}

interface DashboardHeaderProps {
  trainId: string
  locomotiveType: LocomotiveType
  connection: ConnectionStatus
  /** Подпись над заголовком (по умолчанию — кабина). */
  eyebrow?: string
  /** Заголовок страницы. */
  title?: string
}

export function DashboardHeader({
  trainId,
  locomotiveType,
  connection,
  eyebrow = 'Цифровой двойник · кабина',
  title = 'Телеметрия локомотива',
}: DashboardHeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-cabin-border pb-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-white sm:text-xl">
            {title}
          </h1>
        </div>
        <dl className="flex flex-wrap items-stretch gap-4 sm:gap-6">
          <div className="flex flex-col border-l border-cabin-border pl-4 sm:pl-6">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Локомотив</dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">{trainId}</dd>
          </div>
          <div className="flex flex-col border-l border-cabin-border pl-4 sm:pl-6">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Тип</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              {TYPE_LABELS[locomotiveType]}
            </dd>
          </div>
          <div className="flex flex-col justify-end border-l border-cabin-border pl-4 sm:pl-6">
            <dt className="sr-only">Статус соединения</dt>
            <dd>
              <ConnectionBadge status={connection} />
            </dd>
          </div>
        </dl>
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        className="shrink-0 rounded-lg border border-cabin-border bg-cabin-surface px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-400 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-200"
        aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
        title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      >
        {theme === 'dark' ? '☀ Светлая' : '🌙 Тёмная'}
      </button>
    </header>
  )
}
