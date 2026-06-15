# Budget & Finance Tracker

A personal, single-user budgeting web app. Password-gated, links bank accounts via **Plaid**, stores data in **Supabase Postgres**, built with **Next.js 16 + TypeScript + Tailwind**.

## Features

- 🔒 Single-password login (bcrypt + signed session cookie, enforced by `proxy.ts`)
- 🏦 Link bank accounts through Plaid Link
- 🔄 Sync balances + transactions (Plaid `transactionsSync`)
- 📊 Dashboard: total balance donut, income/spending/net cards, recent transactions, filterable table
- 🎯 Budgets: set monthly limits per category and track spending against them

## Architecture

```
Browser ──password──▶ Next.js (App Router)
  Plaid Link             ├─ /api/auth/*    login / logout (sets signed cookie)
                         ├─ proxy.ts       gates all routes behind the cookie
                         ├─ /api/plaid/*   server-only Plaid SDK calls
                         └─ /api/{accounts,transactions,budgets}
                                  │ Supabase JS (service role, server only)
                                  ▼
                            Supabase Postgres
```

Secrets (Plaid keys, Supabase service-role key) live only in server env vars — never shipped to the browser.

## Setup

### 1. Plaid keys
Sign up at https://dashboard.plaid.com and copy your **Sandbox** `client_id` and `secret`.

### 2. Supabase
Create a project, then run `supabase/schema.sql` in the SQL editor. Copy the project URL and the **service-role** key from Project Settings → API.

### 3. Environment
```bash
cp .env.example .env.local
# Fill in PLAID_*, SUPABASE_*
node scripts/hash-password.mjs "your-password"      # -> APP_PASSWORD_HASH (already $-escaped for .env)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # -> SESSION_SECRET
```

### 4. Run
```bash
npm run dev
# open http://localhost:3000  → redirected to /login
```

## Using it (Sandbox)
1. Log in with your password.
2. Click **Link account** → pick any bank → credentials `user_good` / `pass_good`.
3. Hit **Sync now** to pull transactions.
4. Set limits on the **Budgets** page.

## Deploy (Vercel)
Push to GitHub, import into Vercel, and set the same env vars in the project settings. For real bank data, switch `PLAID_ENV` to `production` (requires Plaid approval).
