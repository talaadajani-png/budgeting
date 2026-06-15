-- Budget & Finance Tracker schema (single-user).
-- Apply via the Supabase SQL editor, the Supabase MCP apply_migration tool, or psql.

create extension if not exists "pgcrypto";

-- One row per linked Plaid Item (an institution login).
create table if not exists plaid_items (
  id                  uuid primary key default gen_random_uuid(),
  item_id             text unique not null,
  access_token        text not null,
  institution_name    text,
  transactions_cursor text,
  created_at          timestamptz not null default now()
);

-- Bank/card accounts belonging to a Plaid Item.
create table if not exists accounts (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null references plaid_items(id) on delete cascade,
  plaid_account_id  text unique not null,
  name              text,
  official_name     text,
  type              text,
  subtype           text,
  current_balance   numeric,
  available_balance numeric,
  iso_currency      text,
  created_at        timestamptz not null default now()
);

-- Individual transactions. Plaid convention: positive amount = money out, negative = money in.
create table if not exists transactions (
  id                     uuid primary key default gen_random_uuid(),
  account_id             uuid references accounts(id) on delete cascade,
  plaid_account_id       text not null,
  plaid_transaction_id   text unique not null,
  amount                 numeric not null,
  date                   date not null,
  name                   text,
  merchant_name          text,
  category               text,
  pending                boolean default false,
  created_at             timestamptz not null default now()
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
create index if not exists idx_accounts_item on accounts(item_id);
