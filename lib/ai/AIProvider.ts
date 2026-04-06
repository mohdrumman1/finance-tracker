export interface AICategorizationRequest {
  merchantDescription: string
  amount: number
  direction: 'income' | 'expense' | 'transfer'
  availableCategories: { id: string; name: string }[]
}

export interface AICategorizationResponse {
  categoryId: string
  confidence: number
  reason: string
}

export interface SpendingContext {
  period: string
  totalIncome: number
  totalExpenses: number
  topCategories: { name: string; amount: number }[]
  savingsRate: number
}

// In-memory cache keyed by normalized merchant description
const categorizationCache = new Map<string, AICategorizationResponse>()

export class AIProvider {
  private enabled: boolean
  private apiKey: string | undefined
  private model: string

  constructor() {
    this.enabled = process.env.AI_FALLBACK_ENABLED === 'true'
    this.apiKey = process.env.OPENROUTER_API_KEY
    this.model = process.env.OPENROUTER_MODEL ?? 'mistralai/mistral-7b-instruct'
  }

  isEnabled(): boolean {
    return this.enabled && !!this.apiKey && this.apiKey.length > 0
  }

  async categorizeTransaction(
    req: AICategorizationRequest
  ): Promise<AICategorizationResponse | null> {
    if (!this.isEnabled()) return null

    const cacheKey = `${req.merchantDescription.toLowerCase()}:${req.direction}`
    if (categorizationCache.has(cacheKey)) {
      return categorizationCache.get(cacheKey)!
    }

    const prompt = `You are a financial transaction classifier. Classify the following transaction into one of the provided categories.

Transaction: "${req.merchantDescription}"
Amount: $${req.amount.toFixed(2)} AUD
Direction: ${req.direction}

Categories: ${JSON.stringify(req.availableCategories)}

Respond ONLY with a JSON object:
{"categoryId": "<id>", "confidence": <0.0-1.0>, "reason": "<one short sentence>"}

Do not include any other text.`

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.1,
        }),
      })

      if (!response.ok) return null

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content?.trim()
      if (!content) return null

      const parsed = JSON.parse(content) as AICategorizationResponse

      // Validate the response has a valid categoryId
      const validCategory = req.availableCategories.find((c) => c.id === parsed.categoryId)
      if (!validCategory) return null

      categorizationCache.set(cacheKey, parsed)
      return parsed
    } catch {
      return null
    }
  }

  async generateSpendingSummary(context: SpendingContext): Promise<string> {
    if (!this.isEnabled()) {
      return `In ${context.period}, your income was $${context.totalIncome.toFixed(2)} and expenses were $${context.totalExpenses.toFixed(2)}, resulting in a savings rate of ${context.savingsRate.toFixed(1)}%.`
    }

    const prompt = `Generate a brief, friendly 2-3 sentence financial summary for the following data:
Period: ${context.period}
Income: $${context.totalIncome.toFixed(2)} AUD
Expenses: $${context.totalExpenses.toFixed(2)} AUD
Savings rate: ${context.savingsRate.toFixed(1)}%
Top spending categories: ${context.topCategories.map((c) => `${c.name} ($${c.amount.toFixed(2)})`).join(', ')}

Be neutral and factual, not preachy.`

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.7,
        }),
      })

      if (!response.ok) throw new Error('API error')
      const data = await response.json()
      return data.choices?.[0]?.message?.content?.trim() ?? ''
    } catch {
      return `In ${context.period}, your income was $${context.totalIncome.toFixed(2)} and expenses were $${context.totalExpenses.toFixed(2)}, resulting in a savings rate of ${context.savingsRate.toFixed(1)}%.`
    }
  }
}
