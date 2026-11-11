"use client";
import { useState, useEffect, useCallback } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

interface ColonyStats {
  totalTasks: number;
  queued: number;
  planning: number;
  approved: number;
  running: number;
  review: number;
  blocked: number;
  done: number;
  archived: number;
}

interface ColonyTask {
  taskId: string;
  title: string;
  objective: string;
  phase: string;
  sourceOfTruth?: string;
  assignedAgent: string;
  status: string;
  priority: string;
  lastUpdate: string;
  blockedReason?: string;
  founderApprovalRequired: boolean;
  acceptanceCriteria: string[];
  dependencies: string[];
  evidence: Array<{ type: string; description: string; timestamp: string; quality_score?: number; quality_verdict?: string; quality_dimensions?: Array<{ name: string; score: number; maxScore: number; reason: string }> }>;
  missionId?: string;
  createdAt: string;
  contextDocumentsUsed?: Array<{ title: string; source: string; category: string; score: number }>;
}

interface Mission {
  id: string;
  title: string;
  objective: string;
  phase: string;
  status: string;
  priority: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  targetDate?: string;
  notes?: string;
  outcomeSummary?: {
    completedAt: string;
    totalTasks: number;
    doneCount: number;
    blockedCount: number;
    reviewCount: number;
    runningCount: number;
    queuedCount: number;
    avgQualityScore: number | null;
  };
  tasks?: ColonyTask[];
}

interface ColonyLesson {
  lessonId: string;
  missionId: string;
  taskIds: string[];
  category: string;
  title: string;
  content: string;
  score: number | null;
  createdAt: string;
  source: string;
  tags: string[];
  mission?: { id: string; title: string; status: string; objective: string } | null;
  relatedTasks?: Array<{ taskId: string; title: string; status: string; priority: string }>;
  storageNote?: string;
}

interface ColonyAgent {
  agentId: string;
  role: string;
  displayName: string;
  status: string;
  currentTaskId?: string;
  totalTasksCompleted: number;
  lastHeartbeat?: string;
}

interface ApprovalRequest {
  approvalId: string;
  taskId: string;
  requestedBy: string;
  requestedAt: string;
  type: string;
  description: string;
  status: string;
}

interface ChatRoom {
  roomId: string;
  name: string;
  type: string;
  participants: string[];
  lastActivity: string;
}

interface ChatMessage {
  messageId: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  content: string;
  timestamp: string;
  messageType: string;
  linkedTaskId?: string;
}

interface PatchHunk {
  filePath: string;
  startLine: number;
  endLine: number;
  originalContent: string;
  proposedContent: string;
  unifiedDiff: string;
}

interface PatchProposal {
  proposalId: string;
  taskId: string;
  agentName: string;
  title: string;
  rationale: string;
  hunks: PatchHunk[];
  filesAffected: string[];
  estimatedRisk: "low" | "medium" | "high";
  contextFiles: string[];
  searchQueries: string[];
  evidenceSummary: string;
  status: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  appliedAt?: string;
  applyError?: string;
  trainingDataTags: string[];
  trainingDataReady: boolean;
  // Verifier surface (T-046)
  verifierStatus?: "verified" | "failed" | "pending" | "missing";
  verifierChecks?: { name: string; command: string; exitCode: number | null; passed: boolean | null; executedAt: string | null }[];
  verifierVerifiedAt?: string | null;
  highRiskBlocked?: boolean;
}

interface DistillationScreening {
  decision: "auto_accepted" | "needs_founder_review" | "rejected";
  groundingScore: number;
  citationScore: number;
  safetyScore: number;
  usefulnessScore: number;
  overallScore: number;
  reasons: string[];
  screenedAt: string;
}

interface DistillationRecord {
  recordId: string;
  status: "pending_review" | "auto_accepted" | "needs_founder_review" | "accepted" | "rejected";
  question: string;
  answer: string;
  tags: string[];
  benchmarkName?: string;
  benchmarkPassed?: boolean;
  score?: number;
  citations: string[];
  contextSources: Array<{ title?: string; source?: string; category?: string; score?: number }>;
  screening?: DistillationScreening;
  createdAt: string;
  createdBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

interface ModelArenaSummary {
  modelId: string;
  taskType: string;
  avgScore: number | null;
  avgLatencyMs: number | null;
  sampleCount: number;
  recommendation: string;
  lastUpdatedAt: string;
}

interface ModelArenaRuntimeStats {
  modelId: string;
  taskType: string;
  totalEvents: number;
  successCount: number;
  failedCount: number;
  avgLatencyMs: number;
  lastRecordedAt: string;
}

interface ModelArenaRuntimeEvent {
  eventId: string;
  modelId: string;
  taskType: string;
  latencyMs: number;
  outcome: "success" | "failed";
  source: string;
  taskId?: string;
  agentRole?: string;
  errorCode?: string;
  recordedAt: string;
}

interface ModelArenaRecommendation {
  taskType: string;
  recommendation: { modelId: string; avgScore: number; avgLatencyMs: number; reason: string } | null;
}

interface ModelArenaData {
  generatedAt?: string;
  policy?: { storage: string; action: string; rawPromptStored: boolean; rawOutputStored: boolean };
  summaries: ModelArenaSummary[];
  runtimeStats: ModelArenaRuntimeStats[];
  runtimeEvents: ModelArenaRuntimeEvent[];
  recommendations: ModelArenaRecommendation[];
}

interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  reporterCheckMs: number;
  tickCount: number;
  claimedCount: number;
  skippedCount: number;
  lastSkippedCount: number;
  lastTickAt?: string;
  lastClaimedTaskId?: string;
  lastReporterCheckAt?: string;
  lastError?: string;
}

interface ReporterRunResult {
  cadence: "daily" | "weekly";
  posted: boolean;
  roomId?: string;
  reason?: string;
  summary?: string;
}

interface AuthSessionResponse {
  authenticated: boolean;
  session?: {
    ownerName: string;
    tier: string;
  };
}

type TaskStatusAction = "planning" | "approved" | "running" | "review" | "blocked" | "done" | "archived";

// ── Constants ───────────────────────────────────────────────────────────────

type TabId = "overview" | "missions" | "tasks" | "agents" | "chat" | "approvals" | "runtime" | "patches" | "distillation" | "lessons" | "modelArena" | "workflow";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◈" },
  { id: "missions", label: "Missions", icon: "⚑" },
  { id: "tasks", label: "Task Queue", icon: "☰" },
  { id: "agents", label: "Colony Roster", icon: "◎" },
  { id: "workflow", label: "AI Workflow", icon: "⟳" },
  { id: "chat", label: "Internal Chat", icon: "◇" },
  { id: "approvals", label: "Approvals", icon: "✦" },
  { id: "runtime", label: "C6 Runtime", icon: "C6" },
  { id: "patches", label: "Patch Review", icon: "P" },
  { id: "distillation", label: "Distillation", icon: "D" },
  { id: "lessons", label: "Lessons", icon: "L" },
  { id: "modelArena", label: "Model Arena", icon: "M" },
];

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  planning: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  approved: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  running: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  review: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  blocked: "bg-red-500/20 text-red-400 border-red-500/30",
  done: "bg-green-500/20 text-green-300 border-green-500/30",
  archived: "bg-zinc-500/20 text-zinc-500 border-zinc-500/30",
  idle: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  working: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  offline: "bg-zinc-500/20 text-zinc-500 border-zinc-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved_a: "bg-green-500/20 text-green-300 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  pending_review: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  auto_accepted: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  needs_founder_review: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  accepted: "bg-green-500/20 text-green-300 border-green-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400",
  high: "text-amber-400",
  medium: "text-blue-400",
  low: "text-slate-400",
};

