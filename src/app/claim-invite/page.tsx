"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ClaimInvitePage() {
  const { isSignedIn, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const c = searchParams.get("code");
    if (c) setCode(c);
  }, [searchParams]);

  async function claim() {
    if (!code.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/claim-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? "Something went wrong"); setStatus("error"); return; }
      setStatus("success");
    } catch {
      setErrorMsg("Network error — please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100 px-6 py-3">
        <Link href="/" className="text-xl tracking-tight select-none">
          <span className="font-black">SKIN</span>
          <span className="font-light text-gray-500">dex</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {!isLoaded ? null : !isSignedIn ? (
            <div className="text-center space-y-4">
              <h1 className="text-xl font-semibold text-gray-900">Admin invite</h1>
              <p className="text-sm text-gray-500">Sign in to claim your admin access.</p>
              <Link
                href={`/sign-in?redirect_url=/claim-invite${code ? `?code=${encodeURIComponent(code)}` : ""}`}
                className="inline-block text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Sign in
              </Link>
            </div>
          ) : status === "success" ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto text-teal-600 text-xl">✓</div>
              <h1 className="text-xl font-semibold text-gray-900">You&apos;re an admin</h1>
              <p className="text-sm text-gray-500">Admin access granted. You can now access the admin panel.</p>
              <Link href="/admin" className="inline-block text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                Go to Admin
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-xl font-semibold text-gray-900">Accept admin invite</h1>
                <p className="text-sm text-gray-500 mt-1">Enter your invite code to gain admin access.</p>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setStatus("idle"); setErrorMsg(""); }}
                  placeholder="Invite code…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400 font-mono"
                  onKeyDown={(e) => { if (e.key === "Enter") claim(); }}
                />
                {errorMsg && <p className="text-xs text-rose-600">{errorMsg}</p>}
                <button
                  type="button"
                  onClick={claim}
                  disabled={status === "loading" || !code.trim()}
                  className="w-full text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  {status === "loading" ? "Claiming…" : "Claim admin access"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
