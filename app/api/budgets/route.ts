import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("budgets")
      .select("*")
      .order("category", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ budgets: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load budgets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const category = String(body?.category ?? "").trim();
    const monthlyLimit = Number(body?.monthly_limit);
    if (!category || !Number.isFinite(monthlyLimit) || monthlyLimit < 0) {
      return NextResponse.json({ error: "Invalid category or limit" }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { error } = await db
      .from("budgets")
      .upsert({ category, monthly_limit: monthlyLimit }, { onConflict: "category" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save budget";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    if (!category) {
      return NextResponse.json({ error: "Missing category" }, { status: 400 });
    }
    const db = getSupabaseAdmin();
    const { error } = await db.from("budgets").delete().eq("category", category);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete budget";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
