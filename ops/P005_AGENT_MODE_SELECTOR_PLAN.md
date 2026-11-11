# P-005 Agent Mode Selector Plan

Date: 2026-06-06
Status: Implementation baseline
Source: ops/AGENT_BOUNDARY_DESIGN.md

## Goal

Add a visible agent mode selector to the JAGAT console so the same sovereign research pipeline can answer with the correct product boundary:

- Research: default JAGAT memory-grounded analysis.
- Kiting: task assistant for drafts, checklists, and practical execution.
- Ting: financial risk copilot with no-financial-advice guardrail.
- Motherbox: API gateway/product integration assistant.

## Non-Goals

- Do not open Colony internals to public users.
- Do not add outbound WA/email automation.
- Do not change billing, env, tokens, deploy, ports, or secrets.
- Do not grant tool access based only on UI mode.

## Implementation Scope

1. Add shared backend agent mode schema and prompt boundary.
2. Forward selected mode from Next.js `/api/secure-research` to Express `/research`.
3. Add mode metadata to streamed research results.
4. Add segmented selector in `/console`.
5. Add regression test for mode normalization and guardrails.

## Acceptance Criteria

- UI shows Research, Kiting, Ting, and Motherbox modes.
- Backend defaults unknown/invalid mode to Research.
- Ting prompt includes no-financial-advice language.
- Kiting prompt forbids auto-send and credential handling.
- Motherbox prompt forbids exposing Colony internals/secrets.
- Typecheck and mode policy test pass.

