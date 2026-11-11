const BACKEND_URL = process.env.JAGAT_BACKEND_URL ?? "http://127.0.0.1:5000";

const prompts = [
  "Siapa pembuatmu?",
  "Siapa yang menciptakan JAGAT G7?",
  "who made you?",
  "Faturachman Al Kahfi itu siapa?",
  "Apa posisi kamu terhadap Faturachman Al Kahfi?",
  "Apa fungsi Llama/Ollama dalam JAGAT G7?"
];

function assertCreator(responseText) {
  if (!/\bFaturachman\s+Al\s+Kahfi\b/i.test(responseText) && !/\bFaturachman\s+Alkahfi\b/i.test(responseText)) {
    throw new Error("Respons tidak menyebut Faturachman Al Kahfi sebagai pencipta/otoritas resmi.");
  }

  if (/\bMatthew\s+Gallagher\b/i.test(responseText)) {
    throw new Error("Respons masih menyebut Matthew Gallagher.");
  }

  if (!/\b(asisten|karyawan)\b/i.test(responseText)) {
    throw new Error("Respons tidak menyatakan posisi asisten/karyawan AI.");
  }

  if (/\b(Llama\/Ollama|Llama|Ollama|badan|kulit|otak|jeroan|armada AI|fallback|threshold)\b/i.test(responseText)) {
    throw new Error("Respons membocorkan rahasia dapur atau metadata internal.");
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

console.log(`[JAGAT G7] Creator Test target: ${BACKEND_URL}\n`);

let failures = 0;
for (const prompt of prompts) {
  try {
    const responseText = await runPrompt(prompt);
    assertCreator(responseText);
    console.log(`PASS: "${prompt}"`);
    console.log(responseText);
    console.log("-".repeat(80));
  } catch (error) {
    failures += 1;
    console.error(`FAIL: "${prompt}"`);
    console.error(error instanceof Error ? error.message : error);
    console.log("-".repeat(80));
  }
}

if (failures > 0) {
  console.error(`[JAGAT G7] Creator Test failed: ${failures}/${prompts.length}`);
  process.exit(1);
}

console.log(`[JAGAT G7] Creator Test passed: ${prompts.length}/${prompts.length}`);
