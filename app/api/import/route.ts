import { NextRequest, NextResponse } from 'next/server'
import { ImportService } from '@/lib/importer/ImportService'

const importService = new ImportService()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const profileId = formData.get('profileId') as string
    const accountId = formData.get('accountId') as string
    const mode = formData.get('mode') as 'preview' | 'confirm'

    if (!file || !profileId || !accountId) {
      return NextResponse.json(
        { error: 'Missing required fields: file, profileId, accountId' },
        { status: 400 }
      )
    }

    const content = await file.text()

    if (mode === 'preview') {
      const transactions = await importService.previewImport(content, profileId, accountId)
      return NextResponse.json({ transactions })
    } else {
      // Confirm: re-parse and save
      const transactions = await importService.previewImport(content, profileId, accountId)
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
