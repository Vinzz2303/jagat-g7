# JAGAT G7 Phase 3E - Bulk Ingest Report Wave 2

Generated: 2026-05-25T16:15:20.183Z

## Summary

- Mode: force-ingest
- Wave: 2
- Collection: jagat_indonesia_knowledge
- Embedding model: nomic-embed-text
- Chunks total: 137
- Existing points before run: 0
- Points embedded: 137
- Points upserted: 137
- Points skipped: 0
- Failures: 0

## Documents

| Document ID | Title | Source | Chunks |
| --- | --- | --- | ---: |
| JAGAT-W2-001 | JAGAT G7 Execution Masterplan | jagat-g7-execution-masterplan | 29 |
| JAGAT-W2-002 | JAGAT G7 Tim Inti dan Struktur Komando | jagat-g7-team-structure | 16 |
| JAGAT-W2-003 | JAGAT G7 Decision Log | jagat-g7-decision-log | 16 |
| JAGAT-W2-004 | JAGAT G7 Risk Register | jagat-g7-risk-register | 10 |
| JAGAT-W2-005 | JAGAT G7 Technical Backlog | jagat-g7-technical-backlog | 16 |
| JAGAT-W2-006 | JAGAT G7 Product Backlog | jagat-g7-product-backlog | 9 |
| JAGAT-W2-007 | JAGAT G7 Weekly Execution Loop | jagat-g7-weekly-execution-loop | 6 |
| JAGAT-W2-008 | JAGAT G7 Execution Map 30/60/90 Days | jagat-g7-execution-map-30-60-90 | 4 |
| JAGAT-W2-009 | JAGAT G7 Phase 3 Memory Ingestion Plan | jagat-g7-phase3-memory-ingestion-plan | 21 |
| JAGAT-W2-010 | JAGAT G7 Phase 3B Strategic Document Manifest | jagat-g7-phase3b-strategic-manifest | 10 |

## Policy

- Point IDs are deterministic from `chunk_id`, so reruns are idempotent.
- `--dry-run` validates chunks and duplicate state without embedding or upsert.
- Default run skips existing point IDs; `--force` re-embeds and upserts all chunks.
- Every Qdrant payload carries parent metadata, provenance, chunk index, content hash, and embedding model.
