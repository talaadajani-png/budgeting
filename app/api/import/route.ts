import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { importTransactions, type IncomingTx } from "@/lib/transactions-import";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const accountId = String(body?.account_id ?? "");
    const incoming: IncomingTx[] = Array.isArray(body?.transactions) ? body.transactions : [];

    if (!accountId) return NextResponse.json({ error: "Choose an account to import into" }, { status: 400 });
    if (incoming.length === 0) return NextResponse.json({ error: "No transactions to import" }, { status: 400 });

    const db = getSupabaseAdmin();
    const result = await importTransactions(db, accountId, incoming);
    if (result.total === 0) return NextResponse.json({ error: "No valid rows found" }, { status: 400 });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to import statement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
