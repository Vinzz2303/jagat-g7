#!/usr/bin/env node
/**
 * JAGAT Colony — End-to-End Auth & Proxy Pipeline Verification Script
 *
 * Purpose: Verify the complete pipeline (Browser/Client -> Next.js Middleware -> Next.js API Proxy -> Express Backend)
 * Pre-requisites:
 *   - Redis running on localhost:6379
 *   - Next.js UI running on localhost:50012
 *   - Backend running on localhost:5000
 *
 * Usage:
 *   node scripts/verify-e2e-pipeline.mjs
 */

const NEXTJS_PORT = process.env.NEXTJS_PORT || "50012";
const NEXTJS_URL = `http://127.0.0.1:${NEXTJS_PORT}`;
const FOUNDER_NAME = process.env.FOUNDER_NAME || "Faturachman Alkahfi (Core Node)";

let passed = 0;
let failed = 0;
let taskId = null;
let missionId = null;

// ── Cookie Helpers ──────────────────────────────────────────────────────────

async function getSessionCookieForToken(token) {
  try {
    const res = await fetch(`${NEXTJS_URL}/api/auth/validate-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      throw new Error(`Auth validate-token failed: ${res.status}`);
    }
    const data = await res.json();
    if (!data.valid) {
      throw new Error(`Token invalid: ${data.error}`);
    }
    // Extract Set-Cookie header
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error("No set-cookie header returned");
    }
    // Extract the jagat_g7_session cookie
    const match = setCookie.match(/jagat_g7_session=([^;]+)/);
    if (!match) {
      throw new Error("jagat_g7_session not found in Set-Cookie header");
    }
    return decodeURIComponent(match[1]);
  } catch (err) {
    console.error(`  ⚠️  Failed to get session cookie for token "${token}":`, err.message);
    return null;
  }
}

// ── HTTP Request Helper ──────────────────────────────────────────────────────

async function req(method, path, body = null, cookieValue = null) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (cookieValue) {
    headers["Cookie"] = `jagat_g7_session=${encodeURIComponent(cookieValue)}`;
  }

  try {
    const res = await fetch(`${NEXTJS_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: {}, error: err.message };
  }
}

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL  ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

// ── Test Suites ──────────────────────────────────────────────────────────────

async function testE2EAuthRejection() {
  console.log("\n🔒 Suite 1: E2E Pipeline Auth Rejection Tests (via Next.js Middleware)");

  // 1A. No Cookie
  let r = await req("POST", "/api/colony/bootstrap");
  assert("1A. No session cookie → 401", r.status === 401, `got ${r.status}`);

  // 1B. Tampered Cookie
  const sovereignCookie = await getSessionCookieForToken("JAGAT-J7-SECURE-2026");
  if (sovereignCookie) {
    // Tamper with the cookie signature (change last character)
    const dotIndex = sovereignCookie.lastIndexOf(".");
    const signature = sovereignCookie.substring(dotIndex + 1);
    const tamperedSignature = signature.startsWith("a") ? "b" + signature.slice(1) : "a" + signature.slice(1);
    const tamperedCookie = sovereignCookie.substring(0, dotIndex) + "." + tamperedSignature;

    r = await req("POST", "/api/colony/bootstrap", {}, tamperedCookie);
    assert("1B. Tampered signature → 401", r.status === 401, `got ${r.status}`);
  } else {
    console.log("  ❌ FAIL  1B. Sovereign cookie generation failed, skipping tamper test");
    failed++;
  }

  // 1C. BASIC tier cookie (not supported/mapped or lacks SOVEREIGN clearance)
  // Let's create an invalid cookie or use a client-signed BASIC cookie
  // Wait, let's try an ULTRA tier token: G7-ULTRA-WANDA-99X
  const ultraCookie = await getSessionCookieForToken("G7-ULTRA-WANDA-99X");
  if (ultraCookie) {
    r = await req("POST", "/api/colony/bootstrap", {}, ultraCookie);
    assert("1C. ULTRA tier cookie → 403", r.status === 403, `got ${r.status}`);
  } else {
    console.log("  ❌ FAIL  1C. ULTRA cookie generation failed, skipping ULTRA test");
    failed++;
  }
}

async function testE2EBootstrap() {
  console.log("\n🔒 Suite 2: E2E Pipeline Bootstrap Colony");

  const cookie = await getSessionCookieForToken("JAGAT-J7-SECURE-2026");
  if (!cookie) {
    console.log("  ❌ FAIL  Skipping bootstrap test due to missing SOVEREIGN cookie");
    failed += 3;
    return;
  }

  const r = await req("POST", "/api/colony/bootstrap", {}, cookie);
  assert("2A. Bootstrap via Proxy → 200", r.status === 200, `got ${r.status}`);
  assert("2B. Agents seeded", typeof r.data.agents === "number" && r.data.agents > 0, `got ${r.data.agents}`);
  assert("2C. Rooms seeded", typeof r.data.rooms === "number" && r.data.rooms > 0, `got ${r.data.rooms}`);
}

async function testE2EMission() {
  console.log("\n🔒 Suite 3: E2E Pipeline Create Mission");

  const cookie = await getSessionCookieForToken("JAGAT-J7-SECURE-2026");
  if (!cookie) {
    console.log("  ❌ FAIL  Skipping create mission test due to missing SOVEREIGN cookie");
    failed += 3;
    return;
  }

  const r = await req("POST", "/api/colony/missions", {
    title: "E2E PIPELINE VERIFICATION MISSION",
    objective: "Verify end-to-end flow from signed cookie to backend response",
    phase: "C5",
    priority: "high",
  }, cookie);

  assert("3A. Create mission via Proxy → 201", r.status === 201, `got ${r.status}`);
  assert("3B. Mission has ID", !!r.data.id, `got ${JSON.stringify(r.data)}`);
  assert("3C. creator = founder", r.data.createdBy === "founder", `got ${r.data.createdBy}`);
  missionId = r.data.id;
}

async function testE2ETaskLifecycle() {
  console.log("\n🔒 Suite 4: E2E Pipeline Task Lifecycle");

  const cookie = await getSessionCookieForToken("JAGAT-J7-SECURE-2026");
  if (!cookie) {
    console.log("  ❌ FAIL  Skipping task lifecycle test due to missing SOVEREIGN cookie");
    failed += 3;
    return;
  }

  // Create Task
  let r = await req("POST", "/api/colony/tasks", {
    title: "E2E Pipeline Task",
    objective: "Verify task lifecycle flow via Proxy",
    phase: "C5",
    assignedAgent: "builder",
    priority: "high",
    acceptanceCriteria: ["Pipeline is verified"],
    founderApprovalRequired: true,
    missionId,
  }, cookie);

  assert("4A. Create task via Proxy → 201", r.status === 201, `got ${r.status}`);
  assert("4B. Task has ID", !!r.data.taskId, `got ${JSON.stringify(r.data)}`);
  taskId = r.data.taskId;

  if (!taskId) return;

  // Transition to planning
  r = await req("PATCH", `/api/colony/tasks/${taskId}/status`, { status: "planning", reason: "E2E verification" }, cookie);
  assert("4C. Status transition queued -> planning → 200", r.status === 200 && r.data.status === "planning", `got ${r.status} / ${r.data.status}`);
}

async function testE2EAuditTrail() {
  console.log("\n🔒 Suite 5: E2E Pipeline Audit Trail Check");

  const cookie = await getSessionCookieForToken("JAGAT-J7-SECURE-2026");
  if (!cookie) {
    console.log("  ❌ FAIL  Skipping audit trail test due to missing SOVEREIGN cookie");
    failed += 4;
    return;
  }

  const r = await req("GET", "/api/colony/audit?limit=20", null, cookie);
  assert("5A. Fetch audit via Proxy → 200", r.status === 200, `got ${r.status}`);

  const entries = r.data.entries ?? [];
  assert("5B. Has audit entries", entries.length > 0, `got ${entries.length} entries`);

  // Verify that the entries record the actor identity verified via HMAC session
  const bootstrapEntry = entries.find(e => e.action === "colony.bootstrap");
  if (bootstrapEntry) {
    assert("5C. Bootstrap audit actor is founder name", bootstrapEntry.actor === FOUNDER_NAME, `got ${bootstrapEntry.actor}`);
    assert("5D. Bootstrap audit actorRole is founder", bootstrapEntry.actorRole === "founder", `got ${bootstrapEntry.actorRole}`);
  } else {
    console.log("  ⚠️  Bootstrap entry not found in response window");
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("===============================================================");
  console.log("  JAGAT Colony — E2E Auth & Proxy Pipeline Verification");
  console.log(`  Next.js URL: ${NEXTJS_URL}`);
  console.log(`  Founder Name: ${FOUNDER_NAME}`);
  console.log("===============================================================");

  try {
    await testE2EAuthRejection();
    await testE2EBootstrap();
    await testE2EMission();
    await testE2ETaskLifecycle();
    await testE2EAuditTrail();
  } catch (e) {
    console.error("Test execution aborted:", e);
    failed++;
  }

  console.log("\n===============================================================");
  console.log(`  Results: ${passed} PASS / ${failed} FAIL`);
  console.log(`  Status: ${failed === 0 ? "✅ ALL PASS — E2E pipeline verified!" : "❌ FAILURES DETECTED"}`);
  console.log("===============================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();
