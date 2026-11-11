# JAGAT Cognitive Benchmark Results

Generated: 2026-06-08T15:36:35.924Z
Backend: http://127.0.0.1:5000
Auto-capture: OFF

## Summary

| Metric | Value |
| --- | --- |
| Total Areas | 10 |
| Passed | 8 |
| Failed | 2 |
| Average Score | 0.97 |
| Status | majority_pass |

## Results Per Area

| Area | Result | Score | Context Docs | Time |
| --- | --- | ---: | ---: | ---: |
| 1. Arsitektur | ✅ PASS | 1 | 4 | 300176ms |
| 2. Roadmap | ✅ PASS | 1 | 4 | 113155ms |
| 3. Risiko Aktif | ✅ PASS | 1 | 4 | 129622ms |
| 4. Next Action | ✅ PASS | 1 | 4 | 116560ms |
| 5. Revenue & Commercial | ❌ FAIL | 0.8 | 4 | 129272ms |
| 6. Colony & Unit | ❌ FAIL | 0.88 | 4 | 127231ms |
| 7. Agent Boundary | ✅ PASS | 1 | 4 | 119246ms |
| 8. Model Routing | ✅ PASS | 1 | 4 | 124672ms |
| 9. Coding Plan | ✅ PASS | 1 | 4 | 115407ms |
| 10. Identity & Sovereignty | ✅ PASS | 1 | 4 | 132968ms |

## Policy

- Score >= 0.60 with contextDocs > 0 = PASS for grounded areas.
- Identity area passes even without context (LLM sovereign identity).
- Required sources must be present in contextSources for areas 5, 7, 8.
- Run with COG4_AUTO_CAPTURE=true to send PASS answers to distillation pool.

## Improvement Guide

- FAIL on context (0 docs): Run Wave 3 ingest or check Qdrant health.
- FAIL on keywords: Check if relevant documents are in Qdrant collection.
- FAIL on required sources: Check if specific Wave 3 document was ingested.
