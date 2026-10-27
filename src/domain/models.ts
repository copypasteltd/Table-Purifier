import type { Schema } from '../shared/contracts.js';
import type { PreloadReceipt,SessionStatus,CleanupStatus } from '../shared/lifecycle.js';
import { type Transaction,one,sqlIdentifier } from '../db/database.js';
import { notFound } from '../shared/errors.js';

export interface Actor {owner:string;identity:string;provider:Schema['Provider'];appAlias:string;loginSessionId?:string;}
export interface SessionRow {id:string;owner_id:string;task_id:string|null;run_id:string|null;operation_id:string;workspace_id:string;
  status:SessionStatus;version:number;skill_manifest_sha256:string;preload_receipt:PreloadReceipt|null;cleanup_status:CleanupStatus;
  result_id:string|null;idle_expires_at:Date|null;adjustment_rounds:number;codex_thread_id:string|null;active_job_id:string|null;process_id:number|null;}
export interface TaskRow {id:string;owner_id:string;mode:Schema['Mode'];goal:string|null;goal_version:number;version:number;epoch:number;
  current_source_set_id:string|null;current_run_id:string|null;current_result_id:string|null;current_plan_id:string|null;agent_session_id:string;
  updated_at:Date;deleted_at:Date|null;standard_definition:Schema['SchemaDefinition']|null;standard_reference:{source_id?:string;template_version_id?:string}|null;}
export interface SourceRow {id:string;owner_id:string;session_id:string;role:'SOURCE'|'TEMPLATE';kind:'FILE'|'TEXT';display_name:string;
  media_type:string;byte_count:number;content_sha256:string;object_key:string;status:Schema['Source']['status'];expires_at:Date|null;
  deleted_at:Date|null;readability_reason:string|null;measurement:Record<string,unknown>;}
export interface SourceSetRow {id:string;task_id:string;version:number;content_sha256:string;scope_summary:Record<string,unknown>;}
export interface UploadRow {id:string;task_id:string;role:'SOURCE'|'TEMPLATE';expected_bytes:number;expected_sha256:string;expected_mime:string;
  display_name:string;token_hash:string;expires_at:Date;status:string;source_id:string|null;received_object_key:string|null;}
export interface PlanRow {id:string;owner_id:string;task_id:string;session_id:string;binding_id:string|null;version:number;status:Schema['ExecutionPlan']['status'];
  source_set_id:string;goal_version:number;plan_sha256:string;source_set_sha256:string;skill_manifest_sha256:string;content_ref:string|null;
  summary:{strategy_summary:string;limitations:string[];preview_record_count:number};estimated_records:number|null;measured_units:number;}
export interface ProposalRow {id:string;task_id:string;source_set_id:string;goal_version:number;version:number;status:Schema['SchemaStatus'];
  content:Schema['Proposal'];content_sha256:string;plan_id:string;}
export interface BindingRow {id:string;task_id:string;source_set_id:string;proposal_id:string|null;proposal_version:number|null;goal_version:number;
  content:Schema['SchemaDefinition'];content_sha256:string;}
export interface ContractRow {id:string;task_id:string;version:number;source_set_id:string;goal_version:number;mode:Schema['Mode'];
  schema_binding_id:string;contract_sha256:string;policy_snapshot:Schema['PolicySnapshot'];budget_snapshot:Schema['Budget'];confirmed_plan_id:string;budget_contract_id?:string|null;}
export interface QuoteRow {id:string;contract_id:string;provider:Schema['Provider'];app_alias:string;os:string;sku_id:string;amount_minor:number;
  amount_unit:string;expires_at:Date;capability_version:string;policy_snapshot:Schema['PolicySnapshot'];quote_sha256:string;}
