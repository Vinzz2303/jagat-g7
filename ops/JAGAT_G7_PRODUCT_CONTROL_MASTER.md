# JAGAT G7 Product Control Master

Tanggal: 2026-06-09
Status: Baseline kontrol produk v1
Owner: Faturachman Al Kahfi
Mode: Stealth Intelligence Lab

---

## 1. Tujuan Dokumen

Dokumen ini menjadi pagar produk untuk JAGAT G7 agar eksekusi tidak melebar. Dokumen ini tidak menggantikan blueprint, masterplan, backlog, decision log, atau risk register. Dokumen ini menyatukan semuanya menjadi bahasa produk yang bisa dipakai untuk menurunkan PRD, SRS, SDD, FSD, UI/UX Flow, ERD/Data Model, dan backlog berikutnya.

Masalah yang diselesaikan dokumen ini:

- Visi besar sudah kuat, tetapi definisi produk belum cukup terkunci.
- Banyak fitur sudah selesai, tetapi hubungan antar fitur belum selalu jelas.
- Colony berkembang cepat, tetapi belum semua pekerjaan diturunkan dari PRD/SRS/FSD formal.
- UI mengikuti implementasi, bukan flow produk yang disepakati.
- Data model tersebar di Redis, Qdrant, JSONL, file ops, dan token registry.

## 2. Posisi Produk

JAGAT G7 adalah Sovereign Intelligence Operating System dengan chat sebagai salah satu interface utama.

JAGAT G7 bukan chatbot generik. Artinya JAGAT boleh memiliki chat UI, tetapi nilai utamanya bukan sekadar membalas teks. Chat adalah cockpit. Colony adalah engine internal. JAGAT adalah intelligence system yang menggabungkan memory, reasoning, agent orchestration, execution, evaluation, lesson learning, dan sovereign infrastructure.

Kalimat kendali produk:

> JAGAT memiliki chat, tetapi JAGAT bukan sekadar chat. Chat adalah pintu komando menuju sistem intelijen.

## 3. Mode Strategis Saat Ini

Mode saat ini: Stealth Intelligence Lab.

Implikasi:

- Tidak mengejar public SaaS self-serve untuk saat ini.
- Tidak mengejar payment gateway sekarang.
- Tidak mengejar marketing publik besar.
- Fokus utama adalah mematangkan intelligence core secara senyap.
- Revenue/commercial layer tetap disimpan, tetapi bukan prioritas eksekusi harian.
- Klaim AGI/super intelligence tidak dipublikasikan sebelum ada benchmark dan demo kemampuan yang kuat.

## 4. Lapisan Produk

| Layer | Nama | Fungsi | Status |
| --- | --- | --- | --- |
| L1 | JAGAT Core | Identity, reasoning policy, memory-grounded response, benchmark | Aktif |
| L2 | Colony Internal Workforce | Mission, task, scheduler, reviewer, worker, reporter | Aktif |
| L3 | Memory Layer | Redis session/ops state, Qdrant curated knowledge, JSONL ledger | Aktif |
| L4 | Model/Inference Layer | Ollama local, remote optional, model routing/advisory arena | Aktif |
| L5 | Founder Intelligence Console | Internal command center, admin, Colony, memory, usage | Aktif |
| L6 | Downstream Agents | Kiting AI, Ting AI, G7 Motherbox boundaries | Baseline selesai |
| L7 | Commercial Layer | Manual usage, invoice request, admin token ops | Dormant/sekunder |

## 5. Pengguna Utama

Pengguna utama saat ini:

1. Founder: memberi misi, meninjau keputusan, menyetujui aksi berisiko, membaca laporan.
2. Colony: armada AI internal yang mengeksekusi, mengevaluasi, mencatat, dan belajar.
3. Internal operator: memakai admin/product console untuk melihat memory, usage, task, request, dan status sistem.

Pengguna nanti:

1. Pengguna eksternal untuk Kiting AI, Ting AI, dan Motherbox.
2. Audiens enterprise/investor.
3. Konsumen API.

