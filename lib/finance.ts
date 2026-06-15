import type { Account } from "./types";

// Plaid account types that represent money you OWE (liabilities).
const LIABILITY_TYPES = new Set(["credit", "loan"]);

export function isLiability(account: Account): boolean {
  return LIABILITY_TYPES.has((account.type ?? "").toLowerCase());
}

export type Balances = {
  have: number; // total across asset accounts (checking, savings, investment, …)
  owe: number; // total owed across credit cards + loans
  net: number; // have - owe
};

// For asset accounts Plaid reports a positive balance you hold.
// For credit/loan accounts the `current` balance is the amount outstanding (owed).
export function computeBalances(accounts: Account[]): Balances {
  let have = 0;
  let owe = 0;
  for (const a of accounts) {
    const bal = a.current_balance ?? 0;
    if (isLiability(a)) owe += bal;
    else have += bal;
  }
  return { have, owe, net: have - owe };
}
