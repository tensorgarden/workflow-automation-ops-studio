export type RunStatus = "queued" | "running" | "awaiting_approval" | "completed" | "failed";
export type ConnectorStatus = "healthy" | "degraded" | "down";
export type ErrorCategory = "transient" | "permanent" | "unknown";
export type RecoveryStatus = "ready_for_replay" | "replayed" | "quarantined";
export type StepType = "trigger" | "transform" | "ai_analyze" | "ai_generate" | "outbound_email" | "outbound_slack" | "crm_upsert" | "sheets_append" | "approval_gate";

export interface WorkspaceMember {
  id: string; name: string; role: "admin" | "operator" | "viewer"; initials: string;
}

export interface Connector {
  id: string; name: string; type: string; status: ConnectorStatus;
  lastSuccess: string; errorCount: number; uptime: number;
}

export interface WorkflowStep {
  id: string; type: StepType; label: string; config: string;
}

export interface WorkflowDefinition {
  id: string; name: string; description: string; stepCount: number;
  connectorCount: number; lastRun: string; successRate: number;
  steps: WorkflowStep[];
}

export interface StepRunResult {
  stepId: string; stepLabel: string; status: "success" | "failed" | "skipped";
  input: string; output: string; duration: number; error?: string; retries: number; errorCategory?: ErrorCategory;
}

export interface WorkflowRun {
  id: string; workflowId: string; workflowName: string;
  status: RunStatus; startedAt: string; duration: number;
  stepResults: StepRunResult[]; costEstimate: number; costActual: number;
}

export interface ApprovalRequest {
  id: string; runId: string; workflowName: string; stepLabel: string;
  action: string; detail: string; requestedAt: string;
}

export interface AuditLogEntry {
  id: string; runId: string; action: string; detail: string; timestamp: string; cost: number;
}

export interface WebhookRecoveryEvent {
  id: string; workflowId: string; provider: string; receivedAt: string;
  traceId: string; idempotencyKey: string; failureReason: string;
  retryCount: number; maxRetries: number; status: RecoveryStatus;
  deadLetteredAt: string; replaySafe: boolean; operatorAction: string;
  errorCategory: ErrorCategory;
}

export interface CostSummary {
  totalRuns: number; totalCost: number; budgetLimit: number;
  costByWorkflow: { name: string; cost: number; runs: number }[];
}

export interface OpsSnapshot {
  members: WorkspaceMember[];
  connectors: Connector[];
  workflows: WorkflowDefinition[];
  activeRun: WorkflowRun | null;
  runHistory: WorkflowRun[];
  approvals: ApprovalRequest[];
  auditLog: AuditLogEntry[];
  webhookRecovery: WebhookRecoveryEvent[];
  costSummary: CostSummary;
}
