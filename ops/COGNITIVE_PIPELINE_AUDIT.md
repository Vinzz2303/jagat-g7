# JAGAT G7 Cognitive Pipeline Audit

Date: 2026-05-31
Scope: `src/agents/research.ts`, `src/prompts/cognitive.ts`, `scripts/cognitive-benchmark.mjs`

## Executive Summary

The cognitive layer already exists and is online. Qdrant, Ollama/local Llama, memory retrieval, cognitive prompt policy, and benchmark coverage are present. The current gap is not "setup missing"; the real gap is turning the existing RAG + cognitive prompt system into a repeatable cognitive distillation pipeline with stronger evaluation and training-record capture.

## Current Architecture

1. User asks a research question.
2. `researchAgent` detects answer mode via `detectAnswerMode(topic)`.
3. `buildCognitiveSystemPrompt(mode)` builds the policy stack:
   - memory-first behavior
   - deduction policy
   - refusal policy
   - executive/technical/risk/general format
4. Topic is embedded with `nomic-embed-text`.
5. Qdrant retrieval runs hybrid search:
   - dense vector candidates
   - sparse keyword candidates
   - weighted merge and threshold filtering
6. Retrieved memory chunks are filtered for prompt-leak and feedback-loop markers.
7. A final prompt is sent to the local inference model through Ollama.
8. Streaming mode returns metadata with `contextSources`; non-streaming mode returns the answer and context count.

## What Is Already Strong

- Local model path is present.
- Qdrant-backed memory retrieval is present.
- Hybrid dense + sparse retrieval is present.
- Cognitive system prompt is centralized.
- Ingest rejects malformed or feedback-loop knowledge.
- Existing benchmark checks identity, prompt leakage, metadata validation, fixture retrieval, and Qdrant pollution.

## Real Residual Gaps

| Gap | Severity | Notes |
| --- | --- | --- |
| Distillation loop not formalized | High | Current system answers well, but does not yet convert validated answers into reusable training/evaluation records automatically. |
| Citation correctness not fully scored | Medium | Streaming returns `contextSources`, but benchmark does not yet verify every citation maps to a retrieved source. |
| Context prompt still contains internal directive labels | Medium | The context-grounded prompt includes internal headings. Benchmark guards leakage, but the prompt can be cleaner. |
| Mode routing is regex-based | Low-Medium | Good enough now, but no confidence score or telemetry for routing mistakes. |
| Streaming and non-streaming audit surfaces differ | Low | Streaming exposes `contextSources`; non-streaming only exposes context count. |
| Founder strategic planning benchmark is thin | Medium | Need explicit tests for planning quality, refusal, no-context honesty, and source discipline. |

## Small Implementation Proposal

Do not rewrite the pipeline. Improve it in small, testable layers:

1. Add a cognitive distillation benchmark suite.
   - memory-grounded answer
   - citation-source alignment
   - no-context honesty
   - refusal without prompt leakage
   - founder strategic planning

2. Add citation verifier helper.
   - Extract citations from model output.
   - Match citation labels against `contextSources`.
   - Fail benchmark if citation is fabricated.

3. Clean model-visible prompt labels.
   - Remove or soften internal labels such as directive/threshold wording from the user-visible prompt body.
   - Keep operational metadata in code/logs, not model-visible content.

4. Add distillation record capture.
   - Store: question, mode, retrieved source IDs, answer, citations, benchmark score, accepted/rejected flag.
   - Only accepted founder-reviewed records should enter training export.

5. Add route/command later.
   - `/cognitive-audit`
   - `/distill-export`
   - Keep founder-only.

## MiMo Safe Handoff

Use this prompt for MiMo/light worker:

```text
TASK: Cognitive Pipeline Audit Support

Read ops/COGNITIVE_PIPELINE_AUDIT.md only.

Do not modify runtime, env, model, token, deploy, auth, or billing.
Do not rewrite the research agent.

Goal:
1. Propose benchmark cases for:
   - memory-grounded answer
   - citation correctness
   - refusal without prompt leakage
   - no-context honesty
   - founder strategic planning
2. Suggest minimal test assertions.
3. Return a small implementation plan only.

Output:
- BENCHMARK CASES
- EXPECTED ASSERTIONS
- RISKS
- NEXT PATCH PROPOSAL
```

## Recommended Next Codex Task

Implement the benchmark and verifier first. After tests are stable, add distillation record capture. This keeps the cognitive pipeline measurable before making it autonomous.

## COG-1 Implementation Result

Status: PASS — 2026-05-31

Implemented:

- `scripts/cognitive-verifier.mjs`
  - extracts `[Sumber: ...]` citations
  - verifies citations against `contextSources`
  - rejects fabricated citation labels
  - blocks internal prompt label leakage

- `scripts/cognitive-distillation-benchmark.mjs`
  - backend cognitive health
  - citation verifier positive/negative cases
  - memory-grounded answer with context filter
  - no-context answer without fabricated citation
  - refusal without internal prompt leakage
  - founder strategic planning quality gate

- `src/index.ts`
  - internal prompt disclosure fast-path refusal
  - expanded SSE stream leak guard patterns

