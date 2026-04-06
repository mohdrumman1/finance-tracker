import { parse, format, isValid, startOfMonth, endOfMonth, differenceInDays, getDaysInMonth } from 'date-fns'

export function parseDate(dateStr: string, fmt: string): Date | null {
  try {
    const parsed = parse(dateStr, fmt, new Date())
    if (!isValid(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function formatDate(date: Date, fmt = 'yyyy-MM-dd'): string {
  return format(date, fmt)
}

export function getMonthStart(year: number, month: number): Date {
  return startOfMonth(new Date(year, month - 1, 1))
}

export function getMonthEnd(year: number, month: number): Date {
  return endOfMonth(new Date(year, month - 1, 1))
}

export function getDaysElapsedInMonth(date: Date = new Date()): number {
  return date.getDate()
}

export function getDaysInCurrentMonth(date: Date = new Date()): number {
  return getDaysInMonth(date)
}

export function getDaysRemainingInMonth(date: Date = new Date()): number {
  return getDaysInMonth(date) - date.getDate()
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(differenceInDays(a, b))
}

export function currentYearMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}
