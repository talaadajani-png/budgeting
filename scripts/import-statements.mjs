#!/usr/bin/env node
// Local bulk importer: reads bank-statement CSVs from a folder and inserts them
// into your Supabase `transactions` table, with the same de-duplication the app
// uses (so re-running, or overlapping with in-app imports, never double-counts).
//
// Usage (run on YOUR computer, from the repo root):
//   node scripts/import-statements.mjs                       # reads ./banking statements (or ./statements)
//   node scripts/import-statements.mjs "/path/to/folder"     # custom folder
//   node scripts/import-statements.mjs --dry-run             # parse + preview, insert nothing
//   node scripts/import-statements.mjs --account "Amex"      # force one account for all files
//   node scripts/import-statements.mjs --spent positive      # override spend sign (negative|positive)
//   node scripts/import-statements.mjs --date dmy            # override date format (auto|ymd|mdy|dmy)
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (or the env).
// Account is inferred per file from the filename (amex / scotia / wealthsimple),
// or pass --account to override.

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, extname, basename } from "path";
import { createClient } from "@supabase/supabase-js";

// ---------- tiny .env.local loader ----------
function loadEnv() {
  const out = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2].trim().replace(/^["']|["']$/g, "");
      v = v.replace(/\\\$/g, "$"); // undo .env $-escaping
      if (out[m[1]] == null) out[m[1]] = v;
    }
  }
  return out;
}

// ---------- CSV + value parsing (mirrors lib/csv.ts) ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function parseAmount(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/-/.test(s)) neg = true;
  s = s.replace(/[^0-9.]/g, "");
  if (s === "" || s === ".") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

