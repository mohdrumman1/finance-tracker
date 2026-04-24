export interface PdfParseResult {
  text: string
  pages: number
}

export class PdfParser {
  async parse(buffer: Buffer): Promise<PdfParseResult> {
    const { default: pdfParse } = await import('pdf-parse')
    const result = await pdfParse(buffer)
    return {
      text: result.text,
      pages: result.numpages,
    }
  }

  extractLines(text: string): string[] {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
  }

  extractTransactionLines(text: string, pattern: RegExp): RegExpMatchArray[] {
    return this.extractLines(text)
      .map((line) => line.match(pattern))
      .filter((m): m is RegExpMatchArray => m !== null)
  }
}
