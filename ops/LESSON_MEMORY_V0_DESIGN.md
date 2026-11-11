# Lesson Memory v0 — Design Document

_Created: 2026-06-08_

---

## Tujuan

Menyimpan **lesson learned** secara internal (Redis) dari completed mission outcome summary. 
Belum menulis ke Qdrant sovereign memory. Belum pakai LLM extraction.

---

## Data Model

```typescript
interface ColonyLesson {
  lessonId: string;                // e.g. LESSON-20260608-001
  missionId: string;               // sumber mission
  taskIds: string[];               // task yang berkontribusi
  category: LessonCategory;        // klasifikasi
  title: string;                   // judul singkat
  content: string;                 // isi lesson (dari summary, bukan LLM)
  score: number | null;            // avg quality score mission saat lesson dibuat
  createdAt: string;               // ISO 8601
  source: "mission_outcome";       // provenance: hanya dari mission outcome
  tags: string[];                  // dari task tags, phase, priority
}

type LessonCategory =
  | "quality_high"       // mission dengan avg score ≥ 80
  | "quality_low"        // mission dengan avg score < 60
  | "blocked_pattern"    // ada blocked tasks dengan reasons
  | "scope_change"       // mission yang punya banyak task di review/blocked
  | "general";           // default
```

## Sumber Data

Hanya dari `MissionOutcomeSummary` (dihasilkan oleh `completeMissionWithSummary()`):

| Field di Lesson | Sumber |
|-----------------|--------|
| missionId | mission.id |
| taskIds | semua task yang di-getTasksByMission() |
| category | ditentukan dari summary (score thresholds + blocked count) |
| title | auto-generated dari mission.title + category |
| content | summary.summary (human-readable) |
| score | summary.avgQualityScore |
| tags | gabungan: mission.phase, mission.priority, task tags, task statuses |
| source | selalu "mission_outcome" |

## Category Classification Logic

```
if avgQualityScore >= 80 → "quality_high"
elif avgQualityScore < 60 → "quality_low"
elif blockedCount >= 2 → "blocked_pattern"
elif (reviewCount + runningCount) / totalTasks > 0.5 → "scope_change"
else → "general"
```

## Storage

- **Redis key pattern:** `colony:lesson:{lessonId}` (hash/string JSON)
- **Index:** `colony:lessons:index` (Redis SET of lesson IDs)
- **By mission:** `colony:lessons:by_mission:{missionId}` (Redis SET)
- **Sequence:** `colony:seq:lesson` (Redis INCR counter)
- **TTL:** None (persistent, manual cleanup if needed)
- **Qdrant:** TIDAK. Zero writes to sovereign memory vector DB.

## API Surface

| Function | Description |
|----------|-------------|
| `createLessonFromMission(missionId)` | Baca mission + outcome summary → buat lesson. Idempotent (skip jika lesson untuk mission ini sudah ada). |
| `getLesson(lessonId)` | Ambil satu lesson by ID. |
| `listLessons(opts?)` | List semua lesson, filter optional: category, missionId, limit. |
| `getLessonsByMission(missionId)` | Ambil semua lesson untuk satu mission. |

## Provenance

Setiap lesson wajib punya:
- `missionId` — mission sumber
- `taskIds` — task yang berkontribusi
- `score` — avg quality score saat lesson dibuat
- `createdAt` — timestamp pembuatan
- `source` — selalu "mission_outcome"

## Yang TIDAK Dilakukan

- ❌ Tidak menulis ke Qdrant (sovereign memory)
- ❌ Tidak menulis ke `colony_lessons` (table terpisah)
- ❌ Tidak pakai LLM untuk extract lesson
- ❌ Tidak auto-generate lesson dari task (hanya dari mission outcome)
- ❌ Tidak auto-replan berdasarkan lesson
- ❌ Tidak mengubah approval policy
- ❌ Tidak ada dependency baru

## Test Plan

Smoke test yang akan dibuat:
1. Buat mission + tasks → complete → buat lesson → verify fields
2. Category classification: high score → quality_high, low score → quality_low, blocked → blocked_pattern
3. Idempotent: createLessonFromMission dua kali untuk mission yang sama → lesson yang sama (tidak duplikat)
4. listLessons dengan filter category
5. getLessonsByMission
6. Lesson tanpa mission yang completed → error

---

_Approved for implementation: Phase 4 execution._
