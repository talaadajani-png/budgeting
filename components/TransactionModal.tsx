"use client";

import { ACCENTS } from "@/lib/colors";
import { formatDate, prettyCategory } from "@/lib/format";
import Amount from "./Amount";
import type { Transaction } from "@/lib/types";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-t border-[#1A1A1A]/5">
      <span className="text-sm text-[#1A1A1A]/50">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default function TransactionModal({
  tx,
  onClose,
}: {
  tx: Transaction | null;
  onClose: () => void;
}) {
  if (!tx) return null;
  const isIncome = tx.amount < 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#FBF9F4] rounded-3xl w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold tracking-tight">
              {tx.merchant_name || tx.name || "Transaction"}
            </h3>
            <p className="text-sm text-[#1A1A1A]/50">{formatDate(tx.date)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1A1A1A]/5 hover:bg-[#1A1A1A]/10 flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div
          className="rounded-2xl px-4 py-5 text-center mb-4"
          style={{ backgroundColor: isIncome ? ACCENTS.green : "#EDE7DA" }}
        >
          <div className="text-3xl font-bold">
            <Amount value={Math.abs(tx.amount)} prefix={isIncome ? "+" : "-"} />
          </div>
          <div className="text-xs text-[#1A1A1A]/50 mt-1">
            {isIncome ? "Money in" : "Money out"}
          </div>
        </div>

        <div>
          <Row label="Category" value={prettyCategory(tx.category)} />
          <Row label="Account" value={tx.accounts?.name ?? "—"} />
          <Row
            label="Status"
            value={
              <span
                className="rounded-full px-3 py-1 text-xs"
                style={{ backgroundColor: tx.pending ? ACCENTS.yellow : ACCENTS.green }}
              >
                {tx.pending ? "Pending" : "Posted"}
              </span>
            }
          />
          {tx.name && tx.merchant_name && tx.name !== tx.merchant_name && (
            <Row label="Description" value={tx.name} />
          )}
          <Row
            label="Transaction ID"
            value={<span className="text-xs text-[#1A1A1A]/40">{tx.plaid_transaction_id}</span>}
          />
        </div>
      </div>
    </div>
  );
}
