import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/db/client', () => ({
  prisma: {
    merchantRule: {
      findMany: vi.fn(),
    },
  },
}))

import { ExactMerchantLayer } from '../../lib/categorization/layers/ExactMerchantLayer'
import { prisma } from '../../lib/db/client'
import type { NormalizedTransaction } from '../../lib/importer/normalizer/TransactionNormalizer'

const makeTx = (desc: string, direction: 'income' | 'expense' | 'transfer' = 'expense'): NormalizedTransaction => ({
  accountId: 'acc-1',
  sourceType: 'csv',
  transactionDate: new Date(),
  descriptionRaw: desc,
  descriptionNormalized: desc.toUpperCase(),
  merchantName: desc,
  amount: 50,
  currency: 'AUD',
  direction,
  categoryId: null,
  subcategoryId: null,
  isRecurring: false,
  isTransfer: false,
  confidenceScore: 0,
  reviewStatus: 'pending',
})

describe('ExactMerchantLayer', () => {
  const layer = new ExactMerchantLayer()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('matches a pattern when description contains it', async () => {
    vi.mocked(prisma.merchantRule.findMany).mockResolvedValue([
      {
        id: 'r1',
        pattern: 'WOOLWORTHS',
        patternType: 'exact',
        categoryId: 'cat-groceries',
        subcategoryId: null,
        direction: null,
        isUserDefined: false,
        priority: 0,
      },
    ] as never)

    const result = await layer.categorize(makeTx('WOOLWORTHS 1234 SYDNEY'))
    expect(result).not.toBeNull()
    expect(result?.categoryId).toBe('cat-groceries')
    expect(result?.confidence).toBe(1.0)
  })

  it('returns null when no pattern matches', async () => {
    vi.mocked(prisma.merchantRule.findMany).mockResolvedValue([])

    const result = await layer.categorize(makeTx('UNKNOWN VENDOR'))
    expect(result).toBeNull()
  })

  it('respects direction filter', async () => {
    vi.mocked(prisma.merchantRule.findMany).mockResolvedValue([
      {
        id: 'r2',
        pattern: 'SALARY',
        patternType: 'exact',
        categoryId: 'cat-income',
        subcategoryId: null,
        direction: 'income', // only matches income
        isUserDefined: false,
        priority: 0,
      },
    ] as never)

    // Expense direction should not match
    const expenseResult = await layer.categorize(makeTx('SALARY PAYMENT', 'expense'))
    expect(expenseResult).toBeNull()

    // Income direction should match
    const incomeResult = await layer.categorize(makeTx('SALARY PAYMENT', 'income'))
    expect(incomeResult?.categoryId).toBe('cat-income')
  })
})
