## 2026-07-09 — CommBank Transaction Summary PDF + credit card CSV profiles added

**Tags:** commbank, importer, pdf-parser, csv-parser, profile-detect, prod-fix
**Status:** Fixed

**Issue:** Letter-format Transaction Summary PDFs and credit card CSVs were silently misparsed (0 rows or crash on header) despite `detect()` selecting a profile — the wrong one. The classic `CommBank PDF` profile targeted classic NetBank statement format only; the credit card CSV upload path bypassed `detect()` entirely (hardcoded profileId).

**Investigation:** Audit against real Downloads files (`TransactionSummary.pdf` with 110 rows, `activity.csv` with 36 rows). Every row missed or crashed. Confirmed root cause: (a) existing profile regex didn't match signed-dollar amounts; (b) CSV path in ImportService called `getProfile(profileId)` directly, never calling `detect()`.

**Root cause:** (1) Existing `CommbankPdfProfile.detect()` matched "commbank" in the letter text and was routing letter-format PDFs to the wrong parser. (2) `ImportService.previewImport/confirmImport` for CSV called `this.profileRegistry.getProfile(profileId)` with the hardcoded 'commbank' from the UI, skipping auto-detection entirely. (3) `CommbankSummaryPdfProfile.ts:8` balance capture group was `(\$[\d,]+\.\d{2})` — no minus — silently dropping overdraft rows. (4) BOM bytes prepended by Excel stripped by `h.replace(/^﻿/, '')` was missing from credit card `detect()`. (5) `commbank-credit-card` and `commbank-summary-pdf` absent from `PROFILE_ACCOUNT_META`, causing credit card imports to be filed under "My Bank" generic transaction account.

**Fix:**
- `lib/importer/profiles/CommbankSummaryPdfProfile.ts:8` — balance group changed to `(-?\$[\d,]+\.\d{2})` to allow negative balances (overdraft)
- `lib/importer/profiles/CommbankCreditCardCsvProfile.ts:36` — `.replace(/^﻿/, '')` added to `detect()` header mapping to strip Excel BOM
- `lib/importer/ImportService.ts:45,99` — CSV path now calls `this.detectProfile(content)` first; falls back to user-selected profileId only if no detect() match
- `app/imports/page.tsx:49` — added `commbank-credit-card` to `BANK_PROFILES` dropdown for explicit manual selection
- `app/api/import/route.ts:11-12` — added `commbank-credit-card` (accountType: credit) and `commbank-summary-pdf` (accountType: transaction) to `PROFILE_ACCOUNT_META`
- `lib/importer/profiles/CommbankPdfProfile.ts` — `detect()` already excluded "Transaction Summary" (prior fix)
- `lib/importer/profiles/ProfileRegistry.ts` — both new profiles already registered in correct order

**Verify:** `npx vitest run tests/importer/` — 58 tests pass; `npx vitest run` — 87/87 pass. `grep -iE "rumman|talha" tests/fixtures/` — 0 lines (PII scrubbed).

**If it recurs:** Grep raw extracted PDF text for `Transaction Summary` header to confirm `detect()` dispatches to `CommbankSummaryPdfProfile`. For CSV, check if `ImportService.detectProfile()` is being called (log which profile was auto-detected). If credit card CSV still routes wrong, verify the header row does not have unexpected columns or column order.

---

## 2026-07-09 — CommBank PDF importer regex missed "Salary NET PAY" lines

**Tags:** commbank, importer, pdf-parser, salary, regex
**Status:** Fixed

**Issue:** Salary lines silently skipped from CommBank May and June 2026 PDF imports:
- 14 May 2026 — `Salary 20150 NET PAY CL 26339` — +$5,561.39
- 12 Jun 2026 — `Salary 20150 NET PAY CL 26339` — +$5,561.39
These rows were never imported; 0 matches in DuplicateDetector before the manual insert (see cross-ref below).

**Investigation:**
1. Identified that `extractRows()` in `lib/importer/profiles/CommbankPdfProfile.ts` gates each transaction block behind `if (amountsLineIdx < 0) continue`. If neither regex matches, the entire block is silently dropped.
2. Ran the two existing regexes against all plausible salary line formats in Node:
   - `AMOUNTS_END_RE` (`txAmount balance CR|DR` — CR/DR at end): matches standard merchant debit lines (e.g. `55.00 1,100.00 DR`). Also matches `5,561.39 5,815.66 CR` (CR at end).
   - The format `5,561.39 CR 5,815.66` (CR **between** amounts) → **NO MATCH** on `AMOUNTS_END_RE`.
