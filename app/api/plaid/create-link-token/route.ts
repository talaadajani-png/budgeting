import { NextResponse } from "next/server";
import { Products } from "plaid";
import { getPlaidClient, getPlaidCountryCodes, getPlaidRedirectUri } from "@/lib/plaid";

export const runtime = "nodejs";

export async function POST() {
  try {
    const plaid = getPlaidClient();
    const redirectUri = getPlaidRedirectUri();
    const resp = await plaid.linkTokenCreate({
      user: { client_user_id: "owner" },
      client_name: "Budget Tracker",
      products: [Products.Transactions],
      country_codes: getPlaidCountryCodes(),
      language: "en",
      // Required for OAuth institutions (most Canadian + large US banks).
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });
    return NextResponse.json({ link_token: resp.data.link_token });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create link token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
