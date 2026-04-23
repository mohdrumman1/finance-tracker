import { prisma } from '../../db/client'
import type { NormalizedTransaction } from '../../importer/normalizer/TransactionNormalizer'
import type { CategorizationResult } from '../CategorizationService'
import type { Category, Subcategory } from '@prisma/client'
import { subDays } from 'date-fns'

interface CategoryCache {
  income: Category | null
  transfers: Category | null
  subscriptions: Category | null
  salarySub: Subcategory | null
}

let categoriesPromise: Promise<CategoryCache> | null = null

function getCategories(): Promise<CategoryCache> {
  if (!categoriesPromise) {
    categoriesPromise = (async () => {
      const [income, transfers, subscriptions] = await Promise.all([
        prisma.category.findFirst({ where: { name: 'Income' } }),
        prisma.category.findFirst({ where: { name: 'Transfers' } }),
        prisma.category.findFirst({ where: { name: 'Subscriptions' } }),
      ])
      const salarySub = income
        ? await prisma.subcategory.findFirst({ where: { name: 'Salary', categoryId: income.id } })
        : null
      return { income, transfers, subscriptions, salarySub }
    })()
  }
  return categoriesPromise
}

export class HeuristicLayer {
  async categorize(transaction: NormalizedTransaction): Promise<CategorizationResult | null> {
    const desc = transaction.descriptionNormalized || transaction.descriptionRaw.toUpperCase()
    const { income, transfers, subscriptions, salarySub } = await getCategories()

    // Rule 1: Large inbound with SALARY or PAYROLL -> Income/Salary
    if (
      transaction.direction === 'income' &&
      (desc.includes('SALARY') || desc.includes('PAYROLL'))
    ) {
      if (income) {
        return {
          categoryId: income.id,
          subcategoryId: salarySub?.id ?? null,
          confidence: 0.9,
          method: 'heuristic',
          reason: 'Salary/payroll income pattern',
        }
      }
    }

    // Rule 2: Transfer detection
    if (transaction.isTransfer || desc.includes('TRANSFER') || desc.includes(' TFR ')) {
      if (transfers) {
        return {
          categoryId: transfers.id,
          subcategoryId: null,
          confidence: 0.8,
          method: 'heuristic',
          reason: 'Transfer pattern detected',
        }
      }
    }

    // Rule 3: Recurring subscription detection
    if (transaction.merchantName && transaction.amount > 0) {
      const thirtyDaysAgo = subDays(transaction.transactionDate, 33)
      const twentySevenDaysAgo = subDays(transaction.transactionDate, 27)

      const similar = await prisma.transaction.findFirst({
        where: {
          accountId: transaction.accountId,
          merchantName: transaction.merchantName,
          amount: transaction.amount,
          transactionDate: { gte: thirtyDaysAgo, lte: twentySevenDaysAgo },
          direction: 'expense',
        },
      })

      if (similar && subscriptions) {
        return {
          categoryId: subscriptions.id,
          subcategoryId: null,
          confidence: 0.75,
          method: 'heuristic',
          reason: 'Recurring monthly payment detected',
        }
      }
    }

    return null
  }
}
