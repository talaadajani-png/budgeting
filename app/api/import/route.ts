import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type IncomingTx = {
  date?: unknown;
  amount?: unknown;
  name?: unknown;
  merchant_name?: unknown;
  category?: unknown;
  pending?: unknown;
};

// Re-uploading an overlapping statement should not create duplicates. We derive a
// stable key from the meaningful fields plus an occurrence index, so genuine
// same-day/same-amount repeats are kept, but the same file imported twice is not.
function makeDedupeKey(accountId: string, date: string, amount: number, name: string, occurrence: number) {
  return `${accountId}|${date}|${amount.toFixed(2)}|${name.slice(0, 80)}|${occurrence}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const accountId = String(body?.account_id ?? "");
    const incoming: IncomingTx[] = Array.isArray(body?.transactions) ? body.transactions : [];

    if (!accountId) return NextResponse.json({ error: "Choose an account to import into" }, { status: 400 });
    if (incoming.length === 0) return NextResponse.json({ error: "No transactions to import" }, { status: 400 });

    const seen = new Map<string, number>();
    const rows = [];
    for (const t of incoming) {
      const amount = Number(t.amount);
      const date = String(t.date ?? "").trim();
      if (!date || !Number.isFinite(amount)) continue;
      const name = t.name != null ? String(t.name).trim() : "";

      const base = `${date}|${amount.toFixed(2)}|${name.slice(0, 80)}`;
      const occurrence = seen.get(base) ?? 0;
      seen.set(base, occurrence + 1);

      rows.push({
        account_id: accountId,
        amount,
        date,
        name: name || null,
        merchant_name: t.merchant_name != null ? String(t.merchant_name).trim() || null : null,
        category: t.category != null ? String(t.category).trim() || null : null,
        pending: Boolean(t.pending),
        dedupe_key: makeDedupeKey(accountId, date, amount, name, occurrence),
      });
    }

    if (rows.length === 0) return NextResponse.json({ error: "No valid rows found" }, { status: 400 });

    const db = getSupabaseAdmin();
    // ignoreDuplicates: rows whose dedupe_key already exists are skipped silently.
    const { data, error } = await db
      .from("transactions")
      .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const imported = data?.length ?? 0;
    return NextResponse.json({
      ok: true,
      imported,
      skipped: rows.length - imported,
      total: rows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to import statement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
