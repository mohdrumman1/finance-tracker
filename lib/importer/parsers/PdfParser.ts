export interface PdfParseResult {
  text: string
  pages: number
}

export class PdfParser {
  async parse(buffer: Buffer): Promise<PdfParseResult> {
    // Dynamic import to avoid SSR issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (await import('pdf-parse') as any).default ?? (await import('pdf-parse'))
    const result = await pdfParse(buffer)
    return {
      text: result.text,
      pages: result.numpages,
    }
  }
}
