/**
 * lib/date-window.ts
 *
 * IST-aware date helpers used across the app (client-safe — no DB imports).
 *
 * WHY IST? The server runs on UTC (Vercel). date-fns startOfMonth/endOfMonth
 * use the process's local time, which is UTC on the server. An IST user's
 * "start of July" is 2026-06-30 18:30:00 UTC, not 2026-07-01 00:00:00 UTC.
 * These wrappers harden all month-boundary calculations to Asia/Kolkata.
 *
 * NOTE: getViewMonth (which queries the DB) lives in lib/db/view-month.ts to
 * keep this module free of Node-native imports (better-sqlite3 etc.) so it
 * can be safely imported by Client Components.
 */

import { startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

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

