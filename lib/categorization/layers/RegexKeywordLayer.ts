import { prisma } from '../../db/client'
import type { NormalizedTransaction } from '../../importer/normalizer/TransactionNormalizer'
import type { CategorizationResult } from '../CategorizationService'
import type { MerchantRule } from '@prisma/client'

let rulesCache: MerchantRule[] | null = null
let cacheExpiresAt = 0
const CACHE_TTL = 60_000

async function getRegexKeywordRules(): Promise<MerchantRule[]> {
  if (!rulesCache || Date.now() > cacheExpiresAt) {
    rulesCache = await prisma.merchantRule.findMany({
      where: { patternType: { in: ['regex', 'keyword'] } },
      orderBy: [{ isUserDefined: 'desc' }, { priority: 'desc' }],
    })
    cacheExpiresAt = Date.now() + CACHE_TTL
  }
  return rulesCache
}

export class RegexKeywordLayer {
  async categorize(transaction: NormalizedTransaction): Promise<CategorizationResult | null> {
    const desc = transaction.descriptionNormalized || transaction.descriptionRaw.toUpperCase()
    const rules = await getRegexKeywordRules()

    for (const rule of rules) {
      if (rule.direction && rule.direction !== transaction.direction) continue

      let matches = false

      if (rule.patternType === 'keyword') {
        const keyword = rule.pattern.toUpperCase().replace(/\*/g, '')
        matches = desc.includes(keyword)
      } else if (rule.patternType === 'regex') {
        try {
          const regex = new RegExp(rule.pattern, 'i')
          matches = regex.test(desc)
        } catch {
          continue
        }
      }

      if (matches) {
        return {
          categoryId: rule.categoryId,
          subcategoryId: rule.subcategoryId ?? null,
          confidence: 0.85,
          method: 'regex',
          reason: `${rule.patternType} match: ${rule.pattern}`,
        }
      }
    }

    return null
  }
}
