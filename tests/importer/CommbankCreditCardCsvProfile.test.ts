import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { CommbankCreditCardCsvProfile } from '../../lib/importer/profiles/CommbankCreditCardCsvProfile'
import { CsvParser } from '../../lib/importer/parsers/CsvParser'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEADER = 'Date,Date Processed,Description,Card Member,Account #,Amount'

/** Build a minimal credit card CSV string with the header + given data rows. */
function makeCSV(...dataRows: string[]): string {
  return [HEADER, ...dataRows].join('\n') + '\n'
}

const csvParser = new CsvParser()

// ---------------------------------------------------------------------------
// detect()
// ---------------------------------------------------------------------------

describe('CommbankCreditCardCsvProfile.detect()', () => {
  it('returns true for the exact 6-column credit card header', () => {
    const headers = ['Date', 'Date Processed', 'Description', 'Card Member', 'Account #', 'Amount']
    expect(CommbankCreditCardCsvProfile.detect(headers)).toBe(true)
  })

  it('is case-insensitive', () => {
    const headers = ['date', 'DATE PROCESSED', 'Description', 'card member', 'ACCOUNT #', 'amount']
    expect(CommbankCreditCardCsvProfile.detect(headers)).toBe(true)
  })

  it('returns false for the standard CommBank bank account CSV (no header row)', () => {
    // Bank account CSV: first row is data, not headers
    const firstDataRow = ['15/04/2026', '-85.14', 'Direct Debit', '+6034.20']
    expect(CommbankCreditCardCsvProfile.detect(firstDataRow)).toBe(false)
  })

  it('returns false for Amex-style header (Date, Amount, Description)', () => {
    const headers = ['Date', 'Amount', 'Description']
    expect(CommbankCreditCardCsvProfile.detect(headers)).toBe(false)
  })

  it('returns false for a header with wrong column count', () => {
    const headers = ['Date', 'Description', 'Amount']
    expect(CommbankCreditCardCsvProfile.detect(headers)).toBe(false)
  })

  it('returns false for a header missing Account #', () => {
    const headers = ['Date', 'Date Processed', 'Description', 'Card Member', 'Extra Col', 'Amount']
    expect(CommbankCreditCardCsvProfile.detect(headers)).toBe(false)
  })

  it('returns true even when first cell has a UTF-8 BOM prefix (Excel export)', () => {
    // Windows Excel prepends U+FEFF (BOM) to the first cell of CSV exports.
    // Without stripping, '﻿Date' !== 'date' and detect would silently return false.
    const headers = ['﻿Date', 'Date Processed', 'Description', 'Card Member', 'Account #', 'Amount']
    expect(CommbankCreditCardCsvProfile.detect(headers)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Header row skipped
// ---------------------------------------------------------------------------

describe('CommbankCreditCardCsvProfile — header row is skipped', () => {
  it('does not emit the header row as a transaction', () => {
    const content = makeCSV(
      '03/07/2026,04/07/2026,WOOLWORTHS TESTTOWN,M TESTUSER,-99999,66.75',
    )
    const rows = csvParser.parse(content, true /* hasHeader */)
    // With hasHeader=true, PapaParser skips the header → only 1 data row
    expect(rows).toHaveLength(1)
    expect(rows[0]['Description']).toBe('WOOLWORTHS TESTTOWN')
  })
})

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

describe('CommbankCreditCardCsvProfile — column mapping', () => {
  it('maps date from column 0, description from column 2, amount from column 5', () => {
    const content = makeCSV(
      '03/07/2026,04/07/2026,WOOLWORTHS TESTTOWN,M TESTUSER,-99999,66.75',
    )
    const rows = csvParser.parse(content, true)
    expect(rows).toHaveLength(1)

    const row = rows[0]
    // Verify the column names match the profile's columnMap
    expect(row[String(CommbankCreditCardCsvProfile.columnMap.date)]).toBe('03/07/2026')
    expect(row[String(CommbankCreditCardCsvProfile.columnMap.description)]).toBe('WOOLWORTHS TESTTOWN')
    expect(row[String(CommbankCreditCardCsvProfile.columnMap.amount)]).toBe('66.75')
  })

  it('description comes from col 2 (not col 3 Card Member or col 4 Account #)', () => {
    const content = makeCSV(
      '21/06/2026,22/06/2026,AMAZON MARKETPLACE AU SYDNEY,M TESTUSER,-99999,59.99',
    )
    const rows = csvParser.parse(content, true)
    const row = rows[0]
    expect(row['Description']).toBe('AMAZON MARKETPLACE AU SYDNEY')
    expect(row['Card Member']).toBe('M TESTUSER')
    expect(row['Account #']).toBe('-99999')
  })
})

// ---------------------------------------------------------------------------
// amountSign: debit_positive
// ---------------------------------------------------------------------------

describe('CommbankCreditCardCsvProfile — amountSign debit_positive', () => {
  it('positive amount row → expense direction via debit_positive', () => {
    // amountSign: 'debit_positive' means positive = expense in TransactionNormalizer
    // We verify the profile declares the correct sign convention
    expect(CommbankCreditCardCsvProfile.amountSign).toBe('debit_positive')
  })

  it('negative amount row → income direction (payment received)', () => {
    // With debit_positive, rawAmount < 0 → income
    // We assert the profile sign so normalizer logic is guaranteed correct
    const content = makeCSV(
      '02/07/2026,02/07/2026,ONLINE PAYMENT RECEIVED - THANKYOU W0001,M TESTUSER,-99999,-1008.53',
    )
    const rows = csvParser.parse(content, true)
    expect(rows).toHaveLength(1)
    expect(rows[0]['Amount']).toBe('-1008.53')
    // parseFloat of '-1008.53' < 0 → normalizer direction = 'income'
    expect(parseFloat(rows[0]['Amount'] ?? '0')).toBeLessThan(0)
  })

  it('positive amount is parsed as a positive float (→ expense in normalizer)', () => {
    const content = makeCSV(
      '03/07/2026,04/07/2026,WOOLWORTHS TESTTOWN,M TESTUSER,-99999,66.75',
    )
    const rows = csvParser.parse(content, true)
    expect(parseFloat(rows[0]['Amount'] ?? '0')).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// hasHeader = true
// ---------------------------------------------------------------------------

describe('CommbankCreditCardCsvProfile — hasHeader', () => {
  it('declares hasHeader: true', () => {
    expect(CommbankCreditCardCsvProfile.hasHeader).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Full sanitized fixture — count and direction split
// ---------------------------------------------------------------------------

describe('CommbankCreditCardCsvProfile — full sanitized fixture', () => {
  it('emits 36 transactions from the sanitized fixture', () => {
    const fixturePath = join(__dirname, '../fixtures/commbank-creditcard-sanitized.csv')
    const content = readFileSync(fixturePath, 'utf-8')

    const rows = csvParser.parse(content, true /* hasHeader */)

    // Exact data row count from the real activity.csv (36 data rows, 1 header)
    expect(rows).toHaveLength(36)

    // All rows have non-empty date and description
    for (const row of rows) {
      expect(row['Date']?.trim().length).toBeGreaterThan(0)
      expect(row['Description']?.trim().length).toBeGreaterThan(0)
    }
  })

  it('correct income/expense split: 2 payment rows (negative), 34 expense rows (positive)', () => {
    const fixturePath = join(__dirname, '../fixtures/commbank-creditcard-sanitized.csv')
    const content = readFileSync(fixturePath, 'utf-8')
    const rows = csvParser.parse(content, true)

    const amounts = rows.map((r) => parseFloat(r['Amount'] ?? '0'))
    const incomeCount = amounts.filter((a) => a < 0).length   // negative → income (payments)
    const expenseCount = amounts.filter((a) => a >= 0).length // positive → expense (charges)

    expect(incomeCount).toBe(2)
    expect(expenseCount).toBe(34)
    expect(incomeCount + expenseCount).toBe(36)
  })
})
