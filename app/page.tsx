'use client'

import Link from 'next/link'
import {
  BarChart3,
  Brain,
  Shield,
  Zap,
  TrendingUp,
  Upload,
  Target,
  ArrowRight,
  Check,
  Sparkles,
  DollarSign,
  ChevronRight,
} from 'lucide-react'

const features = [
  {
    icon: Upload,
    title: 'Bank Statement Import',
    description: 'Drop in your CSV from CommBank, Amex, or any bank. Monyze parses it instantly with zero manual entry.',
    color: 'from-violet-500 to-indigo-500',
  },
  {
    icon: Brain,
    title: 'AI Auto-Categorisation',
    description: 'Every transaction is sorted automatically. Uber Eats goes to Eating Out, Woolworths to Groceries — without you lifting a finger.',
    color: 'from-pink-500 to-rose-500',
  },
  {
    icon: BarChart3,
    title: 'Visual Spending Insights',
    description: 'See exactly where your money goes each month with clean charts, trends, and breakdowns by category.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Target,
    title: 'Budget Tracking',
    description: 'Set monthly budgets per category and get alerted before you overspend. Stay on track every single month.',
    color: 'from-emerald-500 to-teal-500',
  },
  {
    icon: TrendingUp,
    title: 'Financial Goals',
    description: 'Planning a holiday, paying off debt, or building an emergency fund? Set a goal and watch your progress in real time.',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: Sparkles,
    title: 'AI Financial Advisor',
    description: 'Ask anything about your money. Get personalised advice based on your actual spending, not generic tips.',
    color: 'from-purple-500 to-violet-500',
  },
]

const differentiators = [
  {
    icon: Zap,
    title: 'Built for Australians',
    description: 'Native support for CommBank, ANZ, Westpac, NAB, and Amex formats. No awkward workarounds.',
  },
  {
    icon: Shield,
    title: 'Your data stays yours',
    description: 'No third-party bank connections. You import your own statements. Nothing leaves without your say.',
  },
  {
    icon: Brain,
    title: 'Actually intelligent',
    description: 'Most trackers make you categorise manually. Monyze learns your merchants and does it for you.',
  },
  {
    icon: BarChart3,
    title: 'No noise, just clarity',
    description: 'A clean dashboard that shows what matters. No bloat, no confusing graphs, no clutter.',
  },
]

