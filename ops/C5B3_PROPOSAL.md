# C5B-3 Patch Engine — Proposal Lanjutan

> **Status**: PROPOSED — Menunggu approval founder sebelum implementasi dimulai.
> **Prerequisite**: C5B-2 PASS (D-018 Locked).
> **Tidak ada coding sampai founder mengetik: "Approve C5B-3"**

---

## Latar Belakang

C5B-2 membuktikan bahwa patch proposal engine aman: path security satu source, replacement line-anchored, actor audit nyata, dan applyPatch terisolasi dari public index. Namun ada 4 gap yang harus ditutup sebelum patch engine bisa dipakai secara operasional:

1. **Multi-hunk same-file ordering** — urutan apply belum deterministik ketika satu proposal punya >1 hunk di file yang sama
2. **Atomic write / rollback** — jika hunk ke-N gagal setelah hunk ke-1..N-1 sudah ditulis, file akan setengah-diubah tanpa rollback
3. **UI Patch Proposals tab** — founder tidak bisa melihat, mereview, dan approve/reject proposal dari UI; saat ini hanya via `/patch-*` commands di chat
4. **Training data export JSONL** — proposal yang ditandai `trainingDataReady=true` belum bisa diekspor ke pipeline JAGAT Monster

---

## Fitur yang Diusulkan

### F1 — Multi-Hunk Same-File Ordering

**Masalah saat ini:**
`applyPatch` memproses hunks dalam urutan `proposal.hunks[]` (urutan submit). Jika file yang sama punya 2 hunk:
- Hunk A: replace baris 10
- Hunk B: replace baris 5

Urutan apply A → B akan salah karena setelah A diterapkan, byte offset baris 5 mungkin bergeser jika panjang `proposedContent` berbeda dengan `originalContent`.

**Fix yang diusulkan:**
Sebelum apply, sort hunks per file berdasarkan `startLine` descending (baris terbawah duluan). Replacement dari bawah ke atas menjamin offset baris di atas tidak bergeser.

**Aturan tambahan:**
- Hunks yang overlap (range `[startLine..endLine]` intersect) wajib ditolak saat `submitProposal` dengan error `HUNK_OVERLAP`
- Validasi ini cukup dilakukan di `validateHunks`

**Scope:**
- `patch-engine.ts`: `validateHunks` tambah overlap check; `applyPatch` sort hunks per file
- Tidak ada perubahan di `index.ts`, `worker-sandbox.ts`, atau `command-engine.ts`

---

### F2 — Atomic Write / Rollback

**Masalah saat ini:**
Jika proposal punya 3 file dan file ke-2 gagal ditulis di tengah apply (disk full, permission error, dsb.), file ke-1 sudah dimodifikasi tetapi file ke-2 dan ke-3 belum. Tidak ada rollback.

**Fix yang diusulkan:**
Strategi write-to-temp + atomic rename:

1. Semua perubahan disiapkan di `fileUpdates: Map<resolvedPath, string>` (sudah ada)
2. Untuk setiap file, tulis ke path sementara: `{filePath}.colony-patch-{proposalId}.tmp`
3. Setelah semua temp files berhasil ditulis, rename semuanya sekaligus
4. Jika rename gagal, hapus semua temp files dan set status `apply_failed`

Catatan: `rename` di Windows dan Linux bersifat atomic untuk file di partisi yang sama. Untuk multi-file, rename tidak bisa dijamin fully atomic di level OS — ini "best effort atomicity" yang sudah jauh lebih baik dari situasi saat ini.

**Scope:**
- `patch-engine.ts`: ganti `writeFile` langsung dengan temp-write + rename pattern
- Helper `applyFileAtomically(resolvedPath, content, proposalId)` (internal, tidak diexport)

---

### F3 — UI Patch Proposals Tab

**Masalah saat ini:**
Founder hanya bisa melihat patch proposals lewat `/patch-log` dan `/patch-view` di Internal Chat. Tidak ada visual untuk membandingkan diff, approve, atau reject dengan satu klik.

**Desain tab yang diusulkan (Colony UI):**

```
[ Task Queue ] [ Approvals ] [ Internal Chat ] [ Audit ] [ Patch Proposals ]
                                                                ^^^^^^^^^^^^
```

**Komponen tab:**
- **Proposal list**: tabel dengan kolom `ID | Task | Agent | Files | Risk | Status | Date`
  - Filter: pending / approved / applied / rejected / all
  - Sort: date desc (default)
- **Proposal detail panel** (klik baris):
  - Header: proposalId, taskId, agentName, estimatedRisk, status
  - Rationale text
  - File list dengan hunk count
  - Diff viewer per hunk: dua kolom `original` vs `proposed` dengan syntax highlighting
  - Evidence summary
  - Training data tags + ready toggle
- **Action buttons** (hanya tampil jika status = pending):
  - `Approve & Apply` → calls `/patch-approve {id}`
  - `Reject` → prompt note → calls `/patch-reject {id} {note}`
  - `Approve (no apply)` → calls `approveProposal` saja (untuk review tahap dua)

