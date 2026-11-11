"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";

// ── Types ────────────────────────────────────────────────────────────────────
export type AgentState = "lounge" | "desk" | "door";

export interface AgentSim {
  id: string;
  name: string;
  color: string;
  state: AgentState;
  x: number;
  y: number;
  facing: "left" | "right" | "up" | "down";
}

// ── Environment Coordinates (Relative to 900x580 canvas) ─────────────────────
const LOCATIONS = {
  door: { x: -20, y: 250 },
  lounge: { x: 750, y: 80 },
  desks: {
    "jagat_router": { x: 400, y: 120 },
    miner: { x: 250, y: 350 },
    copywriter: { x: 450, y: 350 },
    analyst: { x: 650, y: 350 },
    dispatcher: { x: 450, y: 450 },
  }
};

// ── Helper: Random position around a center point
function randomNear(center: { x: number, y: number }, radius: number) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.random() * radius;
  return {
    x: center.x + Math.cos(angle) * r,
    y: center.y + Math.sin(angle) * r
  };
}

function getFacingDirection(fromX: number, fromY: number, toX: number, toY: number): "left" | "right" | "up" | "down" {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  } else {
    return dy > 0 ? "down" : "up";
  }
}

// ── Top-Down Agent Sprite ────────────────────────────────────────────────────
function AgentSprite({ agent }: { agent: AgentSim }) {
  const isWorking = agent.state === "desk";
  const isLeft = agent.facing === "left";
  const isRight = agent.facing === "right";
  const isUp = agent.facing === "up";

  // When sitting at desk (up), push head slightly up
  const headY = isUp ? -6 : isWorking ? 2 : 0;
  const headX = isRight ? 4 : isLeft ? -4 : 0;

  return (
    <motion.div
      className="absolute flex flex-col items-center justify-center pointer-events-none"
      style={{
        width: 40, height: 40,
        marginLeft: -20, marginTop: -20, // center on coordinate
        zIndex: agent.y // fake depth sorting
      }}
      animate={{ x: agent.x, y: agent.y, opacity: agent.state === "door" ? 0 : 1 }}
      transition={{ type: "spring", stiffness: 40, damping: 12 }} // smooth walking
    >
      {/* Name tag */}
      <motion.div
        className="absolute -top-6 whitespace-nowrap text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-lg"
        style={{
          backgroundColor: `${agent.color}30`,
          color: agent.color,
          border: `1px solid ${agent.color}50`
        }}
        animate={{ opacity: agent.state === "door" ? 0 : 1 }}
      >
        {agent.name}
      </motion.div>

      {/* Body / Shoulders (Top-down view) */}
      <motion.div
        className="absolute w-8 h-5 rounded-full"
        style={{ backgroundColor: `${agent.color}80`, border: `1px solid ${agent.color}` }}
        animate={{
          rotate: isRight ? 90 : isLeft ? -90 : 0,
          scaleX: (isRight || isLeft) ? 0.8 : 1
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Head */}
      <motion.div
        className="absolute w-5 h-5 rounded-full shadow-lg"
        style={{ backgroundColor: "#E2E8F0", border: `2px solid ${agent.color}` }}
        animate={{ x: headX, y: headY }}
        transition={{ duration: 0.3 }}
      />

      {/* Typing Particles (Only when working at desk) */}
      {isWorking && (
        <motion.div
          className="absolute -top-3 w-1 h-1 rounded-full bg-emerald-400"
          animate={{ y: [0, -10], opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeOut" }}
          style={{ boxShadow: "0 0 4px #34D399" }}
        />
      )}
    </motion.div>
  );
}

// ── Environment Props ────────────────────────────────────────────────────────
function Desk({ x, y, color, label }: { x: number; y: number; color: string; label: string }) {
  return (
    <div
      className="absolute flex flex-col items-center justify-center"
      style={{
        left: x, top: y,
        width: 80, height: 60,
        marginLeft: -40, marginTop: -30,
        border: `1px solid rgba(255,255,255,0.1)`,
        backgroundColor: "rgba(255,255,255,0.02)",
        borderRadius: 8,
        borderBottom: `2px solid ${color}40`, // screen glow reflection
      }}
    >
      {/* Computer Monitor */}
      <div className="absolute top-1 w-12 h-4 rounded-sm bg-[#050510] border border-white/10 flex items-center justify-center overflow-hidden">
        {/* Screen glow */}
        <motion.div
          className="w-full h-full opacity-30"
          style={{ backgroundColor: color }}
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
      <span className="absolute bottom-2 text-[8px] font-mono text-white/30 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function Watercooler() {
  return (
    <div className="absolute" style={{ left: LOCATIONS.lounge.x, top: LOCATIONS.lounge.y, marginLeft: -25, marginTop: -25 }}>
      {/* Base */}
      <div className="absolute w-12 h-12 rounded-full border border-white/10 bg-white/5" />
      {/* Water tank (glowing blue) */}
      <motion.div
        className="absolute left-[20%] top-[20%] w-[60%] h-[60%] rounded-full bg-sky-500/20 border border-sky-400/50"
        animate={{ boxShadow: ["0 0 10px rgba(14,165,233,0.3)", "0 0 20px rgba(14,165,233,0.6)", "0 0 10px rgba(14,165,233,0.3)"] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-mono text-white/30">LOUNGE</span>
    </div>
  );
}

function ExitDoor() {
  return (
    <div className="absolute" style={{ left: LOCATIONS.door.x + 30, top: LOCATIONS.door.y, marginTop: -40 }}>
      {/* Door frame */}
      <div className="w-4 h-20 rounded-r-lg bg-red-900/20 border-r border-y border-red-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.2)]">
        <span className="text-[7px] text-red-500/80 -rotate-90 tracking-[0.3em]">EXIT</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function OrchestraCanvas({ activities }: { activities?: any[] }) {
  // Initialize agents in the lounge
  const [agents, setAgents] = useState<AgentSim[]>([
    { id: "jagat_router", name: "Router", color: "#A78BFA", state: "lounge", ...randomNear(LOCATIONS.lounge, 40), facing: "down" },
    { id: "miner", name: "Miner", color: "#22D3EE", state: "lounge", ...randomNear(LOCATIONS.lounge, 40), facing: "left" },
    { id: "copywriter", name: "Writer", color: "#FBBF24", state: "lounge", ...randomNear(LOCATIONS.lounge, 40), facing: "up" },
    { id: "analyst", name: "Analyst", color: "#34D399", state: "lounge", ...randomNear(LOCATIONS.lounge, 40), facing: "right" },
    { id: "dispatcher", name: "Dispatcher", color: "#38BDF8", state: "lounge", ...randomNear(LOCATIONS.lounge, 40), facing: "down" },
  ]);

  // Simulation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents(prev => prev.map(agent => {
        // Randomly decide to work or chill if not forced by error
        if (agent.state === "door") return agent; // Once at door, stay there unless reset

        const toDesk = Math.random() > 0.4;
        if (toDesk) {
          // Walk to desk
          const deskPos = LOCATIONS.desks[agent.id as keyof typeof LOCATIONS.desks];
          // Position character slightly below the desk (sitting facing up at monitor)
          const sitX = deskPos.x;
          const sitY = deskPos.y + 20;
          return {
            ...agent,
            state: "desk",
            facing: "up",
            x: sitX,
            y: sitY
          };
        } else {
          // Walk to lounge
          const loungePos = randomNear(LOCATIONS.lounge, 40);
          return {
            ...agent,
            state: "lounge",
            facing: getFacingDirection(agent.x, agent.y, loungePos.x, loungePos.y),
            x: loungePos.x,
            y: loungePos.y
          };
        }
      }));
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // React to Activity Errors (e.g. 409 Conflict for Dispatcher/Telegram Bot)
  useEffect(() => {
    if (!activities) return;
    const hasError = activities.some(a => a.type === "warning" || a.type === "error" || a.message.includes("409"));
    
    if (hasError) {
      // Send Telegram Dispatcher home! (Limit/Trouble)
      setAgents(prev => prev.map(agent => {
        if (agent.id === "dispatcher" && agent.state !== "door") {
          return {
            ...agent,
            state: "door",
            facing: "left",
            x: LOCATIONS.door.x,
            y: LOCATIONS.door.y
          };
        }
        return agent;
      }));
    } else {
      // If no errors, bring them back to lounge if they were at the door
      setAgents(prev => prev.map(agent => {
        if (agent.state === "door") {
          const loungePos = randomNear(LOCATIONS.lounge, 40);
          return {
            ...agent,
            state: "lounge",
            facing: "right",
            x: loungePos.x,
            y: loungePos.y
          };
        }
        return agent;
      }));
    }
  }, [activities]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(145deg, #07071A 0%, #050510 60%, #080818 100%)",
        border: "1px solid rgba(139,92,246,0.15)",
        height: 580,
        boxShadow: "0 0 60px rgba(124,58,237,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Floor Grid (Game Map) */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.05] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="none" stroke="rgba(255,255,255,1)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)"/>
      </svg>

      {/* Environment */}
      <ExitDoor />
      <Watercooler />
      <Desk x={LOCATIONS.desks["jagat_router"].x} y={LOCATIONS.desks["jagat_router"].y} color="#A78BFA" label="Router Terminal" />
      <Desk x={LOCATIONS.desks.miner.x} y={LOCATIONS.desks.miner.y} color="#22D3EE" label="Miner Desk" />
      <Desk x={LOCATIONS.desks.copywriter.x} y={LOCATIONS.desks.copywriter.y} color="#FBBF24" label="Copywriter Desk" />
      <Desk x={LOCATIONS.desks.analyst.x} y={LOCATIONS.desks.analyst.y} color="#34D399" label="Analyst Desk" />
      <Desk x={LOCATIONS.desks.dispatcher.x} y={LOCATIONS.desks.dispatcher.y} color="#38BDF8" label="Telegram Ops" />

      {/* Agents */}
      {agents.map(agent => (
        <AgentSprite key={agent.id} agent={agent} />
      ))}

      {/* Header UI Overlay */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3 z-50 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_#A78BFA]"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-[11px] font-mono text-white/60 tracking-widest uppercase">
            JAGAT Virtual Office Sim (Top-Down)
          </span>
        </div>
      </div>
    </div>
  );
}

