const BACKEND = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";
const SECRET = process.env.COLONY_INTERNAL_SECRET ?? "jagat-colony-internal-2026";
const FOUNDER = process.env.FOUNDER_NAME ?? "Faturachman Al Kahfi";

let passCount = 0;
let failCount = 0;
let recordId = null;
let autoRecordId = null;
let reviewRecordId = null;

function headers(overrides = {}) {
  return {
    "Content-Type": "application/json",
    "X-Colony-Secret": SECRET,
    "X-Colony-Caller": FOUNDER,
    "X-Colony-Tier": "SOVEREIGN",
    "X-Colony-Token": "cog2-test",
    ...overrides,
  };
}

async function request(method, path, body, headerOverrides = {}) {
  const response = await fetch(`${BACKEND}/colony${path}`, {
    method,
    headers: headers(headerOverrides),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data, text };
}

function assert(name, condition, detail = "") {
  if (!condition) {
    failCount += 1;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    return;
  }
  passCount += 1;
  console.log(`PASS: ${name}`);
}

console.log("===============================================================");
console.log("  COG-2 — Cognitive Distillation Record Test");
console.log(`  Backend: ${BACKEND}`);
console.log("===============================================================");

{
  const result = await fetch(`${BACKEND}/colony/distillation/records`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  assert("Unauthenticated list rejected", result.status === 401, `got ${result.status}`);
}

{
  const r = await request("POST", "/distillation/records", {
    question: "Apa prinsip COG-2 distillation capture?",
    answer: "COG-2 menyimpan jawaban yang sudah lolos benchmark sebagai kandidat data latihan untuk founder review. [Sumber: COG-2 Test Fixture]",
    contextSources: [{ source: "COG-2 Test Fixture", title: "COG-2 Test Fixture", score: 0.91 }],
    citations: ["COG-2 Test Fixture"],
    tags: ["cog2", "distillation", "benchmark"],
    benchmarkName: "cog2-live-test",
    benchmarkPassed: true,
    score: 1,
    notes: "Live test candidate.",
  });
  assert("Create distillation record returns 201", r.status === 201, `got ${r.status}: ${r.text}`);
  recordId = r.data?.record?.recordId;
  assert("Created record has id", typeof recordId === "string" && recordId.startsWith("DISTILL-"), `got ${recordId}`);
  assert("Created record pending review", r.data?.record?.status === "pending_review", `got ${r.data?.record?.status}`);
}

{
  const r = await request("POST", "/distillation/records", {
    question: "Apa prinsip screening otomatis data distillation Colony?",
    answer: [
      "Screening otomatis Colony menilai kandidat distillation sebelum founder melihatnya.",
      "Record yang baik harus grounded ke sumber, memiliki citation yang cocok, tidak membocorkan prompt internal, dan cukup berguna untuk dipakai ulang sebagai training candidate.",
      "Jika semua skor lolos, Colony boleh memberi status auto_accepted tanpa mengganggu founder. [Sumber: COG-3 Screening Fixture]",
    ].join(" "),
    contextSources: [{ source: "COG-3 Screening Fixture", title: "COG-3 Screening Fixture", score: 0.95 }],
    citations: ["COG-3 Screening Fixture"],
    tags: ["cog3", "screening", "distillation"],
    benchmarkName: "cog3-screening-test",
    benchmarkPassed: true,
    score: 1,
  });
  assert("Create auto-screen candidate returns 201", r.status === 201, `got ${r.status}: ${r.text}`);
  autoRecordId = r.data?.record?.recordId;
}

{
  const r = await request("POST", `/distillation/records/${autoRecordId}/screen`);
  assert("Screen auto candidate returns 200", r.status === 200, `got ${r.status}: ${r.text}`);
  assert("Screen auto candidate becomes auto_accepted", r.data?.record?.status === "auto_accepted", `got ${r.data?.record?.status}`);
  assert("Screening stores overall score", typeof r.data?.screening?.overallScore === "number", `got ${r.data?.screening?.overallScore}`);
}

{
  const r = await request("POST", "/distillation/records", {
    question: "Simpan catatan token dan deploy secret untuk training?",
    answer: [
      "Catatan ini sengaja mengandung sinyal high-risk seperti token, secret, deploy, dan credential.",
      "Colony harus tidak auto-accept record seperti ini walaupun panjang dan punya sumber.",
      "Record harus naik ke founder review atau ditolak sesuai screening policy. [Sumber: COG-3 Risk Fixture]",
    ].join(" "),
    contextSources: [{ source: "COG-3 Risk Fixture", title: "COG-3 Risk Fixture", score: 0.9 }],
    citations: ["COG-3 Risk Fixture"],
    tags: ["cog3", "security"],
    benchmarkName: "cog3-screening-test",
    benchmarkPassed: true,
    score: 0.75,
  });
  assert("Create high-risk candidate returns 201", r.status === 201, `got ${r.status}: ${r.text}`);
  reviewRecordId = r.data?.record?.recordId;
}

{
  const r = await request("POST", `/distillation/records/${reviewRecordId}/screen`);
  assert("Screen high-risk candidate returns 200", r.status === 200, `got ${r.status}: ${r.text}`);
  assert("High-risk candidate needs founder review", r.data?.record?.status === "needs_founder_review", `got ${r.data?.record?.status}`);
  assert("High-risk screening reason recorded", r.data?.screening?.reasons?.includes("high_risk_training_signal"), JSON.stringify(r.data?.screening?.reasons));
}

{
  const r = await request("GET", "/distillation/records?status=pending_review&limit=10");
  assert("List pending records returns 200", r.status === 200, `got ${r.status}`);
  assert("List includes created record", Array.isArray(r.data?.records) && r.data.records.some((record) => record.recordId === recordId));
}

{
  const r = await request("PATCH", `/distillation/records/${recordId}`, {
    status: "accepted",
    reviewNote: "Accepted for training pool.",
  });
  assert("Approve record returns 200", r.status === 200, `got ${r.status}: ${r.text}`);
  assert("Approved record status accepted", r.data?.record?.status === "accepted", `got ${r.data?.record?.status}`);
  assert("Approved record stores reviewer", r.data?.record?.reviewedBy === FOUNDER, `got ${r.data?.record?.reviewedBy}`);
}

{
  const r = await request("PATCH", `/distillation/records/${recordId}`, {
    status: "rejected",
    reviewNote: "Should fail because already accepted.",
  });
  assert("Double review rejected", r.status >= 400, `got ${r.status}`);
}

{
  const r = await request("GET", "/distillation/export");
  assert("Export accepted records returns 200", r.status === 200, `got ${r.status}`);
  assert("Export includes accepted record", Array.isArray(r.data?.records) && r.data.records.some((record) => record.id === recordId));
  assert("Export includes auto_accepted record by default", Array.isArray(r.data?.records) && r.data.records.some((record) => record.id === autoRecordId));
  const record = r.data?.records?.find((item) => item.id === recordId);
  assert("Export record uses instruction/output format", Boolean(record?.instruction && record?.output && record?.metadata?.source === "cognitive_distillation"));
}

{
  const r = await request("GET", "/distillation/export?format=jsonl");
  assert("Export JSONL returns 200", r.status === 200, `got ${r.status}`);
  assert("Export JSONL contains record id", typeof r.text === "string" && r.text.includes(recordId));
}

console.log("===============================================================");
console.log(`  Results: ${passCount} PASS / ${failCount} FAIL`);
console.log("===============================================================");

if (failCount > 0) process.exit(1);
