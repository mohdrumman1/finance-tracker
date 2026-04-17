'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const NO_SHELL_PREFIXES = ['/auth/', '/onboarding']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showShell = !NO_SHELL_PREFIXES.some((p) => pathname.startsWith(p))

  if (!showShell) {
    return <>{children}</>
  }

  return (
    <>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </>
  )
}