3. CommBank salary/payroll lines in PDF extraction follow the `txAmount CR balance` column order (credit marker comes immediately after the transaction amount, before the running balance), whereas debit/expense lines place `DR` after the balance. No alternate regex existed for the credit-first order.
4. Also identified that `\s?` (0-or-1 whitespace) in `AMOUNTS_END_RE` would fail with column-aligned double-space output; changed to `\s*`.

**Root cause:** `lib/importer/profiles/CommbankPdfProfile.ts` — `AMOUNTS_END_RE` (line 21 before fix, line 21 after fix) only matched `txAmount balance CR|DR`. CommBank salary/payroll credit lines emit `txAmount CR|DR balance` (marker between amounts, not at end). No fallback regex existed for this layout. Blocks that didn't match were silently skipped at the `if (amountsLineIdx < 0) continue` guard (line ~103).

**Fix:** `lib/importer/profiles/CommbankPdfProfile.ts`

```diff
-const AMOUNTS_END_RE =
-  /([\d]{1,3}(?:,\d{3})*\.\d{2})\s?([\d]{1,3}(?:,\d{3})*\.\d{2})\s?(CR|DR)$/i
+const AMOUNTS_END_RE =
+  /([\d]{1,3}(?:,\d{3})*\.\d{2})\s*([\d]{1,3}(?:,\d{3})*\.\d{2})\s*(CR|DR)$/i
+
+// Salary/payroll credit format: txAmount CR|DR balance (marker between amounts)
+const AMOUNTS_CR_MID_RE =
+  /([\d]{1,3}(?:,\d{3})*\.\d{2})\s*(CR|DR)\s*([\d]{1,3}(?:,\d{3})*\.\d{2})$/i
```

The block-scan loop now tries `AMOUNTS_END_RE` first, then falls back to `AMOUNTS_CR_MID_RE` (groups remapped so callers always receive normalised `parsedTxAmt / parsedBalance / parsedCRDR / parsedMatchFull`).

**Verify:**
```bash
npx vitest run tests/importer/CommbankPdfProfile.test.ts
# Expected: 9 passed (9)

npx vitest run
# Expected: 56 passed (56)
```

**If it recurs:** First `grep -i salary` on the raw PDF-extracted text (add a `console.log(text)` in `extractRows` or run `pdf-parse` manually on the file). Check whether the salary line ends with a number (balance) — if so, it's the `txAmount CR balance` format and `AMOUNTS_CR_MID_RE` should catch it. If it ends with `CR`/`DR`, `AMOUNTS_END_RE` catches it. If neither matches, a new format variant is present.

**Cross-reference:** The two missing salary rows were manually inserted — see LEARNINGS.md entry immediately below: "Missing May/June 2026 salary deposits inserted manually" (2026-07-09). If those PDFs are re-imported after this fix, `DuplicateDetector` will catch them by `(date, amount)` key and skip them safely.

---

## 2026-07-09 — Missing May/June 2026 salary deposits inserted manually

**Tags:** commbank, importer, salary, missing-transactions, prod-db-write
**Status:** Fixed

**Issue:** PDF/CSV reimport of CommBank May-June 2026 statements did not ingest the two salary deposit transactions; dashboard showed $0 income for June and only $298.90 (non-salary) for May.
- 14 May 2026 — Salary 20150 NET PAY CL 26339 — +$5,561.39
- 12 Jun 2026 — Salary 20150 NET PAY CL 26339 — +$5,561.39

**Investigation:**
- Accounts checked: all 5 accounts for user `cmoahqc4l000004jrfmslywbm`. Two CommBank accounts exist: "Everyday Account" (`cmoakpcvy000004l2sncoj66u`, institution=Commbank) and "Commonwealth Bank" (`cmoalo3y4000004i8i3ktez5x`, institution=Commonwealth Bank).
- Chose `cmoalo3y4000004i8i3ktez5x` ("Commonwealth Bank") because all previous CommBank repair scripts (reclassify-may-june.ts, fix-accounts-and-income.ts) target this account — it holds all the May/June imported transactions.
- Duplicate check for both dates (±1 day UTC window, $5,560–$5,562 range): 0 matches — neither row existed in DB before this fix.
- Category found: "Income" (`cmocpb8w0000m04joxd0rql6l`).

