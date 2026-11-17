# JAGAT G7 Phase 3E - Bulk Ingest Report Wave 1

Generated: 2026-07-21T07:16:16.658Z

## Summary

- Mode: ingest
- Collection: jagat_indonesia_knowledge
- Embedding model: nomic-embed-text
- Chunks total: 55
- Existing points before run: 0
- Points embedded: 55
- Points upserted: 55
- Points skipped: 0
- Failures: 0

## Documents

| Document ID | Title | Source | Chunks |
| --- | --- | --- | ---: |
| JAGAT-W1-001 | JAGAT G7 Technical Blueprint | jagat-g7-technical-blueprint | 14 |
| JAGAT-W1-002 | JAGAT G7 Sovereign Roadmap | jagat-g7-sovereign-roadmap | 10 |
| JAGAT-W1-003 | JAGAT G7 Project Milestones V5 | jagat-g7-project-milestones-v5 | 31 |

## Policy

- Point IDs are deterministic from `chunk_id`, so reruns are idempotent.
- `--dry-run` validates chunks and duplicate state without embedding or upsert.
- Default run skips existing point IDs; `--force` re-embeds and upserts all chunks.
- Every Qdrant payload carries parent metadata, provenance, chunk index, content hash, and embedding model.
