import { NextResponse } from "next/server";
import { CountryCode } from "plaid";
import { getPlaidClient } from "@/lib/plaid";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let publicToken = "";
  try {
    const body = await req.json();
    publicToken = body?.public_token ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!publicToken) {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }

  try {
    const plaid = getPlaidClient();
    const db = getSupabaseAdmin();

    const exchange = await plaid.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    // Resolve the institution name (best effort).
    let institutionName: string | null = null;
    try {
      const itemResp = await plaid.itemGet({ access_token: accessToken });
      const instId = itemResp.data.item.institution_id;
      if (instId) {
        const inst = await plaid.institutionsGetById({
          institution_id: instId,
          country_codes: [CountryCode.Us],
        });
        institutionName = inst.data.institution.name;
      }
    } catch {
      // institution lookup is non-critical
    }

    const { data: itemRow, error: itemErr } = await db
      .from("plaid_items")
      .upsert(
        { item_id: itemId, access_token: accessToken, institution_name: institutionName },
        { onConflict: "item_id" }
      )
      .select()
      .single();
    if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });

    // Persist the accounts for this item.
    const acctResp = await plaid.accountsGet({ access_token: accessToken });
    const accountRows = acctResp.data.accounts.map((a) => ({
      item_id: itemRow.id,
      plaid_account_id: a.account_id,
      name: a.name,
      official_name: a.official_name ?? null,
      type: String(a.type),
      subtype: a.subtype ? String(a.subtype) : null,
      current_balance: a.balances.current,
      available_balance: a.balances.available,
      iso_currency: a.balances.iso_currency_code ?? null,
    }));
    if (accountRows.length) {
      const { error: acctErr } = await db
        .from("accounts")
        .upsert(accountRows, { onConflict: "plaid_account_id" });
      if (acctErr) return NextResponse.json({ error: acctErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      institution: institutionName,
      accounts: accountRows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to exchange token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
