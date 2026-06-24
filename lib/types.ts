export type Account = {
  id: string;
  name: string;
  type: string; // checking | savings | credit | loan | cash | investment
  current_balance: number;
  iso_currency: string;
};

export type Transaction = {
  id: string;
  account_id: string | null;
  amount: number; // positive = money out (spending), negative = money in (income)
  date: string; // YYYY-MM-DD
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

export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "credit",
  "loan",
  "cash",
  "investment",
] as const;
