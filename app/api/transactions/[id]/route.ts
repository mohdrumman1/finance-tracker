import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { MerchantLearner } from '@/lib/categorization/MerchantLearner'
import { getSession } from '@/lib/auth/session'

const merchantLearner = new MerchantLearner()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const {
      categoryId,
      subcategoryId,
      merchantName,
      notes,
      reviewStatus,
      direction,
      applyToAll,
    } = body

    // Ensure the transaction belongs to the authenticated user.
    const existing = await prisma.transaction.findFirst({
      where: { id, account: { userId: session.userId } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Save merchant rule whenever we have a category + merchant
    let appliedCount = 0
    if (categoryId && merchantName) {
      await merchantLearner.saveUserRule(merchantName, categoryId, subcategoryId)

      // Apply to all matching unreviewed transactions
      if (applyToAll) {
        appliedCount = await merchantLearner.applyRuleRetroactively(merchantName, categoryId, subcategoryId)
      }
    }

    // Bulk-mark all same-merchant unreviewed transactions as transfers
    if (direction === 'transfer' && applyToAll && merchantName) {
      const result = await prisma.transaction.updateMany({
        where: {
          merchantName,
          reviewStatus: 'needs_review',
          id: { not: existing.id },
          // Scope to the user's transactions only
          account: { userId: session.userId },
        },
        data: {
          direction: 'transfer',
          reviewStatus: 'reviewed',
          categoryId: null,
          subcategoryId: null,
          updatedAt: new Date(),
        },
      })
      appliedCount = result.count
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(subcategoryId !== undefined && { subcategoryId }),
        ...(merchantName !== undefined && { merchantName }),
        ...(notes !== undefined && { notes }),
        ...(reviewStatus !== undefined && { reviewStatus }),
        ...(direction !== undefined && { direction }),
        updatedAt: new Date(),
      },
      include: { category: true, subcategory: true },
    })

    return NextResponse.json({ ...updated, appliedCount })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }
}
