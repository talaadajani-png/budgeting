import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("accounts")
      .select("*, plaid_items(institution_name)")
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ accounts: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
