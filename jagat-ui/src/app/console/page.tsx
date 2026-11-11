"use client";

import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readSessionCookie, clearSessionViaApi, type SessionPayload } from "@/lib/token-client";

/* ── Types ── */
interface TimingData { embeddingMs: number; searchMs: number; inferenceMs: number; totalMs: number }
interface ContextSource {
  title?: string;
  source: string;
  category?: string;
  score: number;
  denseScore?: number;
  sparseScore?: number;
  chunkIndex?: number;
  sectionTitle?: string;
  retrievalMode?: string;
  matchedKeywords?: string[];
}
interface ChatMeta {
  traceId: string;
  model: string;
  agentMode?: AgentMode;
  contextDocumentsUsed: number;
  scoreThresholdApplied: number;
  retrievalMode?: string;
  contextSources?: ContextSource[];
  embeddingMs: number;
  searchMs: number;
}
interface UsageSummary {
  ownerName: string;
  tier: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string;
  billingMode: "manual";
  meteringMode: "memory_mvp" | "persistent_file_mvp";
}
interface ChatEntry { id: string; type: "query"|"result"|"error"; topic?: string; analysis?: string; meta?: ChatMeta; timing?: TimingData; error?: string; ts: string; streaming?: boolean }
type AgentMode = "research" | "kiting" | "ting" | "motherbox";
type IngestState = "idle"|"loading"|"success"|"error";
const FREE_LIMIT = 5;
const uid = () => Math.random().toString(36).slice(2,10);
const fmtMs = (ms: number) => ms >= 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms`;
const fmtPct = (value?: number) => typeof value === "number" ? `${Math.round(value * 100)}%` : "0%";
const sourceLabel = (source: ContextSource) => source.title?.trim() || source.source;
const METRICS = [
  { key:"embeddingMs", label:"Emb", cls:"text-purple-400 border-purple-500/30 bg-purple-500/5" },
  { key:"searchMs",    label:"Cari", cls:"text-cyan-400 border-cyan-500/30 bg-cyan-500/5" },
  { key:"inferenceMs", label:"Infer", cls:"text-amber-400 border-amber-500/30 bg-amber-500/5" },
  { key:"totalMs",     label:"Total", cls:"text-emerald-400 border-emerald-500/30 bg-emerald-500/5" },
];

const TIER_LABELS: Record<string, string> = {
  SOVEREIGN: "Sovereign Node",
  ULTRA: "Ultra Node",
  PRO: "Pro Node",
  GUEST: "Guest Node",
};

const AGENT_MODES: Array<{ value: AgentMode; label: string; desc: string }> = [
  { value: "research", label: "Research", desc: "Memory-grounded analysis" },
  { value: "kiting", label: "Kiting", desc: "Drafts, plans, execution" },
  { value: "ting", label: "Ting", desc: "Financial risk copilot" },
  { value: "motherbox", label: "Motherbox", desc: "API and product gateway" },
];

const agentModeLabel = (mode?: AgentMode) =>
  AGENT_MODES.find((item) => item.value === mode)?.label ?? "Research";

const pipelineLabel = (model?: string) => model ? `${model} + Qdrant` : "Local/Remote worker + Qdrant";
const usageLabel = (usage: UsageSummary | null, fallback: string) =>
  usage ? (usage.limit === null ? "Internal" : `${usage.used}/${usage.limit} used`) : fallback;
const defaultQuotaLabel = (tier: string, freeUsed: number) => {
  if (tier === "SOVEREIGN") return "Internal";
  if (tier === "ULTRA") return "0/250 used";
  if (tier === "PRO") return "0/50 used";
  return `${freeUsed}/${FREE_LIMIT} used`;
};

type IngestMetadata = {
  title: string;
  source: string;
  category: string;
  doc_type: string;
  owner: string;
  created_at: string;
  trust_level: string;
  provenance: string;
  notes: string;
};

const CATEGORY_OPTIONS = [
  { value: "blueprint", label: "Blueprint" },
  { value: "roadmap", label: "Roadmap" },
  { value: "milestone", label: "Milestone" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "product", label: "Product" },
  { value: "risk", label: "Risk" },
  { value: "decision", label: "Decision" },
  { value: "commercial", label: "Commercial" },
  { value: "regulation", label: "Regulation" },
  { value: "founder_note", label: "Founder Note" },
];

const DOC_TYPE_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "xlsx", label: "XLSX" },
  { value: "md", label: "Markdown" },
  { value: "txt", label: "Text" },
  { value: "note", label: "Note" },
];

const TRUST_LEVEL_OPTIONS = [
  { value: "founder_verified", label: "Founder Verified" },
  { value: "core_team_verified", label: "Core Team Verified" },
  { value: "internal_draft", label: "Internal Draft" },
  { value: "external_reference", label: "External Reference" },
];

const todayDate = () => new Date().toISOString().slice(0, 10);

const createDefaultIngestMetadata = (): IngestMetadata => ({
  title: "",
  source: "",
  category: "founder_note",
  doc_type: "note",
  owner: "Faturachman Al Kahfi",
  created_at: todayDate(),
  trust_level: "founder_verified",
  provenance: "",
  notes: "",
});

function Spinner({ cls="w-4 h-4" }: { cls?: string }) {
  return (
    <svg className={`${cls} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/>
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75"/>
    </svg>
  );
}

