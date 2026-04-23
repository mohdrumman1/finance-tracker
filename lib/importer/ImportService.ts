import { prisma } from '../db/client'
import { CsvParser } from './parsers/CsvParser'
import { PdfParser } from './parsers/PdfParser'
import { ProfileRegistry, detectPdfProfile } from './profiles/ProfileRegistry'
import type { BankProfile } from './profiles/ProfileRegistry'
import { TransactionNormalizer, NormalizedTransaction } from './normalizer/TransactionNormalizer'
import { DuplicateDetector } from './duplicate/DuplicateDetector'
import { CategorizationService } from '../categorization/CategorizationService'

export interface ImportResult {
  batchId: string
  totalRows: number
  duplicatesSkipped: number
  needsReviewCount: number
  autoCategorizedCount: number
  transactions: NormalizedTransaction[]
}

export class ImportService {
  private csvParser = new CsvParser()
  private pdfParser = new PdfParser()
  private profileRegistry = new ProfileRegistry()
  private normalizer = new TransactionNormalizer()
  private duplicateDetector = new DuplicateDetector()
  private categorizationService = new CategorizationService()

  async previewImport(
    content: string | Buffer,
    profileId: string,
    accountId: string,
    filename = ''
  ): Promise<NormalizedTransaction[]> {
    const t0 = Date.now()

    const isPdf = filename.toLowerCase().endsWith('.pdf') || Buffer.isBuffer(content)
    let profile: BankProfile
    let rows: ReturnType<CsvParser['parse']>

    if (isPdf) {
      const pdfResult = await this.pdfParser.parse(content as Buffer)
      profile = detectPdfProfile(pdfResult.text)
      const pdfProfile = profile as import('./profiles/ProfileRegistry').PdfBankProfile
      rows = pdfProfile.extractRows(pdfResult.text)
    } else {
      profile = this.profileRegistry.getProfile(profileId)
      rows = this.csvParser.parse(content as string, profile.hasHeader !== false)
    }

    console.log(`[import] parse: ${rows.length} rows in ${Date.now() - t0}ms`)

    const t1 = Date.now()
    const normalized = (
      await Promise.all(
        rows.map(async (row) => {
          try {
            const tx = this.normalizer.normalize(row, profile, accountId)
            const catResult = await this.categorizationService.categorizeFast(tx)
            tx.categoryId = catResult.categoryId
            tx.subcategoryId = catResult.subcategoryId
            tx.confidenceScore = catResult.confidence
            tx.reviewStatus =
              catResult.confidence >= 0.6 ? 'auto_categorized' : 'needs_review'
            return tx
          } catch {
            return null
          }
        })
      )
    ).filter((tx): tx is NormalizedTransaction => tx !== null)
    console.log(`[import] normalize+categorize: ${normalized.length} txns in ${Date.now() - t1}ms`)

    const t2 = Date.now()
    const { duplicates } = await this.duplicateDetector.filter(normalized, accountId)
    const duplicateSet = new Set(duplicates)
    for (const tx of normalized) {
      tx.isDuplicate = duplicateSet.has(tx)
    }
    console.log(`[import] duplicate check: ${duplicates.length} dupes in ${Date.now() - t2}ms`)
    console.log(`[import] total preview: ${Date.now() - t0}ms`)

    return normalized
  }

  async confirmImport(
    transactions: NormalizedTransaction[],
    accountId: string,
    filename: string,
    profileId: string
  ): Promise<ImportResult> {
    const t0 = Date.now()

    const { unique, duplicates } = await this.duplicateDetector.filter(
      transactions,
      accountId
    )
    console.log(`[import] confirm duplicate check: ${Date.now() - t0}ms`)

    const isPdf = filename.toLowerCase().endsWith('.pdf')

    const batch = await prisma.importBatch.create({
      data: {
        accountId,
        filename,
        fileType: isPdf ? 'pdf' : 'csv',
        bankProfile: profileId,
        rowCount: unique.length,
      },
    })

    const t1 = Date.now()
    await prisma.transaction.createMany({
      data: unique.map((tx) => ({
        accountId: tx.accountId,
        importBatchId: batch.id,
        sourceType: tx.sourceType,
        transactionDate: tx.transactionDate,
        descriptionRaw: tx.descriptionRaw,
        descriptionNormalized: tx.descriptionNormalized,
        merchantName: tx.merchantName,
        amount: tx.amount,
        currency: tx.currency,
        direction: tx.direction,
        categoryId: tx.categoryId,
        subcategoryId: tx.subcategoryId,
        isRecurring: tx.isRecurring,
        isTransfer: tx.isTransfer,
        reviewStatus: tx.reviewStatus,
        confidenceScore: tx.confidenceScore,
      })),
    })
    console.log(`[import] createMany ${unique.length} txns: ${Date.now() - t1}ms`)
    console.log(`[import] total confirm: ${Date.now() - t0}ms`)

    const needsReviewCount = unique.filter((tx) => tx.reviewStatus === 'needs_review').length
    const autoCategorizedCount = unique.filter((tx) => tx.reviewStatus === 'auto_categorized').length

    return {
      batchId: batch.id,
      totalRows: transactions.length,
      duplicatesSkipped: duplicates.length,
      needsReviewCount,
      autoCategorizedCount,
      transactions: unique,
    }
  }

  detectProfile(content: string): BankProfile | null {
    const rows = this.csvParser.parseRaw(content)
    if (rows.length === 0) return null
    const headers = rows[0]
    return this.profileRegistry.detect(headers)
  }
}
