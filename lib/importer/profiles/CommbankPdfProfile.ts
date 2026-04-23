import type { ParsedRow } from '../parsers/CsvParser'
import type { PdfBankProfile } from './ProfileRegistry'

// CommBank PDF transaction lines look like either:
//   14 Apr 2026  WOOLWORTHS 1234 SYDNEY NSW    55.00 DR    1,100.00
//   14 Apr 2026  SALARY ACME PTY LTD           3,200.00 CR    4,300.00
// Some descriptions span multiple words with irregular spacing.
const TX_REGEX =
  /^(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\s{2,}(.+?)\s{2,}([\d,]+\.\d{2})\s+(DR|CR)\s+([\d,]+\.\d{2})\s*$/i

export const CommbankPdfProfile: PdfBankProfile = {
  id: 'commbank-pdf',
  name: 'CommBank (PDF)',
  fileType: 'pdf',
  // columnMap, hasHeader, amountSign, dateFormat used by normalizer
  columnMap: {
    date: 'date',
    description: 'description',
    debit: 'debit',
    credit: 'credit',
    balance: 'balance',
  },
  dateFormat: 'dd MMM yyyy',
  amountSign: 'single_signed', // not used — debit/credit columns take precedence
  transactionLineRegex: TX_REGEX,

  detect(text: string): boolean {
    return /commonwealth\s+bank|netbank|commbank/i.test(text)
  },

  mapMatch(match: RegExpMatchArray): ParsedRow {
    const [, date, description, amount, direction, balance] = match
    const isDebit = direction.toUpperCase() === 'DR'
    return {
      date: date.trim(),
      description: description.trim(),
      amount: '',
      debit: isDebit ? amount.replace(/,/g, '') : '0',
      credit: isDebit ? '0' : amount.replace(/,/g, ''),
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
