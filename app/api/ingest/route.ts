import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { importTransactions, type IncomingTx } from "@/lib/transactions-import";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Token-protected ingest for pushing transactions from outside the browser
// (e.g. an assistant parsing a pasted/uploaded statement). Auth is a bearer
// token in the Authorization header, NOT the login cookie — so this route is
// exempt from the proxy gate (see proxy.ts) and must guard itself.

function authorized(req: Request): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("authorization") || "";
  const provided = header.replace(/^Bearer\s+/i, "").trim();
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function guessType(name: string): string {
  const n = name.toLowerCase();
  if (/(amex|american express|visa|mastercard|credit|card)/.test(n)) return "credit";
  if (/(mortgage|loan|line of credit|loc)/.test(n)) return "loan";
  if (/(wealthsimple|invest|tfsa|rrsp|brokerage)/.test(n) && !/cash/.test(n)) return "investment";
  if (/saving/.test(n)) return "savings";
  if (/cash/.test(n)) return "cash";
  return "checking";
}

async function resolveAccount(db: SupabaseClient, account: string, create: boolean): Promise<string | null> {
  const trimmed = account.trim();
  if (!trimmed) return null;

  // Treat a UUID-looking value as an id.
  if (/^[0-9a-f-]{36}$/i.test(trimmed)) return trimmed;

  const { data } = await db.from("accounts").select("id, name");
  const match = (data ?? []).find((a) => (a.name ?? "").toLowerCase() === trimmed.toLowerCase());
  if (match) return match.id;

  if (!create) return null;
  const { data: created, error } = await db
    .from("accounts")
    .insert({ name: trimmed, type: guessType(trimmed) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

type RawTx = {
  date?: unknown;
  description?: unknown;
  name?: unknown;
  amount?: unknown;
  direction?: unknown; // "out" | "in" — when present, amount is treated as a magnitude
  category?: unknown;
  pending?: unknown;
};

// Convert a friendly tx into the internal convention (positive = money out).
function toInternal(t: RawTx): IncomingTx {
  const mag = Number(t.amount);
  let amount = mag;
  const dir = typeof t.direction === "string" ? t.direction.toLowerCase() : "";
  if (dir === "in" || dir === "credit") amount = -Math.abs(mag);
  else if (dir === "out" || dir === "debit") amount = Math.abs(mag);
  return {
    date: t.date,
    amount,
    name: t.name ?? t.description,
    category: t.category,
    pending: t.pending,
  };
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const account = String(body?.account ?? "");
    const create = body?.create_account !== false; // default: auto-create missing accounts
    const raw: RawTx[] = Array.isArray(body?.transactions) ? body.transactions : [];

    if (!account) return NextResponse.json({ error: "Missing 'account'" }, { status: 400 });
    if (raw.length === 0) return NextResponse.json({ error: "No transactions provided" }, { status: 400 });

    const db = getSupabaseAdmin();
    const accountId = await resolveAccount(db, account, create);
    if (!accountId) {
      return NextResponse.json(
        { error: `Account "${account}" not found (set create_account:true to auto-create)` },
        { status: 404 }
      );
    }

    const result = await importTransactions(db, accountId, raw.map(toInternal));
    return NextResponse.json({ ok: true, account_id: accountId, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
