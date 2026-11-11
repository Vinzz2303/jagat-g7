"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ── Animated stat counter ──────────────────────────────────────────────────────
function useCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// ── Live terminal ─────────────────────────────────────────────────────────────
const LOGS = [
  { c: "#22C55E", msg: '[OpenClaw] Chat masuk dari Telegram: "cari bounty react"' },
  { c: "#A855F7", msg: "[Router] Intent → JARVIS_MODE. Routing ke ReAct Engine..." },
  { c: "#F59E0B", msg: '[JARVIS] Thinking... Tool call: search_github_bounties("react")' },
  { c: "#06B6D4", msg: "[Gemini] Function resolved. 5 bounties ditemukan." },
  { c: "#EC4899", msg: "[Browser] Membuka github.com/vercel/next.js/issues/60421..." },
  { c: "#22C55E", msg: "[Groq] Halaman diparse. Bug: HydrationError di App Router." },
  { c: "#F97316", msg: "[Ollama/Qwen2.5] Menulis patch untuk HydrationError..." },
  { c: "#F59E0B", msg: "[JARVIS] Patch selesai. Memulai submit_pull_request..." },
  { c: "#6EE7B7", msg: "[GitHub] PR #60449 created — menunggu review maintainer." },
  { c: "#6EE7B7", msg: "[Report] Bounty $250 USDT dikirim → 0x967bE620...55b5 ✓" },
];

function LiveTerminal() {
  const [shown, setShown] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shown >= LOGS.length) { const t = setTimeout(() => setShown(1), 3000); return () => clearTimeout(t); }
    const t = setTimeout(() => setShown(p => p + 1), 900);
    return () => clearTimeout(t);
  }, [shown]);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [shown]);
  return (
    <div ref={ref} className="h-44 overflow-y-auto rounded-xl border border-neutral-800 bg-black/80 p-4 font-mono text-[11px] leading-relaxed" style={{ scrollbarWidth: "none" }}>
      {LOGS.slice(0, shown).map((log, i) => (
        <div key={i} className="flex gap-2" style={{ animation: "fadeSlide .3s ease" }}>
          <span className="shrink-0 text-neutral-600 select-none">›</span>
          <span style={{ color: log.c }}>{log.msg}</span>
        </div>
      ))}
      <span className="inline-block w-1.5 h-3 bg-emerald-400 animate-pulse ml-4" />
    </div>
  );
}

// ── 2D Animated AI Office ─────────────────────────────────────────────────────
const AGENTS = [
  { id: "jarvis",   x: 340, y: 80,  color: "#F59E0B", glow: "#F59E0B40", label: "JARVIS",       sub: "ReAct Manager",  icon: "🧠", taskCycle: ["Planning task...", "Calling tools...", "Reviewing output...", "Delegating..."] },
  { id: "groq",     x: 100, y: 60,  color: "#22C55E", glow: "#22C55E40", label: "Groq LPU",     sub: "Speed Brain",    icon: "⚡", taskCycle: ["Parsing HTML...", "Summarizing...", "Scraping data...", "Extracting..."] },
  { id: "gemini",   x: 580, y: 60,  color: "#06B6D4", glow: "#06B6D440", label: "Gemini API",   sub: "Smart Brain",    icon: "💎", taskCycle: ["Reasoning...", "Planning...", "Function call...", "Analyzing..."] },
  { id: "ollama",   x: 100, y: 220, color: "#F97316", glow: "#F9731640", label: "Ollama",        sub: "Private Coder",  icon: "🔒", taskCycle: ["Writing patch...", "Running tests...", "Debugging...", "Compiling..."] },
  { id: "browser",  x: 580, y: 220, color: "#EC4899", glow: "#EC489940", label: "Browser",       sub: "Web Eyes",       icon: "🌐", taskCycle: ["Navigating...", "Clicking...", "Extracting...", "Scrolling..."] },
  { id: "github",   x: 340, y: 260, color: "#E5E7EB", glow: "#E5E7EB30", label: "GitHub",        sub: "Bounty Hunter",  icon: "🐙", taskCycle: ["Cloning repo...", "Writing PR...", "Pushing code...", "Submitting..."] },
];

