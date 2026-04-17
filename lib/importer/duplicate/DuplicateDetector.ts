import { prisma } from '../../db/client'
import type { NormalizedTransaction } from '../normalizer/TransactionNormalizer'
import { startOfDay, endOfDay } from 'date-fns'

export class DuplicateDetector {
  async filter(
    transactions: NormalizedTransaction[],
    accountId: string
  ): Promise<{
    unique: NormalizedTransaction[]
    duplicates: NormalizedTransaction[]
  }> {
    const unique: NormalizedTransaction[] = []
    const duplicates: NormalizedTransaction[] = []

    for (const tx of transactions) {
      const isDupe = await this.isDuplicate(tx, accountId)
      if (isDupe) {
        duplicates.push(tx)
      } else {
        unique.push(tx)
      }
    }

    return { unique, duplicates }
  }

  async isDuplicate(tx: NormalizedTransaction, accountId: string): Promise<boolean> {
    const dayStart = startOfDay(tx.transactionDate)
    const dayEnd = endOfDay(tx.transactionDate)

    // Match on date + amount + direction + accountId.
    // This catches re-imports of the same CSV even if description formatting differs.
    // direction prevents an income of $X clashing with an expense of $X on the same day.
    const existing = await prisma.transaction.findFirst({
      where: {
        accountId,
        transactionDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        amount: tx.amount,
        direction: tx.direction,
      },
    })

    return existing !== null
  }
}
