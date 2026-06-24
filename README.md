# Budget & Finance Tracker

A personal, single-user budgeting web app. Password-gated, **manual entry + CSV statement import**, stores data in **Supabase Postgres**, built with **Next.js 16 + TypeScript + Tailwind**.

## Features

- 🔒 Single-password login (bcrypt + signed session cookie, enforced by `proxy.ts`)
- 🏦 Add accounts (chequing, savings, credit, loan, cash, investment) and track balances
- ⬆️ Import bank statements from **CSV** — flexible column mapping, with de-duplication so re-uploading overlapping daily/weekly statements never double-counts
- ✍️ Add, edit, and delete transactions by hand
- 📊 Dashboard: spending-by-category donut, net-worth box, daily/weekly spending, filterable transaction table
- 🎯 Budgets: set monthly limits per category and track spending against them

## Architecture

```
Browser ──password──▶ Next.js (App Router)
                         ├─ /api/auth/*        login / logout (sets signed cookie)
                         ├─ proxy.ts           gates all routes behind the cookie
                         ├─ /api/accounts      account CRUD
                         ├─ /api/transactions  transaction CRUD
                         ├─ /api/import        CSV statement import (de-duped)
                         └─ /api/budgets
                                  │ Supabase JS (service role, server only)
                                  ▼
                            Supabase Postgres
```

Secrets (Supabase service-role key, session secret) live only in server env vars — never shipped to the browser.

## Setup

### 1. Supabase
Create a project, then run `supabase/schema.sql` in the SQL editor. Copy the project URL and the **service-role** key from Project Settings → API.

### 2. Environment
```bash
cp .env.example .env.local
# Fill in SUPABASE_*
node scripts/hash-password.mjs "your-password"      # -> APP_PASSWORD_HASH
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # -> SESSION_SECRET
```

### 3. Run
```bash
npm run dev
# open http://localhost:3000  → redirected to /login
```

## Using it
1. Log in with your password.
2. Click **Add account** to create a chequing/savings/credit account.
3. **Import statement** → upload a CSV from your online banking. Map the Date /
   Description / Amount columns (the app auto-detects common layouts and shows a
   preview), pick the account, and import. Re-upload as often as you like — already
   imported rows are skipped.
4. Or click **+ Transaction** to add one by hand. Click any transaction to edit or
   delete it.
5. Set limits on the **Budgets** page.

### CSV tips
- Works with a single **Amount** column (tell it whether spending is shown as
  negative or positive) **or** separate **Debit / Credit** columns.
- Date formats `YYYY-MM-DD`, `MM/DD/YYYY`, and `DD/MM/YYYY` are supported (auto-detected, or pick one).

## Deploy (Netlify / Vercel)
Push to GitHub, import the repo, and set the same env vars (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSWORD_HASH`, `SESSION_SECRET`) in the project
settings. In a hosting dashboard, paste the **raw** bcrypt hash for
`APP_PASSWORD_HASH` (no backslash escaping).
