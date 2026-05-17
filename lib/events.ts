import { supabaseAdmin } from './supabase';

export type EventType =
  | 'outreach_sent' | 'outreach_opened' | 'outreach_reply_received' | 'outreach_classified'
  | 'clinic_signed_up' | 'clinic_verified' | 'clinic_activated'
  | 'onboarding_survey_saved'
  | 'supplier_connected' | 'supplier_disconnected'
  | 'search_performed' | 'product_viewed' | 'cart_updated'
  | 'order_placed' | 'order_completed'
  | 'demo_booked' | 'demo_cancelled' | 'demo_completed'
  | 'supplier_meeting_booked' | 'supplier_deal_signed'
  | 'feature_shipped' | 'feature_used'
  | 'gdc_verified' | 'gdc_failed' | 'gdc_queued' | 'gdc_status_changed'
  | 'decision_made'
  | 'kpi_snapshot'
  | 'loop_completed'
  | 'intelligence_queried'
  | 'agent_task_claimed'
  | 'agent_task_completed'
  | 'agent_task_failed'
  | 'agent_qa_passed'
  | 'agent_qa_failed'
  | 'agent_kpi_snapshot'
  | 'agent_response_review'
  | 'sku_match_approved'
  | 'sku_match_rejected'
  | 'catalog_identity_merged'
  | 'catalog_identity_rejected'
  | 'catalog_sku_hygiene_run'
  | 'price_sync_triggered'
  | 'price_sync_completed'
  | 'cron_price_refresh'
  | 'supplier_basket_pushed'
  | 'supplier_gmv_directed'
  | 'substitute_lookup'
  | 'order_approved'
  | 'order_rejected'
  | 'os_approval_requested'
  | 'os_approval_resolved'
  | 'os_live_doc_updated'
  | 'production_deploy'
  | 'deployment_failed'
  | 'deployment_event'
  /** Every HTTP API hit (middleware → ingest); see middleware exclusions */
  | 'http_action'
  | 'admin_force_sync';

export interface EventPayload {
  event_type: EventType;
  entity_type?: string;
  entity_id?: string;
  payload?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  kpi_impact?: Record<string, unknown>;
  source?: string;
  session_id?: string;
}

export async function logEvent(event: EventPayload): Promise<void> {
  try {
    await supabaseAdmin.from('events').insert({
      event_type: event.event_type,
      entity_type: event.entity_type ?? null,
      entity_id: event.entity_id ?? null,
      payload: event.payload ?? {},
      metrics: event.metrics ?? {},
      kpi_impact: event.kpi_impact ?? {},
      source: event.source ?? 'system',
      session_id: event.session_id ?? null,
    });
  } catch (err) {
    // Non-fatal — never let event logging break the main flow
    console.error('[events] logEvent failed:', err);
  }
}

export async function logDecision(
  decision: string,
  rationale: string,
  expectedOutcome: string,
  tags: string[] = []
): Promise<void> {
  try {
    await supabaseAdmin.from('decisions').insert({
      decision,
      rationale,
      expected_outcome: expectedOutcome,
      tags,
    });
    await logEvent({
      event_type: 'decision_made',
      payload: { decision, rationale, expected_outcome: expectedOutcome, tags },
      source: 'founder',
    });
  } catch (err) {
    console.error('[events] logDecision failed:', err);
  }
}
