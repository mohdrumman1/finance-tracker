'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle, ChevronRight, AlertCircle, ArrowLeftRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { EmptyState } from '@/components/shared/EmptyState'
import { format } from 'date-fns'

interface Category {
  id: string
  name: string
  color: string
  subcategories?: Array<{ id: string; name: string }>
}

interface Transaction {
  id: string
  transactionDate: string
  descriptionRaw: string
  descriptionNormalized?: string
  merchantName?: string
  amount: number
  direction: 'income' | 'expense' | 'transfer'
  categoryId?: string
  subcategoryId?: string
  category?: { id: string; name: string; color: string }
  reviewStatus: string
  confidenceScore: number
  notes?: string
}

export default function ReviewPage() {
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [applyToAllBanner, setApplyToAllBanner] = useState<string | null>(null)

  // Per-transaction edits
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('')
  const [applyToAll, setApplyToAll] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [txRes, catRes] = await Promise.all([
        fetch('/api/transactions?reviewStatus=needs_review&limit=100'),
        fetch('/api/categories'),
      ])
      const txData = await txRes.json()
      const catData = await catRes.json()

      const txns: Transaction[] = txData.transactions ?? []
      setTransactions(txns)
      setCategories(Array.isArray(catData) ? catData : [])

      if (txns.length > 0) {
        const first = txns[0]
        setSelectedCategory(first.categoryId ?? '')
        setSelectedSubcategory(first.subcategoryId ?? '')
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const current = transactions[currentIdx]

  useEffect(() => {
    if (current) {
      setSelectedCategory(current.categoryId ?? '')
      setSelectedSubcategory(current.subcategoryId ?? '')
      setApplyToAll(false)
    }
  }, [current])

  const subcategories =
    categories.find((c) => c.id === selectedCategory)?.subcategories ?? []

  async function handleConfirm() {
    if (!current) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        reviewStatus: 'reviewed',
        categoryId: selectedCategory || undefined,
        subcategoryId: selectedSubcategory || undefined,
        applyToAll,
        merchantName: current.merchantName ?? current.descriptionNormalized ?? current.descriptionRaw,
      }

      const res = await fetch(`/api/transactions/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const resData = await res.json()

      if (applyToAll) {
        const n = resData.appliedCount ?? 0
        setApplyToAllBanner(
          n > 0
            ? `Applied to ${n} other matching transaction${n === 1 ? '' : 's'}`
            : 'No other matching transactions found'
        )
        setTimeout(() => setApplyToAllBanner(null), 4000)
        // Re-fetch the full queue since matching transactions were bulk-updated
        await fetchData()
      } else {
        const nextTransactions = transactions.filter((_, i) => i !== currentIdx)
        setTransactions(nextTransactions)
        const nextIdx = Math.min(currentIdx, nextTransactions.length - 1)
        setCurrentIdx(Math.max(0, nextIdx))
      }

      // Notify sidebar to refresh its review count badge
      window.dispatchEvent(new Event('reviewCountChanged'))
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkTransfer() {
    if (!current) return
    setSaving(true)
    try {
      await fetch(`/api/transactions/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'transfer', reviewStatus: 'reviewed', categoryId: null, subcategoryId: null }),
      })
      const nextTransactions = transactions.filter((_, i) => i !== currentIdx)
      setTransactions(nextTransactions)
      setCurrentIdx(Math.max(0, Math.min(currentIdx, nextTransactions.length - 1)))
      window.dispatchEvent(new Event('reviewCountChanged'))
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    if (currentIdx < transactions.length - 1) {
      setCurrentIdx((i) => i + 1)
    }
  }

  if (loading) return <LoadingPage />

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle className="w-16 h-16" />}
        title="Review queue is empty"
        description="All transactions have been reviewed. Import more to categorize."
      />
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Apply-to-all feedback banner */}
      {applyToAllBanner && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {applyToAllBanner}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-800">Review Queue</h2>
          <Badge variant="destructive">{transactions.length} remaining</Badge>
        </div>
        <span className="text-sm text-gray-500">
          {currentIdx + 1} of {transactions.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all rounded-full"
          style={{ width: `${((currentIdx) / transactions.length) * 100}%` }}
        />
      </div>

      {current && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">
                  {current.merchantName ?? current.descriptionNormalized ?? current.descriptionRaw}
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {format(new Date(current.transactionDate), 'EEEE, dd MMMM yyyy')}
                </p>
              </div>
              <AmountDisplay
                amount={current.amount}
                direction={current.direction}
                className="text-xl"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Raw description */}
            {current.descriptionRaw !== (current.merchantName ?? current.descriptionNormalized) && (
              <div className="p-3 bg-gray-50 rounded-md">
                <p className="text-xs text-gray-500 mb-0.5">Raw description</p>
                <p className="text-sm text-gray-700 font-mono">{current.descriptionRaw}</p>
              </div>
            )}

            {/* Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Category</label>
                <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setSelectedSubcategory('') }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {subcategories.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Subcategory</label>
                  <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subcategory..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Apply to all */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">
                Apply this category to all matching transactions with the same merchant
              </span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleSkip} disabled={currentIdx >= transactions.length - 1}>
                  Skip
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button variant="outline" onClick={handleMarkTransfer} disabled={saving}>
                  <ArrowLeftRight className="w-4 h-4 mr-1.5" />
                  Transfer
                </Button>
              </div>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Saving...
                  </span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Confirm & Next
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue preview */}
      {transactions.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">Up Next</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {transactions.slice(currentIdx + 1, currentIdx + 4).map((t, i) => (
                <div key={t.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {t.merchantName ?? t.descriptionNormalized ?? t.descriptionRaw}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(t.transactionDate), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <AmountDisplay amount={t.amount} direction={t.direction} className="text-sm" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
