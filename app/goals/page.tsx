'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Target, Calendar, TrendingUp, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingPage, LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { format, differenceInMonths, parseISO } from 'date-fns'

interface Goal {
  id: string
  name: string
  goalType: string
  targetAmount: number
  currentSavedAmount: number
  targetDate?: string
  monthlyContributionTarget?: number
  priority?: number
  notes?: string
  createdAt: string
}

const GOAL_TYPES = [
  { id: 'savings', label: 'Savings' },
  { id: 'emergency_fund', label: 'Emergency Fund' },
  { id: 'debt_payoff', label: 'Debt Payoff' },
  { id: 'investment', label: 'Investment' },
  { id: 'purchase', label: 'Large Purchase' },
  { id: 'travel', label: 'Travel' },
  { id: 'other', label: 'Other' },
]

const GOAL_TYPE_COLORS: Record<string, string> = {
  savings: 'bg-green-100 text-green-700',
  emergency_fund: 'bg-blue-100 text-blue-700',
  debt_payoff: 'bg-red-100 text-red-700',
  investment: 'bg-purple-100 text-purple-700',
  purchase: 'bg-orange-100 text-orange-700',
  travel: 'bg-sky-100 text-sky-700',
  other: 'bg-gray-100 text-gray-700',
}

interface GoalForm {
  name: string
  goalType: string
  targetAmount: string
  currentSavedAmount: string
  targetDate: string
  monthlyContributionTarget: string
  notes: string
}

const EMPTY_FORM: GoalForm = {
  name: '',
  goalType: 'savings',
  targetAmount: '',
  currentSavedAmount: '0',
  targetDate: '',
  monthlyContributionTarget: '',
  notes: '',
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GoalForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchGoals = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/goals')
      const data = await res.json()
      setGoals(Array.isArray(data) ? data : [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGoals()
  }, [fetchGoals])

  function updateForm(field: keyof GoalForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function openNewDialog() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
    setDialogOpen(true)
  }

  function openEditDialog(goal: Goal) {
    setEditingId(goal.id)
    setForm({
      name: goal.name,
      goalType: goal.goalType,
      targetAmount: String(goal.targetAmount),
      currentSavedAmount: String(goal.currentSavedAmount),
      targetDate: goal.targetDate ? goal.targetDate.slice(0, 10) : '',
      monthlyContributionTarget: goal.monthlyContributionTarget
        ? String(goal.monthlyContributionTarget)
        : '',
      notes: goal.notes ?? '',
    })
    setError(null)
    setDialogOpen(true)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/goals/${id}`, { method: 'DELETE' })
      fetchGoals()
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.targetAmount) {
      setError('Name and target amount are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = {
        name: form.name,
        goalType: form.goalType,
        targetAmount: parseFloat(form.targetAmount),
        currentSavedAmount: parseFloat(form.currentSavedAmount || '0'),
        targetDate: form.targetDate || undefined,
        monthlyContributionTarget: form.monthlyContributionTarget
          ? parseFloat(form.monthlyContributionTarget)
          : undefined,
        notes: form.notes || undefined,
      }
      const res = editingId
        ? await fetch(`/api/goals/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? (editingId ? 'Failed to update goal' : 'Failed to create goal'))
      }
      setDialogOpen(false)
      setForm(EMPTY_FORM)
      setEditingId(null)
      fetchGoals()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  function computeProjected(goal: Goal): { monthsLeft: number | null; projectedDate: string | null } {
    if (!goal.monthlyContributionTarget || goal.monthlyContributionTarget <= 0) {
      return { monthsLeft: null, projectedDate: null }
    }
    const remaining = goal.targetAmount - goal.currentSavedAmount
    if (remaining <= 0) return { monthsLeft: 0, projectedDate: 'Completed' }
    const months = Math.ceil(remaining / goal.monthlyContributionTarget)
    const projected = new Date()
    projected.setMonth(projected.getMonth() + months)
    return { monthsLeft: months, projectedDate: format(projected, 'MMM yyyy') }
  }

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)

  if (loading) return <LoadingPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Financial Goals</h2>
        <Button onClick={openNewDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          New Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="w-16 h-16" />}
          title="No goals yet"
          description="Create a financial goal to track your progress toward saving, paying off debt, or making a big purchase."
          action={{ label: 'Create First Goal', onClick: openNewDialog }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {goals.map((goal) => {
            const pct =
              goal.targetAmount > 0
                ? Math.min((goal.currentSavedAmount / goal.targetAmount) * 100, 100)
                : 0
            const remaining = goal.targetAmount - goal.currentSavedAmount
            const { monthsLeft, projectedDate } = computeProjected(goal)
            const typeLabel = GOAL_TYPES.find((t) => t.id === goal.goalType)?.label ?? goal.goalType
            const typeColor = GOAL_TYPE_COLORS[goal.goalType] ?? GOAL_TYPE_COLORS.other

            return (
              <Card key={goal.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{goal.name}</CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColor}`}>
                        {typeLabel}
                      </span>
                      <button
                        onClick={() => openEditDialog(goal)}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        title="Edit goal"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        disabled={deletingId === goal.id}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete goal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {goal.notes && (
                    <CardDescription className="text-xs">{goal.notes}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-col flex-1 gap-4">
                  {/* Amounts */}
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Saved</p>
                      <p className="font-semibold text-gray-800">{fmtCurrency(goal.currentSavedAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-0.5">Target</p>
                      <p className="font-semibold text-gray-800">{fmtCurrency(goal.targetAmount)}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <Progress value={pct} className="h-3" />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{pct.toFixed(1)}% complete</span>
                      <span>{fmtCurrency(remaining)} remaining</span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-1.5 text-xs text-gray-500 mt-auto">
                    {goal.monthlyContributionTarget && (
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>{fmtCurrency(goal.monthlyContributionTarget)}/month target</span>
                      </div>
                    )}
                    {goal.targetDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Target: {format(parseISO(goal.targetDate), 'dd MMM yyyy')}</span>
                      </div>
                    )}
                    {projectedDate && (
                      <div className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" />
                        <span>
                          Projected completion: {projectedDate}
                          {monthsLeft !== null && monthsLeft > 0 && (
                            <span className="text-gray-400"> ({monthsLeft} months)</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* New Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Goal Name *</label>
              <Input
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
                placeholder="e.g. Emergency Fund"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Type</label>
              <Select value={form.goalType} onValueChange={(v) => updateForm('goalType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Target Amount (AUD) *</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.targetAmount}
                  onChange={(e) => updateForm('targetAmount', e.target.value)}
                  placeholder="10000"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Currently Saved</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.currentSavedAmount}
                  onChange={(e) => updateForm('currentSavedAmount', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Target Date</label>
                <Input
                  type="date"
                  value={form.targetDate}
                  onChange={(e) => updateForm('targetDate', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Monthly Target</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthlyContributionTarget}
                  onChange={(e) => updateForm('monthlyContributionTarget', e.target.value)}
                  placeholder="500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <Input
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                placeholder="Optional notes..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    {editingId ? 'Saving...' : 'Creating...'}
                  </span>
                ) : (
                  {editingId ? 'Save Changes' : 'Create Goal'}
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
