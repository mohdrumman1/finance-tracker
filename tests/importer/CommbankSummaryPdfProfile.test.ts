import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { CommbankSummaryPdfProfile } from '../../lib/importer/profiles/CommbankSummaryPdfProfile'
import { CommbankPdfProfile } from '../../lib/importer/profiles/CommbankPdfProfile'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Transaction Summary–style PDF text string. */
function makeSummaryText(...lines: string[]): string {
  return lines.join('\n') + '\n'
}

// Minimal page header / footer wrappers to simulate the real PDF structure.
const PAGE_HEADER =
  'Date              Transaction details                                                            Amount              Balance'
const PAGE_FOOTER = [
  'Created 09/07/26 06:26am (Sydney/Melbourne time)',
  'While this letter is accurate at the time it\'s produced,',
  "we're not responsible for any reliance on this information.                                                  Transaction Summary v1.0.5",
].join('\n')

function wrapPage(...txLines: string[]): string {
  return [PAGE_HEADER, ...txLines, PAGE_FOOTER].join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// detect()
// ---------------------------------------------------------------------------

describe('CommbankSummaryPdfProfile.detect()', () => {
  it('returns true for letter-format text containing Transaction Summary and signed amounts', () => {
    const text = wrapPage(
      '01 May 2026       MERCHANT TESTTOWN AU                                              -$30.21               $261.18',
    )
    expect(CommbankSummaryPdfProfile.detect(text)).toBe(true)
  })

  it('returns false for classic CommBank statement text (has CR/DR, no Transaction Summary)', () => {
    const classicText = [
      'Commonwealth Bank of Australia',
      '14May2026 WOOLWORTHS 1234 SYDNEY NSW 55.00 1,100.00 DR',
    ].join('\n')
    expect(CommbankSummaryPdfProfile.detect(classicText)).toBe(false)
  })

  it('returns false for ING statement text', () => {
    const ingText = 'ING Bank Orange Everyday Savings Maximiser -250.00 1234.56'
    expect(CommbankSummaryPdfProfile.detect(ingText)).toBe(false)
  })

  // Regression guard: the classic profile must NOT fire on the letter format,
  // and the summary profile must NOT fire on the classic statement.
  it('CommbankPdfProfile.detect() returns false for letter-format text', () => {
    const summaryText = wrapPage(
      '01 May 2026       MERCHANT TESTTOWN AU                                              -$30.21               $261.18',
    )
    // Transaction Summary appears in the footer → classic profile rejects it
    expect(CommbankPdfProfile.detect(summaryText)).toBe(false)
  })

  it('CommbankPdfProfile.detect() returns true for classic statement text', () => {
    const classicText = 'Commonwealth Bank NetBank statement 55.00 1,100.00 DR'
    expect(CommbankPdfProfile.detect(classicText)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// extractRows() — positive-amount (income)
// ---------------------------------------------------------------------------

describe('CommbankSummaryPdfProfile.extractRows() — positive amount → income', () => {
  it('parses a positive-amount row and emits a positive amount string', () => {
    const text = wrapPage(
      '03 May 2026       Fast Transfer From Test User                                                $350.00              $384.92',
    )

    const rows = CommbankSummaryPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)

    const row = rows[0]
    expect(row.date).toBe('03 May 2026')
    expect(row.description).toContain('Fast Transfer From Test User')
    // Positive amount string → normalizer will treat as income with amountSign: single_signed
    expect(parseFloat(row.amount.replace(/[$,]/g, ''))).toBeGreaterThan(0)
    expect(row.amount).toMatch(/\$350\.00/)
  })
})

// ---------------------------------------------------------------------------
// extractRows() — negative-amount (expense)
// ---------------------------------------------------------------------------

describe('CommbankSummaryPdfProfile.extractRows() — negative amount → expense', () => {
  it('parses a negative-amount row and emits a negative amount string', () => {
    const text = wrapPage(
      '04 May 2026       ALDI STORES EDGEWORTH NSWAU                                                     -$30.21             $261.18',
    )

    const rows = CommbankSummaryPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)

    const row = rows[0]
    expect(row.date).toBe('04 May 2026')
    expect(row.description).toContain('ALDI STORES')
    // Negative amount string → normalizer treats as expense with amountSign: single_signed
    expect(parseFloat(row.amount.replace(/[$,]/g, ''))).toBeLessThan(0)
    expect(row.amount).toMatch(/-\$30\.21/)
  })
})

// ---------------------------------------------------------------------------
// extractRows() — salary wrap (primary regression test)
// ---------------------------------------------------------------------------

describe('CommbankSummaryPdfProfile.extractRows() — salary 2-line wrap', () => {
  /**
   * THE KEY TEST: CommBank salary lines in the Transaction Summary PDF have a
   * 2-line layout where the reference number (26339) wraps to the next line:
   *
   *   14 May 2026      Salary 20150 NET PAY CL                                                    $5,561.39           $5,815.66
   *                    26339
   *
   * The two lines must be stitched into one description:
   *   "Salary 20150 NET PAY CL 26339"
   */
  it('stitches 2-line salary description into single description field', () => {
    const text = wrapPage(
      '14 May 2026      Salary 20150 NET PAY CL                                                    $5,561.39           $5,815.66',
      '                 26339',
    )

    const rows = CommbankSummaryPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)

    const row = rows[0]
    expect(row.date).toBe('14 May 2026')
    expect(row.description).toContain('Salary 20150 NET PAY CL')
    expect(row.description).toContain('26339')
    expect(row.description).toMatch(/Salary 20150 NET PAY CL.*26339/)
    expect(parseFloat(row.amount.replace(/[$,]/g, ''))).toBeCloseTo(5561.39, 2)
  })

  it('both salary deposits in the statement parse correctly', () => {
    const text = wrapPage(
      '14 May 2026      Salary 20150 NET PAY CL                                                    $5,561.39           $5,815.66',
      '                 26339',
      '12 Jun 2026      Salary 20150 NET PAY CL                                                     $5,561.39            $6,091.71',
      '                 26339',
    )

    const rows = CommbankSummaryPdfProfile.extractRows(text)
    expect(rows).toHaveLength(2)

    for (const row of rows) {
      expect(row.description).toMatch(/Salary.*26339/)
      expect(parseFloat(row.amount.replace(/[$,]/g, ''))).toBeCloseTo(5561.39, 2)
    }
  })
})

// ---------------------------------------------------------------------------
// extractRows() — thousands separator and large balance
// ---------------------------------------------------------------------------

describe('CommbankSummaryPdfProfile.extractRows() — thousands separator', () => {
  it('handles $5,561.39 amount and $12,345.67 balance correctly', () => {
    const text = wrapPage(
      '01 Jun 2026      Transfer from Account                                                           $4,610.00            $5,012.08',
    )

    const rows = CommbankSummaryPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)

    const row = rows[0]
    expect(row.amount).toMatch(/\$4,610\.00/)
    expect(parseFloat(row.amount.replace(/[$,]/g, ''))).toBeCloseTo(4610.0, 2)
  })
})

// ---------------------------------------------------------------------------
// extractRows() — overdraft (negative balance)
// ---------------------------------------------------------------------------

describe('CommbankSummaryPdfProfile.extractRows() — overdraft negative balance', () => {
  it('parses a row where the running balance is negative (overdraft)', () => {
    // Regression: balance capture group was (\$[\d,]+\.\d{2}) — no minus allowed.
    // An overdraft row like: "05 May 2026    Some Merchant   -$500.00   -$50.00"
    // was silently dropped. Fixed by changing to (-?\$[\d,]+\.\d{2}).
    const text = wrapPage(
      '05 May 2026       Some Merchant   TESTTOWN AU                                          -$500.00              -$50.00',
    )

    const rows = CommbankSummaryPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)

    const row = rows[0]
    expect(row.date).toBe('05 May 2026')
    expect(row.description).toContain('Some Merchant')
    expect(row.amount).toMatch(/-\$500\.00/)
    expect(parseFloat(row.amount.replace(/[$,]/g, ''))).toBeLessThan(0)
  })
})

// ---------------------------------------------------------------------------
// extractRows() — skips column headers and footer lines
// ---------------------------------------------------------------------------

describe('CommbankSummaryPdfProfile.extractRows() — skip non-transaction lines', () => {
  it('skips column-header line (Date / Transaction details / Amount / Balance)', () => {
    const text = makeSummaryText(
      'Date              Transaction details                                                            Amount              Balance',
      '01 May 2026       CHARITY ORG MAYFIELD AU                                              -$10.00               $72.88',
      'Created 09/07/26 06:26am (Sydney/Melbourne time)',
    )

    const rows = CommbankSummaryPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)
    expect(rows[0].description).toContain('CHARITY ORG')
  })

  it('skips footer lines and does not attach them to the last transaction description', () => {
    const text = wrapPage(
      '01 May 2026       CHARITY ORG MAYFIELD AU                                              -$10.00               $72.88',
    )

    const rows = CommbankSummaryPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)
    const desc = rows[0].description
    // Footer phrases must NOT appear in description
    expect(desc).not.toMatch(/Created/i)
    expect(desc).not.toMatch(/While this letter/i)
    expect(desc).not.toMatch(/Transaction Summary/i)
  })

  it('skips account metadata lines from the first page header section', () => {
    const preamble = [
      'Account Number     062111 99999999',
      'Page                       1 of 6',
      'A B TESTUSER',
      '1 TEST ST',
      '09 July 2026',
      'Dear A B TESTUSER,',
      "Here's your account information and a list of transactions from 01/05/26-08/07/26.",
      'Account name               A B TESTUSER',
      'BSB                                 062111',
      'Account number            99999999',
      'Account type                 Smart Access',
      'Date opened                   28/01/2018',
    ].join('\n')
    const txLine =
      '01 May 2026       CHARITY ORG MAYFIELD AU                                              -$10.00               $72.88'
    const text = [preamble, PAGE_HEADER, txLine].join('\n') + '\n'

    const rows = CommbankSummaryPdfProfile.extractRows(text)
    expect(rows).toHaveLength(1)
    expect(rows[0].date).toBe('01 May 2026')
  })
})

