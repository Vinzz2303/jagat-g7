import { captureAndScreenDistillationCandidate, shouldAutoCaptureCandidate } from "./cog4-auto-capture.mjs";

const BACKEND = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";
const SECRET = process.env.COLONY_INTERNAL_SECRET ?? "jagat-colony-internal-2026";
const FOUNDER = process.env.FOUNDER_NAME ?? "Faturachman Al Kahfi";

let passCount = 0;
let failCount = 0;
let recordId = null;

function headers() {
  return {
    "Content-Type": "application/json",
    "X-Colony-Secret": SECRET,
    "X-Colony-Caller": FOUNDER,
    "X-Colony-Tier": "SOVEREIGN",
    "X-Colony-Token": "cog4-test",
  };
}

async function request(method, path, body) {
  const response = await fetch(`${BACKEND}/colony${path}`, {
    method,
    headers: headers(),
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

async function test(name, fn) {
  try {
    await fn();
  } catch (error) {
    assert(name, false, error instanceof Error ? error.message : String(error));
  }
}

console.log("===============================================================");
console.log("  COG-4 — Auto Capture to Distillation Pool Test");
console.log(`  Backend: ${BACKEND}`);
console.log("===============================================================");

await test("short candidate is skipped before network capture", async () => {
  const result = await captureAndScreenDistillationCandidate({
    question: "Pendek?",
    answer: "Terlalu pendek.",
    benchmarkPassed: true,
  }, { backend: BACKEND });
  assert("Short candidate skipped", result.skipped === true, JSON.stringify(result));
});

await test("benchmark-failed candidate is not capture-worthy", async () => {
  const ok = shouldAutoCaptureCandidate({
    question: "Apakah kandidat benchmark gagal boleh masuk training pool?",
    answer: "Kandidat ini cukup panjang, tetapi flag benchmarkPassed=false harus menahannya dari capture otomatis supaya data latihan tidak tercemar oleh output yang tidak lolos evaluasi benchmark.",
    benchmarkPassed: false,
  });
  assert("benchmarkPassed=false rejected by local guard", ok === false);
});

await test("safe benchmark candidate is captured and screened", async () => {
  const result = await captureAndScreenDistillationCandidate({
    question: "Bagaimana COG-4 menangkap kandidat distillation dari benchmark research?",
    answer: [
      "COG-4 menangkap jawaban benchmark yang lolos evaluasi sebagai kandidat distillation, bukan sebagai knowledge final.",
      "Record yang masuk harus membawa konteks sumber, citation, tag benchmark, dan status benchmarkPassed agar screening Colony bisa menilai grounding, safety, citation discipline, dan usefulness.",
      "Jika skor screening cukup tinggi dan tidak ada sinyal risiko, record dapat menjadi auto_accepted untuk export training. [Sumber: COG-4 Auto Capture Fixture]",
    ].join(" "),
    contextSources: [{ source: "COG-4 Auto Capture Fixture", title: "COG-4 Auto Capture Fixture", score: 0.97 }],
    tags: ["benchmark", "research"],
    benchmarkName: "cog4-auto-capture-test",
    benchmarkPassed: true,
    score: 1,
    notes: "COG-4 live helper test.",
  }, { backend: BACKEND });

  recordId = result.record?.recordId;
  assert("Capture returns record id", typeof recordId === "string" && recordId.startsWith("DISTILL-"), `got ${recordId}`);
  assert("Record is screened immediately", Boolean(result.screening?.overallScore), JSON.stringify(result.screening));
  assert("Safe record auto accepted", result.record?.status === "auto_accepted", `got ${result.record?.status}`);
  assert("COG-4 tags attached", result.record?.tags?.includes("cog4") && result.record?.tags?.includes("auto-capture"), JSON.stringify(result.record?.tags));
});

await test("auto-captured record appears in default training export", async () => {
  const r = await request("GET", "/distillation/export");
  assert("Export returns 200", r.status === 200, `got ${r.status}: ${r.text}`);
  assert("Export includes COG-4 record", Array.isArray(r.data?.records) && r.data.records.some((record) => record.id === recordId));
});

await test("high-risk candidate escalates to founder review when screened", async () => {
  const result = await captureAndScreenDistillationCandidate({
    question: "Apakah token dan secret boleh otomatis menjadi training data?",
    answer: [
      "Kandidat ini sengaja menyebut token, secret, credential, dan deploy untuk memastikan screening tidak menganggapnya aman.",
      "Walaupun panjang dan punya sumber, high-risk signal harus naik ke founder review agar data latihan tidak memuat pola operasional sensitif.",
      "COG-4 harus membuktikan screening policy tetap aktif setelah capture otomatis. [Sumber: COG-4 Risk Fixture]",
    ].join(" "),
    contextSources: [{ source: "COG-4 Risk Fixture", title: "COG-4 Risk Fixture", score: 0.9 }],
    benchmarkName: "cog4-auto-capture-test",
    benchmarkPassed: true,
    tags: ["security"],
    score: 0.8,
  }, { backend: BACKEND });
  assert("High-risk auto capture needs founder review", result.record?.status === "needs_founder_review", `got ${result.record?.status}`);
  assert("High-risk reason recorded", result.screening?.reasons?.includes("high_risk_training_signal"), JSON.stringify(result.screening?.reasons));
});

console.log("===============================================================");
console.log(`  Results: ${passCount} PASS / ${failCount} FAIL`);
console.log("===============================================================");

if (failCount > 0) process.exit(1);
