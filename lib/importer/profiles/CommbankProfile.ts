import type { BankProfile } from './ProfileRegistry'

export const CommbankProfile: BankProfile = {
  id: 'commbank',
  name: 'CommBank',
  fileType: 'csv',
  columnMap: {
    date: 'Date',
    amount: 'Amount',
    description: 'Description',
    balance: 'Balance',
  },
  dateFormat: 'dd/MM/yyyy',
  amountSign: 'single_signed', // negative = debit (expense), positive = credit (income)
  skipRows: 0,
}
