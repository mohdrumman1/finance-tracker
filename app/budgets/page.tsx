'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Copy, TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { LoadingPage } from '@/components/shared/LoadingSpinner'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'

interface BudgetItem {
  categoryId: string
  categoryName: string
  categoryColor: string
  budgetAmount: number
  actualAmount: number
  id?: string
}

interface BudgetSummary {
  totalBudgeted: number
  totalActual: number
  savingsPotential: number
}

function getPacingLabel(pct: number, daysElapsed: number, daysInMonth: number): { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' } {
  const monthPct = (daysElapsed / daysInMonth) * 100
  if (pct === 0) return { label: 'Not started', variant: 'secondary' }
  if (pct >= 100) return { label: 'Over budget', variant: 'destructive' }
  if (pct > monthPct + 15) return { label: 'Ahead of pace', variant: 'warning' }
  if (pct < monthPct - 20) return { label: 'Under budget', variant: 'success' }
  return { label: 'On track', variant: 'success' }
}

export default function BudgetsPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const fetchBudgets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/budgets?year=${year}&month=${month}`)
      const data = await res.json()
      setBudgets(Array.isArray(data) ? data : [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchBudgets()
  }, [fetchBudgets])

  async function handleCopyPrevious() {
    setCopying(true)
    try {
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, copyPrevious: true }),
      })
      fetchBudgets()
    } catch {
      // ignore
    } finally {
      setCopying(false)
    }
  }

  async function handleBudgetChange(categoryId: string, amount: number) {
    try {
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, amount, year, month }),
      })
      fetchBudgets()
    } catch {
      // ignore
    }
  }

  const now = new Date()
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysElapsed =
    year === now.getFullYear() && month === now.getMonth() + 1
      ? now.getDate()
      : daysInMonth

  const summary: BudgetSummary = budgets.reduce(
    (acc, b) => ({
      totalBudgeted: acc.totalBudgeted + (b.budgetAmount ?? 0),
      totalActual: acc.totalActual + (b.actualAmount ?? 0),
      savingsPotential: acc.savingsPotential + Math.max(0, (b.budgetAmount ?? 0) - (b.actualAmount ?? 0)),
    }),
    { totalBudgeted: 0, totalActual: 0, savingsPotential: 0 }
  )

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold text-gray-800 min-w-[160px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          onClick={handleCopyPrevious}
          disabled={copying}
          className="gap-2"
        >
          <Copy className="w-4 h-4" />
          {copying ? 'Copying...' : 'Copy Previous Month'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Budgeted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-800">{fmtCurrency(summary.totalBudgeted)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.totalActual > summary.totalBudgeted ? 'text-red-600' : 'text-gray-800'}`}>
              {fmtCurrency(summary.totalActual)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Savings Potential</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fmtCurrency(summary.savingsPotential)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Budget table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <LoadingPage />
            </div>
          ) : budgets.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-gray-500 mb-4">No budgets set for this month.</p>
              <Button variant="outline" onClick={handleCopyPrevious}>
                Copy from Previous Month
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[160px]">Progress</th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Pacing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {budgets.map((b) => {
                    const budgetAmt = b.budgetAmount ?? 0
                    const actualAmt = b.actualAmount ?? 0
                    const pct = budgetAmt > 0 ? Math.min((actualAmt / budgetAmt) * 100, 100) : 0
                    const overBudget = actualAmt > budgetAmt && budgetAmt > 0
                    const pacing = getPacingLabel(
                      budgetAmt > 0 ? (actualAmt / budgetAmt) * 100 : 0,
                      daysElapsed,
                      daysInMonth
                    )
                    const isEditing = editingId === b.categoryId

                    return (
                      <tr key={b.categoryId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: b.categoryColor }}
                            />
                            <span className="font-medium text-gray-800">{b.categoryName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => {
                                const v = parseFloat(editValue)
                                if (!isNaN(v)) handleBudgetChange(b.categoryId, v)
                                setEditingId(null)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const v = parseFloat(editValue)
                                  if (!isNaN(v)) handleBudgetChange(b.categoryId, v)
                                  setEditingId(null)
                                }
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              className="w-28 text-right h-8 text-sm"
                              autoFocus
                            />
                          ) : (
                            <button
                              className="text-gray-800 font-medium hover:text-indigo-600 transition-colors cursor-pointer"
                              onClick={() => {
                                setEditingId(b.categoryId)
                                setEditValue(String(budgetAmt))
                              }}
                              title="Click to edit"
                            >
                              {fmtCurrency(budgetAmt)}
                            </button>
                          )}
                        </td>
                        <td className={`px-6 py-4 text-right font-medium ${overBudget ? 'text-red-600' : 'text-gray-800'}`}>
                          {fmtCurrency(actualAmt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <Progress
                              value={pct}
                              className={`h-2 ${overBudget ? '[&>div]:bg-red-500' : ''}`}
                            />
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>{pct.toFixed(0)}%</span>
                              {budgetAmt > 0 && (
                                <span className={overBudget ? 'text-red-500' : 'text-gray-400'}>
                                  {overBudget ? '+' : ''}{fmtCurrency(actualAmt - budgetAmt)} left
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant={pacing.variant}>{pacing.label}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
