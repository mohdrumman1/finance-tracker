import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NormalizedTransaction } from '../../lib/importer/normalizer/TransactionNormalizer'

// Mock the prisma client
vi.mock('../../lib/db/client', () => ({
  prisma: {
    transaction: {
      findFirst: vi.fn(),
    },
  },
}))

import { DuplicateDetector } from '../../lib/importer/duplicate/DuplicateDetector'
import { prisma } from '../../lib/db/client'

const makeTransaction = (overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction => ({
  accountId: 'test-account',
  sourceType: 'csv',
  transactionDate: new Date('2026-04-01'),
  descriptionRaw: 'WOOLWORTHS SYDNEY',
  descriptionNormalized: 'WOOLWORTHS SYDNEY',
  merchantName: 'WOOLWORTHS SYDNEY',
  amount: 50.0,
  currency: 'AUD',
  direction: 'expense',
  categoryId: null,
  subcategoryId: null,
  isRecurring: false,
  isTransfer: false,
  confidenceScore: 0,
  reviewStatus: 'pending',
  ...overrides,
})

describe('DuplicateDetector', () => {
  const detector = new DuplicateDetector()
  const accountId = 'test-account'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns duplicate when date + amount + description all match', async () => {
    const tx = makeTransaction()
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'existing-id',
      accountId,
      amount: 50.0,
      descriptionRaw: 'WOOLWORTHS SYDNEY',
      transactionDate: new Date('2026-04-01'),
    } as never)

    const { unique, duplicates } = await detector.filter([tx], accountId)
    expect(duplicates).toHaveLength(1)
    expect(unique).toHaveLength(0)
  })

  it('does not mark as duplicate if amount differs', async () => {
    const tx = makeTransaction({ amount: 75.0 })
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

    const { unique, duplicates } = await detector.filter([tx], accountId)
    expect(unique).toHaveLength(1)
    expect(duplicates).toHaveLength(0)
  })

  it('does not mark as duplicate if date differs by 1 day', async () => {
    const tx = makeTransaction({ transactionDate: new Date('2026-04-02') })
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

    const { unique, duplicates } = await detector.filter([tx], accountId)
    expect(unique).toHaveLength(1)
    expect(duplicates).toHaveLength(0)
  })

  it('handles multiple transactions correctly', async () => {
    const tx1 = makeTransaction({ descriptionRaw: 'TX1' })
    const tx2 = makeTransaction({ descriptionRaw: 'TX2' })
    const tx3 = makeTransaction({ descriptionRaw: 'TX3' })

    vi.mocked(prisma.transaction.findFirst)
      .mockResolvedValueOnce({ id: 'dupe' } as never) // tx1 is a dupe
      .mockResolvedValueOnce(null) // tx2 is unique
      .mockResolvedValueOnce(null) // tx3 is unique

    const { unique, duplicates } = await detector.filter([tx1, tx2, tx3], accountId)
    expect(duplicates).toHaveLength(1)
    expect(unique).toHaveLength(2)
  })
})
