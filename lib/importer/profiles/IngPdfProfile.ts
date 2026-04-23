import type { ParsedRow } from '../parsers/CsvParser'
import type { PdfBankProfile } from './ProfileRegistry'

// ING Direct AU PDF transaction lines look like:
//   15 Apr 2026  OSKO PAYMENT TO JOHN SMITH       -250.00    1,234.56
//   01 Apr 2026  SALARY ACME PTY LTD              3,200.00   4,434.56
// Negative amount = expense, positive = income (single_signed)
const TX_REGEX =
  /^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\s{2,}(.+?)\s{2,}(-?[\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/i

export const IngPdfProfile: PdfBankProfile = {
  id: 'ing-pdf',
  name: 'ING (PDF)',
  fileType: 'pdf',
  columnMap: {
    date: 'date',
    description: 'description',
    amount: 'amount',
    balance: 'balance',
  },
  dateFormat: 'dd MMM yyyy',
  amountSign: 'single_signed',
  transactionLineRegex: TX_REGEX,

  detect(text: string): boolean {
    return /\bING\b/i.test(text) && /orange\s+everyday|savings\s+maximiser|living\s+super/i.test(text)
  },

  mapMatch(match: RegExpMatchArray): ParsedRow {
    const [, date, description, amount, balance] = match
    return {
      date: date.trim(),
      description: description.trim(),
      amount: amount.replace(/,/g, ''),
      balance: balance.replace(/,/g, ''),
    }
  },

  extractRows(text: string): ParsedRow[] {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((line) => line.match(TX_REGEX))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => this.mapMatch(m))
  },
}
