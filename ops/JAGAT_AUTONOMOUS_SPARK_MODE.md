# JAGAT Autonomous Spark Mode

Tanggal: 2026-06-08
Status: operating contract draft
Owner: Faturachman Al Kahfi + AI Builder

## Tujuan

Dokumen ini mengunci cara kerja autonomous JAGAT agar bisa bergerak seperti agent 24/7: membaca konteks, memilih task, mengerjakan langkah kecil, memverifikasi, lalu melapor tanpa perlu prompting manual terus-menerus.

Analoginya adalah Gemini Spark: agent dapat berjalan di background, mengambil konteks dari workspace, dan menjalankan long-horizon task. Versi JAGAT harus lebih ketat: sovereign, lokal-first, task-driven, dan founder-gated untuk tindakan berisiko.

## Prinsip

1. Autonomous tidak berarti liar. Semua kerja harus tunduk pada founder instruction, decision log, masterplan, backlog, risk register, dan access architecture.
2. Autonomous bergerak lewat task queue atau artefak kerja yang jelas, bukan percakapan acak tanpa state.
3. Setiap sesi wajib MRP sebelum perubahan.
4. Setiap perubahan wajib punya evidence: file, test, build, health check, benchmark, atau laporan audit.
5. High-risk action wajib founder checkpoint.

## Lane Otonom

| Lane | Boleh Jalan Otonom | Wajib Checkpoint Founder |
| --- | --- | --- |
| Research | membaca dokumen, merangkum gap, menyusun plan | ingest sumber baru yang tidak curated |
| Documentation | update ops log, handoff, runbook, proposal kecil | ubah blueprint, roadmap, keputusan strategis besar |
| Maintenance | health check, typecheck, test ringan, audit drift | restart/deploy production, ubah port/host/env |
| Colony | reporter, scheduler low-risk, stuck-task digest | coding berat, patch apply, auth/security model |
| Revenue | draft pesan, tracker, proposal manual-reviewable | auto-send WA/email, payment, klaim revenue |
| Product | UX spec, pricing/metering design draft | billing live, token tier production policy |

## Spark-like Capability Map

| Capability | Spark-like Idea | JAGAT Implementation Path |
| --- | --- | --- |
| Background execution | kerja tetap jalan saat user pergi | C6 scheduler + heartbeat + deep work log |
| App/workspace context | baca Gmail/Docs/Sheets | baca repo, ops docs, Qdrant memory, tracker |
| Long-horizon task | multi-step task | mission -> task -> evidence -> review |
| Progress visibility | progress monitor | Colony Command Center, C6 Runtime, log |
| Connected tools | app integrations | local tools, scripts, Qdrant, Redis, Ollama |
| Safety checkpoint | confirm major actions | founder-only approval, role guard, audit |

## Default Autonomous Loop

1. Read MRP layer sesuai mode kerja.
2. Derive active phase and next task from backlog.
3. Select one low-risk task.
4. Inspect current files before acting.
5. Produce one concrete artifact or small patch.
6. Run verification proportional to risk.
7. Log result in `ops/colony-autonomous-log.md`.
8. Leave next action and blocker, if any.

## Red Checkpoint Actions

Autonomous agent must stop and ask or create a proposal before:

- changing `.env`, secrets, credentials, host, port, connection string, or production config;
- deploy/restart production service unless explicitly requested;
- changing database structure;
- changing auth/security boundary;
- sending outbound WA/email/message;
- taking payment or changing billing;
- ingesting non-curated internet documents into Qdrant;
- deleting files;
- applying large refactor or multi-file architecture change.

## First Implementation Direction

Phase 5 next work should be split into low-risk autonomous steps:

1. Create usage metering design document.
2. Define usage event schema and quota policy.
3. Define pricing/token UX requirements for P-006.
4. Create tests only after schema is accepted.
5. Implement metering in code only after founder checkpoint.

## Definition of Done

Autonomous Spark Mode is operational when:

1. every autonomous session starts from MRP;
2. selected task maps to backlog or direct founder instruction;
3. low-risk tasks can be completed without extra prompting;
4. high-risk tasks produce proposal/checkpoint instead of direct mutation;
5. founder can inspect progress from log or Colony UI;
6. verification evidence is attached before claiming success.
