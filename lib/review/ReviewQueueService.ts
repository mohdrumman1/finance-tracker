import { prisma } from '../db/client'

export class ReviewQueueService {
  async getQueueCount(): Promise<number> {
    return prisma.transaction.count({
      where: { reviewStatus: 'needs_review' },
    })
  }

  async getQueue(limit = 50, offset = 0) {
    return prisma.transaction.findMany({
      where: { reviewStatus: 'needs_review' },
      include: {
        category: true,
        subcategory: true,
        account: true,
      },
      orderBy: { transactionDate: 'desc' },
      take: limit,
      skip: offset,
    })
  }

  async markReviewed(transactionId: string): Promise<void> {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        reviewStatus: 'reviewed',
        updatedAt: new Date(),
      },
    })
  }
}