- `src/agents/research.ts`
  - cleaned model-visible prompt labels
  - removed internal directive/threshold wording from context prompt
  - preserved citation and memory-grounding requirements

Verification:

```text
npm run typecheck PASS
npm run build PASS
npm run ops:restart PASS 3/3
npm run benchmark:distillation PASS 7/7
```

Conclusion:

JAGAT G7 is not yet equivalent to a full Claude/Mythos-level autonomous mind, but it now has a measurable cognitive readiness gate. The next step is COG-2: distillation record capture, where accepted answers become founder-reviewable training records.

## COG-2 Implementation Result

Status: PASS — 2026-05-31

Implemented:

- `src/colony/distillation-engine.ts`
  - creates cognitive distillation records
  - stores records in Redis
  - enforces `pending_review -> accepted/rejected`
  - rejects double review
  - exports accepted records in instruction/input/output training format

- `src/colony/routes.ts`
  - `POST /colony/distillation/records`
  - `GET /colony/distillation/records`
  - `PATCH /colony/distillation/records/:recordId`
  - `GET /colony/distillation/export`
  - all routes are founder-only

- `src/colony/types.ts`
  - Redis keys for distillation records/index/status
  - audit actions: `distillation.capture`, `distillation.review`, `distillation.export`

- `scripts/cog2-distillation-record-test.mjs`
  - unauthenticated rejection
  - record capture
  - pending list
  - founder accept
  - double-review rejection
  - JSON export
  - JSONL export

Verification:

```text
npm run typecheck PASS
npm run build PASS
npm run ops:restart PASS 3/3
npm run test:distillation PASS 15/15
```

Conclusion:

JAGAT G7 now has a founder-reviewed cognitive distillation pool. The system can preserve high-quality answers as training candidates without automatically trusting model output. Next step: COG-3 UI review surface and optional benchmark auto-capture.

## COG-3 Screening Layer Result

Status: PASS — 2026-05-31

Implemented:

- Colony-side screening assessment in `src/colony/distillation-engine.ts`
  - grounding score
  - citation score
  - safety score
  - usefulness score
  - overall score
  - reasons list

- New distillation statuses:
  - `pending_review`
  - `auto_accepted`
  - `needs_founder_review`
  - `accepted`
  - `rejected`

- New route:
  - `POST /colony/distillation/records/:recordId/screen`

Policy:

- Clean, grounded, cited, useful records can become `auto_accepted`.
- High-risk records become `needs_founder_review`.
- Prompt leaks or very low-quality records become `rejected`.
- Training export defaults to `accepted + auto_accepted`.

Verification:

```text
npm run typecheck PASS
npm run build PASS
npm run ops:restart PASS 3/3
npm run test:distillation PASS 24/24
```

Conclusion:

Founder is no longer the default manual filter. Colony now screens distillation records first and only escalates ambiguous/high-risk records to founder review.

## COG-4 Auto-Capture Result

Implemented:

- `scripts/cog4-auto-capture.mjs`
  - exports `captureAndScreenDistillationCandidate()`
  - local guard skips short, failed, or prompt-leaky candidates
  - creates distillation record via founder-only Colony API
  - immediately runs Colony screening
- `scripts/cognitive-distillation-benchmark.mjs`
  - opt-in auto-capture with `COG4_AUTO_CAPTURE=true`
  - default benchmark remains non-polluting
  - memory-grounded and strategic-planning benchmark outputs can become screened distillation records
- `scripts/cog4-auto-capture-test.mjs`
  - verifies skipped weak candidates
  - verifies safe candidate becomes `auto_accepted`
  - verifies export includes auto-captured record
  - verifies high-risk candidate becomes `needs_founder_review`

Verification:

```text
npm run typecheck PASS
npm run build PASS
npm run ops:health PASS 3/3
npm run test:autocapture PASS 10/10
npm run test:distillation PASS 24/24
node scripts/colony-engine-hardening-test.mjs PASS 38/38
```

Conclusion:

COG-4 closes the gap between evaluation and training data. Good benchmark/research answers can now enter the distillation pool automatically, but only after local guard + Colony screening. Founder still reviews ambiguous/high-risk records; low-risk grounded records can be auto-accepted.

## COG-5 Distillation Review UI Result

Implemented:

- `jagat-ui/src/app/colony/page.tsx`
  - added `Distillation` tab to Colony Command Center
  - loads `/api/colony/distillation/records?limit=50`
  - shows status counters for total, pending, founder-review, and accepted records
  - shows question, answer preview, tags, benchmark name, context sources
  - shows screening scores and reasons
  - supports `Screen`, `Accept`, and `Reject` actions
  - sidebar badge highlights records needing founder review

Verification:

```text
npm run typecheck PASS
npm run build PASS
jagat-ui npm run build PASS
npm run ops:restart PASS
npm run ops:health PASS 3/3
node scripts/verify-public-routes.mjs PASS 26/26
npm run test:autocapture PASS 10/10
```

Conclusion:

The cognitive distillation loop now has capture, screening, export, and founder review surface. COG-5 turns the pool from backend-only into an operational founder command workflow.
