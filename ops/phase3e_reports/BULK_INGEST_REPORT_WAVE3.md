# JAGAT G7 Phase 3E - Bulk Ingest Report Wave 3

Generated: 2026-07-21T07:16:45.996Z

## Summary

- Mode: ingest
- Wave: 3
- Collection: jagat_indonesia_knowledge
- Embedding model: nomic-embed-text
- Chunks total: 131
- Existing points before run: 0
- Points embedded: 131
- Points upserted: 131
- Points skipped: 0
- Failures: 0

## Documents

| Document ID | Title | Source | Chunks |
| --- | --- | --- | ---: |
| JAGAT-W3-001 | JAGAT G7 Agent Boundary Design — Phase 4 | jagat-g7-agent-boundary-design | 32 |
| JAGAT-W3-002 | JAGAT G7 Commercial Readiness Minimum | jagat-g7-commercial-readiness-minimum | 20 |
| JAGAT-W3-003 | JAGAT Garuda Ladder — Model Classification System | jagat-garuda-ladder | 13 |
| JAGAT-W3-004 | Garuda Ladder Benchmark Results — 7B vs 14B | jagat-garuda-ladder-results | 22 |
| JAGAT-W3-005 | JAGAT G7 Cognitive Pipeline Audit | jagat-g7-cognitive-pipeline-audit | 19 |
| JAGAT-W3-006 | Next Strategic Actions — PM Priority 2026-06-06 | jagat-g7-next-strategic-actions | 14 |
| JAGAT-W3-007 | Remote Model Worker B — Operational Runbook | jagat-remote-model-worker-b-runbook | 11 |

## Policy

- Point IDs are deterministic from `chunk_id`, so reruns are idempotent.
- `--dry-run` validates chunks and duplicate state without embedding or upsert.
- Default run skips existing point IDs; `--force` re-embeds and upserts all chunks.
- Every Qdrant payload carries parent metadata, provenance, chunk index, content hash, and embedding model.
