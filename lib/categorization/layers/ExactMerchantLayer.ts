import { prisma } from '../../db/client'
import type { NormalizedTransaction } from '../../importer/normalizer/TransactionNormalizer'
import type { CategorizationResult } from '../CategorizationService'

export class ExactMerchantLayer {
  async categorize(transaction: NormalizedTransaction): Promise<CategorizationResult | null> {
    const desc = transaction.descriptionNormalized || transaction.descriptionRaw.toUpperCase()

    // Get all exact rules ordered by priority (user-defined first, then by priority)
    const rules = await prisma.merchantRule.findMany({
      where: { patternType: 'exact' },
      orderBy: [{ isUserDefined: 'desc' }, { priority: 'desc' }],
    })

    for (const rule of rules) {
      // Check direction match
      if (rule.direction && rule.direction !== transaction.direction) continue

      const pattern = rule.pattern.toUpperCase()
      if (desc.includes(pattern)) {
        return {
          categoryId: rule.categoryId,
          subcategoryId: rule.subcategoryId ?? null,
          confidence: 1.0,
          method: 'exact',
          reason: `Exact match: ${rule.pattern}`,
        }
      }
    }

    return null
  }
}
