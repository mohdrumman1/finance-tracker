# Monyze

Personal finance tracker with AI-powered categorisation, budgets, goals, and transaction review.

**Live:** [monyze.vercel.app](https://monyze.vercel.app)

---

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- Prisma + Turso (LibSQL) in production, SQLite locally
- Google OAuth + JWT auth
- Vercel deployment

## Local dev

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in your keys.

---

## Future Improvements

### High priority
- **PDF statement import** — parse bank PDF statements directly (no CSV needed). ING, and many other banks only offer PDFs. Use a server-side PDF parser (e.g. `pdf-parse`) to extract transaction rows and run them through the existing import pipeline.
- **Westpac, ANZ, NAB bank profiles** — add dedicated CSV parsers for these banks so users don't need to use Generic CSV.
- **Email-based password reset** — send a reset link via a transactional email provider (Resend or Postmark).

### Import & data
- **Automatic bank sync** — connect directly to bank accounts via open banking (Basiq or Frollo API) to pull transactions automatically without CSV uploads.
- **Multi-account support** — track multiple bank accounts separately with per-account balance and transaction views.
- **Recurring transaction detection** — automatically flag subscriptions and regular bills.

### Budgets & goals
- **Budget rollover** — carry unspent budget from one month to the next.
- **Savings rate tracking** — show income vs. expenses as a savings rate % over time.
- **Goal auto-contributions** — link a goal to a category and auto-calculate projected completion date.

### Reports
- **Monthly summary email** — send a brief spending recap at the end of each month.
- **Year-in-review** — annual breakdown of spending by category with trends.
- **Export to CSV/PDF** — let users download their full transaction history.

### UX
- **Mobile app (PWA)** — make the app installable on iOS/Android as a progressive web app.
- **Dark mode** — toggle between light and dark themes.
- **Bulk transaction editing** — select and re-categorise multiple transactions at once.
- **Search and filter** — full-text search across all transactions with date/category/amount filters.
