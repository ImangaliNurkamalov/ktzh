import type { ReactNode } from 'react'

interface DashboardLayoutProps {
  children: ReactNode
}

/**
 * Full-viewport shell: dark cabin background, centered content column.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-dvh bg-cabin-bg text-slate-800 antialiased dark:text-slate-100">
      <div className="mx-auto flex min-h-dvh max-w-[1920px] flex-col px-4 py-3 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  )
}
