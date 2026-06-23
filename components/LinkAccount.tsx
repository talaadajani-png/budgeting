"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink, type PlaidLinkOnExit } from "react-plaid-link";

// True when the page was loaded by Plaid redirecting back from an OAuth bank.
function isOAuthRedirect() {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("oauth_state_id")
  );
}

export default function LinkAccount({ onLinked }: { onLinked?: () => void }) {
  // On an OAuth return, resume the in-progress Link session using the token we
  // stashed before redirecting, rather than minting a fresh one.
  const [linkToken, setLinkToken] = useState<string | null>(() =>
    isOAuthRedirect() ? window.localStorage.getItem("plaid_link_token") : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinkToken = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const data = await res.json();
      if (data.link_token) {
        setLinkToken(data.link_token);
        // Persist so we can resume the same Link session after an OAuth redirect.
        window.localStorage.setItem("plaid_link_token", data.link_token);
      } else setError(data.error || "Could not create link token");
    } catch {
      setError("Could not reach the server");
    }
  }, []);

  useEffect(() => {
    if (!isOAuthRedirect()) fetchLinkToken();
  }, [fetchLinkToken]);

  const onSuccess = useCallback(
    async (public_token: string) => {
      setBusy(true);
      setError(null);
      try {
        const ex = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token }),
        });
        if (!ex.ok) {
          const d = await ex.json().catch(() => ({}));
          throw new Error(d.error || "Exchange failed");
        }
        await fetch("/api/plaid/sync-transactions", { method: "POST" });
        onLinked?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Linking failed");
      } finally {
        setBusy(false);
      }
    },
    [onLinked]
  );

  // Surface anything that goes wrong inside the Plaid modal.
  const onExit = useCallback<PlaidLinkOnExit>((err) => {
    if (err) {
      setError(`${err.error_code ?? "Exited"}: ${err.error_message ?? err.display_message ?? ""}`);
      // eslint-disable-next-line no-console
      console.error("Plaid Link exit", err);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
    // On an OAuth return, hand Plaid the full redirect URL to complete the flow.
    receivedRedirectUri: isOAuthRedirect() ? window.location.href : undefined,
  });

  // Auto-reopen Link to finish the OAuth handshake once it's ready.
  useEffect(() => {
    if (isOAuthRedirect() && ready) open();
  }, [ready, open]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => open()}
        disabled={!ready || !linkToken || busy}
        className="rounded-full bg-[#1A1A1A] text-white px-5 py-2.5 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
      >
        {busy ? "Linking…" : "+ Link account"}
      </button>
      {error && (
        <span className="text-xs text-red-500 max-w-[240px] text-right">{error}</span>
      )}
    </div>
  );
}
