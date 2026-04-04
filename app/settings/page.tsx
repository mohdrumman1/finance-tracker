'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Download, AlertTriangle } from 'lucide-react'
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

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => setCategories(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-8"><LoadingSpinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-800">Categories ({categories.length})</h3>
        <Badge variant="secondary">Read-only — system managed</Badge>
      </div>
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
        {categories.map(c => (
          <div key={c.id} className="px-5 py-3 bg-white hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="font-medium text-gray-800">{c.name}</span>
                {c.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
              </div>
              <span className="text-xs text-gray-400">{c.subcategories?.length ?? 0} subcategories</span>
            </div>
            {c.subcategories && c.subcategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 pl-5">
                {c.subcategories.map(s => (
                  <span key={s.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s.name}</span>
                ))}
              </div>
            )}
          </div>
        ))}
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
      </Tabs>
    </div>
  )
}
