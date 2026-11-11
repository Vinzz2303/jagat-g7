# JAGAT Colony — Dry Run Logic Trace & Gap Residual

> **Tanggal:** 2026-05-28 (static) / 2026-05-29 (runtime verified)
> **Status:** Founder-Only Secure Baseline & E2E Proxy Pipeline — **RUNTIME VERIFIED ✅**
> **Runtime test:**
>   - `node scripts/verify-founder-flow.mjs` (Direct Backend) → **40 PASS / 0 FAIL**
>   - `node scripts/verify-e2e-pipeline.mjs` (Full Pipeline via Next.js Proxy) → **16 PASS / 0 FAIL**

---

## Posisi Dokumen

Update 2026-05-31:

- C6 scheduler/reporter runtime verified via `node scripts/c6-scheduler-reporter-test.mjs` — **8 PASS / 0 FAIL**.
- UI/protected routes including `/memory` verified via `node scripts/verify-public-routes.mjs` — **24 PASS / 0 FAIL**.
- Memory Library UI is now available at `/memory`; C6 observability is now available in the Colony `C6 Runtime` tab.

Dokumen ini adalah **source of truth operasional sementara** untuk:

- apa yang sudah terpasang secara kode pada founder-only secure baseline
- residual gap yang masih terbuka
- perbedaan antara `static verified` dan `runtime verified`

Dokumen ini **melengkapi** `JAGAT_COLONY_GAP_AUDIT.md`, bukan mengulang audit awal.
Jika ada konflik narasi antara audit awal dan trace ini, anggap:

1. `JAGAT_COLONY_GAP_AUDIT.md` = baseline historical findings
2. `COLONY_DRY_RUN_TRACE.md` = status pasca-hardening yang lebih dekat ke codebase aktual

> [!IMPORTANT]
> Dokumen ini tidak memberi izin untuk klaim `DONE` penuh sendirian.
> Status final tetap harus ditopang bukti runtime/commissioning yang relevan untuk environment aktif.

## 1. Founder Flow End-to-End Logic Trace

### Flow: Bootstrap → Create Mission → Create Task → Update Status → Approval

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Browser → POST /api/colony/bootstrap                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [Browser]                                                               │
│   ├─ Cookie: jagat_g7_session=<base64payload>.<hmac256hex>                  │
│   └─ POST /api/colony/bootstrap                                             │
│                                                                             │
│ [Next.js Middleware]                                                        │
│   ├─ pathname starts with "/api/colony" → SOVEREIGN_ONLY_PATHS              │
│   ├─ Read cookie → verifySession(token)                                     │
│   │   ├─ Split at last "." → b64payload + signature                         │
│   │   ├─ Compute HMAC-SHA256(b64payload) with COOKIE_SIGNING_SECRET         │
│   │   ├─ timingSafeEqual(provided, expected)                                │
│   │   └─ Decode payload → { ownerName, tier, token }                        │
│   ├─ session.tier !== "SOVEREIGN" → 403 Forbidden                           │
│   └─ session.tier === "SOVEREIGN" → NextResponse.next()                     │
│                                                                             │
│ [API Proxy — [...path]/route.ts]                                            │
│   ├─ extractVerifiedSession(request) → session (HMAC verified again)        │
│   ├─ session.tier !== "SOVEREIGN" → 403                                     │
│   ├─ buildAuthHeaders(session) →                                            │
│   │   ├─ X-Colony-Caller: session.ownerName                                 │
│   │   ├─ X-Colony-Tier: "SOVEREIGN"                                         │
│   │   ├─ X-Colony-Token: session.token                                      │
│   │   └─ X-Colony-Secret: COLONY_INTERNAL_SECRET                            │
│   └─ fetch(BACKEND_URL/colony/bootstrap, { headers })                       │
│                                                                             │
│ [Express Backend — colonyAuthGuard("founder")]                              │
│   ├─ Read X-Colony-Secret → validate against COLONY_INTERNAL_SECRET         │
│   │   └─ Invalid → 401 "Colony API hanya dapat diakses melalui proxy"       │
│   ├─ Read X-Colony-Caller, X-Colony-Tier, X-Colony-Token                   │
│   ├─ Read X-Colony-Caller, X-Colony-Tier, X-Colony-Token                    │
│   │   └─ Missing → 401 "Identity headers tidak lengkap"                     │
│   ├─ tierToRole("SOVEREIGN") → "founder"                                    │
│   │   └─ Unknown tier → 403 "Tier tidak memiliki akses colony"              │
│   ├─ allowedRoles = ["founder"]                                             │
│   │   └─ role not in allowedRoles → 403                                     │
│   ├─ req.colonyIdentity = { name, role: "founder", tier, token }            │
│   └─ next() → route handler                                                 │
│                                                                             │
│ [Route Handler — POST /bootstrap]                                           │
│   ├─ agentRegistry.seedDefaultAgents()                                      │
│   ├─ chatEngine.seedDefaultRooms()                                          │
│   ├─ auditEngine.emitAudit({ actor, action: "colony.bootstrap", ... })      │
│   └─ Response: { success: true, agents: N, rooms: N }                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Browser → POST /api/colony/missions                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [Browser]                                                                   │
│   ├─ body: { title, objective, phase, priority }                            │
│   └─ (createdBy is omitted; safely resolved by backend auth context)        │
│                                                                             │
│ [Middleware → Proxy → Backend — same auth flow as above]                    │
│                                                                             │
│ [Route Handler — POST /missions, founderOnly]                               │
│   ├─ createdBy injected from req.colonyIdentity.role ("founder")            │
│   ├─ missionEngine.createMission(body)                                      │
│   ├─ auditEngine.emitAudit({ action: "mission.create", ... })               │
│   └─ Response: Mission object                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Browser → POST /api/colony/tasks                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [Route Handler — POST /tasks, executiveOrAbove]                             │
│   ├─ founder role ∈ ["founder", "executive_product", "executive_infra"]     │
│   ├─ body.createdBy overridden with req.colonyIdentity.role                 │
│   ├─ taskEngine.createTask(body) → status: "queued"                         │
│   ├─ auditEngine.emitAudit({ action: "task.create", ... })                  │
│   └─ Response: ColonyTask object                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Browser → PATCH /api/colony/tasks/:id/status                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [Route Handler — PATCH /tasks/:taskId/status, executiveOrAbove]             │
│   ├─ Validates state transition via TASK_TRANSITIONS                        │
│   │   ├─ queued → planning ✅                                                │
│   │   ├─ planning → approved ✅                                              │
│   │   └─ Invalid jump → Error                                               │
│   ├─ actor = req.colonyIdentity.name (verified)                             │
│   ├─ taskEngine.updateTaskStatus(taskId, status, actor, reason)             │
│   ├─ auditEngine.emitAudit({ action: "task.status_change", ... })           │
│   └─ Response: updated ColonyTask                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Browser → PATCH /api/colony/approvals/:id                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [Route Handler — PATCH /approvals/:approvalId, founderOnly]                 │
│   ├─ Only "founder" role can access this endpoint                           │
│   ├─ respondedBy overridden with req.colonyIdentity.name (NOT from body)    │
│   ├─ approvalEngine.respondToApproval(id, response, identity.name, note)    │
│   ├─ auditEngine.emitAudit({ action: "approval.respond", ... })             │
│   └─ Response: updated ApprovalRequest                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Security Verification Summary

