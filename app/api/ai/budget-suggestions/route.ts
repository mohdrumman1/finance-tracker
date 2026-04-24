import { NextRequest, NextResponse } from 'next/server'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'google/gemini-2.0-flash-001'

// Cost-of-living multipliers relative to Sydney baseline
const CITY_MULTIPLIERS: Record<string, number> = {
  sydney: 1.0,
  darwin: 1.0,
  melbourne: 0.95,
  canberra: 0.95,
  perth: 0.9,
  brisbane: 0.88,
  'gold coast': 0.88,
  adelaide: 0.85,
  hobart: 0.85,
}

const BASE_AMOUNTS: Record<string, number> = {
  Groceries: 600,
  'Dining Out': 300,
  Transport: 200,
  Entertainment: 150,
  Health: 100,
  Utilities: 250,
}

function fallbackAmounts(city: string, categories: string[]): Record<string, number> {
  const key = city.toLowerCase().trim()
  const multiplier = CITY_MULTIPLIERS[key] ?? 0.9
  return Object.fromEntries(
    categories.map((cat) => [cat, Math.round((BASE_AMOUNTS[cat] ?? 200) * multiplier)])
  )
}

export async function POST(req: NextRequest) {
  try {
    const { city, income, categories } = await req.json()

    if (!city || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ error: 'city and categories are required' }, { status: 400 })
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ amounts: fallbackAmounts(city, categories) })
    }

    const incomeNote = income ? ` Their monthly take-home income is $${income} AUD.` : ''
    const prompt = `You are a financial planning assistant for Australians.
A person lives in ${city}, Australia.${incomeNote}
Suggest realistic monthly budget amounts in AUD for these spending categories: ${categories.join(', ')}.
Base your suggestions on the actual cost of living in ${city} - account for local rent, transport costs, food prices, etc.
Respond ONLY with a valid JSON object where keys are the exact category names provided and values are whole-number AUD amounts.
Example: {"Groceries": 650, "Dining Out": 280}`

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Finance Tracker',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ amounts: fallbackAmounts(city, categories) })
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content ?? ''

    // Extract JSON from the response (model may wrap it in markdown)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ amounts: fallbackAmounts(city, categories) })
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, number>

    // Validate: ensure all requested categories have a numeric value
    const amounts: Record<string, number> = {}
    for (const cat of categories) {
      const val = parsed[cat]
      amounts[cat] = typeof val === 'number' && val > 0 ? Math.round(val) : (BASE_AMOUNTS[cat] ?? 200)
    }

    return NextResponse.json({ amounts })
  } catch (err) {
    console.error('[POST /api/ai/budget-suggestions]', err)
    // Always return usable fallback rather than an error
    const { city = '', categories = [] } = await req.json().catch(() => ({}))
    return NextResponse.json({ amounts: fallbackAmounts(city, categories) })
  }
}
