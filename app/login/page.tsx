"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F5F1E8] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-[#FBF9F4] rounded-3xl shadow-sm p-8 flex flex-col gap-5"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">
            Welcome back
          </h1>
          <p className="text-sm text-[#1A1A1A]/60 mt-1">
            Enter your password to view your finances.
          </p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="rounded-full bg-white border border-[#1A1A1A]/10 px-5 py-3 text-[#1A1A1A] outline-none focus:border-[#1A1A1A]/30"
        />

        {error && <p className="text-sm text-red-500 px-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[#1A1A1A] text-white py-3 font-medium disabled:opacity-50 hover:opacity-90 transition"
        >
          {loading ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
