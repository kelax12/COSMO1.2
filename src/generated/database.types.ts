// @generated par scripts/contrat-donnees.mjs (supabase gen types typescript). NE PAS EDITER A LA MAIN.
// Source : une base vierge sur laquelle toutes les migrations de supabase/migration/ ont ete rejouees.
// La CI echoue si ce fichier diverge. Les mappers s'y accrochent par src/lib/db-contract.ts :
// un renommage de colonne casse `tsc`.
// Regenerer : npm run contrat:generer (Docker, supabase start, node scripts/apply-migrations.mjs) ou copier les fichiers de l'artefact `contrat-donnees` du job CI.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "account_inactivity_notices": {
                  Row: {
                    "activity_at": string,"user_id": string,"warned_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_at": string,"user_id": string,"warned_at"?: string
                  }
                  Update: {
                    "activity_at"?: string,"user_id"?: string,"warned_at"?: string
                  }
                  Relationships: [

                  ]
                },"admin_users": {
                  Row: {
                    "added_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"user_id": string
                  }
                  Update: {
                    "added_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"affiliate_clicks": {
                  Row: {
                    "clicked_at": string,"id": number,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "clicked_at"?: string,"id"?: number,"slug": string
                  }
                  Update: {
                    "clicked_at"?: string,"id"?: number,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_clicks_slug_fkey"
      columns: ["slug"]
isOneToOne: false
      referencedRelation: "affiliate_links"
      referencedColumns: ["slug"]
    }
                  ]
                },"affiliate_commissions": {
                  Row: {
                    "affiliate_id": string,"base_cents": number,"commission_cents": number,"created_at": string,"customer_id": string | null,"fee_cents": number,"gross_cents": number,"id": number,"occurred_at": string,"org_id": string | null,"payment_record_id": number,"rate_bp": number,"vat_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliate_id": string,"base_cents": number,"commission_cents": number,"created_at"?: string,"customer_id"?: string | null,"fee_cents": number,"gross_cents": number,"id"?: number,"occurred_at": string,"org_id"?: string | null,"payment_record_id": number,"rate_bp": number,"vat_cents": number
                  }
                  Update: {
                    "affiliate_id"?: string,"base_cents"?: number,"commission_cents"?: number,"created_at"?: string,"customer_id"?: string | null,"fee_cents"?: number,"gross_cents"?: number,"id"?: number,"occurred_at"?: string,"org_id"?: string | null,"payment_record_id"?: number,"rate_bp"?: number,"vat_cents"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
      columns: ["affiliate_id"]
isOneToOne: false
      referencedRelation: "affiliates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "affiliate_commissions_payment_record_id_fkey"
      columns: ["payment_record_id"]
isOneToOne: true
      referencedRelation: "payment_records"
      referencedColumns: ["id"]
    }
                  ]
                },"affiliate_contacts": {
                  Row: {
                    "email": string | null,"name": string | null,"phone": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email"?: string | null,"name"?: string | null,"phone"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "email"?: string | null,"name"?: string | null,"phone"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"affiliate_links": {
                  Row: {
                    "affiliate_id": string,"created_at": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliate_id": string,"created_at"?: string,"slug": string
                  }
                  Update: {
                    "affiliate_id"?: string,"created_at"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_links_affiliate_id_fkey"
      columns: ["affiliate_id"]
isOneToOne: false
      referencedRelation: "affiliates"
      referencedColumns: ["id"]
    }
                  ]
                },"affiliate_payouts": {
                  Row: {
                    "affiliate_id": string,"amount_cents": number,"created_at": string,"created_by": string,"id": string,"method": string | null,"note": string | null,"paid_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliate_id": string,"amount_cents": number,"created_at"?: string,"created_by": string,"id"?: string,"method"?: string | null,"note"?: string | null,"paid_on": string
                  }
                  Update: {
                    "affiliate_id"?: string,"amount_cents"?: number,"created_at"?: string,"created_by"?: string,"id"?: string,"method"?: string | null,"note"?: string | null,"paid_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
      columns: ["affiliate_id"]
isOneToOne: false
      referencedRelation: "affiliates"
      referencedColumns: ["id"]
    }
                  ]
                },"affiliate_settings": {
                  Row: {
                    "code_changed_at": string | null,"code_hash": string | null,"commission_bp": number,"fee_bp": number,"fee_fixed_cents": number,"id": boolean,"token_secret": string,"vat_bp": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code_changed_at"?: string | null,"code_hash"?: string | null,"commission_bp"?: number,"fee_bp"?: number,"fee_fixed_cents"?: number,"id"?: boolean,"token_secret"?: string,"vat_bp"?: number
                  }
                  Update: {
                    "code_changed_at"?: string | null,"code_hash"?: string | null,"commission_bp"?: number,"fee_bp"?: number,"fee_fixed_cents"?: number,"id"?: boolean,"token_secret"?: string,"vat_bp"?: number
                  }
                  Relationships: [

                  ]
                },"affiliates": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"email": string | null,"id": string,"name": string,"notes": string | null,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"phone"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string | null
                  }
                  Relationships: [

                  ]
                },"billing_acceptances": {
                  Row: {
                    "billing_interval": string | null,"cgv_version": string,"created_at": string,"id": string,"immediate_access_at": string,"org_id": string | null,"stripe_checkout_session": string | null,"tier_key": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_interval"?: string | null,"cgv_version": string,"created_at"?: string,"id"?: string,"immediate_access_at": string,"org_id"?: string | null,"stripe_checkout_session"?: string | null,"tier_key"?: string | null,"user_id": string
                  }
                  Update: {
                    "billing_interval"?: string | null,"cgv_version"?: string,"created_at"?: string,"id"?: string,"immediate_access_at"?: string,"org_id"?: string | null,"stripe_checkout_session"?: string | null,"tier_key"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_acceptances_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_flags": {
                  Row: {
                    "enabled": boolean,"key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"key": string
                  }
                  Update: {
                    "enabled"?: boolean,"key"?: string
                  }
                  Relationships: [

                  ]
                },"categories": {
                  Row: {
                    "color": string,"created_at": string | null,"id": string,"name": string,"parent_id": string | null,"position": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string | null,"id"?: string,"name": string,"parent_id"?: string | null,"position"?: number,"user_id": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string | null,"id"?: string,"name"?: string,"parent_id"?: string | null,"position"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"cron_leases": {
                  Row: {
                    "acquired_at": string,"job": string,"locked_until": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acquired_at"?: string,"job": string,"locked_until": string,"token": string
                  }
                  Update: {
                    "acquired_at"?: string,"job"?: string,"locked_until"?: string,"token"?: string
                  }
                  Relationships: [

                  ]
                },"cron_runs": {
                  Row: {
                    "detail": string | null,"finished_at": string | null,"http_code": number | null,"id": number,"job": string,"request_id": number | null,"started_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "detail"?: string | null,"finished_at"?: string | null,"http_code"?: number | null,"id"?: never,"job": string,"request_id"?: number | null,"started_at"?: string,"status"?: string
                  }
                  Update: {
                    "detail"?: string | null,"finished_at"?: string | null,"http_code"?: number | null,"id"?: never,"job"?: string,"request_id"?: number | null,"started_at"?: string,"status"?: string
                  }
                  Relationships: [

                  ]
                },"demo_devices": {
                  Row: {
                    "converted_at": string | null,"converted_user_id": string | null,"device_id": string,"first_seen_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "converted_at"?: string | null,"converted_user_id"?: string | null,"device_id": string,"first_seen_at"?: string
                  }
                  Update: {
                    "converted_at"?: string | null,"converted_user_id"?: string | null,"device_id"?: string,"first_seen_at"?: string
                  }
                  Relationships: [

                  ]
                },"email_lookup_global": {
                  Row: {
                    "lookups_in_window": number,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "lookups_in_window"?: number,"window_start": string
                  }
                  Update: {
                    "lookups_in_window"?: number,"window_start"?: string
                  }
                  Relationships: [

                  ]
                },"email_lookup_quota": {
                  Row: {
                    "lookups_in_window": number,"user_id": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "lookups_in_window"?: number,"user_id": string,"window_start"?: string
                  }
                  Update: {
                    "lookups_in_window"?: number,"user_id"?: string,"window_start"?: string
                  }
                  Relationships: [

                  ]
                },"events": {
                  Row: {
                    "color": string | null,"created_at": string | null,"created_by": string | null,"description": string | null,"end_time": string,"exceptions": (string)[],"id": string,"is_private": boolean,"notes": string | null,"recurrence": string,"recurrence_days": (number)[],"review_dismissed_at": string | null,"start_time": string,"task_id": string | null,"title": string,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"description"?: string | null,"end_time": string,"exceptions"?: (string)[],"id"?: string,"is_private"?: boolean,"notes"?: string | null,"recurrence"?: string,"recurrence_days"?: (number)[],"review_dismissed_at"?: string | null,"start_time": string,"task_id"?: string | null,"title": string,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"description"?: string | null,"end_time"?: string,"exceptions"?: (string)[],"id"?: string,"is_private"?: boolean,"notes"?: string | null,"recurrence"?: string,"recurrence_days"?: (number)[],"review_dismissed_at"?: string | null,"start_time"?: string,"task_id"?: string | null,"title"?: string,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks_pending_invites"
      referencedColumns: ["id"]
    }
                  ]
                },"friend_requests": {
                  Row: {
                    "created_at": string | null,"email": string,"id": string,"receiver_id": string | null,"sender_email": string | null,"sender_id": string,"sent_at": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"email": string,"id"?: string,"receiver_id"?: string | null,"sender_email"?: string | null,"sender_id": string,"sent_at"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"email"?: string,"id"?: string,"receiver_id"?: string | null,"sender_email"?: string | null,"sender_id"?: string,"sent_at"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"friends": {
                  Row: {
                    "avatar": string | null,"created_at": string | null,"email": string,"friend_user_id": string | null,"id": string,"name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar"?: string | null,"created_at"?: string | null,"email": string,"friend_user_id"?: string | null,"id"?: string,"name": string,"user_id": string
                  }
                  Update: {
                    "avatar"?: string | null,"created_at"?: string | null,"email"?: string,"friend_user_id"?: string | null,"id"?: string,"name"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"habit_completions": {
                  Row: {
                    "created_at": string,"day": string,"habit_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day": string,"habit_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"day"?: string,"habit_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "habit_completions_habit_fkey"
      columns: ["habit_id","user_id"]
isOneToOne: false
      referencedRelation: "habits"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"habits": {
                  Row: {
                    "color": string,"completions": NonNullable<Json>,"created_at": string | null,"description": string | null,"estimated_time": number,"frequency": string,"icon": string,"id": string,"name": string,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"completions"?: NonNullable<Json>,"created_at"?: string | null,"description"?: string | null,"estimated_time"?: number,"frequency"?: string,"icon"?: string,"id"?: string,"name": string,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "color"?: string,"completions"?: NonNullable<Json>,"created_at"?: string | null,"description"?: string | null,"estimated_time"?: number,"frequency"?: string,"icon"?: string,"id"?: string,"name"?: string,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"key_results": {
                  Row: {
                    "completed": boolean,"completed_at": string | null,"created_at": string | null,"current_value": number,"estimated_time": number,"id": string,"okr_id": string,"target_value": number,"title": string,"unit": string,"updated_at": string | null,"user_id": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "completed"?: boolean,"completed_at"?: string | null,"created_at"?: string | null,"current_value"?: number,"estimated_time"?: number,"id"?: string,"okr_id": string,"target_value"?: number,"title": string,"unit"?: string,"updated_at"?: string | null,"user_id": string,"weight"?: number
                  }
                  Update: {
                    "completed"?: boolean,"completed_at"?: string | null,"created_at"?: string | null,"current_value"?: number,"estimated_time"?: number,"id"?: string,"okr_id"?: string,"target_value"?: number,"title"?: string,"unit"?: string,"updated_at"?: string | null,"user_id"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "key_results_okr_id_fkey"
      columns: ["okr_id"]
isOneToOne: false
      referencedRelation: "okrs"
      referencedColumns: ["id"]
    }
                  ]
                },"kr_completions": {
                  Row: {
                    "completed_at": string,"created_at": string | null,"id": string,"kr_id": string,"kr_title": string,"okr_id": string,"okr_title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"created_at"?: string | null,"id"?: string,"kr_id": string,"kr_title"?: string,"okr_id": string,"okr_title"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string,"created_at"?: string | null,"id"?: string,"kr_id"?: string,"kr_title"?: string,"okr_id"?: string,"okr_title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kr_completions_kr_id_fkey"
      columns: ["kr_id"]
isOneToOne: false
      referencedRelation: "key_results"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kr_completions_okr_id_fkey"
      columns: ["okr_id"]
isOneToOne: false
      referencedRelation: "okrs"
      referencedColumns: ["id"]
    }
                  ]
                },"lists": {
                  Row: {
                    "color": string,"created_at": string | null,"id": string,"is_default": boolean,"name": string,"position": number | null,"smart_rule": string | null,"task_ids": (string)[],"type": string,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string | null,"id"?: string,"is_default"?: boolean,"name": string,"position"?: number | null,"smart_rule"?: string | null,"task_ids"?: (string)[],"type"?: string,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string | null,"id"?: string,"is_default"?: boolean,"name"?: string,"position"?: number | null,"smart_rule"?: string | null,"task_ids"?: (string)[],"type"?: string,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"okrs": {
                  Row: {
                    "category": string | null,"completed": boolean,"created_at": string | null,"description": string,"end_date": string,"id": string,"key_results": NonNullable<Json>,"progress": number,"start_date": string,"title": string,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"completed"?: boolean,"created_at"?: string | null,"description"?: string,"end_date": string,"id"?: string,"key_results"?: NonNullable<Json>,"progress"?: number,"start_date": string,"title": string,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "category"?: string | null,"completed"?: boolean,"created_at"?: string | null,"description"?: string,"end_date"?: string,"id"?: string,"key_results"?: NonNullable<Json>,"progress"?: number,"start_date"?: string,"title"?: string,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "okrs_category_fkey"
      columns: ["category"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"org_activity_reports": {
                  Row: {
                    "day": string,"generated_at": string,"id": string,"org_id": string,"payload": NonNullable<Json>,"scope": string,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"generated_at"?: string,"id"?: string,"org_id": string,"payload": NonNullable<Json>,"scope": string,"team_id"?: string | null
                  }
                  Update: {
                    "day"?: string,"generated_at"?: string,"id"?: string,"org_id"?: string,"payload"?: NonNullable<Json>,"scope"?: string,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_activity_reports_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_activity_reports_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "org_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"org_audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": string,"meta": Json | null,"org_id": string,"target_id": string | null,"target_type": string,"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: string,"meta"?: Json | null,"org_id": string,"target_id"?: string | null,"target_type": string,"target_user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: string,"meta"?: Json | null,"org_id"?: string,"target_id"?: string | null,"target_type"?: string,"target_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_audit_log_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_billing_contacts": {
                  Row: {
                    "email": string,"name": string | null,"org_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string,"name"?: string | null,"org_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "email"?: string,"name"?: string | null,"org_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_billing_contacts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"declined_at": string | null,"id": string,"invitee_id": string,"inviter_id": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"declined_at"?: string | null,"id"?: string,"invitee_id": string,"inviter_id": string,"org_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"declined_at"?: string | null,"id"?: string,"invitee_id"?: string,"inviter_id"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_invitations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_invite_links": {
                  Row: {
                    "access_days": number | null,"claimed_at": string | null,"claimed_by": string | null,"created_at": string,"created_by": string,"email": string | null,"expires_at": string,"id": string,"last_sent_at": string | null,"manager_id": string | null,"org_id": string,"sent_count": number,"team_ids": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "access_days"?: number | null,"claimed_at"?: string | null,"claimed_by"?: string | null,"created_at"?: string,"created_by"?: string,"email"?: string | null,"expires_at"?: string,"id"?: string,"last_sent_at"?: string | null,"manager_id"?: string | null,"org_id": string,"sent_count"?: number,"team_ids"?: (string)[]
                  }
                  Update: {
                    "access_days"?: number | null,"claimed_at"?: string | null,"claimed_by"?: string | null,"created_at"?: string,"created_by"?: string,"email"?: string | null,"expires_at"?: string,"id"?: string,"last_sent_at"?: string | null,"manager_id"?: string | null,"org_id"?: string,"sent_count"?: number,"team_ids"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_invite_links_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_member_permissions": {
                  Row: {
                    "assign_targets": (string)[] | null,"can_create_okr": boolean | null,"can_create_project": boolean | null,"can_create_task": boolean | null,"can_create_team": boolean | null,"can_delete_okr": boolean | null,"can_delete_project": boolean | null,"can_delete_task": boolean | null,"can_edit_any_task": boolean | null,"can_edit_project": boolean | null,"can_invite_member": boolean | null,"can_manage_category": boolean | null,"can_manage_roles": boolean | null,"can_view_all_team_reports": boolean | null,"can_view_org_report": boolean | null,"org_id": string,"updated_at": string,"updated_by": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assign_targets"?: (string)[] | null,"can_create_okr"?: boolean | null,"can_create_project"?: boolean | null,"can_create_task"?: boolean | null,"can_create_team"?: boolean | null,"can_delete_okr"?: boolean | null,"can_delete_project"?: boolean | null,"can_delete_task"?: boolean | null,"can_edit_any_task"?: boolean | null,"can_edit_project"?: boolean | null,"can_invite_member"?: boolean | null,"can_manage_category"?: boolean | null,"can_manage_roles"?: boolean | null,"can_view_all_team_reports"?: boolean | null,"can_view_org_report"?: boolean | null,"org_id": string,"updated_at"?: string,"updated_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "assign_targets"?: (string)[] | null,"can_create_okr"?: boolean | null,"can_create_project"?: boolean | null,"can_create_task"?: boolean | null,"can_create_team"?: boolean | null,"can_delete_okr"?: boolean | null,"can_delete_project"?: boolean | null,"can_delete_task"?: boolean | null,"can_edit_any_task"?: boolean | null,"can_edit_project"?: boolean | null,"can_invite_member"?: boolean | null,"can_manage_category"?: boolean | null,"can_manage_roles"?: boolean | null,"can_view_all_team_reports"?: boolean | null,"can_view_org_report"?: boolean | null,"org_id"?: string,"updated_at"?: string,"updated_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_member_permissions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_member_roles": {
                  Row: {
                    "created_at": string,"ends_at": string | null,"expiry_notified_at": string | null,"granted_by": string | null,"id": string,"org_id": string,"role_id": string,"starts_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at"?: string | null,"expiry_notified_at"?: string | null,"granted_by"?: string | null,"id"?: string,"org_id": string,"role_id": string,"starts_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string | null,"expiry_notified_at"?: string | null,"granted_by"?: string | null,"id"?: string,"org_id"?: string,"role_id"?: string,"starts_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_member_roles_member_fkey"
      columns: ["org_id","user_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["org_id","user_id"]
    },{
      foreignKeyName: "org_member_roles_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "org_roles"
      referencedColumns: ["id"]
    }
                  ]
                },"org_notification_settings": {
                  Row: {
                    "digest": string,"email_kinds": (string)[],"muted_kinds": (string)[],"org_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "digest"?: string,"email_kinds"?: (string)[],"muted_kinds"?: (string)[],"org_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "digest"?: string,"email_kinds"?: (string)[],"muted_kinds"?: (string)[],"org_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_notification_settings_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_notifications": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"emailed_at": string | null,"event_id": string | null,"id": string,"kind": string,"kr_id": string | null,"meta": Json | null,"org_id": string,"project_id": string | null,"read_at": string | null,"task_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"emailed_at"?: string | null,"event_id"?: string | null,"id"?: string,"kind": string,"kr_id"?: string | null,"meta"?: Json | null,"org_id": string,"project_id"?: string | null,"read_at"?: string | null,"task_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"emailed_at"?: string | null,"event_id"?: string | null,"id"?: string,"kind"?: string,"kr_id"?: string | null,"meta"?: Json | null,"org_id"?: string,"project_id"?: string | null,"read_at"?: string | null,"task_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_notifications_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_notifications_kr_id_fkey"
      columns: ["kr_id"]
isOneToOne: false
      referencedRelation: "team_key_results"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_notifications_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_notifications_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "team_projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_notifications_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "team_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"org_roles": {
                  Row: {
                    "assign_targets": (string)[],"color": string,"created_at": string,"created_by": string | null,"granted_keys": (string)[],"id": string,"name": string,"org_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assign_targets"?: (string)[],"color": string,"created_at"?: string,"created_by"?: string | null,"granted_keys"?: (string)[],"id"?: string,"name": string,"org_id": string,"updated_at"?: string
                  }
                  Update: {
                    "assign_targets"?: (string)[],"color"?: string,"created_at"?: string,"created_by"?: string | null,"granted_keys"?: (string)[],"id"?: string,"name"?: string,"org_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_roles_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_saved_views": {
                  Row: {
                    "created_at": string,"filters": NonNullable<Json>,"id": string,"name": string,"org_id": string,"scope": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"filters"?: NonNullable<Json>,"id"?: string,"name": string,"org_id": string,"scope": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"filters"?: NonNullable<Json>,"id"?: string,"name"?: string,"org_id"?: string,"scope"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_saved_views_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_seat_alerts": {
                  Row: {
                    "id": number,"org_id": string | null,"provider_message_id": string | null,"recipient": string | null,"sent_at": string,"tier_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: number,"org_id"?: string | null,"provider_message_id"?: string | null,"recipient"?: string | null,"sent_at"?: string,"tier_key": string
                  }
                  Update: {
                    "id"?: number,"org_id"?: string | null,"provider_message_id"?: string | null,"recipient"?: string | null,"sent_at"?: string,"tier_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_seat_alerts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_settings": {
                  Row: {
                    "default_guest_days": number | null,"default_project_audience": string,"default_role_id": string | null,"default_task_priority": number,"invite_domain_only": boolean,"locale": string,"member_default_perms": (string)[] | null,"org_id": string,"timezone": string,"updated_at": string,"updated_by": string | null,"week_start": number,"work_days": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "default_guest_days"?: number | null,"default_project_audience"?: string,"default_role_id"?: string | null,"default_task_priority"?: number,"invite_domain_only"?: boolean,"locale"?: string,"member_default_perms"?: (string)[] | null,"org_id": string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null,"week_start"?: number,"work_days"?: (number)[]
                  }
                  Update: {
                    "default_guest_days"?: number | null,"default_project_audience"?: string,"default_role_id"?: string | null,"default_task_priority"?: number,"invite_domain_only"?: boolean,"locale"?: string,"member_default_perms"?: (string)[] | null,"org_id"?: string,"timezone"?: string,"updated_at"?: string,"updated_by"?: string | null,"week_start"?: number,"work_days"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_settings_default_role_id_fkey"
      columns: ["default_role_id"]
isOneToOne: false
      referencedRelation: "org_roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_settings_org_id_fkey"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_subscriptions": {
                  Row: {
                    "billing_interval": string,"cancel_at_period_end": boolean,"created_at": string,"current_period_end": string | null,"discount_code": string | null,"max_members": number | null,"org_id": string,"purchased_by": string | null,"renewal_notice_missed_at": string | null,"started_at": string | null,"status": string,"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"tier_key": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_interval"?: string,"cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"discount_code"?: string | null,"max_members"?: number | null,"org_id": string,"purchased_by"?: string | null,"renewal_notice_missed_at"?: string | null,"started_at"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"tier_key"?: string,"updated_at"?: string
                  }
                  Update: {
                    "billing_interval"?: string,"cancel_at_period_end"?: boolean,"created_at"?: string,"current_period_end"?: string | null,"discount_code"?: string | null,"max_members"?: number | null,"org_id"?: string,"purchased_by"?: string | null,"renewal_notice_missed_at"?: string | null,"started_at"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"tier_key"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_subscriptions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_team_members": {
                  Row: {
                    "added_at": string,"added_by": string | null,"is_lead": boolean,"org_id": string,"team_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"added_by"?: string | null,"is_lead"?: boolean,"org_id": string,"team_id": string,"user_id": string
                  }
                  Update: {
                    "added_at"?: string,"added_by"?: string | null,"is_lead"?: boolean,"org_id"?: string,"team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_team_members_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "org_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"org_teams": {
                  Row: {
                    "color": string,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"name": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name": string,"org_id": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_teams_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_verified_domains": {
                  Row: {
                    "created_at": string,"created_by": string | null,"domain": string,"id": string,"last_checked_at": string | null,"org_id": string,"verification_token": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"domain": string,"id"?: string,"last_checked_at"?: string | null,"org_id": string,"verification_token"?: string,"verified_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"domain"?: string,"id"?: string,"last_checked_at"?: string | null,"org_id"?: string,"verification_token"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_verified_domains_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_webhook_deliveries": {
                  Row: {
                    "attempts": number,"created_at": string,"delivered_at": string | null,"event": string,"id": string,"org_id": string,"payload": NonNullable<Json>,"status_code": number | null,"webhook_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"delivered_at"?: string | null,"event": string,"id"?: string,"org_id": string,"payload": NonNullable<Json>,"status_code"?: number | null,"webhook_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"delivered_at"?: string | null,"event"?: string,"id"?: string,"org_id"?: string,"payload"?: NonNullable<Json>,"status_code"?: number | null,"webhook_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_webhook_deliveries_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_webhook_deliveries_webhook_id_fkey"
      columns: ["webhook_id"]
isOneToOne: false
      referencedRelation: "org_webhooks"
      referencedColumns: ["id"]
    }
                  ]
                },"org_webhooks": {
                  Row: {
                    "created_at": string,"created_by": string | null,"enabled": boolean,"events": (string)[],"failure_count": number,"format": string,"id": string,"last_delivery_at": string | null,"last_status": number | null,"name": string,"org_id": string,"secret": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"enabled"?: boolean,"events"?: (string)[],"failure_count"?: number,"format"?: string,"id"?: string,"last_delivery_at"?: string | null,"last_status"?: number | null,"name": string,"org_id": string,"secret"?: string,"url": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"enabled"?: boolean,"events"?: (string)[],"failure_count"?: number,"format"?: string,"id"?: string,"last_delivery_at"?: string | null,"last_status"?: number | null,"name"?: string,"org_id"?: string,"secret"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_webhooks_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_weekly_reviews": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"note": string | null,"org_id": string,"scope_id": string | null,"scope_type": string,"summary": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"org_id": string,"scope_id"?: string | null,"scope_type": string,"summary": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"org_id"?: string,"scope_id"?: string | null,"scope_type"?: string,"summary"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_weekly_reviews_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"org_withdrawals": {
                  Row: {
                    "ack_message_id": string | null,"amount_due_cents": number,"id": string,"org_id": string | null,"recipient": string,"refunded_at": string | null,"refunded_cents": number | null,"reminder_sent_at": string | null,"rule": string,"stripe_invoice_id": string | null,"stripe_subscription_id": string,"user_id": string,"withdrawn_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ack_message_id"?: string | null,"amount_due_cents": number,"id"?: string,"org_id"?: string | null,"recipient": string,"refunded_at"?: string | null,"refunded_cents"?: number | null,"reminder_sent_at"?: string | null,"rule": string,"stripe_invoice_id"?: string | null,"stripe_subscription_id": string,"user_id": string,"withdrawn_at"?: string
                  }
                  Update: {
                    "ack_message_id"?: string | null,"amount_due_cents"?: number,"id"?: string,"org_id"?: string | null,"recipient"?: string,"refunded_at"?: string | null,"refunded_cents"?: number | null,"reminder_sent_at"?: string | null,"rule"?: string,"stripe_invoice_id"?: string | null,"stripe_subscription_id"?: string,"user_id"?: string,"withdrawn_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_withdrawals_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_join_requests": {
                  Row: {
                    "accepted_at": string | null,"id": string,"org_id": string,"rejected_at": string | null,"requested_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"id"?: string,"org_id": string,"rejected_at"?: string | null,"requested_at"?: string,"user_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"id"?: string,"org_id"?: string,"rejected_at"?: string | null,"requested_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_join_requests_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_members": {
                  Row: {
                    "access_expires_at": string | null,"joined_at": string,"manager_id": string | null,"org_id": string,"role": string,"suspended_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_expires_at"?: string | null,"joined_at"?: string,"manager_id"?: string | null,"org_id": string,"role"?: string,"suspended_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "access_expires_at"?: string | null,"joined_at"?: string,"manager_id"?: string | null,"org_id"?: string,"role"?: string,"suspended_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_members_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"description": string | null,"id": string,"industry": string | null,"join_code": string,"name": string,"owner_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"industry"?: string | null,"join_code": string,"name": string,"owner_id": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"industry"?: string | null,"join_code"?: string,"name"?: string,"owner_id"?: string
                  }
                  Relationships: [

                  ]
                },"payment_closures": {
                  Row: {
                    "closure_hash": string,"currency": string,"first_record_id": number | null,"last_record_id": number | null,"last_row_hash": string | null,"period_end": string,"period_start": string,"record_count": number,"sealed_at": string,"total_cents": number
                  }
                  ComputedFields: never
                  Insert: {
                    "closure_hash": string,"currency": string,"first_record_id"?: number | null,"last_record_id"?: number | null,"last_row_hash"?: string | null,"period_end": string,"period_start": string,"record_count": number,"sealed_at"?: string,"total_cents": number
                  }
                  Update: {
                    "closure_hash"?: string,"currency"?: string,"first_record_id"?: number | null,"last_record_id"?: number | null,"last_row_hash"?: string | null,"period_end"?: string,"period_start"?: string,"record_count"?: number,"sealed_at"?: string,"total_cents"?: number
                  }
                  Relationships: [

                  ]
                },"payment_records": {
                  Row: {
                    "amount_cents": number,"currency": string,"event_type": string,"id": number,"occurred_at": string,"org_id": string | null,"payload": NonNullable<Json>,"prev_hash": string | null,"recorded_at": string,"row_hash": string,"stripe_customer_id": string | null,"stripe_event_id": string,"stripe_invoice_id": string | null,"user_id": string | null,"affiliate_process": boolean | null
                  }
                  ComputedFields: "affiliate_process"
                  Insert: {
                    "amount_cents": number,"currency": string,"event_type": string,"id"?: number,"occurred_at": string,"org_id"?: string | null,"payload"?: NonNullable<Json>,"prev_hash"?: string | null,"recorded_at"?: string,"row_hash": string,"stripe_customer_id"?: string | null,"stripe_event_id": string,"stripe_invoice_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "amount_cents"?: number,"currency"?: string,"event_type"?: string,"id"?: number,"occurred_at"?: string,"org_id"?: string | null,"payload"?: NonNullable<Json>,"prev_hash"?: string | null,"recorded_at"?: string,"row_hash"?: string,"stripe_customer_id"?: string | null,"stripe_event_id"?: string,"stripe_invoice_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_records_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"processed_stripe_events": {
                  Row: {
                    "created_at": string,"event_type": string,"id": string,"processed_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": string,"event_type": string,"id": string,"processed_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"event_type"?: string,"id"?: string,"processed_at"?: string
                  }
                  Relationships: [

                  ]
                },"profiles": {
                  Row: {
                    "account_type": string,"acquisition_campaign": string | null,"acquisition_source": string | null,"affiliate_id": string | null,"affiliate_slug": string | null,"affiliated_at": string | null,"avatar_url": string | null,"display_name": string | null,"email": string | null,"id": string,"last_seen_at": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_type"?: string,"acquisition_campaign"?: string | null,"acquisition_source"?: string | null,"affiliate_id"?: string | null,"affiliate_slug"?: string | null,"affiliated_at"?: string | null,"avatar_url"?: string | null,"display_name"?: string | null,"email"?: string | null,"id": string,"last_seen_at"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "account_type"?: string,"acquisition_campaign"?: string | null,"acquisition_source"?: string | null,"affiliate_id"?: string | null,"affiliate_slug"?: string | null,"affiliated_at"?: string | null,"avatar_url"?: string | null,"display_name"?: string | null,"email"?: string | null,"id"?: string,"last_seen_at"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_affiliate_id_fkey"
      columns: ["affiliate_id"]
isOneToOne: false
      referencedRelation: "affiliates"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "bucket_key": string,"hits": number,"updated_at": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_key": string,"hits"?: number,"updated_at"?: string,"window_start"?: string
                  }
                  Update: {
                    "bucket_key"?: string,"hits"?: number,"updated_at"?: string,"window_start"?: string
                  }
                  Relationships: [

                  ]
                },"renewal_notices": {
                  Row: {
                    "channel": string,"id": number,"org_id": string | null,"period_end": string,"provider_message_id": string | null,"recipient": string | null,"sent_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel"?: string,"id"?: number,"org_id"?: string | null,"period_end": string,"provider_message_id"?: string | null,"recipient"?: string | null,"sent_at"?: string
                  }
                  Update: {
                    "channel"?: string,"id"?: number,"org_id"?: string | null,"period_end"?: string,"provider_message_id"?: string | null,"recipient"?: string | null,"sent_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "renewal_notices_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"share_links": {
                  Row: {
                    "created_at": string,"expires_at": string,"id": string,"owner_id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"owner_id": string,"task_id": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"owner_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "share_links_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "share_links_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks_pending_invites"
      referencedColumns: ["id"]
    }
                  ]
                },"shared_lists": {
                  Row: {
                    "accepted_at": string | null,"color": string,"created_at": string,"friend_id": string,"id": string,"name": string,"shared_by": string,"tasks": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"color"?: string,"created_at"?: string,"friend_id": string,"id"?: string,"name": string,"shared_by"?: string,"tasks"?: NonNullable<Json>
                  }
                  Update: {
                    "accepted_at"?: string | null,"color"?: string,"created_at"?: string,"friend_id"?: string,"id"?: string,"name"?: string,"shared_by"?: string,"tasks"?: NonNullable<Json>
                  }
                  Relationships: [

                  ]
                },"shared_tasks": {
                  Row: {
                    "accepted_at": string | null,"created_at": string | null,"friend_id": string,"id": string,"role": string,"shared_at": string | null,"shared_by": string | null,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string | null,"friend_id": string,"id"?: string,"role"?: string,"shared_at"?: string | null,"shared_by"?: string | null,"task_id": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string | null,"friend_id"?: string,"id"?: string,"role"?: string,"shared_at"?: string | null,"shared_by"?: string | null,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shared_tasks_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shared_tasks_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks_pending_invites"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "created_at": string | null,"current_period_end": string | null,"id": string,"plan": string,"status": string,"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"current_period_end"?: string | null,"id"?: string,"plan"?: string,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"current_period_end"?: string | null,"id"?: string,"plan"?: string,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"support_reports": {
                  Row: {
                    "category": string,"first_response_at": string | null,"id": string,"received_at": string,"resolved_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"first_response_at"?: string | null,"id"?: string,"received_at"?: string,"resolved_at"?: string | null
                  }
                  Update: {
                    "category"?: string,"first_response_at"?: string | null,"id"?: string,"received_at"?: string,"resolved_at"?: string | null
                  }
                  Relationships: [

                  ]
                },"task_dependencies": {
                  Row: {
                    "created_at": string,"depends_on_id": string,"task_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"depends_on_id": string,"task_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"depends_on_id"?: string,"task_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_dependencies_depends_on_id_fkey"
      columns: ["depends_on_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_depends_on_id_fkey"
      columns: ["depends_on_id"]
isOneToOne: false
      referencedRelation: "tasks_pending_invites"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks_pending_invites"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "bookmarked": boolean,"category": string | null,"collaborator_validations": Json | null,"completed": boolean,"completed_at": string | null,"created_at": string | null,"deadline": string | null,"description": string | null,"estimated_time": number,"health": string | null,"id": string,"is_collaborative": boolean,"kr_id": string | null,"name": string,"pending_invites": (string)[] | null,"priority": number,"recurrence": string,"recurrence_parent_id": string | null,"status": string,"subtasks": NonNullable<Json>,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bookmarked"?: boolean,"category"?: string | null,"collaborator_validations"?: Json | null,"completed"?: boolean,"completed_at"?: string | null,"created_at"?: string | null,"deadline"?: string | null,"description"?: string | null,"estimated_time"?: number,"health"?: string | null,"id"?: string,"is_collaborative"?: boolean,"kr_id"?: string | null,"name": string,"pending_invites"?: (string)[] | null,"priority"?: number,"recurrence"?: string,"recurrence_parent_id"?: string | null,"status"?: string,"subtasks"?: NonNullable<Json>,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "bookmarked"?: boolean,"category"?: string | null,"collaborator_validations"?: Json | null,"completed"?: boolean,"completed_at"?: string | null,"created_at"?: string | null,"deadline"?: string | null,"description"?: string | null,"estimated_time"?: number,"health"?: string | null,"id"?: string,"is_collaborative"?: boolean,"kr_id"?: string | null,"name"?: string,"pending_invites"?: (string)[] | null,"priority"?: number,"recurrence"?: string,"recurrence_parent_id"?: string | null,"status"?: string,"subtasks"?: NonNullable<Json>,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_category_fkey"
      columns: ["category"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_recurrence_parent_id_fkey"
      columns: ["recurrence_parent_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_recurrence_parent_id_fkey"
      columns: ["recurrence_parent_id"]
isOneToOne: false
      referencedRelation: "tasks_pending_invites"
      referencedColumns: ["id"]
    }
                  ]
                },"team_automations": {
                  Row: {
                    "action_kind": string,"action_value": string,"created_at": string,"created_by": string | null,"enabled": boolean,"id": string,"name": string,"org_id": string,"position": number,"project_id": string | null,"trigger_kind": string,"trigger_value": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action_kind": string,"action_value": string,"created_at"?: string,"created_by"?: string | null,"enabled"?: boolean,"id"?: string,"name": string,"org_id": string,"position"?: number,"project_id"?: string | null,"trigger_kind": string,"trigger_value"?: string | null
                  }
                  Update: {
                    "action_kind"?: string,"action_value"?: string,"created_at"?: string,"created_by"?: string | null,"enabled"?: boolean,"id"?: string,"name"?: string,"org_id"?: string,"position"?: number,"project_id"?: string | null,"trigger_kind"?: string,"trigger_value"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_automations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_automations_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "team_projects"
      referencedColumns: ["id"]
    }
                  ]
                },"team_categories": {
                  Row: {
                    "color": string,"created_at": string,"created_by": string | null,"id": string,"name": string,"org_id": string,"parent_id": string | null,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"org_id": string,"parent_id"?: string | null,"position"?: number
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"org_id"?: string,"parent_id"?: string | null,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_categories_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "team_categories"
      referencedColumns: ["id"]
    }
                  ]
                },"team_key_results": {
                  Row: {
                    "assignee_id": string | null,"completed": boolean,"completed_at": string | null,"contributor_ids": (string)[],"created_at": string,"current_value": number,"estimated_time": number,"health": string | null,"health_updated_at": string | null,"id": string,"okr_id": string,"org_id": string,"progress_mode": string,"target_value": number,"title": string,"unit": string | null,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"completed"?: boolean,"completed_at"?: string | null,"contributor_ids"?: (string)[],"created_at"?: string,"current_value"?: number,"estimated_time"?: number,"health"?: string | null,"health_updated_at"?: string | null,"id"?: string,"okr_id": string,"org_id": string,"progress_mode"?: string,"target_value"?: number,"title": string,"unit"?: string | null,"weight"?: number
                  }
                  Update: {
                    "assignee_id"?: string | null,"completed"?: boolean,"completed_at"?: string | null,"contributor_ids"?: (string)[],"created_at"?: string,"current_value"?: number,"estimated_time"?: number,"health"?: string | null,"health_updated_at"?: string | null,"id"?: string,"okr_id"?: string,"org_id"?: string,"progress_mode"?: string,"target_value"?: number,"title"?: string,"unit"?: string | null,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_key_results_okr_id_fkey"
      columns: ["okr_id"]
isOneToOne: false
      referencedRelation: "team_okrs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_key_results_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"team_kr_checkins": {
                  Row: {
                    "author_id": string | null,"created_at": string,"id": string,"kr_id": string,"note": string | null,"org_id": string,"status": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"id"?: string,"kr_id": string,"note"?: string | null,"org_id": string,"status": string,"value": number
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"id"?: string,"kr_id"?: string,"note"?: string | null,"org_id"?: string,"status"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_kr_checkins_kr_id_fkey"
      columns: ["kr_id"]
isOneToOne: false
      referencedRelation: "team_key_results"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_kr_checkins_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"team_kr_projects": {
                  Row: {
                    "added_at": string,"added_by": string | null,"kr_id": string,"org_id": string,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"added_by"?: string | null,"kr_id": string,"org_id": string,"project_id": string
                  }
                  Update: {
                    "added_at"?: string,"added_by"?: string | null,"kr_id"?: string,"org_id"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_kr_projects_kr_id_fkey"
      columns: ["kr_id"]
isOneToOne: false
      referencedRelation: "team_key_results"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_kr_projects_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_kr_projects_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "team_projects"
      referencedColumns: ["id"]
    }
                  ]
                },"team_labels": {
                  Row: {
                    "color": string,"created_at": string,"created_by": string | null,"id": string,"name": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"org_id": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_labels_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"team_list_tasks": {
                  Row: {
                    "created_at": string,"list_id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"list_id": string,"task_id": string
                  }
                  Update: {
                    "created_at"?: string,"list_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_list_tasks_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "team_lists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_list_tasks_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "team_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"team_lists": {
                  Row: {
                    "color": string,"created_at": string,"created_by": string | null,"id": string,"name": string,"org_id": string,"position": number,"smart_rule": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"org_id": string,"position"?: number,"smart_rule"?: string | null,"type"?: string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"org_id"?: string,"position"?: number,"smart_rule"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_lists_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"team_okr_members": {
                  Row: {
                    "added_at": string,"added_by": string | null,"okr_id": string,"org_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"added_by"?: string | null,"okr_id": string,"org_id": string,"user_id": string
                  }
                  Update: {
                    "added_at"?: string,"added_by"?: string | null,"okr_id"?: string,"org_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_okr_members_member_fkey"
      columns: ["org_id","user_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["org_id","user_id"]
    },{
      foreignKeyName: "team_okr_members_okr_fkey"
      columns: ["okr_id","org_id"]
isOneToOne: false
      referencedRelation: "team_okrs"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"team_okr_teams": {
                  Row: {
                    "added_at": string,"added_by": string | null,"okr_id": string,"org_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"added_by"?: string | null,"okr_id": string,"org_id": string,"team_id": string
                  }
                  Update: {
                    "added_at"?: string,"added_by"?: string | null,"okr_id"?: string,"org_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_okr_teams_okr_id_fkey"
      columns: ["okr_id"]
isOneToOne: false
      referencedRelation: "team_okrs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_okr_teams_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_okr_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "org_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_okrs": {
                  Row: {
                    "audience": string,"category_id": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"end_date": string | null,"id": string,"org_id": string,"parent_okr_id": string | null,"start_date": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"end_date"?: string | null,"id"?: string,"org_id": string,"parent_okr_id"?: string | null,"start_date"?: string | null,"title": string
                  }
                  Update: {
                    "audience"?: string,"category_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"end_date"?: string | null,"id"?: string,"org_id"?: string,"parent_okr_id"?: string | null,"start_date"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_okrs_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "team_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_okrs_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_okrs_parent_okr_id_fkey"
      columns: ["parent_okr_id"]
isOneToOne: false
      referencedRelation: "team_okrs"
      referencedColumns: ["id"]
    }
                  ]
                },"team_project_dependencies": {
                  Row: {
                    "created_at": string,"created_by": string | null,"depends_on_id": string,"org_id": string,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_id": string,"org_id": string,"project_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_id"?: string,"org_id"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_project_dependencies_depends_on_id_fkey"
      columns: ["depends_on_id"]
isOneToOne: false
      referencedRelation: "team_projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_project_dependencies_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_project_dependencies_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "team_projects"
      referencedColumns: ["id"]
    }
                  ]
                },"team_project_followers": {
                  Row: {
                    "created_at": string,"org_id": string,"project_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"org_id": string,"project_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"org_id"?: string,"project_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_project_followers_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_project_followers_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "team_projects"
      referencedColumns: ["id"]
    }
                  ]
                },"team_project_members": {
                  Row: {
                    "added_at": string,"added_by": string | null,"org_id": string,"project_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"added_by"?: string | null,"org_id": string,"project_id": string,"role"?: string,"user_id": string
                  }
                  Update: {
                    "added_at"?: string,"added_by"?: string | null,"org_id"?: string,"project_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_project_members_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_project_members_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "team_projects"
      referencedColumns: ["id"]
    }
                  ]
                },"team_project_messages": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"id": string,"org_id": string,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"org_id": string,"project_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"org_id"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_project_messages_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_project_messages_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "team_projects"
      referencedColumns: ["id"]
    }
                  ]
                },"team_project_statuses": {
                  Row: {
                    "color": string,"created_at": string,"id": string,"maps_to": string,"name": string,"org_id": string,"position": number,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string,"created_at"?: string,"id"?: string,"maps_to": string,"name": string,"org_id": string,"position"?: number,"project_id": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"id"?: string,"maps_to"?: string,"name"?: string,"org_id"?: string,"position"?: number,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_project_statuses_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_project_statuses_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "team_projects"
      referencedColumns: ["id"]
    }
                  ]
                },"team_project_teams": {
                  Row: {
                    "added_at": string,"added_by": string | null,"org_id": string,"project_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"added_by"?: string | null,"org_id": string,"project_id": string,"team_id": string
                  }
                  Update: {
                    "added_at"?: string,"added_by"?: string | null,"org_id"?: string,"project_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_project_teams_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_project_teams_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "team_projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_project_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "org_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_projects": {
                  Row: {
                    "archived_at": string | null,"category_id": string | null,"color": string,"created_at": string,"created_by": string | null,"description": string | null,"due_date": string | null,"health": string | null,"health_note": string | null,"health_updated_at": string | null,"health_updated_by": string | null,"id": string,"is_template": boolean,"name": string,"org_id": string,"owner_id": string | null,"start_date": string | null,"status": string,"team_id": string | null,"template_payload": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"category_id"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"due_date"?: string | null,"health"?: string | null,"health_note"?: string | null,"health_updated_at"?: string | null,"health_updated_by"?: string | null,"id"?: string,"is_template"?: boolean,"name": string,"org_id": string,"owner_id"?: string | null,"start_date"?: string | null,"status"?: string,"team_id"?: string | null,"template_payload"?: Json | null
                  }
                  Update: {
                    "archived_at"?: string | null,"category_id"?: string | null,"color"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"due_date"?: string | null,"health"?: string | null,"health_note"?: string | null,"health_updated_at"?: string | null,"health_updated_by"?: string | null,"id"?: string,"is_template"?: boolean,"name"?: string,"org_id"?: string,"owner_id"?: string | null,"start_date"?: string | null,"status"?: string,"team_id"?: string | null,"template_payload"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_projects_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "team_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_projects_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_projects_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "org_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_task_activity": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"field": string,"id": string,"new_value": string | null,"old_value": string | null,"org_id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"field": string,"id"?: string,"new_value"?: string | null,"old_value"?: string | null,"org_id": string,"task_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"field"?: string,"id"?: string,"new_value"?: string | null,"old_value"?: string | null,"org_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_task_activity_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_task_activity_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "team_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"team_task_comments": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"id": string,"mentions": (string)[],"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"mentions"?: (string)[],"task_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"mentions"?: (string)[],"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_task_comments_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "team_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"team_task_dependencies": {
                  Row: {
                    "created_at": string,"created_by": string | null,"depends_on_id": string,"org_id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_id": string,"org_id": string,"task_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_id"?: string,"org_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_task_dependencies_depends_on_id_fkey"
      columns: ["depends_on_id"]
isOneToOne: false
      referencedRelation: "team_tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_task_dependencies_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_task_dependencies_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "team_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"team_task_followers": {
                  Row: {
                    "created_at": string,"org_id": string,"task_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"org_id": string,"task_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"org_id"?: string,"task_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_task_followers_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_task_followers_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "team_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"team_task_labels": {
                  Row: {
                    "created_at": string,"label_id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"label_id": string,"task_id": string
                  }
                  Update: {
                    "created_at"?: string,"label_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_task_labels_label_id_fkey"
      columns: ["label_id"]
isOneToOne: false
      referencedRelation: "team_labels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_task_labels_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "team_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"team_task_subtasks": {
                  Row: {
                    "completed": boolean,"created_at": string,"created_by": string | null,"id": string,"position": number,"task_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"position"?: number,"task_id": string,"title": string
                  }
                  Update: {
                    "completed"?: boolean,"created_at"?: string,"created_by"?: string | null,"id"?: string,"position"?: number,"task_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_task_subtasks_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "team_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"team_tasks": {
                  Row: {
                    "assignee_ids": (string)[],"category_id": string | null,"completed": boolean,"completed_at": string | null,"created_at": string,"created_by": string | null,"custom_status_id": string | null,"deadline": string | null,"deleted_at": string | null,"deleted_by": string | null,"description": string | null,"estimated_time": number | null,"health": string | null,"id": string,"name": string,"org_id": string,"priority": number,"project_id": string,"start_date": string | null,"status": string,"updated_at": string,"validator_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_ids"?: (string)[],"category_id"?: string | null,"completed"?: boolean,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"custom_status_id"?: string | null,"deadline"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"estimated_time"?: number | null,"health"?: string | null,"id"?: string,"name": string,"org_id": string,"priority"?: number,"project_id": string,"start_date"?: string | null,"status"?: string,"updated_at"?: string,"validator_id"?: string | null
                  }
                  Update: {
                    "assignee_ids"?: (string)[],"category_id"?: string | null,"completed"?: boolean,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"custom_status_id"?: string | null,"deadline"?: string | null,"deleted_at"?: string | null,"deleted_by"?: string | null,"description"?: string | null,"estimated_time"?: number | null,"health"?: string | null,"id"?: string,"name"?: string,"org_id"?: string,"priority"?: number,"project_id"?: string,"start_date"?: string | null,"status"?: string,"updated_at"?: string,"validator_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_tasks_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "team_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_tasks_custom_status_id_fkey"
      columns: ["custom_status_id"]
isOneToOne: false
      referencedRelation: "team_project_statuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_tasks_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "team_projects"
      referencedColumns: ["id"]
    }
                  ]
                },"traffic_hits": {
                  Row: {
                    "browser": string | null,"city": string | null,"country": string | null,"cta": string | null,"device": string | null,"duration_ms": number | null,"id": number,"kind": string,"lang": string | null,"occurred_at": string,"os": string | null,"path": string,"referrer_host": string | null,"region": string | null,"scroll_pct": number | null,"utm_campaign": string | null,"utm_medium": string | null,"utm_source": string | null,"visitor": string
                  }
                  ComputedFields: never
                  Insert: {
                    "browser"?: string | null,"city"?: string | null,"country"?: string | null,"cta"?: string | null,"device"?: string | null,"duration_ms"?: number | null,"id"?: never,"kind": string,"lang"?: string | null,"occurred_at"?: string,"os"?: string | null,"path": string,"referrer_host"?: string | null,"region"?: string | null,"scroll_pct"?: number | null,"utm_campaign"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"visitor": string
                  }
                  Update: {
                    "browser"?: string | null,"city"?: string | null,"country"?: string | null,"cta"?: string | null,"device"?: string | null,"duration_ms"?: number | null,"id"?: never,"kind"?: string,"lang"?: string | null,"occurred_at"?: string,"os"?: string | null,"path"?: string,"referrer_host"?: string | null,"region"?: string | null,"scroll_pct"?: number | null,"utm_campaign"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"visitor"?: string
                  }
                  Relationships: [

                  ]
                },"traffic_salts": {
                  Row: {
                    "day": string,"salt": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"salt": string
                  }
                  Update: {
                    "day"?: string,"salt"?: string
                  }
                  Relationships: [

                  ]
                },"user_activity_days": {
                  Row: {
                    "day": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"user_id": string
                  }
                  Update: {
                    "day"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"withdrawal_consents": {
                  Row: {
                    "billing_interval": string,"consented_at": string,"id": number,"immediate_execution": boolean,"org_id": string | null,"tier_key": string,"user_id": string,"waives_withdrawal": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_interval": string,"consented_at"?: string,"id"?: number,"immediate_execution": boolean,"org_id"?: string | null,"tier_key": string,"user_id": string,"waives_withdrawal": boolean
                  }
                  Update: {
                    "billing_interval"?: string,"consented_at"?: string,"id"?: number,"immediate_execution"?: boolean,"org_id"?: string | null,"tier_key"?: string,"user_id"?: string,"waives_withdrawal"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "withdrawal_consents_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "demo_conversion_stats": {
                  Row: {
                    "conversion_pct": number | null,"converted_users": number | null,"demo_users": number | null
                  }
                  ComputedFields: never
                  Relationships: [

                  ]
                },"tasks_pending_invites": {
                  Row: {
                    "id": string,"pending_invites": (string)[] | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "id"?: string | null,"pending_invites"?: (string)[] | null,"user_id"?: string | null
                         }
                        Update: {
                           "id"?: string | null,"pending_invites"?: (string)[] | null,"user_id"?: string | null
                         }
                        Relationships: [

                  ]
                }
          }
          Functions: {
            "accept_friend_request_v2":
{ Args: { "request_id": string }; Returns: {
              "avatar": string | null,
"created_at": string | null,
"email": string,
"friend_user_id": string | null,
"id": string,
"name": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "friends"
        isOneToOne: true
        isSetofReturn: false
      } },
"accept_shared_task":
{ Args: { "p_task_id": string }; Returns: undefined
                           },
"account_activity":
{ Args: Record<PropertyKey, never>; Returns: {
              "activity_at": string,"email": string,"user_id": string
            }[]
                           },
"account_has_live_billing":
{ Args: { "p_user": string }; Returns: boolean
                           },
"account_inactivity_deletion_due":
{ Args: { "p_user": string }; Returns: boolean
                           },
"accounts_due_for_inactivity_deletion":
{ Args: { "p_limit"?: number }; Returns: {
              "user_id": string
            }[]
                           },
"accounts_due_for_inactivity_notice":
{ Args: { "p_limit"?: number }; Returns: {
              "activity_at": string,"email": string,"user_id": string
            }[]
                           },
"add_task_to_list":
{ Args: { "p_list_id": string,"p_task_id": string }; Returns: {
              "color": string,
"created_at": string | null,
"id": string,
"is_default": boolean,
"name": string,
"position": number | null,
"smart_rule": string | null,
"task_ids": (string)[],
"type": string,
"updated_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "lists"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_allowlisted":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"admin_stats_excluded_uids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"affiliate_attach":
{ Args: { "p_affiliate_id": string,"p_email": string }; Returns: string
                           },
"affiliate_backfill":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"affiliate_compute":
{ Args: { "p_fee_bp": number,"p_fee_fixed": number,"p_gross": number,"p_rate_bp": number,"p_vat_bp": number }; Returns: Record<string, unknown>
                           },
"affiliate_process":
{ Args: { "p_rec": Omit<Database["public"]['Tables']["payment_records"]['Row'], Database["public"]['Tables']["payment_records"]['ComputedFields']> }; Returns: boolean
                           },
"build_org_activity_report":
{ Args: { "p_day": string,"p_org": string,"p_team": string,"p_tz": string }; Returns: Json
                           },
"can_access_team_okr":
{ Args: { "p_okr": string }; Returns: boolean
                           },
"can_access_team_project":
{ Args: { "p_project": string }; Returns: boolean
                           },
"can_access_team_task":
{ Args: { "p_task": string }; Returns: boolean
                           },
"can_assign_to":
{ Args: { "p_org": string,"p_target": string }; Returns: boolean
                           },
"can_edit_team_project":
{ Args: { "p_project": string }; Returns: boolean
                           },
"can_manage_team":
{ Args: { "p_team": string }; Returns: boolean
                           },
"can_manage_team_okr_audience":
{ Args: { "p_okr": string }; Returns: boolean
                           },
"can_restore_team_okr":
{ Args: { "p_deleted_by": string,"p_org": string }; Returns: boolean
                           },
"can_restore_team_task":
{ Args: { "p_deleted_by": string,"p_org": string,"p_project": string }; Returns: boolean
                           },
"claim_acquisition_source":
{ Args: { "p_campaign"?: string,"p_source": string }; Returns: boolean
                           },
"claim_affiliate":
{ Args: { "p_slug": string }; Returns: boolean
                           },
"claim_org_invite":
{ Args: { "p_token": string }; Returns: {
              "org_id": string,"org_name": string
            }[]
                           },
"claim_share_link":
{ Args: { "p_token": string }; Returns: Json
                           },
"consume_email_lookup_quota":
{ Args: { "p_cost": number }; Returns: undefined
                           },
"consume_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window": string }; Returns: boolean
                           },
"create_org_email_invitations":
{ Args: { "p_access_days"?: number,"p_emails": (string)[],"p_manager"?: string,"p_org": string,"p_team_ids"?: (string)[] }; Returns: {
              "email": string,"status": string,"token": string
            }[]
                           },
"create_organization":
{ Args: { "p_name": string }; Returns: {
              "avatar_url": string | null,
"created_at": string,
"description": string | null,
"id": string,
"industry": string | null,
"join_code": string,
"name": string,
"owner_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "organizations"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_profile_for_new_user":
{ Args: { "p_email": string,"p_id": string,"p_meta": Json }; Returns: undefined
                           },
"create_team_project_with_tasks":
{ Args: { "p_milestones"?: Json,"p_org": string,"p_project": Json,"p_tasks"?: Json }; Returns: string
                           },
"cron_invoke":
{ Args: { "p_job": string }; Returns: number
                           },
"cron_lease_acquire":
{ Args: { "p_job": string,"p_ttl_seconds": number }; Returns: string
                           },
"cron_lease_release":
{ Args: { "p_job": string,"p_token": string }; Returns: boolean
                           },
"cron_run_status":
{ Args: { "p_http_code": number,"p_timed_out": boolean }; Returns: string
                           },
"cron_runs_close":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"cron_runs_verdict":
{ Args: { "p_now"?: string }; Returns: {
              "dernier_code": number,"dernier_debut": string,"dernier_ok": string,"dernier_statut": string,"fenetre": string,"job": string,"verdict": string
            }[]
                           },
"delete_organization":
{ Args: { "p_org": string }; Returns: undefined
                           },
"delete_team_with_transfer":
{ Args: { "p_archive_projects"?: boolean,"p_target": string,"p_team": string }; Returns: undefined
                           },
"enqueue_team_task_webhook":
{ Args: { "p_event": string,"p_task": string }; Returns: undefined
                           },
"expire_org_member_roles":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"generate_due_activity_reports":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"generate_join_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"get_admin_onboarding_funnel":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"get_admin_revenue":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"get_admin_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_admin_traffic":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"get_incoming_request_senders":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_url": string,"display_name": string,"request_id": string,"sender_id": string
            }[]
                           },
"get_my_habits":
{ Args: { "p_days"?: number,"p_today"?: string }; Returns: {
              "color": string,"completions": Json,"completions_total": number,"created_at": string,"description": string,"estimated_time": number,"first_completion_date": string,"frequency": string,"icon": string,"id": string,"name": string,"streak_best": number,"streak_current": number,"user_id": string,"window_days": number
            }[]
                           },
"get_my_org_inbox":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_my_org_invitations":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"id": string,"inviter_id": string,"inviter_name": string,"org_id": string,"org_name": string
            }[]
                           },
"get_my_org_removal_notices":
{ Args: Record<PropertyKey, never>; Returns: {
              "actor_name": string,"created_at": string,"id": string,"org_id": string,"org_name": string
            }[]
                           },
"get_my_tasks":
{ Args: Record<PropertyKey, never>; Returns: {
              "bookmarked": boolean,
"category": string | null,
"collaborator_validations": Json | null,
"completed": boolean,
"completed_at": string | null,
"created_at": string | null,
"deadline": string | null,
"description": string | null,
"estimated_time": number,
"health": string | null,
"id": string,
"is_collaborative": boolean,
"kr_id": string | null,
"name": string,
"pending_invites": (string)[] | null,
"priority": number,
"recurrence": string,
"recurrence_parent_id": string | null,
"status": string,
"subtasks": NonNullable<Json>,
"updated_at": string | null,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_my_team_kr_projects":
{ Args: { "p_org": string }; Returns: {
              "kr_id": string,"project_id": string
            }[]
                           },
"get_my_team_project_dependencies":
{ Args: { "p_org": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"depends_on_id": string,
"org_id": string,
"project_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "team_project_dependencies"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_my_team_project_members":
{ Args: { "p_org": string }; Returns: {
              "added_at": string,
"added_by": string | null,
"org_id": string,
"project_id": string,
"role": string,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "team_project_members"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_my_team_project_progress":
{ Args: { "p_org": string }; Returns: {
              "done": number,"project_id": string,"total": number
            }[]
                           },
"get_my_team_projects":
{ Args: { "p_org": string }; Returns: {
              "archived_at": string | null,
"category_id": string | null,
"color": string,
"created_at": string,
"created_by": string | null,
"description": string | null,
"due_date": string | null,
"health": string | null,
"health_note": string | null,
"health_updated_at": string | null,
"health_updated_by": string | null,
"id": string,
"is_template": boolean,
"name": string,
"org_id": string,
"owner_id": string | null,
"start_date": string | null,
"status": string,
"team_id": string | null,
"template_payload": Json | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "team_projects"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_my_team_task_dependencies":
{ Args: { "p_org": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"depends_on_id": string,
"org_id": string,
"task_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "team_task_dependencies"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_my_team_tasks":
{ Args: { "p_org": string }; Returns: {
              "assignee_ids": (string)[],
"category_id": string | null,
"completed": boolean,
"completed_at": string | null,
"created_at": string,
"created_by": string | null,
"custom_status_id": string | null,
"deadline": string | null,
"deleted_at": string | null,
"deleted_by": string | null,
"description": string | null,
"estimated_time": number | null,
"health": string | null,
"id": string,
"name": string,
"org_id": string,
"priority": number,
"project_id": string,
"start_date": string | null,
"status": string,
"updated_at": string,
"validator_id": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "team_tasks"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_org_billing_history":
{ Args: { "p_org": string }; Returns: {
              "amount_cents": number,"billing_reason": string,"currency": string,"event_type": string,"hosted_invoice_url": string,"id": number,"invoice_number": string,"occurred_at": string
            }[]
                           },
"get_org_email_invitations":
{ Args: { "p_org": string }; Returns: {
              "access_days": number,"claimed_at": string,"created_at": string,"created_by": string,"email": string,"expires_at": string,"last_sent_at": string,"sent_count": number,"team_ids": (string)[],"token": string
            }[]
                           },
"get_org_member_last_activity":
{ Args: { "p_org": string }; Returns: {
              "last_activity_at": string,"source": string,"user_id": string
            }[]
                           },
"get_pending_shared_tasks":
{ Args: Record<PropertyKey, never>; Returns: {
              "bookmarked": boolean,
"category": string | null,
"collaborator_validations": Json | null,
"completed": boolean,
"completed_at": string | null,
"created_at": string | null,
"deadline": string | null,
"description": string | null,
"estimated_time": number,
"health": string | null,
"id": string,
"is_collaborative": boolean,
"kr_id": string | null,
"name": string,
"pending_invites": (string)[] | null,
"priority": number,
"recurrence": string,
"recurrence_parent_id": string | null,
"status": string,
"subtasks": NonNullable<Json>,
"updated_at": string | null,
"user_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: false
        isSetofReturn: true
      } },
"get_subtree":
{ Args: { "p_org": string,"p_root": string }; Returns: string[]
                           },
"get_support_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_team_deletion_impact":
{ Args: { "p_team": string }; Returns: {
              "active_projects": number,"archived_projects": number,"shared_okrs": number,"sole_okrs": number
            }[]
                           },
"get_team_member_workload":
{ Args: { "p_org": string,"p_today": string }; Returns: {
              "due_7_days": number,"estimated_minutes": number,"open_tasks": number,"overdue": number,"user_id": string
            }[]
                           },
"get_team_okr_trash":
{ Args: { "p_org": string }; Returns: {
              "created_by": string,"deleted_at": string,"deleted_by": string,"id": string,"title": string
            }[]
                           },
"get_team_project_task_stats":
{ Args: { "p_org": string,"p_today": string }; Returns: {
              "completed": number,"in_review": number,"next_deadline": string,"overdue": number,"project_id": string,"total": number
            }[]
                           },
"get_team_trash":
{ Args: { "p_org": string }; Returns: {
              "created_by": string,"deleted_at": string,"deleted_by": string,"id": string,"name": string,"project_id": string
            }[]
                           },
"get_work_time_stats":
{ Args: { "p_ranges": Json,"p_tz"?: string }; Returns: Json
                           },
"habit_day_from_key":
{ Args: { "p_key": string }; Returns: string
                           },
"has_subordinates":
{ Args: { "p_org": string,"p_user": string }; Returns: boolean
                           },
"i_have_subordinates":
{ Args: { "p_org": string }; Returns: boolean
                           },
"insert_kr_checkin_row":
{ Args: { "p_kr": string,"p_note": string,"p_org": string,"p_status": string,"p_value": number }; Returns: undefined
                           },
"invite_friend_to_org":
{ Args: { "p_invitee": string,"p_org": string }; Returns: string
                           },
"is_above":
{ Args: { "p_org": string,"p_user": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_allowed_avatar_url":
{ Args: { "p_url": string }; Returns: boolean
                           },
"is_org_admin":
{ Args: { "p_org": string }; Returns: boolean
                           },
"is_org_manager":
{ Args: { "p_org": string }; Returns: boolean
                           },
"is_org_member":
{ Args: { "p_org": string }; Returns: boolean
                           },
"leave_organization":
{ Args: { "p_org": string }; Returns: undefined
                           },
"manages_user":
{ Args: { "p_user": string }; Returns: boolean
                           },
"member_departure_impact":
{ Args: { "p_org": string,"p_user": string }; Returns: Json
                           },
"my_assign_targets":
{ Args: { "p_org": string }; Returns: (string)[]
                           },
"my_managed_user_ids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"my_org_badge_tasks":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"id": string,"kind": string,"name": string,"org_id": string
            }[]
                           },
"my_org_perm":
{ Args: { "p_key": string,"p_org": string }; Returns: boolean
                           },
"my_project_edit_perm":
{ Args: { "p_org": string }; Returns: boolean
                           },
"my_project_role":
{ Args: { "p_project": string }; Returns: string
                           },
"my_report_perm":
{ Args: { "p_key": string,"p_org": string }; Returns: boolean
                           },
"my_role_assign_targets":
{ Args: { "p_org": string }; Returns: (string)[]
                           },
"my_role_perm":
{ Args: { "p_key": string,"p_org": string }; Returns: boolean
                           },
"my_team_project_ids":
{ Args: { "p_org": string }; Returns: string[]
                           },
"notify_kr_due":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"offboard_org_member":
{ Args: { "p_krs_to"?: string,"p_leads_to"?: string,"p_mode"?: string,"p_org": string,"p_projects_to"?: string,"p_reports_to"?: string,"p_tasks_to"?: string,"p_user": string }; Returns: Json
                           },
"org_admin_count":
{ Args: { "p_org": string }; Returns: number
                           },
"org_member_can_invite":
{ Args: { "p_org": string,"p_user": string }; Returns: boolean
                           },
"org_member_default_perm":
{ Args: { "p_key": string,"p_org": string }; Returns: boolean
                           },
"org_notifications_to_email":
{ Args: { "p_mode": string }; Returns: {
              "actor_name": string,"created_at": string,"email": string,"kind": string,"notification_id": string,"org_id": string,"org_name": string,"project_name": string,"task_name": string,"user_id": string
            }[]
                           },
"org_seats_allowed":
{ Args: { "p_org": string }; Returns: boolean
                           },
"org_webhook_deliveries_due":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,"delivery_id": string,"event": string,"format": string,"payload": Json,"secret": string,"url": string,"webhook_id": string
            }[]
                           },
"orgs_due_for_renewal_notice":
{ Args: { "p_max_days"?: number,"p_min_days"?: number }; Returns: {
              "org_id": string,"org_name": string,"owner_email": string,"period_end": string,"tier_key": string
            }[]
                           },
"orgs_for_seat_alert":
{ Args: Record<PropertyKey, never>; Returns: {
              "member_count": number,"org_id": string,"org_name": string,"owner_email": string,"quota": number,"tier_key": string
            }[]
                           },
"orgs_missing_renewal_notice":
{ Args: Record<PropertyKey, never>; Returns: {
              "org_id": string,"period_end": string
            }[]
                           },
"owns_task":
{ Args: { "p_task_id": string }; Returns: boolean
                           },
"post_kr_checkin":
{ Args: { "p_kr": string,"p_note"?: string,"p_status": string,"p_value": number }; Returns: undefined
                           },
"preview_share_link":
{ Args: { "p_token": string }; Returns: Json
                           },
"prune_declined_org_invitations":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"prune_processed_stripe_events":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"purge_archived_team_project":
{ Args: { "p_project": string }; Returns: undefined
                           },
"purge_expired_email_invitations":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"purge_org_audit_log":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"purge_stale_rate_limits":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"purge_team_okr":
{ Args: { "p_okr": string }; Returns: undefined
                           },
"purge_team_okr_trash":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"purge_team_task":
{ Args: { "p_task": string }; Returns: undefined
                           },
"purge_team_task_trash":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"purge_traffic":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"purge_user_from_team_assignments":
{ Args: { "p_user": string }; Returns: undefined
                           },
"record_demo_conversion":
{ Args: { "p_device_id": string }; Returns: undefined
                           },
"record_demo_visit":
{ Args: { "p_device_id": string }; Returns: undefined
                           },
"record_support_report":
{ Args: { "p_category": string }; Returns: string
                           },
"regenerate_join_code":
{ Args: { "p_org": string }; Returns: string
                           },
"release_member_work":
{ Args: { "p_org": string,"p_user": string }; Returns: undefined
                           },
"remove_friendship":
{ Args: { "p_friend_row_id": string }; Returns: undefined
                           },
"remove_member":
{ Args: { "p_org": string,"p_user": string }; Returns: undefined
                           },
"remove_task_from_list":
{ Args: { "p_list_id": string,"p_task_id": string }; Returns: {
              "color": string,
"created_at": string | null,
"id": string,
"is_default": boolean,
"name": string,
"position": number | null,
"smart_rule": string | null,
"task_ids": (string)[],
"type": string,
"updated_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "lists"
        isOneToOne: true
        isSetofReturn: false
      } },
"request_join_organization":
{ Args: { "p_code": string }; Returns: {
              "org_name": string
            }[]
                           },
"reset_stripe_identifiers":
{ Args: { "p_apply"?: boolean }; Returns: {
              "action": string,"cible": string,"lignes": number
            }[]
                           },
"resolve_profile_by_email":
{ Args: { "p_email": string }; Returns: string
                           },
"resolve_profiles_by_emails":
{ Args: { "p_emails": (string)[] }; Returns: {
              "email": string,"id": string
            }[]
                           },
"respond_join_request":
{ Args: { "p_accept": boolean,"p_request_id": string }; Returns: undefined
                           },
"respond_org_invitation":
{ Args: { "p_accept": boolean,"p_invitation": string }; Returns: undefined
                           },
"restore_team_okr":
{ Args: { "p_okr": string }; Returns: undefined
                           },
"restore_team_task":
{ Args: { "p_task": string }; Returns: undefined
                           },
"run_overdue_reminders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"sanitize_display_name":
{ Args: { "raw": string }; Returns: string
                           },
"seal_payment_period":
{ Args: { "p_month": string }; Returns: {
              "closure_hash": string,
"currency": string,
"first_record_id": number | null,
"last_record_id": number | null,
"last_row_hash": string | null,
"period_end": string,
"period_start": string,
"record_count": number,
"sealed_at": string,
"total_cents": number
            }
                          SetofOptions: {
        from: "*"
        to: "payment_closures"
        isOneToOne: true
        isSetofReturn: false
      } },
"search_org":
{ Args: { "p_limit"?: number,"p_org": string,"p_query": string }; Returns: {
              "detail": string,"id": string,"kind": string,"label": string,"parent_id": string
            }[]
                           },
"set_member_access":
{ Args: { "p_expires_at"?: string,"p_org": string,"p_suspended": boolean,"p_user": string }; Returns: undefined
                           },
"set_member_manager":
{ Args: { "p_manager": string,"p_org": string,"p_user": string }; Returns: undefined
                           },
"set_member_role":
{ Args: { "p_org": string,"p_role": string,"p_user": string }; Returns: undefined
                           },
"set_team_okr_links":
{ Args: { "p_member_ids": (string)[],"p_okr": string,"p_team_ids": (string)[] }; Returns: undefined
                           },
"shares_org_with":
{ Args: { "p_target": string }; Returns: boolean
                           },
"team_project_dependency_would_cycle":
{ Args: { "p_depends_on": string,"p_project": string }; Returns: boolean
                           },
"toggle_habit_completion":
{ Args: { "p_date": string,"p_habit_id": string }; Returns: {
              "color": string,
"completions": NonNullable<Json>,
"created_at": string | null,
"description": string | null,
"estimated_time": number,
"frequency": string,
"icon": string,
"id": string,
"name": string,
"updated_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "habits"
        isOneToOne: true
        isSetofReturn: false
      } },
"toggle_habit_completion_v2":
{ Args: { "p_date": string,"p_days"?: number,"p_habit_id": string,"p_today"?: string }; Returns: {
              "color": string,"completions": Json,"completions_total": number,"created_at": string,"description": string,"estimated_time": number,"first_completion_date": string,"frequency": string,"icon": string,"id": string,"name": string,"streak_best": number,"streak_current": number,"user_id": string,"window_days": number
            }[]
                           },
"toggle_task_bookmark":
{ Args: { "p_task_id": string }; Returns: {
              "bookmarked": boolean,
"category": string | null,
"collaborator_validations": Json | null,
"completed": boolean,
"completed_at": string | null,
"created_at": string | null,
"deadline": string | null,
"description": string | null,
"estimated_time": number,
"health": string | null,
"id": string,
"is_collaborative": boolean,
"kr_id": string | null,
"name": string,
"pending_invites": (string)[] | null,
"priority": number,
"recurrence": string,
"recurrence_parent_id": string | null,
"status": string,
"subtasks": NonNullable<Json>,
"updated_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"toggle_task_complete":
{ Args: { "p_task_id": string }; Returns: {
              "bookmarked": boolean,
"category": string | null,
"collaborator_validations": Json | null,
"completed": boolean,
"completed_at": string | null,
"created_at": string | null,
"deadline": string | null,
"description": string | null,
"estimated_time": number,
"health": string | null,
"id": string,
"is_collaborative": boolean,
"kr_id": string | null,
"name": string,
"pending_invites": (string)[] | null,
"priority": number,
"recurrence": string,
"recurrence_parent_id": string | null,
"status": string,
"subtasks": NonNullable<Json>,
"updated_at": string | null,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"toggle_task_complete_v2":
{ Args: { "p_next_deadline"?: string,"p_task_id": string }; Returns: Json
                           },
"touch_last_seen":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"track_hit":
{ Args: { "p": Json }; Returns: boolean
                           },
"transfer_org_ownership":
{ Args: { "p_new_owner": string,"p_org": string }; Returns: undefined
                           },
"trash_team_okr":
{ Args: { "p_okr": string }; Returns: undefined
                           },
"trash_team_task":
{ Args: { "p_task": string }; Returns: undefined
                           },
"verify_payment_chain":
{ Args: Record<PropertyKey, never>; Returns: {
              "broken_id": number,"expected_hash": string,"stored_hash": string
            }[]
                           },
"write_org_audit":
{ Args: { "p_action": string,"p_meta": Json,"p_org": string,"p_target_id": string,"p_target_type": string,"p_target_user": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {

          }
        }
} as const
