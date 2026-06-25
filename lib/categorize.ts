// Lightweight, dependency-free rule-based transaction categorizer.
//
// Matches keywords in a transaction's description / merchant against common
// (especially Canadian) merchants and returns a category, or null if nothing
// matches. Rules are checked top-to-bottom, so order = priority — put the more
// specific / higher-priority categories first. Extend CATEGORY_RULES freely.

type Rule = { category: string; patterns: string[] };

export const CATEGORY_RULES: Rule[] = [
  {
    category: "Groceries",
    patterns: [
      "loblaw", "no frills", "nofrills", "metro", "sobeys", "freshco", "zehrs",
      "fortinos", "longo", "farm boy", "whole foods", "costco", "walmart",
      "superstore", "real canadian", "your independent", "save on foods",
      "safeway", "food basic", "t&t", "galleria", "grocer", "iga",
    ],
  },
  {
    category: "Dining",
    patterns: [
      "restaurant", "cafe", "coffee", "starbucks", "tim horton", "mcdonald",
      "a&w", "burger", "pizza", "sushi", "ramen", "chipotle", "subway",
      "wendy", "kfc", "popeye", "doordash", "uber eats", "ubereats",
      "skip the dishes", "skipthedishes", "grubhub", "grill", "bistro",
      "diner", "bakery", "dunkin", "shawarma", "thai", "cuisine",
    ],
  },
  {
    category: "Transport",
    patterns: [
      "uber", "lyft", "ttc", "presto", "go transit", "via rail", "gas",
      "petro-canada", "petro canada", "petrocan", "shell", "esso", "chevron",
      "husky", "ultramar", "parking", "green p", "impark", "communauto",
      "transit", "bixi", "fuel",
    ],
  },
  {
    category: "Shopping",
    patterns: [
      "amazon", "amzn", "ebay", "best buy", "bestbuy", "ikea", "indigo",
      "chapters", "canadian tire", "home depot", "lowes", "winners",
      "marshalls", "the bay", "hudson", "sephora", "apple store", "aliexpress",
      "etsy", "dollarama", "staples", "wayfair",
    ],
  },
  {
    category: "Subscriptions",
    patterns: [
      "netflix", "spotify", "disney", "crave", "prime video", "apple.com",
      "itunes", "youtube", "audible", "patreon", "dropbox", "icloud",
      "microsoft", "adobe", "openai", "anthropic", "claude", "notion",
    ],
  },
  {
    category: "Bills & Utilities",
    patterns: [
      "hydro", "enbridge", "rogers", "bell canada", "bell mobility", "telus",
      "fido", "koodo", "virgin plus", "freedom mobile", "insurance", "alectra",
      "epcor", "fortis", "utilities",
    ],
  },
  {
    category: "Health",
    patterns: [
      "pharmacy", "shoppers drug", "rexall", "dental", "dentist", "clinic",
      "physio", "optical", "hospital", "medical", "gym", "fitness", "goodlife",
    ],
  },
  {
    category: "Entertainment",
    patterns: [
      "cinema", "cineplex", "theatre", "theater", "ticketmaster", "steam",
      "playstation", "xbox", "nintendo", "concert", "stubhub",
    ],
  },
  {
    category: "Travel",
    patterns: [
      "air canada", "aircanada", "westjet", "porter air", "flight", "airline",
      "hotel", "airbnb", "expedia", "booking.com", "marriott", "hilton",
    ],
  },
  {
    category: "Income",
    patterns: [
      "payroll", "direct deposit", "salary", "dividend", "interest paid",
      "refund", "reimburse", "tax refund", "e-transfer received",
    ],
  },
  {
    category: "Transfers",
    patterns: [
      "e-transfer", "etransfer", "interac", "transfer", "bill payment",
      "payment - thank you", "payment thank you", "pre-auth", "preauthorized",
    ],
  },
  {
    category: "Fees",
    patterns: ["service charge", "nsf", "overdraft", "interest charge", "atm fee", "annual fee"],
  },
];

/** Infer a category from a transaction description/merchant, or null if unknown. */
export function categorizeTransaction(text: string | null | undefined): string | null {
  if (!text) return null;
  const s = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const p of rule.patterns) {
      if (s.includes(p)) return rule.category;
    }
  }
  return null;
}
