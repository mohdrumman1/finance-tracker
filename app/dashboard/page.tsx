'use client'

import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { ArrowUpRight, ArrowDownRight, Upload, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge'
import { LoadingPage, LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { useRouter } from 'next/navigation'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

interface Transaction {
  id: string
  transactionDate: string
  merchantName?: string
  descriptionNormalized?: string
  descriptionRaw: string
  amount: number
  direction: 'income' | 'expense' | 'transfer'
  categoryId?: string
  category?: { name: string; color: string }
  confidenceScore: number
}

interface MonthSummary {
  income: number
  expenses: number
  net: number
  savingsRate: number
}

function computeSummary(transactions: Transaction[]): MonthSummary {
  let income = 0
  let expenses = 0
  for (const t of transactions) {
    if (t.direction === 'income') income += Math.abs(t.amount)
    else if (t.direction === 'expense') expenses += Math.abs(t.amount)
  }
  const net = income - expenses
  const savingsRate = income > 0 ? (net / income) * 100 : 0
  return { income, expenses, net, savingsRate }
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

interface SummaryCardProps {
  title: string
  value: number
  isRate?: boolean
  direction?: 'income' | 'expense' | 'transfer'
  previousValue?: number
  colorOverride?: string
}

function SummaryCard({ title, value, isRate, direction, previousValue, colorOverride }: SummaryCardProps) {
  const change = previousValue !== undefined ? pctChange(value, previousValue) : null

  const valueColor = colorOverride
    ? colorOverride
    : direction === 'income'
    ? 'text-green-600'
    : direction === 'expense'
    ? 'text-red-600'
    : value >= 0
    ? 'text-green-600'
    : 'text-red-600'

  const formatted = isRate
    ? `${value.toFixed(1)}%`
    : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Math.abs(value))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor}`}>{formatted}</div>
        {change !== null && (
          <div className={`flex items-center text-xs mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change >= 0 ? (
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
            ) : (
              <ArrowDownRight className="w-3 h-3 mr-0.5" />
            )}
            <span>{Math.abs(change).toFixed(1)}% vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface CategoryModal {
  categoryId: string
  name: string
  color: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentTransactions, setCurrentTransactions] = useState<Transaction[]>([])
  const [previousTransactions, setPreviousTransactions] = useState<Transaction[]>([])
  const [cashflowData, setCashflowData] = useState<Array<{ month: string; Income: number; Expenses: number }>>([])
  const [categoryModal, setCategoryModal] = useState<CategoryModal | null>(null)
  const [modalTransactions, setModalTransactions] = useState<Transaction[]>([])
  const [modalLoading, setModalLoading] = useState(false)

  const now = new Date()
  const currentStart = startOfMonth(now)
  const currentEnd = endOfMonth(now)
  const prevStart = startOfMonth(subMonths(now, 1))
  const prevEnd = endOfMonth(subMonths(now, 1))

  useEffect(() => {
    async function fetchAll() {
      try {
        const [currentRes, previousRes] = await Promise.all([
          fetch(
            `/api/transactions?startDate=${currentStart.toISOString()}&endDate=${currentEnd.toISOString()}&limit=200`
          ),
          fetch(
            `/api/transactions?startDate=${prevStart.toISOString()}&endDate=${prevEnd.toISOString()}&limit=200`
          ),
        ])

        const currentData = await currentRes.json()
        const previousData = await previousRes.json()

        setCurrentTransactions(currentData.transactions ?? [])
        setPreviousTransactions(previousData.transactions ?? [])

        // Build cashflow for last 6 months
        const months = Array.from({ length: 6 }, (_, i) => subMonths(now, 5 - i))
        const cashflow = await Promise.all(
          months.map(async (m) => {
            const start = startOfMonth(m).toISOString()
            const end = endOfMonth(m).toISOString()
            const res = await fetch(`/api/transactions?startDate=${start}&endDate=${end}&limit=500`)
            const data = await res.json()
            const txns: Transaction[] = data.transactions ?? []
            let income = 0
            let expenses = 0
            for (const t of txns) {
              if (t.direction === 'income') income += Math.abs(t.amount)
              else if (t.direction === 'expense') expenses += Math.abs(t.amount)
            }
            return {
              month: format(m, 'MMM yy'),
              Income: parseFloat(income.toFixed(2)),
              Expenses: parseFloat(expenses.toFixed(2)),
            }
          })
        )
        setCashflowData(cashflow)
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <LoadingPage />

  const current = computeSummary(currentTransactions)
  const previous = computeSummary(previousTransactions)

  // Top expense categories (with colors + ids)
  const categoryMap: Record<string, { amount: number; color: string; categoryId: string }> = {}
  for (const t of currentTransactions) {
    if (t.direction === 'expense' && t.category && t.categoryId) {
      const { name, color } = t.category
      if (!categoryMap[name]) categoryMap[name] = { amount: 0, color, categoryId: t.categoryId }
      categoryMap[name].amount += Math.abs(t.amount)
    }
  }
  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 6)

  const pieData = topCategories.map(([name, { amount, color }]) => ({ name, value: amount, color }))

  async function openCategoryModal(name: string, categoryId: string, color: string) {
    setCategoryModal({ categoryId, name, color })
    setModalLoading(true)
    setModalTransactions([])
    try {
      const res = await fetch(
        `/api/transactions?categoryId=${categoryId}&startDate=${currentStart.toISOString()}&endDate=${currentEnd.toISOString()}&limit=200`
      )
      const data = await res.json()
      setModalTransactions(data.transactions ?? [])
    } catch {
      // ignore
    } finally {
      setModalLoading(false)
    }
  }

  const recentTransactions = [...currentTransactions]
    .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
    .slice(0, 10)

  const hasData = currentTransactions.length > 0 || previousTransactions.length > 0

  if (!hasData) {
    return (
      <EmptyState
        icon={<Upload className="w-16 h-16" />}
        title="No transactions yet"
        description="Import your bank transactions to get started with your financial overview."
        action={{ label: 'Import Transactions', onClick: () => router.push('/imports') }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-700">
        {format(now, 'MMMM yyyy')} Overview
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Income"
          value={current.income}
          direction="income"
          previousValue={previous.income}
        />
        <SummaryCard
          title="Total Expenses"
          value={current.expenses}
          direction="expense"
          previousValue={previous.expenses}
        />
        <SummaryCard
          title="Net Savings"
          value={current.net}
          previousValue={previous.net}
        />
        <SummaryCard
          title="Savings Rate"
          value={current.savingsRate}
          isRate
          previousValue={previous.savingsRate}
          colorOverride={current.savingsRate >= 0 ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cashflow Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cashflow — Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cashflowData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    new Intl.NumberFormat('en-AU', {
                      style: 'currency',
                      currency: 'AUD',
                      notation: 'compact',
                    }).format(v)
                  }
                />
                <Tooltip
                  formatter={(value: unknown) =>
                    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(value ?? 0))
                  }
                />
                <Legend />
                <Bar dataKey="Income" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Breakdown — donut chart */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No expense data this month</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={72}
                      strokeWidth={2}
                      cursor="pointer"
                      onClick={(entry) => {
                        const name = entry.name as string
                        const cat = categoryMap[name]
                        if (cat) openCategoryModal(name, cat.categoryId, cat.color)
                      }}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: unknown) =>
                        new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(value ?? 0))
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2 min-w-0">
                  {topCategories.map(([name, { amount, color, categoryId }]) => (
                    <button
                      key={name}
                      onClick={() => openCategoryModal(name, categoryId, color)}
                      className="flex items-center gap-2 w-full text-left rounded-md px-1.5 py-1 hover:bg-gray-50 transition-colors group"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm text-gray-700 truncate flex-1 group-hover:text-indigo-600 transition-colors">{name}</span>
                      <span className="text-sm font-medium tabular-nums text-gray-800">
                        {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', notation: 'compact' }).format(amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Advisor teaser */}
      <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">AI Finance Advisor</p>
                <p className="text-xs text-gray-500">Get personalised insights and chat about your spending habits</p>
              </div>
            </div>
            <Link href="/advisor">
              <Button variant="outline" size="sm" className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                Open Advisor
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-gray-500 p-6">No transactions this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                        {format(new Date(t.transactionDate), 'dd MMM yyyy')}
                      </td>
                      <td className="px-6 py-3 text-gray-900 font-medium max-w-[200px] truncate">
                        {t.merchantName ?? t.descriptionNormalized ?? t.descriptionRaw}
                      </td>
                      <td className="px-6 py-3">
                        {t.category ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: t.category.color }}
                          >
                            {t.category.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Uncategorized</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <AmountDisplay amount={t.amount} direction={t.direction} />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <ConfidenceBadge score={t.confidenceScore} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Category drill-down modal */}
      {categoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCategoryModal(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: categoryModal.color }} />
                <h3 className="font-semibold text-gray-900">{categoryModal.name}</h3>
                <span className="text-sm text-gray-500">— {format(currentStart, 'MMMM yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/transactions?categoryId=${categoryModal.categoryId}&preset=1m`}
                  onClick={() => setCategoryModal(null)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  View all →
                </Link>
                <button onClick={() => setCategoryModal(null)} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1">
              {modalLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : modalTransactions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-12">No transactions found.</p>
              ) : (
                <>
                  {/* Total */}
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 text-sm text-gray-600 flex justify-between">
                    <span>{modalTransactions.length} transaction{modalTransactions.length !== 1 ? 's' : ''}</span>
                    <span className="font-semibold text-gray-800">
                      Total: {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
                        modalTransactions.reduce((s, t) => s + Math.abs(t.amount), 0)
                      )}
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-6 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="text-left px-6 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                        <th className="text-right px-6 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {modalTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 text-gray-500 whitespace-nowrap">
                            {format(new Date(t.transactionDate), 'dd MMM')}
                          </td>
                          <td className="px-6 py-3 text-gray-800 max-w-[280px] truncate">
                            {t.merchantName ?? t.descriptionNormalized ?? t.descriptionRaw}
                          </td>
                          <td className="px-6 py-3 text-right font-medium text-gray-800 tabular-nums">
                            {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Math.abs(t.amount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
