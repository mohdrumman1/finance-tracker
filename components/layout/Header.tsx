'use client'

import React from 'react'
import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/imports': 'Import Transactions',
  '/review': 'Review Queue',
  '/budgets': 'Budgets',
  '/goals': 'Goals',
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
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-200 shrink-0">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <span className="text-sm text-gray-500">{dateStr}</span>
    </header>
  )
}
