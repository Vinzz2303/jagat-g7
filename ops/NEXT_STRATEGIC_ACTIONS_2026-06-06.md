# Next Strategic Actions - 2026-06-06

## Ringkasan PM

Setelah membaca roadmap, blueprint/masterplan, backlog teknis, backlog produk, decision log, risk register, dan dokumen Colony, arah berikutnya sudah jelas:

JAGAT tidak kekurangan fitur kecil. JAGAT sekarang butuh naik dari **Colony internal yang matang** menuju **Phase 4 agent boundary dan Phase 5 commercial readiness**.

## Status Saat Ini

### Sudah Kuat

- Phase 1 Sovereign Ignition: selesai.
- Phase 2 Sovereign Cognitive Core: selesai.
- Phase 3 Memory Ingestion Wave 1/2: selesai.
- Colony security baseline: verified.
- C5/C6 runtime, scheduler, reporter, patch review, distillation loop: operational.
- Remote model worker Server B: operational, opt-in.
- Garuda Ladder benchmark: 7B/14B masih L2 Cakra, belum Wisesa/Garuda.

### Belum Selesai

- T-012 Agent Boundary Design untuk Kiting AI, Ting AI, dan G7 Motherbox.
- Phase 3 Wave 3 memory expansion ke dokumen regulation/commercial/finance.
- Phase 5 monetization: usage metering, pricing/token UX, commercial gateway.
- Investor/client narrative v1.

## Keputusan PM

Prioritas berikutnya:

1. **T-012 Agent Boundary Design**
2. **Commercial readiness minimum**
3. **Revenue/outreach follow-up**
4. **Wave 3 memory only when new source docs exist**

Model worker tuning tidak menjadi prioritas utama lagi hari ini karena benchmark sudah membuktikan 7B/14B masih L2 Cakra.

## Task 1 - T-012 Agent Boundary Design

Output yang harus dibuat:

- `ops/AGENT_BOUNDARY_DESIGN.md`

Isi wajib:

1. Kiting AI boundary:
   - persona,
   - target user,
   - memory scope,
   - allowed tools,
   - disallowed actions,
   - refusal policy,
   - UI mode.
2. Ting AI boundary:
   - financial/risk copilot scope,
   - no financial advice guardrail,
   - market data handling,
   - risk disclosure,
   - memory scope.
3. G7 Motherbox boundary:
   - API gateway role,
   - token/tier boundary,
   - rate limit,
   - audit trail,
   - billing/usage metering dependency.
4. Routing matrix:
   - which query goes to which agent,
   - escalation to founder,
   - refusal handoff.
5. Acceptance criteria for Phase 4.

## Task 2 - Commercial Readiness Minimum

Output yang harus dibuat:

- `ops/COMMERCIAL_READINESS_MINIMUM.md`

Isi wajib:

1. Paket produk awal yang bisa dijual sekarang:
   - AI Admin Bot UMKM,
   - Sovereign Research Assistant,
   - Internal Command Center / Colony-lite.
2. Harga awal.
3. Delivery scope 3-7 hari.
4. Apa yang tidak dijanjikan.
5. Payment/invoice flow manual.
6. Risk and legal boundary.

## Task 3 - Revenue Follow-up

Output yang harus dibuat:

- `ops/revenue/DEMO_AND_FOLLOWUP_TODAY.md`

Isi wajib:

1. Demo alur bot untuk Mas Dikun.
2. Demo alur bot untuk Custom Style.
3. Demo alur bot untuk Cleanforyou.
4. Follow-up 24 jam.
5. Follow-up 48 jam.
6. Jawaban harga.
7. Jawaban "mahal".
8. Jawaban "boleh lihat demo".

## Task 4 - Wave 3 Memory

Status: hold.

Alasan:

Wave 3 membutuhkan dokumen baru dari founder atau sumber curated baru. Jangan ingest asal dari internet. Sesuai decision log, memory JAGAT harus curated dan punya metadata/provenance.

Kategori yang dibutuhkan:

- regulation,
- commercial,
- finance,
- investor/client narrative,
- founder notes baru.

## Routing Model

| Work | Worker |
| --- | --- |
| Revenue draft | Server B 7B |
| Patch plan kecil | Server B 7B/14B |
| Review awal | 14B only if time is not critical |
| Final review/security/deploy | Codex/MiMo/frontier |
| Founder strategy | Codex/founder-reviewed |

## Telegram Prompt untuk OpenClaw/MiMo

```text
Strategic Step - T-012.

Baca:
- Jagat_G7.md
- JAGAT_G7_EXECUTION_MASTERPLAN.md
- ops/JAGAT_COLONY_MASTERPLAN.md
- ops/TECHNICAL_BACKLOG.md
- ops/NEXT_STRATEGIC_ACTIONS_2026-06-06.md

Kerjakan langsung:
1. buat ops/AGENT_BOUNDARY_DESIGN.md,
2. definisikan Kiting AI, Ting AI, dan G7 Motherbox,
3. buat routing matrix,
4. buat refusal/escalation policy,
5. buat acceptance criteria Phase 4.

Jangan ubah kode.
Jangan ubah .env/openclaw.json.
Lapor ringkasan ke Telegram dengan file yang dibaca dan file yang dibuat.
```

## Rekomendasi Eksekusi

Kerjakan T-012 dulu. Ini membuka pintu ke Phase 4 dan membuat JAGAT lebih dekat ke sistem multi-agent product, bukan hanya Colony internal.
