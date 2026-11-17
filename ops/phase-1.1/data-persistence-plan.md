# JAGAT G7 — Phase 1.1 Data Persistence & Coordinated Writer Plan (Revised)
**Document Version:** 1.1.0 (Architecture Review Revision)  
**Status:** DRAFT PROPOSAL — AWAITING FOUNDER APPROVAL  

---

## 1. Coordinated Writer & Concurrency Architecture

Sesuai koreksi Arsitektur Review #2, penulisan ke file persistensi Core **TIDAK MENGGUNAKAN** `fs.appendFile` mentah tanpa proteksi. 

Diterapkan arsitektur **Coordinated Serialized Writer**:

```
[Console BFF Requests] ──┐
[Core Swarm Workers]   ──┼──> [Async Serialized Queue (Promise FIFO)]
[Inbound Webhooks]     ──┘                 │
                                           ▼
                                [Unique Event ID Generator]
                                           │
                                           ▼
                                [Pre-Write Backup Checkpoint]
                                           │
                                           ▼
                                [Atomic Line-Flush to Disk]
                                (outreach-send-ledger.jsonl)
```

### Aturan Ketat Penulisan:
1. **Serialized Execution:** Semua permintaan tulis dimasukkan ke dalam antrean tunggal yang dieksekusi satu per satu (*in-process FIFO queue*).
2. **Deterministic Event ID:** Setiap baris event wajib memiliki `event_id` unik berbasis waktu dan entropi acak:
   `evt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
3. **Validasi Skema Sebelum Tulis:** Data divalidasi ke format JSON satu baris (*single-line JSON*) tanpa karakter newline liar (`\r`, `\n`) yang dapat merusak integritas pembacaan JSONL.
4. **Automated Backup Strategy:** 
   Sebelum skrip melakukan write/update, file target diperiksa. Sistem otomatis membuat checkpoint backup harian di `C:\JAGAT\ops\backups\`:
   - `PROSPECT_TRACKER.YYYYMMDD.csv`
   - `outreach-send-ledger.YYYYMMDD.jsonl`
   - `approval-ledger.YYYYMMDD.jsonl`

---

## 2. Re-hydration on Startup (Pemuatan Bersih Saat Reboot)

Saat Console BFF (Port 5005) atau Core BFF (Port 5000) dimulai:

1. **Langkah 1 (Muat Riwayat Pengiriman & Idempotensi):**
   Membaca [outreach-send-ledger.jsonl](file:///c:/JAGAT/ops/revenue/outreach-send-ledger.jsonl) baris demi baris. Mengisi `idempotencyIndex: Map<string, string>` dengan kunci `{lead_id}:{campaign_id}:{type}`.
2. **Langkah 2 (Muat Keputusan Approval):**
   Membaca `approval-ledger.jsonl`. Catatan yang sudah berstatus `approval_status: 'APPROVED'` atau `'REJECTED'` dipertahankan statusnya dan **TIDAK PERNAH dikembalikan menjadi `PENDING`**.
3. **Langkah 3 (Muat Prospek Aktual):**
   Membaca [PROSPECT_TRACKER.csv](file:///c:/JAGAT/ops/revenue/PROSPECT_TRACKER.csv) (101 leads). Status setiap lead disinkronkan dengan record terbaru di send ledger dan approval ledger.
4. **Langkah 4 (Muat Notification Ledger):**
   Membaca `telegram-events.jsonl` untuk memastikan tidak ada notifikasi ganda yang ditembakkan ke bot.

---

## 3. Penanganan Crash & Rekonsiliasi State

Jika terjadi crash server di tengah proses transmisi:
1. **Status RESERVED:** Saat pengiriman dimulai, status transmisi ditandai `RESERVED` di memori dan dicatat ke event temporary.
2. **Deteksi Crash Saat Startup:**
   Jika sistem membaca ada record `RESERVED` di ledger tanpa Message-ID penyelesaian:
   - Status transmisi ditetapkan menjadi: `NEEDS_RECONCILIATION`.
   - `approval_status` manusia tetap tidak berubah (misal tetap `APPROVED`).
   - Sistem memblokir pengiriman ulang otomatis (*duplicate retry blocked*) untuk mencegah double-send.
3. **Aksi Rekonsiliasi:**
   Founder memiliki 2 opsi di antarmuka Console:
   - **Confirm Sent:** Jika email sudah diverifikasi sampai di inbox/sent Gmail $\rightarrow$ set `delivery_status: SENT` dan masukkan Message-ID manual/audit.
   - **Reset to Approved:** Jika email ternyata gagal keluar dari SMTP $\rightarrow$ kembalikan `delivery_status: NOT_SENT` agar antrean dapat dieksekusi ulang dengan aman.
