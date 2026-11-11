"use client";

import React, { useEffect, useRef } from "react";
import { motion, useAnimationControls, AnimatePresence } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────
export type AgentStatus = "idle" | "working" | "done";

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  color: string;       // primary glow color
  accentColor: string; // secondary color
  emoji: string;       // avatar emoji for character
  status: AgentStatus;
}

interface AgentCardProps {
  agent: AgentConfig;
  style?: React.CSSProperties;
}

// ── SVG Avatar Characters (unique per agent) ─────────────────────────────────
const AVATARS: Record<string, React.ReactNode> = {
  openclaw: (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      {/* Brain/Neural core agent */}
      <circle cx="20" cy="20" r="14" fill="url(#brainGrad)" opacity="0.9"/>
      <circle cx="20" cy="20" r="10" fill="none" stroke="rgba(139,92,246,0.6)" strokeWidth="1"/>
      {/* Neural paths */}
      <path d="M14 20 Q17 15 20 18 Q23 15 26 20" stroke="rgba(167,139,250,0.9)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M14 22 Q17 27 20 24 Q23 27 26 22" stroke="rgba(167,139,250,0.9)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <circle cx="20" cy="20" r="3" fill="#A78BFA"/>
      <circle cx="14" cy="20" r="2" fill="#7C3AED"/>
      <circle cx="26" cy="20" r="2" fill="#7C3AED"/>
      <defs>
        <radialGradient id="brainGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#4C1D95" stopOpacity="0.2"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  miner: (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      {/* Search/Mine agent */}
      <circle cx="17" cy="17" r="10" fill="url(#minerGrad)" opacity="0.85"/>
      <circle cx="17" cy="17" r="6" fill="none" stroke="rgba(6,182,212,0.7)" strokeWidth="1.5"/>
      {/* Search icon inside */}
      <circle cx="17" cy="17" r="3" fill="rgba(6,182,212,0.5)" stroke="#22D3EE" strokeWidth="1"/>
      <line x1="22" y1="22" x2="28" y2="28" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Data particles */}
      <circle cx="10" cy="11" r="1.5" fill="#06B6D4" opacity="0.7"/>
      <circle cx="28" cy="14" r="1" fill="#06B6D4" opacity="0.5"/>
      <circle cx="8" cy="28" r="1" fill="#06B6D4" opacity="0.4"/>
      <defs>
        <radialGradient id="minerGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#0E7490" stopOpacity="0.6"/>
          <stop offset="100%" stopColor="#164E63" stopOpacity="0.2"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  copywriter: (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      {/* Pen/Write agent */}
      <rect x="8" y="10" width="24" height="20" rx="3" fill="url(#writerGrad)" opacity="0.8"/>
      {/* Lines of text */}
      <line x1="12" y1="16" x2="28" y2="16" stroke="rgba(251,191,36,0.8)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="20" x2="24" y2="20" stroke="rgba(251,191,36,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="24" x2="26" y2="24" stroke="rgba(251,191,36,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Pen tip */}
      <path d="M30 8 L34 12 L24 22 L20 22 L20 18 Z" fill="#FBBF24" opacity="0.9"/>
      <defs>
        <radialGradient id="writerGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#92400E" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#78350F" stopOpacity="0.2"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  dispatcher: (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      {/* Telegram/Send agent */}
      <circle cx="20" cy="20" r="14" fill="url(#teleGrad)" opacity="0.8"/>
      {/* Telegram plane icon */}
      <path d="M8 20 L32 12 L26 30 L19 24 Z" fill="rgba(56,189,248,0.9)" stroke="#0EA5E9" strokeWidth="0.5"/>
      <path d="M19 24 L18 32 L22 27" fill="rgba(56,189,248,0.7)"/>
      {/* Signal rings */}
      <circle cx="32" cy="12" r="2" fill="#38BDF8" opacity="0.8"/>
      <defs>
        <radialGradient id="teleGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#0369A1" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#075985" stopOpacity="0.2"/>
        </radialGradient>
      </defs>
    </svg>
  ),
  analyst: (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
      {/* Chart/Analytics agent */}
      <rect x="6" y="6" width="28" height="28" rx="4" fill="url(#chartGrad)" opacity="0.8"/>
      {/* Bar chart */}
      <rect x="10" y="20" width="5" height="12" rx="1" fill="rgba(52,211,153,0.7)"/>
      <rect x="17.5" y="14" width="5" height="18" rx="1" fill="rgba(52,211,153,0.9)"/>
      <rect x="25" y="17" width="5" height="15" rx="1" fill="rgba(52,211,153,0.6)"/>
      {/* Trend line */}
      <path d="M10 26 L20 20 L30 14" stroke="#34D399" strokeWidth="1.5" fill="none" strokeDasharray="2 1"/>
      <circle cx="30" cy="14" r="2" fill="#34D399"/>
      <defs>
        <radialGradient id="chartGrad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#065F46" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#064E3B" stopOpacity="0.2"/>
        </radialGradient>
      </defs>
    </svg>
  ),
};

// ── Particle Ring (orbiting around working agents) ───────────────────────────
function OrbitParticle({ color, radius, duration, delay }: {
  color: string; radius: number; duration: number; delay: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: 5, height: 5,
        backgroundColor: color,
        boxShadow: `0 0 6px ${color}`,
        top: "50%", left: "50%",
        marginTop: -2.5, marginLeft: -2.5,
      }}
      animate={{
        x: [
          Math.cos(0) * radius, Math.cos(Math.PI / 2) * radius,
          Math.cos(Math.PI) * radius, Math.cos(3 * Math.PI / 2) * radius,
          Math.cos(2 * Math.PI) * radius,
        ],
        y: [
          Math.sin(0) * radius, Math.sin(Math.PI / 2) * radius,
          Math.sin(Math.PI) * radius, Math.sin(3 * Math.PI / 2) * radius,
          Math.sin(2 * Math.PI) * radius,
        ],
        opacity: [0.8, 1, 0.8, 1, 0.8],
      }}
      transition={{ duration, repeat: Infinity, delay, ease: "linear" }}
    />
  );
}

