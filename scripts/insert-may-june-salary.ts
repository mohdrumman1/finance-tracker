/**
 * scripts/insert-may-june-salary.ts
 *
 * Manually inserts two missing salary deposit transactions for user
 * mohdrumman1@gmail.com that were not ingested by the CommBank PDF importer:
 *
 *   14 May 2026 — Salary 20150 NET PAY CL 26339 — +$5,561.39
 *   12 Jun 2026 — Salary 20150 NET PAY CL 26339 — +$5,561.39
 *
 * USAGE:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/insert-may-june-salary.ts           # dry-run
 *   npx tsx scripts/insert-may-june-salary.ts --apply   # writes to DB
 *
 * SAFETY:
 *   - Dry-run by default. Nothing written unless --apply is passed.
 *   - Duplicate check runs before each insert; STOPS if a matching row exists.
 *   - Writes pre-insert snapshot to scripts/pre-fix-salary-insert-<ISO>.json.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TARGET_USER_ID    = 'cmoahqc4l000004jrfmslywbm'
const TARGET_USER_EMAIL = 'mohdrumman1@gmail.com'
// CommBank account — verified from existing scripts (reclassify-may-june.ts)
const COMMBANK_ACCOUNT_ID = 'cmoalo3y4000004i8i3ktez5x'

const SALARY_DESCRIPTION = 'Salary 20150 NET PAY CL 26339'
const SALARY_AMOUNT      = 5561.39

// Amount range for duplicate detection (±$1 tolerance)
const AMOUNT_LOW  = 5560
const AMOUNT_HIGH = 5562

// IST-aligned date windows (UTC+5:30) — mirrors existing script conventions.
// May 2026 IST: 2026-04-30T18:30:00Z → 2026-05-31T18:30:00Z
// Jun 2026 IST: 2026-05-31T18:30:00Z → 2026-06-30T18:30:00Z
const MAY_START = new Date('2026-04-30T18:30:00.000Z')
const MAY_END   = new Date('2026-05-31T18:30:00.000Z')
const JUN_START = new Date('2026-05-31T18:30:00.000Z')
const JUN_END   = new Date('2026-06-30T18:30:00.000Z')

// Duplicate-check windows (wide UTC buffer to catch any timezone-shifted storage)
const MAY14_START = new Date('2026-05-13T00:00:00.000Z')
const MAY14_END   = new Date('2026-05-15T23:59:59.999Z')
const JUN12_START = new Date('2026-06-11T00:00:00.000Z')
const JUN12_END   = new Date('2026-06-13T23:59:59.999Z')

// ---------------------------------------------------------------------------
// DB client (mirrors lib/db/client.ts + existing scripts)
// ---------------------------------------------------------------------------
function createClient(): PrismaClient {
  if (process.env.TURSO_AUTH_TOKEN) {
    const adapter = new PrismaLibSql({
      url: process.env.DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new PrismaClient({ adapter } as any)
  }
  const dbPath = path.resolve(process.cwd(), 'prisma/finance.db')
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sumBy(txs: { amount: number }[], dir: string, txsWithDir: { direction: string; amount: number }[]) {
  return txsWithDir.filter((t) => t.direction === dir).reduce((s, t) => s + t.amount, 0)
}

async function getMonthTotals(
  prisma: PrismaClient,
  accountIds: string[],
  start: Date,
  end: Date,
  label: string
) {
  const txs = await prisma.transaction.findMany({
    where: { accountId: { in: accountIds }, transactionDate: { gte: start, lt: end } },
    select: { direction: true, amount: true },
  })
  const income  = txs.filter((t) => t.direction === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = txs.filter((t) => t.direction === 'expense').reduce((s, t) => s + t.amount, 0)
  console.log(`${label}: income=$${income.toFixed(2)}  expense=$${expense.toFixed(2)}  (${txs.length} rows)`)
  return { income, expense, count: txs.length }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const applyChanges = process.argv.includes('--apply')
  const prisma = createClient()
  const iso = new Date().toISOString().replace(/[:.]/g, '-')

  try {
    console.log('='.repeat(72))
    console.log('insert-may-june-salary.ts')
    console.log(`Mode: ${applyChanges ? 'APPLY (writing to DB)' : 'DRY RUN (read-only)'}`)
    console.log('='.repeat(72))
    console.log()

    // ── Verify user ────────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({ where: { id: TARGET_USER_ID } })
    if (!user) {
      console.error(`STOP: User ${TARGET_USER_ID} not found.`)
      process.exit(1)
    }
    if (user.email !== TARGET_USER_EMAIL) {
      console.error(`STOP: Expected email ${TARGET_USER_EMAIL}, got ${user.email}. ID mismatch?`)
      process.exit(1)
    }
    console.log(`Confirmed user: ${user.email} (${user.id})`)

    // ── List all accounts for this user ────────────────────────────────────
    const allAccounts = await prisma.account.findMany({
      select: { id: true, name: true, institution: true, accountType: true, userId: true },
    })
    console.log(`\nAll accounts in DB (${allAccounts.length}):`)
    for (const a of allAccounts) {
      console.log(`  ${a.id}  "${a.name}"  institution=${a.institution}  type=${a.accountType}  userId=${a.userId ?? 'NULL'}`)
    }

    // Verify our hardcoded CommBank account exists
    const commbankAccount = allAccounts.find((a) => a.id === COMMBANK_ACCOUNT_ID)
    if (!commbankAccount) {
      console.error(`\nSTOP: CommBank account ${COMMBANK_ACCOUNT_ID} not found in DB.`)
      console.error('      Check COMMBANK_ACCOUNT_ID constant.')
      process.exit(1)
    }
    console.log(`\nChosen account: "${commbankAccount.name}" (${commbankAccount.id})`)
    console.log(`Reasoning: CommBank account hardcoded from previous scripts (reclassify-may-june.ts,`)
    console.log(`           fix-accounts-and-income.ts). Salary deposits go to the everyday/current account.`)
    console.log(`           Transaction count check not needed — this is the only CommBank account.`)

    // ── Sample existing income transaction to understand date storage ───────
    const sampleIncome = await prisma.transaction.findFirst({
      where: { accountId: COMMBANK_ACCOUNT_ID, direction: 'income' },
      select: { id: true, transactionDate: true, descriptionRaw: true, sourceType: true, importBatchId: true },
      orderBy: { transactionDate: 'desc' },
    })
    if (sampleIncome) {
      console.log(`\nSample existing income tx: id=${sampleIncome.id}`)
      console.log(`  transactionDate ISO: ${sampleIncome.transactionDate.toISOString()}`)
      console.log(`  descriptionRaw: ${sampleIncome.descriptionRaw}`)
      console.log(`  sourceType: ${sampleIncome.sourceType}`)
      console.log(`  importBatchId: ${sampleIncome.importBatchId ?? 'null'}`)
    } else {
      console.log('\nNo existing income transaction found on CommBank account (all flipped to expense).')
      console.log('Checking any transaction for date format...')
      const sampleAny = await prisma.transaction.findFirst({
        where: { accountId: COMMBANK_ACCOUNT_ID },
        select: { id: true, transactionDate: true, descriptionRaw: true, sourceType: true },
        orderBy: { transactionDate: 'desc' },
      })
      if (sampleAny) {
        console.log(`  Sample tx date ISO: ${sampleAny.transactionDate.toISOString()}`)
        console.log(`  descriptionRaw: ${sampleAny.descriptionRaw}`)
        console.log(`  sourceType: ${sampleAny.sourceType}`)
      }
    }

    // ── Look up "Salary" / "Income" category ───────────────────────────────
    const salaryCategory = await prisma.category.findFirst({
      where: { name: { contains: 'Salary' } },
      select: { id: true, name: true },
    })
    const incomeCategory = salaryCategory ?? await prisma.category.findFirst({
      where: { name: { contains: 'Income' } },
      select: { id: true, name: true },
    })
    if (incomeCategory) {
      console.log(`\nCategory found: "${incomeCategory.name}" (${incomeCategory.id})`)
    } else {
      console.log('\nNo Salary/Income category found — categoryId will be null.')
    }

    // ── Duplicate check ─────────────────────────────────────────────────────
    console.log('\n--- Duplicate check ---')

    const mayDupes = await prisma.transaction.findMany({
      where: {
        accountId:       COMMBANK_ACCOUNT_ID,
        transactionDate: { gte: MAY14_START, lte: MAY14_END },
        amount:          { gte: AMOUNT_LOW, lte: AMOUNT_HIGH },
      },
      select: { id: true, transactionDate: true, amount: true, direction: true, descriptionRaw: true },
    })
    console.log(`May 14 duplicate check (${MAY14_START.toISOString()} → ${MAY14_END.toISOString()}, $${AMOUNT_LOW}–$${AMOUNT_HIGH}): ${mayDupes.length} matching row(s)`)
    for (const d of mayDupes) {
      console.log(`  DUPE: ${d.id}  ${d.transactionDate.toISOString()}  $${d.amount}  ${d.direction}  "${d.descriptionRaw}"`)
    }

    const junDupes = await prisma.transaction.findMany({
      where: {
        accountId:       COMMBANK_ACCOUNT_ID,
        transactionDate: { gte: JUN12_START, lte: JUN12_END },
        amount:          { gte: AMOUNT_LOW, lte: AMOUNT_HIGH },
      },
      select: { id: true, transactionDate: true, amount: true, direction: true, descriptionRaw: true },
    })
    console.log(`Jun 12 duplicate check (${JUN12_START.toISOString()} → ${JUN12_END.toISOString()}, $${AMOUNT_LOW}–$${AMOUNT_HIGH}): ${junDupes.length} matching row(s)`)
    for (const d of junDupes) {
      console.log(`  DUPE: ${d.id}  ${d.transactionDate.toISOString()}  $${d.amount}  ${d.direction}  "${d.descriptionRaw}"`)
    }

    const insertMay = mayDupes.length === 0
    const insertJun = junDupes.length === 0

    if (!insertMay && !insertJun) {
      console.log('\nBOTH rows already exist. Nothing to insert. Exiting.')
      process.exit(0)
    }
    if (!insertMay) {
      console.log('\nMay 14 salary already exists — will SKIP that insert.')
    }
    if (!insertJun) {
      console.log('\nJun 12 salary already exists — will SKIP that insert.')
    }

    // ── Determine transactionDate values ────────────────────────────────────
    // Use UTC midnight of the Australian calendar date.
    // The reclassify script notes Sydney midnight = 2026-05-01T14:00:00Z (UTC+10 AEST).
    // However most entries appear to be stored at UTC midnight of the stated date
    // (Turso SQLite stores ISO strings; no tz conversion by the importer).
    // We store at UTC midnight of the transaction date as stated on the PDF.
    const MAY14_DATE = new Date('2026-05-14T00:00:00.000Z')
    const JUN12_DATE = new Date('2026-06-12T00:00:00.000Z')

    // ── Before totals ──────────────────────────────────────────────────────
    console.log('\n--- BEFORE totals ---')
    const userAccountIds = [COMMBANK_ACCOUNT_ID]
    // Also include any other accounts linked to the user
    const linkedAccounts = allAccounts.filter((a) => a.userId === TARGET_USER_ID)
    for (const la of linkedAccounts) {
      if (!userAccountIds.includes(la.id)) userAccountIds.push(la.id)
    }
    if (userAccountIds.length === 1) {
      // userId may still be null on all accounts — hardcode CommBank only
      console.log('(Note: scoping BEFORE/AFTER totals to CommBank account only, as other accounts may belong to same user but lack userId linkage)')
    }

    const beforeMay = await getMonthTotals(prisma, userAccountIds, MAY_START, MAY_END, 'BEFORE May 2026')
    const beforeJun = await getMonthTotals(prisma, userAccountIds, JUN_START, JUN_END, 'BEFORE Jun 2026')

    // ── Write pre-fix snapshot ─────────────────────────────────────────────
    const snapshotPath = path.resolve(
      process.cwd(),
      `scripts/pre-fix-salary-insert-${iso}.json`
    )
    const snapshot = {
      timestamp:         new Date().toISOString(),
      userId:            TARGET_USER_ID,
      userEmail:         TARGET_USER_EMAIL,
      chosenAccount:     { id: commbankAccount.id, name: commbankAccount.name },
      categoryId:        incomeCategory?.id ?? null,
      categoryName:      incomeCategory?.name ?? null,
      duplicateCheck:    {
        may14: { found: mayDupes.length, rows: mayDupes },
        jun12: { found: junDupes.length, rows: junDupes },
      },
      beforeTotals: {
        may: beforeMay,
        jun: beforeJun,
      },
    }
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))
    console.log(`\nPre-fix snapshot written: ${snapshotPath}`)

    if (!applyChanges) {
      console.log('\nDRY RUN: Stopping before writes.')
      console.log(`  Would insert May 14: ${insertMay}`)
      console.log(`  Would insert Jun 12: ${insertJun}`)
      console.log('Re-run with --apply to write to DB.')
      return
    }

    // ── Insert rows ────────────────────────────────────────────────────────
    console.log('\n--- Inserting ---')
    const insertedIds: string[] = []

    if (insertMay) {
      const mayTx = await prisma.transaction.create({
        data: {
          accountId:             COMMBANK_ACCOUNT_ID,
          sourceType:            'manual',
          transactionDate:       MAY14_DATE,
          descriptionRaw:        SALARY_DESCRIPTION,
          descriptionNormalized: SALARY_DESCRIPTION,
          merchantName:          'Salary 20150',
          amount:                SALARY_AMOUNT,
          currency:              'AUD',
          direction:             'income',
          categoryId:            incomeCategory?.id ?? null,
          isRecurring:           true,
          isTransfer:            false,
          isExcludedFromBudget:  false,
          reviewStatus:          'reviewed',
          confidenceScore:       1.0,
          notes:                 'Manually inserted — missing from CommBank PDF import (May-Jun 2026 salary gap)',
        },
      })
      insertedIds.push(mayTx.id)
      console.log(`Inserted May 14 salary: id=${mayTx.id}  date=${mayTx.transactionDate.toISOString()}  amount=$${mayTx.amount}`)
    }

    if (insertJun) {
      const junTx = await prisma.transaction.create({
        data: {
          accountId:             COMMBANK_ACCOUNT_ID,
          sourceType:            'manual',
          transactionDate:       JUN12_DATE,
          descriptionRaw:        SALARY_DESCRIPTION,
          descriptionNormalized: SALARY_DESCRIPTION,
          merchantName:          'Salary 20150',
          amount:                SALARY_AMOUNT,
          currency:              'AUD',
          direction:             'income',
          categoryId:            incomeCategory?.id ?? null,
          isRecurring:           true,
          isTransfer:            false,
          isExcludedFromBudget:  false,
          reviewStatus:          'reviewed',
          confidenceScore:       1.0,
          notes:                 'Manually inserted — missing from CommBank PDF import (May-Jun 2026 salary gap)',
        },
      })
      insertedIds.push(junTx.id)
      console.log(`Inserted Jun 12 salary: id=${junTx.id}  date=${junTx.transactionDate.toISOString()}  amount=$${junTx.amount}`)
    }

    // ── After totals ───────────────────────────────────────────────────────
    console.log('\n--- AFTER totals ---')
    const afterMay = await getMonthTotals(prisma, userAccountIds, MAY_START, MAY_END, 'AFTER  May 2026')
    const afterJun = await getMonthTotals(prisma, userAccountIds, JUN_START, JUN_END, 'AFTER  Jun 2026')

    // ── Verify delta ───────────────────────────────────────────────────────
    console.log('\n--- Verification ---')
    const mayDelta = afterMay.income - beforeMay.income
    const junDelta = afterJun.income - beforeJun.income
    console.log(`May income delta: +$${mayDelta.toFixed(2)} (expected: +$${insertMay ? SALARY_AMOUNT.toFixed(2) : '0.00'})`)
    console.log(`Jun income delta: +$${junDelta.toFixed(2)} (expected: +$${insertJun ? SALARY_AMOUNT.toFixed(2) : '0.00'})`)

    if (insertMay && Math.abs(mayDelta - SALARY_AMOUNT) > 0.01) {
      console.error(`ERROR: May income delta mismatch! Expected +$${SALARY_AMOUNT}, got +$${mayDelta.toFixed(2)}`)
    }
    if (insertJun && Math.abs(junDelta - SALARY_AMOUNT) > 0.01) {
      console.error(`ERROR: Jun income delta mismatch! Expected +$${SALARY_AMOUNT}, got +$${junDelta.toFixed(2)}`)
    }

    // ── Summary ────────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(72))
    console.log('COMPLETE')
    console.log(`Inserted IDs: ${insertedIds.join(', ')}`)
    console.log(`Account: "${commbankAccount.name}" (${commbankAccount.id})`)
    console.log(`\nBEFORE May  income=$${beforeMay.income.toFixed(2)}  expense=$${beforeMay.expense.toFixed(2)}`)
    console.log(`AFTER  May  income=$${afterMay.income.toFixed(2)}  expense=$${afterMay.expense.toFixed(2)}`)
    console.log(`BEFORE Jun  income=$${beforeJun.income.toFixed(2)}  expense=$${beforeJun.expense.toFixed(2)}`)
    console.log(`AFTER  Jun  income=$${afterJun.income.toFixed(2)}  expense=$${afterJun.expense.toFixed(2)}`)
    console.log('='.repeat(72))

  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