### Auth Layer Checklist

| Layer | Mechanism | Status | Evidence |
|-------|-----------|--------|----------|
| Cookie Signing | HMAC-SHA256 via Web Crypto | ✅ | `cookie-signer.ts` — `signSession()` / `verifySession()` |
| Timing Attack Prevention | Constant-time comparison | ✅ | `timingSafeEqual()` in `cookie-signer.ts` |
| Middleware Gate | SOVEREIGN_ONLY_PATHS | ✅ | `middleware.ts` L9, L44-56 |
| Proxy Auth | Session re-verification | ✅ | `route.ts` — `extractVerifiedSession()` |
| Proxy Headers | X-Colony-* injection | ✅ | `route.ts` — `buildAuthHeaders()` |
| Backend Secret | COLONY_INTERNAL_SECRET | ✅ | `auth.ts` — `getColonyInternalSecret()` |
| Backend Identity | Header validation | ✅ | `auth.ts` — colonyAuthGuard middleware |
| Role Matrix | Per-endpoint guards | ✅ | `routes.ts` — founderOnly/executiveOrAbove/anyColonyUser |
| Identity Override | createdBy/respondedBy from auth | ✅ | `routes.ts` — `req.colonyIdentity.role` / `.name` |
| Audit Trail | emitAudit on mutations | ✅ | `routes.ts` + `audit-engine.ts` |

### Attack Vector Mitigation

| Attack | Mitigation | Status |
|--------|------------|--------|
| Direct backend access | Internal secret required | ✅ Blocked |
| Cookie forgery | HMAC-SHA256 signing | ✅ Blocked |
| Tier spoofing | Server-side tier check | ✅ Blocked |
| Identity impersonation | Auth-derived identity override | ✅ Blocked |
| Unauthorized approval | founderOnly guard | ✅ Blocked |
| State machine violation | TASK_TRANSITIONS validation | ✅ Blocked |

---

## 3. Gap Residual — Executive Tier Mapping

### Yang Belum Aktif

```
// auth.ts L38-L49
function tierToRole(tier: string): HumanRole | null {
  switch (tier) {
    case "SOVEREIGN":
      return "founder";
    // TIDAK DIAKTIFKAN sampai token registry punya field `role` eksplisit:
    // case "ULTRA":
    //   return "executive_product";
    default:
      return null;  // ← Semua tier selain SOVEREIGN ditolak
  }
}
```

### Blocker untuk Executive Tier