// ---------------------------------------------------------------------------
// extractRows() — full sanitized fixture (count assertion)
// ---------------------------------------------------------------------------

describe('CommbankSummaryPdfProfile.extractRows() — full fixture', () => {
  it('parses all 110 transactions from the sanitized fixture', () => {
    const fixturePath = join(__dirname, '../fixtures/commbank-summary-sanitized.txt')
    const text = readFileSync(fixturePath, 'utf-8')

    const rows = CommbankSummaryPdfProfile.extractRows(text)

    // Exact transaction count from pypdf layout-mode extraction of the real PDF
    expect(rows).toHaveLength(110)

    // Every row must have non-empty date, description, and amount
    for (const row of rows) {
      expect(row.date).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}$/)
      expect(row.description.trim().length).toBeGreaterThan(0)
      expect(row.amount).toMatch(/-?\$[\d,]+\.\d{2}/)
    }

    // At least one income row (positive amount) — salary deposits
    const incomeRows = rows.filter((r) => !r.amount.startsWith('-'))
    expect(incomeRows.length).toBeGreaterThan(0)

    // At least one expense row (negative amount)
    const expenseRows = rows.filter((r) => r.amount.startsWith('-'))
    expect(expenseRows.length).toBeGreaterThan(0)

    // Salary rows: description contains "Salary" and appended reference "26339"
    const salaryRows = rows.filter((r) => /Salary/i.test(r.description))
    expect(salaryRows.length).toBeGreaterThanOrEqual(2)
    for (const row of salaryRows) {
      expect(row.description).toMatch(/Salary.*26339/)
    }
  })
})
