"use client";
import { useState, useEffect, useCallback } from "react";
import { readSessionCookie, type SessionPayload, type TokenEntity } from "@/lib/token-client";

const TIER_PRICES: Record<string, number> = { PRO: 150000, ULTRA: 500000, SOVEREIGN: 0 };
type TokenAction = "suspend" | "activate" | "extend";

interface CommercialRequestRecord {
  id: string;
  invoiceCode: string;
  createdAt: string;
  status: string;
  packageName: string;
  quotedPrice: string;
  clientName: string;
  contact: string;
  channel: string;
  notes: string;
}

interface CommercialInvoiceDraft {
  requestId: string;
  invoiceCode: string;
  generatedAt: string;
  dueAt: string;
  markdown: string;
}

interface UsageAggregate {
  key: string;
  events: number;
  units: number;
}

interface UsageEventRecord {
  eventId: string;
  createdAt: string;
  tokenHash: string;
  ownerName: string;
  tier: string;
  agentMode: string;
  units: number;
  status: string;
}

interface UsageLedgerSummary {
  dayKey: string;
  totalEvents: number;
  totalUnits: number;
  todayEvents: number;
  todayUnits: number;
  byTier: UsageAggregate[];
  byAgentMode: UsageAggregate[];
  recentEvents: UsageEventRecord[];
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [checked, setChecked] = useState(false);
  const [adminSession, setAdminSession] = useState<SessionPayload | null>(null);
  const [tokens, setTokens] = useState<TokenEntity[]>([]);
  const [commercialRequests, setCommercialRequests] = useState<CommercialRequestRecord[]>([]);
  const [usageLedger, setUsageLedger] = useState<UsageLedgerSummary | null>(null);
  const [updatingRequest, setUpdatingRequest] = useState<string | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null);
  const [invoiceDraft, setInvoiceDraft] = useState<CommercialInvoiceDraft | null>(null);
  const [invoiceCopied, setInvoiceCopied] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [tier, setTier] = useState<"PRO" | "ULTRA">("ULTRA");
  const [generating, setGenerating] = useState(false);
  const [deployed, setDeployed] = useState<TokenEntity | null>(null);
  const [copied, setCopied] = useState(false);
  const [updatingToken, setUpdatingToken] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState("");

  // ── Auth gate — SOVEREIGN tier only ──
  useEffect(() => {
    const legacy = readSessionCookie();
    if (legacy?.tier === "SOVEREIGN") {
      setAdminSession(legacy);
      setAuthorized(true);
    }

    void fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.session) {
          const session = { ...data.session, token: "server-session" } as SessionPayload;
          setAdminSession(session);
          setAuthorized(session.tier === "SOVEREIGN");
        } else if (!legacy) {
          setAuthorized(false);
        }
      })
      .catch(() => {
        if (!legacy) setAuthorized(false);
      })
      .finally(() => setChecked(true));
  }, []);

  // ── Fetch registry ──
  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tokens");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch tokens");
      setTokens(data.tokens ?? []);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Failed to fetch tokens");
    }
  }, []);

  const fetchCommercialRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/commercial-requests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch commercial requests");
      setCommercialRequests(data.requests ?? []);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Failed to fetch commercial requests");
    }
  }, []);

  const fetchUsageLedger = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/usage");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch usage ledger");
      setUsageLedger(data.usage ?? null);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Failed to fetch usage ledger");
    }
  }, []);

  useEffect(() => {
    if (authorized) {
      void fetchTokens();
      void fetchCommercialRequests();
      void fetchUsageLedger();
    }
  }, [authorized, fetchTokens, fetchCommercialRequests, fetchUsageLedger]);

  // ── Generate token ──
  const handleGenerate = async () => {
    if (!ownerName.trim() || generating) return;
    setGenerating(true); setDeployed(null); setCopied(false); setAdminMessage("");
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerName: ownerName.trim(), tier }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Token deployment failed");
      if (data.entity) {
        setDeployed(data.entity);
        setOwnerName("");
        setAdminMessage(`Token ${data.entity.tier} deployed for ${data.entity.ownerName}.`);
        await fetchTokens();
      }
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Token deployment failed");
    }
    setGenerating(false);
  };

  const handleTokenAction = async (token: string, action: TokenAction) => {
    if (updatingToken) return;
    setUpdatingToken(`${action}:${token}`);
    setAdminMessage("");
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, days: action === "extend" ? 30 : undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Token update failed");
      if (data.entity) {
        setAdminMessage(`${data.entity.token} updated: ${action}.`);
        if (deployed?.token === data.entity.token) setDeployed(data.entity);
        await fetchTokens();
      }
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Token update failed");
    } finally {
      setUpdatingToken(null);
    }
  };

  const handleGenerateInvoice = async (requestId: string) => {
    if (generatingInvoice) return;
    setGeneratingInvoice(requestId);
    setInvoiceCopied(false);
    setAdminMessage("");
    try {
      const res = await fetch("/api/admin/commercial-requests/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invoice draft generation failed");
      setInvoiceDraft(data.invoice);
      setAdminMessage(`Invoice draft ready: ${data.invoice.invoiceCode}.`);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Invoice draft generation failed");
    } finally {
      setGeneratingInvoice(null);
    }
  };

  const handleCopyInvoice = async () => {
    if (!invoiceDraft) return;
    try {
      await navigator.clipboard.writeText(invoiceDraft.markdown);
      setInvoiceCopied(true);
      setTimeout(() => setInvoiceCopied(false), 2500);
    } catch {
      setAdminMessage("Clipboard copy failed. Select and copy the invoice text manually.");
    }
  };

  // ── Copy dispatch text ──
  const handleCopy = () => {
    if (!deployed) return;
    const exp = new Date(deployed.expiredAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const text = `Otorisasi Node JAGAT G7 Berhasil.\nToken Anda: ${deployed.token}\nTier: ${deployed.tier}\nAktif Hingga: ${exp}\nSilakan login di http://203.175.125.185:50012/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Stats ──
  const now = new Date();
  const active = tokens.filter(t => t.status === "ACTIVE" && new Date(t.expiredAt) > now);
  const expired = tokens.filter(t => new Date(t.expiredAt) <= now);
  const suspended = tokens.filter(t => t.status === "SUSPENDED");
  const revenue = active.reduce((s, t) => s + (TIER_PRICES[t.tier] ?? 0), 0);

  if (!checked) return <div className="flex h-screen items-center justify-center bg-slate-950"><p className="text-slate-500 font-mono text-sm animate-pulse">Verifying clearance…</p></div>;

  if (!authorized) return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-center px-6">
      <div className="w-16 h-16 mb-5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center"><span className="text-3xl">🔒</span></div>
      <p className="text-lg font-bold text-red-400 mb-1">Access Denied</p>
      <p className="text-sm text-slate-500 max-w-sm">Clearance level SOVEREIGN diperlukan untuk mengakses Admin Terminal Node. Login dengan token SOVEREIGN.</p>
      <a href="/login" className="mt-5 px-5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-all">← Kembali ke Login</a>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-200">
      {/* ── Header ── */}
      <header className="border-b border-slate-800/60 bg-slate-900/50 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-[15px] font-bold text-slate-100 tracking-tight">JAGAT G7 Core Control — <span className="text-red-400">Admin Terminal Node</span></h1>
            <p className="text-[11px] font-mono text-slate-500 mt-0.5">Sovereign Registry Management • Operator: {adminSession?.ownerName ?? "SOVEREIGN"}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
            <span className="text-[10px] font-mono text-red-400">ADMIN</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 max-w-5xl mx-auto w-full space-y-6">

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Tokens", value: String(active.length), color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" },
            { label: "Revenue (Simulated)", value: `Rp ${revenue.toLocaleString("id-ID")}`, color: "text-amber-400 border-amber-500/30 bg-amber-500/5" },
            { label: "Expired / Suspended", value: `${expired.length} / ${suspended.length}`, color: "text-red-400 border-red-500/30 bg-red-500/5" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border px-5 py-4 ${s.color}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{s.label}</p>
              <p className="mt-1 text-[22px] font-extrabold tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-5">
          <div className="flex flex-col gap-3 border-b border-slate-800/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-slate-300">Usage Ledger</h2>
              <p className="mt-0.5 text-[10px] font-mono text-slate-600">
                Persistent request units for manual metering; no prompts, answers, raw tokens, or payment data.
              </p>
            </div>
            <button onClick={fetchUsageLedger} className="rounded border border-slate-700/70 bg-slate-800/70 px-3 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300">
              Refresh Usage
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/70">Today Units</p>
              <p className="mt-1 text-2xl font-extrabold text-cyan-200">{usageLedger?.todayUnits ?? 0}</p>
              <p className="mt-1 text-[10px] font-mono text-cyan-200/50">{usageLedger?.todayEvents ?? 0} events on {usageLedger?.dayKey ?? "-"}</p>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/30 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">By Tier</p>
              <div className="mt-2 space-y-1.5">
                {(usageLedger?.byTier.length ? usageLedger.byTier : [{ key: "-", events: 0, units: 0 }]).map((item) => (
                  <div key={item.key} className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-300">{item.key}</span>
                    <span className="text-emerald-300">{item.units}u / {item.events}e</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700/60 bg-slate-950/30 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">By Mode</p>
              <div className="mt-2 space-y-1.5">
                {(usageLedger?.byAgentMode.length ? usageLedger.byAgentMode : [{ key: "-", events: 0, units: 0 }]).map((item) => (
                  <div key={item.key} className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-300">{item.key}</span>
                    <span className="text-amber-300">{item.units}u / {item.events}e</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800/40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Owner</th>
                  <th className="py-2 pr-4">Tier</th>
                  <th className="py-2 pr-4">Mode</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Hash</th>
                </tr>
              </thead>
              <tbody>
                {(usageLedger?.recentEvents ?? []).slice(0, 6).map((event) => (
                  <tr key={event.eventId} className="border-b border-slate-800/20 text-[11px]">
                    <td className="py-2 pr-4 font-mono text-slate-500">{new Date(event.createdAt).toLocaleString("id-ID")}</td>
                    <td className="py-2 pr-4 text-slate-300">{event.ownerName}</td>
                    <td className="py-2 pr-4 font-mono text-cyan-300">{event.tier}</td>
                    <td className="py-2 pr-4 font-mono text-amber-300">{event.agentMode}</td>
                    <td className="py-2 pr-4 font-mono text-emerald-300">{event.status}:{event.units}u</td>
                    <td className="py-2 pr-4 font-mono text-slate-600">{event.tokenHash.slice(0, 10)}</td>
                  </tr>
                ))}
                {!usageLedger?.recentEvents.length && (
                  <tr>
                    <td colSpan={6} className="py-3 text-[12px] text-slate-500">Belum ada usage event durable.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {adminMessage && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3">
            <p className="text-[12px] font-mono text-cyan-200">{adminMessage}</p>
          </div>
        )}

        {/* ── Token Generator ── */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-6">
          <h2 className="text-[13px] font-bold text-slate-100 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"/>
            Token Deployment Console
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Owner Name</label>
              <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                placeholder="Nama subscriber…"
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700/50 rounded-xl text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"/>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Tier Selection</label>
              <select value={tier} onChange={e => setTier(e.target.value as "PRO"|"ULTRA")}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700/50 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all appearance-none cursor-pointer">
                <option value="PRO">PRO — Rp 150.000/bulan</option>
                <option value="ULTRA">ULTRA — Rp 500.000/bulan</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={handleGenerate} disabled={!ownerName.trim() || generating}
                className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all">
                {generating ? "Deploying…" : "⚡ Generate & Deploy Sovereign Token"}
              </button>
            </div>
          </div>

          {/* ── Deployment Output ── */}
          {deployed && (
            <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"/>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Token Deployed Successfully</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div><p className="text-[10px] text-slate-500 uppercase tracking-wider">Token</p><p className="font-mono font-bold text-emerald-300 break-all">{deployed.token}</p></div>
                <div><p className="text-[10px] text-slate-500 uppercase tracking-wider">Tier</p><p className="font-bold text-slate-200">{deployed.tier}</p></div>
                <div><p className="text-[10px] text-slate-500 uppercase tracking-wider">Expires</p><p className="font-mono text-slate-300">{new Date(deployed.expiredAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p></div>
              </div>
              <button onClick={handleCopy}
                className={`w-full sm:w-auto px-5 py-2 rounded-lg text-[12px] font-semibold transition-all active:scale-[0.97] ${copied ? "bg-emerald-600 text-white" : "bg-slate-800 border border-slate-700/50 text-slate-300 hover:bg-slate-700"}`}>
                {copied ? "✅ Copied!" : "📋 Copy WhatsApp Dispatch Text"}
              </button>
            </div>
          )}
        </div>

        {/* ── Registry Table ── */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-3">
            <div>
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-slate-300">Manual Commercial Requests ({commercialRequests.length})</h2>
              <p className="mt-0.5 text-[10px] font-mono text-slate-600">Invoice-ready intake only; payment and token activation stay admin-reviewed.</p>
            </div>
            <button onClick={fetchCommercialRequests} className="rounded border border-slate-700/70 bg-slate-800/70 px-3 py-1.5 text-[10px] font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300">
              Refresh
            </button>
          </div>
          {commercialRequests.length === 0 ? (
            <p className="px-5 py-5 text-[12px] text-slate-500">Belum ada request invoice manual dari pricing page.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800/40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-2.5">Request</th>
                    <th className="px-4 py-2.5">Client</th>
                    <th className="px-4 py-2.5">Package</th>
                    <th className="px-4 py-2.5">Quote</th>
                    <th className="px-4 py-2.5">Contact</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {commercialRequests.slice(0, 8).map((request) => (
                    <tr key={request.id} className="border-b border-slate-800/20 hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-2.5">
                        <p className="font-mono text-[11px] text-cyan-300">{request.invoiceCode}</p>
                        <p className="mt-0.5 text-[10px] text-slate-600">{new Date(request.createdAt).toLocaleString("id-ID")}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-[12px] font-semibold text-slate-200">{request.clientName}</p>
                        {request.notes && <p className="mt-0.5 max-w-[220px] truncate text-[10px] text-slate-500">{request.notes}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-300">{request.packageName}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-amber-300">{request.quotedPrice}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-mono text-[11px] text-emerald-300">{request.contact}</p>
                        <p className="mt-0.5 text-[10px] uppercase text-slate-600">{request.channel}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {(() => {
                          const statusColors: Record<string, string> = {
                            new: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
                            qualified: "border-amber-500/30 bg-amber-500/10 text-amber-300",
                            quoted: "border-purple-500/30 bg-purple-500/10 text-purple-300",
                            closed_won: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                            closed_lost: "border-red-500/30 bg-red-500/10 text-red-300",
                          };
                          return (
                            <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${statusColors[request.status] || "border-slate-600/50 bg-slate-800 text-slate-300"}`}>
                              {request.status}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const transitions: Record<string, string[]> = {
                              new: ["qualified", "closed_lost"],
                              qualified: ["quoted", "closed_lost"],
                              quoted: ["closed_won", "closed_lost"],
                            };
                            const next = transitions[request.status] || [];
                            return next.map((s) => (
                              <button
                                key={s}
                                type="button"
                                disabled={updatingRequest === `${request.id}:${s}`}
                                onClick={async () => {
                                  setUpdatingRequest(`${request.id}:${s}`);
                                  try {
                                    const res = await fetch("/api/admin/commercial-requests", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ requestId: request.id, status: s }),
                                    });
                                    if (!res.ok) throw new Error((await res.json()).error);
                                    void fetchCommercialRequests();
                                  } catch (err) {
                                    setAdminMessage(err instanceof Error ? err.message : "Update failed");
                                  } finally {
                                    setUpdatingRequest(null);
                                  }
                                }}
                                className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition-all disabled:opacity-50 ${
                                  s === "closed_won"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/60"
                                    : s === "closed_lost"
                                      ? "border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-400/60"
                                    : "border-slate-700/70 bg-slate-800/80 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
                                }`}
                              >
                                {updatingRequest === `${request.id}:${s}` ? "..." : s}
                              </button>
                            ));
                          })()}
                          {["qualified", "quoted", "closed_won"].includes(request.status) && (
                            <button
                              type="button"
                              disabled={generatingInvoice === request.id}
                              onClick={() => handleGenerateInvoice(request.id)}
                              className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 transition-all hover:border-cyan-400/60 disabled:opacity-50"
                            >
                              {generatingInvoice === request.id ? "..." : "Invoice"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {invoiceDraft && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-5">
            <div className="flex flex-col gap-3 border-b border-cyan-500/20 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-cyan-200">
                  Manual Invoice Draft - {invoiceDraft.invoiceCode}
                </h2>
                <p className="mt-0.5 text-[10px] font-mono text-cyan-200/60">
                  Copy/review only. Payment confirmation and token activation remain manual.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopyInvoice}
                  className="rounded border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-[10px] font-semibold text-cyan-100 transition-all hover:border-cyan-300"
                >
                  {invoiceCopied ? "Copied" : "Copy Markdown"}
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceDraft(null)}
                  className="rounded border border-slate-700/70 bg-slate-800/80 px-3 py-1.5 text-[10px] font-semibold text-slate-300 transition-all hover:border-slate-500"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={invoiceDraft.markdown}
              className="mt-4 h-72 w-full resize-y rounded-lg border border-slate-700/70 bg-slate-950/80 p-4 font-mono text-[11px] leading-relaxed text-slate-200 outline-none"
            />
          </div>
        )}

        <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800/60"><h2 className="text-[12px] font-bold text-slate-300 uppercase tracking-wider">Live Token Registry ({tokens.length})</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-slate-800/40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5">Token</th><th className="px-4 py-2.5">Owner</th><th className="px-4 py-2.5">Tier</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Expires</th><th className="px-4 py-2.5">Actions</th>
              </tr></thead>
              <tbody>
                {tokens.map(t => {
                  const isExp = new Date(t.expiredAt) <= now;
                  const statusLabel = isExp ? "Expired" : t.status === "SUSPENDED" ? "Suspended" : "Active";
                  const statusClass = isExp
                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                    : t.status === "SUSPENDED"
                      ? "border-slate-600/50 bg-slate-800 text-slate-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
                  const tokenActionKey = `${t.status === "ACTIVE" ? "suspend" : "activate"}:${t.token}`;
                  const extendActionKey = `extend:${t.token}`;
                  const canSuspend = t.tier !== "SOVEREIGN";
                  return (
                    <tr key={t.token} className="border-b border-slate-800/20 hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-2.5 font-mono text-[12px] text-emerald-400">{t.token}</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-300">{t.ownerName}</td>
                      <td className="px-4 py-2.5"><span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${t.tier === "SOVEREIGN" ? "bg-red-500/10 text-red-400 border border-red-500/30" : t.tier === "ULTRA" ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "bg-slate-700/50 text-slate-300 border border-slate-600/30"}`}>{t.tier}</span></td>
                      <td className="px-4 py-2.5"><span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>{statusLabel}</span></td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">{new Date(t.expiredAt).toLocaleDateString("id-ID")}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTokenAction(t.token, t.status === "ACTIVE" ? "suspend" : "activate")}
                            disabled={Boolean(updatingToken) || !canSuspend}
                            className="rounded border border-slate-700/70 bg-slate-800/80 px-2 py-1 text-[10px] font-semibold text-slate-300 transition-all hover:border-amber-500/40 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {updatingToken === tokenActionKey ? "Saving" : t.status === "ACTIVE" ? "Suspend" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTokenAction(t.token, "extend")}
                            disabled={Boolean(updatingToken)}
                            className="rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300 transition-all hover:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {updatingToken === extendActionKey ? "Saving" : "+30d"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800/40 px-6 py-3 text-center">
        <p className="text-[10px] font-mono text-slate-600">JAGAT G7 Core Control v1.0 • SOVEREIGN ACCESS ONLY • Encrypted Runtime Registry</p>
      </footer>
    </div>
  );
}
