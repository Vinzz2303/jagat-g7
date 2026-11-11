# JAGAT Manual Commercial Gateway Spec

Tanggal: 2026-06-08
Status: MVP active for manual/service-delivery revenue

## Purpose

This spec defines the early Phase 5 commercial gateway that can be used before SaaS self-serve billing is ready.

The gateway is an intake and admin-review flow, not a payment processor.

## Current Flow

1. Visitor opens `/pricing`.
2. Visitor chooses `G7 PRO Node` or `G7 ULTRA Node`.
3. Visitor submits name, contact, and optional notes.
4. `POST /api/commercial/requests` validates and stores a local request record.
5. Founder/admin opens `/g7-admin`.
6. Admin reviews `Manual Commercial Requests`.
7. Admin moves the request through `new -> qualified -> quoted -> closed_won/closed_lost`.
8. Admin generates a Markdown invoice draft for qualified/quoted/won requests.
9. Admin reviews/copies the draft and manually sends invoice/payment instructions outside the app.
10. After payment is confirmed manually, admin creates or extends a token in `/g7-admin`.

## Runtime Artifacts

- Public intake API: `jagat-ui/src/app/api/commercial/requests/route.ts`
- Admin review API: `jagat-ui/src/app/api/admin/commercial-requests/route.ts`
- Admin invoice draft API: `jagat-ui/src/app/api/admin/commercial-requests/invoice/route.ts`
- Admin usage API: `jagat-ui/src/app/api/admin/usage/route.ts`
- Server helper: `jagat-ui/src/lib/commercial-requests.ts`
- Usage helper: `jagat-ui/src/lib/usage-metering.ts`
- Invoice smoke test: `scripts/commercial-invoice-test.mjs`
- Public UI: `jagat-ui/src/app/pricing/page.tsx`
- Admin UI: `jagat-ui/src/app/g7-admin/page.tsx`
- Local ledger path: `data/commercial_requests.jsonl`

## Record Shape

Each request stores:

- request id,
- invoice draft code,
- created timestamp,
- package id/name,
- quoted price,
- client name,
- contact,
- channel,
- optional notes,
- source,
- `billingMode: manual_invoice`,
- `paymentStatus: not_requested`.

The gateway must not store:

- card data,
- bank credentials,
- passwords,
- API keys,
- raw prompts,
- customer document contents.

## Public Boundary

Allowed:

- public `POST /api/commercial/requests`,
- package selection,
- invoice request,
- admin-reviewed follow-up.

Disallowed:

- automatic payment charge,
- automatic token activation,
- public access to request list,
- mass outbound WhatsApp/email send,
- displaying bank account details on the public pricing page.

## Admin Boundary

`GET /api/admin/commercial-requests` remains under the existing SOVEREIGN-only admin route protection.
`PATCH /api/admin/commercial-requests` and `POST /api/admin/commercial-requests/invoice` are also under the same `/api/admin` SOVEREIGN-only boundary.

Admin actions remain manual:

- qualify lead,
- send invoice,
- confirm payment,
- create/extend/suspend token.

Status mutation and invoice draft generation are implemented, but they do not send messages, collect payment, or activate tokens automatically.

## Next Steps

1. Done: admin status transitions `new -> qualified -> quoted -> closed_won/closed_lost`.
2. Done: Markdown invoice template generation from request records.
3. Done: persistent usage ledger for sanitized customer usage events.
4. Revisit Midtrans only after manual flow has real usage and refund/payment policy is locked.
