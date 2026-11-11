# Model Arena v0 — Design Document

_Created: 2026-06-08_

---

## Tujuan

Menyimpan dan mengakses **performance summary** per model per task type secara advisory.
Belum mengubah routing otomatis. Belum mengubah model default.

---

## Data Model

```typescript
interface ModelArenaEntry {
  modelId: string;               // e.g. "qwen2.5-coder:7b"
  taskType: string;              // e.g. "coding", "review", "drafting", "general"
  avgScore: number | null;       // 0-100, null if no data
  avgLatencyMs: number | null;   // ms, null if no data
  sampleCount: number;           // how many evaluations recorded
  recommendation: string;        // human-readable advisory
  lastUpdatedAt: string;         // ISO 8601
}

interface ModelArenaRecord {
  modelId: string;
  taskType: string;
  score: number;                 // 0-100
  latencyMs: number;
  recordedAt: string;            // ISO 8601
  source: string;                // e.g. "benchmark", "runtime", "manual"
}
```

## Storage

- **Summary:** `colony:arena:summary:{modelId}:{taskType}` (JSON string)
- **Records:** `colony:arena:records:{modelId}:{taskType}` (Redis LIST, capped at 100)
- **Index:** `colony:arena:index` (Redis SET of "modelId:taskType" keys)

## API Surface

| Function | Description |
|----------|-------------|
| `recordArenaResult(modelId, taskType, score, latencyMs, source?)` | Record one performance data point. Auto-updates summary. |
| `getArenaSummary(modelId, taskType)` | Get summary for one model+taskType. |
| `listArenaSummaries(taskType?)` | List all summaries, optionally filtered by taskType. |
| `getRecommendation(taskType)` | Get advisory recommendation for which model to use for a task type. |

## Recommendation Logic

Simple: for a given taskType, return the model with highest avgScore.
If tie, prefer lower latency.
If no data, return "No data available — use default routing."

## Yang TIDAK Dilakukan

- ❌ Tidak auto-route production tasks
- ❌ Tidak ubah model default
- ❌ Tidak ubah Ollama config
- ❌ Tidak ubah model-router.ts
- ❌ Tidak ada dependency baru

---

_Ready for implementation._
