import React from 'react'
import { Badge } from '@/components/ui/badge'

interface ConfidenceBadgeProps {
  score: number
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const pct = Math.round(score * 100)

  if (score >= 0.8) {
    return <Badge variant="success">{pct}% High</Badge>
  }
  if (score >= 0.6) {
    return <Badge variant="warning">{pct}% Medium</Badge>
  }
  return <Badge variant="destructive">{pct}% Low</Badge>
}
