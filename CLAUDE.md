# Monyze - Finance Tracker

Personal finance web app. Next.js 15 + TypeScript, SQLite (local) / Turso (prod), Prisma ORM, Google OAuth, AI categorization via OpenRouter.

Live: https://monyze.vercel.app

---

## Current Task: PDF Bank Statement Import

**Branch:** `feature/pdf-import`

You are implementing PDF bank statement parsing for Australian banks. Everything below is what you need to build. Do not push to main until all tests pass.

### Context

The CSV import pipeline is complete and working. PDF support is partially scaffolded but not connected:
- `pdf-parse` is already installed (MIT, free)
- `lib/importer/parsers/PdfParser.ts` exists as a stub (only extracts raw text)
- DB schema already has `sourceType: 'pdf'` on the Transaction model
- The UI currently only accepts `.csv` files

You need to connect all the pieces.

---

## Implementation Plan

### Step 1 - Upgrade PdfParser

**File:** `lib/importer/parsers/PdfParser.ts`

Replace the stub with:
- Keep `parse(buffer: Buffer): Promise<PdfParseResult>` as-is
- Add `extractLines(text: string): string[]` - splits raw text into non-empty trimmed lines
- Add `extractTransactionLines(text: string, pattern: RegExp): RegExpMatchArray[]` - runs regex against each line, returns matches

The parser stays bank-agnostic. Bank-specific regex lives in profiles.

---

### Step 2 - PDF bank profile interface

**File:** `lib/importer/profiles/index.ts`

Extend the existing `BankProfile` interface to support PDF:

```ts
interface PdfBankProfile extends BankProfile {
  fileType: 'pdf'
  transactionLineRegex: RegExp
  mapMatch: (match: RegExpMatchArray) => ParsedRow
  detect: (firstPageText: string) => boolean
  extractRows: (text: string) => ParsedRow[]
}
```

Add a `detectPdfProfile(text: string): PdfBankProfile` function that tries each PDF profile's `detect()` in order, falling back to a generic profile.

---

### Step 3 - CommBank PDF profile (PRIORITY - real PDF available)

**File:** `lib/importer/profiles/CommbankPdfProfile.ts`

CommBank PDF statement transaction lines look like:
```
14 Apr 2026  WOOLWORTHS 1234 SYDNEY NSW    55.00 DR    1,100.00
14 Apr 2026  SALARY ACME PTY LTD           3,200.00 CR    4,300.00
```

- Regex named groups: `date`, `description`, `amount`, `direction` (DR/CR), `balance`
- Date format: `dd MMM yyyy`
- DR = expense, CR = income
- `detect`: checks if text contains "Commonwealth Bank" or "NetBank"

---

### Step 4 - ING PDF profile

**File:** `lib/importer/profiles/IngProfile.ts`

ING PDF statement transaction lines look like:
```
15 Apr 2026  OSKO PAYMENT TO JOHN SMITH  -250.00  1,234.56
```

- Regex named groups: `date`, `description`, `amount` (signed), `balance`
- Date format: `dd MMM yyyy`
- Amount sign: single_signed (negative = expense)
- `detect`: checks if text contains "ING" and ("Orange Everyday" or "Savings Maximiser")

---

### Step 5 - Wire PdfParser into ImportService

**File:** `lib/importer/ImportService.ts`

In both `previewImport()` and `confirmImport()`, detect file type by filename:

```ts
if (filename.endsWith('.pdf')) {
  const pdfResult = await new PdfParser().parse(buffer as Buffer)
  const profile = detectPdfProfile(pdfResult.text)
  const rows = profile.extractRows(pdfResult.text)
  // then: normalize → categorize → deduplicate (all reused, unchanged)
} else {
  // existing CSV path unchanged
}
```

The normalizer, categorizer, and duplicate detector only care about `ParsedRow[]` - reuse them as-is.

---

### Step 6 - Update API route for binary PDF uploads

**File:** `app/api/import/route.ts`

Currently: `const content = await file.text()`

Change to:
```ts
const isPdf = file.name.endsWith('.pdf')
const content = isPdf
  ? Buffer.from(await file.arrayBuffer())
  : await file.text()
```

Pass both `content` and `file.name` down to `ImportService`.

---

### Step 7 - Update UI to accept PDFs

**File:** `app/imports/page.tsx`

- Line ~68: change `.filter((f) => f.name.endsWith('.csv'))` to also allow `.pdf`
- Update file input: `accept=".csv,.pdf"`
- Update hint text: "CSV or PDF files"
- Everything else (preview table, confirm flow) is unchanged

---

## Data Flow

```
PDF upload
  → PdfParser.parse(buffer)
  → detectPdfProfile(text)
  → profile.extractRows(text)  [bank-specific regex → ParsedRow[]]
  → TransactionNormalizer      [unchanged]
  → CategorizationService      [unchanged]
  → DuplicateDetector          [unchanged]
  → DB (sourceType: 'pdf')
```

---

## Testing

**Do NOT push to main until all tests pass.**

1. A real CommBank PDF is in `fixtures/commbank-sample.pdf` (gitignored - never commit it)
2. Write Vitest unit tests in `tests/pdf-parser.test.ts` covering:
   - CommBank profile regex matches a known transaction line
   - ING profile regex matches a known transaction line
   - `detectPdfProfile` correctly identifies CommBank vs ING
   - Duplicate detection skips rows on second import
3. Upload the fixture via local dev UI - preview table must show correct dates, amounts, merchants
4. Confirm import - check DB has rows with `sourceType = 'pdf'`
5. Run `npm run test` - all existing CSV tests must still pass

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/importer/parsers/PdfParser.ts` | PDF text extractor stub - extend this |
| `lib/importer/parsers/CsvParser.ts` | Reference for ParsedRow interface |
| `lib/importer/profiles/index.ts` | ProfileRegistry - add PDF detection here |
| `lib/importer/profiles/CommbankProfile.ts` | Existing CommBank CSV profile - reference for structure |
| `lib/importer/ImportService.ts` | Main pipeline orchestrator |
| `lib/importer/normalizer/TransactionNormalizer.ts` | Reuse unchanged |
| `lib/importer/duplicate/DuplicateDetector.ts` | Reuse unchanged |
| `app/api/import/route.ts` | Import API endpoint |
| `app/imports/page.tsx` | Import wizard UI |
| `prisma/schema.prisma` | DB schema (sourceType field already supports 'pdf') |

---

## Risks

- Scanned PDFs won't work - `pdf-parse` requires digital (text-layer) PDFs. Bank statements are always digital, so this is fine.
- CommBank regex is based on the known format. If the PDF sample has a different layout, adjust the regex to match what you see in the extracted text.
- Don't touch the CSV path - it must keep working exactly as before.
