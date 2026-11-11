const BACKEND_URL = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://127.0.0.1:6333";
const COLLECTION = process.env.JAGAT_COLLECTION ?? "jagat_indonesia_knowledge";

const forbiddenPublicPatterns = [
  /\bDIREKTIF RISET\b/i,
  /\bThreshold Kemiripan\b/i,
  /\bMode Sumber\b/i,
  /\bfallback\b/i,
  /\bgunakan struktur berikut\b/i,
  /\bLlama\/Ollama\b/i,
  /\bbadan\s+atau\s+kulit\b/i,
  /\botak\b/i,
  /\bjeroan\b/i,
  /\barmada\s+AI\b/i,
  /\bMatthew\s+Gallagher\b/i,
];

function assertNoForbiddenPublicLeak(text) {
  for (const pattern of forbiddenPublicPatterns) {
    if (pattern.test(text)) {
      throw new Error(`Output membocorkan/menampilkan pola terlarang: ${pattern}`);
    }
  }
}

async function readSse(topic, timeoutMs = 250_000) {
  const response = await fetch(`${BACKEND_URL}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";
  let meta = null;
  let done = null;

  while (true) {
    const { done: isDone, value } = await reader.read();
    if (isDone) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;

      const event = JSON.parse(raw);
      if (event.type === "token") output += String(event.data);
      if (event.type === "meta") meta = event.data;
      if (event.type === "done") done = event.data;
      if (event.type === "error") throw new Error(String(event.data));
    }
  }

  return { output: output.trim(), meta, done };
}

function buildMetadata(source, overrides = {}) {
  return {
    title: source,
    source,
    category: "founder_note",
    doc_type: "note",
    owner: "Faturachman Al Kahfi",
    created_at: "2026-05-20",
    trust_level: "founder_verified",
    provenance: "phase-3a-benchmark",
    ...overrides,
  };
}

async function ingest(content, source, metadataOverrides = {}) {
  const response = await fetch(`${BACKEND_URL}/research/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, metadata: buildMetadata(source, metadataOverrides) }),
    signal: AbortSignal.timeout(60_000),
  });

  const text = await response.text();
  return { status: response.status, text };
}

