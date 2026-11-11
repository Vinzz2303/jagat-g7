# JAGAT G7 — Sovereign Super Intelligence Core

> Clean repository snapshot of the JAGAT G7 system architecture (Backend BFF, Multi-Agent Colony Engine, Hybrid LLM Router, RAG Pipeline, Durable SQLite Mission Ledger, Telegram God Mode, and Next.js Control UI).

## Architecture Overview

- **Backend & Colony Runtime (`src/`)**:
  - `src/index.ts`: Express BFF entrypoint (default port `5000`), RAG streaming API, authentication guards, and startup reconciliation.
  - `src/colony/`: Multi-Agent Colony OS — Mission Engine, Task Engine, Durable SQLite Ledger (`mission-ledger.ts` + CAS + startup reconciliation), Advisory Mission Review (`mission-review.ts`), C6 Autonomous Scheduler Loop (`scheduler-loop.ts` + `scheduler-queue.ts`), Patch Engine (`patch-engine.ts`), Worker Sandbox (`worker-sandbox.ts`), ReAct Engine (`react-engine.ts`), Garuda Model Ladder (`model-router.ts`), Distillation Engine (`distillation-engine.ts`), Revenue Swarm Orchestrator (`revenue-swarm.ts`), and Telegram God Mode Engine (`telegram-bot.ts`).
  - `src/phase1/`: Commercial CRM & Lead Discovery/Outreach State Machine (`engine.ts`, `routes.ts`).
  - `src/services/`: Hybrid LLM Router (Groq, Gemini, Local/Remote Ollama), Qdrant Vector DB, Redis Broker, Voice Engine.
  - `src/rag/` & `src/prompts/`: Curated hybrid dense+sparse retrieval and role-scoped agent mode boundaries (Research, Kiting, Ting, Motherbox).
  - `src/tools/`: Sandboxed workspace filesystem/git/search tools (`os-tools.ts`, `github-tools.ts`, `browser-tools.ts`).
- **Control & Product UI (`jagat-ui/`)**:
  - Next.js App Router frontend (port `50012`) with Sovereign Token Gate, Console (`/console`), Colony Command Center (`/colony`), Memory Library (`/memory`), and Admin Panel (`/g7-admin`).
- **Automation, Verification & Smoke Suites (`scripts/`)**:
  - Verification suites (`colony-engine-hardening-test.mjs`, `worker-sandbox-test.mjs`, `mission-ledger-smoke.mjs`, `verify-public-routes.mjs`, `revenue-outreach-sender-smoke.mjs`), prospect discovery & outreach tooling.
- **Architecture & Operations Docs (`ops/`)**:
  - Masterplans, Decision Log (`ops/DECISION_LOG.md`), Technical & Product Backlogs, Risk Register, Gap Audit, and Autonomous Colony Logs.

## Security Hygiene

This repository is a sanitized public codebase export:
- No `.env`, API keys, SMTP passwords, Telegram tokens, WhatsApp auth states, or runtime databases are included.
- Prospect CRM contact lists (`ops/revenue/`), third-party cloned repos (`workspace/`), and large archive bundles are excluded.
