import { NextRequest, NextResponse } from 'next/server'
import { InsightService } from '@/lib/insights/InsightService'

const insightService = new InsightService()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

    const insights = await insightService.generateInsights(year, month)
    return NextResponse.json(insights)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
