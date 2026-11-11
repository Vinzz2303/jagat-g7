import crypto from 'node:crypto';
import type {
  AgentTaskRecord,
  ApprovalRecord,
  FeatureFlags,
  InboundReplyEvaluation,
  LeadRecord,
  LeadStatus,
  ModelRouteConfig,
  ModelTaskType,
  ModelUsageRecord,
  OutboundMode,
  OutreachEvent,
  OutreachMessage,
  PolicyEvaluationResult,
  QdrantValidationReport,
  RedisLockEntry,
} from './types.js';

// ── Secret Redaction Utility (Sec 8 & Rule 3) ───────────────────────────────
const SECRET_PATTERNS = [
  /(AIza[0-9A-Za-z\-_]{20,})/g,
  /(gsk_[0-9A-Za-z]{20,})/g,
  /(\b\d{8,10}:[A-Za-z0-9_-]{30,}\b)/g,
  /(sk-[A-Za-z0-9]{20,})/g,
  /([a-z]{4}\s[a-z]{4}\s[a-z]{4}\s[a-z]{4})/gi, // Google App Password 16-char pattern
];

export function redactSecrets(input: string): string {
  let sanitized = input;
  for (const regex of SECRET_PATTERNS) {
    sanitized = sanitized.replace(regex, '[REDACTED_SECRET]');
  }
  return sanitized;
}

// ── Prompt Injection & Untrusted Email Sanitizer (Sec 8 & 11) ───────────────
const INJECTION_RULES: { id: string; pattern: RegExp; label: string }[] = [
  {
    id: 'ignore_previous',
    pattern: /ignore\s+(all\s+)?(previous|prior|system)\s+(instructions|prompts|rules|policies)/i,
    label: 'Attempt to override system instructions',
  },
  {
    id: 'extract_secrets',
    pattern: /\b(EMAIL_PASS|GEMINI_API_KEY|GROQ_API_KEY|TELEGRAM_BOT_TOKEN|app\s*password|private\s*key|\.env)\b/i,
    label: 'Attempt to exfiltrate environment secrets or credentials',
  },
  {
    id: 'arbitrary_tool_exec',
    pattern: /\b(run_command|execAsync|child_process|rm\s+-rf|curl\s+http|bash\s+-c|system\s+policy)\b/i,
    label: 'Attempt to invoke arbitrary OS/tool execution',
  },
  {
    id: 'role_hijack',
    pattern: /\b(you\s+are\s+now\s+DAN|system\s*override|developer\s*mode\s*enabled|bypass\s+approval)\b/i,
    label: 'Attempt to hijack agent persona or bypass approval gate',
  },
];

export function inspectUntrustedEmail(rawBody: string): {
  sanitized: string;
  detected: boolean;
  triggers: string[];
} {
  const triggers: string[] = [];
  for (const rule of INJECTION_RULES) {
    if (rule.pattern.test(rawBody)) {
      triggers.push(`${rule.id}: ${rule.label}`);
    }
  }
  const redacted = redactSecrets(rawBody);
  const sanitized = redacted
    .replace(/```[\s\S]*?```/g, '[CODE_BLOCK_STRIPPED]')
    .slice(0, 2000)
    .trim();

  return {
    sanitized: `<untrusted_email_content>\n${sanitized}\n</untrusted_email_content>`,
    detected: triggers.length > 0,
    triggers,
  };
}

// ── Deterministic Hash & Idempotency Key (Sec 7) ────────────────────────────
export function buildIdempotencyKey(
  leadId: string,
  campaignId: string,
  messageType: 'initial_outreach' | 'followup_1' | 'closer_reply' = 'initial_outreach',
): string {
  return `outreach:${leadId.trim().toLowerCase()}:${campaignId.trim().toLowerCase()}:${messageType}`;
}

export function computeBodyHash(subject: string, body: string): string {
  return crypto.createHash('sha256').update(`${subject}||${body}`).digest('hex').slice(0, 16);
}

// ── Model Routing Table (Sec 9) ─────────────────────────────────────────────
export const PHASE1_MODEL_ROUTES: Record<ModelTaskType, ModelRouteConfig> = {
  classification: {
    task_type: 'classification',
    label: 'Intent & Lead Classification',
    primary_provider: 'local_ollama',
    primary_model: 'llama3.2:1b',
    fallback_provider: 'gemini_cloud',
    fallback_model: 'gemini-3.8-flash',
    timeout_ms: 8000,
    max_retries: 2,
    cost_per_1k_input_idr: 0,
    cost_per_1k_output_idr: 0,
    control_policy: 'Compare quality; escalate to Gemini Flash or Human Review if confidence < 0.80',
  },
  extraction_json: {
    task_type: 'extraction_json',
    label: 'Structured JSON / Contact Extraction',
    primary_provider: 'gemini_cloud',
    primary_model: 'gemini-3.8-flash',
    fallback_provider: 'local_ollama',
    fallback_model: 'llama3:latest',
    timeout_ms: 10000,
    max_retries: 2,
    cost_per_1k_input_idr: 2.4,
    cost_per_1k_output_idr: 9.6,
    control_policy: 'Strict JSON schema validation; max 2 format retries',
  },
  email_generation: {
    task_type: 'email_generation',
    label: 'Personalized B2B Outreach Draft',
    primary_provider: 'gemini_cloud',
    primary_model: 'gemini-3.8-flash',
    fallback_provider: 'local_ollama',
    fallback_model: 'llama3:latest',
    timeout_ms: 12000,
    max_retries: 2,
    cost_per_1k_input_idr: 2.4,
    cost_per_1k_output_idr: 9.6,
    control_policy: 'Fact grounding allowlist; mandatory Telegram approval for new leads',
  },
  complex_reasoning: {
    task_type: 'complex_reasoning',
    label: 'Proposal Strategy & Deep Reasoning',
    primary_provider: 'gemini_cloud',
    primary_model: 'gemini-4-argon',
    fallback_provider: 'gemini_cloud',
    fallback_model: 'gemini-3.8-flash',
    timeout_ms: 20000,
    max_retries: 1,
    cost_per_1k_input_idr: 19.5,
    cost_per_1k_output_idr: 78.0,
    control_policy: 'High-value tasks only; subject to per-task and global IDR budget cap',
  },
  coding: {
    task_type: 'coding',
    label: 'Code Assist & Patch Verification',
    primary_provider: 'gemini_cloud',
    primary_model: 'gemini-3.8-flash',
    fallback_provider: 'local_ollama',
    fallback_model: 'llama3:latest',
    timeout_ms: 15000,
    max_retries: 1,
    cost_per_1k_input_idr: 2.4,
    cost_per_1k_output_idr: 9.6,
    control_policy: 'Worker sandbox execution, diff review, unit test gate',
  },
  embedding: {
    task_type: 'embedding',
    label: 'Vector Memory Embedding (Qdrant)',
    primary_provider: 'local_ollama',
    primary_model: 'nomic-embed-text',
    fallback_provider: 'gemini_cloud',
    fallback_model: 'gemini-embedding-2-preview',
    timeout_ms: 6000,
    max_retries: 2,
    cost_per_1k_input_idr: 0,
    cost_per_1k_output_idr: 0,
    control_policy: 'Enforce 768-dim check against jagat_indonesia_knowledge before upsert',
  },
};

