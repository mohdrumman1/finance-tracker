/**
 * lib/db/view-month.ts
 *
 * Server-only helper: determines which month to display for a user.
 * Split from lib/date-window.ts so that the pure date helpers in that
 * module remain importable by Client Components without pulling
 * better-sqlite3 (a Node-native package) into the browser bundle.
 */

import { prisma } from './client'
import { startOfMonthIST, endOfMonthIST } from '../date-window'

export interface ViewMonthResult {
  /** The month to use as the display anchor. */
  viewMonth: Date
  /** True when `viewMonth` is not the current month (fallback was triggered). */
  isFallback: boolean
  /** The date of the user's most recent transaction, or null if none exist. */
  mostRecentTxDate: Date | null
}

/**
 * Determines which month to display for a given user.
 *
 * - If the user has transactions in the current month: returns `referenceDate` (no fallback).
 * - If the user has transactions in an earlier month: returns the date of the
 *   most recent transaction and sets isFallback=true.
 * - If the user has zero transactions: returns `referenceDate` with isFallback=false
 *   (the caller's empty-state gate will handle this separately).
 *
 * All month boundaries are computed in IST (Asia/Kolkata).
 *
 * @param userId        - The Prisma User.id to scope the query to (via Account).
 * @param referenceDate - The reference "today" (inject for testability).
 */
export async function getViewMonth(
  userId: string,
  referenceDate: Date
): Promise<ViewMonthResult> {
  const mostRecent = await prisma.transaction.findFirst({
    where: { account: { userId } },
    orderBy: { transactionDate: 'desc' },
    select: { transactionDate: true },
  })

  const mostRecentTxDate = mostRecent?.transactionDate ?? null

  if (!mostRecentTxDate) {
    // No transactions at all — caller handles empty state
    return { viewMonth: referenceDate, isFallback: false, mostRecentTxDate: null }
  }

  const currentMonthStart = startOfMonthIST(referenceDate)
  const currentMonthEnd = endOfMonthIST(referenceDate)
  const hasCurrentMonthData =
    mostRecentTxDate >= currentMonthStart && mostRecentTxDate <= currentMonthEnd

  if (hasCurrentMonthData) {
    return { viewMonth: referenceDate, isFallback: false, mostRecentTxDate }
  }

  // Fall back to the most recent month with data
  return { viewMonth: mostRecentTxDate, isFallback: true, mostRecentTxDate }
}
