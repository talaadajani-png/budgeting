"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ImportModal from "./ImportModal";
import TransactionEditor from "./TransactionEditor";
import AccountEditor from "./AccountEditor";
import SpendingChart from "./SpendingChart";
import SpendingByCategory from "./SpendingByCategory";
import NetWorthBox from "./NetWorthBox";
import Amount from "./Amount";
import PrivacyToggle from "./PrivacyToggle";
import { ACCENTS, colorForIndex } from "@/lib/colors";
import { formatDate, prettyCategory } from "@/lib/format";
import { computeBalances, isLiability } from "@/lib/finance";
import type { Account, Transaction } from "@/lib/types";

// One-tap starter accounts. Types are defaults — edit a card to change them.
// credit = money owed (Amex cards), the rest are assets.
const SETUP_ACCOUNTS: { name: string; type: string }[] = [
  { name: "Amex", type: "credit" },
  { name: "Scotia", type: "checking" },
  { name: "Wealthsimple", type: "cash" },
  { name: "Amex (baba)", type: "credit" },
];

export default function Dashboard() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAccount, setActiveAccount] = useState<string>("all");

  const [importOpen, setImportOpen] = useState(false);
  const [txEditorOpen, setTxEditorOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [acctEditorOpen, setAcctEditorOpen] = useState(false);
  const [editingAcct, setEditingAcct] = useState<Account | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const [a, t] = await Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/transactions?limit=200").then((r) => r.json()),
    ]);
    setAccounts(a.accounts ?? []);
    setTransactions(t.transactions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function openNewTx() {
    setEditingTx(null);
    setTxEditorOpen(true);
  }
  function openEditTx(tx: Transaction) {
    setEditingTx(tx);
    setTxEditorOpen(true);
  }
  function openNewAccount() {
    setEditingAcct(null);
    setAcctEditorOpen(true);
  }
  function openEditAccount(a: Account) {
    setEditingAcct(a);
    setAcctEditorOpen(true);
  }

  // Create the starter accounts that don't already exist (matched by name,
  // case-insensitive), so this is safe to click more than once.
  const seedAccounts = useCallback(async () => {
    setSeeding(true);
    try {
      const existing = new Set(accounts.map((a) => (a.name ?? "").trim().toLowerCase()));
      const missing = SETUP_ACCOUNTS.filter((s) => !existing.has(s.name.toLowerCase()));
      for (const acct of missing) {
        await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: acct.name,
            type: acct.type,
            current_balance: 0,
            iso_currency: "CAD",
          }),
        });
      }
      await load();
    } finally {
      setSeeding(false);
    }
  }, [accounts, load]);

  const balances = useMemo(() => computeBalances(accounts), [accounts]);

  const filteredTx = useMemo(() => {
    if (activeAccount === "all") return transactions;
    return transactions.filter((t) => t.account_id === activeAccount);
  }, [transactions, activeAccount]);

  const latest = transactions.slice(0, 3);

  return (
    <main className="min-h-screen bg-[#F5F1E8] text-[#1A1A1A] px-4 sm:px-8 py-6">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          <div className="w-10 h-10 rounded-full bg-[#F4C6D7] flex items-center justify-center shrink-0">
            💰
          </div>
          <div className="flex-1 bg-[#FBF9F4] rounded-full px-5 py-2.5 text-sm text-[#1A1A1A]/40 hidden sm:block">
            Your finances
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PrivacyToggle />
          <Link
            href="/categories"
            className="rounded-full bg-[#FBF9F4] px-4 py-2.5 text-sm font-medium hover:bg-white transition"
          >
            Categories
          </Link>
          <Link
            href="/budgets"
            className="rounded-full bg-[#FBF9F4] px-4 py-2.5 text-sm font-medium hover:bg-white transition"
          >
            Budgets
          </Link>
          <button
            onClick={logout}
            className="w-10 h-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center"
            title="Log out"
          >
            ⏻
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Your finances</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setImportOpen(true)}
            className="rounded-full bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] px-5 py-2.5 text-sm font-medium hover:bg-[#1A1A1A]/5 transition"
          >
            ⬆ Import statement
          </button>
          <button
            onClick={openNewTx}
            className="rounded-full bg-[#1A1A1A] text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition"
          >
            + Transaction
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-[#1A1A1A]/50 py-20 text-center">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left column — spending pie (hero) + compact net-worth box */}
          <section className="flex flex-col gap-4">
            <SpendingByCategory transactions={transactions} />
            <NetWorthBox balances={balances} />
          </section>

          {/* Right column */}
          <section className="flex flex-col gap-6">
            {/* Daily / weekly spending */}
            <SpendingChart transactions={transactions} />

            {/* Accounts */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Accounts</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={seedAccounts}
                    disabled={seeding}
                    className="rounded-full bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] px-4 py-1.5 text-xs font-medium hover:bg-[#1A1A1A]/5 transition disabled:opacity-50"
                  >
                    {seeding ? "Setting up…" : "Set up my banks"}
                  </button>
                  <button
                    onClick={openNewAccount}
                    className="rounded-full bg-[#1A1A1A] text-white px-4 py-1.5 text-xs font-medium hover:opacity-90 transition"
                  >
                    + Add account
                  </button>
                </div>
              </div>
              {accounts.length === 0 ? (
                <div className="bg-[#FBF9F4] rounded-3xl p-6 text-sm text-[#1A1A1A]/50">
                  <p>No accounts yet.</p>
                  <button
                    onClick={seedAccounts}
                    disabled={seeding}
                    className="mt-3 rounded-full bg-[#1A1A1A] text-white px-5 py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                  >
                    {seeding ? "Setting up…" : "Set up my banks (Amex, Scotia, Wealthsimple, Amex baba)"}
                  </button>
                  <p className="mt-3 text-[#1A1A1A]/40">
                    Or click “Add account” to create one manually, then import a statement.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {accounts.map((a, i) => {
                    const owed = isLiability(a);
                    return (
                      <button
                        key={a.id}
                        onClick={() => openEditAccount(a)}
                        className="rounded-3xl p-4 text-left hover:opacity-90 transition"
                        style={{ backgroundColor: colorForIndex(i) }}
                      >
                        <div className="text-sm font-medium truncate">{a.name || "Account"}</div>
                        <div className="text-xs text-[#1A1A1A]/50 capitalize truncate">{a.type}</div>
                        <div className="text-xl font-bold mt-2">
                          <Amount value={a.current_balance ?? 0} currency={a.iso_currency ?? "CAD"} />
                        </div>
                        <div className="text-xs text-[#1A1A1A]/50">{owed ? "owed" : "available"}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Latest transactions cards */}
            {latest.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Latest transactions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {latest.map((t) => {
                    const isIncome = t.amount < 0;
                    return (
                      <button
                        key={t.id}
                        onClick={() => openEditTx(t)}
                        className="bg-[#FBF9F4] rounded-3xl p-4 text-left hover:bg-white transition"
                      >
                        <div className="text-xs text-[#1A1A1A]/50 truncate">
                          {t.merchant_name || t.name || "Transaction"}
                        </div>
                        <div
                          className="mt-3 inline-block rounded-xl px-3 py-1.5 font-semibold text-sm"
                          style={{ backgroundColor: isIncome ? ACCENTS.green : "#EDE7DA" }}
                        >
                          <Amount value={Math.abs(t.amount)} prefix={isIncome ? "+ " : "- "} />
                        </div>
                        <div className="text-xs text-[#1A1A1A]/40 mt-2">{formatDate(t.date)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tabs + table */}
            <div className="bg-[#FBF9F4] rounded-3xl p-4 sm:p-6">
              <div className="flex gap-2 mb-4 flex-wrap">
                <Tab label="All" active={activeAccount === "all"} onClick={() => setActiveAccount("all")} />
                {accounts.map((a) => (
                  <Tab
                    key={a.id}
                    label={a.name || "Account"}
                    active={activeAccount === a.id}
                    onClick={() => setActiveAccount(a.id)}
                  />
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#1A1A1A]/40">
                      <th className="font-normal py-2 pr-4">Date</th>
                      <th className="font-normal py-2 pr-4">Name</th>
                      <th className="font-normal py-2 pr-4">Category</th>
                      <th className="font-normal py-2 pr-4 text-right">Amount</th>
                      <th className="font-normal py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#1A1A1A]/40">
                          No transactions yet. Import a statement or add one.
                        </td>
                      </tr>
                    ) : (
                      filteredTx.slice(0, 50).map((t) => {
                        const inc = t.amount < 0;
                        return (
                          <tr
                            key={t.id}
                            onClick={() => openEditTx(t)}
                            className="border-t border-[#1A1A1A]/5 cursor-pointer hover:bg-white/60"
                          >
                            <td className="py-3 pr-4 text-[#1A1A1A]/60 whitespace-nowrap">
                              {formatDate(t.date)}
                            </td>
                            <td className="py-3 pr-4 max-w-[200px] truncate">
                              {t.merchant_name || t.name || "—"}
                              {t.notes && (
                                <span className="ml-1.5 text-[#1A1A1A]/30" title={t.notes}>
                                  📝
                                </span>
                              )}
                            </td>
                            <td className="py-3 pr-4 text-[#1A1A1A]/60">{prettyCategory(t.category)}</td>
                            <td
                              className="py-3 pr-4 text-right font-medium whitespace-nowrap"
                              style={{ color: inc ? "#5B8A2E" : "#1A1A1A" }}
                            >
                              <Amount value={Math.abs(t.amount)} prefix={inc ? "+" : "-"} />
                            </td>
                            <td className="py-3">
                              <span
                                className="rounded-full px-3 py-1 text-xs"
                                style={{ backgroundColor: t.pending ? ACCENTS.yellow : ACCENTS.green }}
                              >
                                {t.pending ? "Pending" : "Posted"}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      <ImportModal
        open={importOpen}
        accounts={accounts}
        onClose={() => setImportOpen(false)}
        onImported={load}
      />
      <TransactionEditor
        open={txEditorOpen}
        tx={editingTx}
        accounts={accounts}
        onClose={() => setTxEditorOpen(false)}
        onSaved={load}
      />
      <AccountEditor
        open={acctEditorOpen}
        account={editingAcct}
        onClose={() => setAcctEditorOpen(false)}
        onSaved={load}
      />
    </main>
  );
}

function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active ? "bg-[#1A1A1A] text-white" : "bg-white/60 text-[#1A1A1A]/70 hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}
