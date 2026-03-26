export interface DriverLead {
  id: string;
  org_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  zip_code: string | null;
  cdl_number: string | null;
  cdl_class: string | null;
  endorsements: string | null;
  years_experience: string | null;
  segment_interest: string | null;
  entry_point: string;
  source_channel: string | null;
  source_campaign: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  referral_driver_id: string | null;
  job_board_source: string | null;
  tenstreet_applicant_id: string | null;
  tenstreet_status: string | null;
  tenstreet_link_sent_at: string | null;
  tenstreet_link_sent_by: string | null;
  pipeline_stage: number;
  stage_updated_at: string | null;
  recruiter_id: string | null;
  lead_score: number;
  score_breakdown: Record<string, number> | null;
  disposition: string;
  disposition_set_by: string | null;
  disposition_set_at: string | null;
  disposition_reason: string | null;
  contact_later_date: string | null;
  contact_later_reason: string | null;
  contact_later_eligible_date: string | null;
  newsletter_enrolled: boolean | null;
  do_not_hire: boolean;
  dnh_reason: string | null;
  dnh_flagged_by: string | null;
  dnh_flagged_at: string | null;
  dnh_tenstreet_synced: boolean | null;
  dnh_override_allowed: boolean | null;
  dnh_notified_ops: boolean | null;
  drip_active: boolean | null;
  drip_enrollment_id: string | null;
  cold_flag: boolean;
  cold_flagged_at: string | null;
  re_engagement_attempts: number | null;
  last_contact_at: string | null;
  do_not_contact: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
}

export interface CallLog {
  id: string;
  org_id: string;
  driver_id: string;
  recruiter_id: string | null;
  contact_type: string;
  outcome: string;
  callback_date: string | null;
  duration_sec: number | null;
  notes: string | null;
  logged_at: string;
}

export interface DripEnrollment {
  id: string;
  org_id: string;
  driver_id: string;
  campaign_id: string;
  enrolled_at: string | null;
  enrolled_by: string | null;
  status: string;
  next_message_id: string | null;
  next_send_at: string | null;
  messages_sent: number;
  last_sent_at: string | null;
  completed_at: string | null;
  converted_at: string | null;
}

export interface DripMessage {
  id: string;
  org_id: string;
  campaign_id: string;
  sequence_order: number;
  delay_days: number;
  channel: string;
  subject: string | null;
  body: string;
  is_active: boolean | null;
  total_sent: number;
  total_opened: number;
  total_replied: number;
  total_clicked: number;
}

export interface DripCampaign {
  id: string;
  org_id: string;
  name: string;
  campaign_type: string;
  segment: string | null;
  is_active: boolean | null;
  description: string | null;
}

export interface PipelineEvent {
  id: string;
  org_id: string;
  driver_id: string;
  from_stage: number | null;
  to_stage: number | null;
  from_disposition: string | null;
  to_disposition: string | null;
  changed_by: string | null;
  note: string | null;
  occurred_at: string;
}

export interface CmoInboxItem {
  id: string;
  org_id: string;
  item_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  source_action_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AutonomousAction {
  id: string;
  org_id: string;
  action_type: string;
  description: string;
  reasoning: string | null;
  affected_record_id: string | null;
  affected_table: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface AiCampaign {
  id: string;
  org_id: string;
  name: string;
  segment: string | null;
  ad_type: string | null;
  headline: string | null;
  body: string | null;
  cta: string | null;
  targeting_suggestion: string | null;
  platform: string | null;
  status: string;
  budget_cents: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ContentPost {
  id: string;
  org_id: string;
  post_type: string;
  title: string;
  body: string;
  platform: string | null;
  scheduled_for: string | null;
  status: string;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
