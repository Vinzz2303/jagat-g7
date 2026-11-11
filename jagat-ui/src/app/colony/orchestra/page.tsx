"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OrchestraCanvas } from "../../../components/orchestra/OrchestraCanvas";

// ── Types ────────────────────────────────────────────────────────────────────
interface ProspectStats {
  totalLeads: number;
  sentLeads: number;
  newLeads: number;
  respondedLeads: number;
  nicheBreakdown: Record<string, number>;
}

interface ActivityEvent {
  id: string;
  time: string;
  agent: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

const AGENT_COLORS: Record<string, string> = {
  "JAGAT Router": "#A78BFA",
  "JAGAT Bot": "#A78BFA",
  "Prospect Miner": "#22D3EE",
  "Tings Analyst": "#34D399",
  "Telegram Dispatcher": "#38BDF8",
  "Copywriter": "#FBBF24",
  "Auth Layer": "#94A3B8",
  "System": "#64748B",
};

const EVENT_ICONS: Record<string, string> = {
  success: "●",
  warning: "◐",
  error: "○",
  info: "◉",
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color, loading
}: {
  label: string; value: number | string; sub?: string; color: string; loading?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-[1px]"
      style={{ background: `linear-gradient(135deg, ${color}30, transparent 60%)` }}
    >
      <div
        className="rounded-[calc(0.75rem-1px)] p-4"
        style={{ background: "linear-gradient(145deg, #0C0C1E 0%, #080812 100%)" }}
      >
        <p className="text-[10px] font-mono tracking-[0.15em] uppercase mb-2" style={{ color: `${color}80` }}>
          {label}
        </p>
        {loading ? (
          <div className="h-7 w-16 rounded bg-white/5 animate-pulse" />
        ) : (
          <motion.p
            className="text-3xl font-bold tracking-tight"
            style={{ color }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          >
            {value}
          </motion.p>
        )}
        {sub && !loading && (
          <p className="text-[10px] mt-1" style={{ color: `${color}50` }}>{sub}</p>
        )}
      </div>
    </div>
  );
}

// ── Activity Item ──────────────────────────────────────────────────────────
function ActivityItem({ event, index }: { event: ActivityEvent; index: number }) {
  const color = AGENT_COLORS[event.agent] ?? "#64748B";
  const icon = EVENT_ICONS[event.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="flex gap-3 py-3 border-b last:border-0"
      style={{ borderColor: "rgba(255,255,255,0.04)" }}
    >
      <div className="flex flex-col items-center gap-1 shrink-0">
        <span className="text-[11px]" style={{ color }}>{icon}</span>
        {index !== 0 && <div className="w-px flex-1 min-h-[12px]" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[11px] font-semibold font-mono" style={{ color }}>{event.agent}</span>
          <span className="text-[9px] font-mono shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>
            {relativeTime(event.time)}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
          {event.message}
        </p>
      </div>
    </motion.div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function OrchestraDashboard() {
  const [isRunning, setIsRunning] = useState(true);
  const [stats, setStats] = useState<ProspectStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/orchestra-stats", { cache: "no-store" });
      if (res.ok) setStats(await res.json());
    } catch { /* noop */ } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/orchestra-activity", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setActivities(data.events?.slice(0, 10) ?? []);
        setLastRefresh(new Date());
      }
    } catch { /* noop */ } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchActivity();
    const si = setInterval(fetchStats, 60_000);
    const ai = setInterval(fetchActivity, 30_000);
    return () => { clearInterval(si); clearInterval(ai); };
  }, [fetchStats, fetchActivity]);

  const topNiche = stats?.nicheBreakdown
    ? Object.entries(stats.nicheBreakdown).sort(([, a], [, b]) => b - a)[0]
    : null;

  return (
    <div
      className="min-h-screen text-white selection:bg-violet-500/30"
      style={{
        background: "linear-gradient(145deg, #04040F 0%, #060614 50%, #050510 100%)",
        fontFamily: "'Plus Jakarta Sans', 'Geist', system-ui, sans-serif",
      }}
    >
      {/* CSS noise grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Navbar ── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-8 h-[60px]"
        style={{
          background: "rgba(4,4,15,0.85)",
          backdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}
          >
            ⚡
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-tight">JAGAT Agent Orchestra</div>
            <div className="text-[9px] font-mono tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
              Autonomous Revenue Swarm
            </div>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3">
          {/* Last refresh */}
          <button
            onClick={() => { setStatsLoading(true); fetchStats(); fetchActivity(); }}
            className="flex items-center gap-1.5 text-[10px] font-mono transition-opacity hover:opacity-100 opacity-40"
            style={{ color: "rgba(255,255,255,0.8)" }}
          >
            ↻ {relativeTime(lastRefresh.toISOString())}
          </button>

          {/* Telegram badge */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono"
            style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", color: "#38BDF8" }}
          >
            <span>✈</span> Telegram Online
          </div>

          {/* Swarm toggle */}
          <motion.button
            onClick={() => setIsRunning(r => !r)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-semibold"
            style={{
              background: isRunning
                ? "linear-gradient(135deg, rgba(124,58,237,0.3) 0%, rgba(79,70,229,0.3) 100%)"
                : "rgba(255,255,255,0.05)",
              border: isRunning ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: isRunning ? "#A78BFA" : "rgba(255,255,255,0.4)",
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {isRunning ? (
              <><motion.span animate={{ opacity: [0.5,1,0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>●</motion.span> Swarm Active</>
            ) : (
              <><span>▷</span> Start Swarm</>
            )}
          </motion.button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-[1440px] mx-auto px-8 py-8">

        {/* Section label */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(124,58,237,0.3), transparent)" }} />
          <span className="text-[9px] font-mono tracking-[0.25em] uppercase" style={{ color: "rgba(167,139,250,0.6)" }}>
            ◉ Live Neural Map — {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.3))" }} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">

          {/* ── LEFT: Canvas ── */}
          <div className="flex flex-col gap-6">
            <OrchestraCanvas activities={activities} />

            {/* ── Stats row ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Total Leads"
                value={stats?.totalLeads ?? 0}
                color="#A78BFA"
                loading={statsLoading}
                sub="From CSV tracker"
              />
              <StatCard
                label="Tele Sent"
                value={stats?.sentLeads ?? 0}
                color="#38BDF8"
                loading={statsLoading}
                sub="botJagat dispatched"
              />
              <StatCard
                label="New Queue"
                value={stats?.newLeads ?? 0}
                color="#FBBF24"
                loading={statsLoading}
                sub="Awaiting dispatch"
              />
              <StatCard
                label="Top Niche"
                value={topNiche ? topNiche[1] : "—"}
                color="#34D399"
                loading={statsLoading}
                sub={topNiche ? topNiche[0].replace(/-/g, " ") : "scanning..."}
              />
            </div>
          </div>

          {/* ── RIGHT: Activity + Agent Roster ── */}
          <div className="flex flex-col gap-4">

            {/* Agent roster mini */}
            <div
              className="rounded-2xl p-[1px]"
              style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.1), transparent)" }}
            >
              <div
                className="rounded-[calc(1rem-1px)] p-4"
                style={{ background: "linear-gradient(145deg, #0A0A1C 0%, #080812 100%)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono tracking-[0.2em] uppercase" style={{ color: "rgba(167,139,250,0.6)" }}>
                    ◈ Agent Roster
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.1)", color: "#34D399" }}>
                    5 ACTIVE
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    { id: "jagat_router", name: "JAGAT Router", role: "Orchestrator", color: "#A78BFA", icon: "🧠" },
                    { id: "miner", name: "Prospect Miner", role: "Lead Intel", color: "#22D3EE", icon: "🔍" },
                    { id: "copywriter", name: "Copywriter", role: "Persuasion", color: "#FBBF24", icon: "✍️" },
                    { id: "dispatcher", name: "Tele Dispatcher", role: "Delivery Net", color: "#38BDF8", icon: "✈️" },
                    { id: "analyst", name: "Tings Analyst", role: "Market Intel", color: "#34D399", icon: "📊" },
                  ].map((agent, i) => (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07, duration: 0.4 }}
                      className="flex items-center gap-3 p-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ background: `${agent.color}15`, border: `1px solid ${agent.color}30` }}
                      >
                        {agent.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold truncate" style={{ color: agent.color }}>{agent.name}</p>
                        <p className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>{agent.role}</p>
                      </div>
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: "#34D399", boxShadow: "0 0 6px #34D399" }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2 + i * 0.3, repeat: Infinity }}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity feed */}
            <div
              className="rounded-2xl p-[1px] flex-1"
              style={{ background: "linear-gradient(135deg, rgba(56,189,248,0.1), rgba(79,70,229,0.1), transparent)" }}
            >
              <div
                className="rounded-[calc(1rem-1px)] p-4 flex flex-col h-full"
                style={{ background: "linear-gradient(145deg, #0A0A1C 0%, #080812 100%)", minHeight: 280 }}
              >
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <span className="text-[10px] font-mono tracking-[0.2em] uppercase" style={{ color: "rgba(56,189,248,0.6)" }}>
                    ◉ Bot Activity — PM2 Live
                  </span>
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-sky-400"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-0 scrollbar-none">
                  {activityLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex gap-3 py-3 animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-white/10 mt-1 shrink-0" />
                        <div className="flex-1 space-y-1">
                          <div className="h-2.5 bg-white/10 rounded w-24" />
                          <div className="h-2.5 bg-white/5 rounded w-full" />
                        </div>
                      </div>
                    ))
                  ) : activities.length > 0 ? (
                    <AnimatePresence>
                      {activities.map((ev, i) => (
                        <ActivityItem key={ev.id || i} event={ev} index={i} />
                      ))}
                    </AnimatePresence>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-[12px] font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>
                        Bot standby...
                      </p>
                      <p className="text-[10px] mt-1 font-mono" style={{ color: "rgba(255,255,255,0.08)" }}>
                        Send command via Telegram to see activity
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer watermark ── */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <div className="h-px w-16" style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.3))" }} />
          <p className="text-[9px] font-mono tracking-[0.25em]" style={{ color: "rgba(255,255,255,0.1)" }}>
            JAGAT G7 SOVEREIGN INTELLIGENCE — BUILT BY FATURACHMAN AL KAHFI
          </p>
          <div className="h-px w-16" style={{ background: "linear-gradient(90deg, rgba(124,58,237,0.3), transparent)" }} />
        </div>
      </main>
    </div>
  );
}

