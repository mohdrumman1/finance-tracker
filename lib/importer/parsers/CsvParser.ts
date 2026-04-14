import Papa from 'papaparse'

export interface ParsedRow {
  date: string
  description: string
  amount: string
  balance?: string
  [key: string]: string | undefined
}

export class CsvParser {
  parse(content: string, hasHeader = true): ParsedRow[] {
    if (!content || content.trim().length === 0) {
      return []
    }

    if (!hasHeader) {
      // Headerless: parse as raw arrays, key each column by its index ("0", "1", ...)
      const raw = this.parseRaw(content)
      return raw.map((cols) => {
        const row: ParsedRow = { date: '', description: '', amount: '' }
        cols.forEach((val, i) => { row[String(i)] = val })
        return row
      })
    }

    const result = Papa.parse<Record<string, string>>(content.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    })

    if (result.errors.length > 0 && result.data.length === 0) {
      throw new Error(`CSV parse error: ${result.errors[0].message}`)
    }

    return result.data as ParsedRow[]
  }

  parseRaw(content: string): string[][] {
    const result = Papa.parse<string[]>(content.trim(), {
      skipEmptyLines: true,
    })
    return result.data
  }
}
