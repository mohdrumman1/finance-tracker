import { describe, it, expect } from 'vitest'
import { TransactionNormalizer } from '../../lib/importer/normalizer/TransactionNormalizer'
import { CommbankProfile } from '../../lib/importer/profiles/CommbankProfile'
import { AmexProfile } from '../../lib/importer/profiles/AmexProfile'

describe('TransactionNormalizer', () => {
  const normalizer = new TransactionNormalizer()
  const accountId = 'test-account-id'

  it('normalizes a CommBank debit to positive amount, expense direction', () => {
    const row = {
      '0': '01/04/2026',
      '1': '-50.00',
      '2': 'WOOLWORTHS SYDNEY',
      '3': '2950.00',
    }
    const result = normalizer.normalize(row, CommbankProfile, accountId)
    expect(result.amount).toBe(50)
    expect(result.direction).toBe('expense')
    expect(result.accountId).toBe(accountId)
    expect(result.currency).toBe('AUD')
  })

  it('normalizes a CommBank credit to positive amount, income direction', () => {
    const row = {
      '0': '01/04/2026',
      '1': '5000.00',
      '2': 'PAYROLL ACME CORP',
      '3': '7950.00',
    }
    const result = normalizer.normalize(row, CommbankProfile, accountId)
    expect(result.amount).toBe(5000)
    expect(result.direction).toBe('income')
  })

  it('normalizes an Amex charge to expense direction', () => {
    const row = {
      date: '01/04/2026',
      Date: '01/04/2026',
      amount: '50.00',
      Amount: '50.00',
      description: 'WOOLWORTHS SYDNEY',
      Description: 'WOOLWORTHS SYDNEY',
    }
    const result = normalizer.normalize(row, AmexProfile, accountId)
    expect(result.amount).toBe(50)
    expect(result.direction).toBe('expense')
  })

  it('normalizes an Amex credit payment to income direction', () => {
    const row = {
      date: '01/04/2026',
      Date: '01/04/2026',
      amount: '-2000.00',
      Amount: '-2000.00',
      description: 'PAYMENT RECEIVED',
      Description: 'PAYMENT RECEIVED',
    }
    const result = normalizer.normalize(row, AmexProfile, accountId)
    expect(result.amount).toBe(2000)
    expect(result.direction).toBe('income')
  })

  it('handles malformed date with error', () => {
    const row = {
      '0': 'not-a-date',
      '1': '-50.00',
      '2': 'TEST',
    }
    expect(() => normalizer.normalize(row, CommbankProfile, accountId)).toThrow()
  })

  it('detects transfer transactions', () => {
    const row = {
      '0': '01/04/2026',
      '1': '-200.00',
      '2': 'TRANSFER TO SAVINGS ACCOUNT',
      '3': '800.00',
    }
    const result = normalizer.normalize(row, CommbankProfile, accountId)
    expect(result.direction).toBe('transfer')
    expect(result.isTransfer).toBe(true)
  })

  it('normalizes description to uppercase', () => {
    const row = {
      '0': '01/04/2026',
      '1': '-15.00',
      '2': 'uber eats sydney',
      '3': '100.00',
    }
    const result = normalizer.normalize(row, CommbankProfile, accountId)
    expect(result.descriptionNormalized).toBe('UBER EATS SYDNEY')
  })
})
