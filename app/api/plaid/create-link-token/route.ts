import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { getPlaidClient } from "@/lib/plaid";

export const runtime = "nodejs";

export async function POST() {
  try {
    const plaid = getPlaidClient();
    const resp = await plaid.linkTokenCreate({
      user: { client_user_id: "owner" },
      client_name: "Budget Tracker",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ link_token: resp.data.link_token });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create link token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
