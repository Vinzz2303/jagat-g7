"use client";

import { useState, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { TokenValidationResult } from "@/lib/token-client";

function ShieldIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.96 11.96 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function SpinnerSm() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}

export default function GarudaGateAuth() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  const resolveRedirectTarget = useCallback(() => {
    const target = new URLSearchParams(window.location.search).get("redirect") || "/console";
    return target.startsWith("/") && !target.startsWith("//") ? target : "/console";
  }, []);

  const goToTarget = useCallback((target: string) => {
    router.replace(target);
    window.setTimeout(() => {
      if (window.location.pathname !== target) window.location.assign(target);
    }, 250);
  }, [router]);

  const performAuth = useCallback(async (authToken: string) => {
    const trimmed = authToken.trim();
    if (!trimmed) {
      setError("Access token diperlukan.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: trimmed }),
      });
      const result: TokenValidationResult = await res.json();

      if (!result.valid) {
        setError(result.error ?? "Token tidak valid.");
        setLoading(false);
        return;
      }

      // Cookie is now set by the server via Set-Cookie header
      // No client-side bakeSessionCookie needed

      const redirectTarget = resolveRedirectTarget();
      setSuccess(true);
      setLoading(false);
      goToTarget(redirectTarget);
    } catch {
      setError("Gagal menghubungi server validasi.");
      setLoading(false);
    }
  }, [goToTarget, resolveRedirectTarget]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    performAuth(token);
  };

  const handleDemoClick = useCallback(() => {
    const demo = "JAGAT-J7-SECURE-2026";
    setToken(demo);
    setError("");
    setTimeout(() => performAuth(demo), 150);
  }, [performAuth]);

  const handleLocalSession = useCallback(async () => {
    setSessionLoading(true);
    setError("");
    try {
      // Call server endpoint to set signed guest cookie
      const res = await fetch("/api/auth/local-session", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const redirectTarget = resolveRedirectTarget();
        setSuccess(true);
        goToTarget(redirectTarget);
      } else {
        setError("Gagal membuat sesi lokal.");
      }
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setSessionLoading(false);
    }
  }, [goToTarget, resolveRedirectTarget]);

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-9">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-garuda-200 bg-garuda-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-garuda-700">
            <ShieldIcon className="h-3.5 w-3.5" />
            Sovereign Gate
          </div>
          <h1 className="text-[36px] font-semibold tracking-tight text-neutral-950">
            JAGAT <span className="text-garuda-600">G7</span>
          </h1>
          <p className="mt-3 max-w-[340px] text-[15px] leading-7 text-neutral-600">
            Sistem asistensi intelijensia berdaulat untuk riset, memori, dan eksekusi strategis Faturachman Al Kahfi.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLocalSession}
          disabled={sessionLoading || success}
          className="group flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[14px] font-semibold text-neutral-800 shadow-sm transition-all duration-200 hover:border-garuda-300 hover:bg-garuda-50/40 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
        >
          {sessionLoading ? (
            <>
              <SpinnerSm />
              <span>Membuka sesi lokal...</span>
            </>
          ) : (
            <>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-garuda-300">
                <ShieldIcon className="h-4 w-4" />
              </span>
              <span>Aktifkan Sesi Berdaulat</span>
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[11px] leading-5 text-neutral-500">
          Sesi lokal terenkripsi. Tidak memakai penyedia login asing.
        </p>

        <div className="my-7 flex items-center gap-4">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">atau</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="access-token" className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-neutral-800">
              <LockIcon />
              Sovereign Access Token
            </label>
            <input
              id="access-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              disabled={loading || success}
              value={token}
              onChange={(event) => {
                setToken(event.target.value);
                if (error) setError("");
              }}
              placeholder="Masukkan token akses anda..."
              className={`w-full rounded-xl border bg-white px-4 py-3 font-mono text-[13.5px] text-neutral-800 placeholder:text-neutral-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 ${
                error
                  ? "border-red-300 focus:ring-red-400/30"
                  : success
                    ? "border-emerald-400 focus:ring-emerald-400/30"
                    : "border-neutral-200 focus:border-garuda-400 focus:ring-garuda-400/20"
              }`}
            />
            {error && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-relaxed text-red-600">
                {error}
              </div>
            )}
            {success && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-emerald-600">
                <CheckIcon />
                Token valid. Mengalihkan ke konsol.
              </p>
            )}
            <div className="mt-3 text-right">
              <button
                type="button"
                disabled={loading || success}
                onClick={handleDemoClick}
                className="text-[12.5px] font-medium text-garuda-600 transition-all hover:text-garuda-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
              >
                Gunakan Akses Demo
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success || !token.trim()}
            className="relative w-full overflow-hidden rounded-xl bg-neutral-950 px-4 py-3 text-[14px] font-semibold text-white shadow-lg shadow-neutral-900/15 transition-all duration-200 hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerSm />
                Memvalidasi...
              </span>
            ) : success ? (
              <span className="flex items-center justify-center gap-2">
                <CheckIcon />
                Terautentikasi
              </span>
            ) : (
              "Autentikasi"
            )}
          </button>
        </form>

        <div className="mt-8 space-y-3 text-center">
          <a href="/pricing" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-garuda-600 transition-all hover:text-garuda-700 hover:underline">
            Lihat Paket Langganan
          </a>
          <p className="text-[10.5px] leading-relaxed text-neutral-400">
            Dilindungi oleh kerangka keamanan GARUDA berdaulat.
            <br />
            Hanya personel berwenang.
          </p>
        </div>
      </div>
    </div>
  );
}