**API routes yang dibutuhkan** (sudah ada di `colony/routes.ts`, tinggal expose):
- `GET /colony/patch/list` — listPendingProposals + listProposalsByStatus
- `GET /colony/patch/{id}` — getProposal
- `POST /colony/patch/{id}/approve` — approveProposal + applyPatch
- `POST /colony/patch/{id}/reject` — rejectProposal

**Scope:**
- `jagat-ui`: komponen baru `PatchProposalsTab.tsx` + `DiffViewer.tsx`
- `src/colony/routes.ts`: expose 4 route baru
- `jagat-ui/src/app/api/colony/[...path]/route.ts`: proxy route sudah ada, tidak perlu diubah

---

### F4 — Training Data Export JSONL

**Masalah saat ini:**
`PatchProposal` sudah punya field `trainingDataReady: boolean` dan `trainingDataTags: string[]`, tapi tidak ada mekanisme untuk mengekspor proposal ke JSONL yang bisa dipakai fine-tuning pipeline.

**Format JSONL yang diusulkan:**
```jsonl
{"id":"PATCH-20260528-0004","task":"TASK-001","role":"builder","title":"...","rationale":"...","hunks":[{"file":"src/colony/worker-executor.ts","startLine":10,"endLine":12,"original":"...","proposed":"..."}],"evidence":"...","tags":["governance","c5b2"],"approvedBy":"Faturachman Al Kahfi","appliedAt":"2026-05-28T..."}
```

**Command yang diusulkan:**
```
/patch-export [--tag <tag>] [--status applied] [--from 2026-05-01]
```

Output: file `ops/training-data/patch-export-{timestamp}.jsonl`

**Scope:**
- `patch-engine.ts`: fungsi `exportTrainingData(filter)` → JSONL string
- `command-engine.ts`: command `/patch-export`
- Route `GET /colony/patch/export` (founder-only, dilindungi secret header)

---

## Urutan Implementasi yang Direkomendasikan

```
F2 (Atomic write)          ← foundation, paling kritis untuk safety
  ↓
F1 (Multi-hunk ordering)   ← bergantung pada apply loop yang sudah ada
  ↓
F3 (UI tab)                ← butuh route yang bersih dari F1+F2
  ↓
F4 (Training export)       ← independen, bisa paralel dengan F3
```

F2 direkomendasikan paling pertama karena mencegah file corruption tanpa mengubah API surface.

---

## Pertanyaan untuk Founder

1. **F3 prioritas?** UI tab butuh waktu lebih lama (frontend + backend). Kalau founder lebih butuh F1+F2 dulu dan F3 ditunda ke C5B-4, itu valid.
2. **F4 format?** Apakah format JSONL di atas sudah cocok untuk pipeline JAGAT Monster, atau perlu field tambahan (misalnya `reasoning_trace`, `rejection_reason`)?
3. **Scope F1**: Apakah overlap check di `submitProposal` sudah cukup, atau mau tambah overlap check juga di `approveProposal` (stale check)?
4. **Atomic write F2**: Temp-file + rename adalah pendekatan yang paling kompatibel dengan Windows. Ada preferensi lain?

---

## Estimasi Scope (tanpa UI)

| Fitur | File yang diubah | Estimasi baris |
|-------|-----------------|----------------|
| F1 multi-hunk ordering | `patch-engine.ts` | ~40 baris |
| F2 atomic write | `patch-engine.ts` | ~60 baris |
| F4 training export | `patch-engine.ts`, `command-engine.ts` | ~80 baris |
| Live test update | `scripts/c5b2-live-test.mjs` | ~50 baris |

**Total tanpa UI**: ~230 baris, typecheck + build + live test sebagai acceptance.

**UI F3 saja**: ~400–600 baris (TSX + route), live test via browser manual.

---

## Acceptance Criteria (akan dikunci setelah approval)

- [ ] `npm run typecheck` PASS
- [ ] `npm run build` PASS
- [ ] `npx tsx scripts/c5b2-live-test.mjs` PASS dengan test case baru:
  - F1: proposal 2 hunk di file sama, urutan submit terbalik, hasil apply benar
  - F1: proposal dengan hunk overlap → `HUNK_OVERLAP` saat submit
  - F2: atomic write berhasil → file tertulis; simulasi gagal → temp files dihapus
  - F4: `/patch-export` menghasilkan JSONL valid untuk proposal `trainingDataReady=true`
- [ ] Tidak ada perubahan di public API `index.ts` yang menambah `applyPatch`
- [ ] `patch-engine.ts` tidak disentuh untuk fitur selain F1, F2, F4

---

> **PENDING FOUNDER APPROVAL**
> Jangan mulai implementasi sebelum founder menyatakan: *"Approve C5B-3"* atau *"Approve C5B-3 partial: F1 F2"* dsb.
