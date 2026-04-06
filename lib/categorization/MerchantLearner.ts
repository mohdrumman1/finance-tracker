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

  async applyRuleRetroactively(merchantName: string, categoryId: string): Promise<number> {
    const pattern = merchantName.toUpperCase().trim()

    const result = await prisma.transaction.updateMany({
      where: {
        OR: [
          {
            descriptionNormalized: {
              contains: pattern,
            },
          },
          {
            merchantName: {
              contains: pattern,
            },
          },
        ],
        reviewStatus: { not: 'reviewed' },
      },
      data: {
        categoryId,
        reviewStatus: 'auto_categorized',
        confidenceScore: 1.0,
        updatedAt: new Date(),
      },
    })

    return result.count
  }
}
