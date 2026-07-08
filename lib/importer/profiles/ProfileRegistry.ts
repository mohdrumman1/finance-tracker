import type { ParsedRow } from '../parsers/CsvParser'

export interface BankProfile {
  id: string
  name: string
  fileType: 'csv' | 'pdf'
  hasHeader?: boolean // default true; set false for headerless CSVs (use numeric column indices in columnMap)
  columnMap: {
    date: string | number
    description: string | number
    amount?: string | number
    debit?: string | number
    credit?: string | number
    balance?: string | number
  }
  dateFormat: string
  amountSign: 'debit_negative' | 'debit_positive' | 'single_signed'
  skipRows?: number
  /** Optional per-profile CSV detection. Called with the first row (headers or data). */
  detect?: (firstRow: string[]) => boolean
}

export interface PdfBankProfile extends BankProfile {
  fileType: 'pdf'
  transactionLineRegex: RegExp
  detect: (text: string) => boolean
  mapMatch: (match: RegExpMatchArray) => ParsedRow
  extractRows: (text: string) => ParsedRow[]
}

import { CommbankProfile } from './CommbankProfile'
import { CommbankCreditCardCsvProfile } from './CommbankCreditCardCsvProfile'
import { AmexProfile } from './AmexProfile'
import { GenericProfile } from './GenericProfile'
import { CommbankPdfProfile } from './CommbankPdfProfile'
import { CommbankSummaryPdfProfile } from './CommbankSummaryPdfProfile'
import { IngPdfProfile } from './IngPdfProfile'

// Credit card CSV must appear before CommBank bank-account CSV so profile-specific
// detect() runs first (credit card has a header row; bank account is headerless).
const csvProfiles: BankProfile[] = [CommbankCreditCardCsvProfile, CommbankProfile, AmexProfile, GenericProfile]
// CommBank Summary PDF before classic CommBank PDF — more specific detect() fires first.
const pdfProfiles: PdfBankProfile[] = [CommbankSummaryPdfProfile, CommbankPdfProfile, IngPdfProfile]

export function detectPdfProfile(text: string): PdfBankProfile {
  for (const profile of pdfProfiles) {
    if (profile.detect(text)) return profile
  }
  // Default to CommBank PDF as the most common AU bank format
  return CommbankPdfProfile
}

export class ProfileRegistry {
  getProfile(id: string): BankProfile {
    const all: BankProfile[] = [...csvProfiles, ...pdfProfiles]
    const profile = all.find((p) => p.id === id)
    if (!profile) throw new Error(`Unknown bank profile: ${id}`)
    return profile
  }

  getPdfProfile(id: string): PdfBankProfile {
    const profile = pdfProfiles.find((p) => p.id === id)
    if (!profile) throw new Error(`Unknown PDF bank profile: ${id}`)
    return profile
  }

  detect(headers: string[]): BankProfile | null {
    const normalized = headers.map((h) => h.toLowerCase().trim())

    // Profile-specific detection runs first (most specific wins).
    // Currently only CommbankCreditCardCsvProfile has a detect() method.
    for (const profile of csvProfiles) {
      if (profile.detect?.(headers)) return profile
    }

    // CommBank bank account: headerless — first row is data like ["15/04/2026", "-85.14", "Description", "+6034.20"]
    // Detect by checking if first column looks like a date (dd/MM/yyyy)
    if (headers.length >= 3 && /^\d{2}\/\d{2}\/\d{4}$/.test(headers[0]?.trim())) {
      return CommbankProfile
    }

    // Amex: Date, Amount, Description (no balance)
    if (
      normalized.includes('date') &&
      normalized.includes('amount') &&
      normalized.includes('description') &&
      !normalized.includes('balance')
    ) {
      return AmexProfile
    }

    // Generic: Date, Amount, Description, Balance (with headers)
    if (
      normalized.includes('date') &&
      normalized.includes('amount') &&
      normalized.includes('description') &&
      normalized.includes('balance')
    ) {
      return CommbankProfile
    }

    return null
  }

  listAll(): BankProfile[] {
    return [...csvProfiles, ...pdfProfiles]
  }
}
