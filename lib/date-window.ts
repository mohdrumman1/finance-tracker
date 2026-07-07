/**
 * lib/date-window.ts
 *
 * IST-aware date helpers and the viewMonth fallback logic used across the app.
 *
 * WHY IST? The server runs on UTC (Vercel). date-fns startOfMonth/endOfMonth
 * use the process's local time, which is UTC on the server. An IST user's
 * "start of July" is 2026-06-30 18:30:00 UTC, not 2026-07-01 00:00:00 UTC.
 * These wrappers harden all month-boundary calculations to Asia/Kolkata.
 */

import { startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { prisma } from './db/client'

const IST_TZ = 'Asia/Kolkata'

/**
 * Returns the start of the month containing `date`, expressed as UTC,
 * where "start of month" is computed in IST (Asia/Kolkata).
 */
export function startOfMonthIST(date: Date): Date {
  const inIST = toZonedTime(date, IST_TZ)
  const start = startOfMonth(inIST)
  return fromZonedTime(start, IST_TZ)
}

/**
 * Returns the end of the month containing `date`, expressed as UTC,
 * where "end of month" is computed in IST (Asia/Kolkata).
 */
export function endOfMonthIST(date: Date): Date {
  const inIST = toZonedTime(date, IST_TZ)
  const end = endOfMonth(inIST)
  return fromZonedTime(end, IST_TZ)
}

/**
 * Subtracts `n` months from `date`. Month subtraction is arithmetic and
 * timezone-independent; use startOfMonthIST/endOfMonthIST on the result
 * when computing boundaries.
 */
export function subMonthsIST(date: Date, n: number): Date {
  return subMonths(date, n)
}

// ---------------------------------------------------------------------------

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
