import { Configuration, CountryCode, PlaidApi, PlaidEnvironments } from "plaid";

/**
 * Country codes Plaid Link should offer. Set PLAID_COUNTRY_CODES to a
 * comma-separated list (e.g. "CA" for Canada, "US,CA" for both). Defaults to US.
 */
export function getPlaidCountryCodes(): CountryCode[] {
  const raw = process.env.PLAID_COUNTRY_CODES || "US";
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .map((c) => c as CountryCode);
}

/** Optional HTTPS redirect URI required for OAuth banks (most CA + large US banks). */
export function getPlaidRedirectUri(): string | undefined {
  return process.env.PLAID_REDIRECT_URI || undefined;
}

export function getPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;
  if (!clientId || !secret) {
    throw new Error("PLAID_CLIENT_ID / PLAID_SECRET are not set");
  }
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });
  return new PlaidApi(configuration);
}