## 6. Definisi Produk Saat Ini

Produk awal:

Founder Intelligence Console + Colony Workforce.

Produk saat ini belum public chatbot SaaS. Produk serius pertama adalah sistem komando intelijen internal tempat founder dapat:

- bertanya dengan jawaban berbasis curated memory;
- membuat mission dan task;
- melihat kerja agent;
- meninjau patch proposal;
- melihat evaluation score;
- menyelesaikan mission dengan outcome summary;
- menyimpan lesson;
- memantau verification dan performa model;
- menjaga batas melalui founder gate.

## 7. Kemampuan Inti

Kemampuan yang harus tetap menjadi pusat:

1. Memory-grounded reasoning.
2. Mission/task execution.
3. Evaluation layer.
4. Lesson memory.
5. Verifier gate.
6. Model arena.
7. Downstream agent boundary.
8. Audit trail dan founder-gated approval.

## 8. Definisi "Pintar"

JAGAT tidak dianggap makin pintar hanya karena punya context window lebih panjang, agent lebih banyak, atau layar lebih ramai.

JAGAT menjadi makin pintar ketika bisa:

- mengambil konteks yang tepat;
- mematuhi keputusan terkunci;
- bernalar dari roadmap, risk, dan evidence;
- membuat rencana yang scoped;
- mengeksekusi task secara aman;
- mengevaluasi kualitas output;
- belajar dari mission outcome;
- memakai ulang lesson;
- mengarahkan pekerjaan ke model yang lebih cocok;
- tidak mengulang kegagalan yang sama.

## 9. Ukuran Keberhasilan

| Metrik | Makna |
| --- | --- |
| Benchmark pass rate | Identity, cognitive, memory, no-leak, routing, dan reasoning test lulus |
| Task completion quality | Rata-rata quality_score pada task review/done |
| Mission outcome quality | Rata-rata mission outcome score dan blocked pattern rate |
| Lesson reuse rate | Seberapa sering lesson relevan memengaruhi planning berikutnya |
| Context retrieval precision | Apakah dokumen yang diambil benar-benar sesuai task dan source of truth |
| Model routing accuracy | Apakah rekomendasi model meningkatkan quality/latency |
| Safety pass rate | Tidak ada regresi auth, prompt leakage, Qdrant pollution, atau unsafe automation |

## 10. Di Luar Scope Saat Ini

Jangan prioritaskan:

- Public SaaS self-serve.
- Payment gateway.
- Auto token activation dari payment.
- Auto fine-tuning.
- Unrestricted worker shell.
- Auto deploy.
- Klaim AGI/super intelligence publik.
- Refactor besar Express/Next architecture.
- Menulis Colony lessons ke sovereign memory tanpa founder-reviewed policy.

## 11. Hirarki Dokumen

Urutan dokumen kontrol produk:

1. Product Control Master.
2. PRD v1.
3. SRS v1.
4. SDD v1.
5. FSD v1.
6. UI/UX Flow v1.
7. ERD/Data Model v1.
8. Backlog cleanup.

## 12. Pekerjaan Dokumentasi Berikutnya

Segera:

1. PRD v1.
2. SRS v1.
3. Tahan fitur intelligence baru sampai baseline ini diterima.

Selesai pada 2026-06-09:

- SDD v1 untuk arsitektur dan modul.
- FSD v1 untuk perilaku fitur.
- UI/UX Flow v1 untuk founder console, chat cockpit, mission, task, memory, lesson, verifier, dan model arena.
- ERD/Data Model v1 untuk Redis/Qdrant/JSONL/ops markdown/token registry.
- Backlog cleanup berdasarkan dokumen formal v1.

Berikutnya:

1. Founder review atas dokumen kontrol produk.
2. Pilih urutan v0D dari backlog cleanup.
3. Turunkan task terpilih ke `TECHNICAL_BACKLOG.md` dan `PRODUCT_BACKLOG.md` bila sudah disetujui.
