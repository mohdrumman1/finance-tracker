export interface PdfParseResult {
  text: string
  pages: number
}

// pdf-parse's default renderer concatenates text items on the same line with no
// separator. This custom renderer checks the horizontal gap between consecutive
// items and inserts a space whenever there is visible whitespace in the PDF.
async function renderPage(pageData: {
  getTextContent: (opts?: Record<string, unknown>) => Promise<{
    items: Array<{ str: string; transform: number[]; width: number }>
  }>
}): Promise<string> {
  const content = await pageData.getTextContent({ normalizeWhitespace: false })
  let text = ''
  let lastY: number | null = null
  let lastX = 0
  let lastWidth = 0

  for (const item of content.items) {
    const x = item.transform[4]
    const y = item.transform[5]

    if (lastY === null) {
      text += item.str
    } else if (Math.abs(y - lastY) > 2) {
      text += '\n' + item.str
    } else {
      const gap = x - (lastX + lastWidth)
      text += (gap > 1 ? ' ' : '') + item.str
    }

    lastY = y
    lastX = x
    lastWidth = item.width ?? 0
  }

  return text + '\n'
}

export class PdfParser {
  async parse(buffer: Buffer): Promise<PdfParseResult> {
    const { default: pdfParse } = await import('pdf-parse')
    const result = await pdfParse(buffer, { pagerender: renderPage })
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