const stats = [
  { value: '100%', label: 'Private by design' },
  { value: 'AI', label: 'Powered categorisation' },
  { value: '0', label: 'Manual entry required' },
  { value: 'Free', label: 'To get started' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-delay { animation: float 6s ease-in-out infinite 2s; }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient-shift 5s ease infinite;
        }
        .animate-slide-up { animation: slide-up 0.6s ease-out forwards; }
        .gradient-text {
          background: linear-gradient(135deg, #a78bfa, #6366f1, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .card-hover {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(99, 102, 241, 0.15);
        }
      `}</style>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-gray-950/80 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600">
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Monyze</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 flex flex-col items-center text-center overflow-hidden">
        {/* Background orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl animate-pulse-slow pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-80 h-80 rounded-full bg-violet-600/15 blur-3xl animate-pulse-slow pointer-events-none" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-64 rounded-full bg-indigo-900/30 blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium px-4 py-1.5 rounded-full mb-8">
            <Sparkles className="w-3 h-3" />
            AI-powered personal finance, built for Australians
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-tight tracking-tight mb-6">
            Your money,{' '}
            <span className="gradient-text">finally</span>
            <br />
            under control
          </h1>

          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Import your bank statements, let AI do the categorisation, and see exactly where every dollar goes — without connecting your bank or paying a subscription.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/auth/register"
              className="group inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-4 rounded-xl transition-all text-base shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40"
            >
              Start for free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-xl transition-all text-base"
            >
              Sign in to your account
            </Link>
          </div>

          {/* Dashboard mockup */}
          <div className="relative mx-auto max-w-3xl animate-float">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-indigo-500/20 to-transparent blur-2xl -z-10" />
            <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              {/* Mockup header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/60 border-b border-white/5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="text-xs text-gray-500 ml-2">app.monyze.vercel.app/dashboard</span>
              </div>
              {/* Mockup body */}
              <div className="p-5 grid grid-cols-3 gap-4">
                {/* Balance card */}
                <div className="col-span-3 sm:col-span-1 bg-indigo-600/20 border border-indigo-500/20 rounded-xl p-4">
                  <p className="text-xs text-indigo-300 mb-1">Total Balance</p>
                  <p className="text-2xl font-bold text-white">$12,480</p>
                  <p className="text-xs text-emerald-400 mt-1">+$320 this month</p>
                </div>
                <div className="col-span-3 sm:col-span-1 bg-white/5 border border-white/5 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Monthly Spend</p>
                  <p className="text-2xl font-bold text-white">$3,241</p>
                  <p className="text-xs text-red-400 mt-1">78% of budget</p>
                </div>
                <div className="col-span-3 sm:col-span-1 bg-white/5 border border-white/5 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Goal Progress</p>
                  <p className="text-2xl font-bold text-white">64%</p>
                  <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '64%' }} />
                  </div>
                </div>
                {/* Mini chart */}
                <div className="col-span-3 bg-white/5 border border-white/5 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-3">Spending by category</p>
                  <div className="flex items-end gap-2 h-16">
                    {[65, 90, 45, 78, 55, 82, 38, 70, 60, 88, 42, 75].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{
                          height: `${h}%`,
                          background: i % 3 === 0 ? '#6366f1' : i % 3 === 1 ? '#8b5cf6' : '#4f46e5',
                          opacity: 0.7 + (i % 3) * 0.1,
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between mt-2">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => (
                      <span key={m} className="text-xs text-gray-600">{m}</span>
                    ))}
                  </div>
                </div>
                {/* Recent transactions */}
                <div className="col-span-3 bg-white/5 border border-white/5 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-3">Recent transactions</p>
                  <div className="space-y-2">
                    {[
                      { name: 'Woolworths', cat: 'Groceries', amount: '-$87.40', color: 'bg-emerald-500' },
                      { name: 'Uber Eats', cat: 'Eating Out', amount: '-$34.90', color: 'bg-orange-500' },
                      { name: 'Salary', cat: 'Income', amount: '+$5,000', color: 'bg-indigo-500' },
                    ].map((tx) => (
                      <div key={tx.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg ${tx.color} opacity-80 flex items-center justify-center`}>
                            <DollarSign className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-white">{tx.name}</p>
                            <p className="text-xs text-gray-500">{tx.cat}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold ${tx.amount.startsWith('+') ? 'text-emerald-400' : 'text-gray-300'}`}>
                          {tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold gradient-text mb-1">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Everything you need,{' '}
              <span className="gradient-text">nothing you don't</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Monyze strips out the noise and gives you a clear, honest picture of your financial life.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className="card-hover bg-gray-900 border border-white/5 rounded-2xl p-6"
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 opacity-90`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Why Monyze */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Why Monyze is{' '}
              <span className="gradient-text">different</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Most finance apps connect to your bank, show you pretty graphs, then charge you monthly. Monyze takes a different approach.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {differentiators.map((d) => {
              const Icon = d.icon
              return (
                <div key={d.title} className="card-hover flex gap-4 bg-gray-900 border border-white/5 rounded-2xl p-6">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{d.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{d.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold tracking-tight mb-4">
              How we stack up
            </h2>
            <p className="text-gray-400">Against the other options out there.</p>
          </div>

          <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-3 text-sm font-semibold border-b border-white/5">
              <div className="p-4 text-gray-400">Feature</div>
              <div className="p-4 text-center text-indigo-400 bg-indigo-600/10">Monyze</div>
              <div className="p-4 text-center text-gray-500">Others</div>
            </div>
            {[
              ['AI auto-categorisation', true, false],
              ['Australian bank formats', true, false],
              ['No bank login required', true, false],
              ['Free to use', true, false],
              ['Financial goals', true, true],
              ['Budget tracking', true, true],
              ['AI advisor', true, false],
            ].map(([label, us, them]) => (
              <div key={String(label)} className="grid grid-cols-3 text-sm border-b border-white/5 last:border-0">
                <div className="p-4 text-gray-300">{label}</div>
                <div className="p-4 flex justify-center bg-indigo-600/5">
                  {us ? (
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </div>
                <div className="p-4 flex justify-center">
                  {them ? (
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10">
                      <Check className="w-3 h-3 text-emerald-400/60" />
                    </span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-violet-600/20 to-indigo-600/20 blur-3xl rounded-full pointer-events-none" />
          <div className="relative bg-gray-900 border border-white/10 rounded-3xl px-8 py-16">
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Ready to own{' '}
              <span className="gradient-text">your money?</span>
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-lg mx-auto">
              Takes 2 minutes to set up. No credit card. No bank login. Just clarity.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/register"
                className="group inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40"
              >
                Create free account
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-xl transition-all"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-600">
            <DollarSign className="w-3 h-3 text-white" />
          </div>
          <span className="font-bold text-sm">Monyze</span>
        </div>
        <p className="text-xs text-gray-600">Your personal finance dashboard. Built for clarity, not clutter.</p>
      </footer>
    </div>
  )
}