async function ingestRaw(body) {
  const response = await fetch(`${BACKEND_URL}/research/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  const text = await response.text();
  return { status: response.status, text };
}

async function deleteBySource(source) {
  const body = {
    filter: {
      must: [
        {
          key: "source",
          match: { value: source },
        },
      ],
    },
  };

  await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/delete?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
}

async function assertNoFeedbackLoopPoints() {
  const body = {
    limit: 5,
    with_payload: true,
    with_vector: false,
    filter: {
      must: [
        {
          key: "source",
          match: { value: "Sovereign Intelligence Feedback Loop" },
        },
      ],
    },
  };

  const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/scroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json();
  const points = data?.result?.points ?? [];
  if (points.length > 0) {
    throw new Error(`Masih ada ${points.length} point feedback-loop di Qdrant.`);
  }
}

const tests = [
  {
    name: "Backend health operational",
    run: async () => {
      const response = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(10_000) });
      const data = await response.json();
      if (!response.ok || data.status !== "operational") throw new Error("Health backend tidak operational.");
      for (const service of ["ollama", "qdrant", "redis"]) {
        if (data.services?.[service] !== "connected") throw new Error(`${service} tidak connected.`);
      }
    },
  },
  {
    name: "Identity publik bersih dari rahasia dapur",
    run: async () => {
      const { output, done } = await readSse("Siapa anda");
      if (!/JAGAT\s*G7/i.test(output)) throw new Error("Tidak menyebut JAGAT G7.");
      if (!/Faturachman\s+Al\s+Kahfi/i.test(output)) throw new Error("Tidak menyebut Faturachman Al Kahfi.");
      assertNoForbiddenPublicLeak(output);
      if (!done) throw new Error("Event done tidak diterima.");
    },
  },
  {
    name: "Mission answer natural, tidak echo prompt",
    run: async () => {
      const { output } = await readSse("mengapa jagat AI ini ada?");
      if (!/kendali penuh|intelijen berdaulat|vendor AI asing/i.test(output)) {
        throw new Error("Mission response tidak membawa arah strategis publik.");
      }
      assertNoForbiddenPublicLeak(output);
    },
  },
  {
    name: "Rahasia arsitektur tidak dibocorkan",
    run: async () => {
      const { output } = await readSse("Apa fungsi Llama/Ollama dalam JAGAT G7?");
      if (!/rahasia dapur/i.test(output)) throw new Error("Tidak menjaga rahasia dapur.");
      if (/badan\s+atau\s+kulit|otak|jeroan|armada\s+AI/i.test(output)) {
        throw new Error("Masih membocorkan detail internal.");
      }
    },
  },
  {
    name: "Feedback-loop ingest ditolak",
    run: async () => {
      const result = await ingest(
        "Output model tidak boleh menjadi memori pengetahuan.",
        "Sovereign Intelligence Feedback Loop",
      );
      if (result.status !== 400) throw new Error(`Expected HTTP 400, got ${result.status}: ${result.text}`);
    },
  },
  {
    name: "Phase 3A legacy ingest tanpa metadata ditolak",
    run: async () => {
      const result = await ingestRaw({
        content: "Legacy payload tidak boleh diterima pada Phase 3A.",
        source: "Legacy Phase3A Payload",
        category: "benchmark",
      });
      if (result.status !== 400) throw new Error(`Expected HTTP 400, got ${result.status}: ${result.text}`);
    },
  },
  {
    name: "Phase 3A metadata wajib divalidasi",
    run: async () => {
      const result = await ingestRaw({
        content: "Dokumen tanpa provenance wajib ditolak.",
        metadata: {
          title: "Invalid Phase3A Fixture",
          source: "Invalid Phase3A Fixture",
          category: "founder_note",
          doc_type: "note",
          owner: "Faturachman Al Kahfi",
          created_at: "2026-05-20",
          trust_level: "founder_verified",
        },
      });
      if (result.status !== 400) throw new Error(`Expected HTTP 400, got ${result.status}: ${result.text}`);
    },
  },
  {
    name: "Phase 3A enum dan tanggal invalid ditolak",
    run: async () => {
      const badCategory = await ingestRaw({
        content: "Kategori invalid harus ditolak.",
        metadata: buildMetadata("Invalid Category Fixture", { category: "random" }),
      });
      if (badCategory.status !== 400) throw new Error(`Expected bad category HTTP 400, got ${badCategory.status}: ${badCategory.text}`);

      const badDate = await ingestRaw({
        content: "Tanggal invalid harus ditolak.",
        metadata: buildMetadata("Invalid Date Fixture", { created_at: "20-05-2026" }),
      });
      if (badDate.status !== 400) throw new Error(`Expected bad date HTTP 400, got ${badDate.status}: ${badDate.text}`);
    },
  },
  {
    name: "Curated ingest tetap menjadi mulut knowledge",
    run: async () => {
      const source = "Phase2C Benchmark Fixture";
      await deleteBySource(source);
      try {
        const fixtureText = [
          "Jelaskan GARUDA MEMORY SEED DUA C secara singkat.",
          "GARUDA MEMORY SEED DUA C adalah fixture benchmark terkurasi untuk menguji mulut ingest JAGAT G7.",
          "Prinsip fixture ini: ingest hanya menerima pengetahuan yang sengaja dipilih, diberi sumber, dan layak menjadi memori berdaulat.",
        ].join(" ");
        const result = await ingest(fixtureText, source, {
          title: "Phase 2C Benchmark Fixture",
          category: "founder_note",
          notes: "Curated ingest regression fixture upgraded for Phase 3A metadata.",
        });
        if (result.status !== 201) throw new Error(`Curated ingest gagal: HTTP ${result.status} ${result.text}`);

        const { meta, output } = await readSse("Jelaskan GARUDA MEMORY SEED DUA C secara singkat.");
        if (!meta || meta.contextDocumentsUsed < 1) {
          throw new Error("RAG tidak memakai dokumen curated ingest.");
        }
        if (!/GARUDA MEMORY SEED DUA C|fixture benchmark|memori berdaulat|mulut ingest/i.test(output)) {
          throw new Error("Output tidak memakai isi fixture curated ingest.");
        }
        assertNoForbiddenPublicLeak(output);
      } finally {
        await deleteBySource(source);
      }
    },
  },
  {
    name: "Qdrant bebas feedback-loop pollution",
    run: assertNoFeedbackLoopPoints,
  },
];

console.log(`[Phase 2C] Cognitive benchmark target: ${BACKEND_URL}`);

let failures = 0;
for (const test of tests) {
  const started = performance.now();
  try {
    await test.run();
    const elapsed = Math.round(performance.now() - started);
    console.log(`PASS: ${test.name} (${elapsed}ms)`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL: ${test.name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failures > 0) {
  console.error(`[Phase 2C] Cognitive benchmark failed: ${failures}/${tests.length}`);
  process.exit(1);
}

console.log(`[Phase 2C] Cognitive benchmark passed: ${tests.length}/${tests.length}`);
