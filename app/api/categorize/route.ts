import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { AiFallbackLayer } from '@/lib/categorization/layers/AiFallbackLayer'
import type { NormalizedTransaction } from '@/lib/importer/normalizer/TransactionNormalizer'

const CHUNK_SIZE = 15
const aiLayer = new AiFallbackLayer()

export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json()
    if (!batchId) return NextResponse.json({ error: 'Missing batchId' }, { status: 400 })

    // Find transactions in this batch with no category yet (fast layers didn't match)
    const pending = await prisma.transaction.findMany({
      where: { importBatchId: batchId, categoryId: null },
      select: {
        id: true,
        merchantName: true,
        descriptionNormalized: true,
        descriptionRaw: true,
        amount: true,
        direction: true,
      },
      take: CHUNK_SIZE,
    })

    const remaining = await prisma.transaction.count({
      where: { importBatchId: batchId, categoryId: null },
    })

    if (pending.length === 0) {
      return NextResponse.json({ processed: 0, remaining: 0 })
    }

    // Run AI on this chunk in parallel
    await Promise.all(
      pending.map(async (tx) => {
        const result = await aiLayer.categorize({
          merchantName: tx.merchantName,
          descriptionNormalized: tx.descriptionNormalized ?? '',
          descriptionRaw: tx.descriptionRaw,
          amount: tx.amount,
          direction: tx.direction as NormalizedTransaction['direction'],
          // remaining fields not used by AiFallbackLayer
          accountId: '', sourceType: 'csv', transactionDate: new Date(),
          currency: 'AUD', categoryId: null, subcategoryId: null,
          isRecurring: false, isTransfer: false, confidenceScore: 0,
          reviewStatus: 'needs_review',
        })

        if (!result) return

        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            categoryId: result.categoryId,
            subcategoryId: result.subcategoryId,
            confidenceScore: result.confidence,
            reviewStatus: result.confidence >= 0.6 ? 'auto_categorized' : 'needs_review',
          },
        })
      })
    )

    const stillRemaining = await prisma.transaction.count({
      where: { importBatchId: batchId, categoryId: null },
    })

    return NextResponse.json({ processed: pending.length, remaining: stillRemaining })
  } catch (error) {
    console.error('Categorize error:', error)
    return NextResponse.json({ error: 'Categorization failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const batchId = new URL(request.url).searchParams.get('batchId')
    if (!batchId) return NextResponse.json({ error: 'Missing batchId' }, { status: 400 })

    const remaining = await prisma.transaction.count({
      where: { importBatchId: batchId, categoryId: null },
    })
    const total = await prisma.transaction.count({
      where: { importBatchId: batchId },
    })

    return NextResponse.json({ remaining, total })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 })
  }
}