const CENTER = { x: 340, y: 165 };

const CONNECTIONS = [
  { from: "jarvis", to: "groq" },
  { from: "jarvis", to: "gemini" },
  { from: "jarvis", to: "ollama" },
  { from: "jarvis", to: "browser" },
  { from: "jarvis", to: "github" },
];

function AgentOffice2D() {
  const [tick, setTick] = useState(0);
  const [activeConn, setActiveConn] = useState(0);
  const [taskTick, setTaskTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 100);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setActiveConn(p => (p + 1) % CONNECTIONS.length), 1600);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setTaskTick(p => p + 1), 2800);
    return () => clearInterval(t);
  }, []);

  const W = 760, H = 360;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 600 }}>
        <defs>
          {/* Grid */}
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1F2937" strokeWidth="0.5" />
          </pattern>
          {/* Glow filters */}
          {AGENTS.map(a => (
            <filter key={a.id} id={`glow-${a.id}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
          {/* Pulse animation */}
          <filter id="center-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Arrow marker */}
          <marker id="arrow-active" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
            <polygon points="0 0, 5 2.5, 0 5" fill="#F59E0B" />
          </marker>
          <marker id="arrow-idle" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
            <polygon points="0 0, 5 2.5, 0 5" fill="#374151" />
          </marker>
        </defs>

        {/* Background */}
        <rect width={W} height={H} fill="#030712" rx="16" />
        <rect width={W} height={H} fill="url(#grid)" rx="16" />

        {/* Ambient glow center */}
        <ellipse cx={CENTER.x} cy={CENTER.y} rx={90} ry={55}
          fill="none" stroke="#A855F730" strokeWidth="1"
          style={{ animation: "none" }}
        />
        <ellipse cx={CENTER.x} cy={CENTER.y} rx={70} ry={42}
          fill="#A855F708"
        />

        {/* CONNECTIONS */}
        {CONNECTIONS.map((conn, i) => {
          const from = AGENTS.find(a => a.id === conn.from)!;
          const to = AGENTS.find(a => a.id === conn.to)!;
          const isActive = activeConn === i;
          const fx = from.x + 52, fy = from.y + 30;
          const tx = to.x + 52, ty = to.y + 30;
          const progress = (tick % 16) / 16;
          const px = fx + (tx - fx) * progress;
          const py = fy + (ty - fy) * progress;
          return (
            <g key={i}>
              <line x1={fx} y1={fy} x2={tx} y2={ty}
                stroke={isActive ? "#F59E0B50" : "#1F2937"}
                strokeWidth={isActive ? 1.5 : 1}
                strokeDasharray={isActive ? "none" : "4,6"}
                markerEnd={isActive ? "url(#arrow-active)" : "url(#arrow-idle)"}
              />
              {isActive && (
                <circle cx={px} cy={py} r={3} fill="#F59E0B"
                  style={{ filter: "drop-shadow(0 0 4px #F59E0B)" }} />
              )}
            </g>
          );
        })}

        {/* CENTER — OpenClaw Router */}
        <g transform={`translate(${CENTER.x - 52}, ${CENTER.y - 32})`}>
          <rect x={0} y={0} width={104} height={64} rx={12}
            fill="#1A0536" stroke="#A855F7" strokeWidth={1.5}
          />
          {/* Pulse rings */}
          <ellipse cx={52} cy={32} rx={48} ry={30}
            fill="none" stroke="#A855F730" strokeWidth={1}
            style={{
              transformOrigin: "52px 32px",
              animation: `pulse-ring ${1.5 + (tick % 2) * 0.1}s ease-out infinite`,
            }}
          />
          <text x={52} y={22} fill="#A855F7" fontSize="11" textAnchor="middle" fontWeight="700">🔀 OpenClaw</text>
          <text x={52} y={36} fill="#C4B5FD" fontSize="8.5" textAnchor="middle">Router · Active</text>
          {/* Activity dots */}
          <circle cx={28} cy={50} r={3} fill={tick % 3 === 0 ? "#A855F7" : "#4C1D95"} />
          <circle cx={40} cy={50} r={3} fill={tick % 3 === 1 ? "#A855F7" : "#4C1D95"} />
          <circle cx={52} cy={50} r={3} fill={tick % 3 === 2 ? "#A855F7" : "#4C1D95"} />
          <circle cx={64} cy={50} r={3} fill={tick % 5 === 0 ? "#7C3AED" : "#4C1D95"} />
          <circle cx={76} cy={50} r={3} fill={tick % 5 === 1 ? "#7C3AED" : "#4C1D95"} />
        </g>

        {/* AGENT WORKSTATIONS */}
        {AGENTS.map((agent) => {
          const isActive = CONNECTIONS[activeConn]?.to === agent.id || CONNECTIONS[activeConn]?.from === agent.id;
          const currentTask = agent.taskCycle[taskTick % agent.taskCycle.length];
          return (
            <g key={agent.id} transform={`translate(${agent.x}, ${agent.y})`}>
              {/* Workstation glow */}
              {isActive && (
                <rect x={-4} y={-4} width={112} height={78} rx={14}
                  fill={agent.glow} style={{ filter: `blur(8px)` }} />
              )}
              {/* Workstation card */}
              <rect x={0} y={0} width={104} height={70} rx={10}
                fill={isActive ? "#0F172A" : "#080F1E"}
                stroke={isActive ? agent.color : "#1E293B"}
                strokeWidth={isActive ? 1.5 : 1}
              />
              {/* Monitor */}
              <rect x={8} y={8} width={60} height={36} rx={4}
                fill="#0A0A0A" stroke={isActive ? agent.color + "60" : "#1F2937"} strokeWidth={1}
              />
              {/* Screen content — animated lines */}
              {[0, 1, 2, 3].map(row => (
                <rect key={row}
                  x={12} y={12 + row * 7}
                  width={isActive ? (30 + ((tick + row * 5) % 22)) : (20 + row * 4)}
                  height={4} rx={2}
                  fill={isActive ? agent.color + "90" : "#1F2937"}
                  style={{ transition: "width 0.3s ease" }}
                />
              ))}
              {/* Agent icon */}
              <text x={78} y={30} fontSize="18" textAnchor="middle">{agent.icon}</text>
              {/* Agent label */}
              <text x={52} y={52} fill={isActive ? agent.color : "#64748B"}
                fontSize="8" textAnchor="middle" fontWeight="700">
                {agent.label}
              </text>
              <text x={52} y={62} fill={isActive ? "#94A3B8" : "#334155"}
                fontSize="7" textAnchor="middle">
                {isActive ? currentTask : agent.sub}
              </text>
              {/* Status indicator */}
              <circle cx={94} cy={8} r={3.5}
                fill={isActive ? agent.color : "#1E3A2F"}
                style={{ filter: isActive ? `drop-shadow(0 0 4px ${agent.color})` : "none" }}
              />
            </g>
          );
        })}

        {/* Telegram input pill — top */}
        <g transform={`translate(${CENTER.x - 60}, 10)`}>
          <rect x={0} y={0} width={120} height={28} rx={14}
            fill="#172554" stroke="#3B82F680" strokeWidth={1}
          />
          <circle cx={16} cy={14} r={5} fill="#3B82F6"
            style={{ filter: "drop-shadow(0 0 4px #3B82F6)" }}
          />
          <text x={26} y={18} fill="#93C5FD" fontSize="8.5" fontWeight="600">📱 Telegram Input</text>
        </g>

        {/* USDT output pill — bottom */}
        <g transform={`translate(${CENTER.x - 55}, ${H - 38})`}>
          <rect x={0} y={0} width={110} height={28} rx={14}
            fill="#052e16" stroke="#22C55E80" strokeWidth={1}
          />
          <circle cx={16} cy={14} r={5} fill="#22C55E"
            style={{ filter: "drop-shadow(0 0 4px #22C55E)" }}
          />
          <text x={26} y={18} fill="#86EFAC" fontSize="8.5" fontWeight="600">💰 USDT Payout</text>
        </g>

        {/* VPS label */}
        <text x={W - 10} y={H - 8} fill="#1F2937" fontSize="8" textAnchor="end" fontFamily="monospace">
          VPS: 103.190.0.113 · Ryzen 5 3600 · 32GB RAM
        </text>
      </svg>

      <style jsx global>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function AnimStat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const count = useCounter(value);
  return (
    <div className="text-center">
      <div className="text-2xl font-black tracking-tight text-white">
        {count.toLocaleString()}<span className="text-emerald-400">{suffix}</span>
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{label}</div>
    </div>
  );
}

// ── Capability Card ───────────────────────────────────────────────────────────
function CapCard({ icon, title, desc, color }: { icon: string; title: string; desc: string; color: string }) {
  return (
    <div className="group rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 transition-all duration-300 hover:border-neutral-700 hover:-translate-y-0.5">
      <div className="mb-3 text-xl">{icon}</div>
      <h3 className="mb-1.5 text-[14px] font-semibold text-white">{title}</h3>
      <p className="text-[12px] leading-relaxed text-neutral-500">{desc}</p>
      <div className="mt-3 h-0.5 w-6 rounded-full transition-all duration-300 group-hover:w-14" style={{ backgroundColor: color }} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function JagatHomePage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-emerald-400/30">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-black text-[15px] tracking-tight">JAGAT<span className="text-emerald-400"> G7</span></span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[12px] text-neutral-500">
            <span className="px-3 py-1.5 hover:text-white transition-colors cursor-pointer">Arsitektur</span>
            <span className="px-3 py-1.5 hover:text-white transition-colors cursor-pointer">Log</span>
          </div>
          <Link href="/console" className="rounded-full bg-emerald-500 px-4 py-1.5 text-[13px] font-bold text-black transition-all hover:bg-emerald-400 active:scale-[0.97]">
            Console →
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden px-5 pt-20 pb-10 text-center">
        {/* Grid */}
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.035]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        {/* Glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/8 blur-3xl" />

        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3.5 py-1 mb-6">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-medium text-neutral-400">JAGAT JARVIS — Autonomous AI Colony · Online 24h</span>
        </div>

        <h1 className="mx-auto max-w-4xl text-[40px] font-black tracking-[-0.04em] leading-[1.05] sm:text-[60px] lg:text-[76px]">
          Kantor AI yang<br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            Tidak Pernah Tidur.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-400">
          Setiap agen di bawah bekerja 24 jam atas nama Anda. Dari Telegram → JARVIS → GitHub → USDT ke dompet Anda.
          Otomatis. Tanpa intervensi.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/console" className="group flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-[13px] font-bold text-black transition-all hover:bg-neutral-100 active:scale-[0.97]">
            Buka Console <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
          <Link href="/colony" className="flex items-center gap-2 rounded-full border border-neutral-700 px-6 py-2.5 text-[13px] font-medium text-neutral-400 hover:border-neutral-500 hover:text-white transition-all">
            Lihat Colony
          </Link>
        </div>
      </section>

      {/* ── 2D OFFICE ANIMATION ── */}
      <section className="px-5 py-4 pb-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 text-center">
            <span className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              AI Colony Live Map
            </span>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-2 sm:p-4 shadow-2xl">
            <AgentOffice2D />
          </div>
          {/* Legend */}
          <div className="mt-4 flex flex-wrap justify-center gap-3 text-[11px]">
            {[
              { color: "#A855F7", label: "OpenClaw — Router" },
              { color: "#F59E0B", label: "JARVIS — Manager" },
              { color: "#22C55E", label: "Groq — Speed" },
              { color: "#06B6D4", label: "Gemini — Smart" },
              { color: "#F97316", label: "Ollama — Private" },
              { color: "#EC4899", label: "Browser — Eyes" },
              { color: "#E5E7EB", label: "GitHub — Bounty" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5 text-neutral-500">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-t border-neutral-800/60 px-5 py-10">
        <div className="mx-auto max-w-lg grid grid-cols-3 divide-x divide-neutral-800 rounded-2xl border border-neutral-800 bg-neutral-900/40 py-6">
          <AnimStat value={7} suffix=" AI" label="LLM Aktif" />
          <AnimStat value={24} suffix="h" label="Uptime" />
          <AnimStat value={100} suffix="%" label="On-Premise" />
        </div>
      </section>

      {/* ── LIVE TERMINAL ── */}
      <section className="border-t border-neutral-800/60 px-5 py-16">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 text-center">
            <span className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Live Demo</span>
          </div>
          <h2 className="mb-2 text-center text-[24px] font-bold tracking-tight">JARVIS Berburu Bounty</h2>
          <p className="mb-6 text-center text-[13px] text-neutral-500">Simulasi real-time sesi bounty hunting dari Telegram sampai USDT.</p>
          <LiveTerminal />
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <section className="border-t border-neutral-800/60 px-5 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-[24px] font-bold tracking-tight">Apa yang Colony Bisa Lakukan</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CapCard icon="🧠" title="ReAct Loop" desc="Berpikir → Bertindak → Observasi. Loop otonom sampai tugas selesai." color="#F59E0B" />
            <CapCard icon="🌐" title="Browse Web" desc="Puppeteer headless + Groq untuk membaca, klik, dan ekstrak data." color="#22C55E" />
            <CapCard icon="💰" title="GitHub Bounty" desc="Cari issue, clone repo, tulis patch, submit PR dengan USDT otomatis." color="#6EE7B7" />
            <CapCard icon="🔒" title="100% Lokal" desc="Ollama berjalan di VPS. Data tidak pernah keluar. Zero leakage." color="#F97316" />
            <CapCard icon="⚡" title="Multi-LLM" desc="Groq → kecepatan. Gemini → kecerdasan. Ollama → privasi. Auto-switch." color="#06B6D4" />
            <CapCard icon="📱" title="Telegram UI" desc="Perintah natural language dari HP. Colony bekerja, Anda istirahat." color="#A855F7" />
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-t border-neutral-800/60 px-5 py-20 text-center">
        <h2 className="text-[28px] font-bold tracking-tight sm:text-[38px]">
          Ketik Perintah di Telegram.<br />
          <span className="text-neutral-500">Uang Masuk ke Dompet Anda.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[14px] text-neutral-500">
          Biarkan Colony bekerja 24 jam. Anda hanya perlu memberi perintah.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/console" className="rounded-full bg-emerald-500 px-7 py-3 text-[13px] font-bold text-black hover:bg-emerald-400 transition-all">
            Buka Console →
          </Link>
          <Link href="/colony" className="rounded-full border border-neutral-700 px-7 py-3 text-[13px] font-medium text-neutral-400 hover:text-white hover:border-neutral-600 transition-all">
            Colony Dashboard
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-neutral-800 py-7 px-5 text-center text-[12px] text-neutral-600">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          <span className="font-bold text-neutral-400">JAGAT G7</span>
          <span>Sovereign AGI Colony</span>
          <span>by Faturachman Al Kahfi</span>
          <span>VPS 103.190.0.113</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}
