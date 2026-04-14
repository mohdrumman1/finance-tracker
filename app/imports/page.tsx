'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertTriangle, ChevronRight, X } from 'lucide-react'
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
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge'
import { AmountDisplay } from '@/components/shared/AmountDisplay'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { format } from 'date-fns'

interface PreviewTransaction {
  id?: string
  transactionDate: string
  descriptionRaw: string
  merchantName?: string
  amount: number
  direction: 'income' | 'expense' | 'transfer'
  category?: { name: string; color: string }
  confidenceScore: number
  reviewStatus?: string
  isDuplicate?: boolean
  _source?: string // filename, added client-side
}

interface ImportResult {
  imported: number
  duplicates: number
  errors: number
}

interface FileEntry {
  id: string
  file: File
  profileId: string
}

const BANK_PROFILES = [
  { id: 'commbank', label: 'Commonwealth Bank (CBA)' },
  { id: 'amex', label: 'American Express' },
  { id: 'generic', label: 'Generic CSV' },
]

type Step = 1 | 2 | 3

let nextId = 1

export default function ImportsPage() {
  const [step, setStep] = useState<Step>(1)
  const [dragging, setDragging] = useState(false)
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([])
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<PreviewTransaction[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function addFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles).filter((f) => f.name.endsWith('.csv'))
    if (arr.length === 0) {
      setError('Please select .csv files only')
      return
    }
    setError(null)
    setFileEntries((prev) => [
      ...prev,
      ...arr.map((f) => ({ id: String(nextId++), file: f, profileId: 'commbank' })),
    ])
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  function removeFile(id: string) {
    setFileEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function setProfile(id: string, profileId: string) {
    setFileEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, profileId } : e))
    )
  }

  async function previewOne(entry: FileEntry): Promise<PreviewTransaction[]> {
    const formData = new FormData()
    formData.append('file', entry.file)
    formData.append('profileId', entry.profileId)
    formData.append('accountId', 'default')
    formData.append('mode', 'preview')
    const res = await fetch('/api/import', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? `Preview failed for ${entry.file.name}`)
    const txns: PreviewTransaction[] = data.transactions ?? []
    return txns.map((t) => ({ ...t, _source: entry.file.name }))
  }

  async function handlePreview() {
    if (fileEntries.length === 0) return
    setPreviewing(true)
    setError(null)
    try {
      const results = await Promise.all(fileEntries.map(previewOne))
      setPreview(results.flat())
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  async function importOne(entry: FileEntry): Promise<{ imported: number; duplicatesSkipped: number }> {
    const formData = new FormData()
    formData.append('file', entry.file)
    formData.append('profileId', entry.profileId)
    formData.append('accountId', 'default')
    formData.append('mode', 'confirm')
    const res = await fetch('/api/import', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? `Import failed for ${entry.file.name}`)
    return {
      imported: data.transactions?.length ?? data.totalRows ?? 0,
      duplicatesSkipped: data.duplicatesSkipped ?? 0,
    }
  }

  async function handleImport() {
    if (fileEntries.length === 0) return
    setImporting(true)
    setError(null)
    try {
      const results = await Promise.all(fileEntries.map(importOne))
      setResult({
        imported: results.reduce((s, r) => s + r.imported, 0),
        duplicates: results.reduce((s, r) => s + r.duplicatesSkipped, 0),
        errors: 0,
      })
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setStep(1)
    setFileEntries([])
    setPreview([])
    setResult(null)
    setError(null)
  }

  const duplicateCount = preview.filter((t) => t.isDuplicate).length
  const reviewCount = preview.filter((t) => t.reviewStatus === 'needs_review').length
  const multiSource = new Set(preview.map((t) => t._source)).size > 1

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['Upload', 'Preview', 'Done'] as const).map((label, idx) => {
          const num = (idx + 1) as Step
          const active = step === num
          const done = step > num
          return (
            <React.Fragment key={label}>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  done
                    ? 'bg-green-100 text-green-700'
                    : active
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {done ? <CheckCircle className="w-3.5 h-3.5" /> : <span>{num}</span>}
                {label}
              </div>
              {idx < 2 && <ChevronRight className="w-4 h-4 text-gray-300" />}
            </React.Fragment>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragging
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-gray-400" />
                <p className="font-medium text-gray-700">Drop CSV files here</p>
                <p className="text-sm text-gray-400">or click to browse — multiple files supported</p>
              </div>
            </div>

            {/* File list */}
            {fileEntries.length > 0 && (
              <div className="space-y-2">
                {fileEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{entry.file.name}</p>
                      <p className="text-xs text-gray-400">{(entry.file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Select value={entry.profileId} onValueChange={(v) => setProfile(entry.id, v)}>
                      <SelectTrigger className="w-48 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BANK_PROFILES.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(entry.id) }}
                      className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handlePreview} disabled={fileEntries.length === 0 || previewing}>
                {previewing ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Parsing...
                  </span>
                ) : (
                  `Preview Import${fileEntries.length > 1 ? ` (${fileEntries.length} files)` : ''}`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview ({preview.length} transactions)</CardTitle>
              <div className="flex gap-2">
                {duplicateCount > 0 && (
                  <Badge variant="warning">{duplicateCount} duplicates</Badge>
                )}
                {reviewCount > 0 && (
                  <Badge variant="destructive">{reviewCount} need review</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Merchant</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Confidence</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    {multiSource && (
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Source</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((t, i) => {
                    const isReview = t.reviewStatus === 'needs_review'
                    const isDup = t.isDuplicate
                    return (
                      <tr
                        key={i}
                        className={`${
                          isDup
                            ? 'bg-gray-50 opacity-60'
                            : isReview
                            ? 'bg-amber-50'
                            : 'hover:bg-gray-50'
                        } transition-colors`}
                      >
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                          {format(new Date(t.transactionDate), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-2.5 text-gray-900 max-w-[180px] truncate">
                          {t.merchantName ?? t.descriptionRaw}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <AmountDisplay amount={t.amount} direction={t.direction} />
                        </td>
                        <td className="px-4 py-2.5">
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
                        <td className="px-4 py-2.5 text-center">
                          <ConfidenceBadge score={t.confidenceScore} />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {isDup ? (
                            <Badge variant="secondary">Duplicate</Badge>
                          ) : isReview ? (
                            <Badge variant="warning">Review</Badge>
                          ) : (
                            <Badge variant="success">Ready</Badge>
                          )}
                        </td>
                        {multiSource && (
                          <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[120px] truncate">
                            {t._source}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <Button variant="outline" onClick={reset}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing || preview.filter((t) => !t.isDuplicate).length === 0}>
                {importing ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Importing...
                  </span>
                ) : (
                  `Import ${preview.filter((t) => !t.isDuplicate).length} Transactions`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Done */}
      {step === 3 && result && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <CheckCircle className="w-16 h-16 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-800">Import Complete!</h2>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-green-600">{result.imported}</div>
                <div className="text-sm text-gray-500">Imported</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-400">{result.duplicates}</div>
                <div className="text-sm text-gray-500">Duplicates Skipped</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-red-500">{result.errors}</div>
                <div className="text-sm text-gray-500">Errors</div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button variant="outline" onClick={reset}>
                Import More
              </Button>
              <Button onClick={() => window.location.href = '/review'}>
                Review Transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
