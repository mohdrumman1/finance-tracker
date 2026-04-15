import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { WebhookTransactionService } from '@/lib/webhooks/WebhookTransactionService'
import type { WebhookPayload } from '@/lib/importer/normalizer/TransactionNormalizer'

const service = new WebhookTransactionService()

async function validateApiKey(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false

  const providedKey = authHeader.slice(7)
  if (!providedKey) return false

  const setting = await prisma.appSetting.findUnique({
    where: { key: 'webhook_api_key' },
  })

  return setting?.value === providedKey
}

export async function POST(request: NextRequest) {
  const isValid = await validateApiKey(request)
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<WebhookPayload>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { accountId, transactionDate, descriptionRaw, amount, direction } = body

  if (!accountId || !transactionDate || !descriptionRaw || amount === undefined || !direction) {
    return NextResponse.json(
      { error: 'Missing required fields: accountId, transactionDate, descriptionRaw, amount, direction' },
      { status: 400 }
    )
  }

  if (!['income', 'expense', 'transfer'].includes(direction)) {
    return NextResponse.json(
      { error: 'direction must be one of: income, expense, transfer' },
      { status: 400 }
    )
  }

  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  // Verify the account exists
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true } })
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 400 })
  }

  try {
    const result = await service.createFromWebhook(body as WebhookPayload)

    if (result.isDuplicate) {
      return NextResponse.json(
        { error: 'Duplicate transaction', existingId: result.existingId },
        { status: 409 }
      )
    }

    return NextResponse.json(result.transaction, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create transaction'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
