'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Download, AlertTriangle, Webhook, Copy, Eye, EyeOff, RefreshCw, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

// ---- Types ----

interface Account {
  id: string
  name: string
  institution: string
  accountType: string
  currency: string
  createdAt: string
}

interface Category {
  id: string
  name: string
  color: string
  isSystem: boolean
  subcategories: Array<{ id: string; name: string }>
}

interface MerchantRule {
  id: string
  pattern: string
  patternType: string
  categoryId: string
  category?: { name: string; color: string }
  isUserDefined: boolean
  priority: number
  createdAt: string
}

// ---- Accounts Tab ----

function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', institution: '', accountType: 'transaction', currency: 'AUD' })
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounts')
      const data = await res.json()
      setAccounts(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.institution) { setError('Name and institution are required.'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      setShowForm(false)
      setForm({ name: '', institution: '', accountType: 'transaction', currency: 'AUD' })
      fetch_()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">Accounts</h3>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
          <Plus className="w-4 h-4" /> Add Account
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleCreate} className="space-y-3">
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Account Name *</label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Everyday Account" required />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Institution *</label>
                  <Input value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} placeholder="Commonwealth Bank" required />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Account Type</label>
                  <Select value={form.accountType} onValueChange={v => setForm(f => ({ ...f, accountType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transaction">Transaction</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="credit">Credit Card</SelectItem>
                      <SelectItem value="investment">Investment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Currency</label>
                  <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUD">AUD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setError(null) }}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <span className="flex items-center gap-2"><LoadingSpinner size="sm" />Saving...</span> : 'Create Account'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No accounts yet. Add one above.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          {accounts.map(a => (
            <div key={a.id} className="flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50">
              <div>
                <p className="font-medium text-gray-800">{a.name}</p>
                <p className="text-sm text-gray-500">{a.institution} · {a.accountType} · {a.currency}</p>
              </div>
              <Badge variant="secondary">{a.accountType}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Categories Tab ----

const COLOR_PRESETS = [
  '#6366f1', '#3b82f6', '#22c55e', '#f97316', '#f43f5e',
  '#eab308', '#84cc16', '#14b8a6', '#ec4899', '#a855f7',
  '#64748b', '#94a3b8', '#10b981', '#06b6d4', '#dc2626',
]

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // New category form
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#6366f1')
  const [savingCat, setSavingCat] = useState(false)
  const [catError, setCatError] = useState<string | null>(null)

  // New subcategory form (keyed by category id)
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null)
  const [newSubName, setNewSubName] = useState('')
  const [savingSub, setSavingSub] = useState(false)
  const [subError, setSubError] = useState<string | null>(null)

  const [deletingCatId, setDeletingCatId] = useState<string | null>(null)
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatName.trim()) return
    setSavingCat(true); setCatError(null)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setNewCatName(''); setShowAddCat(false)
      fetchCategories()
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSavingCat(false)
    }
  }

  async function handleDeleteCategory(id: string) {
    setDeletingCatId(id)
    try {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      fetchCategories()
    } finally {
      setDeletingCatId(null)
    }
  }

  async function handleAddSubcategory(categoryId: string, e: React.FormEvent) {
    e.preventDefault()
    if (!newSubName.trim()) return
    setSavingSub(true); setSubError(null)
    try {
      const res = await fetch(`/api/categories/${categoryId}/subcategories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setNewSubName(''); setAddingSubFor(null)
      fetchCategories()
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSavingSub(false)
    }
  }

  async function handleDeleteSubcategory(categoryId: string, subId: string) {
    setDeletingSubId(subId)
    try {
      await fetch(`/api/categories/${categoryId}/subcategories/${subId}`, { method: 'DELETE' })
      fetchCategories()
    } finally {
      setDeletingSubId(null)
    }
  }

  if (loading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">Categories ({categories.length})</h3>
        <Button size="sm" onClick={() => { setShowAddCat(true); setCatError(null) }} className="gap-1">
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      {/* Add category form */}
      {showAddCat && (
        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleAddCategory} className="space-y-3">
              {catError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{catError}</p>}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Category Name *</label>
                <Input
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="e.g. Entertainment"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Colour</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCatColor(c)}
                      className="w-6 h-6 rounded-full border-2 transition-transform"
                      style={{
                        backgroundColor: c,
                        borderColor: newCatColor === c ? '#1e293b' : 'transparent',
                        transform: newCatColor === c ? 'scale(1.2)' : 'scale(1)',
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={e => setNewCatColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                    title="Custom colour"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => { setShowAddCat(false); setCatError(null) }}>Cancel</Button>
                <Button type="submit" disabled={savingCat || !newCatName.trim()}>
                  {savingCat ? <span className="flex items-center gap-2"><LoadingSpinner size="sm" />Saving...</span> : 'Add Category'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Category list */}
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
        {categories.map(c => {
          const isExpanded = expandedId === c.id
          return (
            <div key={c.id} className="bg-white">
              {/* Category row */}
              <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <button
                  type="button"
                  className="flex items-center gap-2 flex-1 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="font-medium text-gray-800">{c.name}</span>
                  {c.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
                  <span className="text-xs text-gray-400 ml-1">{c.subcategories?.length ?? 0} subs</span>
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 px-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                    onClick={() => {
                      setExpandedId(c.id)
                      setAddingSubFor(c.id)
                      setNewSubName('')
                      setSubError(null)
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Sub
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteCategory(c.id)}
                    disabled={deletingCatId === c.id}
                  >
                    {deletingCatId === c.id ? <LoadingSpinner size="sm" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Subcategories (expanded) */}
              {isExpanded && (
                <div className="px-5 pb-3 bg-gray-50 border-t border-gray-100">
                  <div className="flex flex-wrap gap-1.5 pt-3">
                    {(c.subcategories ?? []).map(s => (
                      <span
                        key={s.id}
                        className="flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full"
                      >
                        {s.name}
                        <button
                          type="button"
                          onClick={() => handleDeleteSubcategory(c.id, s.id)}
                          disabled={deletingSubId === s.id}
                          className="ml-1 text-gray-400 hover:text-red-500 disabled:opacity-40"
                        >
                          {deletingSubId === s.id ? <LoadingSpinner size="sm" /> : '×'}
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add subcategory inline form */}
                  {addingSubFor === c.id ? (
                    <form onSubmit={(e) => handleAddSubcategory(c.id, e)} className="flex items-center gap-2 mt-3">
                      {subError && <p className="text-xs text-red-600">{subError}</p>}
                      <Input
                        value={newSubName}
                        onChange={e => setNewSubName(e.target.value)}
                        placeholder="Subcategory name"
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button type="submit" size="sm" className="h-8" disabled={savingSub || !newSubName.trim()}>
                        {savingSub ? <LoadingSpinner size="sm" /> : 'Add'}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => { setAddingSubFor(null); setSubError(null) }}>
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      onClick={() => { setAddingSubFor(c.id); setNewSubName(''); setSubError(null) }}
                    >
                      <Plus className="w-3 h-3" /> Add subcategory
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Merchant Rules Tab ----

function MerchantRulesTab() {
  const [rules, setRules] = useState<MerchantRule[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rules')
      const data = await res.json()
      setRules(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/rules/${id}`, { method: 'DELETE' })
      fetchRules()
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">Merchant Rules ({rules.length})</h3>
      </div>
      {rules.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No merchant rules yet. They are created automatically when you categorize transactions in the Review queue.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          {rules.map(r => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3 bg-white hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gray-800 truncate">{r.pattern}</span>
                  <Badge variant={r.isUserDefined ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {r.isUserDefined ? 'User' : 'System'}
                  </Badge>
                  <Badge variant="outline" className="text-xs shrink-0">{r.patternType}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {r.category ? (
                    <span className="flex items-center gap-1">
                      Category:&nbsp;
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: r.category.color }}
                      />
                      {r.category.name}
                    </span>
                  ) : 'No category'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(r.id)}
                disabled={deletingId === r.id}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
              >
                {deletingId === r.id ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Data Controls Tab ----

function DataControlsTab() {
  const [confirmDeleteTx, setConfirmDeleteTx] = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const [confirmDeleteAllText, setConfirmDeleteAllText] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  async function handleExport() {
    setExportLoading(true)
    try {
      const res = await fetch('/api/export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finance-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportLoading(false)
    }
  }

  async function handleDeleteTransactions() {
    setDeleting('transactions')
    try {
      await fetch('/api/data?scope=transactions', { method: 'DELETE' })
      setConfirmDeleteTx(false)
      window.location.reload()
    } finally {
      setDeleting(null)
    }
  }

  async function handleDeleteAll() {
    setDeleting('all')
    try {
      await fetch('/api/data?scope=all', { method: 'DELETE' })
      setConfirmDeleteAll(false)
      window.location.reload()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold text-gray-800">Data Controls</h3>

      {/* Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Export Data</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Download all your transactions, budgets, goals, and categories as JSON.</p>
          <Button variant="outline" onClick={handleExport} disabled={exportLoading} className="gap-2 ml-4 shrink-0">
            {exportLoading ? <LoadingSpinner size="sm" /> : <Download className="w-4 h-4" />}
            Export JSON
          </Button>
        </CardContent>
      </Card>

      {/* Delete transactions */}
      <Card className="border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-orange-700">Delete All Transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Remove all transaction data. Accounts, categories, budgets, and goals are kept.</p>
          <Button
            variant="destructive"
            onClick={() => setConfirmDeleteTx(true)}
            className="gap-2 ml-4 shrink-0 bg-orange-500 hover:bg-orange-600"
          >
            <Trash2 className="w-4 h-4" />
            Delete Transactions
          </Button>
        </CardContent>
      </Card>

      {/* Delete all */}
      <Card className="border-red-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-red-700">Delete All Data</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Permanently delete everything — transactions, accounts, categories, budgets, goals. This cannot be undone.</p>
          <Button
            variant="destructive"
            onClick={() => setConfirmDeleteAll(true)}
            className="gap-2 ml-4 shrink-0"
          >
            <AlertTriangle className="w-4 h-4" />
            Delete All Data
          </Button>
        </CardContent>
      </Card>

      {/* Confirm delete transactions */}
      <Dialog open={confirmDeleteTx} onOpenChange={setConfirmDeleteTx}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Transactions?</DialogTitle>
            <DialogDescription>
              This will permanently remove all transaction records. Your accounts, categories, budgets, and goals will remain. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteTx(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTransactions} disabled={deleting === 'transactions'}>
              {deleting === 'transactions' ? <LoadingSpinner size="sm" /> : 'Yes, Delete Transactions'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete all */}
      <Dialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All Data?</DialogTitle>
            <DialogDescription>
              This will permanently delete ALL data including transactions, accounts, categories, budgets, and goals. This action is irreversible. Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmDeleteAllText}
            onChange={e => setConfirmDeleteAllText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="my-2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDeleteAll(false); setConfirmDeleteAllText('') }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={confirmDeleteAllText !== 'DELETE' || deleting === 'all'}
            >
              {deleting === 'all' ? <LoadingSpinner size="sm" /> : 'Delete Everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---- Webhook Tab ----

function WebhookTab() {
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState<'url' | 'key' | null>(null)

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhooks/transaction`
      : '/api/webhooks/transaction'

  const checkKey = useCallback(async () => {
    const res = await fetch('/api/settings/webhook-key')
    const data = await res.json()
    setHasKey(data.hasKey)
  }, [])

  useEffect(() => { checkKey() }, [checkKey])

  async function handleGenerate() {
    setGenerating(true)
    setNewKey(null)
    try {
      const res = await fetch('/api/settings/webhook-key', { method: 'POST' })
      const data = await res.json()
      setNewKey(data.key)
      setShowKey(true)
      setHasKey(true)
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy(text: string, type: 'url' | 'key') {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold text-gray-800">Webhook Integration</h3>
      <p className="text-sm text-gray-500">
        Use the webhook endpoint to automatically push transactions from your Android phone in real time.
        Your companion Android app will send a POST request here whenever a payment notification arrives.
      </p>

      {/* Webhook URL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Webhook className="w-4 h-4 text-indigo-500" />
            Webhook Endpoint
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded px-3 py-2 text-gray-700 font-mono truncate">
              {webhookUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(webhookUrl, 'url')}
              className="shrink-0 gap-1"
            >
              {copied === 'url' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied === 'url' ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-gray-400">
            Method: <strong>POST</strong> · Content-Type: <strong>application/json</strong> · Auth: <strong>Bearer token</strong>
          </p>
        </CardContent>
      </Card>

      {/* API Key */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {newKey ? (
            <div className="space-y-2">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Save this key now — it will not be shown again. Store it in your Android app settings.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded px-3 py-2 font-mono truncate">
                  {showKey ? newKey : '••••••••••••••••••••••••••••••••••••'}
                </code>
                <Button variant="ghost" size="icon" onClick={() => setShowKey(v => !v)}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleCopy(newKey, 'key')} className="shrink-0 gap-1">
                  {copied === 'key' ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copied === 'key' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {hasKey
                ? 'An API key is configured. Generate a new one to rotate it (this invalidates the old key).'
                : 'No API key set. Generate one to enable the webhook endpoint.'}
            </p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generating}
            variant={hasKey ? 'outline' : 'default'}
            className="gap-2"
          >
            {generating ? (
              <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Generating...</span>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {hasKey ? 'Regenerate Key' : 'Generate API Key'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Payload reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Expected Payload</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-4 overflow-x-auto text-gray-700">
{`POST /api/webhooks/transaction
Authorization: Bearer <your-api-key>
Content-Type: application/json

{
  "accountId": "<account-id-from-settings>",
  "transactionDate": "2026-04-15T10:30:00+10:00",
  "descriptionRaw": "WOOLWORTHS #1234 SYDNEY NSW",
  "amount": 85.50,
  "direction": "expense",
  "currency": "AUD"
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Main Page ----

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <Tabs defaultValue="accounts">
        <TabsList className="mb-6">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="rules">Merchant Rules</TabsTrigger>
          <TabsTrigger value="data">Data Controls</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <AccountsTab />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="rules">
          <MerchantRulesTab />
        </TabsContent>
        <TabsContent value="data">
          <DataControlsTab />
        </TabsContent>
        <TabsContent value="webhook">
          <WebhookTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