| Blocker | Description | Action Required |
|---------|-------------|-----------------|
| Token Registry | Belum ada field `role` eksplisit di token entity | Tambah `role` field di token registry |
| ULTRA Mapping | ULTRA → executive_product/infra belum didefinisikan | Perlu mapping strategy (1 ULTRA = 1 role? atau multiple?) |
| Permission Matrix | `executiveOrAbove` guard sudah ada tapi tidak bisa tercapai | Aktifkan setelah ULTRA tier punya role claim |
| UI Identity | `callerRole` di page.tsx hanya derive "founder" dari SOVEREIGN | Perlu derive executive role dari session |

### Rekomendasi Aktivasi Executive

```
1. Tambah field `role` di token entity (token-registry.ts)
   - Contoh: { tier: "ULTRA", role: "executive_product", ... }

2. Update tierToRole() di auth.ts:
   case "ULTRA":
     return session.role as HumanRole;  // dari token, bukan hardcoded

3. Update page.tsx:
   if (data.session?.tier === "ULTRA") {
     setCallerRole(data.session.role);  // "executive_product" atau "executive_infra"
   }

4. Test: ULTRA user → executiveOrAbove routes → harus 200
```

---

## 4. Runtime Dry Run Status

### Yang Sudah Di-verify Runtime (2026-05-29)

- ✅ TypeScript typecheck passed (`npm run typecheck` + `npx tsc --noEmit` di jagat-ui)
- ✅ UI build pass (`npm run build` di jagat-ui)
- ✅ Auth flow logic trace — semua layer konsisten
- ✅ Permission matrix — guards sesuai spec
- ✅ Identity override — createdBy/respondedBy dari auth context
- ✅ Audit trail — semua mutation di-log dengan actor + actorRole
- ✅ Bootstrap: seedDefaultAgents() + seedDefaultRooms() — **RUNTIME VERIFIED**
- ✅ Create Mission: missionEngine.createMission() — **RUNTIME VERIFIED**
- ✅ Create Task: taskEngine.createTask() → TASK-YYYYMMDD-NNNN — **RUNTIME VERIFIED**
- ✅ Status Transition: queued → planning → approved → running → review → done — **RUNTIME VERIFIED**
- ✅ Invalid transition rejected (done → running → 400) — **RUNTIME VERIFIED**
- ✅ Approval Flow: createApproval() → respondToApproval() — **RUNTIME VERIFIED**
- ✅ Audit Query: auditEngine.queryAuditLog() — 158 entries di Redis — **RUNTIME VERIFIED**
- ✅ Auth Rejection: no secret → 401, wrong secret → 401, BASIC tier → 403, ULTRA tier → 403 — **RUNTIME VERIFIED**

### Blocker untuk Runtime (Status Terkini 2026-05-29)

| Blocker | Status | Solution |
|---------|--------|----------|
| Redis | ✅ Running (localhost:6379) | — |
| Ollama | ✅ Running (localhost:11434) | — |
| Qdrant | ✅ Running (localhost:6333/6334) | — |
| COLONY_INTERNAL_SECRET | ⚠️ Dev fallback | Set proper secret di .env untuk production |
| COOKIE_SIGNING_SECRET | ⚠️ Dev fallback | Set proper secret di .env untuk production |

---

## 5. Kesimpulan & Status

### ✅ Founder-Only Secure Baseline: TERPASANG

| Komponen | Status | Confidence |
|----------|--------|------------|
| Cookie signing (HMAC-SHA256) | ✅ Implemented | High |
| Middleware tier gate | ✅ Implemented | High |
| Proxy auth forwarding | ✅ Implemented | High |
| Backend auth middleware | ✅ Implemented | High |
| Per-endpoint role matrix | ✅ Implemented | High |
| Identity override | ✅ Implemented | High |
| Audit trail | ✅ Implemented | High |

### ⏳ Multi-Role Matrix: STRUKTUR SIAP, MENUNGGU AKTIVASI

| Komponen | Status | Blocker |
|----------|--------|---------|
| ULTRA → executive mapping | ⏳ Commented out | Token registry role field |
| internal_ops mapping | ⏳ Not defined | Tier-to-role design decision |
| UI executive identity | ⏳ Not implemented | Depends on token registry |

### 🚫 Tidak Klaim DONE Sebelum

- [x] Runtime dry run dengan Redis aktif — **DONE 2026-05-29**
- [x] Bootstrap colony → verify agents + rooms created — **40 PASS / 0 FAIL**
- [x] Create 1 test mission → verify in Redis
- [x] Create 3 tasks → verify state machine transitions (queued → planning → approved → running → review → done)
- [x] Full flow: create → assign → status changes → approval → done
- [x] Rejection test: wrong tier → 403, no secret → 401, tampered → 401, ULTRA tier → 403
- [x] Audit log verification: semua action tercatat dengan identity (actor + actorRole + timestamp)

**Runtime verification script:** `node scripts/verify-founder-flow.mjs`
**Result (2026-05-29):** ✅ 40 PASS / 0 FAIL

---

> **Rekomendasi:** Untuk melanjutkan ke runtime dry run, pastikan Redis berjalan di localhost:6379, lalu jalankan `npm run dev` di backend dan test dengan curl/Postman mengikuti trace di atas.
