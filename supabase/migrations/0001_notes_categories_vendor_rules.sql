-- Migration: transaction notes, a managed category list, and vendor memory.
-- Safe to run on an existing database — every statement is idempotent and
-- additive (no data is dropped). Run once in the Supabase SQL editor.

-- 1. Free-text notes on a transaction.
alter table transactions add column if not exists notes text;

-- 2. Categories you can pick from when reviewing/labelling transactions.
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  created_at timestamptz not null default now()
);

-- 3. Remembered vendor -> category mappings, learned during import review.
create table if not exists vendor_rules (
  id         uuid primary key default gen_random_uuid(),
  vendor_key text unique not null,
  category   text not null,
  created_at timestamptz not null default now()
);

-- Seed sensible starter categories (no-op if they already exist).
insert into categories (name) values
  ('Groceries'), ('Dining'), ('Transport'), ('Shopping'), ('Subscriptions'),
  ('Bills & Utilities'), ('Health'), ('Entertainment'), ('Travel'),
  ('Income'), ('Transfers'), ('Fees'), ('Other')
on conflict (name) do nothing;
