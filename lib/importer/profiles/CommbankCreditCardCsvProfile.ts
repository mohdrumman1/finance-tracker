import type { BankProfile } from './ProfileRegistry'

/**
 * CommBank Credit Card CSV export.
 *
 * Header row: Date,Date Processed,Description,Card Member,Account #,Amount
 * Sign convention: positive amount = expense (charge), negative = income (payment received).
 *
 * Example rows:
 *   03/07/2026,04/07/2026,WOOLWORTHS 1278 CAMERON PARK,M RIYAZ,-21001,66.75   ← expense
 *   02/07/2026,02/07/2026,ONLINE PAYMENT RECEIVED - THANKYOU W1268,M RIYAZ,-21001,-1008.53  ← income
 */
export const CommbankCreditCardCsvProfile: BankProfile & {
  detect: (firstRow: string[]) => boolean
} = {
  id: 'commbank-credit-card',
  name: 'CommBank Credit Card (CSV)',
  fileType: 'csv',
  hasHeader: true,
  columnMap: {
    date: 'Date',
    description: 'Description',
    amount: 'Amount',
    // Date Processed, Card Member, Account # are ignored
  },
  dateFormat: 'dd/MM/yyyy',
  amountSign: 'debit_positive', // positive = expense, negative = income/payment

  /**
   * Detect by checking the 6-column header signature unique to CommBank credit card exports.
   * Called with the parsed first row (headers array) from the CSV.
   */
  detect(firstRow: string[]): boolean {
    if (firstRow.length !== 6) return false
    // Strip UTF-8 BOM (U+FEFF) that Excel sometimes prepends to the first cell.
    const [d0, d1, d2, d3, d4, d5] = firstRow.map((h) => h.replace(/^﻿/, '').toLowerCase().trim())
    return (
      d0 === 'date' &&
      d1 === 'date processed' &&
      d2 === 'description' &&
      d3 === 'card member' &&
      d4 === 'account #' &&
      d5 === 'amount'
    )
  },
}
