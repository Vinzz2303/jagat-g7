# JAGAT G7 PRD v1

Tanggal: 2026-06-09
Status: Draft baseline
Owner: Faturachman Al Kahfi
Mode strategis: Stealth Intelligence Lab

---

## 1. Nama Produk

JAGAT G7.

## 2. Ringkasan Produk

JAGAT G7 adalah sovereign intelligence operating system. JAGAT menyediakan conversational cockpit, curated memory, internal AI workforce, mission/task execution, quality evaluation, lesson memory, verifier gate, dan model performance tracking.

JAGAT memiliki chat interface, tetapi JAGAT bukan chatbot generik. Chat interface adalah permukaan komando dan reasoning. Nilai produk ada pada intelligence loop di belakangnya.

## 3. Problem Statement

AI tools saat ini sangat kuat, tetapi sering gagal dalam project control jangka panjang:

- Kehilangan konteks operasional lintas sesi.
- Bisa menjawab, tetapi tidak selalu bisa mengeksekusi.
- Tidak menjaga project decisions sebagai batasan yang mengikat.
- Tidak mengevaluasi kualitas kerja sendiri sebelum dilihat user.
- Jarang mengubah pekerjaan selesai menjadi lesson yang bisa dipakai ulang.
- Tidak menjaga sovereign local memory dan execution stack yang dikendalikan founder.

JAGAT menyelesaikan masalah ini dengan menggabungkan memory, execution, evaluation, dan learning dalam satu sistem yang dikendalikan founder.

## 4. Visi

Membangun Sovereign Super Intelligence Core dari Indonesia: sistem intelijen yang dapat bernalar, mengeksekusi, mengevaluasi, belajar, dan meningkat di bawah otoritas founder dan infrastruktur berdaulat.

## 5. Mode Produk Saat Ini

Stealth Intelligence Lab.

Artinya:

- Bangun kemampuan intelligence sebelum marketing publik.
- Commercial layer tersedia, tetapi sekunder.
- Hindari klaim AGI publik.
- Ukur kecerdasan lewat benchmark dan mission outcome.
- Fokus pada kemampuan internal sampai demo besar muncul secara kuat.

## 6. Produk Awal

Founder Intelligence Console + Colony Workforce.

Workflow utama:

1. Founder memberi misi atau research question.
2. JAGAT mengambil memory dan source-of-truth docs yang relevan.
3. Colony membuat task, rencana eksekusi, atau proposed changes.
4. Worker/reviewer flow menghasilkan output.
5. Evaluation memberi quality score.
6. Mission outcome menghasilkan lesson.
7. Verifier gate menahan patch yang gagal verification.
8. Model arena mencatat performa dan memberi rekomendasi advisory.

## 7. Pengguna Utama

### Founder

Kebutuhan:

- strategic control yang reliable;
- direct command interface;
- audit visibility;
- approval gate yang aman;
- ringkasan progres tingkat tinggi.

### Colony

Kebutuhan:

- task queue;
- memory access;
- state machine;
- evaluation;
- lessons;
- permission boundaries.

### Internal Operator

Kebutuhan:

- melihat memory dan usage;
- memeriksa task dan mission;
- meninjau commercial/manual artifacts bila diperlukan;
- menjalankan admin flow secara aman.

## 8. Kemampuan Utama

### C1. Conversational Cockpit

Interface seperti chat untuk mission intake, research, command, dan review. UI boleh terasa familiar seperti GPT/Claude/Gemini, tetapi tujuannya adalah mengoperasikan JAGAT, bukan sekadar menjawab teks.

### C2. Memory-Grounded Reasoning

JAGAT mengambil curated documents dari memory dan menampilkan sumber saat relevan. Untuk task internal, sistem harus memprioritaskan decision log, risk register, roadmap, backlog, dan recent logs.

### C3. Mission/Task Execution

Colony memecah arahan founder menjadi mission dan task dengan status, owner, acceptance criteria, evidence, dan audit trail.

### C4. Evaluation Layer

Setiap task yang masuk review/done dapat menerima quality_score evidence. Score bersifat advisory dan tidak menggantikan approval founder.

### C5. Lesson Memory

Mission yang selesai menghasilkan outcome summary dan lesson internal Redis-only. Lesson tidak otomatis mencemari sovereign Qdrant memory.

### C6. Verifier Gate

Patch approval mengecek verification record. Failed verification memblokir approval. Missing atau pending verification masih diizinkan pada baseline v0C agar workflow tidak macet mendadak.

### C7. Model Arena

Performa model dicatat berdasarkan model dan task type. Rekomendasi tetap advisory sampai data cukup.

### C8. Downstream Agent Boundary

Kiting AI, Ting AI, dan G7 Motherbox tetap menjadi downstream agents dengan scope, refusal policy, dan memory/tool boundary yang terpisah.

## 9. Non-Goals

Bukan prioritas saat ini:

- Public SaaS launch.
- Payment gateway.
- Automatic payment-to-token activation.
- Autonomous coding tanpa batas.
- Klaim AGI publik.
- Auto fine-tuning.
- Membuka Colony internals ke public users.

## 10. Success Metrics

| Metrik | Arah Target |
| --- | --- |
| Benchmark pass rate | Naik dan stabil |
| Task completion quality | Average quality_score meningkat |
| Mission outcome quality | Lebih banyak done, lebih sedikit blocked, summary lebih kuat |
| Lesson reuse rate | Lesson memengaruhi mission berikutnya |
| Context retrieval precision | Dokumen irrelevant makin sedikit |
| Model routing accuracy | Rekomendasi advisory berbasis bukti |
| Safety | Nol regresi auth/prompt/memory contamination yang diketahui |

## 11. Batas MVP

MVP saat ini bersifat internal, bukan publik:

- Founder console.
- Research/chat cockpit.
- Colony mission/task system.
- Memory library.
- Evaluation score.
- Lesson memory.
- Verifier soft gate.
- Model arena advisory.

## 12. Strategi Release

### Saat Ini

Stealth internal lab.

### Berikutnya

Internal demo: satu misi dari founder instruction sampai planning, execution, evaluation, lesson, dan report.

### Nanti

Produk publik dapat mengekspos selected agents, tetapi bukan Colony internals.

## 13. Risiko Produk

| Risiko | Mitigasi |
| --- | --- |
| Project berubah menjadi chatbot generik | Jaga chat sebagai cockpit, bukan identitas |
| Project melebar tanpa struktur | Gunakan product control docs sebelum fitur baru |
| Memory pollution | Pisahkan curated Qdrant dan operational lessons |
| Autonomy menjadi tidak aman | Founder gate, red lines, verifier, audit |
| Klaim intelligence melebihi bukti | Gunakan benchmark dan mission metrics |
