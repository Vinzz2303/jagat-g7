# Proposal: Prospect Evidence Quality Ranking

Date: 2026-11-05
Status: Requires founder review before changing lead-selection policy

## Evidence

The 2026-11-05 13:49 approval inbox selected two logistics leads whose problem hypothesis says only that a public email exists and the company may suit a generic workflow offer. The body correctly admits that JAGAT does not know the recipient’s internal workflow, so it avoids asserting a verified pain point. However, the current draft score rewards a valid email (+30), any non-empty contact (+10), and a website (+12), while it does not distinguish first-party evidence from a generic directory listing. This can use scarce review slots on low-evidence prospects.

The prior discovery report also contained three Rudy Hadisuwarno entries with the same email/site and a placeholder address. Later source changes address recipient/site deduplication and the `getanyname.com` placeholder; their runtime effect awaits the next scheduled run.

## Proposed policy

- Keep current approval, suppression, refusal, and daily/cycle limits unchanged.
- Score source quality separately from contact validity: a first-party business page with relevant service evidence should rank above a directory-only record with generic contact-only hypothesis.
- Down-rank generic hypotheses such as “kontak email publik” and “cocok untuk outreach” without discarding the lead; mark it `NEEDS_RESEARCH` in the approval report rather than presenting it as top-priority.
- Preserve conditional, non-assertive copy when a need is unverified. Never infer that a business lacks a website if a website is listed.
- Make the score explanation visible in the review artifact so the founder can understand why a lead was selected.

## Acceptance criteria

- Deterministic fixtures prove that a first-party, niche-relevant lead outranks a generic directory-only lead with the same email-validity and website signals.
- Generic directory-only leads are labeled for research and do not displace higher-evidence leads from the five review slots.
- Duplicate recipient/site and placeholder-email guards remain active.
- Copy contains no unverified operational claims, ROI claims, guaranteed outcomes, or invented client needs.
- Exact recipient/hash approval, suppression, refusal, one-per-cycle, and daily cap checks remain unchanged.
- Run an isolated draft-selection test with a temporary tracker; do not mutate production tracker or send externally.

No ranking-policy implementation is authorized by this proposal.

## Additional operational finding
The scheduled task itself is enabled every three hours and runs discovery, Telegram brief/draft notifications, then `process-approved-outreach.mjs`. Current policy and sender require an approval JSON with exact recipient/hash, expiry, an approval ID, and the founder's name. These checks protect against stale/mismatched drafts, but the `approvedBy` string and UUID in a local JSON file are not cryptographic proof of a human founder action. There are currently zero approval files, and the sender retains the D-043 one-per-cycle/five-per-day caps. Do not describe the scheduled job as unattended email sending; it is automatic discovery/drafting/monitoring with approval-gated delivery. Any change to identity proof must be a separate security review.

Runtime context: D-051 is locked to local operation; current listeners include local BFF (health 503), Next UI (200), Windows Redis (loopback), while Qdrant is unreachable. Docker need not be assumed as the only Redis/runtime provider. Build and `npx tsc --noEmit` pass, but running backend is older than rebuilt `dist`; no reload was performed.

## Separate security proposal required before unattended approval
Do not implement source ranking and approval authentication in the same change. Before any real automated dispatch, require a separate founder-approved design with these properties:

- A local approval can only be created after an explicit founder action in an authenticated local session (or a one-time challenge delivered to the already verified founder channel and confirmed through a bound response).
- Bind the approval to normalized recipient, immutable draft hash, approval ID, approver identity, creation time, and short expiry; sign the record with a secret held outside editable approval files, or store the approval transaction in the authenticated backend ledger.
- The scheduler must reject records with invalid signatures, replayed IDs, changed recipient/hash, stale expiry, unavailable identity service, or ambiguous prior SMTP outcome. Fail closed and report a sanitized blocked result to the founder.
- Add isolated tests for forged founder name, edited recipient/hash, edited expiry, replay, tampered signature, missing verifier, and concurrent processing. Prove the exact valid founder path without contacting SMTP/Telegram; use fake adapters.
- Real email stays behind D-043 review; no bulk mode or expanded limits. An unattended send policy would require a new explicit decision-log approval.

Current CLI `--approved-by="Faturachman Al Kahfi"` is caller-supplied text. It must not be treated as identity proof. This proposal records the gap only; it does not authorize a security-model or outbound-policy change.
