import type { SupabaseClient } from "@supabase/supabase-js";

// Internal sign convention: positive amount = money OUT (spending), negative = money IN.
export type IncomingTx = {
  date?: unknown;
  amount?: unknown; // already in internal convention (positive = out)
  name?: unknown;
  merchant_name?: unknown;
  category?: unknown;
  pending?: unknown;
};

export type ImportResult = { imported: number; skipped: number; total: number };

// Re-uploading an overlapping statement should not create duplicates. We derive a
// stable key from the meaningful fields plus an occurrence index, so genuine
// same-day/same-amount repeats are kept, but the same rows sent twice are not.
function makeDedupeKey(accountId: string, date: string, amount: number, name: string, occurrence: number) {
  return `${accountId}|${date}|${amount.toFixed(2)}|${name.slice(0, 80)}|${occurrence}`;
}

export async function importTransactions(
  db: SupabaseClient,
  accountId: string,
  incoming: IncomingTx[]
): Promise<ImportResult> {
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

  if (rows.length === 0) return { imported: 0, skipped: 0, total: 0 };

  // ignoreDuplicates: rows whose dedupe_key already exists are skipped silently.
  const { data, error } = await db
    .from("transactions")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);

  const imported = data?.length ?? 0;
  return { imported, skipped: rows.length - imported, total: rows.length };
}
