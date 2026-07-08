import type { ParsedRow } from '../parsers/CsvParser'
import type { PdfBankProfile } from './ProfileRegistry'

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

// Line starts a new transaction block.
// \s* handles both concatenated ("14Apr") and space-separated ("14 Apr") date formats
// produced by different pdf-parse rendering modes.
const DATE_START_RE = /^\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i

// Two properly comma-formatted amounts at end of line, then CR|DR.
// Using [\d]{1,3}(?:,\d{3})* requires correct thousands-comma placement,
// which distinguishes real amounts from run-together reference numbers.
// \s* between groups handles both concatenated ("55.001,100.00DR") and
// space-separated ("55.00 1,100.00DR") output from different pdf-parse renderers,
// including cases with multiple spaces (e.g. column-aligned PDF text extraction).
const AMOUNTS_END_RE =
  /([\d]{1,3}(?:,\d{3})*\.\d{2})\s*([\d]{1,3}(?:,\d{3})*\.\d{2})\s*(CR|DR)$/i

// Alternate CommBank format used by salary/payroll credit lines:
//   txAmount CR|DR balance   (marker appears between the amounts, not at end)
// e.g. "Salary 20150 NET PAY CL 26339 5,561.39 CR 5,815.66"
// Groups: [1]=txAmount  [2]=CR|DR  [3]=balance
const AMOUNTS_CR_MID_RE =
  /([\d]{1,3}(?:,\d{3})*\.\d{2})\s*(CR|DR)\s*([\d]{1,3}(?:,\d{3})*\.\d{2})$/i

// Single amount (for opening balance line which has no preceding debit/credit amount)
const SINGLE_AMOUNT_END_RE = /([\d]{1,3}(?:,\d{3})*\.\d{2})\s?(CR|DR)?$/i

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
    // Match classic CommBank PDF statements (NetBank / Commonwealth Bank).
    // Exclude the Transaction Summary letter format, which has "Transaction Summary"
    // in every page footer and is handled exclusively by CommbankSummaryPdfProfile.
    return (
      /commonwealth\s+bank|netbank|commbank/i.test(text) &&
      !/Transaction\s+Summary/i.test(text)
    )
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
      const m = line.match(/^\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{4})/i)
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

      // Opening balance: extract the balance for tracking but skip as a transaction.
      // Handle both concatenated ("OPENINGBALANCE") and spaced ("OPENING BALANCE") forms.
      if (/OPENING\s*BALANCE/i.test(firstLine)) {
        for (let i = block.length - 1; i >= 0; i--) {
          const m = block[i].match(SINGLE_AMOUNT_END_RE)
          if (m) { prevBalance = parseFloat(m[1].replace(/,/g, '')); break }
        }
        continue
      }

      // Extract date from first line - allow optional space between day and month
      const dateMatch = firstLine.match(
        /^(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})?/i
      )
      if (!dateMatch) continue

      // Find the last line in the block that ends with two amounts + CR|DR.
      // Scanning from the bottom skips trailing junk lines (page-break artifacts).
      // Two formats are tried:
      //   (a) AMOUNTS_END_RE:    txAmount balance CR|DR   — standard debit/expense format
      //   (b) AMOUNTS_CR_MID_RE: txAmount CR|DR balance   — salary/payroll credit format
      //       e.g. "Salary 20150 NET PAY CL 26339 5,561.39 CR 5,815.66"
      // Normalised outputs: parsedTxAmt, parsedBalance, parsedCRDR, parsedMatchFull
      let amountsLineIdx = -1
      let parsedTxAmt = ''
      let parsedBalance = ''
      let parsedCRDR = ''
      let parsedMatchFull = ''
      for (let i = block.length - 1; i >= 0; i--) {
        const m1 = block[i].match(AMOUNTS_END_RE)
        if (m1) {
          amountsLineIdx = i
          parsedTxAmt = m1[1]; parsedBalance = m1[2]; parsedCRDR = m1[3]; parsedMatchFull = m1[0]
          break
        }
        const m2 = block[i].match(AMOUNTS_CR_MID_RE)
        if (m2) {
          amountsLineIdx = i
          // Remap groups: txAmt=m2[1], CR|DR=m2[2], balance=m2[3]
          parsedTxAmt = m2[1]; parsedBalance = m2[3]; parsedCRDR = m2[2]; parsedMatchFull = m2[0]
          break
        }
      }
      if (amountsLineIdx < 0) continue

      // Track year rollover (month number decreasing means we crossed into a new year)
      const monthNum = MONTHS[dateMatch[2].toLowerCase()] ?? 1
      if (prevMonth > 0 && monthNum < prevMonth) currentYear++
      prevMonth = monthNum

      const balance = parseFloat(parsedBalance.replace(/,/g, ''))

      // Compute the transaction amount from the balance change.
      // This is more reliable than the regex-extracted first capture group, because
      // CommBank PDFs concatenate reference numbers directly before the amount
      // (e.g. "3760009751210011,006.67452.14CR") making the first capture unreliable.
      const txAmount =
        prevBalance !== null
          ? Math.round(Math.abs(balance - prevBalance) * 100) / 100
          : parseFloat(parsedTxAmt.replace(/,/g, ''))

      let debit = '0'
      let credit = '0'
      // Use the explicit CR/DR label from the PDF to determine direction.
      // The previous balance-delta approach (balance > prevBalance) was unreliable for
      // CommBank CREDIT CARD statements, where spending INCREASES the running balance
      // (you owe more), causing every purchase to appear as income. CR/DR is always
      // present in the regex capture and is authoritative regardless of account type.
      const drCr = parsedCRDR.toUpperCase()
      if (drCr === 'CR') {
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
      const amountsSuffix = parsedMatchFull
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