// ── Seed Data Grounded in Actual JAGAT Repository ───────────────────────────
function createInitialLeads(): LeadRecord[] {
  return [
    {
      id: 'lead-mutiara-001',
      company_name: 'Mutiara Printing',
      email: 'mutiaraa_printing@yahoo.com',
      phone: '021-8890112',
      website: 'https://mutiaraprinting.id',
      category: 'printing',
      source: 'indonesiayp_public_listing',
      qualification_score: 88,
      status: 'PENDING_APPROVAL',
      suppression_reason: null,
      problem_hypothesis: 'Penawaran website order cetak online dan AI Admin ringan untuk kalkulasi harga otomatis.',
      recommended_offer: 'AI Admin Bot + Website Cepat',
      quoted_price: 'Rp2.500.000',
      campaign_id: 'camp-id-b2b-q4',
      draft_subject: 'Solusi Website & AI Praktis untuk Mutiara Printing (JAGAT AI)',
      draft_body:
        'Halo Tim Mutiara Printing,\n\nKami melihat Mutiara Printing melayani banyak pesanan cetak B2B. Kami di JAGAT AI membantu bisnis percetakan mengotomatiskan tanya-jawab ukuran/harga dan estimasi order via WhatsApp & Web sehingga admin tidak kewalahan.\n\nApakah berkenan kami kirimkan demo singkat 3 menit minggu ini?',
      verified_facts: [
        'Kategori: Percetakan komersial (IndonesiaYP verified)',
        'Kontak publik terverifikasi: mutiaraa_printing@yahoo.com',
        'Paket dasar: Rp2.500.000 (AI Admin Bot + Website Cepat)',
      ],
      created_at: '2026-10-29T08:15:00.000Z',
      updated_at: '2026-10-30T04:10:00.000Z',
    },
    {
      id: 'lead-gratia-002',
      company_name: 'Gratia Print Bandung',
      email: 'order@gratiaprint-bdg.co.id',
      phone: '022-2500451',
      website: 'https://gratiaprint-bdg.co.id',
      category: 'printing',
      source: 'indonesiayp_public_listing',
      qualification_score: 84,
      status: 'PENDING_APPROVAL',
      suppression_reason: null,
      problem_hypothesis: 'Percetakan berdiri sejak 1972 membutuhkan modernisasi sistem order online & bot status pesanan.',
      recommended_offer: 'AI Admin Bot + Website Cepat',
      quoted_price: 'Rp2.500.000',
      campaign_id: 'camp-id-b2b-q4',
      draft_subject: 'Optimalisasi Order Online Gratia Print dengan AI Admin (JAGAT AI)',
      draft_body:
        'Halo Tim Gratia Print Bandung,\n\nKami mengagumi rekam jejak Gratia Print sejak 1972 di Bandung. Kami dapat membantu menyediakan katalog modern dan AI Admin WhatsApp untuk menjawab spesifikasi cetak serta status pesanan pelanggan secara instan 24/7.\n\nBoleh kami tunjukkan prototipe demonya hari ini?',
      verified_facts: [
        'Berdiri sejak 1972 di Bandung',
        'Layanan: Percetakan buku & kemasan',
        'Penawaran: AI Admin Bot + Website Cepat (Rp2.500.000)',
      ],
      created_at: '2026-10-29T09:20:00.000Z',
      updated_at: '2026-10-30T04:15:00.000Z',
    },
    {
      id: 'lead-tnos-003',
      company_name: 'Tnos Apps',
      email: 'partnership@tnosapps.com',
      phone: '021-27099175',
      website: 'https://www.indonesiayp.com/company/839960/Tnos_Apps',
      category: 'apps-tech',
      source: 'indonesiayp_public_listing',
      qualification_score: 91,
      status: 'PENDING_APPROVAL',
      suppression_reason: null,
      problem_hypothesis: 'Startup aplikasi (2019) membutuhkan AI Research Assistant untuk dokumentasi teknis & QA otomatis.',
      recommended_offer: 'AI Research Assistant + RAG',
      quoted_price: 'Rp4.500.000',
      campaign_id: 'camp-id-b2b-q4',
      draft_subject: 'Kolaborasi AI Research Assistant & RAG untuk Tim Engineering Tnos Apps',
      draft_body:
        'Halo Tim Tnos Apps,\n\nSebagai sesama pengembang teknologi di Jakarta Selatan, JAGAT AI menyediakan sistem AI Research Assistant berbasis RAG lokal-hybrid untuk mempercepat audit dokumentasi teknis dan QA produk.\n\nApakah terbuka untuk diskusi teknis 15 menit minggu ini?',
      verified_facts: [
        'Berdiri 2019 di Jakarta Selatan',
        'Sektor: Aplikasi & Teknologi',
        'Solusi: AI Research Assistant + Vector RAG',
      ],
      created_at: '2026-10-29T10:00:00.000Z',
      updated_at: '2026-10-30T05:00:00.000Z',
    },
    {
      id: 'lead-iam-004',
      company_name: 'PT. Integrasi Andalan Mitra',
      email: 'cs@i-am.co.id',
      phone: '021-5589120',
      website: 'https://i-am.co.id',
      category: 'b2b-integration',
      source: 'indonesiayp_public_listing',
      qualification_score: 89,
      status: 'SENT',
      suppression_reason: null,
      problem_hypothesis: 'Integrasi sistem B2B membutuhkan otomasi kualifikasi tiket dan asisten teknis.',
      recommended_offer: 'AI Admin Bot + Custom Workflow',
      quoted_price: 'Rp3.500.000',
      campaign_id: 'camp-id-b2b-q4',
      draft_subject: 'Ide AI admin ringan untuk PT. Integrasi Andalan Mitra',
      draft_body:
        'Halo Tim PT. Integrasi Andalan Mitra, kami menawarkan integrasi AI Admin ringan untuk mempercepat penanganan inquiry klien B2B Anda.',
      verified_facts: ['Email terverifikasi: cs@i-am.co.id', 'Terkirim di outreach-send-ledger.jsonl'],
      created_at: '2026-10-28T11:00:00.000Z',
      updated_at: '2026-10-29T23:13:52.000Z',
    },
    {
      id: 'lead-eazypos-005',
      company_name: 'Eazy Pos',
      email: 'info@eazypos.com',
      phone: '021-4412900',
      website: 'https://eazypos.com',
      category: 'saas-pos',
      source: 'indonesiayp_public_listing',
      qualification_score: 92,
      status: 'POSITIVE',
      suppression_reason: null,
      problem_hypothesis: 'Penyedia POS kasir membutuhkan AI onboarding assistant untuk merchant UMKM baru.',
      recommended_offer: 'AI Customer Onboarding Assistant',
      quoted_price: 'Rp4.000.000',
      campaign_id: 'camp-id-b2b-q4',
      draft_subject: 'Ide AI admin ringan untuk Eazy Pos',
      draft_body:
        'Halo Tim Eazy Pos, sistem AI Assistant kami dapat membantu merchant POS baru melakukan setup katalog dan troubleshooting otomatis.',
      verified_facts: ['Email terverifikasi: info@eazypos.com', 'Balasan positif diterima dari tim produk'],
      created_at: '2026-10-27T09:00:00.000Z',
      updated_at: '2026-10-30T02:14:05.000Z',
    },
    {
      id: 'lead-eikon-006',
      company_name: 'Eikon Technology',
      email: 'sales@eikontechnology.com',
      phone: '021-2902111',
      website: 'https://eikontechnology.com',
      category: 'enterprise-it',
      source: 'indonesiayp_public_listing',
      qualification_score: 94,
      status: 'MEETING',
      suppression_reason: null,
      problem_hypothesis: 'Konsultan cloud enterprise membutuhkan agen riset RFP dan otomasi dokumen teknis.',
      recommended_offer: 'JAGAT Colony Sovereign RAG',
      quoted_price: 'Rp7.500.000',
      campaign_id: 'camp-id-b2b-q4',
      draft_subject: 'Ide AI admin ringan untuk Eikon Technology',
      draft_body: 'Halo Tim Eikon Technology, berikut jadwal meeting 15 menit via Calendly untuk demo JAGAT RAG.',
      verified_facts: ['Meeting terjadwal via Closer Agent Calendly', 'Skor kualifikasi 94/100'],
      created_at: '2026-10-26T10:00:00.000Z',
      updated_at: '2026-10-30T06:00:00.000Z',
    },
    {
      id: 'lead-longetiv-007',
      company_name: 'Longetiv Digital Hub',
      email: 'hello@longetivhub.id',
      phone: '085888172084',
      website: 'https://www.indonesiayp.com/company/840328/longetiv-digital-hub',
      category: 'digital-agency',
      source: 'indonesiayp_public_listing',
      qualification_score: 90,
      status: 'PROPOSAL',
      suppression_reason: null,
      problem_hypothesis: 'Digital agency di Jakarta Selatan membutuhkan white-label AI Admin Bot untuk klien mereka.',
      recommended_offer: 'Agency Partner Bundle (AI Admin + RAG)',
      quoted_price: 'Rp6.000.000',
      campaign_id: 'camp-id-b2b-q4',
      draft_subject: 'Proposal Kemitraan White-Label AI Agent — Longetiv Digital Hub x JAGAT',
      draft_body: 'Proposal paket kemitraan teknologi JAGAT AI telah dikirimkan setelah sesi discovery call.',
      verified_facts: ['Berdiri 2024 di Jakarta Selatan', 'Proposal Rp6.000.000 sedang ditinjau direktur'],
      created_at: '2026-10-25T14:00:00.000Z',
      updated_at: '2026-10-30T07:00:00.000Z',
    },
    {
      id: 'lead-janjilaut-008',
      company_name: 'Janji Laut Resort',
      email: 'contact@janjilaut.com',
      phone: '0431-889123',
      website: 'https://janjilaut.com',
      category: 'hospitality',
      source: 'indonesiayp_public_listing',
      qualification_score: 86,
      status: 'WON',
      suppression_reason: null,
      problem_hypothesis: 'Resort membutuhkan sistem reservasi multibahasa (ID/EN) dan asisten tamu otomatis.',
      recommended_offer: 'Multilingual AI Concierge + Booking Web',
      quoted_price: 'Rp3.500.000',
      campaign_id: 'camp-id-b2b-q4',
      draft_subject: 'Solusi Website & AI Praktis untuk Janji Laut Resort (JAGAT AI)',
      draft_body: 'Deal closed — implementasi AI Concierge & Booking untuk Janji Laut Resort.',
      verified_facts: ['Tercatat di outreach-send-ledger.jsonl', 'Invoice tahap 1 lunas Rp3.500.000'],
      created_at: '2026-10-22T09:00:00.000Z',
      updated_at: '2026-10-29T16:30:00.000Z',
    },
    {
      id: 'lead-creativo-009',
      company_name: 'Creativo School Surabaya',
      email: 'admisi@creativoschool.sch.id',
      phone: '031-83971118',
      website: 'https://creativoschool.sch.id',
      category: 'school',
      source: 'indonesiayp_public_listing',
      qualification_score: 79,
      status: 'CONTACT_VERIFIED',
      suppression_reason: null,
      problem_hypothesis: 'Sekolah kreatif membutuhkan sistem informasi pendaftaran dan chatbot jadwal kelas.',
      recommended_offer: 'AI Admission Bot + Portal Informasi',
      quoted_price: 'Rp2.500.000',
      campaign_id: 'camp-id-b2b-q4',
      verified_facts: ['Berdiri 2015 di Surabaya', 'Email admisi terverifikasi & bebas duplikasi'],
      created_at: '2026-10-30T01:00:00.000Z',
      updated_at: '2026-10-30T03:00:00.000Z',
    },
    {
      id: 'lead-abm-010',
      company_name: 'ABM Logistic Jakarta',
      email: 'cs@abmlogistics.co.id',
      phone: '021-4309981',
      website: 'https://abmlogistics.co.id',
      category: 'logistics',
      source: 'indonesiayp_public_listing',
      qualification_score: 74,
      status: 'UNSUBSCRIBED',
      suppression_reason: 'Prospect requested opt-out via inbound reply on 2026-10-29',
      problem_hypothesis: 'Perusahaan logistik membutuhkan bot pelacakan kargo B2B.',
      recommended_offer: 'AI Logistics Tracker Bot',
      quoted_price: 'Rp3.000.000',
      campaign_id: 'camp-id-b2b-q4',
      draft_subject: 'Ide AI admin ringan untuk ABM Logistic Jakarta',
      draft_body: 'Halo Tim ABM Logistic Jakarta...',
      verified_facts: ['Opt-out tercatat; wajib diblokir oleh Outreach Policy Engine'],
      created_at: '2026-10-27T12:00:00.000Z',
      updated_at: '2026-10-29T18:00:00.000Z',
    },
  ];
}

