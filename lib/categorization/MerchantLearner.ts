import { prisma } from '../db/client'

export class MerchantLearner {
  async saveUserRule(
    merchantName: string,
    categoryId: string,
    subcategoryId?: string
  ): Promise<void> {
    const pattern = merchantName.toUpperCase().trim()

    await prisma.merchantRule.upsert({
      where: { pattern },
      update: {
        categoryId,
        subcategoryId: subcategoryId ?? null,
        isUserDefined: true,
        priority: 10, // higher than built-in rules
        updatedAt: new Date(),
      },
      create: {
        pattern,
        patternType: 'exact',
        categoryId,
        subcategoryId: subcategoryId ?? null,
        isUserDefined: true,
        priority: 10,
      },
    })
  }

  async applyRuleRetroactively(
    merchantName: string,
    categoryId: string,
    subcategoryId?: string
  ): Promise<number> {
    const pattern = merchantName.toUpperCase().trim()

    // Fetch candidates - separate queries avoid OR + NOT driver quirks with better-sqlite3
    const byMerchant = await prisma.transaction.findMany({
      where: { merchantName: pattern, reviewStatus: 'needs_review' },
      select: { id: true },
    })

    const byDesc = await prisma.transaction.findMany({
      where: { descriptionNormalized: { contains: pattern }, reviewStatus: 'needs_review' },
      select: { id: true },
    })

    const ids = [...new Set([...byMerchant, ...byDesc].map((t) => t.id))]
    if (ids.length === 0) return 0

    await prisma.transaction.updateMany({
      where: { id: { in: ids } },
      data: {
        categoryId,
        subcategoryId: subcategoryId ?? null,
        reviewStatus: 'auto_categorized',
        confidenceScore: 1.0,
        updatedAt: new Date(),
      },
    })

    return ids.length
  }
}