function CitationPanel({ sources }: { sources: ContextSource[] }) {
  const visibleSources = sources.filter((source) => source.source).slice(0, 5);
  if (visibleSources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-slate-800/70 pt-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Sumber Memori</p>
        <span className="text-[10px] font-mono text-slate-600">{visibleSources.length} citation</span>
      </div>
      <div className="grid gap-2">
        {visibleSources.map((source, index) => (
          <div key={`${source.source}-${source.chunkIndex ?? index}-${index}`} className="rounded-lg border border-slate-800/70 bg-slate-950/45 px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono text-slate-500">[{index + 1}]</span>
              <span className="max-w-full truncate text-xs font-semibold text-slate-200">{sourceLabel(source)}</span>
              {source.category && <span className="rounded border border-cyan-500/25 bg-cyan-500/5 px-1.5 py-0.5 text-[9px] font-mono uppercase text-cyan-300">{source.category}</span>}
              {source.retrievalMode && <span className="rounded border border-emerald-500/25 bg-emerald-500/5 px-1.5 py-0.5 text-[9px] font-mono uppercase text-emerald-300">{source.retrievalMode}</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-slate-500">
              <span>{source.source}</span>
              {typeof source.chunkIndex === "number" && <span>chunk #{source.chunkIndex + 1}</span>}
              <span>score {fmtPct(source.score)}</span>
              {typeof source.denseScore === "number" && <span>dense {fmtPct(source.denseScore)}</span>}
              {typeof source.sparseScore === "number" && <span>sparse {fmtPct(source.sparseScore)}</span>}
            </div>
            {source.sectionTitle && <p className="mt-1 truncate text-[10px] text-slate-600">{source.sectionTitle}</p>}
            {source.matchedKeywords && source.matchedKeywords.length > 0 && (
              <p className="mt-1 truncate text-[10px] text-amber-300/80">keyword: {source.matchedKeywords.slice(0, 6).join(", ")}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  const { data: session, status } = useSession();
  const isNextAuth = status === "authenticated";

  /* ── Cookie-based sovereign session ── */
  const [cookieSession, setCookieSession] = useState<SessionPayload | null>(null);
  useEffect(() => {
    const legacy = readSessionCookie();
    if (legacy) setCookieSession(legacy);
    void fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.session) setCookieSession({ ...data.session, token: "server-session" });
      })
      .catch(() => undefined);
  }, []);

  const isLoggedIn = isNextAuth || !!cookieSession;
  const displayName = isNextAuth ? (session.user?.name ?? "Sovereign Agent") : (cookieSession?.ownerName ?? "Guest");
  const displayTier = cookieSession?.tier ?? (isNextAuth ? "SOVEREIGN" : "FREE");
  const tierLabel = TIER_LABELS[displayTier] ?? "Free Tier";

  const handleLogout = useCallback(async () => {
    await clearSessionViaApi();
    if (isNextAuth) {
      signOut({ callbackUrl: "/login" });
    } else {
      window.location.assign("/login");
    }
  }, [isNextAuth]);

  /* ── Ingest ── */
  const [ingestMetadata, setIngestMetadata] = useState<IngestMetadata>(() => createDefaultIngestMetadata());
  const [content, setContent] = useState("");
  const [ingestState, setIngestState] = useState<IngestState>("idle");
  const [ingestMsg, setIngestMsg] = useState("");
  const source = ingestMetadata.source;
  const setSource = (value: string) => {
    setIngestMetadata((current) => ({ ...current, source: value }));
  };
  const ingestReady =
    content.trim().length > 0 &&
    ingestMetadata.title.trim().length > 0 &&
    ingestMetadata.source.trim().length > 0 &&
    ingestMetadata.category.trim().length > 0 &&
    ingestMetadata.doc_type.trim().length > 0 &&
    ingestMetadata.owner.trim().length > 0 &&
    ingestMetadata.created_at.trim().length > 0 &&
    ingestMetadata.trust_level.trim().length > 0 &&
    ingestMetadata.provenance.trim().length > 0;

  /* ── Chat ── */
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [agentMode, setAgentMode] = useState<AgentMode>("research");
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const limitReached = !isLoggedIn && msgCount >= FREE_LIMIT;
  const quotaText = usageLabel(usageSummary, defaultQuotaLabel(displayTier, msgCount));
  const expiryText = cookieSession?.expiredAt
    ? `Exp ${new Date(cookieSession.expiredAt).toLocaleDateString("id-ID")}`
    : "Manual expiry";

  /* ── Auth modal ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalToken, setModalToken] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  /* ── Sidebar ── */
  const [sidebarTab, setSidebarTab] = useState<"history"|"ingest">("history");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const topicRef = useRef<HTMLInputElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chatLog]);

  /* ── Auth modal submit ── */
  const handleModalLogin = useCallback(async () => {
    if (!modalToken.trim() || modalLoading) return;
    setModalLoading(true); setModalError("");
    const res = await signIn("credentials", { token: modalToken.trim(), redirect: false });
    if (res?.ok) { setModalOpen(false); setModalToken(""); setModalError(""); }
    else setModalError("Token tidak valid. Akses ditolak.");
    setModalLoading(false);
  }, [modalToken, modalLoading]);

  const updateIngestMetadata = useCallback((field: keyof IngestMetadata, value: string) => {
    setIngestMetadata((current) => ({ ...current, [field]: value }));
  }, []);

  /* ── Ingest handler ── */
  const handleIngest = useCallback(async () => {
    if (!ingestReady) return;
    setIngestState("loading"); setIngestMsg("Menyuntikkan via BFF…");
    try {
      const res = await fetch("/api/secure-ingest", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          content: content.trim(),
          metadata: {
            title: ingestMetadata.title.trim(),
            source: ingestMetadata.source.trim(),
            category: ingestMetadata.category,
            doc_type: ingestMetadata.doc_type,
            owner: ingestMetadata.owner.trim(),
            created_at: ingestMetadata.created_at,
            trust_level: ingestMetadata.trust_level,
            provenance: ingestMetadata.provenance.trim(),
            ...(ingestMetadata.notes.trim() ? { notes: ingestMetadata.notes.trim() } : {}),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      setIngestState("success"); setIngestMsg(`Berhasil (ID: ${data.id?.slice(0,8)}…)`);
      setIngestMetadata(createDefaultIngestMetadata());
      setContent("");
    } catch(e) { setIngestState("error"); setIngestMsg(e instanceof Error ? e.message : "Gagal."); }
    setTimeout(() => { setIngestState("idle"); setIngestMsg(""); }, 4000);
  }, [content, ingestMetadata, ingestReady]);

  /* ── Research SSE handler ── */
  const handleResearch = useCallback(async () => {
    const t = topic.trim();
    if (!t || busy || limitReached) return;
    setChatLog(p => [...p, { id:uid(), type:"query", topic:t, ts:new Date().toISOString() }]);
    setTopic(""); setBusy(true);
    const resultId = uid();
    setChatLog(p => [...p, { id:resultId, type:"result", analysis:"", ts:new Date().toISOString(), streaming:true }]);
    try {
      const res = await fetch("/api/secure-research", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ topic: t, agentMode }),
      });
      const usageHeader = res.headers.get("X-JAGAT-Usage-Summary");
      if (usageHeader) setUsageSummary(JSON.parse(decodeURIComponent(usageHeader)) as UsageSummary);
      if (!res.ok) {
        const d = await res.json().catch(()=>({}));
        if (d.usage) setUsageSummary(d.usage as UsageSummary);
        throw new Error(d.message||`HTTP ${res.status}`);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream null");
      const dec = new TextDecoder(); let buf = "";
      let tokenBuffer = "";
      let flushTimer: number | null = null;
      const flushTokens = () => {
        if (!tokenBuffer) return;
        const chunk = tokenBuffer;
        tokenBuffer = "";
        flushTimer = null;
        setChatLog(p => p.map(e => e.id===resultId ? { ...e, analysis:(e.analysis === "Menyiapkan pipeline riset..." || e.analysis === "Model lokal sedang menghasilkan analisis..." || e.analysis === "Worker inferensi sedang menghasilkan analisis..." ? "" : e.analysis??"")+chunk } : e));
      };
      const appendToken = (chunk: string) => {
        tokenBuffer += chunk;
        if (flushTimer === null) {
          flushTimer = window.setTimeout(flushTokens, 45);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream:true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as { type:string; data:unknown };
            if (evt.type === "status") setChatLog(p => p.map(e => e.id===resultId ? { ...e, analysis: e.analysis || String(evt.data) } : e));
            if (evt.type === "meta") setChatLog(p => p.map(e => e.id===resultId ? { ...e, meta: evt.data as ChatMeta } : e));
            if (evt.type === "token") appendToken(String(evt.data));
            if (evt.type === "done") { flushTokens(); const { timing } = evt.data as { timing:TimingData }; setChatLog(p => p.map(e => e.id===resultId ? { ...e, timing, streaming:false } : e)); }
            if (evt.type === "error") throw new Error(String(evt.data));
          } catch(pe) { if (pe instanceof Error && pe.message !== line.slice(6)) throw pe; }
        }
      }
      flushTokens();
      if (flushTimer !== null) window.clearTimeout(flushTimer);
      setChatLog(p => p.map(e => e.id===resultId ? { ...e, streaming:false } : e));
      setMsgCount(c => c + 1);
    } catch(e) {
      setChatLog(p => p.map(e2 => e2.id===resultId
        ? { ...e2, type:"error" as const, error: e instanceof Error ? e.message : "Gagal.", streaming:false }
        : e2));
    }
    setBusy(false); topicRef.current?.focus();
  }, [topic, busy, limitReached, agentMode]);

  /* ── Render ── */
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">

      {/* ═══ AUTH MODAL ═══ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center"><span className="text-white font-black text-sm">J</span></div>
              <div><p className="text-sm font-bold text-slate-100">Akses Berdaulat</p><p className="text-[11px] text-slate-500 font-mono">Masukkan Sovereign Token</p></div>
            </div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Token Otoritas Intelijen</label>
            <input type="password" value={modalToken} onChange={e => setModalToken(e.target.value)} onKeyDown={e => e.key==="Enter" && handleModalLogin()}
              placeholder="JAGAT-J7-SECURE-2026" autoFocus
              className="w-full px-3 py-2.5 mb-3 bg-slate-800 border border-slate-700/50 rounded-xl text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all" />
            {modalError && <p className="text-xs text-red-400 font-mono mb-3 px-1">⚠ {modalError}</p>}
            <button onClick={handleModalLogin} disabled={!modalToken.trim() || modalLoading}
              className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white disabled:opacity-40 transition-all">
              {modalLoading ? <span className="flex items-center justify-center gap-2"><Spinner /> Memverifikasi…</span> : "🔐 Masuk Sistem"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ SIDEBAR ═══ */}
      <aside className="w-72 flex-shrink-0 border-r border-slate-800/60 flex flex-col bg-slate-950">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-md shadow-emerald-500/20"><span className="text-white font-black text-xs">J</span></div>
            <div><p className="text-xs font-bold text-slate-100">JAGAT G7</p><p className="text-[10px] text-emerald-400 font-mono">Sovereign Intelligence</p></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800/50">
          {(["history","ingest"] as const).map(tab => (
            <button key={tab} onClick={() => setSidebarTab(tab)}
              className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${sidebarTab===tab ? "text-emerald-400 border-b-2 border-emerald-500" : "text-slate-500 hover:text-slate-300"}`}>
              {tab === "history" ? "💬 Riwayat" : "⬆ Ingest"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {sidebarTab === "history" ? (
            <div className="px-3 py-3 space-y-1">
              {chatLog.filter(e => e.type==="query").length === 0
                ? <p className="text-[11px] text-slate-600 text-center py-8">Belum ada sesi riset.</p>
                : chatLog.filter(e => e.type==="query").map(e => (
                  <div key={e.id} className="px-3 py-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/60 cursor-pointer transition-colors">
                    <p className="text-xs text-slate-300 truncate">{e.topic}</p>
                    <p className="text-[10px] text-slate-600 font-mono mt-0.5">{new Date(e.ts).toLocaleTimeString("id-ID")}</p>
                  </div>
                ))
              }
            </div>
          ) : (
            <div className="px-4 py-4 space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Judul</label>
                <input type="text" value={ingestMetadata.title} onChange={e => updateIngestMetadata("title", e.target.value)} placeholder="cth: JAGAT G7 Technical Blueprint"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Kategori</label>
                  <select value={ingestMetadata.category} onChange={e => updateIngestMetadata("category", e.target.value)}
                    className="w-full px-2 py-2 bg-slate-900 border border-slate-700/60 rounded-lg text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500/60 transition-all">
                    {CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Tipe</label>
                  <select value={ingestMetadata.doc_type} onChange={e => updateIngestMetadata("doc_type", e.target.value)}
                    className="w-full px-2 py-2 bg-slate-900 border border-slate-700/60 rounded-lg text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500/60 transition-all">
                    {DOC_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Owner</label>
                <input type="text" value={ingestMetadata.owner} onChange={e => updateIngestMetadata("owner", e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Tanggal</label>
                  <input type="date" value={ingestMetadata.created_at} onChange={e => updateIngestMetadata("created_at", e.target.value)}
                    className="w-full px-2 py-2 bg-slate-900 border border-slate-700/60 rounded-lg text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500/60 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Trust</label>
                  <select value={ingestMetadata.trust_level} onChange={e => updateIngestMetadata("trust_level", e.target.value)}
                    className="w-full px-2 py-2 bg-slate-900 border border-slate-700/60 rounded-lg text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500/60 transition-all">
                    {TRUST_LEVEL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Provenance</label>
                <input type="text" value={ingestMetadata.provenance} onChange={e => updateIngestMetadata("provenance", e.target.value)} placeholder="cth: local upload / founder note"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes Opsional</label>
                <input type="text" value={ingestMetadata.notes} onChange={e => updateIngestMetadata("notes", e.target.value)} placeholder="cth: Milestone versi V5"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Sumber</label>
                <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="cth: BSSN-2026"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Konten Dokumen</label>
                <textarea value={content} onChange={e => setContent(e.target.value)} rows={7} placeholder="Tempel isi dokumen strategis…"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/60 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-all resize-none leading-relaxed" />
              </div>
              <button onClick={handleIngest} disabled={!ingestReady||ingestState==="loading"}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white disabled:opacity-40 transition-all">
                {ingestState==="loading" ? <span className="flex items-center justify-center gap-1.5"><Spinner cls="w-3 h-3"/> Menyuntikkan…</span> : "⬆ Suntik ke Qdrant"}
              </button>
              {ingestState!=="idle" && ingestState!=="loading" && (
                <p className={`text-[11px] rounded-lg px-3 py-2 border ${ingestState==="success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
                  {ingestState==="success" ? "✅" : "❌"} {ingestMsg}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Tier counter */}
        {!isLoggedIn && (
          <div className="flex-shrink-0 border-t border-slate-800/50 px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500 font-mono">Free Tier</span>
              <span className={`text-[10px] font-mono font-semibold ${msgCount>=FREE_LIMIT?"text-red-400":"text-emerald-400"}`}>{msgCount}/{FREE_LIMIT}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${msgCount>=FREE_LIMIT?"bg-red-500":"bg-emerald-500"}`} style={{ width:`${Math.min(100,(msgCount/FREE_LIMIT)*100)}%` }} />
            </div>
          </div>
        )}
      </aside>

      {/* ═══ MAIN CHAT ═══ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60 bg-slate-950/95 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-100">JAGAT Agent Console</span>
            <span className="text-[10px] text-slate-500 font-mono">{agentModeLabel(agentMode)} • SSE • Local/Remote worker • Qdrant</span>
            <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              <span className="text-[10px] font-mono text-emerald-400">ONLINE</span>
            </div>
          </div>
          {/* ── Dynamic User Area ── */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Fragment>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"/>
                  <span className="text-[11px] font-mono text-emerald-300">🟢 G7 {tierLabel} — {displayName.split(" ")[0]}</span>
                </div>
                <div className="hidden items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/5 px-3 py-1.5 md:flex">
                  <span className="text-[10px] font-mono text-cyan-300">Quota: {quotaText} • {expiryText}</span>
                </div>
                <button onClick={handleLogout}
                  className="px-3 py-1.5 rounded-full border border-slate-700/50 text-[10px] font-mono text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all">
                  Keluar
                </button>
              </Fragment>
            ) : (
              <button onClick={() => setModalOpen(true)}
                className="px-3 py-1.5 rounded-full border border-slate-700/50 text-[11px] font-mono text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all">
                🔐 Masuk Sistem
              </button>
            )}
          </div>
        </header>

        <div className="flex-shrink-0 border-b border-slate-800/50 bg-slate-950/80 px-5 py-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {AGENT_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setAgentMode(mode.value)}
                disabled={busy}
                className={`min-h-14 rounded-xl border px-3 py-2 text-left transition-all ${
                  agentMode === mode.value
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-800/70 bg-slate-900/45 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <span className="block text-xs font-bold">{mode.label}</span>
                <span className="mt-0.5 block truncate text-[10px] font-mono opacity-70">{mode.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {chatLog.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-40 text-center select-none">
              <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/10 flex items-center justify-center"><span className="text-3xl">🛡️</span></div>
              <p className="text-sm font-semibold text-slate-400 mb-1">JAGAT G7 siap dalam mode {agentModeLabel(agentMode)}</p>
              <p className="text-xs text-slate-600 max-w-md">Pilih mode agent, lalu masukkan arahan. Jawaban tetap melewati memori, guardrail, dan SSE pipeline JAGAT.</p>
              {!isLoggedIn && <p className="text-[11px] text-amber-500/70 mt-2 font-mono">{FREE_LIMIT - msgCount} pesan tersisa (Free Tier)</p>}
            </div>
          )}

          {chatLog.map(entry => (
            <div key={entry.id} className="animate-fade-in-up">
              {entry.type==="query" && (
                <div className="flex justify-end">
                  <div className="max-w-[70%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-gradient-to-r from-emerald-600/90 to-cyan-600/90 text-white text-sm shadow-lg">
                    <p className="font-medium">{entry.topic}</p>
                    <p className="text-[10px] text-white/50 font-mono mt-0.5">{new Date(entry.ts).toLocaleTimeString("id-ID")}</p>
                  </div>
                </div>
              )}

              {entry.type==="result" && (
                <div className="flex justify-start">
                  <div className="max-w-[88%] space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center"><span className="text-white text-[9px] font-black">J</span></div>
                      <span className="text-[11px] font-semibold text-emerald-400">JAGAT G7 Sentinel</span>
                      {entry.meta && <span className="text-[10px] text-slate-600 font-mono">{agentModeLabel(entry.meta.agentMode)} • {entry.meta.model} • {entry.meta.contextDocumentsUsed} fragmen</span>}
                      {entry.streaming && <span className="text-[10px] text-amber-400 font-mono animate-pulse">● LIVE</span>}
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800/60 rounded-xl px-5 py-4 shadow-xl min-h-12 text-slate-100">
                      <div className="prose-jagat max-w-none text-slate-100 prose-p:text-slate-100 prose-strong:text-white prose-headings:text-white prose-li:text-slate-100 prose-code:text-emerald-200 prose-a:text-cyan-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.analysis ?? ""}</ReactMarkdown>
                        {entry.streaming && <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 align-middle rounded-sm"/>}
                      </div>
                      {!entry.streaming && entry.meta?.contextSources && entry.meta.contextSources.length > 0 && (
                        <CitationPanel sources={entry.meta.contextSources} />
                      )}
                    </div>
                    {entry.timing && !entry.streaming && (
                      <div className="flex flex-wrap gap-1.5">
                        {METRICS.map(m => (
                          <span key={m.key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono ${m.cls}`}>
                            <span className="text-slate-500">{m.label}:</span>{fmtMs(entry.timing![m.key as keyof TimingData])}
                          </span>
                        ))}
                        {entry.meta && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono text-rose-400 border-rose-500/30 bg-rose-500/5"><span className="text-slate-500">Thr:</span>{entry.meta.scoreThresholdApplied}</span>}
                        {entry.meta?.retrievalMode && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono text-emerald-400 border-emerald-500/30 bg-emerald-500/5"><span className="text-slate-500">Ret:</span>{entry.meta.retrievalMode}</span>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {entry.type==="error" && (
                <div className="flex justify-start">
                  <div className="max-w-[70%] px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                    <p className="font-semibold text-red-400 mb-0.5">⚠ Kesalahan</p><p>{entry.error}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef}/>
        </div>

        {/* Free tier gate banner */}
        {limitReached && (
          <div className="flex-shrink-0 mx-5 mb-3 px-4 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-fade-in-up">
            <p className="text-sm font-semibold text-amber-300 mb-0.5">🔒 Limitasi Free Tier Tercapai</p>
            <p className="text-xs text-amber-400/80">Anda telah menggunakan {FREE_LIMIT} pesan. Silakan masuk dengan <span className="font-mono font-bold">Sovereign Token</span> untuk akses tanpa batas.</p>
            <button onClick={() => setModalOpen(true)} className="mt-2.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 transition-all">
              🔐 Masuk Sekarang — Akses Unlimited
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="flex-shrink-0 border-t border-slate-800/50 bg-slate-900/50 px-5 py-3.5">
          <div className="flex gap-3 items-center">
            <input ref={topicRef} type="text" value={topic} onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleResearch()}
              placeholder={limitReached ? "Masuk untuk melanjutkan riset berdaulat…" : "Masukkan topik investigasi riset berdaulat…"}
              disabled={busy || limitReached}
              className="flex-1 px-4 py-2.5 bg-slate-800/70 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-40 transition-all"/>
            <button onClick={handleResearch} disabled={!topic.trim() || busy || limitReached}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-all cursor-pointer">
              {busy ? "Streaming…" : "Kirim ⚡"}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 font-mono mt-2 text-center">
            {isLoggedIn ? `✅ ${tierLabel} • ${displayName.split(" ")[0]} • ${quotaText} • ${expiryText}` : `🔒 Free Tier • ${FREE_LIMIT-msgCount} pesan tersisa`} • Mode {agentModeLabel(agentMode)} • SSE Stream → {pipelineLabel(chatLog.filter((entry) => entry.meta).at(-1)?.meta?.model)} (0.65)
          </p>
        </div>
      </div>
    </div>
  );
}
