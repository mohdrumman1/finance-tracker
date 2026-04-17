import type { ParsedRow } from '../parsers/CsvParser'
import type { BankProfile } from '../profiles/ProfileRegistry'
import { parseDate } from '../../utils/dateUtils'

export interface NormalizedTransaction {
  id?: string
  accountId: string
  sourceType: 'csv' | 'pdf' | 'manual'
  transactionDate: Date
  descriptionRaw: string
  descriptionNormalized: string
  merchantName: string | null
  amount: number // always positive
  currency: string
  direction: 'income' | 'expense' | 'transfer'
  categoryId: string | null
  subcategoryId: string | null
  isRecurring: boolean
  isTransfer: boolean
  confidenceScore: number
  reviewStatus: 'pending' | 'needs_review' | 'auto_categorized'
  isDuplicate?: boolean
}

export class TransactionNormalizer {
  normalize(row: ParsedRow, profile: BankProfile, accountId: string): NormalizedTransaction {
    const dateCol = String(profile.columnMap.date)
    const descCol = String(profile.columnMap.description)
    const amountCol = profile.columnMap.amount !== undefined ? String(profile.columnMap.amount) : undefined
    const debitCol = profile.columnMap.debit !== undefined ? String(profile.columnMap.debit) : undefined
    const creditCol = profile.columnMap.credit !== undefined ? String(profile.columnMap.credit) : undefined

    const dateStr = row[dateCol] ?? ''
    const descriptionRaw = row[descCol] ?? ''

    // Parse date
    const transactionDate = parseDate(dateStr, profile.dateFormat)
    if (!transactionDate) {
      throw new Error(`Invalid date "${dateStr}" for format ${profile.dateFormat}`)
    }

    // Parse amount
    let rawAmount = 0
    let direction: 'income' | 'expense' | 'transfer' = 'expense'

    if (amountCol && row[amountCol] !== undefined) {
      rawAmount = this.parseAmount(row[amountCol] ?? '0')
    } else if (debitCol && creditCol) {
      const debit = this.parseAmount(row[debitCol] ?? '0')
      const credit = this.parseAmount(row[creditCol] ?? '0')
      if (credit > 0) {
        rawAmount = credit
        direction = 'income'
      } else {
        rawAmount = debit
        direction = 'expense'
      }
    }

    // Determine direction based on profile's amountSign
    if (amountCol) {
      if (profile.amountSign === 'single_signed') {
        // negative = expense, positive = income
        if (rawAmount < 0) {
          direction = 'expense'
        } else {
          direction = 'income'
        }
      } else if (profile.amountSign === 'debit_positive') {
        // positive = expense (charge), negative = income (payment/credit)
        if (rawAmount >= 0) {
          direction = 'expense'
        } else {
          direction = 'income'
        }
      } else if (profile.amountSign === 'debit_negative') {
        // negative = expense, positive = income
        if (rawAmount < 0) {
          direction = 'expense'
        } else {
          direction = 'income'
        }
      }
    }

    const amount = Math.abs(rawAmount)

    // Normalize description
    const descriptionNormalized = this.normalizeDescription(descriptionRaw)
    const merchantName = this.extractMerchantName(descriptionNormalized)

    // Detect transfers
    const isTransfer = this.detectTransfer(descriptionNormalized)
    if (isTransfer) {
      direction = 'transfer'
    }

    return {
      accountId,
      sourceType: profile.fileType,
      transactionDate,
      descriptionRaw,
      descriptionNormalized,
      merchantName,
      amount,
      currency: 'AUD',
      direction,
      categoryId: null,
      subcategoryId: null,
      isRecurring: false,
      isTransfer,
      confidenceScore: 0,
      reviewStatus: 'pending',
    }
  }

  private parseAmount(raw: string): number {
    const cleaned = raw.replace(/[,$\s]/g, '').replace(/[()]/g, (m) => (m === '(' ? '-' : ''))
    return parseFloat(cleaned) || 0
  }

  private normalizeDescription(raw: string): string {
    return raw
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-&./]/g, '')
      .trim()
  }

  private extractMerchantName(normalized: string): string | null {
    if (!normalized) return null
    // Take first meaningful part before common suffixes
    const parts = normalized.split(/\s+/)
    if (parts.length === 0) return null
    // Return first 3-4 words as merchant name approximation
    return parts.slice(0, Math.min(4, parts.length)).join(' ')
  }

  private detectTransfer(description: string): boolean {
    const transferPatterns = [
      /\bTRANSFER\b/,
      /\bTFR\b/,
      /\bINTERNAL\b/,
      /\bBALANCE\s+TRANSFER\b/,
      // Credit card payments from bank accounts (e.g. CommBank paying AmEx bill)
      /\bAMERICAN\s+EXPRESS\b/,
      /\bAMEX\b/,
      /\bCREDIT\s+CARD\s+PAYMENT\b/,
      /\bCREDIT\s+CARD\s+REPAYMENT\b/,
      // AmEx statement: incoming payment from bank to settle the balance
      /\bONLINE\s+PAYMENT\s+RECEIVED\b/,
      /\bTHANKYOU\b/,
    ]
    return transferPatterns.some((p) => p.test(description))
  }
}
