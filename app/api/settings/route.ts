import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET() {
  try {
    const settings = await prisma.appSetting.findMany()
    const obj: Record<string, string> = {}
    for (const s of settings) {
      obj[s.key] = s.value
    }
    return NextResponse.json(obj)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

async function upsertSettings(body: Record<string, unknown>) {
  // Accept either { key, value } single-setting shape or a key-value map
  const pairs: [string, unknown][] =
    'key' in body && 'value' in body
      ? [[String(body.key), body.value]]
      : Object.entries(body)

  for (const [key, value] of pairs) {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value: String(value), updatedAt: new Date() },
      create: { key, value: String(value) },
    })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await upsertSettings(await request.json())
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await upsertSettings(await request.json())
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
