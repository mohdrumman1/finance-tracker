import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import path from 'path'
import fs from 'fs'

export async function POST() {
  try {
    const fixturePath = path.join(process.cwd(), 'fixtures/sample-transactions.json')
    if (!fs.existsSync(fixturePath)) {
      return NextResponse.json({ error: 'Demo data not found' }, { status: 404 })
    }

    const data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))

    // Create demo account if not exists
    for (const account of data.accounts) {
      await prisma.account.upsert({
        where: { id: account.id },
        update: {},
        create: account,
      })
    }

    // Import transactions
    let imported = 0
    for (const tx of data.transactions) {
      const existing = await prisma.transaction.findFirst({
        where: { id: tx.id },
      })
      if (!existing) {
        await prisma.transaction.create({
          data: {
            ...tx,
            transactionDate: new Date(tx.transactionDate),
          },
        })
        imported++
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      total: data.transactions.length,
    })
  } catch (error) {
    console.error('Demo import error:', error)
    return NextResponse.json({ error: 'Failed to import demo data' }, { status: 500 })
  }
}
