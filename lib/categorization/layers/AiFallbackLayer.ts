import { prisma } from '../../db/client'
import { AIProvider } from '../../ai/AIProvider'
import type { NormalizedTransaction } from '../../importer/normalizer/TransactionNormalizer'
import type { CategorizationResult } from '../CategorizationService'

const aiProvider = new AIProvider()

export class AiFallbackLayer {
  private categoriesCache: { id: string; name: string }[] | null = null

  private async getCategories() {
    if (!this.categoriesCache) {
      this.categoriesCache = await prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      })
    }
    return this.categoriesCache
  }

  async categorize(transaction: NormalizedTransaction): Promise<CategorizationResult | null> {
    if (!aiProvider.isEnabled()) return null

    const categories = await this.getCategories()

    const merchantDesc =
      transaction.merchantName ||
      transaction.descriptionNormalized ||
      transaction.descriptionRaw.substring(0, 50)

    const result = await aiProvider.categorizeTransaction({
      merchantDescription: merchantDesc,
      amount: transaction.amount,
      direction: transaction.direction,
      availableCategories: categories,
    })

    if (!result) return null

    return {
      categoryId: result.categoryId,
      subcategoryId: null,
      confidence: result.confidence,
      method: 'ai',
      reason: result.reason,
    }
  }
}
