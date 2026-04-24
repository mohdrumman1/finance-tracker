'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DollarSign,
  Building2,
  TrendingUp,
  Target,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  MapPin,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AccountDraft {
  name: string
  institution: string
  accountType: 'transaction' | 'savings' | 'credit'
}

interface BudgetDraft {
  categoryName: string
  color: string
  suggested: number
  amount: string
}

interface GoalDraft {
  name: string
  goalType: string
  targetAmount: string
  targetDate: string
}

// ─── Step definitions ────────────────────────────────────────────────────────

const STEPS = [
  { id: 'welcome', label: 'Welcome', icon: DollarSign },
  { id: 'accounts', label: 'Accounts', icon: Building2 },
  { id: 'income', label: 'Income', icon: TrendingUp },
  { id: 'budgets', label: 'Budgets', icon: DollarSign },
  { id: 'goal', label: 'Goal', icon: Target },
  { id: 'done', label: 'Done', icon: CheckCircle2 },
]

const INITIAL_BUDGETS: BudgetDraft[] = [
  { categoryName: 'Groceries', color: '#84cc16', suggested: 600, amount: '600' },
  { categoryName: 'Dining Out', color: '#f97316', suggested: 300, amount: '300' },
  { categoryName: 'Transport', color: '#3b82f6', suggested: 200, amount: '200' },
  { categoryName: 'Entertainment', color: '#a855f7', suggested: 150, amount: '150' },
  { categoryName: 'Health', color: '#ec4899', suggested: 100, amount: '100' },
  { categoryName: 'Utilities', color: '#6366f1', suggested: 250, amount: '250' },
]

