import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("vendor_rules").select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rules: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load vendor rules";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type IncomingRule = { vendor_key?: unknown; category?: unknown };

// Accepts a single { vendor_key, category } or { rules: [...] } for bulk upsert.
// Re-learning a vendor overwrites its category (latest decision wins).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const incoming: IncomingRule[] = Array.isArray(body?.rules) ? body.rules : [body];

    const rows = [];
    for (const r of incoming) {
      const vendor_key = String(r?.vendor_key ?? "").trim().toLowerCase();
      const category = String(r?.category ?? "").trim();
      if (vendor_key && category) rows.push({ vendor_key, category });
    }
    if (rows.length === 0) return NextResponse.json({ ok: true, saved: 0 });

    const db = getSupabaseAdmin();
    const { error } = await db
      .from("vendor_rules")
      .upsert(rows, { onConflict: "vendor_key", ignoreDuplicates: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, saved: rows.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save vendor rules";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
