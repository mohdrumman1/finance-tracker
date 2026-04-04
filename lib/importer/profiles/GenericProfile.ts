import type { BankProfile } from './ProfileRegistry'

export const GenericProfile: BankProfile = {
  id: 'generic',
  name: 'Generic CSV',
  fileType: 'csv',
  columnMap: {
    date: 'Date',
    description: 'Description',
    amount: 'Amount',
  },
  dateFormat: 'dd/MM/yyyy',
  amountSign: 'single_signed',
  skipRows: 0,
}
