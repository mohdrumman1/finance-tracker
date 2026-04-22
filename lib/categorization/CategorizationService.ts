import type { NormalizedTransaction } from '../importer/normalizer/TransactionNormalizer'
import { ExactMerchantLayer } from './layers/ExactMerchantLayer'
import { RegexKeywordLayer } from './layers/RegexKeywordLayer'
import { HeuristicLayer } from './layers/HeuristicLayer'
import { AiFallbackLayer } from './layers/AiFallbackLayer'

export interface CategorizationResult {
  categoryId: string | null
  subcategoryId: string | null
  confidence: number // 0.0 – 1.0
  method: 'exact' | 'regex' | 'heuristic' | 'ai' | 'none'
  reason: string
}

const REVIEW_THRESHOLD = 0.6

export class CategorizationService {
  private exactLayer = new ExactMerchantLayer()
  private regexLayer = new RegexKeywordLayer()
  private heuristicLayer = new HeuristicLayer()
  private aiLayer = new AiFallbackLayer()

  async categorize(transaction: NormalizedTransaction): Promise<CategorizationResult> {
    // Layer 1: Exact merchant match
    const exactResult = await this.exactLayer.categorize(transaction)
    if (exactResult && exactResult.confidence >= REVIEW_THRESHOLD) {
      return exactResult
    }

    // Layer 2: Regex/Keyword match
    const regexResult = await this.regexLayer.categorize(transaction)
    if (regexResult && regexResult.confidence >= REVIEW_THRESHOLD) {
      return regexResult
    }

    // Layer 3: Heuristic
    const heuristicResult = await this.heuristicLayer.categorize(transaction)
    if (heuristicResult && heuristicResult.confidence >= REVIEW_THRESHOLD) {
      return heuristicResult
    }

    // Layer 4: AI fallback (only if confidence < 0.6)
    const aiResult = await this.aiLayer.categorize(transaction)
    if (aiResult && aiResult.confidence >= REVIEW_THRESHOLD) {
      return aiResult
    }

    return {
      categoryId: null,
      subcategoryId: null,
      confidence: 0,
      method: 'none',
      reason: 'No matching rule found',
    }
  }

  async categorizeFast(transaction: NormalizedTransaction): Promise<CategorizationResult> {
    const exactResult = await this.exactLayer.categorize(transaction)
    if (exactResult && exactResult.confidence >= REVIEW_THRESHOLD) return exactResult

    const regexResult = await this.regexLayer.categorize(transaction)
    if (regexResult && regexResult.confidence >= REVIEW_THRESHOLD) return regexResult

    const heuristicResult = await this.heuristicLayer.categorize(transaction)
    if (heuristicResult && heuristicResult.confidence >= REVIEW_THRESHOLD) return heuristicResult

    return { categoryId: null, subcategoryId: null, confidence: 0, method: 'none', reason: 'No rule matched' }
  }

  async categorizeBatch(
    transactions: NormalizedTransaction[]
  ): Promise<CategorizationResult[]> {
    const results: CategorizationResult[] = []
    for (const tx of transactions) {
      const result = await this.categorize(tx)
      results.push(result)
    }
    return results
  }

  isAboveThreshold(confidence: number): boolean {
    return confidence >= REVIEW_THRESHOLD
  }
}
