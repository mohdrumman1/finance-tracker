import { prisma } from '../db/client'
import { CsvParser } from './parsers/CsvParser'
import { ProfileRegistry } from './profiles/ProfileRegistry'
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
  private profileRegistry = new ProfileRegistry()
  private normalizer = new TransactionNormalizer()
  private duplicateDetector = new DuplicateDetector()
  private categorizationService = new CategorizationService()

  async previewImport(
    content: string,
    profileId: string,
    accountId: string
  ): Promise<NormalizedTransaction[]> {
    const profile = this.profileRegistry.getProfile(profileId)
    const rows = this.csvParser.parse(content, profile.hasHeader !== false)
    const normalized = (
      await Promise.all(
        rows.map(async (row) => {
          try {
            const tx = this.normalizer.normalize(row, profile, accountId)
            const catResult = await this.categorizationService.categorize(tx)
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

    // Mark duplicates so the preview UI can show which will be skipped
    const { duplicates } = await this.duplicateDetector.filter(normalized, accountId)
    const duplicateSet = new Set(duplicates)
    for (const tx of normalized) {
      tx.isDuplicate = duplicateSet.has(tx)
    }

    return normalized
  }

  async confirmImport(
    transactions: NormalizedTransaction[],
    accountId: string,
    filename: string,
    profileId: string
  ): Promise<ImportResult> {
    const { unique, duplicates } = await this.duplicateDetector.filter(
      transactions,
      accountId
    )

    // Create import batch
    const batch = await prisma.importBatch.create({
      data: {
        accountId,
        filename,
        fileType: 'csv',
        bankProfile: profileId,
        rowCount: unique.length,
      },
    })

    let needsReviewCount = 0
    let autoCategorizedCount = 0
    const saved: NormalizedTransaction[] = []

    for (const tx of unique) {
      await prisma.transaction.create({
        data: {
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
        },
      })

      if (tx.reviewStatus === 'needs_review') needsReviewCount++
      if (tx.reviewStatus === 'auto_categorized') autoCategorizedCount++
      saved.push(tx)
    }

    return {
      batchId: batch.id,
      totalRows: transactions.length,
      duplicatesSkipped: duplicates.length,
      needsReviewCount,
      autoCategorizedCount,
      transactions: saved,
    }
  }

  detectProfile(content: string): BankProfile | null {
    const rows = this.csvParser.parseRaw(content)
    if (rows.length === 0) return null
    const headers = rows[0]
    return this.profileRegistry.detect(headers)
  }
}