export interface OrderRow {id:string;owner_id:string;contract_id:string;quote_id:string;provider:Schema['Provider'];app_alias:string;sku_id:string;
  amount_minor:number;amount_unit:string;payment_status:Schema['PaymentStatus'];refund_status:Schema['RefundStatus'];fulfillment_status:Schema['FulfillmentStatus'];
  refunded_minor:number;refund_reserved_minor:number;version:number;updated_at:Date;reconciliation_required?:boolean;}
export interface RunRow {id:string;owner_id:string;task_id:string;contract_id:string;grant_id:string;parent_run_id:string|null;parent_result_id:string|null;
  execution_status:Schema['ExecutionStatus'];schema_status:Schema['SchemaStatus'];quality_status:Schema['QualityStatus'];version:number;epoch:number;
  schema_binding_id:string|null;current_stage:string|null;cancel_requested_at:Date|null;finished_at:Date|null;}
export interface OperationRow {id:string;status:Schema['OperationStatus'];kind:string;resource_ref:{id?:string;kind?:string};error_code:string|null;}

// This whitelist is source controlled. Never accept SQL table/column identifiers from API input.
const TABLES=new Set(['agent_sessions','tasks','source_files','source_sets','upload_sessions','execution_plans','schema_proposals',
 'schema_bindings','processing_contracts','quotes','orders','runs','operations','private_templates','private_template_versions',
 'deletion_requests','decision_previews','decision_batches','artifacts','artifact_sets','entitlement_grants','accounts','support_tickets','correction_authorizations']);
export async function get<T>(tx:Transaction,table:string,id:string,lock=false):Promise<T>{
  if(!TABLES.has(table))throw new Error('Unreviewed resource table.');
  const row=await one(tx,`SELECT * FROM p07.${sqlIdentifier(table)} WHERE id=$1${lock?' FOR UPDATE':''}`,[id]);
  if(!row)notFound();return row as T;
}
export const iso=(value:Date|null):string|null=>value?.toISOString()??null;
export const action=(action:string,label:string,enabled:boolean,reason='INVALID_SESSION_PHASE'):Schema['AllowedActions'][number]=>
  ({action,label,enabled,reason_code:enabled?null:reason});
export const BUDGET:Schema['Budget']={source_files:10,source_single_bytes:20_000_000,source_total_bytes:50_000_000,template_bytes:5_000_000,
 text_codepoints:50_000,processing_units:50,target_fields:50,candidate_records:1000,compute_seconds_max:900,stage_auto_retries_max:1};
export const EMPTY_COVERAGE:Schema['Coverage']={confirmed_units:0,read_units:0,unreadable_units:0,excluded_units:0,scope_sha256:'0'.repeat(64),limitations:[]};
export function sourceView(row:SourceRow):Schema['Source']{return {source_id:row.id,role:row.role,name:row.display_name,bytes:row.byte_count,
 sha256:row.content_sha256,mime:row.media_type,status:row.status,expires_at:iso(row.expires_at),readability_reason:row.readability_reason};}
export function sessionView(row:SessionRow):Schema['Session']{return {session_id:row.id,version:row.version,status:row.status,task_id:row.task_id,
 skill_load_receipt:row.preload_receipt,cleanup_status:row.cleanup_status,result_id:row.result_id,result_files_preserved:true};}
export function planView(row:PlanRow,bindingHash:string|null):Schema['ExecutionPlan']{return {plan_id:row.id,version:row.version,plan_hash:row.plan_sha256,
 session_id:row.session_id,source_set_sha256:row.source_set_sha256,schema_binding_sha256:bindingHash,skill_manifest_sha256:row.skill_manifest_sha256,
 status:row.status,analysis_scope:'FULL',estimated_records:row.estimated_records,preview_record_count:row.summary.preview_record_count,
 strategy_summary:row.summary.strategy_summary,limitations:row.summary.limitations};}
export function operationView(row:OperationRow):Schema['Operation']{return {operation_id:row.id,status:row.status,kind:row.kind,
 resource_id:row.resource_ref.id??null,resource_kind:row.resource_ref.kind??null,error_code:row.error_code};}
