import { NextRequest, NextResponse } from 'next/server'
import { ImportService } from '@/lib/importer/ImportService'
import { prisma } from '@/lib/db/client'

const importService = new ImportService()

const PROFILE_ACCOUNT_META: Record<string, { name: string; institution: string; accountType: string }> = {
  commbank: { name: 'Commonwealth Bank', institution: 'Commonwealth Bank', accountType: 'transaction' },
  'commbank-pdf': { name: 'Commonwealth Bank', institution: 'Commonwealth Bank', accountType: 'transaction' },
  amex: { name: 'American Express', institution: 'American Express', accountType: 'credit' },
  'ing-pdf': { name: 'ING', institution: 'ING', accountType: 'transaction' },
  generic: { name: 'My Bank', institution: 'My Bank', accountType: 'transaction' },
}

async function resolveAccountId(accountId: string, profileId: string): Promise<string> {
  if (accountId && accountId !== 'default') {
    const exists = await prisma.account.findUnique({ where: { id: accountId } })
    if (exists) return accountId
  }

  const meta = PROFILE_ACCOUNT_META[profileId] ?? PROFILE_ACCOUNT_META.generic

  const existing = await prisma.account.findFirst({
    where: { institution: meta.institution },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return existing.id

  const created = await prisma.account.create({
    data: {
      name: meta.name,
      institution: meta.institution,
      accountType: meta.accountType,
      currency: 'AUD',
    },
  })
  return created.id
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const profileId = formData.get('profileId') as string
    const rawAccountId = formData.get('accountId') as string
    const mode = formData.get('mode') as 'preview' | 'confirm'

    if (!file || !profileId) {
      return NextResponse.json(
        { error: 'Missing required fields: file, profileId' },
        { status: 400 }
      )
    }

    const accountId = await resolveAccountId(rawAccountId, profileId)

    const isPdf = file.name.toLowerCase().endsWith('.pdf')
    const content = isPdf
      ? Buffer.from(await file.arrayBuffer())
      : await file.text()

    if (mode === 'preview') {
      const transactions = await importService.previewImport(content, profileId, accountId, file.name)
      return NextResponse.json({ transactions })
    } else {
      const transactions = await importService.previewImport(content, profileId, accountId, file.name)
      const result = await importService.confirmImport(
        transactions,
        accountId,
        file.name,
        profileId
      )
      return NextResponse.json(result)
    }
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}
