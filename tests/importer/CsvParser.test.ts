import { describe, it, expect } from 'vitest'
import { CsvParser } from '../../lib/importer/parsers/CsvParser'

const commbankCsv = `Date,Amount,Description,Balance
01/04/2026,-50.00,WOOLWORTHS SYDNEY,2950.00
02/04/2026,5000.00,PAYROLL ACME CORP,7950.00
03/04/2026,-12.99,NETFLIX.COM,7937.01`

const amexCsv = `Date,Amount,Description
01/04/2026,50.00,WOOLWORTHS SYDNEY
02/04/2026,12.99,NETFLIX.COM
03/04/2026,-2000.00,PAYMENT RECEIVED`

describe('CsvParser', () => {
  const parser = new CsvParser()

  it('parses valid CommBank CSV into correct row count', () => {
    const rows = parser.parse(commbankCsv)
    expect(rows).toHaveLength(3)
    expect(rows[0].Date).toBe('01/04/2026')
    expect(rows[0].Amount).toBe('-50.00')
    expect(rows[0].Description).toBe('WOOLWORTHS SYDNEY')
    expect(rows[0].Balance).toBe('2950.00')
  })

  it('parses valid Amex CSV into correct row count', () => {
    const rows = parser.parse(amexCsv)
    expect(rows).toHaveLength(3)
    expect(rows[0].Date).toBe('01/04/2026')
    expect(rows[0].Amount).toBe('50.00')
    expect(rows[0].Description).toBe('WOOLWORTHS SYDNEY')
  })

  it('handles empty file gracefully', () => {
    const rows = parser.parse('')
    expect(rows).toHaveLength(0)
  })

  it('handles whitespace-only file gracefully', () => {
    const rows = parser.parse('   \n  ')
    expect(rows).toHaveLength(0)
  })

  it('returns rows even with extra whitespace in headers', () => {
    const csv = ` Date , Amount , Description \n01/04/2026,-50.00,WOOLWORTHS`
    const rows = parser.parse(csv)
    expect(rows).toHaveLength(1)
  })
})
