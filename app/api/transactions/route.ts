import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const accountId = searchParams.get('accountId')
    const categoryId = searchParams.get('categoryId')
    const reviewStatus = searchParams.get('reviewStatus')
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '50')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (startDate) where.transactionDate = { ...where.transactionDate, gte: new Date(startDate) }
    if (endDate) where.transactionDate = { ...where.transactionDate, lte: new Date(endDate) }
    if (accountId) where.accountId = accountId
    if (categoryId) where.categoryId = categoryId
    if (reviewStatus) where.reviewStatus = reviewStatus

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: true, subcategory: true, account: true },
        orderBy: { transactionDate: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.transaction.count({ where }),
    ])

    return NextResponse.json({
      transactions,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
