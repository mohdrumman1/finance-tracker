import { prisma } from '../db/client'
import { TransactionNormalizer, type WebhookPayload } from '../importer/normalizer/TransactionNormalizer'
import { CategorizationService } from '../categorization/CategorizationService'
import { startOfDay, endOfDay } from 'date-fns'

const REVIEW_THRESHOLD = 0.6

export interface WebhookResult {
  isDuplicate: true
  existingId: string
}

export interface WebhookSuccess {
  isDuplicate: false
  transaction: {
    id: string
    accountId: string
    sourceType: string
    transactionDate: Date
    descriptionRaw: string
    merchantName: string | null
    amount: number
    currency: string
    direction: string
    categoryId: string | null
    reviewStatus: string
    confidenceScore: number
  }
}

export class WebhookTransactionService {
  private normalizer = new TransactionNormalizer()
  private categorizer = new CategorizationService()

  async createFromWebhook(payload: WebhookPayload): Promise<WebhookResult | WebhookSuccess> {
    const normalized = this.normalizer.normalizeWebhook(payload)

    // Check for duplicate before doing expensive categorization
    const dayStart = startOfDay(normalized.transactionDate)
    const dayEnd = endOfDay(normalized.transactionDate)

    const existing = await prisma.transaction.findFirst({
      where: {
        accountId: payload.accountId,
        transactionDate: { gte: dayStart, lte: dayEnd },
        amount: normalized.amount,
        direction: normalized.direction,
      },
      select: { id: true },
    })

    if (existing) {
      return { isDuplicate: true, existingId: existing.id }
    }

    // Auto-categorize
    const categorization = await this.categorizer.categorize(normalized)
    const reviewStatus =
      categorization.confidence >= REVIEW_THRESHOLD ? 'auto_categorized' : 'needs_review'

    const transaction = await prisma.transaction.create({
      data: {
        accountId: payload.accountId,
        sourceType: 'pending_unverified',
        transactionDate: normalized.transactionDate,
        descriptionRaw: normalized.descriptionRaw,
        descriptionNormalized: normalized.descriptionNormalized,
        merchantName: normalized.merchantName,
        amount: normalized.amount,
        currency: normalized.currency,
        direction: normalized.direction,
        categoryId: categorization.categoryId,
        subcategoryId: categorization.subcategoryId,
        isRecurring: false,
        isTransfer: normalized.isTransfer,
        isExcludedFromBudget: false,
        reviewStatus,
        confidenceScore: categorization.confidence,
      },
    })

    return { isDuplicate: false, transaction }
  }
}
