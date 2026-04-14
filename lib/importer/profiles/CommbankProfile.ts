import type { BankProfile } from './ProfileRegistry'

export const CommbankProfile: BankProfile = {
  id: 'commbank',
  name: 'CommBank',
  fileType: 'csv',
  hasHeader: false, // CommBank CSVs have no header row
  columnMap: {
    date: 0,        // col 0: "15/04/2026"
    amount: 1,      // col 1: "-85.14" (negative = expense, positive = income)
    description: 2, // col 2: "Direct Debit 000517 AMERICAN EXPRESS..."
    balance: 3,     // col 3: "+6034.20"
  },
  dateFormat: 'dd/MM/yyyy',
  amountSign: 'single_signed', // negative = debit (expense), positive = credit (income)
  skipRows: 0,
}
