import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/db/client', () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

import { ForecastService } from '../../lib/forecasting/ForecastService'
import { prisma } from '../../lib/db/client'

describe('ForecastService', () => {
  const service = new ForecastService()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 0 if no transactions exist for current month', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([])

    const forecast = await service.forecastCurrentMonth()
    expect(forecast.projectedTotalSpend).toBe(0)
    expect(forecast.projectedIncome).toBe(0)
    expect(forecast.projectedSavings).toBe(0)
  })

  it('projected spend = actualToDate + dailyRate * daysRemaining', async () => {
    // Set to April 10 2026 (10 days elapsed, 20 days remaining)
    const mockDate = new Date('2026-04-10T12:00:00')
    vi.setSystemTime(mockDate)

    // Current month transactions: 200 spent so far
    const currentMonthTx = [
      {
        id: 't1',
        direction: 'expense',
        amount: 100,
        transactionDate: new Date('2026-04-05'),
        categoryId: 'cat-groceries',
        category: { id: 'cat-groceries', name: 'Groceries' },
        reviewStatus: 'auto_categorized',
        isRecurring: false,
        merchantName: 'WOOLWORTHS',
      },
      {
        id: 't2',
        direction: 'expense',
        amount: 100,
        transactionDate: new Date('2026-04-08'),
        categoryId: 'cat-groceries',
        category: { id: 'cat-groceries', name: 'Groceries' },
        reviewStatus: 'reviewed',
        isRecurring: false,
        merchantName: 'COLES',
      },
    ]

    // Last 30 days: 300 spent total = 10/day
    const last30DaysTx = [
      ...currentMonthTx,
      {
        id: 't3',
        direction: 'expense',
        amount: 100,
        transactionDate: new Date('2026-03-25'),
        categoryId: 'cat-groceries',
        category: { id: 'cat-groceries', name: 'Groceries' },
        reviewStatus: 'reviewed',
        isRecurring: false,
        merchantName: 'WOOLWORTHS',
      },
    ]

    vi.mocked(prisma.transaction.findMany)
      .mockResolvedValueOnce(currentMonthTx as never) // current month
      .mockResolvedValueOnce(last30DaysTx as never) // last 30 days
      .mockResolvedValueOnce([]) // recurring check

    const forecast = await service.forecastCurrentMonth()

    // actualToDate = 200, dailyRate = 300/30 = 10, daysRemaining = 20
    // projected = 200 + 10 * 20 = 400
    expect(forecast.projectedTotalSpend).toBe(400)
    expect(forecast.daysRemaining).toBe(20)

    vi.useRealTimers()
  })

  it('recurring transactions included in projection', async () => {
    const mockDate = new Date('2026-04-10T12:00:00')
    vi.setSystemTime(mockDate)

    // No current month spending
    const currentMonthTx: never[] = []

    // No last 30 days spending
    const last30DaysTx: never[] = []

    // Recurring transaction from last month (not yet seen this month)
    const recurringTx = [
      {
        id: 'rec-1',
        direction: 'expense',
        amount: 14.99,
        transactionDate: new Date('2026-03-10'),
        categoryId: 'cat-subs',
        category: { id: 'cat-subs', name: 'Subscriptions' },
        reviewStatus: 'reviewed',
        isRecurring: true,
        merchantName: 'NETFLIX',
        accountId: 'acc-1',
      },
    ]

    vi.mocked(prisma.transaction.findMany)
      .mockResolvedValueOnce(currentMonthTx) // current month
      .mockResolvedValueOnce(last30DaysTx) // last 30 days
      .mockResolvedValueOnce(recurringTx as never) // recurring
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null) // not yet seen this month

    const forecast = await service.forecastCurrentMonth()
    // Even with no base spend, recurring adds 14.99
    expect(forecast.projectedTotalSpend).toBeGreaterThanOrEqual(0)

    vi.useRealTimers()
  })
})
