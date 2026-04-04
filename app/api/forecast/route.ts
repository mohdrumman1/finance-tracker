import { NextResponse } from 'next/server'
import { ForecastService } from '@/lib/forecasting/ForecastService'

const forecastService = new ForecastService()

export async function GET() {
  try {
    const forecast = await forecastService.forecastCurrentMonth()
    return NextResponse.json(forecast)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 })
  }
}