// ── Floating Data Packet (flying between agents) ─────────────────────────────
function DataPacket({ color }: { color: string }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full pointer-events-none z-20"
      style={{ backgroundColor: color, boxShadow: `0 0 8px 2px ${color}`, top: "50%", left: "50%" }}
      animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ── Typing Animation (shows for "working" agents) ────────────────────────────
function TypingDots({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-1 h-1 rounded-full"
          style={{ backgroundColor: color }}
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ── Agent Status Label ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AgentStatus, { label: string; className: string }> = {
  idle:    { label: "IDLE",    className: "text-slate-500 bg-slate-800/60" },
  working: { label: "WORKING", className: "text-emerald-300 bg-emerald-900/60" },
  done:    { label: "DONE",    className: "text-sky-300 bg-sky-900/60" },
};

// ── Main Agent Card ──────────────────────────────────────────────────────────
export function AgentCard({ agent, style }: AgentCardProps) {
  const controls = useAnimationControls();
  const prevStatus = useRef<AgentStatus>(agent.status);

  // Pulse on status change
  useEffect(() => {
    if (prevStatus.current !== agent.status) {
      controls.start({
        scale: [1, 1.04, 1],
        transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] },
      });
      prevStatus.current = agent.status;
    }
  }, [agent.status, controls]);

  const isWorking = agent.status === "working";
  const isDone = agent.status === "done";
  const { label, className: statusCls } = STATUS_CONFIG[agent.status];

  return (
    <motion.div
      animate={controls}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      style={style}
      className="absolute"
    >
      {/* Outer glow ring — pulsates when working */}
      {isWorking && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: `0 0 0 1px ${agent.color}40, 0 0 30px 4px ${agent.color}20` }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Double-Bezel outer shell */}
      <div
        className="rounded-2xl p-[1.5px]"
        style={{
          background: isWorking
            ? `linear-gradient(135deg, ${agent.color}60 0%, transparent 50%, ${agent.accentColor}40 100%)`
            : `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`,
        }}
      >
        {/* Inner card */}
        <div
          className="relative w-[200px] rounded-[calc(1rem-1.5px)] overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #0E0E18 0%, #090912 100%)",
            boxShadow: `inset 0 1px 1px rgba(255,255,255,0.06)`,
          }}
        >
          {/* Top strip — agent color accent */}
          <div
            className="h-[2px] w-full"
            style={{ background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)` }}
          />

          <div className="p-4">
            {/* Avatar + status row */}
            <div className="flex items-start justify-between mb-3">
              {/* Avatar circle with orbit particles */}
              <div className="relative w-12 h-12 shrink-0">
                {/* Glow beneath avatar */}
                <div
                  className="absolute inset-0 rounded-full blur-md opacity-60"
                  style={{ backgroundColor: agent.color }}
                />
                {/* Avatar container */}
                <div
                  className="relative w-full h-full rounded-full flex items-center justify-center overflow-hidden"
                  style={{
                    background: `radial-gradient(circle at 40% 35%, ${agent.color}40, ${agent.color}10)`,
                    border: `1px solid ${agent.color}50`,
                  }}
                >
                  <div className="w-9 h-9">
                    {AVATARS[agent.id]}
                  </div>
                </div>

                {/* Status dot */}
                <div className="absolute -bottom-0.5 -right-0.5">
                  <div
                    className="w-3 h-3 rounded-full border-2 border-[#090912]"
                    style={{
                      backgroundColor: isWorking ? "#34D399" : isDone ? "#60A5FA" : "#475569",
                      boxShadow: isWorking ? "0 0 6px #34D399" : "none",
                    }}
                  />
                  {isWorking && (
                    <motion.div
                      className="absolute inset-0 rounded-full bg-emerald-400"
                      animate={{ scale: [1, 2], opacity: [0.6, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </div>

                {/* Orbit particles when working */}
                {isWorking && (
                  <>
                    <OrbitParticle color={agent.color} radius={30} duration={2.5} delay={0} />
                    <OrbitParticle color={agent.accentColor} radius={28} duration={3.5} delay={1.2} />
                  </>
                )}
              </div>

              {/* Status badge */}
              <span className={`text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full ${statusCls}`}>
                {label}
              </span>
            </div>

            {/* Agent name */}
            <h3
              className="text-[13px] font-semibold leading-tight mb-0.5"
              style={{ color: isWorking ? agent.color : "#E2E8F0" }}
            >
              {agent.name}
            </h3>
            <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
              {agent.role}
            </p>

            {/* Activity indicator */}
            <div
              className="rounded-lg px-2.5 py-2 flex items-center gap-2"
              style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {isWorking ? (
                <>
                  <TypingDots color={agent.color} />
                  <span className="text-[10px] text-slate-400 truncate">{agent.description}</span>
                </>
              ) : isDone ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  <span className="text-[10px] text-sky-400/80 truncate">Task completed</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                  <span className="text-[10px] text-slate-600 truncate">Waiting for task...</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
