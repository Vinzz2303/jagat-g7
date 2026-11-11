/**
 * JAGAT Phase 1 — Revenue & Reliability Upgrade
 * Core Domain Types & Data Contracts
 */

export type LeadStatus =
  | 'DISCOVERED'
  | 'QUALIFIED'
  | 'CONTACT_VERIFIED'
  | 'DRAFTED'
  | 'PENDING_APPROVAL'
  | 'SENT'
  | 'REPLIED'
  | 'POSITIVE'
  | 'MEETING'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST'
  | 'BOUNCED'
  | 'FAILED'
  | 'DUPLICATE'
  | 'SUPPRESSED'
  | 'UNSUBSCRIBED'
  | 'NEEDS_HUMAN_REVIEW'
  | 'NEEDS_RECONCILIATION';

export type OutboundMode = 'PREPARE' | 'APPROVAL' | 'CONTROLLED_AUTO_SEND';

export type ModelTaskType =
  | 'classification'
  | 'extraction_json'
  | 'email_generation'
  | 'complex_reasoning'
  | 'coding'
  | 'embedding';

export interface FeatureFlags {
  FF_OUTREACH_POLICY_ENGINE: boolean;
  FF_IDEMPOTENCY_GUARD: boolean;
  FF_LEAD_STATE_MACHINE: boolean;
  FF_INBOUND_SAFETY_GUARD: boolean;
  FF_MODEL_COST_ROUTER: boolean;
  FF_RAG_HEALTH_GUARD: boolean;
}

export interface LeadRecord {
  id: string;
  company_name: string;
  email: string;
  phone?: string;
  website?: string;
  category: string;
  source: string;
  qualification_score: number;
  status: LeadStatus;
  suppression_reason?: string | null;
  problem_hypothesis: string;
  recommended_offer: string;
  quoted_price: string;
  campaign_id: string;
  draft_subject?: string;
  draft_body?: string;
  verified_facts: string[];
  created_at: string;
  updated_at: string;
}

export interface OutreachMessage {
  id: string;
  lead_id: string;
  campaign_id: string;
  message_type: 'initial_outreach' | 'followup_1' | 'closer_reply';
  idempotency_key: string;
  subject: string;
  body: string;
  body_hash: string;
  provider_message_id: string | null;
  status: 'RESERVED' | 'SENT' | 'FAILED' | 'BOUNCED' | 'NEEDS_RECONCILIATION' | 'DUPLICATE_BLOCKED';
  sent_at: string | null;
  error_message?: string;
}

export interface OutreachEvent {
  id: string;
  lead_id: string;
  message_id?: string | null;
  campaign_id: string;
  event_type: string;
  from_status?: LeadStatus | null;
  to_status: LeadStatus;
  actor: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ApprovalRecord {
  approval_id: string;
  lead_id: string;
  company_name: string;
  email: string;
  campaign_id: string;
  action: 'send_initial_outreach' | 'send_closer_calendly' | 'override_policy';
  subject: string;
  body_preview: string;
  qualification_score: number;
  verified_facts: string[];
  requested_by: string;
  approved_by: string | null;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  decided_at: string | null;
  decision_note?: string;
  created_at: string;
}

export interface AgentTaskRecord {
  task_id: string;
  mission_id: string;
  agent: string;
  task_type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'dead_letter' | 'needs_reconciliation';
  attempts: number;
  max_attempts: number;
  started_at: string;
  finished_at: string | null;
  duration_ms: number;
  error_code: string | null;
  verification: 'passed' | 'failed' | 'pending';
}

export interface ModelUsageRecord {
  id: string;
  task_id: string;
  agent: string;
  task_type: ModelTaskType;
  provider: 'local_ollama' | 'gemini_cloud' | 'fallback_local';
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  estimated_cost_idr: number;
  estimated_cost_usd: number;
  fallback_used: boolean;
  retry_count: number;
  verification: 'passed' | 'failed';
  created_at: string;
}

export interface ModelRouteConfig {
  task_type: ModelTaskType;
  label: string;
  primary_provider: 'local_ollama' | 'gemini_cloud';
  primary_model: string;
  fallback_provider: 'local_ollama' | 'gemini_cloud';
  fallback_model: string;
  timeout_ms: number;
  max_retries: number;
  cost_per_1k_input_idr: number;
  cost_per_1k_output_idr: number;
  control_policy: string;
}

export interface RedisLockEntry {
  key: string;
  owner_token: string;
  worker_id: string;
  resource_type: 'campaign' | 'task' | 'outreach_send';
  ttl_ms: number;
  acquired_at: number;
  expires_at: number;
}

export interface InboundReplyEvaluation {
  reply_id: string;
  from_email: string;
  matched_lead_id: string | null;
  matched_company: string | null;
  raw_snippet: string;
  sanitized_content: string;
  prompt_injection_detected: boolean;
  injection_triggers: string[];
  intent: 'POSITIVE' | 'NEGATIVE' | 'AMBIGUOUS' | 'UNTRUSTED_INJECTION' | 'OTHER';
  confidence: number;
  action_taken:
    | 'AUTO_CALENDLY_DRAFTED'
    | 'ESCALATED_HUMAN_REVIEW'
    | 'AUTO_UNSUBSCRIBED_SUPPRESSED'
    | 'BLOCKED_PROMPT_INJECTION'
    | 'IGNORED_NO_MATCH';
  suggested_reply?: string;
  lead_status_after?: LeadStatus;
  evaluated_at: string;
}

export interface QdrantValidationReport {
  service_Reachable: boolean;
  host: string;
  collection_name: string;
  collection_exists: boolean;
  expected_dimension: number;
  actual_dimension: number;
  embedding_model: string;
  dimension_match: boolean;
  points_count: number;
  retrieval_test_passed: boolean;
  sample_retrieved_doc: {
    doc_id: string;
    title: string;
    score: number;
    snippet: string;
  } | null;
  graceful_degradation_active: boolean;
  checked_at: string;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  execution_decision: 'HOLD_PREPARE' | 'QUEUE_TELEGRAM_APPROVAL' | 'ALLOW_SEND' | 'BLOCK';
  reasons: string[];
  checks: {
    global_pause_clear: boolean;
    campaign_pause_clear: boolean;
    not_suppressed: boolean;
    valid_email_format: boolean;
    qualification_score_pass: boolean;
    daily_rate_limit_clear: boolean;
    idempotency_clear: boolean;
    facts_grounded: boolean;
  };
}
