# JAGAT G7 — Phase 1 Minimal Change Plan (Remediation Plan)
**Status:** DRAFT PROPOSAL — AWAITING FOUNDER APPROVAL  
**Mode:** AUDIT FIRST — NO AUTOMATIC REFACTOR  

---

## 1. Ringkasan Rencana Perbaikan Minimal

Perbaikan dirancang untuk menyelesaikan 3 akar masalah tanpa mengubah arsitektur inti maupun melakukan refactoring besar:

### Task 1: Sinkronisasi State Approval saat Lead Dikirim (High Priority)
* **File:** `src/phase1/engine.ts`
* **Lokasi:** Di dalam fungsi `executeOutboundSend()`.
* **Perubahan:** Saat lead berpindah ke status `SENT`, cari record approval terkait di `this.approvals` dan ubah statusnya menjadi `APPROVED` serta set `decided_at`.
* **Dampak:** Menghilangkan anomali di mana prospek yang sudah terkirim (seperti Mutiara Printing) masih menggantung di antrean Telegram Approval Gate.
* **Risiko:** Sangat rendah (hanya pembaruan status referensi).

### Task 2: Penjelasan Label Metrik UI Funnel (Medium Priority)
* **File:** `src/components/LeadPipelineView.tsx` dan `src/components/TelegramApprovalView.tsx`
* **Perubahan:** Memperjelas teks label dari *"Outbound Sent: 6"* menjadi *"Outbound Sent (All Time): 6"* dan *"Sent Today: 4 / 10 (Daily Quota)"*.
* **Dampak:** Menghilangkan kebingungan antara akumulasi total kampanye dengan batasan kuota harian.
* **Risiko:** Nol (hanya teks label).

### Task 3: Sinkronisasi Persistensi Disk (Medium Priority)
* **File:** `server.ts` / `src/phase1/engine.ts`
* **Perubahan:** Menyediakan fungsi export/sync snapshot ke `ops/revenue/outreach-send-ledger.jsonl` dan `ops/revenue/PROSPECT_TRACKER.csv` milik core JAGAT saat terjadi pengiriman sukses atau penambahan prospek baru.
* **Dampak:** Perubahan data di console tidak hilang saat proses server di-restart.
* **Risiko:** Rendah (penambahan append file tanpa menghapus data yang ada).

---

## 2. Urutan Eksekusi Setelah Persetujuan

1. **Step 1:** Perbaiki sinkronisasi `approval.decision` di `engine.ts` (Task 1).
2. **Step 2:** Perbaiki label metrik UI (Task 2).
3. **Step 3:** Jalankan `npm test` dan `npm run lint` untuk memastikan 0 regresi.
4. **Step 4:** Restart daemon console di port 5005.
