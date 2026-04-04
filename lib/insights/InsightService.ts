import { prisma } from '../db/client'
import { getMonthStart, getMonthEnd } from '../utils/dateUtils'
import { subMonths, subDays } from 'date-fns'

export interface Insight {
  id: string
  type: 'trend' | 'anomaly' | 'recurring' | 'goal' | 'hygiene'
  severity: 'info' | 'warning' | 'alert'
  title: string
  body: string
  estimatedImpact: string | null
  suggestedAction: string | null
}

export class InsightService {
  async generateInsights(year: number, month: number): Promise<Insight[]> {
    const insights: Insight[] = []
    const start = getMonthStart(year, month)
    const end = getMonthEnd(year, month)

    const prevDate = subMonths(new Date(year, month - 1, 1), 1)
    const prevStart = getMonthStart(prevDate.getFullYear(), prevDate.getMonth() + 1)
    const prevEnd = getMonthEnd(prevDate.getFullYear(), prevDate.getMonth() + 1)

    // Get this month's transactions
    const thisMonthtx = await prisma.transaction.findMany({
      where: {
        transactionDate: { gte: start, lte: end },
        reviewStatus: { not: 'needs_review' },
      },
      include: { category: true },
    })

    // Get previous month's transactions
    const prevMonthtx = await prisma.transaction.findMany({
      where: {
        transactionDate: { gte: prevStart, lte: prevEnd },
        reviewStatus: { not: 'needs_review' },
      },
      include: { category: true },
    })

    const thisExpenses = thisMonthtx.filter((t) => t.direction === 'expense')
    const prevExpenses = prevMonthtx.filter((t) => t.direction === 'expense')
    const thisIncome = thisMonthtx.filter((t) => t.direction === 'income')

    const totalThisExpense = thisExpenses.reduce((s, t) => s + t.amount, 0)
    const totalPrevExpense = prevExpenses.reduce((s, t) => s + t.amount, 0)
    const totalThisIncome = thisIncome.reduce((s, t) => s + t.amount, 0)

    // 1. Discretionary spend up >15% vs prior month
    const discretionaryCategories = ['Eating Out', 'Entertainment', 'Shopping', 'Travel']
    const thisDiscretionary = thisExpenses
      .filter((t) => t.category && discretionaryCategories.includes(t.category.name))
      .reduce((s, t) => s + t.amount, 0)
    const prevDiscretionary = prevExpenses
      .filter((t) => t.category && discretionaryCategories.includes(t.category.name))
      .reduce((s, t) => s + t.amount, 0)

    if (prevDiscretionary > 0 && thisDiscretionary > prevDiscretionary * 1.15) {
      const increase = thisDiscretionary - prevDiscretionary
      insights.push({
        id: 'discretionary-up',
        type: 'trend',
        severity: 'warning',
        title: 'Discretionary spending up this month',
        body: `Your discretionary spending is ${((thisDiscretionary / prevDiscretionary - 1) * 100).toFixed(0)}% higher than last month ($${thisDiscretionary.toFixed(2)} vs $${prevDiscretionary.toFixed(2)}).`,
        estimatedImpact: `$${increase.toFixed(2)}/month increase`,
        suggestedAction: 'Review your eating out and entertainment expenses.',
      })
    }

    // 2. Food delivery > groceries
    const foodDelivery = thisExpenses
      .filter((t) => t.category?.name === 'Eating Out')
      .reduce((s, t) => s + t.amount, 0)
    const groceries = thisExpenses
      .filter((t) => t.category?.name === 'Groceries')
      .reduce((s, t) => s + t.amount, 0)

    if (foodDelivery > 0 && groceries > 0 && foodDelivery > groceries) {
      const diff = foodDelivery - groceries
      insights.push({
        id: 'food-delivery-vs-groceries',
        type: 'trend',
        severity: 'info',
        title: 'Eating out exceeds groceries',
        body: `You spent $${foodDelivery.toFixed(2)} on eating out vs $${groceries.toFixed(2)} on groceries this month.`,
        estimatedImpact: `$${(diff * 0.3).toFixed(2)}/month if food delivery reduced by 30%`,
        suggestedAction: 'Consider meal prepping to reduce food delivery costs.',
      })
    }

    // 3. Any category over budget
    const budgets = await prisma.budget.findMany({
      where: { year, month, period: 'monthly' },
      include: { category: true },
    })

    for (const budget of budgets) {
      const actual = thisExpenses
        .filter((t) => t.categoryId === budget.categoryId)
        .reduce((s, t) => s + t.amount, 0)

      if (actual > budget.amount) {
        const overage = actual - budget.amount
        insights.push({
          id: `over-budget-${budget.categoryId}`,
          type: 'hygiene',
          severity: 'alert',
          title: `Over budget: ${budget.category.name}`,
          body: `You've spent $${actual.toFixed(2)} on ${budget.category.name}, which is $${overage.toFixed(2)} over your $${budget.amount.toFixed(2)} budget.`,
          estimatedImpact: `$${overage.toFixed(2)} over budget`,
          suggestedAction: `Reduce ${budget.category.name} spending for the rest of the month.`,
        })
      }
    }

    // 4. Recurring transaction not yet seen this month
    const recurringLastMonth = await prisma.transaction.findMany({
      where: {
        isRecurring: true,
        transactionDate: { gte: prevStart, lte: prevEnd },
        direction: 'expense',
      },
    })

    for (const recurring of recurringLastMonth) {
      const thisMonthOccurrence = await prisma.transaction.findFirst({
        where: {
          accountId: recurring.accountId,
          merchantName: recurring.merchantName,
          transactionDate: { gte: start, lte: end },
        },
      })

      if (!thisMonthOccurrence) {
        insights.push({
          id: `recurring-missing-${recurring.id}`,
          type: 'recurring',
          severity: 'info',
          title: `Recurring payment due: ${recurring.merchantName ?? recurring.descriptionRaw}`,
          body: `A recurring payment of $${recurring.amount.toFixed(2)} was not seen this month yet.`,
          estimatedImpact: `$${recurring.amount.toFixed(2)} expected`,
          suggestedAction: null,
        })
      }
    }

    // 5. Savings rate below 10%
    if (totalThisIncome > 0) {
      const savingsRate =
        ((totalThisIncome - totalThisExpense) / totalThisIncome) * 100

      if (savingsRate < 10) {
        insights.push({
          id: 'low-savings-rate',
          type: 'hygiene',
          severity: 'warning',
          title: 'Low savings rate',
          body: `Your savings rate this month is ${savingsRate.toFixed(1)}%, which is below the recommended 10%.`,
          estimatedImpact: `$${((totalThisIncome * 0.1) - (totalThisIncome - totalThisExpense)).toFixed(2)} gap to reach 10% savings`,
          suggestedAction: 'Review your largest expense categories and look for reductions.',
        })
      }
    }

    // 6. No income transactions this month
    if (thisIncome.length === 0) {
      insights.push({
        id: 'no-income',
        type: 'hygiene',
        severity: 'alert',
        title: 'No income detected this month',
        body: 'No income transactions have been recorded for this month.',
        estimatedImpact: null,
        suggestedAction: 'Import your bank statements to ensure income is recorded.',
      })
    }

    // 7. Payday spending spike (large spend within 48h of income)
    for (const incomeTx of thisIncome) {
      if (incomeTx.amount < 1000) continue // Only check significant income

      const twoDaysLater = new Date(incomeTx.transactionDate.getTime() + 48 * 60 * 60 * 1000)
      const post48h = thisExpenses.filter(
        (t) =>
          t.transactionDate >= incomeTx.transactionDate &&
          t.transactionDate <= twoDaysLater
      )

      const spikeTotal = post48h.reduce((s, t) => s + t.amount, 0)
      if (spikeTotal > incomeTx.amount * 0.2) {
        insights.push({
          id: `payday-spike-${incomeTx.id}`,
          type: 'anomaly',
          severity: 'info',
          title: 'Spending spike after income',
          body: `You spent $${spikeTotal.toFixed(2)} within 48 hours of receiving $${incomeTx.amount.toFixed(2)}.`,
          estimatedImpact: `$${spikeTotal.toFixed(2)} spent quickly`,
          suggestedAction: 'Consider setting up automatic transfers to savings on payday.',
        })
        break // Only report once
      }
    }

    return insights
  }
}