// ── Main Phase 1 Engine Class ───────────────────────────────────────────────
export class JagatPhase1Engine {
  private leads: Map<string, LeadRecord> = new Map();
  private messages: Map<string, OutreachMessage> = new Map();
  private idempotencyIndex: Map<string, string> = new Map(); // idempotency_key -> message_id
  private events: OutreachEvent[] = [];
  private approvals: Map<string, ApprovalRecord> = new Map();
  private tasks: AgentTaskRecord[] = [];
  private modelUsage: ModelUsageRecord[] = [];
  private inboundHistory: InboundReplyEvaluation[] = [];
  private redisLocks: Map<string, RedisLockEntry> = new Map();
  private suppressedEmails: Set<string> = new Set();
  private pausedCampaigns: Set<string> = new Set();

  public outboundMode: OutboundMode = 'APPROVAL';
  public globalPause: boolean = false;
  public maxEmailsPerDay: number = 10;
  public maxPerCycle: number = 2;
  public budgetHardCapIdr: number = 500_000;
  public dailyAlertIdr: number = 35_000;
  public qdrantSimulatedOnline: boolean = true;

  public featureFlags: FeatureFlags = {
    FF_OUTREACH_POLICY_ENGINE: true,
    FF_IDEMPOTENCY_GUARD: true,
    FF_LEAD_STATE_MACHINE: true,
    FF_INBOUND_SAFETY_GUARD: true,
    FF_MODEL_COST_ROUTER: true,
    FF_RAG_HEALTH_GUARD: true,
  };

  constructor() {
    this.seedInitialState();
  }

  public seedInitialState(): void {
    this.leads.clear();
    this.messages.clear();
    this.idempotencyIndex.clear();
    this.events = [];
    this.approvals.clear();
    this.tasks = [];
    this.modelUsage = [];
    this.inboundHistory = [];
    this.redisLocks.clear();
    this.suppressedEmails.clear();
    this.pausedCampaigns.clear();

    const initialLeads = createInitialLeads();
    for (const lead of initialLeads) {
      this.leads.set(lead.id, lead);

      this.recordEvent({
        lead_id: lead.id,
        campaign_id: lead.campaign_id,
        event_type: 'LEAD_SEEDED_FROM_TRACKER',
        from_status: null,
        to_status: lead.status,
        actor: 'system-seed',
        metadata: { source: lead.source, score: lead.qualification_score },
      });

      if (lead.status === 'UNSUBSCRIBED' || lead.status === 'SUPPRESSED') {
        this.suppressedEmails.add(lead.email.toLowerCase());
      }

      if (lead.status === 'PENDING_APPROVAL' && lead.draft_subject && lead.draft_body) {
        const approvalId = `appr-${lead.id}`;
        this.approvals.set(approvalId, {
          approval_id: approvalId,
          lead_id: lead.id,
          company_name: lead.company_name,
          email: lead.email,
          campaign_id: lead.campaign_id,
          action: 'send_initial_outreach',
          subject: lead.draft_subject,
          body_preview: lead.draft_body,
          qualification_score: lead.qualification_score,
          verified_facts: lead.verified_facts,
          requested_by: 'copywriter-agent',
          approved_by: null,
          decision: 'PENDING',
          decided_at: null,
          created_at: lead.updated_at,
        });
      }

      if (['SENT', 'POSITIVE', 'MEETING', 'PROPOSAL', 'WON'].includes(lead.status)) {
        const idemKey = buildIdempotencyKey(lead.id, lead.campaign_id, 'initial_outreach');
        const msgId = `msg-seed-${lead.id}`;
        const msg: OutreachMessage = {
          id: msgId,
          lead_id: lead.id,
          campaign_id: lead.campaign_id,
          message_type: 'initial_outreach',
          idempotency_key: idemKey,
          subject: lead.draft_subject || `Solusi AI untuk ${lead.company_name}`,
          body: lead.draft_body || '',
          body_hash: computeBodyHash(lead.draft_subject || '', lead.draft_body || ''),
          provider_message_id: `<${msgId}@smtp.gmail.com>`,
          status: 'SENT',
          sent_at: lead.updated_at,
        };
        this.messages.set(msgId, msg);
        this.idempotencyIndex.set(idemKey, msgId);
      }
    }

    // Seed baseline tasks & model usage logs matching Blueprint Section 12 format
    const seedUsage: Omit<ModelUsageRecord, 'id'>[] = [
      {
        task_id: 'task_scout_001',
        agent: 'research-agent',
        task_type: 'extraction_json',
        provider: 'gemini_cloud',
        model: 'gemini-3.8-flash',
        input_tokens: 2450,
        output_tokens: 780,
        latency_ms: 1120,
        estimated_cost_idr: 13.4,
        estimated_cost_usd: 0.00084,
        fallback_used: false,
        retry_count: 0,
        verification: 'passed',
        created_at: '2026-10-30T03:10:00.000Z',
      },
      {
        task_id: 'task_draft_002',
        agent: 'copywriter-agent',
        task_type: 'email_generation',
        provider: 'gemini_cloud',
        model: 'gemini-3.8-flash',
        input_tokens: 1850,
        output_tokens: 620,
        latency_ms: 980,
        estimated_cost_idr: 10.4,
        estimated_cost_usd: 0.00065,
        fallback_used: false,
        retry_count: 0,
        verification: 'passed',
        created_at: '2026-10-30T04:10:00.000Z',
      },
      {
        task_id: 'task_closer_003',
        agent: 'closer-agent',
        task_type: 'classification',
        provider: 'local_ollama',
        model: 'llama3.2:1b',
        input_tokens: 920,
        output_tokens: 140,
        latency_ms: 410,
        estimated_cost_idr: 0,
        estimated_cost_usd: 0,
        fallback_used: false,
        retry_count: 0,
        verification: 'passed',
        created_at: '2026-10-30T05:30:00.000Z',
      },
      {
        task_id: 'task_proposal_004',
        agent: 'director-agent',
        task_type: 'complex_reasoning',
        provider: 'gemini_cloud',
        model: 'gemini-4-argon',
        input_tokens: 3200,
        output_tokens: 1450,
        latency_ms: 2840,
        estimated_cost_idr: 175.5,
        estimated_cost_usd: 0.011,
        fallback_used: false,
        retry_count: 0,
        verification: 'passed',
        created_at: '2026-10-30T06:45:00.000Z',
      },
    ];

    for (const u of seedUsage) {
      this.modelUsage.push({ ...u, id: `usage-${this.modelUsage.length + 1}` });
      this.tasks.push({
        task_id: u.task_id,
        mission_id: 'mission-phase1-rev',
        agent: u.agent,
        task_type: u.task_type,
        status: 'completed',
        attempts: u.retry_count + 1,
        max_attempts: 3,
        started_at: u.created_at,
        finished_at: u.created_at,
        duration_ms: u.latency_ms,
        error_code: null,
        verification: u.verification,
      });
    }
  }

