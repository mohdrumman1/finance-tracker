import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  try {
    const { subId } = await params
    // Detach any transactions using this subcategory
    await prisma.transaction.updateMany({
      where: { subcategoryId: subId },
      data: { subcategoryId: null },
    })
    await prisma.subcategory.delete({ where: { id: subId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete subcategory' }, { status: 500 })
  }
}
