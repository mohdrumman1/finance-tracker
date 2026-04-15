import { prisma } from '../db/client'
import {
  getMonthStart,
  getMonthEnd,
  getDaysElapsedInMonth,
  getDaysInCurrentMonth,
} from '../utils/dateUtils'

export interface BudgetActual {
  id: string
  categoryId: string
  categoryName: string
  categoryColor: string
  budgetAmount: number
  actualAmount: number
  remaining: number
  percentUsed: number
  pacingStatus: 'on_track' | 'at_risk' | 'over_budget'
}

export class BudgetService {
  async getBudgetsForMonth(year: number, month: number): Promise<BudgetActual[]> {
    const start = getMonthStart(year, month)
    const end = getMonthEnd(year, month)
    const today = new Date()
    const refDate = today < end ? today : end

    const daysElapsed = getDaysElapsedInMonth(refDate)
    const daysInMonth = getDaysInCurrentMonth(new Date(year, month - 1, 1))

    const budgets = await prisma.budget.findMany({
      where: { year, month, period: 'monthly' },
      include: { category: true },
    })

    const results: BudgetActual[] = []

    for (const budget of budgets) {
      const aggregate = await prisma.transaction.aggregate({
        where: {
          categoryId: budget.categoryId,
          direction: 'expense',
          transactionDate: { gte: start, lte: end },
          isExcludedFromBudget: false,
        },
        _sum: { amount: true },
      })

      const actual = parseFloat((aggregate._sum.amount ?? 0).toFixed(2))
      const remaining = parseFloat((budget.amount - actual).toFixed(2))
      const percentUsed = budget.amount > 0 ? parseFloat(((actual / budget.amount) * 100).toFixed(2)) : 0

      // Pacing: at_risk if actual > (budget * daysElapsed / daysInMonth * 1.1)
      const pacingLimit = (budget.amount * daysElapsed) / daysInMonth * 1.1
      let pacingStatus: 'on_track' | 'at_risk' | 'over_budget'
      if (actual > budget.amount) {
        pacingStatus = 'over_budget'
      } else if (actual > pacingLimit) {
        pacingStatus = 'at_risk'
      } else {
        pacingStatus = 'on_track'
      }

      results.push({
        id: budget.id,
        categoryId: budget.categoryId,
        categoryName: budget.category.name,
        categoryColor: budget.category.color,
        budgetAmount: budget.amount,
        actualAmount: actual,
        remaining,
        percentUsed,
        pacingStatus,
      })
    }

    return results
  }

  async setBudget(
    categoryId: string,
    amount: number,
    year: number,
    month: number
  ): Promise<void> {
    await prisma.budget.upsert({
      where: {
        categoryId_period_year_month: {
          categoryId,
          period: 'monthly',
          year,
          month,
        },
      },
      update: { amount, updatedAt: new Date() },
      create: { categoryId, amount, period: 'monthly', year, month },
    })
  }

  async copyPreviousMonthBudgets(year: number, month: number): Promise<void> {
    let prevYear = year
    let prevMonth = month - 1
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear = year - 1
    }

    const prevBudgets = await prisma.budget.findMany({
      where: { year: prevYear, month: prevMonth, period: 'monthly' },
    })

    for (const budget of prevBudgets) {
      await prisma.budget.upsert({
        where: {
          categoryId_period_year_month: {
            categoryId: budget.categoryId,
            period: 'monthly',
            year,
            month,
          },
        },
        update: { amount: budget.amount, updatedAt: new Date() },
        create: {
          categoryId: budget.categoryId,
          amount: budget.amount,
          period: 'monthly',
          year,
          month,
        },
      })
    }
  }
}
