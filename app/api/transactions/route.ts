import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

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
