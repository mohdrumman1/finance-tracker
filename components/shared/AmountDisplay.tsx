import React from 'react'
import { cn } from '@/lib/utils/cn'

interface AmountDisplayProps {
  amount: number
  direction: 'income' | 'expense' | 'transfer'
  currency?: string
  className?: string
}

export function AmountDisplay({
  amount,
  direction,
  currency = 'AUD',
  className,
}: AmountDisplayProps) {
  const formatted = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Math.abs(amount))

  const colorClass =
    direction === 'income'
      ? 'text-green-600'
      : direction === 'expense'
      ? 'text-red-600'
      : 'text-gray-500'

  const prefix = direction === 'income' ? '+' : direction === 'expense' ? '-' : ''

  return (
    <span className={cn('font-medium tabular-nums', colorClass, className)}>
      {prefix}
      {formatted}
    </span>
  )
}
