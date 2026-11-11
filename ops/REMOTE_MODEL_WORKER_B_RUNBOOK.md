# Remote Model Worker B Runbook

Tanggal: 2026-06-06
Status: operational, opt-in

## Tujuan

Server B dipakai sebagai worker model tambahan untuk drafting, coding ringan/sedang,
revenue copy, dan ringkasan dokumen. Server A tetap menjadi pusat kontrol JAGAT.

## Topologi

| Komponen | Lokasi | Fungsi |
| --- | --- | --- |
| Server A | `103.190.0.113` / Tailscale `100.80.82.94` | JAGAT core, backend, UI, Colony, OpenClaw, Telegram |
| Server B | `4.187.152.182` / Tailscale `100.107.244.82` | Remote Ollama worker |

## Model Aktif Server B

- Host: `http://100.107.244.82:11434`
- Default worker model: `qwen2.5-coder:7b`
- Deeper coding/review candidate: `qwen2.5-coder:14b`
- Use case utama: coding worker, drafting, revenue proposal, follow-up copy

## Benchmark Note 2026-06-06

`qwen2.5-coder:14b` berhasil berjalan di Server B.

Hasil awal:

- `short-id`: 29.57s wall, 47 output token, sekitar 3.53 tok/s.
- `coding-plan`: 50.66s wall, 180 output token, sekitar 3.88 tok/s.
- `debug-reasoning`: 23.44s wall, 75 output token, sekitar 3.89 tok/s.

Catatan kualitas:

- 14B lebih besar dan cocok diuji sebagai kandidat coder/reviewer.
- 14B belum boleh menjadi default brain JAGAT karena prompt tanpa konteks masih bisa hallucinate identitas/proyek.
- Untuk tugas JAGAT, wajib memakai sovereign system prompt dan memory context.
- 7B tetap worker cepat; 14B dipakai untuk tugas yang butuh reasoning/coding lebih kuat tetapi tidak latency-critical.

## Garuda Ladder Benchmark 2026-06-06

Script: `npm run benchmark:garuda-ladder`
Report: `ops/GARUDA_LADDER_RESULTS.md`

| Model | Score | Level | Avg Speed | Decision |
| --- | ---: | --- | ---: | --- |
| `qwen2.5-coder:7b` | 66/100 | L2 Cakra | 5.25 tok/s | Fast scoped coding/drafting worker |
| `qwen2.5-coder:14b` | 67/100 | L2 Cakra | 2.59 tok/s | Slower scoped coding/drafting worker |

Decision:

- Neither model is approved as `L3 Wisesa` reviewer yet.
- Neither model is approved as `L4 Garuda` architect.
- 14B is only +1 point above 7B while about 2x slower on this benchmark.
- Both models failed instruction-discipline checks for explicit revenue safety constraints.
- Remote workers must not run autonomous revenue outbound, credential handling, deploy, billing, or security final decisions.

## Routing Policy

Gunakan Server B untuk:

- membuat draft email/WhatsApp/proposal,
- membuat ringkasan file,
- membuat test/script kecil,
- generate code patch low/medium risk,
- revenue material dan demo copy.

Jangan gunakan Server B sebagai default untuk:

- founder strategic final decision,
- security-sensitive decisions,
- credential handling,
- billing/payment,
- production deployment,
- legal/financial claims,
- direct outbound outreach.

## Cara Mengaktifkan Remote Worker Secara Sementara

PowerShell:

```powershell
$env:OLLAMA_REMOTE_ENABLED="true"
$env:REMOTE_OLLAMA_HOST="http://100.107.244.82:11434"
$env:REMOTE_INFERENCE_MODEL="qwen2.5-coder:7b"
```

Untuk mencoba 14B:

```powershell
$env:REMOTE_INFERENCE_MODEL="qwen2.5-coder:14b"
```

Lalu jalankan test:

```powershell
npm run test:ollama-router
```

Expected:

- remote enabled routes to `qwen2.5-coder:7b`
- remote failure falls back to local `llama3`

## Cara Mematikan Remote Worker

```powershell
$env:OLLAMA_REMOTE_ENABLED="false"
```

Jika backend sedang berjalan dengan env remote aktif, restart backend melalui prosedur ops resmi.

## Health Check Server B

Dari Server A:

```powershell
Invoke-RestMethod http://100.107.244.82:11434/api/tags | ConvertTo-Json -Depth 6
```

Expected: model `qwen2.5-coder:7b` dan/atau `qwen2.5-coder:14b` muncul.

## Guardrail

- Embeddings tetap lokal di Server A supaya Qdrant dimension dan ingest stabil.
- Remote completion harus punya fallback lokal.
- Jangan commit `.env` atau secret.
- Jangan ubah `openclaw.json` tanpa instruksi founder.
- Jangan gunakan remote worker untuk auto-send WA/email.

## Prompt untuk OpenClaw/MiMo

```text
Remote Worker B Policy.

Server B tersedia sebagai Ollama worker di http://100.107.244.82:11434 dengan model qwen2.5-coder:7b dan qwen2.5-coder:14b.

Default: gunakan 7B untuk tugas cepat.
Gunakan 14B untuk coding/review lebih dalam yang tidak latency-critical.

Gunakan hanya untuk:
- drafting,
- coding ringan/sedang,
- revenue copy,
- proposal,
- ringkasan,
- test/script kecil.

Jangan gunakan untuk:
- auto-send WhatsApp/email,
- credential handling,
- billing/payment,
- deploy production,
- keputusan security final.

Jika remote timeout/gagal, fallback ke local. Embeddings tetap local.
```
