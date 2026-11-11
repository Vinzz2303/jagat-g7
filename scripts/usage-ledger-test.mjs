// Smoke test for durable usage metering ledger (T-034)

const {
  assertUsageAllowed,
  getUsageLedgerSummary,
  getUsageSummary,
  listUsageEvents,
  recordUsage,
} = await import("../jagat-ui/src/lib/usage-metering.ts");

let pass = 0;
let fail = 0;

function ok(label) {
  pass += 1;
  console.log(`  PASS  ${label}`);
}

function notOk(label, reason) {
  fail += 1;
  console.log(`  FAIL  ${label}: ${reason}`);
}

function expect(condition, label, reason = "condition failed") {
  if (condition) ok(label);
  else notOk(label, reason);
}

const rawToken = `RAW-USAGE-TEST-TOKEN-${Date.now()}`;
const rawPrompt = "SECRET PROMPT THAT MUST NOT BE STORED";
const rawAnswer = "SECRET ANSWER THAT MUST NOT BE STORED";
const actor = {
  ownerName: "Usage Ledger Test Client",
  tier: "PRO",
  subject: rawToken,
};

const before = await getUsageSummary(actor);
expect(before.used === 0, "new unique actor starts with zero used units", `got ${before.used}`);
await assertUsageAllowed(actor);
ok("unique actor passes quota check before usage");

const afterSuccess = await recordUsage(actor, {
  requestId: "usage-ledger-test-success",
  agentMode: "kiting",
  endpoint: "/research",
  status: "success",
  contextDocsUsed: 2,
  latencyMs: 1234,
});
expect(afterSuccess.used === 1, "success event increments durable used units", `got ${afterSuccess.used}`);
expect(afterSuccess.meteringMode === "persistent_file_mvp", "summary reports persistent file metering mode");

const afterError = await recordUsage(actor, {
  requestId: "usage-ledger-test-error",
  agentMode: "kiting",
  endpoint: "/research",
  status: "error",
  latencyMs: 50,
  refusalReason: "backend_502",
});
expect(afterError.used === 1, "error event is recorded but does not consume units", `got ${afterError.used}`);

const sovereign = await recordUsage(
  { ownerName: "Usage Ledger Sovereign Test", tier: "SOVEREIGN", subject: "SOVEREIGN-USAGE-TEST" },
  {
    requestId: "usage-ledger-test-sovereign",
    agentMode: "motherbox",
    endpoint: "/research",
    status: "success",
  },
);
expect(sovereign.used === 0 && sovereign.limit === null, "SOVEREIGN usage is audited but not billed");

const events = await listUsageEvents(100);
const ownEvents = events.filter((event) => event.ownerName === actor.ownerName);
expect(ownEvents.length >= 2, "ledger stores test actor events");
expect(ownEvents.some((event) => event.status === "success" && event.units === 1), "ledger success event has 1 unit");
expect(ownEvents.some((event) => event.status === "error" && event.units === 0), "ledger error event has 0 units");
expect(ownEvents.every((event) => event.tokenHash && event.tokenHash !== rawToken), "ledger stores token hash, not raw token");

const serialized = JSON.stringify(ownEvents);
expect(!serialized.includes(rawToken), "raw token is absent from serialized usage events");
expect(!serialized.includes(rawPrompt), "raw prompt is absent from serialized usage events");
expect(!serialized.includes(rawAnswer), "raw answer is absent from serialized usage events");

const summary = await getUsageLedgerSummary(10);
expect(summary.todayUnits >= 1, "admin ledger summary reports today units");
expect(summary.byTier.some((item) => item.key === "PRO"), "admin ledger summary aggregates by tier");
expect(summary.byAgentMode.some((item) => item.key === "kiting"), "admin ledger summary aggregates by agent mode");

console.log("\n===============================================================");
console.log(`  Results: ${pass} PASS / ${fail} FAIL`);
console.log("===============================================================");
console.log("  Note: test records remain in data/usage_events.jsonl.");
process.exit(fail > 0 ? 1 : 0);
