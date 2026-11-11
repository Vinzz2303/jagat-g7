# JAGAT G7 Weekly Execution Loop

Ritme ini dipakai agar Faturachman + armada AI bergerak seperti organisasi besar tanpa organisasi manusia yang gemuk.

## Senin - Founder Command

- Review masterplan aktif.
- Pilih 1 fase aktif dan maksimal 3 target mingguan.
- Update decision log jika ada keputusan baru.
- Update risk register untuk risiko yang naik.

Output wajib:

- 3 target minggu ini
- 1 risiko terbesar
- 1 keputusan yang harus dikunci

## Selasa-Rabu - Build and Verify

- Eksekusi task dari technical/product backlog.
- Tidak ada fitur liar di luar backlog.
- Setiap perubahan prompt/model harus menjalankan benchmark.
- Setiap perubahan memory/ingest harus menguji Qdrant.

Output wajib:

- File berubah
- Test/benchmark
- Gap yang tersisa

## Kamis - Product and Memory Review

- Review UI/UX dan ingest.
- Tentukan knowledge apa yang layak masuk Qdrant.
- Buang data yang tidak punya sumber/provenance.

Output wajib:

- Daftar dokumen ingest
- Daftar dokumen ditolak
- Perubahan UI yang dibutuhkan

## Jumat - Executive Readout

- Ringkas progres.
- Update backlog status.
- Update risk register.
- Tentukan next week priority.

Output wajib:

- Status fase
- PASS/FAIL benchmark
- Next action yang paling penting

## Daily Micro-Loop

```text
1. Apa tujuan hari ini?
2. Task ID mana yang dikerjakan?
3. Risiko apa yang bisa muncul?
4. Apa acceptance criteria?
5. Setelah selesai, benchmark apa yang dijalankan?
```
