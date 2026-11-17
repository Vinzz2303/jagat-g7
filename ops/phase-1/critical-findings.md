# JAGAT G7 — Phase 1 Critical Findings & Inconsistency Audit
**Audit Mode:** FORENSIC AUDIT — ROOT CAUSE ANALYSIS  
**Date:** 2026-10-30  

---

## 1. Analisis 5 Inkonsistensi Temuan Lapangan

### Temuan 1: Mutiara Printing SENT di Pipeline tapi PENDING_APPROVAL di Approval Gate
* **Tingkat Keparahan:** HIGH (Data Inconsistency)
* **Akar Masalah (Root Cause):**
  Di dalam `src/phase1/engine.ts`, fungsi `executeOutboundSend()` mengupdate status prospek:
  ```typescript
  this.transitionLeadState(lead.id, 'SENT', params.actor, 'OUTBOUND_EMAIL_SENT_STAGING', ...);
  ```
  Namun, fungsi tersebut **TIDAK memperbarui catatan approval** terkait (`this.approvals.get(approvalId)`). Akibatnya, `approval.decision` tetap bernilai `'PENDING'`. 
  Komponen `TelegramApprovalView.tsx` memfilter antrean menggunakan `approvals.filter(a => a.decision === 'PENDING')`, sehingga Mutiara Printing tetap muncul di antrean approval meskipun emailnya sudah terkirim.
* **Solusi Minimal:**
  Saat `executeOutboundSend()` berhasil, update approval terkait menjadi `APPROVED` atau hapus dari antrean pending:
  ```typescript
  const approval = this.approvals.get(`appr-${lead.id}`);
  if (approval && approval.decision === 'PENDING') {
    approval.decision = 'APPROVED';
    approval.decided_at = new Date().toISOString();
  }
  ```

---

### Temuan 2: Counter SENT TODAY 4/10 vs Total Outbound Sent 6
* **Tingkat Keparahan:** MEDIUM (UI Metric Label Ambiguity)
* **Akar Masalah (Root Cause):**
  Kedua angka ini mengukur dimensi yang berbeda tetapi labelnya dapat membingungkan:
  1. `Outbound Sent: 6` dihitung dari filter semua prospek berstatus aktif (`SENT`, `REPLIED`, `POSITIVE`, `MEETING`, `PROPOSAL`, `WON`) di seluruh masa kampanye (*Lifetime Sent Leads*).
  2. `SENT TODAY: 4/10` dihitung oleh `getSentCountToday()` yang memeriksa `sent_at.startsWith(todayPrefix)` dalam rentang 24 jam terakhir untuk menegakkan *Outreach Policy Rate Limit* (Max 10/hari).
  Sebanyak 2 prospek (`lead-iam-004` dan `lead-janjilaut-008`) memiliki tanggal pengiriman kemarin (`2026-10-29`), sehingga total lifetime adalah 6, namun yang terkirim hari ini adalah 4.
* **Solusi Minimal:**
  Ubah label UI di kartu metrik menjadi lebih eksplisit:
  - *"Total Outreach Sent (Lifetime): 6"*
  - *"Sent Today (Quota 24 Jam): 4 / 10"*

---

### Temuan 3: Inbound Closer Manual Form vs Automatic Background IMAP Worker
* **Tingkat Keparahan:** HIGH (Operational Gap)
* **Akar Masalah (Root Cause):**
  Tab 3 pada konsol `jagat-phase-1-console` adalah **Inbound Security Sandbox & Intent Classifier Simulator**. Tab ini dibuat untuk menguji apakah detektor prompt injection dan parser regex berfungsi memfilter payload jahat sebelum diteruskan ke model.
  Sementara itu, worker background pembaca email sesungguhnya berada di core repo: `c:\JAGAT\src\colony\closer-agent.ts` (menggunakan `imap-simple` dan `mailparser`). Worker ini belum diintegrasikan sebagai background service permanen pada console BFF.
* **Solusi Minimal:**
  1. Berikan penanda jelas di Tab 3: *"Interactive Sandbox & Security Evaluation"*.
  2. Tambahkan tombol *"Poll Gmail Inbox Now"* di backend yang memanggil fungsi koneksi IMAP dari `closer-agent.ts` secara terjadwal atau manual.

---

### Temuan 4: Acceptance Criteria 10/10 Verified vs Bukti Pengujian Backend
* **Tingkat Keparahan:** MEDIUM (Verification Scope)
* **Akar Masalah (Root Cause):**
  File pengujian `src/phase1/phase1.test.ts` (6 test suite, mencakup AC-1 s.d. AC-10) memverifikasi **logika internal state machine, aturan supresi, idempotensi, dan fallback policy** secara deterministik dalam memori.
  Pengujian otomatis tersebut sengaja tidak memanggil socket Redis 6379 atau koneksi Qdrant HTTP 6333 secara langsung agar test suite dapat berjalan cepat dan terisolasi (standar unit test hermetis). Namun, verifikasi live koneksi eksternal harus dipisahkan dalam *Integration Test Suite*.
* **Solusi Minimal:**
  Dokumentasikan pemisahan antara:
  - Unit Tests: 6/6 Pass (Logika Hermetis AC-1 s.d. AC-10).
  - Integration Tests: Live SMTP Verified, Live Qdrant Verified, Live Ollama Verified.

---

### Temuan 5: API Cost Rp199,3 vs Pencatatan Aktual Provider
* **Tingkat Keparahan:** MEDIUM (Data Grounding)
* **Akar Masalah (Root Cause):**
  Angka `Rp199,3` berasal dari 4 catatan tugas benih (*seed tasks*) di `engine.ts`:
  - `task_scout_001`: Rp13,4
  - `task_draft_002`: Rp10,4
  - `task_closer_003`: Rp0,0 (Lokal Ollama)
  - `task_proposal_004`: Rp175,5
  Total = Rp199,3.
  Angka ini adalah **baseline seed data** yang dihitung dari rumus token multiplier, bukan tarikan API langsung dari billing Google AI Studio atau OpenRouter.
* **Solusi Minimal:**
  Saat ada tugas baru yang dijalankan oleh Gemini melalui BFF, tambahkan konsumsi token riil ke dalam array `modelUsage` dan tampilkan label *"Estimated Token Cost (IDR)"*.
