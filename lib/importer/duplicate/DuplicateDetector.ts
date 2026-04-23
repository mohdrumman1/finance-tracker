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
    if (transactions.length === 0) return { unique: [], duplicates: [] }

    const dates = transactions.map((tx) => tx.transactionDate.getTime())
    const minDate = startOfDay(new Date(Math.min(...dates)))
    const maxDate = endOfDay(new Date(Math.max(...dates)))

    // Single query covering the full date range, then match in memory
    const existing = await prisma.transaction.findMany({
      where: {
        accountId,
        transactionDate: { gte: minDate, lte: maxDate },
      },
      select: { transactionDate: true, amount: true, direction: true },
    })

    const existingKeys = new Set(
      existing.map(
        (tx) => `${startOfDay(tx.transactionDate).getTime()}:${tx.amount}:${tx.direction}`
      )
    )

    const unique: NormalizedTransaction[] = []
    const duplicates: NormalizedTransaction[] = []

    for (const tx of transactions) {
      const key = `${startOfDay(tx.transactionDate).getTime()}:${tx.amount}:${tx.direction}`
      if (existingKeys.has(key)) {
        duplicates.push(tx)
      } else {
        unique.push(tx)
      }
    }

    return { unique, duplicates }
  }
}
