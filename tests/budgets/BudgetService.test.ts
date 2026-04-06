import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/db/client', () => ({
  prisma: {
    budget: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    transaction: {
      aggregate: vi.fn(),
    },
  },
}))

import { BudgetService } from '../../lib/budgets/BudgetService'
import { prisma } from '../../lib/db/client'

describe('BudgetService', () => {
  const service = new BudgetService()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('actual spend correctly summed for category in month', async () => {
    vi.mocked(prisma.budget.findMany).mockResolvedValue([
      {
        id: 'b1',
        categoryId: 'cat-groceries',
        period: 'monthly',
        amount: 400,
        year: 2026,
        month: 4,
        week: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-groceries', name: 'Groceries', color: '#84cc16' },
      },
    ] as never)

    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amount: 350 },
    } as never)

    const results = await service.getBudgetsForMonth(2026, 4)
    expect(results).toHaveLength(1)
    expect(results[0].actual).toBe(350)
    expect(results[0].budgeted).toBe(400)
    expect(results[0].remaining).toBe(50)
  })

  it('pacing status is on_track when under budget proportionally', async () => {
    // Mock the current date to be April 10 (10 days into a 30 day month)
    const mockDate = new Date('2026-04-10')
    vi.setSystemTime(mockDate)

    vi.mocked(prisma.budget.findMany).mockResolvedValue([
      {
        id: 'b1',
        categoryId: 'cat-groceries',
        period: 'monthly',
        amount: 300,
        year: 2026,
        month: 4,
        week: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-groceries', name: 'Groceries' },
      },
    ] as never)

    // 10 days elapsed, 30 day month: pacing limit = 300 * 10/30 * 1.1 = 110
    // Actual spend = 80, which is under 110
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amount: 80 },
    } as never)

    const results = await service.getBudgetsForMonth(2026, 4)
    expect(results[0].pacingStatus).toBe('on_track')

    vi.useRealTimers()
  })

  it('pacing status is over_budget when actual > budgeted', async () => {
    vi.mocked(prisma.budget.findMany).mockResolvedValue([
      {
        id: 'b1',
        categoryId: 'cat-groceries',
        period: 'monthly',
        amount: 300,
        year: 2026,
        month: 4,
        week: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-groceries', name: 'Groceries' },
      },
    ] as never)

    // Actual > budget
    vi.mocked(prisma.transaction.aggregate).mockResolvedValue({
      _sum: { amount: 350 },
    } as never)

    const results = await service.getBudgetsForMonth(2026, 4)
    expect(results[0].pacingStatus).toBe('over_budget')
  })

  it('setBudget creates or updates a budget', async () => {
    vi.mocked(prisma.budget.upsert).mockResolvedValue({} as never)

    await service.setBudget('cat-groceries', 400, 2026, 4)

    expect(prisma.budget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          categoryId_period_year_month: {
            categoryId: 'cat-groceries',
            period: 'monthly',
            year: 2026,
            month: 4,
          },
        },
        create: expect.objectContaining({ amount: 400 }),
      })
    )
  })
})