  // ── 1. Lead State Machine & Event Tracking (Sec 5 & 6) ────────────────────
  public recordEvent(params: {
    lead_id: string;
    message_id?: string | null;
    campaign_id: string;
    event_type: string;
    from_status?: LeadStatus | null;
    to_status: LeadStatus;
    actor: string;
    metadata?: Record<string, unknown>;
  }): OutreachEvent {
    const ev: OutreachEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      lead_id: params.lead_id,
      message_id: params.message_id ?? null,
      campaign_id: params.campaign_id,
      event_type: params.event_type,
      from_status: params.from_status ?? null,
      to_status: params.to_status,
      actor: params.actor,
      metadata: params.metadata ?? {},
      created_at: new Date().toISOString(),
    };
    this.events.unshift(ev);
    return ev;
  }

  public transitionLeadState(
    leadId: string,
    nextStatus: LeadStatus,
    actor: string,
    eventType: string,
    metadata: Record<string, unknown> = {},
  ): LeadRecord {
    const lead = this.leads.get(leadId);
    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }
    const prevStatus = lead.status;
    lead.status = nextStatus;
    lead.updated_at = new Date().toISOString();

    if (nextStatus === 'SUPPRESSED' || nextStatus === 'UNSUBSCRIBED') {
      this.suppressedEmails.add(lead.email.toLowerCase());
      lead.suppression_reason = String(metadata.reason || `Marked ${nextStatus} by ${actor}`);
    }

    this.recordEvent({
      lead_id: leadId,
      campaign_id: lead.campaign_id,
      event_type: eventType,
      from_status: prevStatus,
      to_status: nextStatus,
      actor,
      metadata,
    });

    return lead;
  }

  public addAndQualifyLead(params: {
    company_name: string;
    email: string;
    category: string;
    problem_hypothesis: string;
    recommended_offer: string;
    quoted_price: string;
    campaign_id?: string;
  }): { lead: LeadRecord; approval: ApprovalRecord | null; policy: PolicyEvaluationResult } {
    const emailClean = params.email.trim().toLowerCase();
    const campaignId = params.campaign_id || 'camp-id-b2b-q4';

    // Check duplicate email in existing leads
    const existingByEmail = Array.from(this.leads.values()).find(
      (l) => l.email.toLowerCase() === emailClean,
    );
    const id = `lead-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean);
    const qualScore = validEmail && params.problem_hypothesis.length >= 10 ? 86 : 45;

    const lead: LeadRecord = {
      id,
      company_name: params.company_name.trim(),
      email: emailClean,
      category: params.category || 'b2b-services',
      source: 'scout_discovery_phase1',
      qualification_score: qualScore,
      status: existingByEmail ? 'DUPLICATE' : 'DISCOVERED',
      suppression_reason: existingByEmail ? `Duplicate of ${existingByEmail.id}` : null,
      problem_hypothesis: params.problem_hypothesis,
      recommended_offer: params.recommended_offer || 'AI Admin Bot + Website Cepat',
      quoted_price: params.quoted_price || 'Rp2.500.000',
      campaign_id: campaignId,
      draft_subject: `Optimalisasi Operasional ${params.company_name.trim()} dengan AI & Web System (JAGAT AI)`,
      draft_body: `Halo Tim ${params.company_name.trim()},\n\nKami melihat peluang untuk membantu ${params.company_name.trim()} terkait: ${params.problem_hypothesis}.\n\nMelalui paket ${params.recommended_offer} (${params.quoted_price}), tim Anda dapat mengotomatiskan layanan pelanggan dan workflow harian secara terukur. Apakah berkenan kami kirimkan demo singkat minggu ini?`,
      verified_facts: [
        `Perusahaan: ${params.company_name.trim()}`,
        `Kontak: ${emailClean}`,
        `Hipotesis: ${params.problem_hypothesis}`,
      ],
      created_at: now,
      updated_at: now,
    };

    this.leads.set(id, lead);
    this.recordEvent({
      lead_id: id,
      campaign_id: campaignId,
      event_type: existingByEmail ? 'LEAD_DEDUPLICATED_BLOCKED' : 'LEAD_DISCOVERED',
      from_status: null,
      to_status: lead.status,
      actor: 'prospect-discovery-agent',
      metadata: { email: emailClean, duplicate_of: existingByEmail?.id ?? null },
    });

    if (existingByEmail) {
      return {
        lead,
        approval: null,
        policy: this.evaluateOutreachPolicy(lead.id),
      };
    }

    // Advance through Qualification -> Contact Verification -> Drafted
    if (qualScore >= 65) {
      this.transitionLeadState(id, 'QUALIFIED', 'qualification-agent', 'LEAD_QUALIFIED', {
        qualification_score: qualScore,
      });
      this.transitionLeadState(id, 'CONTACT_VERIFIED', 'verification-agent', 'CONTACT_VERIFIED', {
        email_valid: validEmail,
      });
      this.transitionLeadState(id, 'DRAFTED', 'email-draft-agent', 'DRAFT_GENERATED', {
        subject: lead.draft_subject,
      });
    }

    const policy = this.evaluateOutreachPolicy(id);
    let approval: ApprovalRecord | null = null;

    if (policy.execution_decision === 'QUEUE_TELEGRAM_APPROVAL') {
      this.transitionLeadState(id, 'PENDING_APPROVAL', 'outreach-policy-engine', 'QUEUED_FOR_TELEGRAM_APPROVAL');
      const approvalId = `appr-${id}`;
      approval = {
        approval_id: approvalId,
        lead_id: id,
        company_name: lead.company_name,
        email: lead.email,
        campaign_id: lead.campaign_id,
        action: 'send_initial_outreach',
        subject: lead.draft_subject!,
        body_preview: lead.draft_body!,
        qualification_score: lead.qualification_score,
        verified_facts: lead.verified_facts,
        requested_by: 'outreach-policy-engine',
        approved_by: null,
        decision: 'PENDING',
        decided_at: null,
        created_at: new Date().toISOString(),
      };
      this.approvals.set(approvalId, approval);
    }

    return { lead: this.leads.get(id)!, approval, policy };
  }

  // ── 2. Outreach Policy Engine (Sec 4 & 8) ─────────────────────────────────
  public getSentCountToday(): number {
    const todayPrefix = new Date().toISOString().slice(0, 10);
    let count = 0;
    for (const msg of this.messages.values()) {
      if (msg.status === 'SENT' && msg.sent_at && msg.sent_at.startsWith(todayPrefix)) {
        count++;
      }
    }
    return count;
  }

  public evaluateOutreachPolicy(
    leadId: string,
    messageType: 'initial_outreach' | 'followup_1' | 'closer_reply' = 'initial_outreach',
  ): PolicyEvaluationResult {
    const lead = this.leads.get(leadId);
    if (!lead) {
      return {
        allowed: false,
        execution_decision: 'BLOCK',
        reasons: ['Lead not found'],
        checks: {
          global_pause_clear: !this.globalPause,
          campaign_pause_clear: false,
          not_suppressed: false,
          valid_email_format: false,
          qualification_score_pass: false,
          daily_rate_limit_clear: false,
          idempotency_clear: false,
          facts_grounded: false,
        },
      };
    }

    const idemKey = buildIdempotencyKey(lead.id, lead.campaign_id, messageType);
    const existingMsgId = this.idempotencyIndex.get(idemKey);
    const existingMsg = existingMsgId ? this.messages.get(existingMsgId) : undefined;

    const checks = {
      global_pause_clear: !this.globalPause,
      campaign_pause_clear: !this.pausedCampaigns.has(lead.campaign_id),
      not_suppressed:
        !this.suppressedEmails.has(lead.email.toLowerCase()) &&
        lead.status !== 'SUPPRESSED' &&
        lead.status !== 'UNSUBSCRIBED' &&
        lead.status !== 'DUPLICATE',
      valid_email_format: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email),
      qualification_score_pass: lead.qualification_score >= 65,
      daily_rate_limit_clear: this.getSentCountToday() < this.maxEmailsPerDay,
      idempotency_clear: !this.featureFlags.FF_IDEMPOTENCY_GUARD || !existingMsg,
      facts_grounded: (lead.verified_facts?.length ?? 0) > 0,
    };

    const reasons: string[] = [];
    if (!checks.global_pause_clear) reasons.push('Global outbound pause switch is ACTIVE');
    if (!checks.campaign_pause_clear) reasons.push(`Campaign ${lead.campaign_id} is paused`);
    if (!checks.not_suppressed) reasons.push(`Lead ${lead.email} is on suppression/opt-out list (${lead.status})`);
    if (!checks.valid_email_format) reasons.push(`Invalid email address format: ${lead.email}`);
    if (!checks.qualification_score_pass)
      reasons.push(`Qualification score (${lead.qualification_score}) below minimum threshold (65)`);
    if (!checks.daily_rate_limit_clear)
      reasons.push(`Daily rate limit reached (${this.getSentCountToday()}/${this.maxEmailsPerDay})`);
    if (!checks.idempotency_clear)
      reasons.push(`Idempotency Guard blocked duplicate key ${idemKey} (existing status: ${existingMsg?.status})`);
    if (!checks.facts_grounded) reasons.push('Draft lacks verified grounding facts');

    if (lead.status === 'NEEDS_RECONCILIATION') {
      reasons.push('Lead is in NEEDS_RECONCILIATION state; manual reconciliation required before retry');
    }

    // If feature flag is disabled (Rollback mode), only check basic email format & daily rate limit
    if (!this.featureFlags.FF_OUTREACH_POLICY_ENGINE) {
      const legacyAllowed = checks.valid_email_format && checks.daily_rate_limit_clear && checks.idempotency_clear;
      return {
        allowed: legacyAllowed,
        execution_decision: legacyAllowed ? 'ALLOW_SEND' : 'BLOCK',
        reasons: legacyAllowed ? ['FF_OUTREACH_POLICY_ENGINE disabled (Legacy fallback)'] : reasons,
        checks,
      };
    }

    const allChecksPass = Object.values(checks).every(Boolean) && lead.status !== 'NEEDS_RECONCILIATION';
    if (!allChecksPass) {
      return {
        allowed: false,
        execution_decision: 'BLOCK',
        reasons,
        checks,
      };
    }

    if (this.outboundMode === 'PREPARE') {
      return {
        allowed: false,
        execution_decision: 'HOLD_PREPARE',
        reasons: ['Outbound mode is PREPARE: discovery and draft saved, sending held'],
        checks,
      };
    }

    if (this.outboundMode === 'APPROVAL') {
      return {
        allowed: true,
        execution_decision: 'QUEUE_TELEGRAM_APPROVAL',
        reasons: ['All policy checks passed; queued for Telegram Approval (default for new leads)'],
        checks,
      };
    }

    return {
      allowed: true,
      execution_decision: 'ALLOW_SEND',
      reasons: ['Controlled Auto-Send permitted under rate limit and policy guard'],
      checks,
    };
  }

  // ── 3. Idempotency Guard, Outbound Send & Crash Recovery (Sec 4 & 7) ───────
  public executeOutboundSend(params: {
    lead_id: string;
    actor: string;
    message_type?: 'initial_outreach' | 'followup_1' | 'closer_reply';
    simulate_crash_after_smtp?: boolean;
    bypass_approval_gate?: boolean;
    custom_provider_message_id?: string;
  }): {
    success: boolean;
    status: OutreachMessage['status'] | 'BLOCKED_BY_POLICY';
    idempotency_key: string;
    message?: OutreachMessage;
    reason: string;
  } {
    const lead = this.leads.get(params.lead_id);
    if (!lead) {
      throw new Error(`Lead ${params.lead_id} not found`);
    }
    const messageType = params.message_type ?? 'initial_outreach';
    const idemKey = buildIdempotencyKey(lead.id, lead.campaign_id, messageType);

    // 1. Check Idempotency Guard first
    if (this.featureFlags.FF_IDEMPOTENCY_GUARD) {
      const existingMsgId = this.idempotencyIndex.get(idemKey);
      if (existingMsgId) {
        const existing = this.messages.get(existingMsgId)!;
        this.recordEvent({
          lead_id: lead.id,
          message_id: existing.id,
          campaign_id: lead.campaign_id,
          event_type: 'DUPLICATE_SEND_PREVENTED',
          from_status: lead.status,
          to_status: lead.status,
          actor: params.actor,
          metadata: { idempotency_key: idemKey, existing_status: existing.status },
        });
        return {
          success: false,
          status: 'DUPLICATE_BLOCKED',
          idempotency_key: idemKey,
          message: existing,
          reason: `Idempotency Guard blocked duplicate send for key "${idemKey}" (already ${existing.status})`,
        };
      }
    }

    // 2. Re-validate Policy before send (Acceptance Criteria #4: Approve re-validates policy & state)
    const policy = this.evaluateOutreachPolicy(lead.id, messageType);
    if (!policy.checks.global_pause_clear || !policy.checks.campaign_pause_clear || !policy.checks.not_suppressed || !policy.checks.valid_email_format || !policy.checks.daily_rate_limit_clear) {
      this.recordEvent({
        lead_id: lead.id,
        campaign_id: lead.campaign_id,
        event_type: 'OUTBOUND_BLOCKED_BY_POLICY',
        from_status: lead.status,
        to_status: lead.status,
        actor: params.actor,
        metadata: { reasons: policy.reasons },
      });
      return {
        success: false,
        status: 'BLOCKED_BY_POLICY',
        idempotency_key: idemKey,
        reason: policy.reasons.join('; '),
      };
    }

    if (
      this.featureFlags.FF_OUTREACH_POLICY_ENGINE &&
      this.outboundMode === 'APPROVAL' &&
      !params.bypass_approval_gate
    ) {
      return {
        success: false,
        status: 'BLOCKED_BY_POLICY',
        idempotency_key: idemKey,
        reason: 'Lead requires explicit Telegram Approval before outbound send',
      };
    }

    // 3. Atomic reservation BEFORE calling SMTP
    const msgId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const subject = lead.draft_subject || `Solusi AI & Otomasi untuk ${lead.company_name}`;
    const body = lead.draft_body || `Halo Tim ${lead.company_name}, berikut penawaran JAGAT AI.`;

    const reservation: OutreachMessage = {
      id: msgId,
      lead_id: lead.id,
      campaign_id: lead.campaign_id,
      message_type: messageType,
      idempotency_key: idemKey,
      subject,
      body,
      body_hash: computeBodyHash(subject, body),
      provider_message_id: null,
      status: 'RESERVED',
      sent_at: null,
    };

    this.messages.set(msgId, reservation);
    if (this.featureFlags.FF_IDEMPOTENCY_GUARD) {
      this.idempotencyIndex.set(idemKey, msgId);
    }

    // 4. Staging Mock or Real Live SMTP Provider Message ID
    const providerMessageId =
      params.custom_provider_message_id || `<jagat-staging-${msgId}@smtp.gmail.com>`;
    reservation.provider_message_id = providerMessageId;

    // 5. Simulate Worker Crash after SMTP accepts message but before status is committed (Sec 7)
    if (params.simulate_crash_after_smtp) {
      reservation.status = 'NEEDS_RECONCILIATION';
      this.transitionLeadState(
        lead.id,
        'NEEDS_RECONCILIATION',
        params.actor,
        'WORKER_CRASH_POST_SMTP_NEEDS_RECONCILIATION',
        {
          idempotency_key: idemKey,
          provider_message_id: providerMessageId,
          note: 'Worker crashed after SMTP handoff; automatic retry blocked until ledger reconciliation',
        },
      );
      return {
        success: false,
        status: 'NEEDS_RECONCILIATION',
        idempotency_key: idemKey,
        message: reservation,
        reason: 'Worker crashed after SMTP handoff! Marked NEEDS_RECONCILIATION — duplicate retry blocked.',
      };
    }

    // 6. Commit SENT status atomically
    reservation.status = 'SENT';
    reservation.sent_at = new Date().toISOString();
    this.transitionLeadState(lead.id, 'SENT', params.actor, 'OUTBOUND_EMAIL_SENT_STAGING', {
      idempotency_key: idemKey,
      provider_message_id: providerMessageId,
      subject,
    });

    return {
      success: true,
      status: 'SENT',
      idempotency_key: idemKey,
      message: reservation,
      reason: `Staging email sent and recorded in ledger (${providerMessageId})`,
    };
  }

  public reconcileMessage(
    leadId: string,
    resolution: 'CONFIRM_SENT' | 'RESET_TO_APPROVED',
    actor: string,
  ): LeadRecord {
    const lead = this.leads.get(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found`);

    const idemKey = buildIdempotencyKey(lead.id, lead.campaign_id, 'initial_outreach');
    const msgId = this.idempotencyIndex.get(idemKey);
    const msg = msgId ? this.messages.get(msgId) : undefined;

    if (resolution === 'CONFIRM_SENT') {
      if (msg) {
        msg.status = 'SENT';
        msg.sent_at = new Date().toISOString();
      }
      return this.transitionLeadState(lead.id, 'SENT', actor, 'RECONCILIATION_CONFIRMED_SENT', {
        idempotency_key: idemKey,
        provider_message_id: msg?.provider_message_id,
      });
    } else {
      if (msgId) {
        this.messages.delete(msgId);
      }
      this.idempotencyIndex.delete(idemKey);
      return this.transitionLeadState(
        lead.id,
        'PENDING_APPROVAL',
        actor,
        'RECONCILIATION_RESET_FOR_RETRY',
        { idempotency_key: idemKey },
      );
    }
  }

  // ── 4. Telegram Approval UX Handler (Sec 3, 4, 8, 14) ─────────────────────
  public handleTelegramApproval(params: {
    approval_id: string;
    decision: 'APPROVED' | 'REJECTED' | 'SKIPPED';
    approved_by: string;
    edited_subject?: string;
    edited_body?: string;
    note?: string;
  }): {
    approval: ApprovalRecord;
    lead: LeadRecord;
    send_result?: ReturnType<JagatPhase1Engine['executeOutboundSend']>;
  } {
    const approval = this.approvals.get(params.approval_id);
    if (!approval) {
      throw new Error(`Approval ${params.approval_id} not found`);
    }
    const lead = this.leads.get(approval.lead_id);
    if (!lead) {
      throw new Error(`Lead ${approval.lead_id} not found`);
    }

    if (params.edited_subject) {
      lead.draft_subject = params.edited_subject;
      approval.subject = params.edited_subject;
    }
    if (params.edited_body) {
      lead.draft_body = params.edited_body;
      approval.body_preview = params.edited_body;
    }

    approval.decision = params.decision;
    approval.approved_by = params.approved_by;
    approval.decided_at = new Date().toISOString();
    approval.decision_note = params.note;

    if (params.decision === 'REJECTED') {
      const updated = this.transitionLeadState(
        lead.id,
        'SUPPRESSED',
        params.approved_by,
        'TELEGRAM_APPROVAL_REJECTED_SUPPRESSED',
        { approval_id: approval.approval_id, note: params.note },
      );
      return { approval, lead: updated };
    }

    if (params.decision === 'SKIPPED') {
      const updated = this.transitionLeadState(
        lead.id,
        'DRAFTED',
        params.approved_by,
        'TELEGRAM_APPROVAL_SKIPPED',
        { approval_id: approval.approval_id, note: params.note },
      );
      return { approval, lead: updated };
    }

    // Decision === 'APPROVED': Acceptance Criteria #4 — Re-validate policy & state before send!
    const sendResult = this.executeOutboundSend({
      lead_id: lead.id,
      actor: `telegram:${params.approved_by}`,
      message_type: 'initial_outreach',
      bypass_approval_gate: true,
    });

    if (!sendResult.success) {
      // Revert approval decision to PENDING if blocked by Global Pause, or mark rejected if suppressed
      if (lead.status === 'SUPPRESSED' || lead.status === 'UNSUBSCRIBED') {
        approval.decision = 'REJECTED';
      } else {
        approval.decision = 'PENDING';
      }
    }

    return {
      approval,
      lead: this.leads.get(lead.id)!,
      send_result: sendResult,
    };
  }

  // ── 5. Inbound Closer Guard & Intent Classifier (Sec 2, 5, 8, 14) ─────────
  public processInboundReply(params: {
    from_email: string;
    subject: string;
    raw_body: string;
    llm_override?: {
      intent: 'POSITIVE' | 'NEGATIVE' | 'AMBIGUOUS' | 'OTHER';
      confidence: number;
      suggested_reply?: string;
    };
  }): InboundReplyEvaluation {
    const emailClean = params.from_email.trim().toLowerCase();
    const matchedLead =
      Array.from(this.leads.values()).find((l) => l.email.toLowerCase() === emailClean) ?? null;

    const inspection = inspectUntrustedEmail(params.raw_body);
    const replyId = `inb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

    // 1. Prompt Injection Guard
    if (this.featureFlags.FF_INBOUND_SAFETY_GUARD && inspection.detected) {
      if (matchedLead) {
        this.transitionLeadState(
          matchedLead.id,
          'NEEDS_HUMAN_REVIEW',
          'inbound-closer-guard',
          'PROMPT_INJECTION_BLOCKED_ESCALATED',
          { triggers: inspection.triggers, from_email: emailClean },
        );
      }
      const evaluation: InboundReplyEvaluation = {
        reply_id: replyId,
        from_email: emailClean,
        matched_lead_id: matchedLead?.id ?? null,
        matched_company: matchedLead?.company_name ?? null,
        raw_snippet: redactSecrets(params.raw_body).slice(0, 240),
        sanitized_content: inspection.sanitized,
        prompt_injection_detected: true,
        injection_triggers: inspection.triggers,
        intent: 'UNTRUSTED_INJECTION',
        confidence: 0.99,
        action_taken: 'BLOCKED_PROMPT_INJECTION',
        lead_status_after: matchedLead ? 'NEEDS_HUMAN_REVIEW' : undefined,
        evaluated_at: new Date().toISOString(),
      };
      this.inboundHistory.unshift(evaluation);
      return evaluation;
    }

    // 2. Classify Intent & Confidence (either from server-side Gemini or deterministic classifier)
    let intent: 'POSITIVE' | 'NEGATIVE' | 'AMBIGUOUS' | 'OTHER' = 'OTHER';
    let confidence = 0.65;
    const lower = params.raw_body.toLowerCase();

    if (params.llm_override) {
      intent = params.llm_override.intent;
      confidence = params.llm_override.confidence;
    } else if (
      /\b(unsubscribe|stop|jangan\s+hubungi|tidak\s+tertarik|hapus\s+email|not\s+interested|remove\s+me)\b/i.test(
        lower,
      )
    ) {
      intent = 'NEGATIVE';
      confidence = 0.96;
    } else if (
      /\b(tertarik|boleh\s+demo|jadwal\s+meeting|berapa\s+biaya|kirim\s+proposal|interested|schedule\s+a\s+call|book\s+meeting|demo\s+hari\s+ini)\b/i.test(
        lower,
      ) &&
      !/\b(belum\s+pasti|nanti\s+dulu|mungkin\s+tahun\s+depan|tanya\s+atasan\s+dulu)\b/i.test(lower)
    ) {
      intent = 'POSITIVE';
      confidence = 0.92;
    } else {
      intent = 'AMBIGUOUS';
      confidence = 0.58;
    }

    if (!matchedLead) {
      const evaluation: InboundReplyEvaluation = {
        reply_id: replyId,
        from_email: emailClean,
        matched_lead_id: null,
        matched_company: null,
        raw_snippet: redactSecrets(params.raw_body).slice(0, 240),
        sanitized_content: inspection.sanitized,
        prompt_injection_detected: false,
        injection_triggers: [],
        intent,
        confidence,
        action_taken: 'IGNORED_NO_MATCH',
        evaluated_at: new Date().toISOString(),
      };
      this.inboundHistory.unshift(evaluation);
      return evaluation;
    }

    // First mark REPLIED in event history
    this.transitionLeadState(matchedLead.id, 'REPLIED', 'imap-listener', 'INBOUND_REPLY_RECEIVED', {
      subject: params.subject,
      confidence,
      raw_intent: intent,
    });

    // 3. Handle NEGATIVE / Unsubscribe
    if (intent === 'NEGATIVE') {
      this.transitionLeadState(
        matchedLead.id,
        'UNSUBSCRIBED',
        'closer-agent',
        'INBOUND_NEGATIVE_AUTO_UNSUBSCRIBED',
        { reason: 'Prospect replied with negative/unsubscribe intent', confidence },
      );
      const evaluation: InboundReplyEvaluation = {
        reply_id: replyId,
        from_email: emailClean,
        matched_lead_id: matchedLead.id,
        matched_company: matchedLead.company_name,
        raw_snippet: redactSecrets(params.raw_body).slice(0, 240),
        sanitized_content: inspection.sanitized,
        prompt_injection_detected: false,
        injection_triggers: [],
        intent: 'NEGATIVE',
        confidence,
        action_taken: 'AUTO_UNSUBSCRIBED_SUPPRESSED',
        lead_status_after: 'UNSUBSCRIBED',
        evaluated_at: new Date().toISOString(),
      };
      this.inboundHistory.unshift(evaluation);
      return evaluation;
    }

    // 4. Confidence Threshold Check (Acceptance Criteria #5: ambiguous or low-confidence -> NEEDS_HUMAN_REVIEW)
    const confidenceThreshold = 0.8;
    if (
      this.featureFlags.FF_INBOUND_SAFETY_GUARD &&
      (intent === 'AMBIGUOUS' || intent === 'OTHER' || confidence < confidenceThreshold)
    ) {
      this.transitionLeadState(
        matchedLead.id,
        'NEEDS_HUMAN_REVIEW',
        'closer-agent',
        'LOW_CONFIDENCE_ESCALATED_TO_HUMAN',
        { confidence, threshold: confidenceThreshold, intent },
      );
      const evaluation: InboundReplyEvaluation = {
        reply_id: replyId,
        from_email: emailClean,
        matched_lead_id: matchedLead.id,
        matched_company: matchedLead.company_name,
        raw_snippet: redactSecrets(params.raw_body).slice(0, 240),
        sanitized_content: inspection.sanitized,
        prompt_injection_detected: false,
        injection_triggers: [],
        intent: 'AMBIGUOUS',
        confidence,
        action_taken: 'ESCALATED_HUMAN_REVIEW',
        lead_status_after: 'NEEDS_HUMAN_REVIEW',
        evaluated_at: new Date().toISOString(),
      };
      this.inboundHistory.unshift(evaluation);
      return evaluation;
    }

    // 5. High-confidence POSITIVE -> Transition to POSITIVE and prepare Calendly reply
    const calendlyUrl = 'https://calendly.com/faturachmanalkahfi7/15min';
    const suggestedReply =
      params.llm_override?.suggested_reply ||
      `Halo Tim ${matchedLead.company_name},\n\nTerima kasih atas respons positifnya! Untuk mendemokan ${matchedLead.recommended_offer} secara langsung sesuai kebutuhan ${matchedLead.company_name}, silakan pilih jadwal diskusi 15 menit yang paling nyaman melalui tautan berikut:\n\n${calendlyUrl}\n\nSalam hangat,\nTim JAGAT AI`;

    this.transitionLeadState(matchedLead.id, 'POSITIVE', 'closer-agent', 'POSITIVE_REPLY_CALENDLY_SENT', {
      confidence,
      calendly_link: calendlyUrl,
    });

    const evaluation: InboundReplyEvaluation = {
      reply_id: replyId,
      from_email: emailClean,
      matched_lead_id: matchedLead.id,
      matched_company: matchedLead.company_name,
      raw_snippet: redactSecrets(params.raw_body).slice(0, 240),
      sanitized_content: inspection.sanitized,
      prompt_injection_detected: false,
      injection_triggers: [],
      intent: 'POSITIVE',
      confidence,
      action_taken: 'AUTO_CALENDLY_DRAFTED',
      suggested_reply: suggestedReply,
      lead_status_after: 'POSITIVE',
      evaluated_at: new Date().toISOString(),
    };
    this.inboundHistory.unshift(evaluation);
    return evaluation;
  }

  // ── 6. Model Router, Fallback & Budget Hard Cap (Sec 9 & 15) ──────────────
  public getTotalCostIdr(): number {
    return Number(
      this.modelUsage.reduce((sum, item) => sum + item.estimated_cost_idr, 0).toFixed(2),
    );
  }

  public isBudgetKillSwitchActive(): boolean {
    return this.featureFlags.FF_MODEL_COST_ROUTER && this.getTotalCostIdr() >= this.budgetHardCapIdr;
  }

  public routeAndTrackModelTask(params: {
    task_type: ModelTaskType;
    agent: string;
    input_tokens: number;
    output_tokens: number;
    simulate_primary_timeout?: boolean;
    simulate_permanent_auth_error?: boolean;
  }): {
    allowed: boolean;
    route: ModelRouteConfig;
    selected_provider: ModelUsageRecord['provider'];
    selected_model: string;
    fallback_used: boolean;
    usage_record: ModelUsageRecord | null;
    task_record: AgentTaskRecord;
    reason: string;
  } {
    const route = PHASE1_MODEL_ROUTES[params.task_type];
    const taskId = `task_${params.task_type}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    // Check permanent auth/billing error rule (Sec 9: Never retry auth, billing, or invalid request repeatedly)
    if (params.simulate_permanent_auth_error) {
      const failedTask: AgentTaskRecord = {
        task_id: taskId,
        mission_id: 'mission-phase1-rev',
        agent: params.agent,
        task_type: params.task_type,
        status: 'dead_letter',
        attempts: 1,
        max_attempts: route.max_retries + 1,
        started_at: now,
        finished_at: now,
        duration_ms: 145,
        error_code: 'ERR_PERMANENT_AUTH_OR_INVALID_REQUEST',
        verification: 'failed',
      };
      this.tasks.unshift(failedTask);
      return {
        allowed: false,
        route,
        selected_provider: route.primary_provider,
        selected_model: route.primary_model,
        fallback_used: false,
        usage_record: null,
        task_record: failedTask,
        reason: 'Permanent 401/403/400 error detected: moved immediately to dead_letter without retry loop',
      };
    }

    // Check Hard Budget Cap Kill Switch
    const killSwitchActive = this.isBudgetKillSwitchActive();
    let selectedProvider: ModelUsageRecord['provider'] = route.primary_provider;
    let selectedModel = route.primary_model;
    let fallbackUsed = false;
    let retryCount = 0;
    let reason = `Routed to primary model ${route.primary_model} (${route.primary_provider})`;

    if (killSwitchActive && route.primary_provider === 'gemini_cloud') {
      selectedProvider = 'fallback_local';
      selectedModel = 'llama3:latest';
      fallbackUsed = true;
      reason = `Budget Hard Cap (${this.budgetHardCapIdr.toLocaleString('id-ID')} IDR) reached — Kill Switch downgraded cloud call to free local Ollama (llama3:latest)`;
    } else if (params.simulate_primary_timeout) {
      selectedProvider =
        route.fallback_provider === 'local_ollama' ? 'fallback_local' : route.fallback_provider;
      selectedModel = route.fallback_model;
      fallbackUsed = true;
      retryCount = route.max_retries;
      reason = `Primary model ${route.primary_model} timed out after ${route.timeout_ms}ms (${retryCount} retries) — fell back to ${route.fallback_model}`;
    }

    const isZeroCostLocal = selectedProvider === 'local_ollama' || selectedProvider === 'fallback_local';
    const costIdr = isZeroCostLocal
      ? 0
      : Number(
          (
            (params.input_tokens / 1000) * route.cost_per_1k_input_idr +
            (params.output_tokens / 1000) * route.cost_per_1k_output_idr
          ).toFixed(2),
        );
    const costUsd = Number((costIdr / 16000).toFixed(6));
    const latencyMs = params.simulate_primary_timeout
      ? route.timeout_ms + 450
      : isZeroCostLocal
        ? 480
        : 920;

    const usageRecord: ModelUsageRecord = {
      id: `usage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      task_id: taskId,
      agent: params.agent,
      task_type: params.task_type,
      provider: selectedProvider,
      model: selectedModel,
      input_tokens: params.input_tokens,
      output_tokens: params.output_tokens,
      latency_ms: latencyMs,
      estimated_cost_idr: costIdr,
      estimated_cost_usd: costUsd,
      fallback_used: fallbackUsed,
      retry_count: retryCount,
      verification: 'passed',
      created_at: now,
    };

    const taskRecord: AgentTaskRecord = {
      task_id: taskId,
      mission_id: 'mission-phase1-rev',
      agent: params.agent,
      task_type: params.task_type,
      status: 'completed',
      attempts: retryCount + 1,
      max_attempts: route.max_retries + 1,
      started_at: now,
      finished_at: now,
      duration_ms: latencyMs,
      error_code: null,
      verification: 'passed',
    };

    this.modelUsage.unshift(usageRecord);
    this.tasks.unshift(taskRecord);

    return {
      allowed: true,
      route,
      selected_provider: selectedProvider,
      selected_model: selectedModel,
      fallback_used: fallbackUsed,
      usage_record: usageRecord,
      task_record: taskRecord,
      reason,
    };
  }

  // ── 7. Redis Safe Lock & Scheduler Concurrency Guard (Sec 5, 7, 11, 14) ───
  public acquireRedisLock(params: {
    key: string;
    worker_id: string;
    resource_type: RedisLockEntry['resource_type'];
    ttl_ms?: number;
    now_ms?: number;
  }): { acquired: boolean; lock: RedisLockEntry | null; reason: string } {
    const nowMs = params.now_ms ?? Date.now();
    const ttlMs = params.ttl_ms ?? 300_000; // Default 5 min TTL
    const existing = this.redisLocks.get(params.key);

    if (existing && existing.expires_at > nowMs) {
      return {
        acquired: false,
        lock: null,
        reason: `Lock "${params.key}" is already held by worker "${existing.worker_id}" (token: ${existing.owner_token}) until ${new Date(existing.expires_at).toISOString()}`,
      };
    }

    const ownerToken = `tok:${params.worker_id}:${nowMs}:${Math.random().toString(36).slice(2, 7)}`;
    const entry: RedisLockEntry = {
      key: params.key,
      owner_token: ownerToken,
      worker_id: params.worker_id,
      resource_type: params.resource_type,
      ttl_ms: ttlMs,
      acquired_at: nowMs,
      expires_at: nowMs + ttlMs,
    };

    this.redisLocks.set(params.key, entry);
    return {
      acquired: true,
      lock: entry,
      reason: `Lock "${params.key}" acquired with owner_token "${ownerToken}" (TTL ${ttlMs}ms)`,
    };
  }

  public releaseRedisLockCompareAndDelete(key: string, ownerToken: string): {
    released: boolean;
    reason: string;
  } {
    const existing = this.redisLocks.get(key);
    if (!existing) {
      return { released: false, reason: `Lock "${key}" does not exist` };
    }
    if (existing.owner_token !== ownerToken) {
      return {
        released: false,
        reason: `Compare-and-delete rejected: token mismatch (provided "${ownerToken}", actual owner is "${existing.worker_id}")`,
      };
    }
    this.redisLocks.delete(key);
    return {
      released: true,
      reason: `Lock "${key}" safely released via atomic compare-and-delete`,
    };
  }

  public recoverStaleLocks(nowMs: number = Date.now()): {
    recovered_count: number;
    recovered_keys: string[];
  } {
    const recoveredKeys: string[] = [];
    for (const [key, entry] of this.redisLocks.entries()) {
      if (entry.expires_at <= nowMs) {
        this.redisLocks.delete(key);
        recoveredKeys.push(key);
      }
    }
    return {
      recovered_count: recoveredKeys.length,
      recovered_keys: recoveredKeys,
    };
  }

  // ── 8. Qdrant / RAG Health & Dimension Validation (Sec 10 & 14) ───────────
  public validateQdrantRag(simulateOffline?: boolean): QdrantValidationReport {
    const isOnline = simulateOffline !== undefined ? !simulateOffline : this.qdrantSimulatedOnline;
    const expectedDim = 768; // nomic-embed-text dimension
    const actualDim = 768;

    if (!isOnline) {
      return {
        service_Reachable: false,
        host: 'http://localhost:6333',
        collection_name: 'jagat_indonesia_knowledge',
        collection_exists: false,
        expected_dimension: expectedDim,
        actual_dimension: 0,
        embedding_model: 'nomic-embed-text',
        dimension_match: false,
        points_count: 0,
        retrieval_test_passed: false,
        sample_retrieved_doc: null,
        graceful_degradation_active: true,
        checked_at: new Date().toISOString(),
      };
    }

    return {
      service_Reachable: true,
      host: 'http://localhost:6333',
      collection_name: 'jagat_indonesia_knowledge',
      collection_exists: true,
      expected_dimension: expectedDim,
      actual_dimension: actualDim,
      embedding_model: 'nomic-embed-text',
      dimension_match: expectedDim === actualDim,
      points_count: 142,
      retrieval_test_passed: true,
      sample_retrieved_doc: {
        doc_id: 'JAGAT-W1-001',
        title: 'JAGAT G7 Technical Blueprint & Sovereign Offer Packages',
        score: 0.914,
        snippet:
          'Paket AI Admin Bot + Website Cepat (Rp2.500.000) & Sovereign RAG Assistant untuk otomatisasi operasional B2B Indonesia.',
      },
      graceful_degradation_active: false,
      checked_at: new Date().toISOString(),
    };
  }

  // ── 9. Funnel & Observability Snapshot (Sec 12) ───────────────────────────
  public getSnapshot() {
    const allLeads = Array.from(this.leads.values());
    const countsByStatus: Record<string, number> = {};
    for (const l of allLeads) {
      countsByStatus[l.status] = (countsByStatus[l.status] || 0) + 1;
    }

    const latencies = this.modelUsage.map((u) => u.latency_ms).sort((a, b) => a - b);
    const p50Latency = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95Latency = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;

    return {
      outbound_mode: this.outboundMode,
      global_pause: this.globalPause,
      paused_campaigns: Array.from(this.pausedCampaigns),
      feature_flags: this.featureFlags,
      budget: {
        total_cost_idr: this.getTotalCostIdr(),
        hard_cap_idr: this.budgetHardCapIdr,
        daily_alert_idr: this.dailyAlertIdr,
        kill_switch_active: this.isBudgetKillSwitchActive(),
        utilization_percent: Number(((this.getTotalCostIdr() / this.budgetHardCapIdr) * 100).toFixed(1)),
      },
      funnel_metrics: {
        total_leads: allLeads.length,
        discovered: allLeads.filter((l) => l.status === 'DISCOVERED').length,
        qualified_and_verified: allLeads.filter((l) =>
          ['QUALIFIED', 'CONTACT_VERIFIED', 'DRAFTED'].includes(l.status),
        ).length,
        pending_approval: allLeads.filter((l) => l.status === 'PENDING_APPROVAL').length,
        sent: allLeads.filter((l) => ['SENT', 'REPLIED', 'POSITIVE', 'MEETING', 'PROPOSAL', 'WON'].includes(l.status))
          .length,
        replied_positive: allLeads.filter((l) => ['POSITIVE', 'MEETING', 'PROPOSAL', 'WON'].includes(l.status)).length,
        meetings: allLeads.filter((l) => ['MEETING', 'PROPOSAL', 'WON'].includes(l.status)).length,
        proposals: allLeads.filter((l) => ['PROPOSAL', 'WON'].includes(l.status)).length,
        won: allLeads.filter((l) => l.status === 'WON').length,
        suppressed_or_unsubscribed: allLeads.filter((l) =>
          ['SUPPRESSED', 'UNSUBSCRIBED', 'DUPLICATE'].includes(l.status),
        ).length,
        needs_human_or_reconciliation: allLeads.filter((l) =>
          ['NEEDS_HUMAN_REVIEW', 'NEEDS_RECONCILIATION'].includes(l.status),
        ).length,
        sent_today: this.getSentCountToday(),
        max_emails_per_day: this.maxEmailsPerDay,
        counts_by_status: countsByStatus,
      },
      reliability_metrics: {
        total_tasks: this.tasks.length,
        completed_tasks: this.tasks.filter((t) => t.status === 'completed').length,
        dead_letter_tasks: this.tasks.filter((t) => t.status === 'dead_letter').length,
        latency_p50_ms: p50Latency,
        latency_p95_ms: p95Latency,
        active_redis_locks: Array.from(this.redisLocks.values()),
        qdrant_rag: this.validateQdrantRag(),
      },
      leads: allLeads,
      approvals: Array.from(this.approvals.values()),
      messages: Array.from(this.messages.values()),
      events: this.events.slice(0, 60),
      model_routes: Object.values(PHASE1_MODEL_ROUTES),
      model_usage: this.modelUsage,
      tasks: this.tasks,
      inbound_history: this.inboundHistory,
      suppressed_emails: Array.from(this.suppressedEmails),
    };
  }
}
