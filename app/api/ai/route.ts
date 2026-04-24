import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { format, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'google/gemini-2.0-flash-001'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

async function buildFinancialContext(start: Date, end: Date): Promise<string> {
  // Aggregate by month
  const months = eachMonthOfInterval({ start, end })
  const monthlyRows: string[] = []

  for (const m of months) {
    const mStart = startOfMonth(m)
    const mEnd = endOfMonth(m)
    const txns: { amount: number; direction: string }[] = await prisma.transaction.findMany({
      where: {
        transactionDate: { gte: mStart, lte: mEnd },
        reviewStatus: { not: 'needs_review' },
        direction: { in: ['income', 'expense'] },
      },
      select: { amount: true, direction: true },
    })
    const income = txns.filter((t) => t.direction === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = txns.filter((t) => t.direction === 'expense').reduce((s, t) => s + t.amount, 0)
    const net = income - expenses
    const savingsRate = income > 0 ? ((net / income) * 100).toFixed(1) : '0'
    monthlyRows.push(
      `  ${format(m, 'MMM yyyy')}: income=$${income.toFixed(2)}, expenses=$${expenses.toFixed(2)}, net=$${net.toFixed(2)}, savings_rate=${savingsRate}%`
    )
  }

  // Category totals for full period
  const catTxns: { amount: number; categoryId: string | null }[] = await prisma.transaction.findMany({
    where: {
      transactionDate: { gte: start, lte: end },
      reviewStatus: { not: 'needs_review' },
      direction: 'expense',
    },
    select: { amount: true, categoryId: true },
    orderBy: { amount: 'desc' },
  })

  const totalExpenses = catTxns.reduce((s, t) => s + t.amount, 0)

  const catIds = [...new Set(catTxns.map((t) => t.categoryId).filter(Boolean))] as string[]
  const categories: { id: string; name: string }[] = await prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } })
  const catNameMap: Record<string, string> = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  const catMap: Record<string, number> = {}
  for (const t of catTxns) {
    const name = t.categoryId ? (catNameMap[t.categoryId] ?? 'Uncategorized') : 'Uncategorized'
    catMap[name] = (catMap[name] ?? 0) + t.amount
  }
  const catRows = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amt]) => {
      const pct = totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : '0'
      return `  ${name}: $${amt.toFixed(2)} (${pct}% of expenses)`
    })

  // Top merchants
  const merchantTxns: { merchantName: string | null; amount: number }[] = await prisma.transaction.findMany({
    where: {
      transactionDate: { gte: start, lte: end },
      reviewStatus: { not: 'needs_review' },
      direction: 'expense',
      merchantName: { not: null },
    },
    select: { merchantName: true, amount: true },
  })
  const merchantMap: Record<string, { total: number; count: number }> = {}
  for (const t of merchantTxns) {
    const name = t.merchantName!
    if (!merchantMap[name]) merchantMap[name] = { total: 0, count: 0 }
    merchantMap[name].total += t.amount
    merchantMap[name].count++
  }
  const topMerchants = Object.entries(merchantMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, { total, count }]) => `  ${name}: $${total.toFixed(2)} (${count} transactions)`)

  return `PERIOD: ${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}

MONTHLY SUMMARY:
${monthlyRows.join('\n')}

SPENDING BY CATEGORY (full period):
${catRows.length > 0 ? catRows.join('\n') : '  No categorized expenses'}

TOP MERCHANTS BY SPEND:
${topMerchants.length > 0 ? topMerchants.join('\n') : '  No merchant data'}

TOTAL PERIOD EXPENSES: $${totalExpenses.toFixed(2)}`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 })
  }

  let body: { startDate: string; endDate: string; messages: Message[]; mode: 'report' | 'chat' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { startDate, endDate, messages, mode } = body
  const start = new Date(startDate)
  const end = new Date(endDate)

  let context: string
  try {
    context = await buildFinancialContext(start, end)
  } catch {
    return NextResponse.json({ error: 'Failed to load financial data' }, { status: 500 })
  }

  const systemPrompt = `You are a friendly, practical personal finance advisor. You have been given aggregated (privacy-preserving) financial data - no individual transaction details, just category totals and merchant summaries.

${context}

Your role:
- Analyse spending patterns and identify opportunities to save
- Ask thoughtful questions to better understand the user's goals, lifestyle, and financial situation
- Give specific, actionable advice (not generic platitudes)
- Be encouraging and non-judgmental
- When you notice something unusual or worth exploring, ask a follow-up question
- Use Australian dollars ($AUD) as the currency

${mode === 'report'
  ? `Generate a comprehensive financial analysis report in **Markdown format**.

Use this structure:
## Overview
Brief summary of the period - total income, total expenses, net savings, savings rate.

## Spending Patterns
Breakdown of the main spending categories with notable trends. Use bullet points.

## Key Observations
3–5 specific insights. What stands out? Any unusual spikes? Any positive trends?

## Recommendations
Actionable, numbered steps to improve financial health. Be specific - reference actual categories or amounts.

## Questions for You
End with 2–3 thoughtful questions to better understand the user's goals and context.

Use **bold** for key numbers and figures. Keep sections concise but insightful.`
  : 'You are in chat mode. Keep replies concise and conversational. Use markdown formatting where helpful. Ask one follow-up question at a time.'
}`

  const allMessages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ]

  // For report mode with no messages, add the initial prompt
  if (mode === 'report' && messages.length === 0) {
    allMessages.push({ role: 'user', content: 'Please analyse my finances and provide your recommendations.' })
  }

  try {
    const orResponse = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://finance-tracker.local',
        'X-Title': 'Finance Tracker AI Advisor',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: allMessages,
        stream: true,
        max_tokens: 2048,
      }),
    })

    if (!orResponse.ok) {
      const errText = await orResponse.text()
      return NextResponse.json({ error: `OpenRouter error: ${errText}` }, { status: 502 })
    }

    // Stream the SSE response directly to the client
    return new Response(orResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach AI service' }, { status: 502 })
  }
}
