import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("categories").select("*").order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ categories: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load categories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const db = getSupabaseAdmin();
    // Idempotent: re-adding an existing category just returns it.
    const { data, error } = await db
      .from("categories")
      .upsert({ name }, { onConflict: "name", ignoreDuplicates: false })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ category: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add category";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Rename or merge: moves every transaction, vendor rule and budget from
// `from` onto `to`, then removes `from`. If `to` already exists this is a
// merge; otherwise it's a rename.
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const from = String(body?.from ?? "").trim();
    const to = String(body?.to ?? "").trim();
    if (!from || !to) return NextResponse.json({ error: "from and to are required" }, { status: 400 });
    if (from === to) return NextResponse.json({ ok: true });

    const db = getSupabaseAdmin();

    const tx = await db.from("transactions").update({ category: to }).eq("category", from);
    if (tx.error) return NextResponse.json({ error: tx.error.message }, { status: 500 });

    const vr = await db.from("vendor_rules").update({ category: to }).eq("category", from);
    if (vr.error) return NextResponse.json({ error: vr.error.message }, { status: 500 });

    // budgets.category is unique — if the target already has a budget, drop the
    // source's row rather than collide; otherwise move it over.
    const { data: toBudget } = await db.from("budgets").select("id").eq("category", to).maybeSingle();
    if (toBudget) {
      await db.from("budgets").delete().eq("category", from);
    } else {
      await db.from("budgets").update({ category: to }).eq("category", from);
    }

    await db.from("categories").upsert({ name: to }, { onConflict: "name", ignoreDuplicates: true });
    await db.from("categories").delete().eq("name", from);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update category";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Delete a category and re-categorize: matching transactions become
// uncategorized, and the category's vendor rules + budget are removed.
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
    const db = getSupabaseAdmin();

    const tx = await db.from("transactions").update({ category: null }).eq("category", name);
    if (tx.error) return NextResponse.json({ error: tx.error.message }, { status: 500 });
    await db.from("vendor_rules").delete().eq("category", name);
    await db.from("budgets").delete().eq("category", name);

    const { error } = await db.from("categories").delete().eq("name", name);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete category";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
