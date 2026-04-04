import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/db/client', () => ({
  prisma: {
    category: {
      findFirst: vi.fn(),
    },
    subcategory: {
      findFirst: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn(),
    },
  },
}))

import { HeuristicLayer } from '../../lib/categorization/layers/HeuristicLayer'
import { prisma } from '../../lib/db/client'
import type { NormalizedTransaction } from '../../lib/importer/normalizer/TransactionNormalizer'

const makeTx = (overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction => ({
  accountId: 'acc-1',
  sourceType: 'csv',
  transactionDate: new Date(),
  descriptionRaw: 'PAYROLL ACME CORP',
  descriptionNormalized: 'PAYROLL ACME CORP',
  merchantName: 'PAYROLL ACME CORP',
  amount: 5000,
  currency: 'AUD',
  direction: 'income',
  categoryId: null,
  subcategoryId: null,
  isRecurring: false,
  isTransfer: false,
  confidenceScore: 0,
  reviewStatus: 'pending',
  ...overrides,
})

describe('HeuristicLayer', () => {
  const layer = new HeuristicLayer()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.subcategory.findFirst).mockResolvedValue(null)
  })

  it('identifies PAYROLL income as Salary', async () => {
    vi.mocked(prisma.category.findFirst).mockResolvedValue({
      id: 'cat-income',
      name: 'Income',
    } as never)
    vi.mocked(prisma.subcategory.findFirst).mockResolvedValue({
      id: 'sub-salary',
      name: 'Salary',
    } as never)

    const result = await layer.categorize(makeTx())
    expect(result?.categoryId).toBe('cat-income')
    expect(result?.confidence).toBe(0.9)
    expect(result?.method).toBe('heuristic')
  })

  it('identifies SALARY income correctly', async () => {
    vi.mocked(prisma.category.findFirst).mockResolvedValue({
      id: 'cat-income',
      name: 'Income',
    } as never)

    const result = await layer.categorize(makeTx({ descriptionNormalized: 'SALARY PAYMENT' }))
    expect(result?.categoryId).toBe('cat-income')
  })

  it('identifies transfer transactions', async () => {
    vi.mocked(prisma.category.findFirst).mockResolvedValue({
      id: 'cat-transfers',
      name: 'Transfers',
    } as never)

    const result = await layer.categorize(
      makeTx({
        direction: 'expense',
        isTransfer: true,
        descriptionNormalized: 'TRANSFER TO SAVINGS',
      })
    )
    expect(result?.categoryId).toBe('cat-transfers')
    expect(result?.confidence).toBe(0.8)
  })

  it('returns null for unrecognized patterns', async () => {
    vi.mocked(prisma.category.findFirst).mockResolvedValue(null)

    const result = await layer.categorize(
      makeTx({
        direction: 'expense',
        descriptionNormalized: 'RANDOM MERCHANT 123',
        isTransfer: false,
      })
    )
    expect(result).toBeNull()
  })
})
