import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Detach any transactions pointing to this category before deleting
    await prisma.transaction.updateMany({
      where: { categoryId: id },
      data: { categoryId: null, subcategoryId: null },
    })
    await prisma.merchantRule.deleteMany({ where: { categoryId: id } })
    await prisma.subcategory.deleteMany({ where: { categoryId: id } })
    await prisma.category.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
