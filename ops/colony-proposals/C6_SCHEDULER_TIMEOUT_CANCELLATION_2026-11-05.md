# Proposal: C6 Scheduler Timeout and In-Flight Work

Date: 2026-11-05
Status: Requires review before implementation

## Finding

`src/colony/scheduler-loop.ts` wraps `runTickInner()` with `Promise.race([tickPromise, timeoutPromise])`. If the timeout wins, the race rejects and `runSchedulerTick()` clears the process-wide `tickInProgress` flag in its `finally` block. The losing `tickPromise` is not cancelled: it may continue through task claims, worker dispatch, status changes, audit writes, or notifications after the caller sees a timeout. A subsequent scheduled or founder-triggered tick can then start while the prior tick still performs side effects.

The current comment describes the timeout as protection against a permanent lock, but does not state that the underlying operations continue. Existing queue claims and worker locks may reduce duplicate execution, but they do not prove that an entire tick is safe to overlap after timeout.

## Scope and constraints

- Keep current task policy, role permissions, approval gates, and queue semantics unchanged.
- Do not claim that `Promise.race` cancels Redis, worker, or notification operations.
- No production/runtime operation was used to reproduce this; BFF and Qdrant health were already failing.
- Treat this as a scheduler correctness issue requiring controlled delayed-operation tests before implementation.

## Candidate approaches for review

1. **Drain-before-next-tick:** retain the in-flight guard until the underlying tick promise settles even if the caller receives a timeout. Add a drain status and ensure shutdown/status reporting distinguishes timed-out from still-running work.
2. **Cooperative cancellation:** pass an `AbortSignal` through each cancellable downstream operation, and verify side effects stop or reach a safe boundary before releasing the guard. Non-cancellable operations still require drain-before-next-tick.
3. **Durable lease recovery:** if an operation can outlive the process, use existing scheduler claim/task lease semantics and reconcile stale claims before redispatch. This needs concurrency and crash analysis.

No approach is selected by this proposal.

## Acceptance criteria

- A delayed tick exceeding the configured timeout reports timeout to the caller and remains marked in-flight until actual work is drained or cooperatively cancelled.
- A second scheduled or manual tick during that period performs no claim or dispatch.
- After drain/cancellation, a later tick proceeds normally.
- Tests cover timeout before claim, timeout after claim, timeout during dispatch, rejection cleanup, and shutdown behavior.
- Audit, claim-release, task status, and reporter side effects remain consistent; no duplicate worker dispatch occurs.
- Typecheck, build, and relevant C6 scheduler suite pass; runtime rollout occurs only in an approved maintenance window.

## Existing test harness limitation

`scripts/c6-scheduler-reporter-test.mjs` is a live integration test: it bootstraps Colony, creates tasks, mutates task state in Redis to simulate stale work, triggers authenticated manual ticks, and forces a daily reporter post. It is not safe or suitable as an offline reproduction for this timeout finding. Current health is BFF 503 and Qdrant unavailable, so the live suite was not run. The timeout regression should first be covered by a deterministic isolated harness with injected delayed dependencies; the live C6 suite can run later in a controlled environment after its task/report side effects are reviewed.
