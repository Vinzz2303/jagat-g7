/** Read-only evidence-based mission planning review (NO autonomous side effects). */
import type { Mission, ColonyTask, TaskStatus } from "./types.js";

export interface MissionReviewItem {
  taskId: string;
  status: TaskStatus;
  issue: "blocked" | "missing_dependency" | "waiting_dependency" | "needs_approval" | "review_required" | "stale_running" | "stale_planning" | "ready_to_plan";
  reason: string;
  suggestedNextStep: string;
}

export interface MissionReview {
  missionId: string;
  evaluatedAt: string;
  progress: { total: number; done: number; blocked: number; pending: number };
  health: "complete" | "attention" | "on_track" | "empty";
  recommendations: MissionReviewItem[];
  /** No action is executed and no success is inferred from an LLM's text. */
  advisoryOnly: true;
}

export function reviewMission(mission: Mission, tasks: ColonyTask[], now = new Date()): MissionReview {
  const byId = new Map(tasks.map(t => [t.taskId, t]));
  const done = tasks.filter(t => t.status === "done" || t.status === "archived").length;
  const blocked = tasks.filter(t => t.status === "blocked").length;
  const recommendations: MissionReviewItem[] = [];
  for (const task of tasks) {
    if (task.status === "done" || task.status === "archived") continue;
    const add = (issue: MissionReviewItem["issue"], reason: string, suggestedNextStep: string) =>
      recommendations.push({ taskId: task.taskId, status: task.status, issue, reason, suggestedNextStep });

    if (task.status === "blocked") {
      add("blocked", task.blockedReason ?? "No failure reason recorded", "Review the blocker and plan a human-approved retry");
      continue;
    }
    const missing = task.dependencies.find(id => !byId.has(id));
    if (missing) {
      add("missing_dependency", `Dependency ${missing} does not belong to this mission`, "Verify task references before execution");
      continue;
    }
    const waiting = task.dependencies.find(id => {
      const dep = byId.get(id);
      return dep && dep.status !== "done" && dep.status !== "archived";
    });
    if (waiting) {
      add("waiting_dependency", `Dependency ${waiting} is not completed`, "Complete prerequisite work first");
      continue;
    }
    if (task.founderApprovalRequired && task.status !== "approved") {
      add("needs_approval", "Task is gated by founder approval", "Request explicit founder approval");
      continue;
    }
    if (task.status === "review") {
      add("review_required", "Output is waiting for independent verification", "Verify evidence against acceptance criteria");
      continue;
    }
    const elapsed = now.getTime() - Date.parse(task.lastUpdate);
    if ((task.status === "running" || task.status === "planning") && Number.isFinite(elapsed) && elapsed > 30 * 60_000) {
      const issue = task.status === "planning" ? "stale_planning" : "stale_running";
      add(issue, `No task state update for at least 30 minutes while ${task.status}`, "Inspect worker and external side effects before any retry");
      continue;
    }
    if (task.status === "queued" || task.status === "planning") {
      add("ready_to_plan", "No unfinished dependencies found", "Evaluate readiness and schedule only within autonomy policy");
    }
  }
  return {
    missionId: mission.id,
    evaluatedAt: now.toISOString(),
    progress: { total: tasks.length, done, blocked, pending: tasks.length - done - blocked },
    health: tasks.length === 0 ? "empty" : done === tasks.length ? "complete" : recommendations.some(r =>
      ["blocked", "missing_dependency", "stale_running", "stale_planning"].includes(r.issue)) ? "attention" : "on_track",
    recommendations,
    advisoryOnly: true,
  };
}
