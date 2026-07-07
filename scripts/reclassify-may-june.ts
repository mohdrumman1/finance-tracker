/**
 * scripts/reclassify-may-june.ts
 *
 * Reclassify May/June 2026 transactions that were incorrectly marked as
 * 'income' due to a direction-inference bug in the CommBank import profile.
 * The bug used balance-delta to infer direction, which inverts on credit-card
 * accounts (spending increases the balance, so every purchase appeared as income).
 *
 * USAGE:
 *   # Dry run (safe, read-only - shows what WOULD change):
 *   npx tsx scripts/reclassify-may-june.ts
 *
 *   # Apply changes (write to DB):
 *   npx tsx scripts/reclassify-may-june.ts --apply
 *
 * SCOPE:
 *   - User: mohdrumman1@gmail.com (cmoahqc4l000004jrfmslywbm)
 *   - Account: Commonwealth Bank (cmoalo3y4000004i8i3ktez5x)
 *     Hardcoded to prevent over-scoping onto genuine income on ING/Amex/other accounts.
 *   - Period: 2026-05-01 to 2026-06-30 inclusive (±1 day UTC buffer for AEST midnight edge cases)
 *   - Only touches direction='income' rows with reviewStatus in ('pending', 'auto_categorized')
 *   - Rows with reviewStatus='reviewed' or any other human-reviewed state are NOT touched
 *   - Reclassifies matched rows to direction='expense', reviewStatus='needs_review'
 *
 * SAFETY:
 *   - Defaults to DRY RUN. Nothing is written unless --apply is passed.
 *   - Emits a pre-change JSON audit snapshot to scripts/reclassify-log-<timestamp>.json
 *   - DB-level guard: updateMany also filters on reviewStatus to prevent race conditions.
 *   - Does NOT touch rows already reviewed by a human.
 *
 * NOTE ON SOURCETYPE:
 *   The original bug report referenced CommbankPdfProfile (sourceType='pdf'). However,
 *   actual Turso data shows all 63 affected rows have sourceType='csv'. Scoping by
 *   accountId alone (rather than accountId+sourceType='pdf') is sufficient to isolate
 *   the affected data and avoids excluding the real affected rows.
 *
 * NOTE ON ACCOUNT.USERID:
 *   All Account rows in Turso have userId=NULL — the column was added to the schema
 *   but never backfilled. Prisma's user.accounts relation returns [] and the old script
 *   would exit with "User has no accounts". This version hardcodes the accountId.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Target constants — hardcoded to prevent over-scoping onto other accounts.
// Verified by querying Turso on 2026-07-07.
// ---------------------------------------------------------------------------
const TARGET_USER_EMAIL = 'mohdrumman1@gmail.com'
const TARGET_USER_ID    = 'cmoahqc4l000004jrfmslywbm'

// CommBank account containing the misclassified income rows:
const COMMBANK_ACCOUNTS = [
  { id: 'cmoalo3y4000004i8i3ktez5x', name: 'Commonwealth Bank' },
] as const

// reviewStatus values that are safe to downgrade to 'needs_review'.
// Any other status (reviewed, confirmed, dismissed, …) implies a human has
// already looked at the row — do NOT overwrite their decision.
// Source: prisma/schema.prisma Transaction.reviewStatus comment.
const SAFE_TO_FLIP_STATUSES = ['pending', 'auto_categorized'] as const
type SafeStatus = (typeof SAFE_TO_FLIP_STATUSES)[number]

// ---------------------------------------------------------------------------
// DB connection (mirrors lib/db/client.ts)
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
// Income keyword patterns
//
// If a transaction description matches any of these, it is KEPT as income
// (genuine income). All other income transactions in May/June on the scoped
// account are treated as misclassified expenses.
//
// Dead-code patterns removed vs. previous version:
//   - /\bONLINE\s+PAYMENT\s+RECEIVED\b/i — already caught by
//     TransactionNormalizer.detectTransfer() → direction='transfer', so rows
//     with this description never enter the income candidate pool.
//   - /\bTHANKYOU\b/i — same reason (detectTransfer has /\bTHANKYOU\b/).
//
// /\bREFUND\b/i tightened to /\bTAX\s+REFUND\b/i:
//   bare REFUND matches retail refunds (e.g. "REFUND HAIR SALON") which are
//   genuine expenses being refunded, not income.
//
// /\bPAYMENT\s+RECEIVED\b/i kept:
//   detectTransfer only matches "ONLINE PAYMENT RECEIVED" (AmEx specific),
//   not the plain form, so this pattern still has work to do here.
// ---------------------------------------------------------------------------
const REAL_INCOME_PATTERNS = [
  /\bSALARY\b/i,
  /\bPAYROLL\b/i,
  /\bWAGES?\b/i,
  /\bINTEREST\b/i,
  /\bDIVIDEND\b/i,
  /\bCENTRELINK\b/i,
  /\bGOVT?\s+PAYMENT\b/i,
  /\bTAX\s+REFUND\b/i,       // tightened from bare /\bREFUND\b/i
  /\bCASHBACK\b/i,
  /\bREBATED?\b/i,
  /\bCOMPENSATION\b/i,
  /\bSETTLEMENT\b/i,
  /\bINSURANCE\s+CLAIM\b/i,
  /\bPAYMENT\s+RECEIVED\b/i, // kept: not handled by detectTransfer for bare form
]

function isRealIncome(description: string): boolean {
  return REAL_INCOME_PATTERNS.some((re) => re.test(description))
}

function isSafeToFlip(reviewStatus: string): reviewStatus is SafeStatus {
  return (SAFE_TO_FLIP_STATUSES as readonly string[]).includes(reviewStatus)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const applyChanges = process.argv.includes('--apply')
  const prisma = createClient()

  try {
    console.log('='.repeat(72))
    console.log('Reclassify May/June 2026 income -> expense')
    console.log(`Mode: ${applyChanges ? 'APPLY (writing to DB)' : 'DRY RUN (read-only)'}`)
    console.log('='.repeat(72))
    console.log()

    // Known data issue — log it prominently
    console.log('WARNING: Account.userId is NULL for all rows in Turso.')
    console.log('         Prisma user.accounts returns [] — scoping via hardcoded accountId instead.')
    console.log('         Investigate schema/seed: Account.userId should be backfilled.')
    console.log()

    // Scope banner
    console.log(`User: ${TARGET_USER_EMAIL} (${TARGET_USER_ID})`)
    for (const acct of COMMBANK_ACCOUNTS) {
      console.log(`Scoping to account: ${acct.name} (${acct.id})`)
    }
    console.log()

    // Verify the user exists and our hardcoded ID still matches
    const user = await prisma.user.findUnique({
      where: { email: TARGET_USER_EMAIL },
    })
    if (!user) {
      console.error(`ERROR: User ${TARGET_USER_EMAIL} not found in database.`)
      process.exit(1)
    }
    if (user.id !== TARGET_USER_ID) {
      console.error(`ERROR: User ID mismatch — expected ${TARGET_USER_ID}, got ${user.id}.`)
      console.error('       Update TARGET_USER_ID constant at the top of this script and re-run.')
      process.exit(1)
    }

    const targetAccountIds = COMMBANK_ACCOUNTS.map((a) => a.id)

    // Date range with ±1 day UTC buffer for Australia/Sydney timezone edge cases.
    // A Sydney midnight-ish transaction on 2026-05-01 local is stored as 2026-04-30T14:xx:00Z
    // and would be excluded by a hard 2026-05-01T00:00:00Z start.
    const start = new Date('2026-04-30T00:00:00.000Z')
    const end   = new Date('2026-07-01T23:59:59.999Z')

    // Fetch all 'income' transactions in the target period/accounts.
    // NOTE: Transaction model has no userId column — scope is solely via accountId.
    const candidates = await prisma.transaction.findMany({
      where: {
        accountId:       { in: targetAccountIds },
        direction:       'income',
        transactionDate: { gte: start, lte: end },
      },
      orderBy: { transactionDate: 'asc' },
      include: { account: true, category: true },
    })

    console.log(`Income transactions in May-June 2026: ${candidates.length}`)
    console.log()

    // Partition candidates into three buckets:
    //   keepAsIncome      — description matches genuine income patterns
    //   toReclassify      — non-income, safe reviewStatus → flip to expense
    //   humanSkipped      — non-income, but human has already reviewed → leave alone
    const keepAsIncome = candidates.filter(
      (tx) => isRealIncome(tx.descriptionRaw) || isRealIncome(tx.descriptionNormalized ?? '')
    )
    const nonIncome = candidates.filter(
      (tx) => !isRealIncome(tx.descriptionRaw) && !isRealIncome(tx.descriptionNormalized ?? '')
    )
    const toReclassify   = nonIncome.filter((tx) => isSafeToFlip(tx.reviewStatus))
    const humanSkipped   = nonIncome.filter((tx) => !isSafeToFlip(tx.reviewStatus))

    // ── Report: keep as income ──────────────────────────────────────────────
    console.log(`Keeping as income (${keepAsIncome.length}):`)
    if (keepAsIncome.length === 0) {
      console.log('  (none)')
    } else {
      for (const tx of keepAsIncome) {
        const date = tx.transactionDate.toISOString().slice(0, 10)
        const cat  = tx.category?.name ?? 'uncategorized'
        console.log(`  ${date}  $${tx.amount.toFixed(2).padStart(10)}  [${cat}]  ${tx.descriptionRaw.slice(0, 60)}`)
      }
    }
    console.log()

    // ── Report: human-reviewed rows we are intentionally skipping ───────────
    if (humanSkipped.length > 0) {
      console.log(`Skipping — already human-reviewed (${humanSkipped.length}):`)
      for (const tx of humanSkipped) {
        const date = tx.transactionDate.toISOString().slice(0, 10)
        const cat  = tx.category?.name ?? 'uncategorized'
        console.log(
          `  ${date}  $${tx.amount.toFixed(2).padStart(10)}  [${cat}]` +
          `  [${tx.reviewStatus}]  ${tx.descriptionRaw.slice(0, 60)}`
        )
      }
      console.log()
    }

    // ── Report: rows to reclassify ──────────────────────────────────────────
    console.log(`To reclassify income -> expense (${toReclassify.length}):`)
    if (toReclassify.length === 0) {
      console.log('  (none)')
    } else {
      for (const tx of toReclassify) {
        const date = tx.transactionDate.toISOString().slice(0, 10)
        const cat  = tx.category?.name ?? 'uncategorized'
        const acct = tx.account?.name ?? tx.accountId
        console.log(`  ${date}  $${tx.amount.toFixed(2).padStart(10)}  [${cat}]  ${tx.descriptionRaw.slice(0, 60)}`)
        console.log(`           account: ${acct}  reviewStatus: ${tx.reviewStatus}`)
      }
    }
    console.log()

    if (toReclassify.length === 0) {
      console.log('Nothing to do.')
      return
    }

    // ── Write audit log (pre-change snapshot for manual rollback) ───────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const auditPath = path.resolve(process.cwd(), `scripts/reclassify-log-${timestamp}.json`)
    const auditData = toReclassify.map((tx) => ({
      id:           tx.id,
      date:         tx.transactionDate.toISOString(),
      amount:       tx.amount,
      description:  tx.descriptionRaw,
      direction:    tx.direction,
      reviewStatus: tx.reviewStatus,
      accountId:    tx.accountId,
      accountName:  tx.account?.name ?? null,
    }))
    fs.writeFileSync(auditPath, JSON.stringify(auditData, null, 2))
    console.log(`Audit log (pre-change snapshot): ${auditPath}`)
    console.log()

    if (!applyChanges) {
      console.log('-'.repeat(72))
      console.log(`DRY RUN: ${toReclassify.length} transaction(s) would be flipped to expense.`)
      console.log(`         ${humanSkipped.length} transaction(s) skipped (human-reviewed — untouched).`)
      console.log()
      console.log('To apply, run:')
      console.log('  npx tsx scripts/reclassify-may-june.ts --apply')
      console.log('-'.repeat(72))
      console.log()
      return
    }

    // ── Apply the changes ───────────────────────────────────────────────────
    console.log(`Applying ${toReclassify.length} update(s)...`)
    const ids = toReclassify.map((tx) => tx.id)

    // DB-level guard on reviewStatus prevents clobbering rows whose status
    // changed between our read and this write (e.g. user reviewed in the app).
    const result = await prisma.transaction.updateMany({
      where: {
        id:           { in: ids },
        reviewStatus: { in: [...SAFE_TO_FLIP_STATUSES] },
      },
      data: {
        direction:    'expense',
        reviewStatus: 'needs_review',
        updatedAt:    new Date(),
      },
    })

    console.log()
    console.log('='.repeat(72))
    console.log(`DONE: ${result.count} transaction(s) reclassified to expense.`)
    console.log(`      ${humanSkipped.length} transaction(s) left untouched (human-reviewed).`)
    if (result.count < toReclassify.length) {
      console.log(`      NOTE: ${toReclassify.length - result.count} row(s) were skipped by the DB guard`)
      console.log(`            (reviewStatus changed between read and write — safe to re-run).`)
    }
    console.log('='.repeat(72))
    console.log()
    console.log('Next steps:')
    console.log('  1. Review the transactions in the app (Review queue shows needs_review rows).')
    console.log('  2. Re-run AI categorization if needed.')
    console.log('  3. Check your May/June spending totals on the dashboard.')
    console.log()
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
