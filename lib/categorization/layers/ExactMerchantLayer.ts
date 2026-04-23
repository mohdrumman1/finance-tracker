import { prisma } from '../../db/client'
import type { NormalizedTransaction } from '../../importer/normalizer/TransactionNormalizer'
import type { CategorizationResult } from '../CategorizationService'
import type { MerchantRule } from '@prisma/client'

let rulesPromise: Promise<MerchantRule[]> | null = null
let cacheExpiresAt = 0
const CACHE_TTL = 60_000

function getExactRules(): Promise<MerchantRule[]> {
  if (!rulesPromise || Date.now() > cacheExpiresAt) {
    cacheExpiresAt = Date.now() + CACHE_TTL
    rulesPromise = prisma.merchantRule.findMany({
      where: { patternType: 'exact' },
      orderBy: [{ isUserDefined: 'desc' }, { priority: 'desc' }],
    })
  }
  return rulesPromise
}

export class ExactMerchantLayer {
  async categorize(transaction: NormalizedTransaction): Promise<CategorizationResult | null> {
    const desc = transaction.descriptionNormalized || transaction.descriptionRaw.toUpperCase()
    const rules = await getExactRules()

    for (const rule of rules) {
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