**Root cause:** Unable to determine definitively without more digging. The importer skipped these rows — possibilities: (a) the salary rows appeared on a page the PDF parser failed to parse, (b) the CR/DR regex did not match the specific salary line format "Salary 20150 NET PAY CL 26339", or (c) duplicate detection (by description+amount+date) had a false positive. The importer root cause remains open.

**Fix:** Inserted 2 rows with IDs `cmrcjow6f00003wuzj7g8h8y1` (May 14), `cmrcjowfl00013wuzavgqd1zw` (Jun 12) via `scripts/insert-may-june-salary.ts`. Both set `sourceType='manual'`, `reviewStatus='reviewed'`, `direction='income'`, `categoryId=cmocpb8w0000m04joxd0rql6l` (Income).

Before/after:
- May: income $298.90 → $5,860.29 (delta +$5,561.39); expense unchanged $4,733.08
- Jun: income $0.00 → $5,561.39 (delta +$5,561.39); expense unchanged $3,195.65

**Verify:**
```
prisma.transaction.findMany({ where: { id: { in: ['cmrcjow6f00003wuzj7g8h8y1','cmrcjowfl00013wuzavgqd1zw'] } }, select: { id:true, transactionDate:true, amount:true, direction:true, reviewStatus:true } })
```

**If it recurs:** Before assuming salary is missing, run:
```sql
SELECT * FROM Transaction WHERE descriptionRaw LIKE '%Salary%' AND accountId = 'cmoalo3y4000004i8i3ktez5x';
```
Then check the import batch to see whether the file contained the rows and what the parser returned.

---

## 2026-07-08 — 28 CommBank income rows were retail purchases mis-labeled by pre-CR/DR importer; script skipped them due to reviewStatus=reviewed guard

**Tags:** commbank, income, expense, reclassify, reviewStatus, reviewed, mis-label, importer, credit-card
**Status:** Fixed

