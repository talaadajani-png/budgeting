import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { categorizeTransaction } from "@/lib/categorize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("transactions")
      .select("*, accounts(name)")
      .order("date", { ascending: false })
      .limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ transactions: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load transactions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildRow(body: Record<string, unknown>) {
  const amount = Number(body.amount);
  const date = String(body.date ?? "").trim();
  if (!date || !Number.isFinite(amount)) return null;
  const name = body.name != null ? String(body.name).trim() : null;
  const merchant = body.merchant_name != null ? String(body.merchant_name).trim() : null;
  const providedCategory = body.category != null ? String(body.category).trim() : "";
  const category = providedCategory || categorizeTransaction(name || merchant);
  return {
    account_id: body.account_id ? String(body.account_id) : null,
    amount,
    date,
    name: name || null,
    merchant_name: merchant || null,
    category: category || null,
    notes: body.notes != null ? String(body.notes).trim() || null : null,
    pending: Boolean(body.pending),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const row = buildRow(body);
    if (!row) return NextResponse.json({ error: "Date and amount are required" }, { status: 400 });

    const db = getSupabaseAdmin();
    const { data, error } = await db.from("transactions").insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ transaction: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? "");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (body.account_id !== undefined) updates.account_id = body.account_id ? String(body.account_id) : null;
    if (body.amount !== undefined) updates.amount = Number(body.amount);
    if (typeof body.date === "string") updates.date = body.date;
    if (body.name !== undefined) updates.name = body.name != null ? String(body.name).trim() || null : null;
    if (body.merchant_name !== undefined)
      updates.merchant_name = body.merchant_name != null ? String(body.merchant_name).trim() || null : null;
    if (body.category !== undefined) updates.category = body.category != null ? String(body.category).trim() || null : null;
    if (body.notes !== undefined) updates.notes = body.notes != null ? String(body.notes).trim() || null : null;
    if (body.pending !== undefined) updates.pending = Boolean(body.pending);

    const db = getSupabaseAdmin();
    const { error } = await db.from("transactions").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const db = getSupabaseAdmin();
    const { error } = await db.from("transactions").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
