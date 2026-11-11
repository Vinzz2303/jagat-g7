# JAGAT Usage Metering and Pricing Design

Tanggal: 2026-06-08
Status: Phase 5 design + persistent metering/admin/commercial-intake MVP
Source of truth: P-006 Pricing and token usage UX, next technical priority after P-005

## Implementation Update - 2026-06-08 Persistent Usage Ledger

Status: Durable usage event ledger implemented for manual/service-delivery metering.

Implemented:

- usage events append to `data/usage_events.jsonl`;
- quota summaries read durable daily units instead of process-local memory only;
- `recordUsage()` stores token hash, owner display name, tier, agent mode, endpoint, units, status, context doc count, and latency;
- success/refused public tier events consume 1 unit; backend error events and SOVEREIGN events are audited with 0 billable units;
- `/api/secure-research` records success and backend error events;
- SOVEREIGN-only `GET /api/admin/usage`;
- `/g7-admin` usage ledger panel with today units, by-tier/mode aggregates, and recent hashed events;
- `npm run test:usage-ledger` verifies durable units and absence of raw token/prompt/answer data.

Still not implemented:

- production billing ledger/table;
- invoice PDF generation;
- Midtrans/payment gateway;
- customer self-serve checkout;
- automated payment-to-token activation.

Decision:

This is a durable MVP ledger for manual quota enforcement and admin visibility. It is not a billing-grade customer statement system and must not be used as automatic charging evidence without a later payment/refund policy.

## Implementation Update - 2026-06-08 Manual Commercial Gateway

Status: Manual invoice request intake + admin status transitions + Markdown invoice draft implemented.

Implemented:

- public `POST /api/commercial/requests` for manual invoice requests;
- local append-only request ledger at `data/commercial_requests.jsonl`;
- SOVEREIGN-only `GET/PATCH /api/admin/commercial-requests`;
- SOVEREIGN-only `POST /api/admin/commercial-requests/invoice` for Markdown invoice drafts;
- `/pricing` request-invoice form with PRO/ULTRA quota-aligned copy;
- `/g7-admin` manual commercial request review panel, status buttons, and copyable invoice draft panel;
- public pricing no longer displays bank account details;
- credential/secret markers are rejected before a request is stored.

Still not implemented:

- PDF invoice generation;
- persistent usage event ledger;
- Midtrans/payment gateway;
- customer self-serve checkout.

Decision:

This gateway is an intake, status, and invoice-draft handoff layer for manual service delivery. It does not activate tokens automatically, does not collect payment data, and does not send invoices automatically.

## Implementation Update - 2026-06-08 Admin Token Ops

Status: Admin token operations MVP implemented for manual/service-delivery revenue.

Implemented:

- token registry server helpers for suspend, activate, and extend;
- `/api/admin/tokens` PATCH action with `suspend`, `activate`, and `extend`;
- admin UI action buttons per token row;
- server-session based SOVEREIGN gate in admin page display;
- SOVEREIGN token suspend guard to avoid founder lockout;
- admin status feedback for manual token operations.

Still not implemented:

- automatic/PDF invoice generation;
- Midtrans/payment gateway;
- customer self-serve checkout;
- long-term billing analytics.

Decision:

Manual token operations are now usable for early service delivery. This remains controlled admin tooling, not SaaS self-serve billing.

## Implementation Update - 2026-06-08

Status: MVP implemented for console research requests; durable ledger added later on 2026-06-08.

Implemented:

- `jagat-ui/src/lib/usage-metering.ts`
- persistent daily quota by token hash or guest fingerprint via `data/usage_events.jsonl`
- no raw token/prompt/answer/payment persistence
- `SOVEREIGN` bypass as internal tier
- `PRO` 50/day, `ULTRA` 250/day, `GUEST` 5/day
- `/api/secure-research` signed-session validation and quota check
- usage summary returned to console via `X-JAGAT-Usage-Summary`
- console header/footer displays tier, quota, and expiry when session provides it

Not implemented yet:

- production billing ledger
- Midtrans/payment gateway
- production API key management
- long-term usage analytics

Decision:

This is a metering MVP for visibility and guardrail, not a SaaS billing system. Revenue remains manual/service delivery until admin operations and commercial gateway policy are locked.

