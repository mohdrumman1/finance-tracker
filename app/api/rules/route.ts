import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET() {
  try {
    const rules = await prisma.merchantRule.findMany({
      include: { category: true },
      orderBy: [{ isUserDefined: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    })
    return NextResponse.json(rules)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}
