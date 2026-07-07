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
