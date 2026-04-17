'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { UserCircle } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/imports': 'Import Transactions',
  '/review': 'Review Queue',
  '/transactions': 'Transactions',
  '/budgets': 'Budgets',
  '/goals': 'Goals',
  '/advisor': 'AI Advisor',
  '/settings': 'Settings',
}

function getTitle(pathname: string): string {
  for (const [key, title] of Object.entries(pageTitles)) {
    if (pathname === key || pathname.startsWith(key + '/')) return title
  }
  return 'Finance Tracker'
}

export function Header() {
  const pathname = usePathname()
  const title = getTitle(pathname)
  const [email, setEmail] = useState<string | null>(null)

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => { if (d?.email) setEmail(d.email) })
      .catch(() => {})
  }, [])

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-200 shrink-0">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        {email && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <UserCircle className="w-4 h-4" />
            <span className="hidden sm:inline">{email}</span>
          </div>
        )}
        <span className="text-sm text-gray-400">{dateStr}</span>
      </div>
    </header>
  )
}
