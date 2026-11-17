# JAGAT G7 — Phase 1.1 Source of Truth Mapping (Revised)
**Document Version:** 1.1.0 (Architecture Review Revision)  
**Status:** DRAFT PROPOSAL — AWAITING FOUNDER APPROVAL  

---

## 1. Pemetaan Sumber Otoritatif Sejati (JAGAT Core)

Sesuai koreksi Arsitektur Review #5, **JAGAT Core adalah satu-satunya sumber kebenaran**. Console tidak boleh mempertahankan data bayangan yang bertentangan.

| Domain Data | Sumber Otoritatif (Core JAGAT) | Format & Lokasi File | Provenance Badge | Peran Console (Port 5005) |
|:---|:---|:---|:---:|:---|
| **Prospect Records (Leads)** | Core Prospect Tracker | `C:\JAGAT\ops\revenue\PROSPECT_TRACKER.csv` | `ACTUAL` | Read bootstrap + append lead baru via coordinated writer. |
| **Outreach Send Ledger** | Core Delivery Ledger | `C:\JAGAT\ops\revenue\outreach-send-ledger.jsonl` | `ACTUAL` | Membaca riwayat untuk membangun `idempotencyIndex`. Append event pengiriman baru. |
| **Approval Lifecycle** | Coordinated Approval Ledger | `C:\JAGAT\ops\revenue\approval-ledger.jsonl` | `ACTUAL` | Membaca keputusan manusia (`PENDING` / `APPROVED` / `REJECTED`). Update saat founder klik tombol. |
| **Telegram Notifications** | Telegram Event Ledger | `C:\JAGAT\ops\revenue\telegram-events.jsonl` | `ACTUAL` | Mencegah duplicate notification event ID. |
| **Inbound Replies & Safety** | Inbound Audit Ledger | `C:\JAGAT\ops\revenue\inbound-ledger.jsonl` | `ACTUAL` | Mencatat evaluasi intent, injection trigger, dan eskalasi review. |
| **Model Usage & Cost** | Model Usage Ledger | `C:\JAGAT\ops\revenue\model-usage-ledger.jsonl` | `ESTIMATED` | Akumulasi biaya IDR dari token riil per task type. |
| **Distributed Locks** | Redis Broker Key-Value | `127.0.0.1:6379` (`colony:campaign:lock:*`) | `ACTUAL` | Verifikasi kepemilikan lock token sebelum eksekusi swarm. |
| **Vector Memory Health** | Qdrant Vector Collection | `127.0.0.1:6333` (`jagat_indonesia_knowledge`) | `ACTUAL` | Validasi 768 dimensi dan status retrieval dokumen. |

---

## 2. Pemisahan Kolom State: Approval vs Delivery

Pada `approval-ledger.jsonl` dan memori runtime, record dipisahkan secara struktural:

```json
{
  "approval_id": "appr-lead-mutiara-001",
  "lead_id": "lead-mutiara-001",
  "campaign_id": "camp-id-b2b-q4",
  "approval_status": "APPROVED",
  "approved_by": "founder_telegram_12345678",
  "decided_at": "2026-10-30T18:00:00.000Z",
  "decision_note": "Approved via interactive telegram button",
  
  "delivery_record": {
    "delivery_status": "SENT",
    "provider_message_id": "<f89a5055-25b8-1316-c644-32efd6cf93c3@gmail.com>",
    "idempotency_key": "lead-mutiara-001:camp-id-b2b-q4:initial_outreach",
    "sent_at": "2026-10-30T18:05:38.000Z",
    "delivery_actor": "live-smtp-operator"
  }
}
```

* **Penjelasan:**
  - Jika lead dikirim via sandbox simulator tanpa persetujuan manusia:
    - `approval_status`: `PENDING` (tidak berubah!)
    - `delivery_status`: `SENT` (dengan flag `simulated: true`).
  - Ini memastikan metrik *Pending Approval* di dashboard mencerminkan fakta otentik keputusan manusia.

---

## 3. Metadata Provenance pada API Snapshot

Endpoint `/api/phase1/snapshot` memperbarui response objek agar setiap metrik memiliki provenance eksplisit:

```json
{
  "funnel_metrics": {
    "total_leads": { "value": 101, "provenance": "ACTUAL", "source": "PROSPECT_TRACKER.csv" },
    "pending_approvals": { "value": 2, "provenance": "ACTUAL", "source": "approval-ledger.jsonl" },
    "sent_today": { "value": 5, "provenance": "ACTUAL", "source": "outreach-send-ledger.jsonl" },
    "lifetime_sent": { "value": 7, "provenance": "ACTUAL", "source": "outreach-send-ledger.jsonl" },
    "api_cost_idr": { "value": 199.3, "provenance": "ESTIMATED", "source": "model-usage-ledger.jsonl" },
    "qdrant_points": { "value": 142, "provenance": "ACTUAL", "source": "qdrant:6333" }
  }
}
```
