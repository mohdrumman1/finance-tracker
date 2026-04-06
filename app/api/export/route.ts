import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET() {
  try {
    const [transactions, categories, budgets, goals, accounts, rules] = await Promise.all([
      prisma.transaction.findMany({ orderBy: { transactionDate: 'desc' } }),
      prisma.category.findMany({ include: { subcategories: true } }),
      prisma.budget.findMany(),
      prisma.goal.findMany(),
      prisma.account.findMany(),
      prisma.merchantRule.findMany(),
    ])

    const data = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      merchantRules: rules,
    }

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="finance-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
