export type Account = {
  id: string;
  plaid_account_id: string;
  name: string | null;
  official_name: string | null;
  type: string | null;
  subtype: string | null;
  current_balance: number | null;
  available_balance: number | null;
  iso_currency: string | null;
  plaid_items?: { institution_name: string | null } | null;
};

export type Transaction = {
  id: string;
  account_id: string | null;
  plaid_account_id: string;
  plaid_transaction_id: string;
  amount: number; // Plaid: positive = money out, negative = money in
  date: string;
  name: string | null;
  merchant_name: string | null;
  category: string | null;
  pending: boolean | null;
  accounts?: { name: string | null } | null;
};

export type Budget = {
  id: string;
  category: string;
  monthly_limit: number;
};
