import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NormalizedTransaction } from '../../lib/importer/normalizer/TransactionNormalizer'

// Mock prisma
vi.mock('../../lib/db/client', () => ({
  prisma: {
    merchantRule: {
      findMany: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    subcategory: {
      findFirst: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn(),
    },
  },
}))

import { CategorizationService } from '../../lib/categorization/CategorizationService'
import { prisma } from '../../lib/db/client'

const makeTransaction = (overrides: Partial<NormalizedTransaction> = {}): NormalizedTransaction => ({
  accountId: 'test-account',
  sourceType: 'csv',
  transactionDate: new Date('2026-04-01'),
  descriptionRaw: 'WOOLWORTHS SYDNEY',
  descriptionNormalized: 'WOOLWORTHS SYDNEY',
  merchantName: 'WOOLWORTHS SYDNEY',
  amount: 85.0,
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

const groceryCategoryId = 'cat-groceries'
const subscriptionCategoryId = 'cat-subscriptions'
const userRuleCategoryId = 'cat-user-defined'

describe('CategorizationService', () => {
  const service = new CategorizationService()

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no transaction matches for heuristic layer
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    // Default: no categories found for AI layer
    vi.mocked(prisma.category.findMany).mockResolvedValue([])
  })

  it('returns exact match for WOOLWORTHS -> Groceries', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(prisma.merchantRule.findMany as any).mockImplementation(({ where }: any) => {
      const patternType = typeof where?.patternType === 'string' ? where.patternType : ''
      if (patternType === 'exact') {
        return Promise.resolve([
          {
            id: 'rule-1',
            pattern: 'WOOLWORTHS',
            patternType: 'exact',
            categoryId: groceryCategoryId,
            subcategoryId: null,
            direction: null,
            isUserDefined: false,
            priority: 0,
          },
        ])
      }
      return Promise.resolve([])
    })

    const tx = makeTransaction({ descriptionNormalized: 'WOOLWORTHS 1234 SYDNEY' })
    const result = await service.categorize(tx)
    expect(result.categoryId).toBe(groceryCategoryId)
    expect(result.confidence).toBe(1.0)
    expect(result.method).toBe('exact')
  })

  it('returns keyword match for GOOGLE STORAGE -> Subscriptions', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(prisma.merchantRule.findMany as any).mockImplementation(({ where }: any) => {
      const patternType = typeof where?.patternType === 'string' ? where.patternType : ''
      if (patternType === 'exact') return Promise.resolve([])
      return Promise.resolve([
        {
          id: 'rule-2',
          pattern: 'GOOGLE*',
          patternType: 'keyword',
          categoryId: subscriptionCategoryId,
          subcategoryId: null,
          direction: null,
          isUserDefined: false,
          priority: 0,
        },
      ])
    })

    const tx = makeTransaction({
      descriptionNormalized: 'GOOGLE STORAGE MONTHLY',
      merchantName: 'GOOGLE STORAGE',
    })
    const result = await service.categorize(tx)
    expect(result.categoryId).toBe(subscriptionCategoryId)
    expect(result.confidence).toBe(0.85)
    expect(result.method).toBe('regex')
  })

  it('returns confidence < 0.6 for unknown merchant', async () => {
    vi.mocked(prisma.merchantRule.findMany).mockResolvedValue([])
    vi.mocked(prisma.category.findFirst).mockResolvedValue(null)

    const tx = makeTransaction({
      descriptionNormalized: 'UNKNOWN MERCHANT XYZ 123',
      merchantName: 'UNKNOWN MERCHANT XYZ',
    })
    const result = await service.categorize(tx)
    expect(result.confidence).toBeLessThan(0.6)
    expect(result.categoryId).toBeNull()
  })

  it('user override rule wins over built-in rules', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(prisma.merchantRule.findMany as any).mockImplementation(({ where }: any) => {
      const patternType = typeof where?.patternType === 'string' ? where.patternType : ''
      if (patternType === 'exact') {
        return Promise.resolve([
          // User-defined rule comes first (higher isUserDefined)
          {
            id: 'user-rule',
            pattern: 'WOOLWORTHS',
            patternType: 'exact',
            categoryId: userRuleCategoryId,
            subcategoryId: null,
            direction: null,
            isUserDefined: true,
            priority: 10,
          },
          {
            id: 'system-rule',
            pattern: 'WOOLWORTHS',
            patternType: 'exact',
            categoryId: groceryCategoryId,
            subcategoryId: null,
            direction: null,
            isUserDefined: false,
            priority: 0,
          },
        ])
      }
      return Promise.resolve([])
    })

    const tx = makeTransaction({ descriptionNormalized: 'WOOLWORTHS 1234 SYDNEY' })
    const result = await service.categorize(tx)
    expect(result.categoryId).toBe(userRuleCategoryId)
  })
})
