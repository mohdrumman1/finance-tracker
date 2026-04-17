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
}

import { CommbankProfile } from './CommbankProfile'
import { AmexProfile } from './AmexProfile'
import { GenericProfile } from './GenericProfile'

const profiles: BankProfile[] = [CommbankProfile, AmexProfile, GenericProfile]

export class ProfileRegistry {
  getProfile(id: string): BankProfile {
    const profile = profiles.find((p) => p.id === id)
    if (!profile) throw new Error(`Unknown bank profile: ${id}`)
    return profile
  }

  detect(headers: string[]): BankProfile | null {
    const normalized = headers.map((h) => h.toLowerCase().trim())

    // CommBank: headerless — first row is data like ["15/04/2026", "-85.14", "Description", "+6034.20"]
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
    return profiles
  }
}
