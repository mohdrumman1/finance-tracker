'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search, X, SlidersHorizontal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { LoadingPage, LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { format, subMonths, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'

interface Transaction {
  id: string
  transactionDate: string
  merchantName?: string
  descriptionNormalized?: string
  descriptionRaw: string
  amount: number
  direction: 'income' | 'expense' | 'transfer'
  categoryId?: string
  category?: { id: string; name: string; color: string }
  confidenceScore: number
}

interface Category {
  id: string
  name: string
  color: string
}

type RangePreset = '1m' | '3m' | '6m' | '1y' | 'all'

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: '1m', label: 'Last month' },
  { id: '3m', label: 'Last 3 months' },
  { id: '6m', label: 'Last 6 months' },
  { id: '1y', label: 'Last year' },
  { id: 'all', label: 'All time' },
]

function getRange(preset: RangePreset): { start: Date; end: Date } {
  const now = new Date()
  const end = endOfDay(now)
  switch (preset) {
    case '1m': return { start: startOfMonth(subMonths(now, 1)), end }
    case '3m': return { start: startOfDay(subMonths(now, 3)), end }
    case '6m': return { start: startOfDay(subMonths(now, 6)), end }
    case '1y': return { start: startOfDay(subMonths(now, 12)), end }
    case 'all': return { start: new Date('2000-01-01'), end }
  }
}

const PAGE_SIZE = 50

function TransactionsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Initialise from URL params (allows linking from advisor/dashboard)
  const initialCategoryId = searchParams.get('categoryId') ?? ''
  const initialPreset = (searchParams.get('preset') as RangePreset) ?? '3m'

  const [preset, setPreset] = useState<RangePreset>(initialPreset)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [direction, setDirection] = useState<string>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(true)

  const range = useMemo(() => getRange(preset), [preset])

  // Load categories once
  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        limit: String(PAGE_SIZE),
        page: String(page),
      })
      if (categoryId) params.set('categoryId', categoryId)
      if (direction) params.set('direction', direction)

      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      const txns: Transaction[] = data.transactions ?? []

      // Client-side search filter (API doesn't support text search)
      const filtered = search
        ? txns.filter((t) => {
            const text = `${t.merchantName ?? ''} ${t.descriptionNormalized ?? ''} ${t.descriptionRaw}`.toLowerCase()
            return text.includes(search.toLowerCase())
          })
        : txns

      setTransactions(filtered)
      setTotal(data.total ?? 0)
      // Sum only expenses for the "total spend" when filtering by category/expenses
      const sum = filtered.reduce((s, t) => s + (t.direction === 'expense' ? t.amount : 0), 0)
      setTotalAmount(sum)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [range.start, range.end, categoryId, direction, page, search])

  useEffect(() => {
    setPage(1)
  }, [preset, categoryId, direction, search])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)

  const selectedCategory = categories.find((c) => c.id === categoryId)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function clearFilters() {
    setCategoryId('')
    setDirection('')
    setSearch('')
    setPreset('3m')
  }

  const hasFilters = !!categoryId || !!direction || !!search || preset !== '3m'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Transactions</h2>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4 space-y-3">
          {/* Date presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider w-16 shrink-0">Period</span>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  preset === p.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
            <span className="text-xs text-gray-400 ml-auto hidden sm:block">
              {format(range.start.getFullYear() === 2000 ? new Date('2000-01-01') : range.start, 'dd MMM yyyy')} – {format(range.end, 'dd MMM yyyy')}
            </span>
          </div>

          {/* Category + direction + search */}
          <div className="flex gap-2 flex-wrap">
            <div className="w-48">
              <Select value={categoryId || 'all'} onValueChange={(v) => setCategoryId(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-36">
              <Select value={direction || 'all'} onValueChange={(v) => setDirection(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="expense">Expenses</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="transfer">Transfers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search merchant or description…"
                className="h-9 text-sm pl-8"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        {/* Summary bar */}
        {!loading && (
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
            <div className="flex items-center gap-3">
              {selectedCategory && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
                  <span className="text-sm font-medium text-gray-700">{selectedCategory.name}</span>
                </span>
              )}
              <span className="text-sm text-gray-500">
                {total.toLocaleString()} transaction{total !== 1 ? 's' : ''}
                {search && <span className="text-gray-400"> (filtered)</span>}
              </span>
            </div>
            {totalAmount > 0 && (
              <span className="text-sm font-semibold text-gray-800">
                Total spend: {fmtCurrency(totalAmount)}
              </span>
            )}
          </div>
        )}

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 text-center">
              <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">No transactions match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {format(new Date(t.transactionDate), 'dd MMM yyyy')}
                      </td>
                      <td className="px-6 py-3 text-gray-900 max-w-[260px]">
                        <span className="block truncate font-medium">
                          {t.merchantName ?? t.descriptionNormalized ?? t.descriptionRaw}
                        </span>
                        {t.merchantName && t.descriptionRaw !== t.merchantName && (
                          <span className="block truncate text-xs text-gray-400 font-normal mt-0.5">
                            {t.descriptionRaw}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {t.category ? (
                          <button
                            onClick={() => setCategoryId(t.category!.id)}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: t.category.color }}
                          >
                            {t.category.name}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">Uncategorized</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <AmountDisplay amount={t.amount} direction={t.direction} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <TransactionsContent />
    </Suspense>
  )
}
