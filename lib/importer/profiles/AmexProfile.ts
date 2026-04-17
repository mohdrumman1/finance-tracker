import type { BankProfile } from './ProfileRegistry'

export const AmexProfile: BankProfile = {
  id: 'amex',
  name: 'American Express',
  fileType: 'csv',
  hasHeader: true,
  columnMap: {
    date: 'Date',
    amount: 'Amount',
    description: 'Description',
    // 'Date Processed', 'Card Member', 'Account #' columns are ignored
  },
  dateFormat: 'dd/MM/yyyy',
  amountSign: 'debit_positive', // positive = charge (expense), negative = credit/payment (income)
  skipRows: 0,
}
