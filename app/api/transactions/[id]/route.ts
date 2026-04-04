import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { MerchantLearner } from '@/lib/categorization/MerchantLearner'

const merchantLearner = new MerchantLearner()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      categoryId,
      subcategoryId,
      merchantName,
      notes,
      reviewStatus,
      applyToAll,
    } = body

    const existing = await prisma.transaction.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // If category changed and we have a merchant name, save the rule
    if (categoryId && categoryId !== existing.categoryId && merchantName) {
      await merchantLearner.saveUserRule(merchantName, categoryId, subcategoryId)

      // Optionally apply retroactively
      if (applyToAll) {
        await merchantLearner.applyRuleRetroactively(merchantName, categoryId)
      }
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(subcategoryId !== undefined && { subcategoryId }),
        ...(merchantName !== undefined && { merchantName }),
        ...(notes !== undefined && { notes }),
        ...(reviewStatus !== undefined && { reviewStatus }),
        updatedAt: new Date(),
      },
      include: { category: true, subcategory: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }
}
