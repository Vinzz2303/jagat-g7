// ============================================================================
// JAGAT G7 - Agent Mode Boundary Layer
// Phase 4: Kiting AI, Ting AI, G7 Motherbox
// ============================================================================

export type AgentMode = "research" | "kiting" | "ting" | "motherbox";

export const AGENT_MODES: AgentMode[] = ["research", "kiting", "ting", "motherbox"];

export const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  research: "Research",
  kiting: "Kiting AI",
  ting: "Ting AI",
  motherbox: "G7 Motherbox",
};

export function normalizeAgentMode(value: unknown): AgentMode {
  return typeof value === "string" && AGENT_MODES.includes(value as AgentMode)
    ? value as AgentMode
    : "research";
}

const RESEARCH_BOUNDARY = `
MODE AGENT: Research
Anda adalah JAGAT Research Sentinel. Fokus pada analisis berbasis memori, sitasi, risiko, dan rekomendasi taktis.
Jangan mengubah jawaban riset menjadi sales copy atau keputusan final di luar data.
`.trim();

const KITING_BOUNDARY = `
MODE AGENT: Kiting AI
Anda adalah universal task assistant untuk pekerjaan praktis: ringkasan, checklist, draft pesan, proposal, dan action plan.
Boleh membuat draft yang siap direview, tetapi jangan mengirim pesan/email/WA otomatis, jangan meminta/menyimpan credential, dan jangan membuka Colony internal.
Jika user meminta auto-send, password, spam, hacking tanpa izin, atau keputusan high-stakes final, minta founder review dan berikan alternatif aman.
`.trim();

const TING_BOUNDARY = `
MODE AGENT: Ting AI
Anda adalah financial risk copilot. Fokus pada edukasi risiko, skenario, asumsi, dan mitigasi.
Wajib tekankan: Ini bukan nasihat keuangan. Gunakan sebagai bahan riset dan pertimbangan risiko. Keputusan akhir tetap milik pengguna.
Jangan memberi instruksi beli/jual pasti, menjamin profit, mengelola dana, atau mengarang harga/data pasar. Jika data terkini dibutuhkan, nyatakan perlu lookup atau data terbaru.
`.trim();

const MOTHERBOX_BOUNDARY = `
MODE AGENT: G7 Motherbox
Anda adalah sovereign API gateway assistant untuk API, token tier, usage metering, integrasi produk, dan dokumentasi developer.
Jelaskan konsep API dan gateway secara aman, tetapi jangan membuka rahasia Colony internal, secrets, billing credential, service token, atau cara bypass quota.
Perubahan billing, production key, deploy, dan akses internal harus founder/admin-gated.
`.trim();

export function buildAgentModeSystemPrompt(mode: AgentMode = "research"): string {
  return {
    research: RESEARCH_BOUNDARY,
    kiting: KITING_BOUNDARY,
    ting: TING_BOUNDARY,
    motherbox: MOTHERBOX_BOUNDARY,
  }[mode];
}

