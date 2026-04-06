import { prisma } from '../db/client'
import {
  getMonthStart,
  getMonthEnd,
  getDaysRemainingInMonth,
  getDaysElapsedInMonth,
} from '../utils/dateUtils'
import { subDays } from 'date-fns'

export interface MonthForecast {
  projectedTotalSpend: number
  projectedIncome: number
  projectedSavings: number
  projectedSavingsRate: number
  categoryForecasts: { categoryId: string; categoryName: string; projected: number }[]
  daysRemaining: number
  basedOnDays: number
}

export class ForecastService {
  async forecastCurrentMonth(): Promise<MonthForecast> {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    const monthStart = getMonthStart(year, month)
    const monthEnd = getMonthEnd(year, month)

    const daysElapsed = getDaysElapsedInMonth(today)
    const daysRemaining = getDaysRemainingInMonth(today)
    const basedOnDays = 30

    // Get actual spend to date this month
    const currentMonthTransactions = await prisma.transaction.findMany({
      where: {
        transactionDate: { gte: monthStart, lte: today },
        reviewStatus: { not: 'needs_review' },
      },
      include: { category: true },
    })

    const actualSpendToDate = currentMonthTransactions
      .filter((t) => t.direction === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    const actualIncomeToDate = currentMonthTransactions
      .filter((t) => t.direction === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    // Compute daily spend rate from last 30 days
    const thirtyDaysAgo = subDays(today, basedOnDays)
    const last30DaysTx = await prisma.transaction.findMany({
      where: {
        transactionDate: { gte: thirtyDaysAgo, lte: today },
        direction: 'expense',
        reviewStatus: { not: 'needs_review' },
      },
      include: { category: true },
    })

    const dailySpendRate = last30DaysTx.reduce((sum, t) => sum + t.amount, 0) / basedOnDays

    // Category-level forecasts
    const categorySpend = new Map<string, { name: string; amount: number }>()

    for (const tx of last30DaysTx) {
      if (!tx.categoryId || !tx.category) continue
      const existing = categorySpend.get(tx.categoryId) ?? { name: tx.category.name, amount: 0 }
      existing.amount += tx.amount
      categorySpend.set(tx.categoryId, existing)
    }

    const categoryForecasts: { categoryId: string; categoryName: string; projected: number }[] = []

    for (const [categoryId, data] of categorySpend.entries()) {
      const dailyRate = data.amount / basedOnDays
      const actualCategoryToDate = currentMonthTransactions
        .filter((t) => t.direction === 'expense' && t.categoryId === categoryId)
        .reduce((sum, t) => sum + t.amount, 0)

      const projected = Math.max(0, parseFloat(
        (actualCategoryToDate + dailyRate * daysRemaining).toFixed(2)
      ))

      categoryForecasts.push({
        categoryId,
        categoryName: data.name,
        projected,
      })
    }

    // Check for recurring transactions not yet seen this month
    const recurringTransactions = await prisma.transaction.findMany({
      where: {
        isRecurring: true,
        transactionDate: {
          gte: subDays(monthStart, 33),
          lte: subDays(monthStart, 27),
        },
        direction: 'expense',
      },
    })

    let recurringAddition = 0
    for (const recurring of recurringTransactions) {
      // Check if it appeared this month already
      const thisMonthOccurrence = await prisma.transaction.findFirst({
        where: {
          accountId: recurring.accountId,
          merchantName: recurring.merchantName,
          amount: recurring.amount,
          transactionDate: { gte: monthStart, lte: monthEnd },
        },
      })

      if (!thisMonthOccurrence) {
        recurringAddition += recurring.amount
      }
    }

    const projectedTotalSpend = Math.max(
      0,
      parseFloat((actualSpendToDate + dailySpendRate * daysRemaining + recurringAddition).toFixed(2))
    )

    const incomeRate = daysElapsed > 0 ? actualIncomeToDate / daysElapsed : 0
    const projectedIncome = Math.max(
      0,
      parseFloat((actualIncomeToDate + incomeRate * daysRemaining).toFixed(2))
    )

    const projectedSavings = parseFloat((projectedIncome - projectedTotalSpend).toFixed(2))
    const projectedSavingsRate =
      projectedIncome > 0
        ? parseFloat(((projectedSavings / projectedIncome) * 100).toFixed(2))
        : 0

    return {
      projectedTotalSpend,
      projectedIncome,
      projectedSavings,
      projectedSavingsRate,
      categoryForecasts,
      daysRemaining,
      basedOnDays,
    }
  }
}
