import { invariant } from './errors.js';

export const SESSION_STATUSES = [
  'INITIALIZING', 'READY_FOR_INPUT', 'INPUT_RECEIVED', 'ANALYZING', 'WAITING_CONFIRMATION',
  'QUOTABLE', 'AWAITING_PAYMENT', 'BATCH_QUEUED', 'BATCH_RUNNING', 'PERSISTING_RESULTS',
  'RELEASING_RUNTIME', 'CLOSED', 'INITIALIZATION_FAILED', 'FAILED', 'CANCELED',
] as const;
export type SessionStatus = typeof SESSION_STATUSES[number];
export type CleanupStatus = 'NOT_REQUESTED' | 'PENDING' | 'STOPPING' | 'DELETING' | 'SUCCEEDED' | 'FAILED';
export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
export type AgentPhase = 'BOOTSTRAP' | 'ANALYZE' | 'ADJUST' | 'BATCH' | 'REPAIR';

const transitions: Record<SessionStatus, readonly SessionStatus[]> = {
  INITIALIZING: ['READY_FOR_INPUT', 'INITIALIZATION_FAILED', 'CANCELED'],
  READY_FOR_INPUT: ['INPUT_RECEIVED', 'CANCELED'],
  INPUT_RECEIVED: ['ANALYZING', 'CANCELED', 'FAILED'],
  ANALYZING: ['WAITING_CONFIRMATION', 'FAILED', 'CANCELED'],
  WAITING_CONFIRMATION: ['ANALYZING', 'QUOTABLE', 'CANCELED'],
  QUOTABLE: ['ANALYZING', 'AWAITING_PAYMENT', 'CANCELED'],
  AWAITING_PAYMENT: ['ANALYZING', 'BATCH_QUEUED', 'CANCELED'],
  BATCH_QUEUED: ['BATCH_RUNNING', 'FAILED', 'CANCELED'],
  BATCH_RUNNING: ['PERSISTING_RESULTS', 'FAILED', 'CANCELED'],
  PERSISTING_RESULTS: ['RELEASING_RUNTIME', 'FAILED', 'CANCELED'],
  RELEASING_RUNTIME: ['CLOSED'],
  CLOSED: [],
  INITIALIZATION_FAILED: ['RELEASING_RUNTIME'],
  FAILED: ['RELEASING_RUNTIME'],
  CANCELED: ['RELEASING_RUNTIME'],
};

export function assertTransition(from: SessionStatus, to: SessionStatus): void {
  invariant(transitions[from].includes(to), 'INVALID_SESSION_PHASE', '当前会话阶段不允许此操作。', 409, { status: from });
}

export interface PreloadReceipt {
  skill_manifest_sha256: string;
  loaded_file_count: number;
  context_sha256: string;
  host_composition_verified: true;
  bootstrap_completed: true;
}

export function assertReadyInput(status: SessionStatus, receipt: PreloadReceipt | null, skillHash: string): void {
  invariant(['READY_FOR_INPUT', 'INPUT_RECEIVED', 'WAITING_CONFIRMATION', 'QUOTABLE'].includes(status),
    'SESSION_NOT_READY', '请等待会话准备完成后再提交资料。');
  invariant(receipt?.bootstrap_completed && receipt.host_composition_verified && receipt.loaded_file_count > 0
    && receipt.skill_manifest_sha256 === skillHash, 'SKILL_NOT_LOADED', '完整业务技能尚未加载完成。');
}

export interface PaidPermit {
  kind: 'PAID';
  payment_status: 'CONFIRMED';
  order_id: string;
  contract_id: string;
  plan_sha256: string;
  amount_minor: number;
  amount_unit: string;
  revoked: boolean;
}

export function assertPaidPermit(permit: PaidPermit | null, contractId: string, planHash: string): void {
  invariant(permit && permit.kind === 'PAID' && permit.payment_status === 'CONFIRMED' && !permit.revoked
    && permit.contract_id === contractId && permit.plan_sha256 === planHash && permit.amount_minor > 0,
  'PAYMENT_REQUIRED', '服务端确认原订单付款后才能批量产出。', 403);
}

export const INPUT_LIMITS = Object.freeze({
  sourceFiles: 10, singleBytes: 20_000_000, totalBytes: 50_000_000, templateBytes: 5_000_000,
  textCodepoints: 50_000, processingUnits: 50, fields: 50, candidates: 1000,
});
