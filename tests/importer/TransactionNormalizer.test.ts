import { describe, it, expect } from 'vitest'
import { TransactionNormalizer } from '../../lib/importer/normalizer/TransactionNormalizer'
import { CommbankProfile } from '../../lib/importer/profiles/CommbankProfile'
import { AmexProfile } from '../../lib/importer/profiles/AmexProfile'

describe('TransactionNormalizer', () => {
  const normalizer = new TransactionNormalizer()
  const accountId = 'test-account-id'

  it('normalizes a CommBank debit to positive amount, expense direction', () => {
    const row = {
      date: '01/04/2026',
      Date: '01/04/2026',
      amount: '-50.00',
      Amount: '-50.00',
      description: 'WOOLWORTHS SYDNEY',
      Description: 'WOOLWORTHS SYDNEY',
      Balance: '2950.00',
    }
    const result = normalizer.normalize(row, CommbankProfile, accountId)
    expect(result.amount).toBe(50)
    expect(result.direction).toBe('expense')
    expect(result.accountId).toBe(accountId)
    expect(result.currency).toBe('AUD')
  })

  it('normalizes a CommBank credit to positive amount, income direction', () => {
    const row = {
      date: '01/04/2026',
      Date: '01/04/2026',
      amount: '5000.00',
      Amount: '5000.00',
      description: 'PAYROLL ACME CORP',
      Description: 'PAYROLL ACME CORP',
      Balance: '7950.00',
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
      date: 'not-a-date',
      Date: 'not-a-date',
      amount: '-50.00',
      Amount: '-50.00',
      description: 'TEST',
      Description: 'TEST',
    }
    expect(() => normalizer.normalize(row, CommbankProfile, accountId)).toThrow()
  })

  it('detects transfer transactions', () => {
    const row = {
      date: '01/04/2026',
      Date: '01/04/2026',
      amount: '-200.00',
      Amount: '-200.00',
      description: 'TRANSFER TO SAVINGS ACCOUNT',
      Description: 'TRANSFER TO SAVINGS ACCOUNT',
      Balance: '800.00',
    }
    const result = normalizer.normalize(row, CommbankProfile, accountId)
    expect(result.direction).toBe('transfer')
    expect(result.isTransfer).toBe(true)
  })

  it('normalizes description to uppercase', () => {
    const row = {
      date: '01/04/2026',
      Date: '01/04/2026',
      amount: '-15.00',
      Amount: '-15.00',
      description: 'uber eats sydney',
      Description: 'uber eats sydney',
      Balance: '100.00',
    }
    const result = normalizer.normalize(row, CommbankProfile, accountId)
    expect(result.descriptionNormalized).toBe('UBER EATS SYDNEY')
  })
})
