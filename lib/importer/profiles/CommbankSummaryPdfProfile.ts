import type { ParsedRow } from '../parsers/CsvParser'
import type { PdfBankProfile } from './ProfileRegistry'

// Transaction line: DD Mon YYYY  <description>  <signed_amount>  <balance>
// Uses \s{2,} as column separator (at least 2 spaces before amounts).
// Greedy (.*) captures the full description, then backtracks to the last separator.
const DATE_TX_RE =
  /^(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(.*)\s{2,}(-?\$[\d,]+\.\d{2})\s+(-?\$[\d,]+\.\d{2})\s*$/i

// Lines to skip: page headers, footers, account metadata, column headers.
// These are distinctive enough not to conflict with description content.
const SKIP_LINE_RE =
  /^(?:Date\s+Transaction|Created \d|While this letter|we'?re not responsible|Account Number\s|Page\s+\d|Any pending|cleared\.|If you have|Kind regards|The CommBank|Transaction Summary\s+v|Here'?s your|Dear |Account name\s|BSB\s|Account number\s|Account type\s|Date opened\s|commbank\.com)/i

export const CommbankSummaryPdfProfile: PdfBankProfile = {
  id: 'commbank-summary-pdf',
  name: 'CommBank Transaction Summary (PDF)',
  fileType: 'pdf',
  columnMap: {
    date: 'date',
    description: 'description',
    amount: 'amount',
  },
  dateFormat: 'dd MMM yyyy',
  amountSign: 'single_signed', // negative = expense, positive = income
  transactionLineRegex: /^$/, // unused — extractRows handles all parsing

  /**
   * Detect the CommBank letter-format ("Transaction Summary") PDF.
   * Discriminator: "Transaction Summary" appears in the page footer of this format,
   * plus signed dollar amounts like -$10.00. The classic CommBank statement has
   * neither of these markers.
   */
  detect(text: string): boolean {
    return /Transaction\s+Summary/i.test(text) && /-\$[\d,]+\.\d{2}/.test(text)
  },

  mapMatch(): ParsedRow {
    return { date: '', description: '', amount: '' }
  },

  /**
   * Extract transaction rows from the CommBank Transaction Summary PDF.
   *
   * Layout (from pypdf layout-mode extraction):
   *   01 May 2026       MERCHANT NAME SUBURB AU                   -$30.21               $261.18
   *                     Reference note                              ← continuation line
   *   14 May 2026      Salary 20150 NET PAY CL                  $5,561.39           $5,815.66
   *                    26339                                        ← reference appended to description
   *
   * Rules:
   * - Lines matching DATE_TX_RE start a new transaction.
   * - Continuation lines (no date / no amount pair at end) are appended to the
   *   current transaction's description.
   * - Header/footer lines matched by SKIP_LINE_RE are discarded; they also reset
   *   the continuation flag so page-break artifacts don't bleed into descriptions.
   */
  extractRows(text: string): ParsedRow[] {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    const rows: ParsedRow[] = []

    let currentDate: string | null = null
    let currentDesc = ''
    let currentAmount = ''
    let expectingContinuation = false

    const flush = () => {
      if (currentDate !== null) {
        rows.push({
          date: currentDate,
          description: currentDesc.trim(),
          amount: currentAmount,
        })
        currentDate = null
        currentDesc = ''
        currentAmount = ''
      }
    }

    for (const line of lines) {
      // Skip header / footer lines; page breaks also end continuation context.
      if (SKIP_LINE_RE.test(line)) {
        expectingContinuation = false
        continue
      }

      const m = DATE_TX_RE.exec(line)
      if (m) {
        flush()
        const [, day, mon, year, desc, amtStr] = m
        const monFormatted = mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()
        currentDate = `${day.padStart(2, '0')} ${monFormatted} ${year}`
        currentDesc = desc.trim()
        // Keep raw signed dollar string — TransactionNormalizer.parseAmount strips $ and ,
        currentAmount = amtStr
        expectingContinuation = true
      } else if (expectingContinuation && currentDate !== null) {
        // Continuation line — append reference/note to description.
        // Covers both short references (26339) and free-text notes (CommBank App food).
        currentDesc = currentDesc ? currentDesc + ' ' + line : line
      }
    }

    flush()
    return rows
  },
}
