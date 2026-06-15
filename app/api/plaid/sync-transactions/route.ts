import { NextResponse } from "next/server";
import { getPlaidClient } from "@/lib/plaid";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST() {
  try {
    const plaid = getPlaidClient();
    const db = getSupabaseAdmin();

    const { data: items, error } = await db.from("plaid_items").select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    let added = 0;
    let modified = 0;
    let removed = 0;

    for (const item of items ?? []) {
      // Refresh account balances.
      try {
        const acctResp = await plaid.accountsGet({ access_token: item.access_token });
        for (const a of acctResp.data.accounts) {
          await db
            .from("accounts")
            .update({
              current_balance: a.balances.current,
              available_balance: a.balances.available,
            })
            .eq("plaid_account_id", a.account_id);
        }
      } catch {
        // balance refresh is non-critical
      }

      // Map plaid_account_id -> accounts.id for this item.
      const { data: accts } = await db
        .from("accounts")
        .select("id, plaid_account_id")
        .eq("item_id", item.id);
      const acctMap = new Map((accts ?? []).map((a) => [a.plaid_account_id, a.id]));

      let cursor: string | undefined = item.transactions_cursor || undefined;
      let hasMore = true;

      while (hasMore) {
        const resp = await plaid.transactionsSync({
          access_token: item.access_token,
          cursor,
        });
        const data = resp.data;

        const upserts = [...data.added, ...data.modified].map((t) => ({
          account_id: acctMap.get(t.account_id) ?? null,
          plaid_account_id: t.account_id,
          plaid_transaction_id: t.transaction_id,
          amount: t.amount,
          date: t.date,
          name: t.name,
          merchant_name: t.merchant_name ?? null,
          category: t.personal_finance_category?.primary ?? t.category?.[0] ?? null,
          pending: t.pending,
        }));
        if (upserts.length) {
          await db.from("transactions").upsert(upserts, {
            onConflict: "plaid_transaction_id",
          });
        }
        added += data.added.length;
        modified += data.modified.length;

        if (data.removed.length) {
          const ids = data.removed.map((r) => r.transaction_id);
          await db.from("transactions").delete().in("plaid_transaction_id", ids);
          removed += data.removed.length;
        }

        cursor = data.next_cursor;
        hasMore = data.has_more;
      }

      await db
        .from("plaid_items")
        .update({ transactions_cursor: cursor })
        .eq("id", item.id);
    }

    return NextResponse.json({ ok: true, added, modified, removed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to sync transactions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