const pad = (n) => String(n).padStart(2, "0");
function normalizeDate(raw, fmt = "auto") {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const a = m[1], b = m[2];
    let y = m[3];
    if (y.length === 2) y = `20${y}`;
    if (fmt === "dmy") return `${y}-${pad(b)}-${pad(a)}`;
    if (fmt === "mdy") return `${y}-${pad(a)}-${pad(b)}`;
    if (Number(a) > 12) return `${y}-${pad(b)}-${pad(a)}`;
    return `${y}-${pad(a)}-${pad(b)}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return null;
}

function guessColumn(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const cand of candidates) { const i = lower.findIndex((h) => h === cand); if (i !== -1) return i; }
  for (const cand of candidates) { const i = lower.findIndex((h) => h.includes(cand)); if (i !== -1) return i; }
  return -1;
}

// ---------- per-institution hints ----------
function inferBank(filename) {
  const n = filename.toLowerCase();
  if (/amex|american.?express/.test(n)) return { account: "Amex", spent: "positive" };
  if (/scotia/.test(n)) return { account: "Scotiabank", spent: "negative" };
  if (/wealthsimple|wsimple/.test(n)) return { account: "Wealthsimple", spent: "negative" };
  return { account: basename(filename, extname(filename)), spent: "negative" };
}

function guessType(name) {
  const n = name.toLowerCase();
  if (/(amex|american express|visa|mastercard|credit|card)/.test(n)) return "credit";
  if (/(mortgage|loan|line of credit|loc)/.test(n)) return "loan";
  if (/(wealthsimple|invest|tfsa|rrsp|brokerage)/.test(n) && !/cash/.test(n)) return "investment";
  if (/saving/.test(n)) return "savings";
  if (/cash/.test(n)) return "cash";
  return "checking";
}

// ---------- build internal rows from a CSV ----------
// Internal convention: positive amount = money OUT (spending), negative = money IN.
function buildRows(rows, { spent, dateFmt }) {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const hasHeader = headers.some((h) => /[a-z]/i.test(h) && !normalizeDate(h, dateFmt) && parseAmount(h) === null);
  const data = hasHeader ? rows.slice(1) : rows;
  const head = hasHeader ? headers : headers.map((_, i) => `col${i}`);

  const dateCol = hasHeader ? guessColumn(head, ["date", "transaction date", "posting date", "posted"]) : 0;
  const descCol = hasHeader ? guessColumn(head, ["description", "details", "name", "merchant", "memo", "payee", "transaction"]) : 1;
  const amtCol = hasHeader ? guessColumn(head, ["amount", "value"]) : -1;
  const debCol = hasHeader ? guessColumn(head, ["debit", "withdrawal", "money out", "out"]) : -1;
  const credCol = hasHeader ? guessColumn(head, ["credit", "deposit", "money in", "in"]) : -1;
  const catCol = hasHeader ? guessColumn(head, ["category", "type"]) : -1;

  const split = debCol !== -1 && credCol !== -1;
  const out = [];
  for (const r of data) {
    const date = normalizeDate(r[dateCol >= 0 ? dateCol : 0], dateFmt);
    if (!date) continue;
    let amount = null;
    if (split) {
      const d = parseAmount(r[debCol]), c = parseAmount(r[credCol]);
      if (d == null && c == null) continue;
      amount = Math.abs(d ?? 0) - Math.abs(c ?? 0);
    } else {
      // last numeric column if no explicit amount header
      let raw = amtCol >= 0 ? parseAmount(r[amtCol]) : null;
      if (raw == null) for (let i = r.length - 1; i >= 0; i--) { const a = parseAmount(r[i]); if (a != null && /\d/.test(r[i])) { raw = a; break; } }
      if (raw == null) continue;
      amount = spent === "negative" ? -raw : raw;
    }
    if (amount == null || !Number.isFinite(amount) || amount === 0) continue;
    out.push({
      date,
      amount,
      name: (r[descCol >= 0 ? descCol : 1] ?? "").trim(),
      category: catCol >= 0 ? (r[catCol] ?? "").trim() || null : null,
    });
  }
  return out;
}

function dedupeKey(accountId, date, amount, name, occ) {
  return `${accountId}|${date}|${amount.toFixed(2)}|${name.slice(0, 80)}|${occ}`;
}

// ---------- main ----------
async function main() {
  const args = process.argv.slice(2);
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (key === "dry-run") flags.dryRun = true;
      else { flags[key] = args[i + 1]; i++; }
    } else positional.push(args[i]);
  }

  const env = loadEnv();
  const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if ((!url || !key) && !flags.dryRun) {
    console.error("✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in .env.local. (Use --dry-run to test parsing without them.)");
    process.exit(1);
  }

  const folder = positional[0] || ["banking statements", "statements"].find((f) => existsSync(f));
  if (!folder || !existsSync(folder)) {
    console.error(`✗ Folder not found: ${folder || "banking statements"}. Pass a path: node scripts/import-statements.mjs "/path/to/folder"`);
    process.exit(1);
  }

  const files = readdirSync(folder).filter((f) => extname(f).toLowerCase() === ".csv");
  if (files.length === 0) { console.error(`✗ No .csv files in ${folder}`); process.exit(1); }

  const db = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  console.log(`Found ${files.length} CSV file(s) in "${folder}"${flags.dryRun ? "  (dry run)" : ""}\n`);

  let accountCache = null;
  async function resolveAccount(name) {
    if (flags.dryRun || !db) return "dry-run";
    if (!accountCache) accountCache = (await db.from("accounts").select("id, name")).data ?? [];
    const hit = accountCache.find((a) => (a.name ?? "").toLowerCase() === name.toLowerCase());
    if (hit) return hit.id;
    const { data, error } = await db.from("accounts").insert({ name, type: guessType(name) }).select("id, name").single();
    if (error) throw new Error(error.message);
    accountCache.push(data);
    console.log(`  + created account "${name}"`);
    return data.id;
  }

  for (const file of files) {
    const hint = inferBank(file);
    const account = flags.account || hint.account;
    const spent = flags.spent || hint.spent;
    const dateFmt = flags.date || "auto";

    const rows = parseCsv(readFileSync(join(folder, file), "utf8"));
    const built = buildRows(rows, { spent, dateFmt });
    console.log(`📄 ${file} → account "${account}" (spent=${spent}): ${built.length} valid rows`);
    if (built.length === 0) { console.log("   (nothing parsed — check the file)\n"); continue; }

    // preview
    for (const b of built.slice(0, 3)) {
      const dir = b.amount < 0 ? "in " : "out";
      console.log(`   ${b.date}  ${dir}  ${Math.abs(b.amount).toFixed(2).padStart(9)}  ${b.name.slice(0, 40)}`);
    }
    if (built.length > 3) console.log(`   …and ${built.length - 3} more`);

    if (flags.dryRun) { console.log(""); continue; }

    const accountId = await resolveAccount(account);
    const seen = new Map();
    const payload = built.map((b) => {
      const base = `${b.date}|${b.amount.toFixed(2)}|${b.name.slice(0, 80)}`;
      const occ = seen.get(base) ?? 0; seen.set(base, occ + 1);
      return {
        account_id: accountId, amount: b.amount, date: b.date,
        name: b.name || null, merchant_name: null, category: b.category, pending: false,
        dedupe_key: dedupeKey(accountId, b.date, b.amount, b.name, occ),
      };
    });
    const { data, error } = await db.from("transactions").upsert(payload, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
    if (error) { console.error(`   ✗ ${error.message}\n`); continue; }
    const imported = data?.length ?? 0;
    console.log(`   ✓ imported ${imported}, skipped ${payload.length - imported} already-present\n`);
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