const LESSON_CATEGORY_COLORS: Record<string, string> = {
  quality_high: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  quality_low: "bg-red-500/20 text-red-300 border-red-500/30",
  blocked_pattern: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  scope_change: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  general: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const VERIFIER_COLORS: Record<string, string> = {
  verified: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-300 border-red-500/30",
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  missing: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

const VERIFIER_LABELS: Record<string, string> = {
  verified: "✓ Verified",
  failed: "✗ Failed",
  pending: "◌ Pending",
  missing: "? Missing",
};

const LESSON_CATEGORY_LABELS: Record<string, string> = {
  quality_high: "High Quality",
  quality_low: "Low Quality",
  blocked_pattern: "Blocked Pattern",
  scope_change: "Scope Change",
  general: "General",
};

const AGENT_ROLE_ICONS: Record<string, string> = {
  director: "👔",
  planner: "📐",
  researcher: "🔬",
  builder: "🔨",
  reviewer: "🔍",
  reporter: "📊",
};

// ── Helper ──────────────────────────────────────────────────────────────────

const COLONY_PHASES = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"];
const AGENT_ROLES = ["director", "planner", "researcher", "builder", "reviewer", "reporter"];
const TASK_PRIORITIES = ["critical", "high", "medium", "low"];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return "-";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function successRate(success: number, total: number): string {
  if (total <= 0) return "-";
  return `${Math.round((success / total) * 100)}%`;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 6_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function ColonyCommandCenter() {
  const [authorized, setAuthorized] = useState(false);
  const [checked, setChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // Session identity — derived from cookie, not hardcoded
  const [callerName, setCallerName] = useState("Founder");
  const [callerRole, setCallerRole] = useState("founder");

  // Data states
  const [stats, setStats] = useState<ColonyStats | null>(null);
  const [tasks, setTasks] = useState<ColonyTask[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [agents, setAgents] = useState<ColonyAgent[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [patchProposals, setPatchProposals] = useState<PatchProposal[]>([]);
  const [distillationRecords, setDistillationRecords] = useState<DistillationRecord[]>([]);
  const [modelArenaData, setModelArenaData] = useState<ModelArenaData | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState("");
  const [approvalActionLoading, setApprovalActionLoading] = useState("");
  const [loading, setLoading] = useState(true);

  // Mission creation
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [missionForm, setMissionForm] = useState({ title: "", objective: "", phase: "C1", priority: "high" });

  // Task commissioning controls
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    objective: "",
    phase: "C5",
    sourceOfTruth: "ops/JAGAT_COLONY_PHASE3_COMMISSIONING_CHECKLIST.md",
    assignedAgent: "builder",
    priority: "high",
    acceptanceCriteria: "",
    founderApprovalRequired: true,
    autoProposeLowRiskPatch: false,
  });
  const [taskActionLoading, setTaskActionLoading] = useState("");
  const [taskBlockedReason, setTaskBlockedReason] = useState<Record<string, string>>({});
  const [taskEvidenceText, setTaskEvidenceText] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState("");
  const [patchActionLoading, setPatchActionLoading] = useState("");
  const [patchReviewNote, setPatchReviewNote] = useState("");
  const [patchTrainingReady, setPatchTrainingReady] = useState(false);
  const [distillationActionLoading, setDistillationActionLoading] = useState("");
  const [distillationReviewNote, setDistillationReviewNote] = useState("");
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [reporterSummary, setReporterSummary] = useState("");
  const [reporterResult, setReporterResult] = useState<ReporterRunResult | null>(null);
  const [runtimeActionLoading, setRuntimeActionLoading] = useState("");

  // Lesson & Mission Detail states
  const [lessons, setLessons] = useState<ColonyLesson[]>([]);
  const [lessonFilter, setLessonFilter] = useState<string>("");
  const [selectedLesson, setSelectedLesson] = useState<ColonyLesson | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [missionDetail, setMissionDetail] = useState<Mission | null>(null);
  const [missionLessons, setMissionLessons] = useState<ColonyLesson[]>([]);
  const [missionDetailLoading, setMissionDetailLoading] = useState(false);

  // ── Auth — derive identity from session cookie ──
  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json()) as AuthSessionResponse;
        const isSovereign = res.ok && data.authenticated && data.session?.tier === "SOVEREIGN";

        if (cancelled) return;
        setAuthorized(isSovereign);
        if (data.session?.ownerName) setCallerName(data.session.ownerName);
        if (isSovereign) setCallerRole("founder");
      } catch {
        if (!cancelled) setAuthorized(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    }

    verifySession();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Data Fetching ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, tasksRes, missionsRes, agentsRes, approvalsRes, roomsRes, patchesRes, distillationRes, modelArenaRes, schedulerRes, reporterSummaryRes] = await Promise.allSettled([
        fetchWithTimeout("/api/colony/stats"),
        fetchWithTimeout("/api/colony/tasks"),
        fetchWithTimeout("/api/colony/missions"),
        fetchWithTimeout("/api/colony/agents"),
        fetchWithTimeout("/api/colony/approvals"),
        fetchWithTimeout("/api/colony/chat/rooms"),
        fetchWithTimeout("/api/colony/patches"),
        fetchWithTimeout("/api/colony/distillation/records?limit=50"),
        fetchWithTimeout("/api/colony/model-arena?limit=75"),
        fetchWithTimeout("/api/colony/scheduler/status"),
        fetchWithTimeout("/api/colony/reporter/summary?cadence=daily"),
      ]);

      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const d = await statsRes.value.json();
        setStats(d.stats);
        setPendingCount(d.pendingApprovals ?? 0);
        setBlockedCount(d.blockedTasks ?? 0);
      }
      if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
        const d = await tasksRes.value.json();
        setTasks(d.tasks ?? []);
      }
      if (missionsRes.status === "fulfilled" && missionsRes.value.ok) {
        const d = await missionsRes.value.json();
        setMissions(Array.isArray(d) ? d : []);
      }
      if (agentsRes.status === "fulfilled" && agentsRes.value.ok) {
        const d = await agentsRes.value.json();
        setAgents(d.agents ?? []);
      }
      if (approvalsRes.status === "fulfilled" && approvalsRes.value.ok) {
        const d = await approvalsRes.value.json();
        setApprovals(Array.isArray(d) ? d : []);
      }
      if (roomsRes.status === "fulfilled" && roomsRes.value.ok) {
        const d = await roomsRes.value.json();
        const r = Array.isArray(d) ? d : [];
        setRooms(r);
        if (r.length > 0 && !activeRoomId) setActiveRoomId(r[0].roomId);
      }
      if (patchesRes.status === "fulfilled" && patchesRes.value.ok) {
        const d = await patchesRes.value.json();
        setPatchProposals(d.proposals ?? []);
      }
      if (distillationRes.status === "fulfilled" && distillationRes.value.ok) {
        const d = await distillationRes.value.json();
        setDistillationRecords(d.records ?? []);
      }
      if (modelArenaRes.status === "fulfilled" && modelArenaRes.value.ok) {
        const d = await modelArenaRes.value.json();
        setModelArenaData({
          generatedAt: d.generatedAt,
          policy: d.policy,
          summaries: d.summaries ?? [],
          runtimeStats: d.runtimeStats ?? [],
          runtimeEvents: d.runtimeEvents ?? [],
          recommendations: d.recommendations ?? [],
        });
      }
      if (schedulerRes.status === "fulfilled" && schedulerRes.value.ok) {
        const d = await schedulerRes.value.json();
        setSchedulerStatus(d.scheduler ?? null);
      }
      if (reporterSummaryRes.status === "fulfilled" && reporterSummaryRes.value.ok) {
        const d = await reporterSummaryRes.value.json();
        setReporterSummary(d.summary ?? "");
      }

      // Fetch lessons
      try {
        const lessonsRes = await fetchWithTimeout("/api/colony/lessons");
        if (lessonsRes.ok) {
          const d = await lessonsRes.json();
          setLessons(Array.isArray(d) ? d : []);
        }
      } catch { /* lesson fetch is non-critical */ }
    } catch {
      // silently fail on initial load
    } finally {
      setLoading(false);
    }
  }, [activeRoomId]);

  useEffect(() => { if (authorized) fetchAll(); }, [authorized, fetchAll]);

  const handleRuntimeTick = async () => {
    setRuntimeActionLoading("tick");
    setActionMessage("");
    try {
      const res = await fetch("/api/colony/scheduler/tick", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMessage(`Scheduler tick gagal (${res.status}): ${d.message ?? d.error ?? "Unknown error"}`);
        return;
      }
      setSchedulerStatus(d.scheduler ?? null);
      setActionMessage(`Scheduler tick: claimed ${d.result?.claimed ?? 0}, skipped ${d.result?.skipped ?? 0}.`);
      await fetchAll();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Scheduler tick gagal.");
    } finally {
      setRuntimeActionLoading("");
    }
  };

  const handleReporterRun = async (cadence: "daily" | "weekly") => {
    setRuntimeActionLoading(`reporter:${cadence}`);
    setActionMessage("");
    try {
      const res = await fetch("/api/colony/reporter/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence, force: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionMessage(`Reporter gagal (${res.status}): ${d.message ?? d.error ?? "Unknown error"}`);
        return;
      }
      setReporterResult(d.result ?? null);
      setReporterSummary(d.result?.summary ?? reporterSummary);
      setActionMessage(`${cadence} reporter ${d.result?.posted ? "posted" : "skipped"}${d.result?.reason ? `: ${d.result.reason}` : "."}`);
      await fetchAll();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Reporter gagal.");
    } finally {
      setRuntimeActionLoading("");
    }
  };

  // ── Chat Messages ──
  const fetchMessages = useCallback(async () => {
    if (!activeRoomId) return;
    try {
      const res = await fetch(`/api/colony/chat/rooms/${activeRoomId}/messages`);
      if (res.ok) {
        const d = await res.json();
        setMessages(d.messages ?? []);
      }
    } catch { /* silently fail */ }
  }, [activeRoomId]);

  useEffect(() => { if (activeRoomId) fetchMessages(); }, [activeRoomId, fetchMessages]);

  // ── Auto-refresh chat messages every 3s when chat tab is active ──
  useEffect(() => {
    if (activeTab !== "chat" || !activeRoomId) return;
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000);
    return () => clearInterval(interval);
  }, [activeTab, activeRoomId, fetchMessages]);

  // ── Bootstrap ──
  const handleBootstrap = async () => {
    setBootstrapping(true);
    setBootstrapMessage("");
    try {
      const res = await fetchWithTimeout("/api/colony/bootstrap", { method: "POST" }, 8_000);
      if (res.ok) {
        const data = await res.json();
        setBootstrapMessage(`Colony bootstrapped: ${data.agents} agents, ${data.rooms} rooms.`);
      } else {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        setBootstrapMessage(`Bootstrap failed (${res.status}): ${err.message ?? "Unknown error"}`);
      }
      await fetchAll();
    } catch (err) {
      setBootstrapMessage(err instanceof Error ? err.message : "Bootstrap failed — backend unreachable?");
    } finally {
      setBootstrapping(false);
    }
  };

  // ── Send Chat ──
  const handleSendChat = async () => {
    if (!chatInput.trim() || !activeRoomId) return;
    try {
      // NOTE: senderId/senderRole/senderName are intentionally NOT sent.
      // The backend overrides all three from req.colonyIdentity (server-verified).
      // Sending them from client state would be a spoofable no-op that
      // creates an ambiguous contract. Only content + messageType are needed.
      const res = await fetch(`/api/colony/chat/rooms/${activeRoomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: chatInput.trim(),
          messageType: "text",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        setActionMessage(`Chat gagal (${res.status}): ${err.message ?? "Unknown error"}`);
        return;
      }
      setChatInput("");
      await fetchMessages();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Chat gagal — backend unreachable?");
    }
  };

  // ── Mission Detail ──
  const handleOpenMissionDetail = async (missionId: string) => {
    setSelectedMissionId(missionId);
    setMissionDetailLoading(true);
    setMissionDetail(null);
    setMissionLessons([]);
    try {
      const [missionRes, lessonsRes] = await Promise.allSettled([
        fetch(`/api/colony/missions/${missionId}`),
        fetch(`/api/colony/missions/${missionId}/lessons`),
      ]);
      if (missionRes.status === "fulfilled" && missionRes.value.ok) {
        const d = await missionRes.value.json();
        setMissionDetail(d);
      }
      if (lessonsRes.status === "fulfilled" && lessonsRes.value.ok) {
        const d = await lessonsRes.value.json();
        setMissionLessons(Array.isArray(d) ? d : []);
      }
    } catch { /* non-critical */ }
    setMissionDetailLoading(false);
  };

  const handleCloseMissionDetail = () => {
    setSelectedMissionId(null);
    setMissionDetail(null);
    setMissionLessons([]);
  };

  // ── Lesson Detail ──
  const handleOpenLessonDetail = async (lessonId: string) => {
    setLessonLoading(true);
    setSelectedLesson(null);
    try {
      const res = await fetch(`/api/colony/lessons/${lessonId}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedLesson(d);
      }
    } catch { /* non-critical */ }
    setLessonLoading(false);
  };

  const handleCloseLessonDetail = () => {
    setSelectedLesson(null);
  };

  // ── Create Mission ──
  const handleCreateMission = async () => {
    if (!missionForm.title.trim() || !missionForm.objective.trim()) return;
    setActionMessage("");
    try {
      const res = await fetch("/api/colony/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // NOTE: createdBy is intentionally omitted — backend overrides with
        // req.colonyIdentity.role (verified from session), not from body.
        body: JSON.stringify(missionForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        setActionMessage(`Mission gagal dibuat (${res.status}): ${err.message ?? "Unknown error"}`);
        return;
      }
      setShowMissionForm(false);
      setMissionForm({ title: "", objective: "", phase: "C1", priority: "high" });
      setActionMessage("Mission berhasil dibuat.");
      await fetchAll();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Mission gagal dibuat — backend unreachable?");
    }
  };

  // ── Approval Response ──
  const handleCreateTask = async () => {
    const criteria = taskForm.acceptanceCriteria
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const autoProposeLowRiskPatch = taskForm.autoProposeLowRiskPatch
      && taskForm.phase === "C6"
      && taskForm.assignedAgent === "builder"
      && taskForm.priority === "low";

    if (!taskForm.title.trim() || !taskForm.objective.trim() || criteria.length === 0) {
      setActionMessage("Task wajib punya title, objective, dan minimal 1 acceptance criteria.");
      return;
    }

    setTaskActionLoading("create-task");
    setActionMessage("");
    try {
      const res = await fetch("/api/colony/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskForm.title.trim(),
          objective: taskForm.objective.trim(),
          phase: taskForm.phase,
          sourceOfTruth: taskForm.sourceOfTruth.trim(),
          assignedAgent: taskForm.assignedAgent,
          priority: taskForm.priority,
          acceptanceCriteria: criteria,
          founderApprovalRequired: autoProposeLowRiskPatch ? false : taskForm.founderApprovalRequired,
          tags: autoProposeLowRiskPatch ? ["founder-approved-low-risk-patch-proposal"] : [],
          missionId: missions[0]?.id,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowTaskForm(false);
      setTaskForm({
        title: "",
        objective: "",
        phase: "C5",
        sourceOfTruth: "ops/JAGAT_COLONY_PHASE3_COMMISSIONING_CHECKLIST.md",
        assignedAgent: "builder",
        priority: "high",
        acceptanceCriteria: "",
        founderApprovalRequired: true,
        autoProposeLowRiskPatch: false,
      });
      setActionMessage("Task berhasil dibuat dan masuk queue.");
      await fetchAll();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Gagal membuat task.");
    } finally {
      setTaskActionLoading("");
    }
  };

  const handleTaskStatus = async (task: ColonyTask, status: TaskStatusAction) => {
    const blockedReason = taskBlockedReason[task.taskId]?.trim();
    if (status === "blocked" && !blockedReason) {
      setActionMessage("Status blocked wajib punya alasan.");
      return;
    }

    setTaskActionLoading(`${task.taskId}:${status}`);
    setActionMessage("");
    try {
      const res = await fetch(`/api/colony/tasks/${task.taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reason: `Founder command: move ${task.status} to ${status}`,
          blockedReason: status === "blocked" ? blockedReason : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setActionMessage(`Task ${task.taskId} dipindahkan ke ${status}.`);
      await fetchAll();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Gagal mengubah status task.");
    } finally {
      setTaskActionLoading("");
    }
  };

  const handleAddEvidence = async (task: ColonyTask) => {
    const description = taskEvidenceText[task.taskId]?.trim();
    if (!description) {
      setActionMessage("Evidence wajib diisi sebelum task bisa ditutup sebagai done.");
      return;
    }

    setTaskActionLoading(`${task.taskId}:evidence`);
    setActionMessage("");
    try {
      const res = await fetch(`/api/colony/tasks/${task.taskId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "review_verdict",
          description,
          timestamp: new Date().toISOString(),
          agentRole: "reviewer",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTaskEvidenceText((prev) => ({ ...prev, [task.taskId]: "" }));
      setActionMessage(`Evidence untuk ${task.taskId} tersimpan.`);
      await fetchAll();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Gagal menyimpan evidence.");
    } finally {
      setTaskActionLoading("");
    }
  };

  const handleRequestApproval = async (task: ColonyTask) => {
    setTaskActionLoading(`${task.taskId}:approval`);
    setActionMessage("");
    try {
      const res = await fetch("/api/colony/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.taskId,
          type: task.status === "review" ? "task_completion" : "task_start",
          description: `Founder approval diperlukan untuk ${task.title} (${task.taskId}).`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setActionMessage(`Approval request untuk ${task.taskId} berhasil dibuat.`);
      await fetchAll();
      setActiveTab("approvals");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Gagal membuat approval request.");
    } finally {
      setTaskActionLoading("");
    }
  };

  const handleApproval = async (approvalId: string, response: "approved" | "rejected") => {
    setApprovalActionLoading(approvalId);
    try {
      const res = await fetch(`/api/colony/approvals/${approvalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response,
          // NOTE: respondedBy is intentionally NOT sent — backend overrides with
          // req.colonyIdentity.name (verified HMAC session), not from body.
          // Sending it from client would be a security anti-pattern.
          note: response === "approved"
            ? `Disetujui oleh ${callerName} (verified founder)`
            : `Ditolak oleh ${callerName} (verified founder)`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Unknown error" }));
        setActionMessage(`Approval gagal (${res.status}): ${err.message ?? "Unknown error"}`);
      } else {
        setActionMessage("");
      }
      await fetchAll();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Approval request gagal.");
    } finally {
      setApprovalActionLoading("");
    }
  };

  // ── Loading / Auth Gates ──
  const handlePatchDecision = async (proposalId: string, decision: "approve" | "reject") => {
    setPatchActionLoading(`${proposalId}:${decision}`);
    setActionMessage("");
    try {
      const endpoint = decision === "approve" ? "approve" : "reject";
      const res = await fetch(`/api/colony/patches/${proposalId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: patchReviewNote || undefined,
          trainingDataReady: patchTrainingReady,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPatchReviewNote("");
      setPatchTrainingReady(false);
      setActionMessage(
        decision === "approve"
          ? `Patch ${proposalId} approved and applied.`
          : `Patch ${proposalId} rejected.`,
      );
      await fetchAll();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Patch review action failed.");
    } finally {
      setPatchActionLoading("");
    }
  };

  const handleDistillationScreen = async (recordId: string) => {
    setDistillationActionLoading(`${recordId}:screen`);
    setActionMessage("");
    try {
      const res = await fetch(`/api/colony/distillation/records/${recordId}/screen`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message ?? d.error ?? "Distillation screening failed.");
      setActionMessage(`Distillation ${recordId} screened: ${d.record?.status ?? "updated"}.`);
      await fetchAll();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Distillation screening failed.");
    } finally {
      setDistillationActionLoading("");
    }
  };

  const handleDistillationReview = async (recordId: string, status: "accepted" | "rejected") => {
    setDistillationActionLoading(`${recordId}:${status}`);
    setActionMessage("");
    try {
      const res = await fetch(`/api/colony/distillation/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNote: distillationReviewNote || `${status} by ${callerName}`,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message ?? d.error ?? "Distillation review failed.");
      setDistillationReviewNote("");
      setActionMessage(`Distillation ${recordId} ${status}.`);
      await fetchAll();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Distillation review failed.");
    } finally {
      setDistillationActionLoading("");
    }
  };

  if (!checked) return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 animate-pulse" />
        <p className="text-slate-500 font-mono text-xs">Verifying sovereign clearance…</p>
      </div>
    </div>
  );

  if (!authorized) return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-950 text-center px-6">
      <div className="w-16 h-16 mb-5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
        <span className="text-3xl">🔒</span>
      </div>
      <p className="text-lg font-bold text-red-400 mb-1">Akses Colony Ditolak</p>
      <p className="text-sm text-slate-500 max-w-sm">
        Clearance level <span className="font-bold text-red-300">SOVEREIGN</span> diperlukan untuk mengakses Founder Command Center.
      </p>
      <a href="/login" className="mt-5 px-5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-all">
        ← Login
      </a>
    </div>
  );

  // ── Render ──
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      {/* ═══ Sidebar ═══ */}
      <aside className="w-64 flex-shrink-0 border-r border-slate-800/60 bg-slate-900/40 flex flex-col">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-violet-600/20">
              J
            </div>
            <div>
              <h1 className="text-[13px] font-bold text-slate-100 tracking-tight leading-tight">Colony Command</h1>
              <p className="text-[10px] text-slate-500 font-mono">Founder Control Surface</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-violet-600/15 text-violet-300 border border-violet-500/20"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
              }`}
            >
              <span className="text-base opacity-70">{tab.icon}</span>
              {tab.label}
              {tab.id === "approvals" && pendingCount > 0 && (
                <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  {pendingCount}
                </span>
              )}
              {tab.id === "tasks" && blockedCount > 0 && (
                <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {blockedCount} blocked
                </span>
              )}
              {tab.id === "patches" && patchProposals.filter((p) => p.status === "pending").length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {patchProposals.filter((p) => p.status === "pending").length}
                </span>
              )}
              {tab.id === "distillation" && distillationRecords.filter((record) => record.status === "pending_review" || record.status === "needs_founder_review").length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {distillationRecords.filter((record) => record.status === "pending_review" || record.status === "needs_founder_review").length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bootstrap Button */}
        <div className="px-3 py-4 border-t border-slate-800/60">
          <button
            onClick={handleBootstrap}
            disabled={bootstrapping}
            className="w-full px-3 py-2 rounded-xl text-[11px] font-semibold bg-slate-800 border border-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-40 transition-all"
          >
            {bootstrapping ? "Bootstrapping…" : "⚡ Bootstrap Colony"}
          </button>
          {bootstrapMessage && (
            <p className={`mt-2 px-2 py-1.5 rounded-lg text-[9px] font-mono leading-snug border ${
              bootstrapMessage.startsWith("Colony bootstrapped")
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                : "bg-red-500/10 text-red-300 border-red-500/20"
            }`}>{bootstrapMessage}</p>
          )}
          <button
            onClick={fetchAll}
            disabled={bootstrapping}
            className="w-full mt-2 px-3 py-2 rounded-xl text-[11px] font-semibold bg-slate-800/50 border border-slate-700/30 text-slate-500 hover:bg-slate-700/50 hover:text-slate-300 disabled:opacity-30 transition-all"
          >
            ↻ Refresh Data
          </button>
        </div>

        {/* Founder Badge — dynamic from session */}
        <div className="px-4 py-3 border-t border-slate-800/60 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white text-[10px] font-black">{callerName[0]?.toUpperCase() ?? "F"}</div>
          <div>
            <p className="text-[11px] font-semibold text-slate-300">{callerName}</p>
            <p className="text-[9px] font-mono text-red-400">SOVEREIGN</p>
          </div>
        </div>
      </aside>

      {/* ═══ Main Content ═══ */}
      <main className="flex-1 overflow-y-auto">
        {loading && !stats ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600/20 animate-pulse" />
              <p className="text-slate-500 text-xs font-mono">Loading colony state…</p>
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* ── Overview Tab ── */}
            {activeTab === "overview" && (
              <>
                {/* Stats Grid */}
                <div>
                  <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Colony Health Dashboard</h2>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: "Total Tasks", value: stats?.totalTasks ?? 0, color: "from-violet-600/20 to-violet-900/10 border-violet-500/20", textColor: "text-violet-400" },
                      { label: "Running", value: stats?.running ?? 0, color: "from-emerald-600/20 to-emerald-900/10 border-emerald-500/20", textColor: "text-emerald-400" },
                      { label: "Blocked", value: stats?.blocked ?? 0, color: "from-red-600/20 to-red-900/10 border-red-500/20", textColor: "text-red-400" },
                      { label: "Completed", value: stats?.done ?? 0, color: "from-green-600/20 to-green-900/10 border-green-500/20", textColor: "text-green-300" },
                    ].map((s) => (
                      <div key={s.label} className={`rounded-xl border bg-gradient-to-br ${s.color} p-4`}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
                        <p className={`mt-1 text-2xl font-black tracking-tight ${s.textColor}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Task Pipeline */}
                <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Task Pipeline Status</h3>
                  <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
                    {(["queued", "planning", "approved", "running", "review", "blocked", "done", "archived"] as const).map((s) => {
                      const count = stats?.[s] ?? 0;
                      return (
                        <div key={s} className="text-center">
                          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border text-sm font-black ${STATUS_COLORS[s]}`}>
                            {count}
                          </div>
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mt-1.5">{s}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Active Missions */}
                <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Missions</h3>
                    <span className="text-[10px] font-mono text-slate-600">{missions.filter(m => m.status === "active").length} active</span>
                  </div>
                  {missions.filter(m => m.status === "active").length === 0 ? (
                    <p className="text-sm text-slate-600 italic">Belum ada mission aktif. Buat mission baru dari tab Missions.</p>
                  ) : (
                    <div className="space-y-2">
                      {missions.filter(m => m.status === "active").slice(0, 5).map((m) => (
                        <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/30 border border-slate-700/20">
                          <span className="text-base">⚑</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-slate-200 truncate">{m.title}</p>
                            <p className="text-[10px] text-slate-500 truncate">{m.objective}</p>
                          </div>
                          <span className={`text-[10px] font-bold ${PRIORITY_COLORS[m.priority]}`}>{m.priority.toUpperCase()}</span>
                          <span className="text-[9px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{m.phase}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Colony Roster Quick View */}
                <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-5">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Colony Roster</h3>
                  {agents.length === 0 ? (
                    <p className="text-sm text-slate-600 italic">Colony belum di-bootstrap. Klik &quot;Bootstrap Colony&quot; di sidebar.</p>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                      {agents.map((a) => (
                        <div key={a.agentId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/30 border border-slate-700/20">
                          <span className="text-lg">{AGENT_ROLE_ICONS[a.role] ?? "●"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-slate-200">{a.displayName}</p>
                            <p className="text-[9px] font-mono text-slate-500">{a.role}</p>
                          </div>
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${STATUS_COLORS[a.status]}`}>
                            {a.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pending Approvals Quick */}
                {approvals.length > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-3">⚠ Pending Approvals ({approvals.length})</h3>
                    <div className="space-y-2">
                      {approvals.slice(0, 3).map((a) => (
                        <div key={a.approvalId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/30 border border-slate-700/20">
                          <div className="flex-1">
                            <p className="text-[12px] font-semibold text-slate-200">{a.description}</p>
                            <p className="text-[10px] text-slate-500">by {a.requestedBy} • {relativeTime(a.requestedAt)}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => handleApproval(a.approvalId, "approved")} disabled={approvalActionLoading === a.approvalId} className="px-3 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 transition-all">
                              ✓ Approve
                            </button>
                            <button onClick={() => handleApproval(a.approvalId, "rejected")} disabled={approvalActionLoading === a.approvalId} className="px-3 py-1 rounded-lg text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40 transition-all">
                              ✕ Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Missions Tab ── */}
            {activeTab === "missions" && (
              <>
                {/* Mission Detail View */}
                {selectedMissionId ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <button onClick={handleCloseMissionDetail} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-slate-200 transition-all">
                        ← Back to Missions
                      </button>
                      <span className="text-[10px] font-mono text-slate-600">{selectedMissionId}</span>
                    </div>

                    {missionDetailLoading ? (
                      <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-8 text-center">
                        <p className="text-slate-500 text-sm animate-pulse">Loading mission detail…</p>
                      </div>
                    ) : missionDetail ? (
                      <>
                        {/* Mission Header */}
                        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${STATUS_COLORS[missionDetail.status]}`}>{missionDetail.status}</span>
                            <span className={`text-[10px] font-bold ${PRIORITY_COLORS[missionDetail.priority]}`}>{missionDetail.priority.toUpperCase()}</span>
                            <span className="text-[9px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{missionDetail.phase}</span>
                          </div>
                          <h2 className="text-[16px] font-bold text-slate-100">{missionDetail.title}</h2>
                          <p className="text-[13px] text-slate-300 mt-2">{missionDetail.objective}</p>
                          {missionDetail.notes && <p className="text-[12px] text-slate-500 mt-2 italic">{missionDetail.notes}</p>}
                          <div className="flex gap-4 mt-3 text-[10px] text-slate-500">
                            <span>Created: {relativeTime(missionDetail.createdAt)}</span>
                            {missionDetail.createdBy && <span>By: {missionDetail.createdBy}</span>}
                            {missionDetail.targetDate && <span>Target: {missionDetail.targetDate}</span>}
                          </div>
                        </div>

                        {/* Acceptance Criteria (from tasks) */}
                        {missionDetail.tasks && missionDetail.tasks.length > 0 && (
                          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
                            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Acceptance Criteria (from tasks)</h3>
                            <div className="space-y-1">
                              {missionDetail.tasks.flatMap(t => t.acceptanceCriteria).filter(Boolean).map((c, i) => (
                                <div key={i} className="flex items-start gap-2 text-[12px] text-slate-300">
                                  <span className="text-slate-600 mt-0.5">•</span>
                                  <span>{c}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Related Tasks */}
                        {missionDetail.tasks && missionDetail.tasks.length > 0 && (
                          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
                            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Related Tasks ({missionDetail.tasks.length})</h3>
                            <div className="space-y-2">
                              {missionDetail.tasks.map((t) => (
                                <div key={t.taskId} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                                    <span className={`text-[9px] font-bold ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                                    <span className="text-[9px] font-mono text-slate-600">{t.assignedAgent}</span>
                                  </div>
                                  <p className="text-[13px] font-semibold text-slate-200">{t.title}</p>
                                  <p className="text-[11px] text-slate-400 mt-1">{t.objective}</p>
                                  {/* Evidence */}
                                  {t.evidence && t.evidence.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-slate-800/50">
                                      <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Evidence ({t.evidence.length})</p>
                                      {t.evidence.map((e, i) => (
                                        <div key={i} className="text-[11px] text-slate-400 flex items-start gap-2 mt-1">
                                          <span className="text-slate-600">[{e.type}]</span>
                                          <span>{e.description}</span>
                                          {e.quality_score != null && (
                                            <span className={`font-mono ${e.quality_score >= 80 ? "text-emerald-400" : e.quality_score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                                              QS:{e.quality_score}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Outcome Summary */}
                        {missionDetail.outcomeSummary && (
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                            <h3 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-3">Outcome Summary</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="text-center">
                                <p className="text-[20px] font-bold text-slate-100">{missionDetail.outcomeSummary.totalTasks}</p>
                                <p className="text-[9px] text-slate-500 uppercase">Total Tasks</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[20px] font-bold text-emerald-400">{missionDetail.outcomeSummary.doneCount}</p>
                                <p className="text-[9px] text-slate-500 uppercase">Done</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[20px] font-bold text-red-400">{missionDetail.outcomeSummary.blockedCount}</p>
                                <p className="text-[9px] text-slate-500 uppercase">Blocked</p>
                              </div>
                              <div className="text-center">
                                <p className={`text-[20px] font-bold ${missionDetail.outcomeSummary.avgQualityScore != null && missionDetail.outcomeSummary.avgQualityScore >= 80 ? "text-emerald-400" : missionDetail.outcomeSummary.avgQualityScore != null && missionDetail.outcomeSummary.avgQualityScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                                  {missionDetail.outcomeSummary.avgQualityScore != null ? missionDetail.outcomeSummary.avgQualityScore.toFixed(1) : "—"}
                                </p>
                                <p className="text-[9px] text-slate-500 uppercase">Avg Quality</p>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-3">Completed: {relativeTime(missionDetail.outcomeSummary.completedAt)}</p>
                          </div>
                        )}

                        {/* Related Lessons (T-040 prep) */}
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                          <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-3">Related Lessons ({missionLessons.length})</h3>
                          {missionLessons.length === 0 ? (
                            <p className="text-[12px] text-slate-500 italic">Belum ada lesson dari mission ini. Lesson dibuat otomatis saat mission completed.</p>
                          ) : (
                            <div className="space-y-2">
                              {missionLessons.map((l) => (
                                <div key={l.lessonId} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 cursor-pointer hover:border-amber-500/30 transition-all" onClick={() => { setActiveTab("lessons"); handleOpenLessonDetail(l.lessonId); }}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${LESSON_CATEGORY_COLORS[l.category] ?? LESSON_CATEGORY_COLORS.general}`}>{LESSON_CATEGORY_LABELS[l.category] ?? l.category}</span>
                                    {l.score != null && <span className="text-[10px] font-mono text-slate-400">Score: {l.score}</span>}
                                  </div>
                                  <p className="text-[13px] font-semibold text-slate-200">{l.title}</p>
                                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{l.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
                        <p className="text-red-400 text-sm">Mission not found.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Mission Board</h2>
                      <button onClick={() => setShowMissionForm(!showMissionForm)} className="px-4 py-2 rounded-xl text-[11px] font-semibold bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-lg shadow-violet-600/20 transition-all active:scale-[0.97]">
                        + New Mission
                      </button>
                    </div>

                    {/* Mission Form */}
                    {showMissionForm && (
                      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-4">
                        <h3 className="text-[12px] font-bold text-violet-300">Create New Mission</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Title</label>
                            <input type="text" value={missionForm.title} onChange={(e) => setMissionForm({ ...missionForm, title: e.target.value })}
                              placeholder="Mission title…"
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 transition-all" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Phase</label>
                              <select value={missionForm.phase} onChange={(e) => setMissionForm({ ...missionForm, phase: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-violet-500/60 transition-all appearance-none">
                                {["C1", "C2", "C3", "C4", "C5", "C6", "C7"].map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                              <select value={missionForm.priority} onChange={(e) => setMissionForm({ ...missionForm, priority: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-violet-500/60 transition-all appearance-none">
                                {["critical", "high", "medium", "low"].map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Objective</label>
                          <textarea value={missionForm.objective} onChange={(e) => setMissionForm({ ...missionForm, objective: e.target.value })}
                            placeholder="Tujuan mission…"
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 resize-none transition-all" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleCreateMission} className="px-5 py-2 rounded-xl text-[11px] font-semibold bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-600/20 active:scale-[0.97] transition-all">
                            Deploy Mission
                          </button>
                          <button onClick={() => setShowMissionForm(false)} className="px-5 py-2 rounded-xl text-[11px] font-semibold bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-slate-200 transition-all">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Mission List */}
                    <div className="space-y-2">
                      {missions.length === 0 ? (
                        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-8 text-center">
                          <p className="text-slate-500 text-sm">Belum ada mission. Klik &quot;+ New Mission&quot; untuk membuat.</p>
                        </div>
                      ) : missions.map((m) => (
                        <div key={m.id} className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 cursor-pointer hover:border-violet-500/30 transition-all" onClick={() => handleOpenMissionDetail(m.id)}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${STATUS_COLORS[m.status]}`}>{m.status}</span>
                                <span className={`text-[10px] font-bold ${PRIORITY_COLORS[m.priority]}`}>{m.priority.toUpperCase()}</span>
                                <span className="text-[9px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{m.phase}</span>
                              </div>
                              <p className="text-[14px] font-semibold text-slate-100">{m.title}</p>
                              <p className="text-[12px] text-slate-400 mt-1">{m.objective}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[10px] text-slate-600 font-mono">{m.id}</p>
                              <p className="text-[9px] text-slate-600 mt-1">Click to view detail →</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── Tasks Tab ── */}
            {activeTab === "tasks" && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Task Queue</h2>
                    <p className="mt-1 text-[11px] text-slate-600">Command surface untuk commissioning: create, approve, run, review, evidence, dan close.</p>
                  </div>
                  <button onClick={() => setShowTaskForm(!showTaskForm)} className="px-4 py-2 rounded-xl text-[11px] font-semibold bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-lg shadow-violet-600/20 transition-all active:scale-[0.97]">
                    + New Task
                  </button>
                </div>

                {actionMessage && (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-[12px] text-cyan-200">
                    {actionMessage}
                  </div>
                )}

                {showTaskForm && (
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5 space-y-4">
                    <h3 className="text-[12px] font-bold text-violet-300">Create Commissioning Task</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Title</label>
                        <input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title..." className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 transition-all" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Source of Truth</label>
                        <input value={taskForm.sourceOfTruth} onChange={(e) => setTaskForm({ ...taskForm, sourceOfTruth: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Objective</label>
                      <textarea value={taskForm.objective} onChange={(e) => setTaskForm({ ...taskForm, objective: e.target.value })} rows={2} placeholder="Apa hasil operasional yang wajib dicapai?" className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 resize-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Acceptance Criteria, satu baris per item</label>
                      <textarea value={taskForm.acceptanceCriteria} onChange={(e) => setTaskForm({ ...taskForm, acceptanceCriteria: e.target.value })} rows={3} placeholder={"Build pass\nFlow bisa diuji dari UI\nAudit trail tercatat"} className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 resize-none transition-all" />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Phase</label>
                        <select value={taskForm.phase} onChange={(e) => setTaskForm({ ...taskForm, phase: e.target.value, autoProposeLowRiskPatch: false, founderApprovalRequired: true })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-violet-500/60 transition-all">
                          {COLONY_PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Agent</label>
                        <select value={taskForm.assignedAgent} onChange={(e) => setTaskForm({ ...taskForm, assignedAgent: e.target.value, autoProposeLowRiskPatch: false, founderApprovalRequired: true })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-violet-500/60 transition-all">
                          {AGENT_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                        <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value, autoProposeLowRiskPatch: false, founderApprovalRequired: true })} className="w-full px-3 py-2 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-violet-500/60 transition-all">
                          {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 mt-5 text-[11px] text-slate-300">
                        <input type="checkbox" checked={taskForm.founderApprovalRequired} disabled={taskForm.autoProposeLowRiskPatch} onChange={(e) => setTaskForm({ ...taskForm, founderApprovalRequired: e.target.checked })} className="accent-violet-500" />
                        Founder approval required
                      </label>
                    </div>
                    {taskForm.phase === "C6" && taskForm.assignedAgent === "builder" && taskForm.priority === "low" && (
                      <label className="flex items-start gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-[11px] text-slate-300">
                        <input type="checkbox" checked={taskForm.autoProposeLowRiskPatch} onChange={(e) => setTaskForm({ ...taskForm, autoProposeLowRiskPatch: e.target.checked, founderApprovalRequired: !e.target.checked })} className="mt-0.5 accent-cyan-500" />
                        <span><strong className="text-cyan-300">Auto-run Builder analysis (proposal only)</strong><br />Builder may submit a low-risk patch proposal for founder review. No shell access and no automatic file changes.</span>
                      </label>
                    )}
                    <div className="flex gap-2">
                      <button onClick={handleCreateTask} disabled={taskActionLoading === "create-task"} className="px-5 py-2 rounded-xl text-[11px] font-semibold bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-600/20 disabled:opacity-40 active:scale-[0.97] transition-all">
                        {taskActionLoading === "create-task" ? "Creating..." : "Create Task"}
                      </button>
                      <button onClick={() => setShowTaskForm(false)} className="px-5 py-2 rounded-xl text-[11px] font-semibold bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-slate-200 transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {tasks.length === 0 ? (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-8 text-center">
                    <p className="text-slate-500 text-sm">Belum ada task dalam queue.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((t) => (
                      <div key={t.taskId} className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                              <span className={`text-[10px] font-bold ${PRIORITY_COLORS[t.priority]}`}>{t.priority.toUpperCase()}</span>
                              <span className="text-[9px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{AGENT_ROLE_ICONS[t.assignedAgent] ?? "●"} {t.assignedAgent}</span>
                              <span className="text-[9px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{t.phase}</span>
                              {t.founderApprovalRequired && (
                                <span className="text-[9px] font-bold text-amber-400">⚠ APPROVAL REQUIRED</span>
                              )}
                            </div>
                            <p className="text-[14px] font-semibold text-slate-100">{t.title}</p>
                            <p className="text-[12px] text-slate-400 mt-0.5">{t.objective}</p>
                            {t.blockedReason && (
                              <p className="text-[11px] text-red-400 mt-1 italic">Blocked: {t.blockedReason}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[9px] font-mono text-slate-600">{t.taskId}</p>
                            <p className="text-[9px] text-slate-600 mt-0.5">{relativeTime(t.lastUpdate)}</p>
                          </div>
                        </div>
                        {t.acceptanceCriteria.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-slate-800/40">
                            <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Acceptance Criteria</p>
                            <ul className="space-y-0.5">
                              {t.acceptanceCriteria.map((c, i) => (
                                <li key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                                  <span className="text-slate-600 mt-0.5">•</span>
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3 border-t border-slate-800/40 pt-3">
                          <div className="space-y-2">
                            <input value={taskBlockedReason[t.taskId] ?? ""} onChange={(e) => setTaskBlockedReason((prev) => ({ ...prev, [t.taskId]: e.target.value }))} placeholder="Alasan block jika task perlu dihentikan..." className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/50" />
                            <div className="flex gap-2">
                              <input value={taskEvidenceText[t.taskId] ?? ""} onChange={(e) => setTaskEvidenceText((prev) => ({ ...prev, [t.taskId]: e.target.value }))} placeholder="Evidence / review verdict sebelum done..." className="flex-1 px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50" />
                              <button onClick={() => handleAddEvidence(t)} disabled={taskActionLoading === `${t.taskId}:evidence`} className="px-3 py-2 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-40 transition-all">
                                Add Evidence
                              </button>
                            </div>
                            {t.evidence.length > 0 && (
                              <div>
                                <p className="text-[10px] text-emerald-300">{t.evidence.length} evidence tersimpan. Task bisa ditutup dari status review.</p>
                                {/* Quality Score from evaluation engine */}
                                {(() => {
                                  const qualityEv = t.evidence.find(e => e.quality_score !== undefined);
                                  if (!qualityEv || qualityEv.quality_score === undefined) return null;
                                  const score = qualityEv.quality_score;
                                  const verdict = qualityEv.quality_verdict ?? (score >= 80 ? "pass" : score >= 60 ? "needs_review" : "fail");
                                  const verdictColor = verdict === "pass" ? "text-emerald-400" : verdict === "needs_review" ? "text-amber-400" : "text-red-400";
                                  const barColor = verdict === "pass" ? "bg-emerald-500" : verdict === "needs_review" ? "bg-amber-500" : "bg-red-500";
                                  return (
                                    <div className="mt-2 p-2 bg-slate-900/60 border border-slate-700/50 rounded-lg">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Quality Score</p>
                                        <span className={`text-[11px] font-bold ${verdictColor}`}>{score}/100 · {verdict}</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
                                      </div>
                                      {qualityEv.quality_dimensions && qualityEv.quality_dimensions.length > 0 && (
                                        <div className="mt-1.5 space-y-0.5">
                                          {qualityEv.quality_dimensions.map((d, di) => (
                                            <div key={di} className="flex items-center justify-between">
                                              <span className="text-[9px] text-slate-500">{d.name.replace(/_/g, " ")}</span>
                                              <span className="text-[9px] text-slate-400 font-mono">{d.score}/{d.maxScore}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                            {t.contextDocumentsUsed && t.contextDocumentsUsed.length > 0 && (
                              <div className="mt-1 p-2 bg-indigo-500/5 border border-indigo-500/15 rounded-lg">
                                <p className="text-[9px] font-bold text-indigo-400 mb-1">📚 Memory Context ({t.contextDocumentsUsed.length} docs)</p>
                                {t.contextDocumentsUsed.map((doc, di) => (
                                  <p key={di} className="text-[9px] text-indigo-300/70">
                                    • {doc.title} <span className="text-indigo-400/40">({doc.category}, {(doc.score * 100).toFixed(0)}%)</span>
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap justify-end content-start gap-1.5">
                            {t.status === "queued" && (
                              <button onClick={() => handleTaskStatus(t, "planning")} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20">Plan</button>
                            )}
                            {t.status === "planning" && (
                              <button onClick={() => handleTaskStatus(t, "approved")} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20">Approve</button>
                            )}
                            {t.status === "approved" && (
                              <button onClick={() => handleTaskStatus(t, "running")} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20">Start</button>
                            )}
                            {t.status === "running" && (
                              <button onClick={() => handleTaskStatus(t, "review")} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20">Review</button>
                            )}
                            {t.status === "review" && (
                              <>
                                <button onClick={() => handleTaskStatus(t, "done")} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-green-500/10 text-green-300 border border-green-500/20 hover:bg-green-500/20">Done</button>
                                <button onClick={() => handleTaskStatus(t, "running")} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-700/70 text-slate-300 border border-slate-600/40 hover:bg-slate-700">Return</button>
                              </>
                            )}
                            {t.founderApprovalRequired && t.status !== "done" && t.status !== "archived" && (
                              <button onClick={() => handleRequestApproval(t)} disabled={taskActionLoading === `${t.taskId}:approval`} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-40">
                                Request Approval
                              </button>
                            )}
                            {t.status !== "blocked" && t.status !== "done" && t.status !== "archived" && (
                              <button onClick={() => handleTaskStatus(t, "blocked")} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20">Block</button>
                            )}
                            {t.status === "blocked" && (
                              <button onClick={() => handleTaskStatus(t, "planning")} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20">Resume</button>
                            )}
                            {t.status === "done" && (
                              <button onClick={() => handleTaskStatus(t, "archived")} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-700/70 text-slate-300 border border-slate-600/40 hover:bg-slate-700">Archive</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Agents Tab ── */}
            {activeTab === "agents" && (
              <>
                <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Colony Roster — Agent Registry</h2>
                {agents.length === 0 ? (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-8 text-center">
                    <p className="text-slate-500 text-sm">Colony belum di-bootstrap. Klik &quot;Bootstrap Colony&quot; di sidebar.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {agents.map((a) => (
                      <div key={a.agentId} className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xl">
                            {AGENT_ROLE_ICONS[a.role] ?? "●"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[13px] font-bold text-slate-100">{a.displayName}</p>
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${STATUS_COLORS[a.status]}`}>{a.status}</span>
                            </div>
                            <p className="text-[10px] font-mono text-slate-500 mb-2">{a.agentId}</p>
                            <div className="flex gap-4 text-[10px] text-slate-500">
                              <span>Tasks Done: <b className="text-slate-300">{a.totalTasksCompleted}</b></span>
                              {a.currentTaskId && <span>Current: <b className="text-emerald-400">{a.currentTaskId}</b></span>}
                              {a.lastHeartbeat && <span>Last: {relativeTime(a.lastHeartbeat)}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Chat Tab ── */}
            {activeTab === "chat" && (
              <div className="flex gap-4 h-[calc(100vh-7rem)]">
                {/* Room List */}
                <div className="w-56 flex-shrink-0 rounded-xl border border-slate-800/60 bg-slate-900/30 overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-800/60">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chat Rooms</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto py-1">
                    {rooms.length === 0 ? (
                      <p className="text-[11px] text-slate-600 px-4 py-3 italic">Bootstrap colony first.</p>
                    ) : rooms.map((r) => (
                      <button
                        key={r.roomId}
                        onClick={() => setActiveRoomId(r.roomId)}
                        className={`w-full text-left px-4 py-2.5 text-[12px] transition-all ${
                          activeRoomId === r.roomId
                            ? "bg-violet-600/15 text-violet-300 border-l-2 border-violet-500"
                            : "text-slate-400 hover:bg-slate-800/50 border-l-2 border-transparent"
                        }`}
                      >
                        <p className="font-semibold">{r.name}</p>
                        <p className="text-[9px] text-slate-600">{r.type} • {relativeTime(r.lastActivity)}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 rounded-xl border border-slate-800/60 bg-slate-900/30 flex flex-col overflow-hidden">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-slate-600 text-sm italic">Belum ada pesan di room ini.</p>
                      </div>
                    ) : messages.map((msg) => (
                      <div key={msg.messageId} className={`flex gap-3 ${msg.messageType === "system" ? "justify-center" : ""}`}>
                        {msg.messageType === "system" ? (
                          <p className="text-[10px] text-slate-600 italic bg-slate-800/30 px-3 py-1.5 rounded-full">{msg.content}</p>
                        ) : msg.messageType === "command" ? (
                          /* Command message — founder input with / prefix */
                          <>
                            <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-black bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                              ⌘
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-bold text-violet-300">{msg.senderName}</span>
                                <span className="text-[9px] font-mono text-violet-400/60 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">COMMAND</span>
                                <span className="text-[9px] text-slate-600">{relativeTime(msg.timestamp)}</span>
                              </div>
                              <p className="text-[12px] text-violet-200 font-mono leading-relaxed bg-violet-500/5 border border-violet-500/15 rounded-lg px-3 py-2">{msg.content}</p>
                            </div>
                          </>
                        ) : msg.messageType === "command_response" ? (
                          /* System response to command */
                          <>
                            <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-black bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                              ◈
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-bold text-cyan-300">Colony System</span>
                                <span className="text-[9px] font-mono text-cyan-400/60 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">RESPONSE</span>
                                <span className="text-[9px] text-slate-600">{relativeTime(msg.timestamp)}</span>
                                {msg.linkedTaskId && (
                                  <button onClick={() => setActiveTab("tasks")} className="text-[9px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20 hover:bg-violet-500/20 transition-all cursor-pointer">🔗 {msg.linkedTaskId}</button>
                                )}
                              </div>
                              <div className="text-[12px] text-cyan-100 leading-relaxed bg-cyan-500/5 border border-cyan-500/15 rounded-lg px-3 py-2 whitespace-pre-wrap">{msg.content}</div>
                            </div>
                          </>
                        ) : msg.messageType === "agent_ack" || msg.messageType === "agent_update" ? (
                          /* Agent acknowledgement or update */
                          <>
                            <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-black ${
                              msg.messageType === "agent_ack"
                                ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                                : "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                            }`}>
                              {AGENT_ROLE_ICONS[msg.senderRole] ?? "●"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-bold text-slate-200">{msg.senderName}</span>
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                                  msg.messageType === "agent_ack"
                                    ? "text-emerald-400/80 bg-emerald-500/10 border-emerald-500/20"
                                    : "text-amber-400/80 bg-amber-500/10 border-amber-500/20"
                                }`}>{msg.messageType === "agent_ack" ? "ACK" : "UPDATE"}</span>
                                <span className="text-[9px] text-slate-600">{relativeTime(msg.timestamp)}</span>
                                {msg.linkedTaskId && (
                                  <button onClick={() => setActiveTab("tasks")} className="text-[9px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20 hover:bg-violet-500/20 transition-all cursor-pointer">🔗 {msg.linkedTaskId}</button>
                                )}
                              </div>
                              <p className="text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </>
                        ) : msg.messageType === "directive" ? (
                          /* Founder directive — natural language command */
                          <>
                            <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-black bg-gradient-to-br from-orange-500 to-rose-500 text-white">
                              ✦
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-bold text-orange-300">{msg.senderName}</span>
                                <span className="text-[9px] font-mono text-orange-400/60 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">DIRECTIVE</span>
                                <span className="text-[9px] text-slate-600">{relativeTime(msg.timestamp)}</span>
                              </div>
                              <p className="text-[12px] text-orange-100 leading-relaxed bg-orange-500/5 border border-orange-500/15 rounded-lg px-3 py-2">{msg.content}</p>
                            </div>
                          </>
                        ) : msg.messageType === "directive_proposal" ? (
                          /* LLM-generated task proposals */
                          <>
                            <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-black bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
                              ◆
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-bold text-teal-300">{msg.senderName}</span>
                                <span className="text-[9px] font-mono text-teal-400/60 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">PROPOSALS</span>
                                <span className="text-[9px] text-slate-600">{relativeTime(msg.timestamp)}</span>
                              </div>
                              <div className="text-[12px] text-teal-100 leading-relaxed bg-teal-500/5 border border-teal-500/15 rounded-lg px-3 py-2 whitespace-pre-wrap">{msg.content}</div>
                            </div>
                          </>
                        ) : (
                          /* Regular text message */
                          <>
                            <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-black ${
                              msg.senderRole === "founder"
                                ? "bg-gradient-to-br from-red-500 to-amber-500 text-white"
                                : "bg-slate-700 text-slate-300"
                            }`}>
                              {msg.senderRole === "founder" ? "F" : (AGENT_ROLE_ICONS[msg.senderRole] ?? msg.senderName[0])}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-bold text-slate-200">{msg.senderName}</span>
                                <span className="text-[9px] text-slate-600">{relativeTime(msg.timestamp)}</span>
                                {msg.linkedTaskId && (
                                  <button onClick={() => setActiveTab("tasks")} className="text-[9px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20 hover:bg-violet-500/20 transition-all cursor-pointer">🔗 {msg.linkedTaskId}</button>
                                )}
                              </div>
                              <p className="text-[12px] text-slate-300 leading-relaxed">{msg.content}</p>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Chat Input */}
                  <div className="border-t border-slate-800/60 p-3 flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                      placeholder="Kirim arahan ke colony…"
                      className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={!chatInput.trim()}
                      className="px-5 py-2.5 rounded-xl text-[11px] font-bold bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] transition-all shadow-lg shadow-violet-600/20"
                    >
                      Send ↗
                    </button>
                  </div>
                  <div className="px-3 pb-2">
                    <p className="text-[9px] text-slate-600 font-mono">
                      Commands: /task &lt;agent&gt; &lt;title&gt; · /context &lt;query&gt; · /status · /approve &lt;taskId&gt; · /reject &lt;taskId&gt; · /mission &lt;title&gt; · /help
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Approvals Tab ── */}
            {/* Patch Review Tab */}
            {activeTab === "runtime" && (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">C6 Scheduler & Reporter Runtime</h2>
                    <p className="mt-1 text-xs text-slate-500">Observability untuk autonomous low-risk loop. Task berat tetap founder-gated.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleRuntimeTick} disabled={runtimeActionLoading !== ""} className="rounded-xl border border-violet-500/30 bg-violet-500/15 px-3 py-2 text-[11px] font-bold text-violet-300 transition-all hover:bg-violet-500/25 disabled:opacity-40">
                      {runtimeActionLoading === "tick" ? "Ticking..." : "Manual Tick"}
                    </button>
                    <button onClick={() => handleReporterRun("daily")} disabled={runtimeActionLoading !== ""} className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-[11px] font-bold text-emerald-300 transition-all hover:bg-emerald-500/25 disabled:opacity-40">
                      {runtimeActionLoading === "reporter:daily" ? "Posting..." : "Run Daily"}
                    </button>
                    <button onClick={() => handleReporterRun("weekly")} disabled={runtimeActionLoading !== ""} className="rounded-xl border border-blue-500/30 bg-blue-500/15 px-3 py-2 text-[11px] font-bold text-blue-300 transition-all hover:bg-blue-500/25 disabled:opacity-40">
                      {runtimeActionLoading === "reporter:weekly" ? "Posting..." : "Run Weekly"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Loop", value: schedulerStatus?.running ? "RUNNING" : "STOPPED", color: schedulerStatus?.running ? "text-emerald-300 border-emerald-500/20 bg-emerald-500/10" : "text-red-300 border-red-500/20 bg-red-500/10" },
                    { label: "Ticks", value: schedulerStatus?.tickCount ?? 0, color: "text-violet-300 border-violet-500/20 bg-violet-500/10" },
                    { label: "Claimed", value: schedulerStatus?.claimedCount ?? 0, color: "text-blue-300 border-blue-500/20 bg-blue-500/10" },
                    { label: "Last Skipped", value: schedulerStatus?.lastSkippedCount ?? 0, color: "text-amber-300 border-amber-500/20 bg-amber-500/10" },
                  ].map((item) => (
                    <div key={item.label} className={`rounded-xl border p-4 ${item.color}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{item.label}</p>
                      <p className="mt-1 text-xl font-black tracking-tight">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-800/70 bg-slate-900/30 p-5">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Scheduler State</h3>
                    <dl className="grid grid-cols-1 gap-3 text-xs">
                      <InfoRow label="Enabled" value={schedulerStatus?.enabled ? "true" : "false"} />
                      <InfoRow label="Interval" value={`${schedulerStatus?.intervalMs ?? 0} ms`} />
                      <InfoRow label="Reporter Check" value={`${schedulerStatus?.reporterCheckMs ?? 0} ms`} />
                      <InfoRow label="Last Tick" value={schedulerStatus?.lastTickAt ? relativeTime(schedulerStatus.lastTickAt) : "never"} />
                      <InfoRow label="Last Claimed Task" value={schedulerStatus?.lastClaimedTaskId ?? "-"} />
                      <InfoRow label="Total Skipped" value={String(schedulerStatus?.skippedCount ?? 0)} />
                      <InfoRow label="Last Reporter Check" value={schedulerStatus?.lastReporterCheckAt ? relativeTime(schedulerStatus.lastReporterCheckAt) : "never"} />
                    </dl>
                    {schedulerStatus?.lastError && (
                      <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{schedulerStatus.lastError}</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-800/70 bg-slate-900/30 p-5">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Reporter Preview</h3>
                    {reporterResult && (
                      <div className="mb-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                        Last manual run: <span className="font-bold text-slate-200">{reporterResult.cadence}</span> / {reporterResult.posted ? "posted" : reporterResult.reason ?? "skipped"}
                      </div>
                    )}
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] leading-relaxed text-slate-300">
                      {reporterSummary || "Reporter summary belum tersedia."}
                    </pre>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-xs leading-relaxed text-amber-200">
                    Guard aktif: task dengan keyword sensitif seperti patch, write, token, secret, deploy, scheduler, atau phase C6 akan tetap masuk founder approval, bukan autonomous.
                  </p>
                </div>
              </>
            )}

            {activeTab === "patches" && (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Patch Proposal Inbox</h2>
                    <p className="mt-1 text-xs text-slate-500">Review builder diffs, approve/apply, reject, and mark clean patches for training export.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"><div className="text-slate-500">Total</div><div className="text-slate-200 font-bold">{patchProposals.length}</div></div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"><div className="text-amber-500">Pending</div><div className="text-amber-300 font-bold">{patchProposals.filter((p) => p.status === "pending").length}</div></div>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"><div className="text-emerald-500">Applied</div><div className="text-emerald-300 font-bold">{patchProposals.filter((p) => p.status === "applied").length}</div></div>
                  </div>
                </div>

                {/* Verifier Summary Bar */}
                <div className="rounded-xl border border-slate-800/70 bg-slate-900/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Verification Status</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5"><div className="text-emerald-500">Passed</div><div className="text-emerald-300 font-bold">{patchProposals.filter((p) => p.verifierStatus === "verified").length}</div></div>
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-2 py-1.5"><div className="text-red-500">Failed</div><div className="text-red-300 font-bold">{patchProposals.filter((p) => p.verifierStatus === "failed").length}</div></div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1.5"><div className="text-amber-500">Pending</div><div className="text-amber-300 font-bold">{patchProposals.filter((p) => p.verifierStatus === "pending").length}</div></div>
                    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-2 py-1.5"><div className="text-orange-500">Missing</div><div className="text-orange-300 font-bold">{patchProposals.filter((p) => p.verifierStatus === "missing").length}</div></div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800/70 bg-slate-900/30 p-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Founder review note</label>
                  <textarea value={patchReviewNote} onChange={(event) => setPatchReviewNote(event.target.value)} rows={2} placeholder="LGTM, verified against task objective..." className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-violet-500/40 focus:outline-none" />
                  <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <input type="checkbox" checked={patchTrainingReady} onChange={(event) => setPatchTrainingReady(event.target.checked)} className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-violet-500" />
                    Mark approved patch as training data ready
                  </label>
                </div>

                {patchProposals.length === 0 ? (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-8 text-center"><p className="text-sm text-slate-500">Belum ada patch proposal dari builder.</p></div>
                ) : (
                  <div className="space-y-3">
                    {patchProposals.map((proposal) => (
                      <div key={proposal.proposalId} className={`rounded-xl border p-4 ${proposal.highRiskBlocked ? "border-red-500/40 bg-red-500/5" : proposal.verifierStatus === "failed" ? "border-red-500/30 bg-red-500/5" : "border-slate-800/70 bg-slate-900/30"}`}>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${STATUS_COLORS[proposal.status] ?? "border-slate-700 bg-slate-800 text-slate-400"}`}>{proposal.status}</span>
                              <span className={`text-[10px] font-bold uppercase ${PRIORITY_COLORS[proposal.estimatedRisk] ?? "text-slate-400"}`}>{proposal.estimatedRisk} risk</span>
                              {/* Verifier status badge */}
                              <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${VERIFIER_COLORS[proposal.verifierStatus ?? "missing"]}`}>{VERIFIER_LABELS[proposal.verifierStatus ?? "missing"]}</span>
                              <span className="text-[10px] font-mono text-slate-600">{proposal.proposalId}</span>
                              <span className="text-[10px] font-mono text-slate-600">{relativeTime(proposal.createdAt)}</span>
                            </div>
                            {/* High-risk blocked warning */}
                            {proposal.highRiskBlocked && (
                              <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                                <p className="text-[11px] font-bold text-red-300">⚠ HIGH-RISK BLOCKED — Verification required before approval</p>
                                <p className="text-[10px] text-red-400/80 mt-0.5">This high-risk patch cannot be approved/apply until verification passes. Current status: {VERIFIER_LABELS[proposal.verifierStatus ?? "missing"]}.</p>
                              </div>
                            )}
                            {/* Failed verification warning */}
                            {proposal.verifierStatus === "failed" && !proposal.highRiskBlocked && (
                              <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
                                <p className="text-[11px] font-bold text-red-300">✗ VERIFICATION FAILED — Approval blocked</p>
                              </div>
                            )}
                            <h3 className="text-sm font-semibold text-slate-100">{proposal.title}</h3>
                            <p className="mt-1 text-xs text-slate-500">Task {proposal.taskId} by {proposal.agentName}</p>
                            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-slate-400">{proposal.rationale}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {proposal.filesAffected.map((file) => (<span key={file} className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-[10px] font-mono text-slate-400">{file}</span>))}
                            </div>
                            {proposal.applyError && (<p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{proposal.applyError}</p>)}
                          </div>
                          <div className="flex flex-shrink-0 gap-2">
                            <button onClick={() => handlePatchDecision(proposal.proposalId, "approve")} disabled={proposal.status !== "pending" || patchActionLoading !== "" || proposal.highRiskBlocked === true || proposal.verifierStatus === "failed"} className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-[11px] font-bold text-emerald-300 transition-all hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">{patchActionLoading === `${proposal.proposalId}:approve` ? "..." : "Approve + Apply"}</button>
                            <button onClick={() => handlePatchDecision(proposal.proposalId, "reject")} disabled={proposal.status !== "pending" || patchActionLoading !== ""} className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-300 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40">{patchActionLoading === `${proposal.proposalId}:reject` ? "..." : "Reject"}</button>
                          </div>
                        </div>
                        {/* Verifier checks detail */}
                        {proposal.verifierChecks && proposal.verifierChecks.length > 0 && (
                          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Verification Checks</p>
                            <div className="space-y-1.5">
                              {proposal.verifierChecks.map((check) => (
                                <div key={check.name} className="flex items-center gap-2 text-[11px]">
                                  <span className={`inline-block w-4 text-center font-bold ${check.passed === true ? "text-emerald-400" : check.passed === false ? "text-red-400" : "text-slate-500"}`}>{check.passed === true ? "✓" : check.passed === false ? "✗" : "◌"}</span>
                                  <span className="font-mono text-slate-300">{check.name}</span>
                                  <span className="text-slate-600">({check.command})</span>
                                  {check.exitCode !== null && <span className="text-slate-600">exit:{check.exitCode}</span>}
                                  {check.executedAt && <span className="text-slate-600 ml-auto">{relativeTime(check.executedAt)}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-4 space-y-2">
                          {proposal.hunks.map((hunk, index) => (
                            <details key={`${proposal.proposalId}:${index}`} className="rounded-lg border border-slate-800 bg-slate-950/50">
                              <summary className="cursor-pointer px-3 py-2 text-[11px] font-mono text-slate-400 hover:text-slate-200">Hunk {index + 1}: {hunk.filePath} lines {hunk.startLine}-{hunk.endLine}</summary>
                              <pre className="max-h-72 overflow-auto border-t border-slate-800 p-3 text-[11px] leading-relaxed text-slate-300">{hunk.unifiedDiff || hunk.proposedContent}</pre>
                            </details>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "distillation" && (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Distillation Review Pool</h2>
                    <p className="mt-1 text-xs text-slate-500">Review screened cognitive records before they become durable training data.</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"><div className="text-slate-500">Total</div><div className="text-slate-200 font-bold">{distillationRecords.length}</div></div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"><div className="text-amber-500">Pending</div><div className="text-amber-300 font-bold">{distillationRecords.filter((r) => r.status === "pending_review").length}</div></div>
                    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2"><div className="text-violet-500">Review</div><div className="text-violet-300 font-bold">{distillationRecords.filter((r) => r.status === "needs_founder_review").length}</div></div>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"><div className="text-emerald-500">Accepted</div><div className="text-emerald-300 font-bold">{distillationRecords.filter((r) => r.status === "accepted" || r.status === "auto_accepted").length}</div></div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800/70 bg-slate-900/30 p-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Founder review note</label>
                  <textarea value={distillationReviewNote} onChange={(event) => setDistillationReviewNote(event.target.value)} rows={2} placeholder="Useful, grounded, safe for training..." className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-violet-500/40 focus:outline-none" />
                  <p className="mt-2 text-[11px] text-slate-500">Auto-accepted records export by default. High-risk or ambiguous records stay here for founder review.</p>
                </div>

                {distillationRecords.length === 0 ? (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-8 text-center"><p className="text-sm text-slate-500">Belum ada distillation record. Jalankan COG-4 auto-capture atau benchmark.</p></div>
                ) : (
                  <div className="space-y-3">
                    {distillationRecords.map((record) => (
                      <div key={record.recordId} className="rounded-xl border border-slate-800/70 bg-slate-900/30 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${STATUS_COLORS[record.status] ?? "border-slate-700 bg-slate-800 text-slate-400"}`}>{record.status.replace(/_/g, " ")}</span>
                              <span className="text-[10px] font-mono text-slate-600">{record.recordId}</span>
                              <span className="text-[10px] font-mono text-slate-600">{relativeTime(record.createdAt)}</span>
                              {record.benchmarkName && <span className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-300">{record.benchmarkName}</span>}
                            </div>
                            <h3 className="text-sm font-semibold text-slate-100">{record.question}</h3>
                            <p className="mt-3 line-clamp-4 max-w-4xl text-xs leading-relaxed text-slate-400">{record.answer}</p>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {record.tags.map((tag) => (<span key={`${record.recordId}:${tag}`} className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-[10px] font-mono text-slate-400">{tag}</span>))}
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 flex-wrap gap-2">
                            <button onClick={() => handleDistillationScreen(record.recordId)} disabled={record.status !== "pending_review" || distillationActionLoading !== ""} className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[11px] font-bold text-blue-300 transition-all hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40">{distillationActionLoading === `${record.recordId}:screen` ? "..." : "Screen"}</button>
                            <button onClick={() => handleDistillationReview(record.recordId, "accepted")} disabled={(record.status === "accepted" || record.status === "rejected") || distillationActionLoading !== ""} className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-[11px] font-bold text-emerald-300 transition-all hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40">{distillationActionLoading === `${record.recordId}:accepted` ? "..." : "Accept"}</button>
                            <button onClick={() => handleDistillationReview(record.recordId, "rejected")} disabled={(record.status === "accepted" || record.status === "rejected") || distillationActionLoading !== ""} className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-300 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40">{distillationActionLoading === `${record.recordId}:rejected` ? "..." : "Reject"}</button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
                          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Screening</p>
                            {record.screening ? (
                              <div className="space-y-2 text-[11px] text-slate-400">
                                <InfoRow label="Overall" value={`${Math.round(record.screening.overallScore * 100)}%`} />
                                <InfoRow label="Grounding" value={`${Math.round(record.screening.groundingScore * 100)}%`} />
                                <InfoRow label="Citation" value={`${Math.round(record.screening.citationScore * 100)}%`} />
                                <InfoRow label="Safety" value={`${Math.round(record.screening.safetyScore * 100)}%`} />
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {record.screening.reasons.map((reason) => (<span key={`${record.recordId}:${reason}`} className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] text-slate-400">{reason}</span>))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">Belum di-screen.</p>
                            )}
                          </div>
                          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Sources</p>
                            <div className="space-y-2">
                              {record.contextSources.length === 0 ? (
                                <p className="text-xs text-slate-500">No context sources.</p>
                              ) : record.contextSources.slice(0, 4).map((source, index) => (
                                <div key={`${record.recordId}:source:${index}`} className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-[11px] text-slate-400">
                                  <span className="text-slate-300">{source.title ?? source.source ?? "Untitled source"}</span>
                                  {typeof source.score === "number" && <span className="ml-2 text-slate-600">{source.score.toFixed(2)}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Lessons Tab (P-015) ── */}
            {activeTab === "lessons" && (
              <>
                {selectedLesson ? (
                  /* Lesson Detail View */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <button onClick={handleCloseLessonDetail} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-slate-200 transition-all">
                        ← Back to Lessons
                      </button>
                      <span className="text-[10px] font-mono text-slate-600">{selectedLesson.lessonId}</span>
                    </div>

                    {lessonLoading ? (
                      <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-8 text-center">
                        <p className="text-slate-500 text-sm animate-pulse">Loading lesson detail…</p>
                      </div>
                    ) : (
                      <>
                        {/* Lesson Header */}
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${LESSON_CATEGORY_COLORS[selectedLesson.category] ?? LESSON_CATEGORY_COLORS.general}`}>
                              {LESSON_CATEGORY_LABELS[selectedLesson.category] ?? selectedLesson.category}
                            </span>
                            {selectedLesson.score != null && (
                              <span className={`text-[11px] font-mono ${selectedLesson.score >= 80 ? "text-emerald-400" : selectedLesson.score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                                Score: {selectedLesson.score}
                              </span>
                            )}
                            <span className="text-[9px] font-mono text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{selectedLesson.source}</span>
                          </div>
                          <h2 className="text-[16px] font-bold text-slate-100">{selectedLesson.title}</h2>
                          <p className="text-[13px] text-slate-300 mt-2 whitespace-pre-wrap">{selectedLesson.content}</p>
                          <div className="flex gap-4 mt-3 text-[10px] text-slate-500">
                            <span>Created: {relativeTime(selectedLesson.createdAt)}</span>
                          </div>
                        </div>

                        {/* Provenance */}
                        <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
                          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Provenance</h3>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[12px]">
                              <span className="text-slate-500 w-20">Mission:</span>
                              {selectedLesson.mission ? (
                                <span className="text-slate-200 cursor-pointer hover:text-violet-400 transition-colors" onClick={() => { handleCloseLessonDetail(); setActiveTab("missions"); handleOpenMissionDetail(selectedLesson.missionId); }}>
                                  {selectedLesson.mission.title} <span className="text-[10px] font-mono text-slate-600">({selectedLesson.missionId})</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono">{selectedLesson.missionId}</span>
                              )}
                            </div>
                            <div className="flex items-start gap-2 text-[12px]">
                              <span className="text-slate-500 w-20">Tasks:</span>
                              <div className="flex flex-wrap gap-1">
                                {selectedLesson.taskIds.length === 0 ? (
                                  <span className="text-slate-600 italic">none</span>
                                ) : selectedLesson.relatedTasks ? (
                                  selectedLesson.relatedTasks.map((t) => (
                                    <span key={t.taskId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                                      {t.title}
                                      <span className={`ml-1 ${STATUS_COLORS[t.status] ?? "text-slate-500"}`}>{t.status}</span>
                                    </span>
                                  ))
                                ) : (
                                  selectedLesson.taskIds.map((tid) => (
                                    <span key={tid} className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-400">{tid}</span>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Tags */}
                        {selectedLesson.tags.length > 0 && (
                          <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
                            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Tags</h3>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedLesson.tags.map((tag) => (
                                <span key={tag} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/50 text-[10px] font-mono text-slate-400">{tag}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Redis-only notice */}
                        <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
                          <p className="text-[11px] text-amber-300/80">
                            ⚠ {selectedLesson.storageNote ?? "Lesson ini disimpan di Redis only. Tidak otomatis masuk Qdrant sovereign memory."}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  /* Lesson List View */
                  <>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lesson Memory</h2>
                        <p className="mt-1 text-[11px] text-slate-600">Lessons learned dari completed missions. Redis-only, tidak otomatis masuk Qdrant.</p>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 text-center text-[9px] font-mono">
                        {["quality_high", "quality_low", "blocked_pattern", "scope_change", "general"].map((cat) => (
                          <button key={cat} onClick={() => setLessonFilter(lessonFilter === cat ? "" : cat)}
                            className={`rounded-lg border px-2 py-1.5 transition-all ${lessonFilter === cat ? LESSON_CATEGORY_COLORS[cat] : "border-slate-800 bg-slate-900/40 text-slate-500 hover:text-slate-300"}`}>
                            <div className="font-bold">{lessons.filter(l => l.category === cat).length}</div>
                            <div className="truncate">{LESSON_CATEGORY_LABELS[cat]}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filtered lesson list */}
                    <div className="space-y-2">
                      {(() => {
                        const filtered = lessonFilter ? lessons.filter(l => l.category === lessonFilter) : lessons;
                        if (filtered.length === 0) {
                          return (
                            <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-8 text-center">
                              <p className="text-slate-500 text-sm">
                                {lessons.length === 0
                                  ? "Belum ada lesson. Lesson dibuat otomatis saat mission completed."
                                  : `Tidak ada lesson dengan kategori "${LESSON_CATEGORY_LABELS[lessonFilter] ?? lessonFilter}".`}
                              </p>
                            </div>
                          );
                        }
                        return filtered.map((l) => (
                          <div key={l.lessonId} className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4 cursor-pointer hover:border-amber-500/30 transition-all" onClick={() => handleOpenLessonDetail(l.lessonId)}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${LESSON_CATEGORY_COLORS[l.category] ?? LESSON_CATEGORY_COLORS.general}`}>
                                    {LESSON_CATEGORY_LABELS[l.category] ?? l.category}
                                  </span>
                                  {l.score != null && (
                                    <span className={`text-[10px] font-mono ${l.score >= 80 ? "text-emerald-400" : l.score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                                      QS:{l.score}
                                    </span>
                                  )}
                                  <span className="text-[9px] font-mono text-slate-600">{l.missionId}</span>
                                </div>
                                <p className="text-[14px] font-semibold text-slate-100">{l.title}</p>
                                <p className="text-[12px] text-slate-400 mt-1 line-clamp-2">{l.content}</p>
                                <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                                  <span>{relativeTime(l.createdAt)}</span>
                                  <span>{l.taskIds.length} task{l.taskIds.length !== 1 ? "s" : ""}</span>
                                  {l.tags.length > 0 && <span>{l.tags.length} tags</span>}
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-600 font-mono whitespace-nowrap">{l.lessonId}</p>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Redis-only global notice */}
                    <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-3">
                      <p className="text-[10px] text-amber-300/70">
                        ⚠ Semua lesson disimpan di Redis only. Lesson tidak otomatis masuk Qdrant sovereign memory. T-040 (lesson retrieval into planner) masih dalam persiapan.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {activeTab === "modelArena" && (() => {
              const data = modelArenaData ?? { summaries: [], runtimeStats: [], runtimeEvents: [], recommendations: [] };
              const taskTypes = [...new Set([
                ...data.summaries.map((summary) => summary.taskType),
                ...data.runtimeStats.map((stat) => stat.taskType),
                ...data.runtimeEvents.map((event) => event.taskType),
              ])];
              const totalRuntime = data.runtimeStats.reduce((sum, stat) => sum + stat.totalEvents, 0);
              const totalSuccess = data.runtimeStats.reduce((sum, stat) => sum + stat.successCount, 0);

              return (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Model Arena</h2>
                      <p className="mt-1 text-[11px] text-slate-600">Founder-visible model performance. Advisory only, no automatic routing.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                      <span className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-2.5 py-1.5 text-violet-300">advisory_only</span>
                      <span className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-slate-400">redis_only</span>
                      <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-300">no raw prompt/output</span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Scored Summaries" value={data.summaries.length} tone="violet" />
                    <StatCard label="Runtime Events" value={data.runtimeEvents.length} tone="blue" />
                    <StatCard label="Task Types" value={taskTypes.length} tone="emerald" />
                    <StatCard label="Runtime Success" value={successRate(totalSuccess, totalRuntime)} tone="amber" />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Advisory Recommendations</h3>
                        <span className="text-[10px] text-slate-600">{data.recommendations.length} task type</span>
                      </div>
                      {data.recommendations.length === 0 ? (
                        <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-center text-sm text-slate-500">Belum ada scored arena data untuk rekomendasi.</p>
                      ) : (
                        <div className="space-y-2">
                          {data.recommendations.map((item) => (
                            <div key={item.taskType} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-mono text-xs text-slate-300">{item.taskType}</span>
                                <span className="rounded border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300">Advisory</span>
                              </div>
                              {item.recommendation ? (
                                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                                  <span className="font-semibold text-slate-200">{item.recommendation.modelId}</span>
                                  <span className="text-slate-600"> - </span>
                                  score {item.recommendation.avgScore}/100, latency {formatLatency(item.recommendation.avgLatencyMs)}
                                </p>
                              ) : (
                                <p className="mt-2 text-xs text-slate-500">Belum cukup scored sample untuk rekomendasi.</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Runtime Stats</h3>
                        <span className="text-[10px] text-slate-600">from worker events</span>
                      </div>
                      {data.runtimeStats.length === 0 ? (
                        <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-center text-sm text-slate-500">Belum ada runtime event. Jalankan worker LLM task untuk mengisi arena.</p>
                      ) : (
                        <div className="space-y-2">
                          {data.runtimeStats.map((stat) => (
                            <div key={`${stat.modelId}:${stat.taskType}`} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-mono text-xs text-slate-200">{stat.modelId}</p>
                                  <p className="mt-0.5 text-[10px] text-slate-600">{stat.taskType} - last {relativeTime(stat.lastRecordedAt)}</p>
                                </div>
                                <span className={`rounded border px-2 py-1 text-[10px] font-bold ${stat.failedCount > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
                                  {successRate(stat.successCount, stat.totalEvents)} success
                                </span>
                              </div>
                              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px]">
                                <InfoPill label="Events" value={String(stat.totalEvents)} />
                                <InfoPill label="OK" value={String(stat.successCount)} />
                                <InfoPill label="Fail" value={String(stat.failedCount)} />
                                <InfoPill label="Latency" value={formatLatency(stat.avgLatencyMs)} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Scored Performance Summary</h3>
                      <span className="text-[10px] text-slate-600">manual/benchmark/runtime score records</span>
                    </div>
                    {data.summaries.length === 0 ? (
                      <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-center text-sm text-slate-500">Belum ada scored summary. Runtime event sudah bisa terkumpul, score bisa ditambahkan dari benchmark/manual arena.</p>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Model</th>
                              <th className="px-3 py-2">Task Type</th>
                              <th className="px-3 py-2">Score</th>
                              <th className="px-3 py-2">Latency</th>
                              <th className="px-3 py-2">Samples</th>
                              <th className="px-3 py-2">Recommendation</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                            {data.summaries.map((summary) => (
                              <tr key={`${summary.modelId}:${summary.taskType}`}>
                                <td className="px-3 py-2 font-mono text-slate-200">{summary.modelId}</td>
                                <td className="px-3 py-2 font-mono text-slate-400">{summary.taskType}</td>
                                <td className="px-3 py-2 text-slate-300">{summary.avgScore == null ? "-" : `${summary.avgScore}/100`}</td>
                                <td className="px-3 py-2 text-slate-400">{formatLatency(summary.avgLatencyMs)}</td>
                                <td className="px-3 py-2 text-slate-400">{summary.sampleCount}</td>
                                <td className="px-3 py-2 text-slate-500">{summary.recommendation}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Recent Runtime Events</h3>
                      <span className="text-[10px] text-slate-600">safe metadata only</span>
                    </div>
                    {data.runtimeEvents.length === 0 ? (
                      <p className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-center text-sm text-slate-500">Belum ada runtime event terbaru.</p>
                    ) : (
                      <div className="space-y-2">
                        {data.runtimeEvents.slice(0, 12).map((event) => (
                          <div key={event.eventId} className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs md:grid-cols-[1.4fr_0.7fr_0.8fr_0.7fr_1fr] md:items-center">
                            <div className="min-w-0">
                              <p className="truncate font-mono text-slate-200">{event.modelId}</p>
                              <p className="mt-0.5 truncate text-[10px] text-slate-600">{event.eventId}</p>
                            </div>
                            <span className="font-mono text-slate-400">{event.taskType}</span>
                            <span className={`w-fit rounded border px-2 py-1 text-[10px] font-bold ${event.outcome === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
                              {event.outcome}
                            </span>
                            <span className="font-mono text-slate-400">{formatLatency(event.latencyMs)}</span>
                            <div className="text-slate-500">
                              <p>{relativeTime(event.recordedAt)}</p>
                              <p className="text-[10px] text-slate-600">{event.agentRole ?? event.source}{event.errorCode ? ` - ${event.errorCode}` : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {activeTab === "approvals" && (
              <>
                <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Founder Approval Inbox</h2>
                {approvals.length === 0 ? (
                  <div className="rounded-xl border border-slate-800/60 bg-slate-900/30 p-8 text-center">
                    <p className="text-slate-500 text-sm">Tidak ada approval yang menunggu.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {approvals.map((a) => (
                      <div key={a.approvalId} className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[9px] font-bold text-amber-400 uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{a.type.replace(/_/g, " ")}</span>
                              <span className="text-[9px] font-mono text-slate-600">{a.taskId}</span>
                            </div>
                            <p className="text-[13px] font-semibold text-slate-100">{a.description}</p>
                            <p className="text-[10px] text-slate-500 mt-1">Requested by {a.requestedBy} • {relativeTime(a.requestedAt)}</p>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button 
                              onClick={() => handleApproval(a.approvalId, "approved")} 
                              disabled={approvalActionLoading === a.approvalId} 
                              className="px-4 py-2 rounded-xl text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 transition-all active:scale-[0.97]"
                            >
                              {approvalActionLoading === a.approvalId ? "…" : "✓ Approve"}
                            </button>
                            <button 
                              onClick={() => handleApproval(a.approvalId, "rejected")} 
                              disabled={approvalActionLoading === a.approvalId} 
                              className="px-4 py-2 rounded-xl text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40 transition-all active:scale-[0.97]"
                            >
                              {approvalActionLoading === a.approvalId ? "…" : "✕ Reject"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "workflow" && (
              <>
                <div className="mb-6">
                  <h2 className="text-[18px] font-bold text-slate-100">AI Workflow Map</h2>
                  <p className="text-[12px] text-slate-500 mt-1">Bagaimana setiap pesan Telegram diproses oleh orkestra AI — siapa pakai apa, kapan, dan mengapa.</p>
                </div>

                {/* Flow Diagram */}
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 mb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4">Alur Proses — Telegram → Laporan</p>
                  <div className="overflow-x-auto">
                    <div className="flex items-start gap-2 min-w-[900px]">
                      {/* Step 1 */}
                      <div className="flex flex-col items-center">
                        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-center w-[110px]">
                          <div className="text-lg mb-1">📱</div>
                          <p className="text-[11px] font-bold text-blue-300">Telegram</p>
                          <p className="text-[9px] text-slate-500">Perintah Mas Fatur</p>
                        </div>
                      </div>
                      <div className="flex items-center mt-6 text-slate-600 text-lg">→</div>
                      {/* Step 2 */}
                      <div className="flex flex-col items-center">
                        <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-3 text-center w-[120px]">
                          <div className="text-lg mb-1">🔀</div>
                          <p className="text-[11px] font-bold text-purple-300">OpenClaw</p>
                          <p className="text-[9px] text-slate-500">Router + Classifier</p>
                          <div className="mt-2 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5">
                            <p className="text-[8px] text-emerald-400">Groq LPU — cepat</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center mt-6 text-slate-600 text-lg">→</div>
                      {/* Step 3 */}
                      <div className="flex flex-col items-center">
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center w-[130px]">
                          <div className="text-lg mb-1">🧠</div>
                          <p className="text-[11px] font-bold text-amber-300">JARVIS</p>
                          <p className="text-[9px] text-slate-500">ReAct Manager</p>
                          <div className="mt-2 rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5">
                            <p className="text-[8px] text-cyan-400">Gemini — pintar</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center mt-6 text-slate-600 text-lg">→</div>
                      {/* Step 4 — Branch */}
                      <div className="flex flex-col gap-2">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-3 py-2.5 text-center w-[140px]">
                          <p className="text-[10px] font-bold text-emerald-300">⚡ Groq LPU</p>
                          <p className="text-[9px] text-slate-500">Scraping / parsing cepat</p>
                        </div>
                        <div className="rounded-xl border border-orange-500/30 bg-orange-500/8 px-3 py-2.5 text-center w-[140px]">
                          <p className="text-[10px] font-bold text-orange-300">🔒 Ollama Lokal</p>
                          <p className="text-[9px] text-slate-500">Coding privat</p>
                        </div>
                        <div className="rounded-xl border border-pink-500/30 bg-pink-500/8 px-3 py-2.5 text-center w-[140px]">
                          <p className="text-[10px] font-bold text-pink-300">🌐 Browser Agent</p>
                          <p className="text-[9px] text-slate-500">Puppeteer browsing</p>
                        </div>
                        <div className="rounded-xl border border-slate-400/30 bg-slate-400/8 px-3 py-2.5 text-center w-[140px]">
                          <p className="text-[10px] font-bold text-slate-300">🐙 GitHub Tools</p>
                          <p className="text-[9px] text-slate-500">Clone, PR, Bounty</p>
                        </div>
                      </div>
                      <div className="flex items-center mt-6 text-slate-600 text-lg">→</div>
                      {/* Step 5 */}
                      <div className="flex flex-col items-center">
                        <div className="rounded-xl border border-teal-500/40 bg-teal-500/10 px-4 py-3 text-center w-[120px]">
                          <div className="text-lg mb-1">📊</div>
                          <p className="text-[11px] font-bold text-teal-300">Laporan</p>
                          <p className="text-[9px] text-slate-500">Telegram balik</p>
                          <div className="mt-2 rounded border border-teal-500/20 bg-teal-500/10 px-1.5 py-0.5">
                            <p className="text-[8px] text-teal-400">+ USDT Payout</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Routing Logic Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-purple-400 mb-2">🔀 OpenClaw — Resepsionis</p>
                    <p className="text-[12px] text-slate-400 leading-relaxed">Menerima semua pesan Telegram. Tugasnya <span className="text-slate-200 font-medium">hanya mengklasifikasikan</span> — apakah ini chat santai, JARVIS_MODE, atau SEO task. Menggunakan <span className="text-emerald-400">Groq LPU</span> karena butuh respons &lt;1 detik.</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400 mb-2">🧠 JARVIS — Manajer</p>
                    <p className="text-[12px] text-slate-400 leading-relaxed">Otak perencana. Memecah tugas menjadi langkah-langkah kecil, memutuskan tool apa yang dipanggil. Menggunakan <span className="text-cyan-400">Gemini 1.5 Flash</span> karena kemampuan Function Calling-nya stabil dan akurat.</p>
                  </div>
                  <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400 mb-2">🔒 Ollama — Privasi</p>
                    <p className="text-[12px] text-slate-400 leading-relaxed">Untuk tugas coding yang sensitif atau butuh privasi penuh. Berjalan 100% lokal di VPS <span className="text-slate-200 font-medium">tanpa data keluar</span> ke API manapun.</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-2">⚡ Groq — Kecepatan</p>
                    <p className="text-[12px] text-slate-400 leading-relaxed">Untuk parsing HTML dari web scraping, membaca dan merangkum teks panjang. LPU (Language Processing Unit) <span className="text-emerald-400">tercepat di dunia</span> untuk inferensi LLM.</p>
                  </div>
                  <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-pink-400 mb-2">🌐 Browser Agent</p>
                    <p className="text-[12px] text-slate-400 leading-relaxed">Puppeteer headless yang dikendalikan AI. Bisa membuka website, klik, scroll, dan mengekstrak data secara otonom. <span className="text-slate-200 font-medium">Mata dan tangan JAGAT</span> di internet.</p>
                  </div>
                  <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-teal-400 mb-2">🐙 GitHub Bounty</p>
                    <p className="text-[12px] text-slate-400 leading-relaxed">Mencari issue berlabel <code className="text-teal-400 bg-teal-500/10 px-1 rounded">bounty</code>, clone repo, tulis patch, submit PR dengan <span className="text-teal-400">alamat USDT</span> Anda otomatis di deskripsi.</p>
                  </div>
                </div>

                {/* Decision Matrix */}
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4">Kapan Pakai AI Yang Mana?</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left py-2 pr-4 text-slate-500 font-semibold">Jenis Tugas</th>
                          <th className="text-left py-2 pr-4 text-slate-500 font-semibold">AI yang Dipakai</th>
                          <th className="text-left py-2 text-slate-500 font-semibold">Alasan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {[
                          { task: "Routing pesan Telegram", ai: "Groq", reason: "Butuh &lt;1 detik, tugas sederhana" },
                          { task: "Planning & Function Calling", ai: "Gemini Flash", reason: "Stabil, akurat, gratis" },
                          { task: "Parsing HTML / Scraping", ai: "Groq", reason: "Token throughput sangat tinggi" },
                          { task: "Coding privat / sensitif", ai: "Ollama Lokal", reason: "Zero data leakage" },
                          { task: "Reasoning kompleks", ai: "Gemini Pro", reason: "Konteks window besar" },
                          { task: "Browse web otonom", ai: "Groq + Puppeteer", reason: "Kecepatan + browser control" },
                          { task: "Submit GitHub PR", ai: "GitHub API + JARVIS", reason: "Struktur pasti, tidak perlu LLM" },
                        ].map((row, i) => (
                          <tr key={i}>
                            <td className="py-2.5 pr-4 text-slate-300">{row.task}</td>
                            <td className="py-2.5 pr-4">
                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">{row.ai}</span>
                            </td>
                            <td className="py-2.5 text-slate-500" dangerouslySetInnerHTML={{ __html: row.reason }} />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-slate-200">{value}</dd>
    </div>
  );
}

function StatCard({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: "slate" | "violet" | "blue" | "emerald" | "amber" }) {
  const tones: Record<string, string> = {
    slate: "border-slate-800 bg-slate-900/40 text-slate-200",
    violet: "border-violet-500/20 bg-violet-500/10 text-violet-200",
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-200",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone] ?? tones.slate}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-2 font-mono text-2xl font-bold">{value}</p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-0.5 truncate font-mono text-slate-300">{value}</p>
    </div>
  );
}
