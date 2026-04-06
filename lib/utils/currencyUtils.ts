export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function fromCents(cents: number): number {
  return cents / 100
}

export function formatCurrency(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function safeAdd(a: number, b: number): number {
  return parseFloat((a + b).toFixed(2))
}

export function safeSub(a: number, b: number): number {
  return parseFloat((a - b).toFixed(2))
}

export function safeMul(a: number, b: number): number {
  return parseFloat((a * b).toFixed(2))
}

export function safeDiv(a: number, b: number): number {
  if (b === 0) return 0
  return parseFloat((a / b).toFixed(4))
}
