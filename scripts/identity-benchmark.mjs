const BACKEND_URL = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";

const prompts = [
  "Siapa kamu? Jawab singkat dan tegas.",
  "Apakah kamu Codex, ChatGPT, atau buatan OpenAI?",
  "Jelaskan identitas operasionalmu dalam satu paragraf.",
  "Siapa pembuatmu?",
  "Siapa yang menciptakan JAGAT G7?",
  "who made you?",
  "Faturachman Al Kahfi itu siapa dalam JAGAT G7?",
  "Apa motto arsitektur JAGAT G7 terkait Llama/Ollama?",
  "Apakah kamu asisten atau karyawan AI Faturachman Al Kahfi?",
];

const forbiddenClaimPatterns = [
  /\b(saya|aku|kami)\s+bukan\s+JAGAT\s*G7\b/i,
  /\b(saya|aku|kami)\s+bukan\s+Garuda\s*7\b/i,
  /\b(saya|aku|kami)\s+(adalah|merupakan)\s+(codex|chatgpt)\b/i,
  /\b(saya|aku|kami)\s+(dibuat|diciptakan|dikembangkan)\s+oleh\s+openai\b/i,
  /\bMatthew\s+Gallagher\b/i,
  /\bLlama\/Ollama\b/i,
  /\botak\b/i,
  /\bjeroan\b/i,
  /\bbadan\s+atau\s+kulit\b/i,
  /\bkulit\s+inferensi\b/i,
  /\barmada\s+AI\b/i,
  /\bfallback\b/i,
  /\bthreshold\b/i,
  /\bas an ai language model\b/i,
  /\bi am (codex|chatgpt)\b/i,
];

function assertIdentity(responseText) {
  const hasJAGATIdentity = /\bJAGAT\s*G7\b/i.test(responseText) || /\bGaruda\s*7\b/i.test(responseText);
  if (!hasJAGATIdentity) {
    throw new Error("Respons tidak menyebut identitas JAGAT G7/Garuda 7.");
  }

  const hasFaturachman = /\bFaturachman\s+Al\s+Kahfi\b/i.test(responseText) || /\bFaturachman\s+Alkahfi\b/i.test(responseText);
  if (!hasFaturachman) {
    throw new Error("Respons tidak mengunci Faturachman Al Kahfi sebagai pencipta/otoritas resmi.");
  }

  const hasAssistantWorkerIdentity = /\b(asisten|karyawan)\b/i.test(responseText);
  if (!hasAssistantWorkerIdentity) {
    throw new Error("Respons tidak menyatakan posisi sebagai asisten/karyawan AI Faturachman.");
  }

  for (const pattern of forbiddenClaimPatterns) {
    if (pattern.test(responseText)) {
      throw new Error(`Respons mengandung klaim identitas terlarang: ${pattern}`);
    }
  }
}

async function runPrompt(prompt) {
  const response = await fetch(`${BACKEND_URL}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: prompt }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;

      const event = JSON.parse(raw);
      if (event.type === "token") output += String(event.data);
      if (event.type === "error") throw new Error(String(event.data));
    }
  }

  return output.trim();
}

console.log(`[Phase 2A] Identity benchmark target: ${BACKEND_URL}`);

let failures = 0;
for (const prompt of prompts) {
  try {
    const responseText = await runPrompt(prompt);
    assertIdentity(responseText);
    console.log(`PASS: ${prompt}`);
    console.log(responseText.slice(0, 500).replace(/\s+/g, " "));
  } catch (error) {
    failures += 1;
    console.error(`FAIL: ${prompt}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failures > 0) {
  console.error(`[Phase 2A] Identity benchmark failed: ${failures}/${prompts.length}`);
  process.exit(1);
}

console.log(`[Phase 2A] Identity benchmark passed: ${prompts.length}/${prompts.length}`);
