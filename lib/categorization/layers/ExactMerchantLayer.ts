import { prisma } from '../../db/client'
import type { NormalizedTransaction } from '../../importer/normalizer/TransactionNormalizer'
import type { CategorizationResult } from '../CategorizationService'
import type { MerchantRule } from '@prisma/client'

let rulesCache: MerchantRule[] | null = null
let cacheExpiresAt = 0
const CACHE_TTL = 60_000

async function getExactRules(): Promise<MerchantRule[]> {
  if (!rulesCache || Date.now() > cacheExpiresAt) {
    rulesCache = await prisma.merchantRule.findMany({
      where: { patternType: 'exact' },
      orderBy: [{ isUserDefined: 'desc' }, { priority: 'desc' }],
    })
    cacheExpiresAt = Date.now() + CACHE_TTL
  }
  return rulesCache
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
