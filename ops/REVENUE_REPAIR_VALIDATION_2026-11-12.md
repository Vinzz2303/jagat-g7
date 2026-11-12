# Revenue pipeline repairs: local validation, 2026-11-12

Base repository: `Vinzz2303/jagat-g7`, commit `1bb6eeb06a1be1cbdfbe5144ee593f5f63ec0f75`.

## Scope and boundaries

Repairs cover prospect provenance/draft eligibility, optional Telegram notification reliability, and evidenced provider/JSON errors. Credential rotation is excluded. No RDP access, live crawl, SMTP/Telegram/provider requests, production service changes, remote writes, or deployment were performed.

MRP Layers 1–5 and the latest D-051/D-052 decisions were reviewed. Existing campaign authorization and the separate exact-recipient/hash approval mode remain controlling. No runtime campaign policy was created or enabled.

## Changes

- Discovery records `official_site:` only when an email is observed on a successfully fetched same-host business page and its domain matches the explicit business Website link. Cross-domain redirects, generic external links, and directory-only contacts do not receive official provenance. Directory source and observed page are retained in notes. Sponsored `/redir/` links are not treated as business websites.
- Campaign drafts use the same deterministic D-052 policy/role/domain/provenance/status checks as the sender. Suppression, prior attempted/sent/unknown history, normalized recipients, and company duplicates are excluded. Corrupt history or invalid enabled policy fails closed. Missing/disabled campaign policy preserves manual approval draft preparation. STOP is recognized as a refusal.
- Existing historical rows are not relabeled or automatically upgraded. A later authorized discovery run must obtain fresh evidence; zero eligible drafts remains a valid outcome.
- Optional brief/draft Telegram failures no longer turn successful artifact generation into a primary pipeline failure. Notification outcomes remain separately visible in the ledger and status snapshot. HTTP and Telegram JSON acknowledgment are required for DELIVERED. ATTEMPTED/UNKNOWN prevents automatic replay of an ambiguous same-key notification; reconcile it manually. Delivery deduplication and primary-failure nonzero exit codes are preserved.
- The PowerShell cycle is unchanged: its existing exit-code gate still blocks the sender when discovery, brief preparation, or draft preparation fails. Optional notification errors are now contained by those scripts. SMTP outcome notifications remain on their existing separate path.
- Groq uses `llama-3.1-8b-instant` instead of the retired model. Provider requests are bounded, response bodies are validated, Gemini requests JSON for agentic output, and the Ollama fallback receives top-level `format: "json"`. Malformed/truncated JSON cannot be recovered into an executable Telegram intent. Existing model-generated shell denial remains intact.

## Verification

On the final local code:

- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm run test:revenue-provenance`: PASS, 48 assertions. Synthetic directory/browser/MX data and fetch-denying draft CLI fixtures.
- `npm run test:revenue-notifications`: PASS, 31 assertions. Mocked Telegram responses, ambiguous/delivered deduplication, artifact persistence and primary-failure behavior.
- `npm run test:revenue-status`: PASS, 25 checks, including same-timestamp ledger ordering.
- `npm run test:revenue-outreach-sender`: PASS. Fake SMTP/local Telegram only. Exact approval mismatch, suppression, refusal/STOP, daily cap, rolling campaign cap, provenance mismatch, duplicates, one-per-cycle and valid campaign path.
- `npm run test:model-provider-json`: PASS, 14 tests. Mocked provider/local responses, strict JSON, bounded requests, fallback, remote opt-in/cancellation and shell denial.
- Changed JavaScript syntax checks and `git diff --check`: PASS.
- `npm run lint`: BLOCKED, exit 127 (`eslint: not found`). The repository declares an ESLint command but does not declare/install ESLint. No new dependency was added.

The five safe suites can be rerun with `npm run test:revenue-offline`. They use temporary synthetic fixtures; no live mail is sent. The existing sender smoke now creates its own synthetic templates because the public export omits private `ops/outreach` templates.

## Remaining limits

- Live identity/creator/cognitive benchmarks, provider availability/account credit, browser discovery markup, real SMTP/Telegram delivery, and Windows Task Scheduler execution were not tested. Gemini credit depletion is an account/runtime issue, not fixed by this patch.
- Dependencies were installed with `npm ci --ignore-scripts`; this validates TypeScript and offline tests, not native runtime dependencies or a browser installation.
- The sanitized repository does not contain production policy/tracker/suppression/templates. These must remain owner-controlled; do not invent or auto-enable a replacement policy.
- Before applying elsewhere, inspect the diff and use `git apply --check` against the intended checkout. Reconcile any intervening source changes. Deployment/restart and any live test require separate authorization.
