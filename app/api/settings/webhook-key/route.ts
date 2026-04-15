import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

// Generate a new webhook API key and store it.
// Returns the key once — it will not be shown again in plaintext from GET /api/settings.
export async function POST() {
  const newKey = crypto.randomUUID()

  await prisma.appSetting.upsert({
    where: { key: 'webhook_api_key' },
    update: { value: newKey },
    create: { key: 'webhook_api_key', value: newKey },
  })

  return NextResponse.json({ key: newKey }, { status: 201 })
}

// Returns whether a key exists (true/false) — never the key value itself.
export async function GET() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: 'webhook_api_key' },
  })

  return NextResponse.json({ hasKey: setting !== null })
}
