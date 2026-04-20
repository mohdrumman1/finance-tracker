'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const PUBLIC_PREFIXES = ['/auth/']
const NO_SHELL_PREFIXES = ['/auth/', '/onboarding']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [_authChecked, setAuthChecked] = useState(false)

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  const showShell = !NO_SHELL_PREFIXES.some((p) => pathname.startsWith(p))
  const authChecked = isPublic || _authChecked
  const isLoading = !authChecked

  useEffect(() => {
    if (isPublic) return

    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          router.replace(`/auth/login?from=${encodeURIComponent(pathname)}`)
          return null
        }
        return res.json()
      })
      .then((user) => {
        if (!user) return
        const isOnboarding = pathname.startsWith('/onboarding')
        if (!user.onboardingCompleted && !isOnboarding) {
          router.replace('/onboarding')
        } else if (user.onboardingCompleted && isOnboarding) {
          router.replace('/dashboard')
        } else {
          setAuthChecked(true)
        }
      })
      .catch(() => {
        router.replace('/auth/login')
      })
  }, [pathname, isPublic, router])

  if (!showShell) {
    return <div className="flex-1 min-h-screen">{children}</div>
  }

  return (
    <>
      {isLoading && <div className="fixed inset-0 bg-gray-950 z-50" />}
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </>
  )
}
