import { NextRequest, NextResponse } from 'next/server'
import { InsightService } from '@/lib/insights/InsightService'
import { getSession } from '@/lib/auth/session'

const insightService = new InsightService()

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

    const insights = await insightService.generateInsights(year, month, session.userId)
    return NextResponse.json(insights)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