**Issue:** May 2026 income showed $199, June 2026 income showed $264 — all fake. 28 rows were obvious retail purchases (Woolworths, Kmart, Optus, Amazon, McDonald's, etc.) stored with `direction='income'` and `reviewStatus='reviewed'`.

**Investigation:** The `reclassify-may-june.ts` script (run 2026-07-06/07) correctly identified the mis-labeled rows but whitelisted only `reviewStatus IN ('pending', 'auto_categorized')`. These 28 rows had already been auto-marked `reviewed` by the auto-categorizer before the script ran, so they were reported in the "human-reviewed, skipping" bucket and left unchanged.

**Root cause:** Pre-CR/DR PDF importer (before the `amountsMatch[3]` fix in the 2026-07-06 entry) set all CommBank credit-card purchases as `direction='income'`. The auto-categorizer subsequently marked them `reviewed`. The reclassify script's `reviewStatus` guard correctly protected genuinely human-reviewed rows, but incorrectly left these auto-promoted rows untouched.

**Fix:** Flipped all 28 rows in-place with a targeted UPDATE on explicit IDs:
- `direction`: `income` → `expense`
- `reviewStatus`: `reviewed` → `needs_review`
- Pre-change snapshot: `scripts/pre-fix-income-flip-2026-07-07T21-15-59-008Z.json`
- Script used: `scripts/fix-accounts-and-income.ts --apply`

**Verify:**
```bash
# Run against prod (via script) — should show 0 income rows:
set -a; source .env.local; set +a
npx tsx -e "
const { PrismaClient } = require('@prisma/client')
const { PrismaLibSql } = require('@prisma/adapter-libsql')
const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
const prisma = new PrismaClient({ adapter })
prisma.transaction.count({ where: { accountId: 'cmoalo3y4000004i8i3ktez5x', direction: 'income', reviewStatus: 'reviewed', transactionDate: { gte: new Date('2026-04-30T18:30:00Z'), lt: new Date('2026-06-30T18:30:00Z') } } }).then(n => { console.log('income+reviewed count:', n); prisma.\$disconnect() })
"
# Expected output: income+reviewed count: 0
```

**If it recurs:** Any new statement re-import for CommBank credit-card should use the CR/DR-marker importer (post-2026-07-06 fix). Watch for `reviewed` status set by the auto-categorizer on freshly imported rows — if the categorizer is re-run before a manual reclassify pass, rows get promoted to `reviewed` and the reclassify guard will skip them again. Either widen the guard or run reclassify before categorization.

---

## 2026-07-08 — Account.userId was NULL on all rows; auth-scoped queries returned empty after multi-tenant fix

**Tags:** account, userId, backfill, auth, session, multi-tenant, dashboard, api, empty
**Status:** Fixed

**Issue:** Dashboard showed "No transactions yet" and all API calls to `/api/transactions` and `/api/accounts` returned 0 rows for the authenticated user, despite 200+ transactions existing in Turso. Second user `rumman.formaai@gmail.com` was created 2026-07-03 (after original diagnosis which assumed 1 user).

**Investigation:** All 5 `Account` rows had `userId=NULL`. The `account.userId` column was added to the schema (and the `account: { userId: session.userId }` scope was added to `/api/transactions`) but the existing rows were never backfilled. Prisma's `account: { userId: session.userId }` join condition returns 0 rows when `userId IS NULL`.

**Root cause:** Legacy accounts created before the `userId` column was populated. The `/api/accounts` route added `WHERE userId = session.userId` via Prisma but the existing rows all had `userId=NULL`, so they were invisible to the scoped queries.

**Fix:** Backfilled with a single Prisma `updateMany`:
```
UPDATE Account SET userId = 'cmoahqc4l000004jrfmslywbm' WHERE userId IS NULL
```
5 accounts updated. Pre-change snapshot: `scripts/pre-fix-accounts-2026-07-07T21-15-59-008Z.json`.
Script: `scripts/fix-accounts-and-income.ts --apply`

**Verify:**
```bash
# All accounts should have the userId set:
# SELECT id, name, userId FROM Account  →  all 5 rows show cmoahqc4l000004jrfmslywbm
```

**If it recurs:** Check whether the new signup/onboarding path writes `userId` on `Account` creation (it does — `app/api/accounts/route.ts` POST sets `userId: session.userId`). Only legacy rows created before this column was added will be NULL. If a new Account row appears with `userId=NULL`, it means a code path creates accounts without going through the API route (e.g. a seed script or direct DB insert).

---

## 2026-07-08 — Vercel build failed: better-sqlite3 pulled into webpack bundle via db/client transitive import

**Tags:** vercel, build, webpack, better-sqlite3, prisma, client-component, date-window, serverExternalPackages
**Status:** Fixed

**Issue:** Vercel build failed with `Module not found: Can't resolve 'fs'` tracing through:
`better-sqlite3/lib/database.js → @prisma/adapter-better-sqlite3/dist/index.mjs → lib/db/client.ts → lib/date-window.ts → app/advisor/page.tsx`

**Root cause:** `lib/db/client.ts` has a top-level static `import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'`. Both `app/advisor/page.tsx` and `app/dashboard/page.tsx` are `'use client'` components that import `startOfMonthIST` from `lib/date-window.ts`. That module had a top-level `import { prisma } from './db/client'` (needed for `getViewMonth`), creating a transitive dependency on `better-sqlite3` in the **client** bundle. `serverExternalPackages` in `next.config.ts` only protects server bundles — it has no effect on the client webpack pass, which does not support `fs`.

**Investigation:** Error trace pointed at `advisor/page.tsx`. Confirmed it has `'use client'`. Confirmed `date-window.ts` imported `prisma` at the top level for `getViewMonth`. This is what pulled the whole DB adapter chain into the browser bundle.

**Fix:** Split `lib/date-window.ts`:
- Removed `import { prisma }` and the `getViewMonth`/`ViewMonthResult` exports from `lib/date-window.ts` (file is now client-safe — only pure date helpers).
- Created `lib/db/view-month.ts` (server-only) containing `ViewMonthResult` and `getViewMonth`, importing `prisma` and the date helpers it needs.
- Updated `lib/insights/InsightService.ts`: added `import { getViewMonth } from '../db/view-month'`.
- Updated `tests/date-window/viewMonth.test.ts`: changed import to `../../lib/db/view-month`.

**Verify:** `npm run build` → must compile without `fs` errors; `npm test` → 47/47 pass.

**If it recurs:** A `'use client'` component that transitively imports `lib/db/client.ts` will reproduce this. Use `grep -rn "from.*db/client" app/` to check. Any file reachable from a client component must not import `prisma` or any Node-native adapter. Consider adding `import 'server-only'` at the top of `lib/db/client.ts` to get an early build error rather than a confusing webpack `fs` trace.

---

## 2026-07-08 — /api/ai window aligned to IST, DuplicateDetector false-positive test added, getViewMonth param renamed

**Tags:** ai-advisor, IST, timezone, date-window, DuplicateDetector, false-positive, getViewMonth, refactor
**Status:** Fixed

**Changes applied (all in one commit):**

**Task 1 — IST month boundaries in `/api/ai` route:**
`app/api/ai/route.ts` previously imported `startOfMonth`/`endOfMonth` from `date-fns` (UTC-anchored) for the monthly aggregation loop in `buildFinancialContext`. Replaced with `startOfMonthIST`/`endOfMonthIST` from `lib/date-window.ts` so the AI advisor sees the same month boundaries as the dashboard and InsightService.
Key diff:
```diff
-import { format, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns'
+import { format, eachMonthOfInterval } from 'date-fns'
+import { startOfMonthIST, endOfMonthIST } from '@/lib/date-window'
 ...
-    const mStart = startOfMonth(m)
-    const mEnd = endOfMonth(m)
+    const mStart = startOfMonthIST(m)
+    const mEnd = endOfMonthIST(m)
```

**Task 2 — DuplicateDetector false-positive test:**
Added test `'flags same-day refund and charge with equal absolute amount as duplicate (known limitation)'` to `tests/importer/DuplicateDetector.test.ts`. Documents that the (date, amount) key introduced in the 2026-07-08 re-key entry will collide a same-day refund and charge with equal absolute value, producing a false-positive duplicate. The test asserts the current (flawed but intentional) behaviour.

**Task 3 — Rename `now` param in `getViewMonth`:**
`lib/date-window.ts` `getViewMonth(userId, now)` → `getViewMonth(userId, referenceDate)`. JSDoc prose updated. All call sites are positional, so no caller updates required.

**Verify:**
```bash
npm test
# 47 passed (47)
npx tsc --noEmit 2>&1 | grep -v "^tests/"
# No output (no production TS errors)
```

**If it recurs:** Any new API route that aggregates by month should import from `lib/date-window.ts`, not raw `date-fns`. Search for `startOfMonth\|endOfMonth` in `app/api/` to catch regressions.

---

## 2026-07-08 — Pre-existing test failures on main (8 total — all fixed 2026-07-08)

**Tags:** test-failures, categorization, goals, duplicate-detector, ExactMerchantLayer, HeuristicLayer, GoalService
**Status:** Fixed

**Issue:** 8 tests were failing on clean main. All 8 are now fixed (see NEW entry above for the fixes applied).

**Original failures and their fixes:**

1. `ExactMerchantLayer.test.ts` — "respects direction filter" → **Root cause:** module-level `rulesPromise` cache persisted across tests; second test got stale mocked rules from first test. **Fix:** exported `clearExactRulesCache()` and called it in `beforeEach`.

2. `HeuristicLayer.test.ts` — "identifies transfer transactions" → **Root cause:** module-level `categoriesPromise` cache persisted; `transfers` was set to `cat-income` from first test's mock, not `cat-transfers` from the third test's mock. **Fix:** exported `clearHeuristicCache()` and called it in `beforeEach`.

3. `GoalService.test.ts` — "on track flag true when monthly contribution >= required savings" → **Root cause:** `computeProgress` uses `new Date()`. Test was written assuming April 2026 (~12 months from targetDate 2027-04-01). Running in July 2026 gives ~9 months, making required ≈ 4444 > 4000 contribution → onTrack false. **Fix:** `vi.setSystemTime(new Date('2026-04-01'))` pinned in `beforeAll`.

4–7. `DuplicateDetector.test.ts` — all 4 tests → **Root cause:** test file lacked `vi.mock('../../lib/db/client')` so `prisma.transaction.findMany` was not a function. **Fix:** added prisma mock to the test file (done in a prior session — the (date, amount) re-key entry).

8. `CategorizationService.test.ts` — "user override rule wins over built-in rules" → **Root cause:** same `rulesPromise` module-level cache as #1; test 1 cached `cat-groceries` rules, test 4's new mock was never called. **Fix:** `clearExactRulesCache()` in `beforeEach`.

**Verify:**
```bash
npm test
# Should show: 47 passed (47)
```

**If it recurs:** Any new test added to ExactMerchantLayer.test.ts or CategorizationService.test.ts that sets up a different `findMany` mock MUST call `clearExactRulesCache()` in `beforeEach`. Ditto `clearHeuristicCache()` for HeuristicLayer tests. Time-dependent GoalService tests must use `vi.setSystemTime`.

---

## 2026-07-08 — DuplicateDetector re-keyed from (date, amount, direction) to (date, amount)

**Tags:** duplicate-detector, direction, re-import, dedupe-key, reclassify
**Status:** Fixed

**Issue:** After the direction-classification bug fix (2026-07-06 entry), re-importing a bank statement whose rows were previously mis-classified (`income` instead of `expense`) would bypass dedupe. The old key included `direction`, so a stored row keyed `<date>:<amount>:income` did not match a re-parsed row keyed `<date>:<amount>:expense` — the transaction was imported twice.

**Root cause:** `lib/importer/duplicate/DuplicateDetector.ts` — `existingKeys` Set and per-candidate key both appended `:${tx.direction}`. After a direction reclassification the key differed from the DB row's key.

**Fix:** Dropped `direction` from the key in both the Set construction and the candidate key lookup. Also removed `direction: true` from the `select` clause (no longer read). Added inline comment noting the remaining trade-off: a same-day refund and charge with equal absolute value will collide (amount is always absolute per `TransactionNormalizer` line 86).

Key diff (`lib/importer/duplicate/DuplicateDetector.ts`):
```diff
-  select: { transactionDate: true, amount: true, direction: true },
+  select: { transactionDate: true, amount: true },
 ...
-  (tx) => `${startOfDay(tx.transactionDate).getTime()}:${tx.amount}:${tx.direction}`
+  // same-day refund + charge with equal absolute value will collide
+  (tx) => `${startOfDay(tx.transactionDate).getTime()}:${tx.amount}`
 ...
-  const key = `${startOfDay(tx.transactionDate).getTime()}:${tx.amount}:${tx.direction}`
+  const key = `${startOfDay(tx.transactionDate).getTime()}:${tx.amount}`
```

Also removed `DO NOT RE-IMPORT` warning banners from `scripts/reclassify-may-june.ts` (re-import is now safe).

**Verify:**
```bash
npx tsc --noEmit 2>&1 | head -20
npm test -- tests/importer/DuplicateDetector.test.ts
```

**If it recurs:** If the same transaction appears twice after re-import, check whether a same-day same-amount collision occurred (e.g. two charges of identical value on the same day, one of which is a refund). If this is a real hazard, consider adding `descriptionNormalized` to the key, but note that description normalisation is fuzzy and can change between import runs.

---

## 2026-07-07 — Dashboard cards showed zeros while /transactions had data — window locked to current month

**Tags:** dashboard, advisor, InsightService, viewMonth, date-window, IST, timezone, startOfMonth, endOfMonth, stale-window
**Status:** Fixed

**Issue:** Dashboard summary cards (Income, Expenses, Net Savings, Savings Rate) and the cashflow chart all showed zeros (or empty state) even though `/transactions` showed real data. The user's most recent transactions were in May–June 2026 and today was 2026-07-07 (July had almost nothing). The `/api/transactions` route was also unscoped — it returned all rows regardless of the authenticated caller.

**Investigation:**
1. Dashboard page was fetching transactions scoped to `startOfMonth(now)` / `endOfMonth(now)` where `now = new Date()` — hardcoded to the current calendar month (July).
2. User data was in May/June, so all fetches returned 0 rows. Cards showed zeros.
3. The advisor page used `getRange(preset)` which also derived dates from `new Date()` — stale in the same way when the selected preset covered a month with no data.
4. `InsightService.generateInsights(year, month, userId)` also used `new Date()` for its month boundaries. With year/month passed from outside it was slightly more flexible, but needed the `getViewMonth` fallback.
5. `startOfMonth` / `endOfMonth` from `date-fns` use UTC on a Vercel server. IST user's "start of July" is `2026-06-30T18:30:00Z`, not midnight UTC — so month-edge transactions were being dropped.
6. `/api/transactions` had no `userId` scoping in the Prisma query — it returned all users' rows.

**Root cause:**
- `app/dashboard/page.tsx` — month window derived from `new Date()` directly, not the user's most recent data.
- `app/advisor/page.tsx` — same raw `new Date()` window in `getRange()`.
- `lib/insights/InsightService.ts` — month windows built off `new Date()` without fallback.
- `lib/date-window.ts` — did not exist; `date-fns` helpers used UTC boundaries, not IST.
- `app/api/transactions/route.ts` — missing `account: { userId: session.userId }` scope in Prisma `where`.

**Fix:**
1. Created `lib/date-window.ts` with IST-aware `startOfMonthIST`, `endOfMonthIST`, `subMonthsIST` (wrapping `date-fns-tz`) and the `getViewMonth(userId, now)` async helper that queries the most recent transaction and returns the correct month anchor with an `isFallback` flag.
2. `app/dashboard/page.tsx` — Phase 1 fetches `/api/transactions?limit=1` to get `mostRecentTxDate`, derives `viewMonth`, then Phase 2 fetches all card/chart data anchored to `viewMonth`. Banner shown when `isFallback=true`.
3. `app/advisor/page.tsx` — added `rangeIsEmpty` check; when selected range has zero transactions a banner prompts switching to "All time". No viewMonth anchor in advisor (it uses free-form presets, not a fixed month).
4. `lib/insights/InsightService.ts` — calls `getViewMonth(userId, requestedDate)` and uses the effective year/month for all Prisma queries.
5. `app/api/transactions/route.ts` — added `account: { userId: session.userId }` to the Prisma `where` clause after verifying session via `getSession()`.
6. All other API routes (`accounts`, `export`, `import`, `insights`, `transactions/[id]`) verified to have matching auth guards.

**Verify:**
```bash
# No new TS errors in production code (pre-existing test errors filtered):
npx tsc --noEmit 2>&1 | grep -v "^tests/"
# Should print only lines from tests/importer/TransactionNormalizer.test.ts (pre-existing)

# New test passes:
npm test tests/date-window/viewMonth.test.ts
# Should show: 4 passed

# Lint clean (only pre-existing warnings, no errors):
npm run lint
```

**If it recurs:** Any new dashboard-adjacent page that calls `startOfMonth(new Date())` or `endOfMonth(new Date())` directly will have the same bug. Always use `startOfMonthIST`/`endOfMonthIST` from `lib/date-window.ts`, and anchor the month to `getViewMonth(userId, now).viewMonth` rather than `now`. Also check that new API routes scope Prisma queries with `account: { userId: session.userId }`.

---

## 2026-07-06 — May/June 2026 transactions misclassified as income (balance-delta inverts on credit card)

**Tags:** commbank, pdf-import, direction, income, expense, credit-card, balance-delta, CommbankPdfProfile
**Status:** Fixed

**Issue:** All expense transactions imported from a CommBank PDF in May and June 2026 were stored with `direction = 'income'`. February/March/April transactions from the same account were correct. No error was thrown; transactions were silently miscategorised.

**Investigation:**
1. Checked git log for `lib/importer/profiles/CommbankPdfProfile.ts` - 4 commits touched it since creation.
2. Found that commit `fcc7542` (April 24, 18:04) replaced the original `TX_REGEX`-based implementation with a balance-delta approach.
3. Original code (commit `5b68489`) used `TX_REGEX` capturing explicit `DR`/`CR` marker; `mapMatch()` set debit/credit based on `isDebit = direction.toUpperCase() === 'DR'`. This is correct.
4. Replacement code (`fcc7542`) used `balance > prevBalance` to infer direction. This works for TRANSACTION (checking) accounts but inverts on CREDIT CARD accounts: spending INCREASES the credit card balance (you owe more), so every purchase triggers `balance > prevBalance`, which was coded as income.
5. Feb/Mar/Apr transactions were from a CommBank TRANSACTION account (balance increases = income). May/June were from a CommBank CREDIT CARD account. Both are detected by the same `detect()` function (`/commonwealth bank|netbank|commbank/i`).
6. No Turso creds present locally - confirmed via absence of `.env`/`.env.local`. DB query skipped.

**Root cause:** `lib/importer/profiles/CommbankPdfProfile.ts` lines 121-133 (before fix) - direction determined from balance delta instead of the `CR`/`DR` label captured by `AMOUNTS_END_RE` (group 3). Credit card accounts have an inverted balance direction, so all expenses appeared as income.

**Fix:** Replace balance-delta direction logic with `amountsMatch[3].toUpperCase() === 'CR'`. Also updated `DATE_START_RE`, `AMOUNTS_END_RE`, `SINGLE_AMOUNT_END_RE`, `OPENINGBALANCE` check, and `dateMatch` regex to handle both concatenated and space-separated PDF text output (from the `renderPage` custom renderer added in commit `372ea01`).

Key diff (`lib/importer/profiles/CommbankPdfProfile.ts`):
```diff
-      if (prevBalance !== null && balance > prevBalance) {
-        credit = txAmount.toFixed(2)
-      } else {
-        debit = txAmount.toFixed(2)
-      }
+      // Use the explicit CR/DR label from the PDF to determine direction.
+      const drCr = amountsMatch[3].toUpperCase()
+      if (drCr === 'CR') {
+        credit = txAmount.toFixed(2)
+      } else {
+        debit = txAmount.toFixed(2)
+      }
```

Reclassification script for existing DB rows: `scripts/reclassify-may-june.ts`

**Verify:**
```bash
# No new TypeScript errors:
npx tsc --noEmit 2>&1 | grep -v "^tests/"
# Should print nothing (pre-existing test errors are filtered out)

# Dry-run reclassification (read-only):
npx ts-node scripts/reclassify-may-june.ts
# Review output, then apply:
npx ts-node scripts/reclassify-may-june.ts --apply
```

**If it recurs:** Check `amountsMatch[3]` in `CommbankPdfProfile.extractRows()`. If someone reverts to balance-delta, the bug returns for any credit-card PDF. The fix must trust CR/DR. Also check whether the `detect()` function differentiates between CommBank transaction vs credit card PDFs - currently it doesn't, but both formats use the same CR/DR convention so one profile handles both.

---

## 2026-07-05 — Dashboard shows empty-state despite transactions existing (date-window mismatch)

**Tags:** dashboard, empty-state, date-filter, hasData, transactions
**Status:** Fixed

**Issue:** `/dashboard` showed "No transactions yet — Import your bank transactions to get started with your financial overview." for a user who had successfully imported transactions (visible on `/transactions`). The Turso DB had been recently unarchived and was confirmed working.

**Investigation:**
1. Grep'd for the empty-state string — found only in `app/dashboard/page.tsx` (line 233).
2. Traced the gate condition: `const hasData = currentTransactions.length > 0 || previousTransactions.length > 0` (line 227 before fix).
3. Both `currentTransactions` and `previousTransactions` are populated from `/api/transactions` calls scoped to **the current calendar month** (July 2026) and **the previous calendar month** (June 2026) only.
4. The transactions page defaults to a "last 3 months" preset and also offers "All time" — it has no hard-coded 2-month ceiling, so it shows the user's data.
5. Confirmed the API route (`app/api/transactions/route.ts`) applies `startDate`/`endDate` as optional Prisma `gte`/`lte` filters — no date filter means all rows are returned.
6. No user-ID mismatch, no auth issue, no cache issue — purely a date-window mismatch between what the dashboard queries and where the user's data lives.

**Root cause:** `app/dashboard/page.tsx` line 227 — `hasData` was computed from only two hard-coded monthly fetches (current month + previous month). When the user's imported transactions all predate those two months, both fetches return 0 rows, `hasData` is `false`, and the import empty-state is shown incorrectly.

**Fix:** Added a third parallel fetch, `/api/transactions?limit=1` (no date filter), to get the date-agnostic total. Changed `hasData` to `(anyTransactionsTotal ?? 0) > 0` so the empty-state gate reflects whether *any* transactions exist, not whether any fall in the last two months.

Key diff (`app/dashboard/page.tsx`):
```diff
+  const [anyTransactionsTotal, setAnyTransactionsTotal] = useState<number | null>(null)

-  const [currentRes, previousRes] = await Promise.all([...])
+  const [currentRes, previousRes, anyRes] = await Promise.all([
+    ...,
+    fetch(`/api/transactions?limit=1`),
+  ])
+  setAnyTransactionsTotal(anyData.total ?? 0)

-  const hasData = currentTransactions.length > 0 || previousTransactions.length > 0
+  const hasData = (anyTransactionsTotal ?? 0) > 0
```

**Verify:**
```bash
# No TS errors in the changed file:
npx tsc --noEmit 2>&1 | grep dashboard
# Should print: "No errors in dashboard/page.tsx"

# Manually: log in as mohdrumman1@gmail.com, visit /dashboard
# Should now show charts (even if empty for July/June) instead of the import prompt.
```

**If it recurs:** Check whether `anyTransactionsTotal` is staying `null` (fetch failed silently). Add a console.error in the catch block of `fetchAll` to surface any `/api/transactions?limit=1` failure. Also confirm the transactions API route returns a `total` field (it does — line 43 of `app/api/transactions/route.ts`).

---
