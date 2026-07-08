import { describe, it, expect } from 'vitest'
import { CommbankPdfProfile } from '../../lib/importer/profiles/CommbankPdfProfile'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal CommBank-style PDF text string for extractRows(). */
function makeStatement(...lines: string[]): string {
  return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// detect()
// ---------------------------------------------------------------------------

describe('CommbankPdfProfile.detect()', () => {
  it('detects CommBank text', () => {
    expect(CommbankPdfProfile.detect('Commonwealth Bank statement')).toBe(true)
    expect(CommbankPdfProfile.detect('NetBank account summary')).toBe(true)
    expect(CommbankPdfProfile.detect('CommBank everyday account')).toBe(true)
  })

  it('does not match unrelated bank text', () => {
    expect(CommbankPdfProfile.detect('ANZ Bank statement')).toBe(false)
    expect(CommbankPdfProfile.detect('ING statement')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// extractRows() — salary / payroll (main regression case)
// ---------------------------------------------------------------------------

describe('CommbankPdfProfile.extractRows() — salary lines', () => {
  /**
   * PRIMARY BUG FIX: CR/DR marker appears BETWEEN the transaction amount and
   * the running balance in CommBank salary/payroll lines:
   *   "Salary 20150 NET PAY CL 26339 5,561.39 CR 5,815.66"
   *
   * Before the fix, AMOUNTS_END_RE only matched "amount balance CR|DR" (marker
   * at end). This format was silently skipped, causing the two May/June 2026
   * salary deposits to never be imported (see LEARNINGS.md 2026-07-09 entry).
   */
  it('parses salary line in "txAmount CR balance" format (AMOUNTS_CR_MID_RE)', () => {
    const text = makeStatement(
      '1Jan2026 OPENING BALANCE 254.27 CR',
      '14May2026 Salary 20150 NET PAY CL 26339 5,561.39 CR 5,815.66',
    )

    const rows = CommbankPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)

    const row = rows[0]
    expect(row.date).toBe('14 May 2026')
    expect(parseFloat(row.credit)).toBeCloseTo(5561.39, 2)
    expect(row.debit).toBe('0')
    expect(row.description).toMatch(/Salary/i)
    expect(row.balance).toBe('5815.66')
  })

  it('parses salary line in "txAmount balance CR" format (AMOUNTS_END_RE — existing path)', () => {
    const text = makeStatement(
      '1Jan2026 OPENING BALANCE 254.27 CR',
      '14May2026 Salary 20150 NET PAY CL 26339 5,561.39 5,815.66 CR',
    )

    const rows = CommbankPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)

    const row = rows[0]
    expect(row.date).toBe('14 May 2026')
    expect(parseFloat(row.credit)).toBeCloseTo(5561.39, 2)
    expect(row.debit).toBe('0')
    expect(row.description).toMatch(/Salary/i)
  })

  it('correctly sets direction=income (credit) for CR salary line', () => {
    const text = makeStatement(
      '1Jan2026 OPENING BALANCE 254.27 CR',
      '12Jun2026 Salary 20150 NET PAY CL 26339 5,561.39 CR 10,377.05',
    )

    const rows = CommbankPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)
    expect(rows[0].credit).not.toBe('0')
    expect(rows[0].debit).toBe('0')
  })
})

// ---------------------------------------------------------------------------
// extractRows() — merchant/expense lines (regression guard)
// ---------------------------------------------------------------------------

describe('CommbankPdfProfile.extractRows() — merchant debit lines (regression guard)', () => {
  it('parses Woolworths debit line correctly', () => {
    const text = makeStatement(
      '1Jan2026 OPENING BALANCE 1,155.66 DR',
      '14May2026 WOOLWORTHS 1234 SYDNEY NSW 55.00 1,100.66 DR',
    )

    const rows = CommbankPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)

    const row = rows[0]
    expect(row.date).toBe('14 May 2026')
    expect(parseFloat(row.debit)).toBeCloseTo(55.00, 2)
    expect(row.credit).toBe('0')
    expect(row.description).toMatch(/WOOLWORTHS/i)
  })

  it('parses a debit line that has multiple spaces between amounts (\\ s* fix)', () => {
    // Some PDF renderers emit column-aligned text with multiple spaces
    const text = makeStatement(
      '1Jan2026 OPENING BALANCE 1,000.00 CR',
      '01Jun2026 NETFLIX.COM  12.99  987.01 DR',
    )

    const rows = CommbankPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)
    expect(parseFloat(rows[0].debit)).toBeCloseTo(12.99, 2)
    expect(rows[0].debit).not.toBe('0')
    expect(rows[0].credit).toBe('0')
  })
})

// ---------------------------------------------------------------------------
// extractRows() — opening balance skipped
// ---------------------------------------------------------------------------

describe('CommbankPdfProfile.extractRows() — opening balance', () => {
  it('skips opening balance line and does not emit a transaction row', () => {
    const text = makeStatement(
      '1Jan2026 OPENING BALANCE 254.27 CR',
    )

    const rows = CommbankPdfProfile.extractRows(text)
    expect(rows).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// extractRows() — multi-transaction statement (end-to-end)
// ---------------------------------------------------------------------------

describe('CommbankPdfProfile.extractRows() — multi-transaction statement', () => {
  it('parses a statement with both income (salary) and expense rows correctly', () => {
    const text = makeStatement(
      '1Jan2026 OPENING BALANCE 254.27 CR',
      '14May2026 Salary 20150 NET PAY CL 26339 5,561.39 CR 5,815.66',
      '15May2026 WOOLWORTHS 1234 SYDNEY NSW 55.00 5,760.66 DR',
      '20May2026 NETFLIX.COM 12.99 5,747.67 DR',
    )

    const rows = CommbankPdfProfile.extractRows(text)
    expect(rows).toHaveLength(3)

    // Salary — income
    expect(rows[0].date).toBe('14 May 2026')
    expect(parseFloat(rows[0].credit)).toBeCloseTo(5561.39, 2)
    expect(rows[0].debit).toBe('0')
    expect(rows[0].description).toMatch(/Salary/i)

    // Woolworths — expense
    expect(rows[1].date).toBe('15 May 2026')
    expect(parseFloat(rows[1].debit)).toBeCloseTo(55.00, 2)
    expect(rows[1].credit).toBe('0')

    // Netflix — expense
    expect(rows[2].date).toBe('20 May 2026')
    expect(parseFloat(rows[2].debit)).toBeCloseTo(12.99, 2)
    expect(rows[2].credit).toBe('0')
  })
})
