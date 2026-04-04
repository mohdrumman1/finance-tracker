export interface BankProfile {
  id: string
  name: string
  fileType: 'csv' | 'pdf'
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

    // CommBank: Date, Amount, Description, Balance
    if (
      normalized.includes('date') &&
      normalized.includes('amount') &&
      normalized.includes('description') &&
      normalized.includes('balance')
    ) {
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

    return null
  }

  listAll(): BankProfile[] {
    return profiles
  }
}
