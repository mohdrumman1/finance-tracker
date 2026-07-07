/**
 * tests/date-window/viewMonth.test.ts
 *
 * Tests the getViewMonth fallback logic from lib/date-window.ts.
 *
 * Scenario: a user whose most recent transactions are in May 2026.
 * When `now` is 2026-07-07 (July has no data), getViewMonth should
 * return viewMonth = May 2026 with isFallback = true — the same value
 * the dashboard banner renders as "Showing May 2026 — your most recent activity".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { format } from 'date-fns'

// Must be hoisted before any import of the module under test.
vi.mock('../../lib/db/client', () => ({
  prisma: {
    transaction: {
      findFirst: vi.fn(),
    },
  },
}))

import { getViewMonth } from '../../lib/date-window'
import { prisma } from '../../lib/db/client'

describe('getViewMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to May 2026 when user has no July 2026 transactions (now = 2026-07-07)', async () => {
    // User's most recent transaction is 15 May 2026 (UTC noon — safely in May in IST too).
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      transactionDate: new Date('2026-05-15T04:30:00.000Z'), // 10:00 IST
    } as never)

    const now = new Date('2026-07-07T04:30:00.000Z') // 10:00 IST on 7 July
    const result = await getViewMonth('user-may-only', now)

    // Falls back because May is outside July's IST month boundary.
    expect(result.isFallback).toBe(true)

    // viewMonth should land in May 2026 (month index 4).
    expect(result.viewMonth.getFullYear()).toBe(2026)
    expect(result.viewMonth.getMonth()).toBe(4) // 0-based: 4 = May

    // This is the exact string the dashboard banner renders:
    // {isFallback && `Showing ${format(viewMonth, 'MMMM yyyy')} — your most recent activity`}
    const bannerText = `Showing ${format(result.viewMonth, 'MMMM yyyy')} — your most recent activity`
    expect(bannerText).toBe('Showing May 2026 — your most recent activity')
  })

  it('returns current month with isFallback=false when user has July 2026 transactions', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      transactionDate: new Date('2026-07-03T04:30:00.000Z'), // 10:00 IST on 3 July
    } as never)

    const now = new Date('2026-07-07T04:30:00.000Z')
    const result = await getViewMonth('user-current-month', now)

    expect(result.isFallback).toBe(false)
    expect(result.viewMonth).toBe(now)
    expect(result.mostRecentTxDate).toEqual(new Date('2026-07-03T04:30:00.000Z'))
  })

  it('returns now with isFallback=false and null mostRecentTxDate when user has zero transactions', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

    const now = new Date('2026-07-07T04:30:00.000Z')
    const result = await getViewMonth('user-no-tx', now)

    expect(result.isFallback).toBe(false)
    expect(result.viewMonth).toBe(now)
    expect(result.mostRecentTxDate).toBeNull()
  })

  it('Prisma query is scoped to the given userId via account relation', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

    const now = new Date('2026-07-07T04:30:00.000Z')
    await getViewMonth('user-scoping-check', now)

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { account: { userId: 'user-scoping-check' } },
        orderBy: { transactionDate: 'desc' },
      })
    )
  })
})
