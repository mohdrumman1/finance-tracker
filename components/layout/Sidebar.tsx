'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  AlertCircle,
  DollarSign,
  Target,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui/badge'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/imports', label: 'Import', icon: Upload },
  { href: '/review', label: 'Review', icon: AlertCircle, showBadge: true },
  { href: '/budgets', label: 'Budgets', icon: DollarSign },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [reviewCount, setReviewCount] = useState<number>(0)

  const refreshReviewCount = React.useCallback(() => {
    fetch('/api/transactions?reviewStatus=needs_review&limit=1')
      .then((r) => r.json())
      .then((data) => {
        if (data?.total != null) setReviewCount(data.total)
      })
      .catch(() => {})
  }, [])

  // Re-fetch when navigating between pages
  useEffect(() => {
    refreshReviewCount()
  }, [pathname, refreshReviewCount])

  // Re-fetch when the user returns to this tab
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshReviewCount()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshReviewCount])

  // Re-fetch when the review page confirms a transaction
  useEffect(() => {
    const onReviewChange = () => refreshReviewCount()
    window.addEventListener('reviewCountChanged', onReviewChange)
    return () => window.removeEventListener('reviewCountChanged', onReviewChange)
  }, [refreshReviewCount])

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-gray-900 text-white transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center h-16 px-4 border-b border-gray-700', collapsed ? 'justify-center' : 'gap-3')}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shrink-0">
          <DollarSign className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm truncate">Finance Tracker</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map(({ href, label, icon: Icon, showBadge }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                    collapsed && 'justify-center px-2'
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && (
                    <span className="flex-1 truncate">{label}</span>
                  )}
                  {!collapsed && showBadge && reviewCount > 0 && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0 min-w-[20px] text-center">
                      {reviewCount}
                    </Badge>
                  )}
                  {collapsed && showBadge && reviewCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-gray-700">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'flex items-center justify-center w-full rounded-md p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
