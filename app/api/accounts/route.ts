import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const accounts = await prisma.account.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(accounts)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, institution, accountType, currency } = body

    if (!name || !institution) {
      return NextResponse.json({ error: 'name and institution are required' }, { status: 400 })
    }

    const account = await prisma.account.create({
      data: {
        name,
        institution,
        accountType: accountType ?? 'transaction',
        currency: currency ?? 'AUD',
        userId: session.userId,
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
