import { prisma } from '../../db/client'
import type { NormalizedTransaction } from '../../importer/normalizer/TransactionNormalizer'
import type { CategorizationResult } from '../CategorizationService'
import { subDays } from 'date-fns'

export class HeuristicLayer {
  async categorize(transaction: NormalizedTransaction): Promise<CategorizationResult | null> {
    // Rule 1: Large inbound with SALARY or PAYROLL -> Income/Salary
    const desc = transaction.descriptionNormalized || transaction.descriptionRaw.toUpperCase()
    if (
      transaction.direction === 'income' &&
      (desc.includes('SALARY') || desc.includes('PAYROLL'))
    ) {
      const category = await prisma.category.findFirst({ where: { name: 'Income' } })
      const subcategory = await prisma.subcategory.findFirst({
        where: { name: 'Salary', categoryId: category?.id },
      })
      if (category) {
        return {
          categoryId: category.id,
          subcategoryId: subcategory?.id ?? null,
          confidence: 0.9,
          method: 'heuristic',
          reason: 'Salary/payroll income pattern',
        }
      }
    }

    // Rule 2: Transfer detection
    if (transaction.isTransfer || desc.includes('TRANSFER') || desc.includes(' TFR ')) {
      const category = await prisma.category.findFirst({ where: { name: 'Transfers' } })
      if (category) {
        return {
          categoryId: category.id,
          subcategoryId: null,
          confidence: 0.8,
          method: 'heuristic',
          reason: 'Transfer pattern detected',
        }
      }
    }

    // Rule 3: Recurring subscription detection
    // Same merchant, same amount, every ~30 days
    if (transaction.merchantName && transaction.amount > 0) {
      const thirtyDaysAgo = subDays(transaction.transactionDate, 33)
      const twentySevenDaysAgo = subDays(transaction.transactionDate, 27)

      const similar = await prisma.transaction.findFirst({
        where: {
          accountId: transaction.accountId,
          merchantName: transaction.merchantName,
          amount: transaction.amount,
          transactionDate: {
            gte: thirtyDaysAgo,
            lte: twentySevenDaysAgo,
          },
          direction: 'expense',
        },
      })

      if (similar) {
        const category = await prisma.category.findFirst({ where: { name: 'Subscriptions' } })
        if (category) {
          return {
            categoryId: category.id,
            subcategoryId: null,
            confidence: 0.75,
            method: 'heuristic',
            reason: 'Recurring monthly payment detected',
          }
        }
      }
    }

    return null
  }
}
