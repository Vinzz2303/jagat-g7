# RDP Verification Evidence — DOTS Commit `ab36126`

- **Timestamp:** 2026-11-11 23:34 -08:00 (2026-11-12 07:34 UTC)
- **Host Environment:** Windows RDP, Node.js `v26.1.0`, Workspace `C:\JAGAT`
- **Target DOTS Commit Verified:** [`ab36126a3849e989252e197b993d7d2ea0ef548b`](https://github.com/Vinzz2303/jagat-g7/commit/ab36126a3849e989252e197b993d7d2ea0ef548b) (branch `fix/revenue-pipeline-reliability-2026-11-12`)

---

## 1. Perbandingan 3 File Koreksi (Mengapa Tadi 50 vs 67 Assertions)

Sebelum sinkronisasi ke `ab36126`, agen RDP sempat menerapkan koreksi lokal awal (50 assertions) setelah menemukan bug `Website address` dan `--import` Windows. Perbandingan langsung terhadap `ab36126` menunjukkan:

1. **`scripts/prospect-discovery-agent-v1.mjs`**
   - Koreksi awal RDP memakai `/Website(?:\s+address)?.../i` tanpa anchor pembatas tag awal.
   - Commit `ab36126` (via `d8d3a24c`) menggunakan `/>\s*Website(?:\s+address)?\s*<\/[^>]+>.../i` sehingga label seperti `Sponsored Website address` ikut tertolak secara ketat.
2. **`scripts/revenue-provenance-test.mjs`**
   - Koreksi awal RDP berisi 50 assertions; `ab36126` berisi **67 assertions** (menambahkan matrix uji `Website address`, iklan sebelum field resmi, `Sponsored Website address`, sponsor-only, dan temp dir dengan spasi + `#` untuk menguji URL encoding `pathToFileURL`).
3. **`scripts/revenue-notification-test.mjs`**
   - Keduanya memakai `pathToFileURL(preload).href`; `ab36126` juga menambahkan spasi + `#` pada prefix temp dir.

**Tindakan:** Ketiga file + `ops/REVENUE_REPAIR_RDP_CORRECTIONS_2026-11-12.md` telah disinkronkan persis ke commit `ab36126`. Tidak ada perubahan file `.ts` pada commit koreksi tersebut.

---

## 2. Verifikasi SHA-256 Seluruh 21 File (`main...ab36126` vs RDP)

| File | SHA-256 `ab36126` | SHA-256 RDP | Status |
|---|---|---|---|
| `ops/REVENUE_REPAIR_HANDOFF_2026-11-12.md` | `019695325ca4fa69` | `019695325ca4fa69` | EXACT_MATCH |
| `ops/REVENUE_REPAIR_RDP_CORRECTIONS_2026-11-12.md` | `45d2008cb4968f4c` | `45d2008cb4968f4c` | EXACT_MATCH |
| `ops/REVENUE_REPAIR_VALIDATION_2026-11-12.md` | `55f7c099ab0fcf58` | `55f7c099ab0fcf58` | EXACT_MATCH |
| `package.json` | `82adc48d4e5690e9` | `82adc48d4e5690e9` | EXACT_MATCH |
| `scripts/autonomous-revenue-agent-v1.mjs` | `ea7a912eb098061c` | `ea7a912eb098061c` | EXACT_MATCH |
| `scripts/email-outreach-draft-agent-v1.mjs` | `32d2bba83c3bfc9e` | `32d2bba83c3bfc9e` | EXACT_MATCH |
| `scripts/model-provider-json-test.mjs` | `0bc87b07a539ccb5` | `0bc87b07a539ccb5` | EXACT_MATCH |
| `scripts/outreach-campaign-guard.mjs` | `ddbbd8571c48e3bf` | `ddbbd8571c48e3bf` | EXACT_MATCH |
| `scripts/prospect-discovery-agent-v1.mjs` | `ca9a063c22919522` | `ca9a063c22919522` | EXACT_MATCH |
| `scripts/revenue-notification-test.mjs` | `4c78b58052d48880` | `4c78b58052d48880` | EXACT_MATCH |
| `scripts/revenue-notification.mjs` | `0a774412f4a2011b` | `0a774412f4a2011b` | EXACT_MATCH |
| `scripts/revenue-outreach-email.mjs` | `c22cac59aef6c65a` | `c22cac59aef6c65a` | EXACT_MATCH |
| `scripts/revenue-outreach-sender-smoke.mjs` | `5c238fa7dba77c8f` | `5c238fa7dba77c8f` | EXACT_MATCH |
| `scripts/revenue-provenance-test.mjs` | `3b2a5e6a4bbeeff5` | `3b2a5e6a4bbeeff5` | EXACT_MATCH |
| `scripts/revenue-status-snapshot-test.mjs` | `af478d73d4bbdee6` | `af478d73d4bbdee6` | EXACT_MATCH |
| `scripts/revenue-status-snapshot.mjs` | `82cdebb1190996b7` | `82cdebb1190996b7` | EXACT_MATCH |
| `scripts/telegram-event-guard.mjs` | `e09d5e93a55832cc` | `e09d5e93a55832cc` | EXACT_MATCH |
| `src/colony/telegram-bot.ts` | `ce70a05093818d7d` | `ce70a05093818d7d` | EXACT_MATCH |
| `src/services/hybrid-router.ts` | `1424aaecf08f748e` | `1424aaecf08f748e` | EXACT_MATCH |
| `src/services/model-response.ts` | `c19975449a3d97ca` | `c19975449a3d97ca` | EXACT_MATCH |
| `src/services/ollama.ts` | `39d27eb1bfe4cdb8` | `39d27eb1bfe4cdb8` | EXACT_MATCH |

**Hasil:** **21/21 EXACT_MATCH (0 mismatches)**.

---

## 3. Hasil Pengujian Native Windows (`Node.js v26.1.0`)

Seluruh perintah berikut dijalankan langsung di `C:\JAGAT` setelah sinkronisasi penuh ke `ab36126`:

- `npm run typecheck` (`tsc --noEmit`): **PASS** (`exit 0`)
- `npm run build` (`tsc`): **PASS** (`exit 0`)
- `npm run test:revenue-offline`: **ALL PASS** (`exit 0`)
  - `test:revenue-provenance`: `{"status":"PASS","assertions":67,"network":"disabled; browser and MX mocked","artifacts":"...\\jagat provenance #-6nvPFN"}`
  - `test:revenue-notifications`: `{"status":"PASS","assertions":31,"network":"stubbed only","artifacts":"...\\jagat notifications #-K9Ez14"}`
  - `test:revenue-status`: `Revenue status snapshot: PASS (0 failures)` (25 checks)
  - `test:revenue-outreach-sender`: `{"status":"PASS",...,"automaticPolicy":"fake SMTP success; rolling cap, duplicate, provenance mismatch and STOP blocked","smtp":"fake adapter only"}`
  - `test:model-provider-json`: `tests 14, pass 14, fail 0`

*(Tidak ada email nyata, notifikasi Telegram live, atau panggilan API provider berbayar saat pengujian).*

---

## 4. Jadwal Siklus Revenue & Cakupan Runtime Saat Ini

### Windows Task Scheduler (`JAGAT Autonomous Revenue Agent V1`)
- **State:** `Ready`
- **LastRunTime:** `2026-11-11 22:41:40 -08:00` (`LastTaskResult: 0`, `NumberOfMissedRuns: 0`)
  - *Catatan penting:* Siklus `22:41:40` berjalan **sebelum** patch diterapkan. Siklus revenue terjawab **belum pernah** berjalan memakai kode baru, dan sengaja **tidak dipicu manual** demi keamanan.
- **NextRunTime:** `2026-11-12 01:41:39 -08:00` (siklus terjadwal alami pertama setelah patch).

### Snapshot `npm run ops:revenue-status`
- **Overall:** `HEALTHY` (4 artefak `FRESH` usia ~46 menit dari siklus `22:41`)
- **Notifications:** `brief: DELIVERED` (`2026-11-12T06:48:03.158Z`), `draftBatch: DELIVERED` (`2026-11-08T21:47:32.876Z`)
- **Outreach Ledger:** `sent: 59`, `failed: 6` (historis 2026-08-13), `blocked: 2` (historis 2026-07-07), `unknown: 0`, `newestEventAt: 2026-11-08T18:49:14.158Z`

### Cakupan Proses Aktif di RDP
- **PM2 `jagat-telegram-bots` (PID `8064`):** `online`, menjalankan build terbaru `C:\JAGAT\dist\colony\telegram-bot.js` (sudah mencakup Groq `llama-3.1-8b-instant`, strict JSON `model-response.ts`, dan Ollama `format: "json"`).
- **Pipeline Revenue Terjadwal (`run-autonomous-revenue-cycle-v1.ps1`):** Menjalankan skrip Node baru dari `C:\JAGAT\scripts\` pada setiap siklus; kode `ab36126` akan aktif otomatis pada `NextRunTime` (`2026-11-12 01:41:39 -08:00`).
- **Tidak Diubah:** `.env`, `ops/revenue/AUTO_SEND_POLICY.json`, `PROSPECT_TRACKER.csv`, `SUPPRESSION_LIST.json`, serta BFF (:5000) & UI (:50012).