## Tujuan

Dokumen ini mendefinisikan desain awal usage metering, quota, dan pricing UX untuk Phase 5. Scope ini belum mengaktifkan billing production, belum mengubah token registry, dan belum menambah payment gateway.

## Current State

- Token registry berada di `jagat-ui/src/lib/token-registry.ts`.
- Tier aktif: `GUEST`, `PRO`, `ULTRA`, `SOVEREIGN`.
- Admin token page dapat membuat token `PRO` dan `ULTRA`.
- Pricing page masih manual purchase flow.
- Console sudah punya mode `research`, `kiting`, `ting`, dan `motherbox`.
- Ledger penggunaan per request sudah aktif sebagai JSONL lokal tersanitasi di `data/usage_events.jsonl`.

## Metering Principles

1. Metering wajib audit-friendly dan tidak mencatat payload sensitif mentah.
2. Usage dihitung dari event kecil, bukan dari log chat bebas.
3. Tier policy harus bisa dijelaskan di UI: quota, used, remaining, reset, expiry.
4. Over-quota harus hard stop untuk public tiers dan warning untuk founder/internal.
5. SOVEREIGN tidak diperlakukan sebagai customer billing tier.

## Usage Event Schema

Minimum event:

```json
{
  "event_id": "usage_YYYYMMDD_random",
  "request_id": "req_random",
  "created_at": "2026-06-08T00:00:00.000Z",
  "token_hash": "sha256(token)",
  "owner_name": "Display owner",
  "tier": "PRO",
  "agent_mode": "research",
  "endpoint": "/research",
  "unit": "request",
  "units": 1,
  "context_docs_used": 4,
  "latency_ms": 120000,
  "status": "success",
  "refusal_reason": null
}
```

Do not store:

- raw token,
- raw user prompt,
- raw answer,
- uploaded document content,
- credentials,
- payment data.

## Quota Policy Draft

| Tier | Daily Research Requests | Ingest | Agent Modes | Notes |
| --- | ---: | --- | --- | --- |
| GUEST | 5 | no | research demo only | public trial |
| PRO | 50 | no | research, kiting | paid entry |
| ULTRA | 250 | limited/manual approved | research, kiting, ting, motherbox preview | priority workspace |
| SOVEREIGN | internal | internal | all + colony | not billed |

Reset cadence: daily at local server day boundary for request quota. Expiry remains token-based.

## Enforcement Path

1. Validate session/token.
2. Resolve tier and expiry.
3. Estimate event cost before execution.
4. Check quota.
5. If allowed, execute request.
6. Record usage event with final status and latency.
7. Return usage summary to UI.

For failed requests:

- validation/auth failure: no customer usage charge;
- model/backend failure: record event with `status=error`, no quota decrement until policy is locked;
- refusal: record event with `status=refused`, count as 1 request only after founder approval of policy.

## UX Requirements for P-006

Console should show:

- current tier,
- token expiry,
- daily quota,
- used today,
- remaining today,
- reset time,
- soft warning at 80 percent,
- over-quota message with upgrade/manual contact path.

Admin should show:

- active tokens,
- expired tokens,
- estimated monthly revenue,
- usage by tier,
- top tokens by request count,
- suspended/over-quota indicators.

## Storage Options

Option A: Redis first.

- Good for fast MVP and daily quota.
- Needs periodic summary/export if long-term billing history is required.

Option B: PostgreSQL/Supabase table.

- Better for billing history and admin analytics.
- Requires schema migration discipline and fallback behavior.

Recommended path:

1. Redis daily counters for enforcement.
2. Append usage event summaries to PostgreSQL when DB is reachable.
3. Keep memory fallback read-only for customer billing claims.

## Safety Boundary

Do not implement automatic charging yet. Manual invoice remains official until:

- metering is tested,
- quota policy is locked,
- admin suspend/extend exists,
- payment/refund policy exists,
- Midtrans/manual invoice decision is locked.

## Acceptance Criteria

Phase 5 metering design is ready for implementation when:

1. event schema is accepted;
2. quota policy is accepted;
3. storage path is selected;
4. UI states are mapped;
5. tests are defined for quota allow, quota block, expired token, suspended token, and SOVEREIGN bypass;
6. no payload-sensitive data is persisted.
