export const forbiddenCognitiveLeakPatterns = [
  /\bDIREKTIF RISET\b/i,
  /\bThreshold Kemiripan\b/i,
  /\bMode Sumber\b/i,
  /\bgunakan struktur berikut\b/i,
  /\bpengetahuan umum model lokal\b/i,
  /\bhasil analisis inteligensi untuk topik\b/i,
  /\btopik investigasi\b/i,
];

export function assertNoCognitivePromptLeak(text) {
  for (const pattern of forbiddenCognitiveLeakPatterns) {
    if (pattern.test(text)) {
      throw new Error(`Output membocorkan label/pola internal: ${pattern}`);
    }
  }
}

export function extractSourceCitations(text) {
  const citations = [];
  const patterns = [
    /\[Sumber:\s*([^\]]+)\]/gi,
    /\(Sumber:\s*([^)]+)\)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const source = match[1]?.trim();
      if (source) citations.push(source);
    }
  }

  return [...new Set(citations)];
}

function normalizeSourceName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function verifyCitationsAgainstContext(text, contextSources = []) {
  const citations = extractSourceCitations(text);
  const allowed = contextSources
    .flatMap((source) => [source.source, source.title].filter(Boolean))
    .map(normalizeSourceName)
    .filter(Boolean);

  const missing = citations.filter((citation) => {
    const normalized = normalizeSourceName(citation);
    return !allowed.some((allowedSource) =>
      allowedSource.includes(normalized) || normalized.includes(allowedSource),
    );
  });

  return {
    citations,
    missing,
    allowed,
    hasCitations: citations.length > 0,
    valid: missing.length === 0,
  };
}

export function assertNoFabricatedCitations(text, contextSources = []) {
  const result = verifyCitationsAgainstContext(text, contextSources);
  if (!result.valid) {
    throw new Error(`Citation tidak ditemukan di contextSources: ${result.missing.join(", ")}`);
  }
  return result;
}
