-- Budget & Finance Tracker schema (single-user, manual entry).
-- Apply via the Supabase SQL editor. Safe to re-run: it drops and recreates the
-- accounts/transactions tables (budgets are preserved).
--
-- This app is fully manual: you add accounts, upload bank statement CSVs, and
-- add/edit transactions yourself. There is no bank-linking integration.

create extension if not exists "pgcrypto";

-- Order matters: drop dependents first. `cascade` clears the old Plaid FK too.
drop table if exists transactions cascade;
drop table if exists accounts cascade;
drop table if exists plaid_items cascade;

-- Bank / card / cash accounts you track.
create table accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  -- checking | savings | credit | loan | cash | investment
  type            text not null default 'checking',
  current_balance numeric not null default 0,
  iso_currency    text not null default 'CAD',
  created_at      timestamptz not null default now()
);

-- Individual transactions.
-- Sign convention: positive amount = money OUT (spending), negative = money IN.
create table transactions (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid references accounts(id) on delete cascade,
  amount        numeric not null,
  date          date not null,
  name          text,
  merchant_name text,
  category      text,
  notes         text,
  pending       boolean not null default false,
  -- Stable key derived from account+date+amount+name+occurrence, so re-uploading
  -- an overlapping statement skips rows that were already imported.
  dedupe_key    text unique,
  created_at    timestamptz not null default now()
);

-- Monthly budget limits per category.
create table if not exists budgets (
  id            uuid primary key default gen_random_uuid(),
  category      text unique not null,
  monthly_limit numeric not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_transactions_date on transactions(date desc);
create index if not exists idx_transactions_category on transactions(category);
create index if not exists idx_transactions_account on transactions(account_id);