const GOAL_TYPES = [
  { value: 'emergency_fund', label: 'Emergency Fund', description: '3–6 months of expenses saved' },
  { value: 'house_deposit', label: 'House Deposit', description: 'Saving for a home purchase' },
  { value: 'debt_payoff', label: 'Debt Payoff', description: 'Pay off credit cards or loans' },
  { value: 'holiday', label: 'Holiday', description: 'Save for a trip or vacation' },
  { value: 'general', label: 'General Savings', description: 'Build up your savings' },
]

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1 – accounts
  const [accounts, setAccounts] = useState<AccountDraft[]>([
    { name: '', institution: '', accountType: 'transaction' },
  ])

  // Step 2 – income
  const [monthlyIncome, setMonthlyIncome] = useState('')

  // Step 3 – budgets
  const [budgets, setBudgets] = useState<BudgetDraft[]>(INITIAL_BUDGETS)
  const [city, setCity] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiNote, setAiNote] = useState('')

  // Step 4 – goal
  const [goal, setGoal] = useState<GoalDraft>({
    name: '',
    goalType: 'emergency_fund',
    targetAmount: '',
    targetDate: '',
  })

  // ── account helpers
  function updateAccount(i: number, field: keyof AccountDraft, value: string) {
    setAccounts((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)))
  }
  function addAccount() {
    setAccounts((prev) => [...prev, { name: '', institution: '', accountType: 'transaction' }])
  }
  function removeAccount(i: number) {
    setAccounts((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── budget helpers
  function updateBudget(i: number, value: string) {
    setBudgets((prev) => prev.map((b, idx) => (idx === i ? { ...b, amount: value } : b)))
  }

  async function suggestBudgets() {
    if (!city.trim()) return
    setAiLoading(true)
    setAiNote('')
    try {
      const res = await fetch('/api/ai/budget-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: city.trim(),
          income: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
          categories: budgets.map((b) => b.categoryName),
        }),
      })
      const data = await res.json()
      if (data.amounts) {
        setBudgets((prev) =>
          prev.map((b) =>
            data.amounts[b.categoryName] != null
              ? { ...b, amount: String(data.amounts[b.categoryName]) }
              : b
          )
        )
        setAiNote(`Suggestions loaded for ${city.trim()}. Feel free to adjust.`)
      }
    } catch {
      setAiNote("Couldn't fetch AI suggestions. Using defaults.")
    } finally {
      setAiLoading(false)
    }
  }

  // ── navigation
  function next() { setStep((s) => Math.min(s + 1, STEPS.length - 1)) }
  function back() { setStep((s) => Math.max(s - 1, 0)) }

  // ── final submit
  async function finish() {
    setSaving(true)
    setError('')
    try {
      // 1. Create accounts
      const validAccounts = accounts.filter((a) => a.name.trim())
      for (const acct of validAccounts) {
        await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(acct),
        })
      }

      // 2. Save monthly income + city as app settings
      const settingsPayload: Record<string, string> = {}
      if (monthlyIncome) settingsPayload.monthlyIncome = monthlyIncome
      if (city.trim()) settingsPayload.city = city.trim()
      if (Object.keys(settingsPayload).length > 0) {
        await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsPayload),
        })
      }

      // 3. Create categories + budgets in parallel
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      await Promise.all(
        budgets
          .filter((b) => b.amount && parseFloat(b.amount) > 0)
          .map(async (b) => {
            const catRes = await fetch('/api/categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: b.categoryName, color: b.color }),
            })
            if (catRes.ok) {
              const cat = await catRes.json()
              await fetch('/api/budgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryId: cat.id, amount: parseFloat(b.amount), year, month }),
              })
            }
          })
      )

      // 4. Create goal
      if (goal.name && goal.targetAmount) {
        await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: goal.name,
            goalType: goal.goalType,
            targetAmount: parseFloat(goal.targetAmount),
            targetDate: goal.targetDate || undefined,
          }),
        })
      }

      // 5. Mark onboarding complete + refresh cookie
      await fetch('/api/auth/complete-onboarding', { method: 'POST' })

      next() // go to done step
    } catch {
      setError('Something went wrong. You can continue to the dashboard and set these up later.')
    } finally {
      setSaving(false)
    }
  }

  async function goToDashboard() {
    await fetch('/api/auth/complete-onboarding', { method: 'POST' })
    router.push('/dashboard')
  }

  // ── render
  const currentStep = STEPS[step]

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600">
          <DollarSign className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-white text-sm">Monyze</span>
      </div>

      {/* Step progress */}
      <div className="flex items-center justify-center gap-2 py-6 px-4">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors ${
                i < step
                  ? 'bg-indigo-600 text-white'
                  : i === step
                  ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/20'
                  : 'bg-gray-800 text-gray-500'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 ${i < step ? 'bg-indigo-600' : 'bg-gray-800'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-lg">

          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mx-auto mb-6">
                <DollarSign className="w-9 h-9 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-3">Welcome to Monyze</h1>
              <p className="text-gray-400 mb-4 leading-relaxed">
                Let&apos;s get you set up in under 2 minutes. After setup, you&apos;ll import your bank CSV to start tracking.
              </p>
              <ul className="text-left bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3 mb-8">
                {[
                  ['📥', 'Import your bank transactions', 'Download a CSV from your bank - Monyze reads it instantly'],
                  ['🏦', 'Connect your bank accounts', 'Track all your money in one place'],
                  ['💰', 'Set a monthly budget', 'Know exactly where your money goes'],
                  ['🎯', 'Define a financial goal', 'Stay motivated and build wealth'],
                  ['📊', 'Get AI-powered insights', 'Spot trends and opportunities to save'],
                ].map(([icon, title, desc]) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{title}</p>
                      <p className="text-gray-500 text-xs">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                onClick={next}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              >
                Let&apos;s get started <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Step 1: Accounts ── */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Add your accounts</h2>
              <p className="text-gray-400 text-sm mb-6">
                Add the bank accounts and cards you want to track. You can add more later.
              </p>
              <div className="space-y-4 mb-4">
                {accounts.map((acct, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-300">Account {i + 1}</span>
                      {accounts.length > 1 && (
                        <button
                          onClick={() => removeAccount(i)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <input
                      placeholder="Account name (e.g. Everyday Account)"
                      value={acct.name}
                      onChange={(e) => updateAccount(i, 'name', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <input
                      placeholder="Bank / Institution (e.g. CommBank)"
                      value={acct.institution}
                      onChange={(e) => updateAccount(i, 'institution', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                      value={acct.accountType}
                      onChange={(e) => updateAccount(i, 'accountType', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="transaction">Transaction / Checking</option>
                      <option value="savings">Savings</option>
                      <option value="credit">Credit Card</option>
                    </select>
                  </div>
                ))}
              </div>
              <button
                onClick={addAccount}
                className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 mb-8 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add another account
              </button>
              <StepNav onBack={back} onNext={next} nextLabel="Continue" />
            </div>
          )}

          {/* ── Step 2: Income ── */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Your monthly income</h2>
              <p className="text-gray-400 text-sm mb-6">
                This helps us suggest sensible budgets and track your savings rate.
              </p>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Monthly take-home income (AUD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                  <input
                    type="number"
                    placeholder="5000"
                    min="0"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white text-lg font-medium placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                {monthlyIncome && (
                  <p className="mt-3 text-xs text-gray-500">
                    Based on the 50/30/20 rule:{' '}
                    <span className="text-gray-300">${(parseFloat(monthlyIncome) * 0.5).toFixed(0)} needs</span>,{' '}
                    <span className="text-gray-300">${(parseFloat(monthlyIncome) * 0.3).toFixed(0)} wants</span>,{' '}
                    <span className="text-gray-300">${(parseFloat(monthlyIncome) * 0.2).toFixed(0)} savings</span>
                  </p>
                )}
              </div>
              <StepNav onBack={back} onNext={next} nextLabel="Continue" />
            </div>
          )}

          {/* ── Step 3: Budgets ── */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Set monthly budgets</h2>
              <p className="text-gray-400 text-sm mb-6">
                Enter your city to get AI-powered cost-of-living suggestions, or adjust manually.
              </p>

              {/* City input + AI suggest */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5">
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> City or Town
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Sydney, Melbourne, Brisbane…"
                    value={city}
                    onChange={(e) => { setCity(e.target.value); setAiNote('') }}
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={suggestBudgets}
                    disabled={!city.trim() || aiLoading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shrink-0"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiLoading ? 'Loading…' : 'Suggest'}
                  </button>
                </div>
                {aiNote && (
                  <p className="mt-2 text-xs text-indigo-400">{aiNote}</p>
                )}
              </div>

              <div className="space-y-3 mb-8">
                {budgets.map((b, i) => (
                  <div key={b.categoryName} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                    <span className="text-sm text-white flex-1">{b.categoryName}</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        value={b.amount}
                        onChange={(e) => updateBudget(i, e.target.value)}
                        className="w-24 pl-6 pr-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <StepNav onBack={back} onNext={next} nextLabel="Continue" />
            </div>
          )}

          {/* ── Step 4: Goal ── */}
          {step === 4 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Set a financial goal</h2>
              <p className="text-gray-400 text-sm mb-6">
                Having a goal keeps you motivated. You can always add more goals later.
              </p>
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">What type of goal?</label>
                  <div className="grid grid-cols-1 gap-2">
                    {GOAL_TYPES.map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setGoal((prev) => ({ ...prev, goalType: g.value }))}
                        className={`flex items-start gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
                          goal.goalType === g.value
                            ? 'border-indigo-500 bg-indigo-600/10 text-white'
                            : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{g.label}</p>
                          <p className="text-xs text-gray-500">{g.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Goal name</label>
                  <input
                    placeholder={GOAL_TYPES.find((g) => g.value === goal.goalType)?.label ?? 'My goal'}
                    value={goal.name}
                    onChange={(e) => setGoal((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Target amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        placeholder="10000"
                        min="0"
                        value={goal.targetAmount}
                        onChange={(e) => setGoal((prev) => ({ ...prev, targetAmount: e.target.value }))}
                        className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Target date (optional)</label>
                    <input
                      type="date"
                      value={goal.targetDate}
                      onChange={(e) => setGoal((prev) => ({ ...prev, targetDate: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              <StepNav
                onBack={back}
                onNext={finish}
                nextLabel={saving ? 'Saving…' : 'Finish setup'}
                nextIcon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                disabled={saving}
              />
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {step === 5 && (
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 mx-auto mb-6">
                <CheckCircle2 className="w-9 h-9 text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">You&apos;re all set! 🎉</h2>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Your account is ready. <strong className="text-white">Your first step is to import your bank transactions</strong> - without them, the dashboard will be empty.
              </p>
              <button
                onClick={() => router.push('/imports')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors mb-4"
              >
                📥 Import Transactions - Start Here <ChevronRight className="w-4 h-4" />
              </button>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-left space-y-3 mb-6">
                <p className="text-sm font-semibold text-gray-300">More to explore</p>
                {[
                  ['📊', 'View your dashboard', 'See your financial overview', '/dashboard'],
                  ['🎯', 'Check your goals', 'Track progress toward your targets', '/goals'],
                  ['💰', 'Set up budgets', 'Adjust your monthly spending limits', '/budgets'],
                ].map(([icon, title, desc, href]) => (
                  <a
                    key={href}
                    href={href}
                    onClick={() => router.push(href)}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <span className="text-lg">{icon}</span>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium group-hover:text-indigo-400 transition-colors">{title}</p>
                      <p className="text-gray-500 text-xs">{desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-indigo-400 transition-colors mt-0.5" />
                  </a>
                ))}
              </div>
              <button
                onClick={goToDashboard}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-sm font-medium transition-colors"
              >
                Skip to Dashboard <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ─── Step Nav Helper ─────────────────────────────────────────────────────────

function StepNav({
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextIcon,
  disabled = false,
}: {
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  nextIcon?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm font-medium transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <button
        onClick={onNext}
        disabled={disabled}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
      >
        {nextIcon}
        {nextLabel}
        {!nextIcon && <ChevronRight className="w-4 h-4" />}
      </button>
    </div>
  )
}
