# JAGAT G7 Phase 3B - Strategic Document Manifest

## Status

Status: Done for Wave 1 curation.

Phase 3B tidak melakukan ingest, ekstraksi, normalisasi, atau embedding. Fase ini hanya memilih dokumen strategis yang layak menjadi sumber memori utama JAGAT G7 dan mengunci metadata/provenance awalnya.

## Wave 1 - Founder Strategic Core

Tujuan Wave 1 adalah memasukkan tiga dokumen inti yang menjadi fondasi arah JAGAT G7:

1. Blueprint teknis.
2. Roadmap strategis.
3. Milestone proyek.

Ketiganya dipilih karena langsung menjawab pertanyaan arsitektur, arah fase, prioritas kerja, dan bukti progres.

## Manifest Ringkas

| ID | Title | File | Category | Doc Type | Trust Level | Status |
| --- | --- | --- | --- | --- | --- | --- |
| JAGAT-W1-001 | JAGAT G7 Technical Blueprint | `JAGAT_G7_Technical_Blueprint.pdf` | `blueprint` | `pdf` | `founder_verified` | Curated |
| JAGAT-W1-002 | JAGAT G7 Sovereign Roadmap | `JAGAT G7 Sovereign Roadmap.pdf` | `roadmap` | `pdf` | `founder_verified` | Curated |
| JAGAT-W1-003 | JAGAT G7 Project Milestones V5 | `JAGAT_G7_Project_Milestones_V5.xlsx` | `milestone` | `xlsx` | `founder_verified` | Curated |

## Detail Metadata Phase 3A

### JAGAT-W1-001 - Technical Blueprint

```json
{
  "title": "JAGAT G7 Technical Blueprint",
  "source": "jagat-g7-technical-blueprint",
  "category": "blueprint",
  "doc_type": "pdf",
  "owner": "Faturachman Al Kahfi",
  "created_at": "2026-05-20",
  "trust_level": "founder_verified",
  "provenance": "local file from founder workstation Downloads folder",
  "notes": "Core technical architecture reference for Phase 3 memory ingestion.",
  "local_path": "C:\\Users\\Administrator\\Downloads\\JAGAT_G7_Technical_Blueprint.pdf",
  "sha256": "A64FD879DE116A376D03D84DE595CDA6E13240D4434F71080A2C32F7C8B6040E",
  "size_bytes": 91670
}
```

### JAGAT-W1-002 - Sovereign Roadmap

```json
{
  "title": "JAGAT G7 Sovereign Roadmap",
  "source": "jagat-g7-sovereign-roadmap",
  "category": "roadmap",
  "doc_type": "pdf",
  "owner": "Faturachman Al Kahfi",
  "created_at": "2026-05-20",
  "trust_level": "founder_verified",
  "provenance": "local file from founder workstation Downloads folder",
  "notes": "Strategic roadmap reference for execution sequencing and long-term direction.",
  "local_path": "C:\\Users\\Administrator\\Downloads\\JAGAT G7 Sovereign Roadmap.pdf",
  "sha256": "2E1BD914218CBC344F7FAED07AE7E43E8AAEDEA25CB192B9FE3273B8245D17BE",
  "size_bytes": 1901895
}
```

### JAGAT-W1-003 - Project Milestones V5

```json
{
  "title": "JAGAT G7 Project Milestones V5",
  "source": "jagat-g7-project-milestones-v5",
  "category": "milestone",
  "doc_type": "xlsx",
  "owner": "Faturachman Al Kahfi",
  "created_at": "2026-05-20",
  "trust_level": "founder_verified",
  "provenance": "local file from founder workstation Downloads folder",
  "notes": "Milestone tracking reference for delivery progress and project status.",
  "local_path": "C:\\Users\\Administrator\\Downloads\\JAGAT_G7_Project_Milestones_V5.xlsx",
  "sha256": "AC35564E96D5EFAAAB852BBF2D3F35660461544E8E3385F09F0EC87BB337E5FC",
  "size_bytes": 11663
}
```

## Hold / Reject List

Belum ada dokumen Wave 1 yang ditahan atau ditolak.

Aturan hold:

- File tidak ditemukan.
- Sumber tidak jelas.
- Hash berubah tanpa alasan.
- Dokumen berisi prompt/debug transcript.
- Dokumen adalah output model, bukan knowledge terkurasi.
- Dokumen belum disahkan founder atau tim inti.

## Acceptance Criteria

- Daftar dokumen prioritas tersedia.
- Setiap dokumen punya kategori, owner, trust level, provenance, local path, dan SHA256.
- Dokumen Wave 1 dibatasi pada Blueprint, Roadmap, dan Milestone.
- Tidak ada ingest dilakukan pada Phase 3B.
- Manifest siap dipakai Phase 3C untuk digitalisasi dan normalisasi.

## Next Step

Phase 3C - Digitalisasi dan Normalisasi Dokumen:

- Extract PDF text.
- Extract XLSX sheet content.
- Normalize encoding dan whitespace.
- Simpan normalized text sebagai artifact audit.
- Buat extraction report sebelum chunking dan embedding.
