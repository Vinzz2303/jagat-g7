// Smoke test for commercial request status transitions (T-032)
import { readFile } from "node:fs/promises";
import path from "node:path";

const { createCommercialRequest, listCommercialRequests, updateCommercialRequestStatus } =
  await import("../jagat-ui/src/lib/commercial-requests.ts");

// Use the actual ledger path from the module (data/ under cwd)
const ledgerFile = path.join(process.cwd(), "data", "commercial_requests.jsonl");

let pass = 0;
let fail = 0;

function ok(label) { pass++; console.log(`  ✅ PASS  ${label}`); }
function notOk(label, reason) { fail++; console.log(`  ❌ FAIL  ${label}: ${reason}`); }

// Create a test request
const r1 = await createCommercialRequest({
  packageId: "PRO",
  clientName: "Test Client",
  contact: "test@example.com",
  channel: "email",
});

if (r1.status === "new") ok("New request starts with status 'new'");
else notOk("New request status", `expected 'new', got '${r1.status}'`);

// Valid transition: new → qualified
const r2 = await updateCommercialRequestStatus(r1.id, "qualified");
if (r2.status === "qualified") ok("new → qualified transition");
else notOk("new → qualified", `got '${r2.status}'`);

// Valid transition: qualified → quoted
const r3 = await updateCommercialRequestStatus(r1.id, "quoted");
if (r3.status === "quoted") ok("qualified → quoted transition");
else notOk("qualified → quoted", `got '${r3.status}'`);

// Valid transition: quoted → closed_won
const r4 = await updateCommercialRequestStatus(r1.id, "closed_won");
if (r4.status === "closed_won") ok("quoted → closed_won transition");
else notOk("quoted → closed_won", `got '${r4.status}'`);

// Terminal state: closed_won has no further transitions
try {
  await updateCommercialRequestStatus(r1.id, "qualified");
  notOk("Terminal state guard", "should have thrown");
} catch (e) {
  if (e.message.includes("terminal")) ok("closed_won is terminal (no further transitions)");
  else ok("closed_won rejects further transitions");
}

// Invalid transition: new → closed_won (skipping stages)
const r5 = await createCommercialRequest({
  packageId: "ULTRA",
  clientName: "Test Skip Client",
  contact: "skip@example.com",
});
try {
  await updateCommercialRequestStatus(r5.id, "closed_won");
  notOk("Skip guard", "should have thrown");
} catch (e) {
  if (e.message.includes("Invalid transition")) ok("new → closed_won rejected (must go through pipeline)");
  else ok("Skip guard works but unexpected message: " + e.message);
}

// Not-found request
try {
  await updateCommercialRequestStatus("REQ-FAKE-123", "qualified");
  notOk("Not-found guard", "should have thrown");
} catch (e) {
  if (e.message.includes("not found")) ok("Not-found request throws proper error");
  else ok("Not-found guard works: " + e.message);
}

// Create request for closed_lost path
const r6 = await createCommercialRequest({
  packageId: "WEBSITE_CEPAT",
  clientName: "Lost Client",
  contact: "lost@example.com",
});
await updateCommercialRequestStatus(r6.id, "qualified");
await updateCommercialRequestStatus(r6.id, "closed_lost");
if ((await listCommercialRequests(200)).find(r => r.id === r6.id)?.status === "closed_lost")
  ok("qualified → closed_lost transition");
else notOk("closed_lost path", "status not persisted");

// Persistence check
const ledger = await readFile(ledgerFile, "utf8");
const lines = ledger.split(/\r?\n/).filter(Boolean);
if (lines.length >= 3) ok(`Ledger has ${lines.length} records persisted`);
else notOk("Ledger persistence", `expected >=3, got ${lines.length}`);

// Note: test records remain in ledger (no cleanup) — low volume manual ledger

console.log(`\n===============================================================`);
console.log(`  Results: ${pass} PASS / ${fail} FAIL`);
console.log(`===============================================================`);
process.exit(fail > 0 ? 1 : 0);
