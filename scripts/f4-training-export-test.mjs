#!/usr/bin/env node
/**
 * JAGAT Colony — F4 Training Data Export Live Test
 *
 * Tests:
 *   1. API endpoint GET /colony/training-export → JSON format (baseline 0 records)
 *   2. API endpoint GET /colony/training-export?format=jsonl → JSONL format
 *   3. Filter: tags, taskId, since
 *   4. Auth guard: no secret → 401, non-SOVEREIGN tier → 403
 *   5. Stats structure validation
 *   6. /training-export command via chat
 *
 * Pre-requisites:
 *   - Backend running on localhost:5000 with COLONY_INTERNAL_SECRET set
 *   - Redis running
 *
 * Usage:
 *   node scripts/f4-training-export-test.mjs
 */

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:5000";
const SECRET = process.env.COLONY_INTERNAL_SECRET || "jagat-colony-internal-2026";

let passed = 0;
let failed = 0;

function buildHeaders(name = "Faturachman Al Kahfi", tier = "SOVEREIGN") {
  return {
    "Content-Type": "application/json",
    "X-Colony-Secret": SECRET,
    "X-Colony-Caller": name,
    "X-Colony-Tier": tier,
    "X-Colony-Token": "test-token-f4",
  };
}

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ FAIL  ${label}`);
    console.log(`           ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ── Test Helpers ──────────────────────────────────────────────────────────────

async function apiGet(path, query = "", headers = undefined) {
  const url = `${BACKEND}/colony${path}${query ? "?" + query : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: headers || buildHeaders(),
  });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("ndjson")) {
    const text = await res.text();
    return { status: res.status, text, isJsonl: true };
  }
  const data = await res.json();
  return { status: res.status, data };
}

async function chatCommand(command) {
  const res = await fetch(`${BACKEND}/colony/chat/rooms/general/messages`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ content: command }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("===============================================================");
  console.log("  JAGAT Colony — F4 Training Data Export Live Test");
  console.log(`  Backend: ${BACKEND}`);
  console.log("===============================================================");

  // ── Suite 1: Baseline — JSON API ──
  console.log("\n📚 Suite 1: API GET /training-export — JSON baseline");

  await test("GET /training-export returns 200 with stats and records", async () => {
    const { status, data } = await apiGet("/training-export");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.success === true, `Expected success=true, got ${JSON.stringify(data.success)}`);
    assert(typeof data.stats === "object", `Missing stats object`);
    assert(Array.isArray(data.records), `Missing records array`);
  });

  await test("Stats has correct shape", async () => {
    const { data } = await apiGet("/training-export");
    const s = data.stats;
    assert(typeof s.totalProposalsScanned === "number", "Missing totalProposalsScanned");
    assert(typeof s.appliedAndReady === "number", "Missing appliedAndReady");
    assert(typeof s.totalRecords === "number", "Missing totalRecords");
    assert(Array.isArray(s.uniqueTags), "Missing uniqueTags");
    assert(Array.isArray(s.uniqueFiles), "Missing uniqueFiles");
    assert(s.dateRange === null || typeof s.dateRange === "object", "Invalid dateRange");
  });

  // ── Suite 2: JSONL format ──
  console.log("\n📚 Suite 2: API GET /training-export?format=jsonl");

  await test("format=jsonl returns application/x-ndjson", async () => {
    const result = await apiGet("/training-export", "format=jsonl");
    assert(result.status === 200, `Expected 200, got ${result.status}`);
    assert(result.isJsonl === true, `Expected ndjson content type`);
  });

  // ── Suite 3: Filters ──
  console.log("\n📚 Suite 3: Filters");

  await test("tags=nonexistent returns 0 records", async () => {
    const { status, data } = await apiGet("/training-export", "tags=nonexistent_xyz_999");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.records.length === 0, `Expected 0 records, got ${data.records.length}`);
  });

  await test("taskId=TASK-99999999-9999 returns 0 records", async () => {
    const { status, data } = await apiGet("/training-export", "taskId=TASK-99999999-9999");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.records.length === 0, `Expected 0 records, got ${data.records.length}`);
  });

  await test("since=2099-01-01 (future) returns 0 records", async () => {
    const { status, data } = await apiGet("/training-export", "since=2099-01-01");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.records.length === 0, `Expected 0 records, got ${data.records.length}`);
  });

  await test("Combined filters work without error", async () => {
    const { status, data } = await apiGet("/training-export", "tags=bug_fix&taskId=TASK-00000000-0001&since=2020-01-01");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(typeof data.stats === "object", "Stats missing with combined filters");
  });

  // ── Suite 4: Auth guard ──
  console.log("\n🔒 Suite 4: Auth guard");

  await test("No secret → 401", async () => {
    const url = `${BACKEND}/colony/training-export`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test("Wrong secret → 401", async () => {
    const url = `${BACKEND}/colony/training-export`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Colony-Secret": "wrong-secret",
        "X-Colony-Caller": "Hacker",
        "X-Colony-Tier": "SOVEREIGN",
        "X-Colony-Token": "fake",
      },
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test("Non-SOVEREIGN tier → 403 (ULTRA has no colony mapping)", async () => {
    const result = await apiGet("/training-export", "", {
      "Content-Type": "application/json",
      "X-Colony-Secret": SECRET,
      "X-Colony-Caller": "TestUser",
      "X-Colony-Tier": "ULTRA",
      "X-Colony-Token": "test-token",
    });
    assert(result.status === 403, `Expected 403, got ${result.status}`);
  });

  await test("Missing identity headers → 401", async () => {
    const url = `${BACKEND}/colony/training-export`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Colony-Secret": SECRET,
      },
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // ── Suite 5: Chat command /training-export ──
  console.log("\n💬 Suite 5: /training-export via chat");

  await test("/training-export command accepted via chat (201)", async () => {
    const { status, data } = await chatCommand("/training-export");
    assert(status === 201, `Chat POST expected 201, got ${status}`);
    assert(data.messageId, `Expected message object with messageId, got keys: ${Object.keys(data).join(", ")}`);
  });

  await test("Command response message appears in room", async () => {
    // Small delay to allow async command processing
    await new Promise(r => setTimeout(r, 500));
    // Read messages from general room
    const { status, data } = await apiGet("/chat/rooms/general/messages", "limit=10");
    assert(status === 200, `Expected 200, got ${status}`);
    const messages = data.messages || data;
    assert(Array.isArray(messages), `Expected messages array`);
    // Find command_response with training export summary
    const cmdResponse = messages.find(m =>
      m.messageType === "command_response" &&
      m.content?.includes("Training Data Export")
    );
    assert(cmdResponse, "No command_response with 'Training Data Export' found in room messages");
  });

  // ── Results ──
  console.log("\n===============================================================");
  console.log(`  Results: ${passed} PASS / ${failed} FAIL`);
  console.log(`  Status: ${failed === 0 ? "✅ ALL PASS — F4 Training Export verified!" : "❌ FAILURES DETECTED"}`);
  console.log("===============================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

main();
