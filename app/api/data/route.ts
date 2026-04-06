import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') ?? 'transactions'

    if (scope === 'all') {
      // Delete everything in order (respect FK constraints)
      await prisma.transaction.deleteMany()
      await prisma.importBatch.deleteMany()
      await prisma.budget.deleteMany()
      await prisma.goal.deleteMany()
      await prisma.merchantRule.deleteMany()
      await prisma.insightSnapshot.deleteMany()
      await prisma.forecastSnapshot.deleteMany()
      await prisma.appSetting.deleteMany()
      await prisma.account.deleteMany()
      return NextResponse.json({ success: true, scope: 'all' })
    } else {
      // Just delete transactions and import batches
      await prisma.transaction.deleteMany()
      await prisma.importBatch.deleteMany()
      return NextResponse.json({ success: true, scope: 'transactions' })
    }
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
