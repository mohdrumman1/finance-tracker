export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function percentage(part: number, total: number): number {
  if (total === 0) return 0
  return parseFloat(((part / total) * 100).toFixed(2))
}

export function average(values: number[]): number {
  if (values.length === 0) return 0
  return parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
}

export function sum(values: number[]): number {
  return parseFloat(values.reduce((a, b) => a + b, 0).toFixed(2))
}
