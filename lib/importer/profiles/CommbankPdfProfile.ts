import type { ParsedRow } from '../parsers/CsvParser'
import type { PdfBankProfile } from './ProfileRegistry'

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

// Line starts a new transaction block
const DATE_START_RE = /^\d{1,2}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i

// Two properly comma-formatted amounts at end of line, then CR|DR.
// Using [\d]{1,3}(?:,\d{3})* requires correct thousands-comma placement,
// which distinguishes real amounts from run-together reference numbers.
const AMOUNTS_END_RE =
  /([\d]{1,3}(?:,\d{3})*\.\d{2})([\d]{1,3}(?:,\d{3})*\.\d{2})(CR|DR)$/i

// Single amount (for opening balance line which has no preceding debit/credit amount)
const SINGLE_AMOUNT_END_RE = /([\d]{1,3}(?:,\d{3})*\.\d{2})(CR|DR)?$/i

export const CommbankPdfProfile: PdfBankProfile = {
  id: 'commbank-pdf',
  name: 'CommBank (PDF)',
  fileType: 'pdf',
  columnMap: {
    date: 'date',
    description: 'description',
    debit: 'debit',
    credit: 'credit',
    balance: 'balance',
  },
  dateFormat: 'dd MMM yyyy',
  amountSign: 'single_signed',
  transactionLineRegex: /^$/, // not used - extractRows handles all parsing

  detect(text: string): boolean {
    return /commonwealth\s+bank|netbank|commbank/i.test(text)
  },

  mapMatch(): ParsedRow {
    return { date: '', description: '', amount: '', debit: '0', credit: '0', balance: '' }
  },

  extractRows(text: string): ParsedRow[] {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)

    // Find start year only from lines that START with a date pattern (transaction lines).
    // This avoids picking up the statement period footer (e.g. "31Jan2026") which appears
    // before the opening balance and would set the wrong year for the whole statement.
    let startYear = new Date().getFullYear()
    for (const line of lines) {
      if (!DATE_START_RE.test(line)) continue
      const m = line.match(/^\d{1,2}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})/i)
      if (m) { startYear = parseInt(m[1]); break }
    }

    // Group lines: a new block starts whenever a line begins with a date pattern
    const blocks: string[][] = []
    for (const line of lines) {
      if (DATE_START_RE.test(line)) {
        blocks.push([line])
      } else if (blocks.length > 0) {
        blocks[blocks.length - 1].push(line)
      }
    }

    const rows: ParsedRow[] = []
    let currentYear = startYear
    let prevMonth = -1
    let prevBalance: number | null = null

    for (const block of blocks) {
      const firstLine = block[0]

      // Opening balance: extract the balance for tracking but skip as a transaction
      if (/OPENINGBALANCE/i.test(firstLine)) {
        for (let i = block.length - 1; i >= 0; i--) {
          const m = block[i].match(SINGLE_AMOUNT_END_RE)
          if (m) { prevBalance = parseFloat(m[1].replace(/,/g, '')); break }
        }
        continue
      }

      // Extract date from first line
      const dateMatch = firstLine.match(
        /^(\d{1,2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})?/i
      )
      if (!dateMatch) continue

      // Find the last line in the block that ends with two amounts + CR|DR.
      // Scanning from the bottom skips trailing junk lines (page-break artifacts).
      let amountsMatch: RegExpMatchArray | null = null
      let amountsLineIdx = -1
      for (let i = block.length - 1; i >= 0; i--) {
        amountsMatch = block[i].match(AMOUNTS_END_RE)
        if (amountsMatch) { amountsLineIdx = i; break }
      }
      if (!amountsMatch || amountsLineIdx < 0) continue

      // Track year rollover (month number decreasing means we crossed into a new year)
      const monthNum = MONTHS[dateMatch[2].toLowerCase()] ?? 1
      if (prevMonth > 0 && monthNum < prevMonth) currentYear++
      prevMonth = monthNum

      const balance = parseFloat(amountsMatch[2].replace(/,/g, ''))

      // Compute the transaction amount from the balance change.
      // This is more reliable than the regex-extracted first capture group, because
      // CommBank PDFs concatenate reference numbers directly before the amount
      // (e.g. "3760009751210011,006.67452.14CR") making the first capture unreliable.
      const txAmount =
        prevBalance !== null
          ? Math.round(Math.abs(balance - prevBalance) * 100) / 100
          : parseFloat(amountsMatch[1].replace(/,/g, ''))

      let debit = '0'
      let credit = '0'
      if (prevBalance !== null && balance > prevBalance) {
        credit = txAmount.toFixed(2)
      } else {
        debit = txAmount.toFixed(2)
      }
      prevBalance = balance

      // Format date as "02 Aug 2025" to match dateFormat 'dd MMM yyyy'
      const day = dateMatch[1].padStart(2, '0')
      const mon = dateMatch[2].charAt(0).toUpperCase() + dateMatch[2].slice(1).toLowerCase()
      const year = dateMatch[3] ? parseInt(dateMatch[3]) : currentYear
      const formattedDate = `${day} ${mon} ${year}`

      // Build description from:
      //   • remainder of the first line after the date prefix
      //   • any middle lines between first and the amounts line
      //   • the prefix of the amounts line before the matched amounts
      const datePrefix = dateMatch[0]
      const amountsLine = block[amountsLineIdx]
      const amountsSuffix = amountsMatch[0]
      const amountsLinePrefix = amountsLine.slice(0, amountsLine.length - amountsSuffix.length).trim()

      const descParts: string[] = [firstLine.slice(datePrefix.length).trim()]
      if (amountsLineIdx > 0) {
        const middleLines = block.slice(1, amountsLineIdx).join(' ').trim()
        if (middleLines) descParts.push(middleLines)
        if (amountsLinePrefix) descParts.push(amountsLinePrefix)
      }
      const description = descParts.filter(Boolean).join(' ')

      rows.push({ date: formattedDate, description, amount: '', debit, credit, balance: balance.toFixed(2) })
    }

    return rows
  },
}
