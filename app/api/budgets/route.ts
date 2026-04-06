import { NextRequest, NextResponse } from 'next/server'
import { BudgetService } from '@/lib/budgets/BudgetService'

const budgetService = new BudgetService()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

    const budgets = await budgetService.getBudgetsForMonth(year, month)
    return NextResponse.json(budgets)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { categoryId, amount, year, month, copyPrevious } = body

    if (copyPrevious) {
      await budgetService.copyPreviousMonthBudgets(year, month)
      return NextResponse.json({ success: true })
    }

    if (!categoryId || amount === undefined || !year || !month) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await budgetService.setBudget(categoryId, amount, year, month)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to set budget' }, { status: 500 })
  }
}
