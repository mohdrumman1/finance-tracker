'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Copy, Plus, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingPage, LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { format, addMonths, subMonths } from 'date-fns'

interface BudgetItem {
  id?: string
  categoryId: string
  categoryName: string
  categoryColor: string
  budgetAmount: number
  actualAmount: number
}

interface Category {
  id: string
  name: string
  color: string
}

interface BudgetSummary {
  totalBudgeted: number
  totalActual: number
  savingsPotential: number
}

function getPacingLabel(
  pct: number,
  daysElapsed: number,
  daysInMonth: number
): { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' } {
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
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Add budget form
  const [showAddForm, setShowAddForm] = useState(false)
  const [addCategoryId, setAddCategoryId] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const fetchBudgets = useCallback(async () => {
    setLoading(true)
    try {
      const [budgetRes, catRes] = await Promise.all([
        fetch(`/api/budgets?year=${year}&month=${month}`),
        fetch('/api/categories'),
      ])
      const budgetData = await budgetRes.json()
      const catData = await catRes.json()
      setBudgets(Array.isArray(budgetData) ? budgetData : [])
      setCategories(Array.isArray(catData) ? catData : [])
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

  async function handleAddBudget(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(addAmount)
    if (!addCategoryId || isNaN(amount) || amount <= 0) return
    setAddSaving(true)
    try {
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: addCategoryId, amount, year, month }),
      })
      setShowAddForm(false)
      setAddCategoryId('')
      setAddAmount('')
      fetchBudgets()
    } catch {
      // ignore
    } finally {
      setAddSaving(false)
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
      savingsPotential:
        acc.savingsPotential + Math.max(0, (b.budgetAmount ?? 0) - (b.actualAmount ?? 0)),
    }),
    { totalBudgeted: 0, totalActual: 0, savingsPotential: 0 }
  )

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)

  // Categories not yet budgeted this month
  const budgetedCatIds = new Set(budgets.map((b) => b.categoryId))
  const availableCategories = categories.filter((c) => !budgetedCatIds.has(c.id))

  if (loading) return <LoadingPage />

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold text-gray-800 min-w-[160px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCopyPrevious}
            disabled={copying}
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            {copying ? 'Copying...' : 'Copy Previous Month'}
          </Button>
          <Button
            onClick={() => setShowAddForm(true)}
            disabled={availableCategories.length === 0}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Budget
          </Button>
        </div>
      </div>

      {/* Add budget form */}
      {showAddForm && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Add Budget</CardTitle>
              <button
                onClick={() => { setShowAddForm(false); setAddCategoryId(''); setAddAmount('') }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddBudget} className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1.5 flex-1 min-w-[180px]">
                <label className="text-sm font-medium text-gray-700">Category</label>
                <Select value={addCategoryId} onValueChange={setAddCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: c.color }}
                          />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 w-36">
                <label className="text-sm font-medium text-gray-700">Monthly Budget ($)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={addSaving || !addCategoryId || !addAmount}>
                {addSaving ? <LoadingSpinner size="sm" /> : 'Add'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

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
          {budgets.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-gray-500">No budgets set for {format(currentDate, 'MMMM yyyy')}.</p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={handleCopyPrevious} disabled={copying} className="gap-2">
                  <Copy className="w-4 h-4" />
                  {copying ? 'Copying...' : 'Copy from Previous Month'}
                </Button>
                <Button onClick={() => setShowAddForm(true)} disabled={availableCategories.length === 0} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Budget
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Progress</th>
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
                              className="w-28 text-right h-8 text-sm ml-auto"
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
                                  {overBudget
                                    ? `${fmtCurrency(actualAmt - budgetAmt)} over`
                                    : `${fmtCurrency(budgetAmt - actualAmt)} left`}
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
