export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approval_read_status: {
        Row: {
          approval_id: string
          archived_at: string | null
          created_at: string
          id: string
          is_archived: boolean
          is_read: boolean
          read_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_id: string
          archived_at?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          read_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_id?: string
          archived_at?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_read?: boolean
          read_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      custom_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string
          section: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          section: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          section?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          subject: string
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          type?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspection_approvals: {
        Row: {
          approval_items: Json
          approved_at: string | null
          approved_by_name: string | null
          client_email: string | null
          client_name: string | null
          client_notes: string | null
          confirmation_sent_at: string | null
          created_at: string
          group_id: string | null
          id: string
          inspection_id: string
          polish_answers: Json | null
          question_answers: Json | null
          status: string
          tc_agreed: boolean
          tc_ip_address: string | null
          tc_user_agent: string | null
          tc_version_url: string | null
          updated_at: string
        }
        Insert: {
          approval_items?: Json
          approved_at?: string | null
          approved_by_name?: string | null
          client_email?: string | null
          client_name?: string | null
          client_notes?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          inspection_id: string
          polish_answers?: Json | null
          question_answers?: Json | null
          status?: string
          tc_agreed?: boolean
          tc_ip_address?: string | null
          tc_user_agent?: string | null
          tc_version_url?: string | null
          updated_at?: string
        }
        Update: {
          approval_items?: Json
          approved_at?: string | null
          approved_by_name?: string | null
          client_email?: string | null
          client_name?: string | null
          client_notes?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          inspection_id?: string
          polish_answers?: Json | null
          question_answers?: Json | null
          status?: string
          tc_agreed?: boolean
          tc_ip_address?: string | null
          tc_user_agent?: string | null
          tc_version_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_approvals_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_questions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          label: string
          render_as_scale: boolean
          required_for_submission: boolean
          show_on_client: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          label: string
          render_as_scale?: boolean
          required_for_submission?: boolean
          show_on_client?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          render_as_scale?: boolean
          required_for_submission?: boolean
          show_on_client?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      inspection_rules: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          job_types: string[]
          section: string
          sort_order: number
          target_question: string
          updated_at: string
        }
        Insert: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          job_types?: string[]
          section: string
          sort_order?: number
          target_question: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          job_types?: string[]
          section?: string
          sort_order?: number
          target_question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_rules_target_question_fkey"
            columns: ["target_question"]
            isOneToOne: false
            referencedRelation: "inspection_questions"
            referencedColumns: ["key"]
          },
        ]
      }
      inspections: {
        Row: {
          bezel_condition: Json | null
          bracelet_condition: Json | null
          case_condition: Json | null
          created_at: string
          created_by: string | null
          crown_condition: Json | null
          crystal_condition: Json | null
          department_tag: string | null
          dial_condition: Json | null
          hands_condition: Json | null
          id: string
          inspection_number: string | null
          inspection_type: string
          job_type: string
          job_types: string[]
          notes: string | null
          pricing_details: Json | null
          status: string
          total_estimate: number | null
          updated_at: string
          use_html_email: boolean
          waiver_required: boolean | null
          waiver_signed: boolean | null
          watch_id: string
        }
        Insert: {
          bezel_condition?: Json | null
          bracelet_condition?: Json | null
          case_condition?: Json | null
          created_at?: string
          created_by?: string | null
          crown_condition?: Json | null
          crystal_condition?: Json | null
          department_tag?: string | null
          dial_condition?: Json | null
          hands_condition?: Json | null
          id?: string
          inspection_number?: string | null
          inspection_type: string
          job_type?: string
          job_types?: string[]
          notes?: string | null
          pricing_details?: Json | null
          status?: string
          total_estimate?: number | null
          updated_at?: string
          use_html_email?: boolean
          waiver_required?: boolean | null
          waiver_signed?: boolean | null
          watch_id: string
        }
        Update: {
          bezel_condition?: Json | null
          bracelet_condition?: Json | null
          case_condition?: Json | null
          created_at?: string
          created_by?: string | null
          crown_condition?: Json | null
          crystal_condition?: Json | null
          department_tag?: string | null
          dial_condition?: Json | null
          hands_condition?: Json | null
          id?: string
          inspection_number?: string | null
          inspection_type?: string
          job_type?: string
          job_types?: string[]
          notes?: string | null
          pricing_details?: Json | null
          status?: string
          total_estimate?: number | null
          updated_at?: string
          use_html_email?: boolean
          waiver_required?: boolean | null
          waiver_signed?: boolean | null
          watch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "watches"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          job_id: string
          job_type: string | null
          new_status: string
          previous_status: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          job_id: string
          job_type?: string | null
          new_status: string
          previous_status?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          job_id?: string
          job_type?: string | null
          new_status?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_status_changes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_watchmaker: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          custom_tasks: Json | null
          due_date: string | null
          estimate_number: string | null
          estimated_cost: number | null
          finished_date: string | null
          id: string
          in_testing_at: string | null
          inspection_id: string | null
          intake_date: string | null
          is_movement_service: boolean | null
          last_update_email_sent: string | null
          needs_liability_waiver: boolean | null
          notes: string | null
          outsourced_tasks: Json | null
          parts_approval_needed: boolean | null
          parts_approval_status: string | null
          parts_details: string | null
          parts_requests: Json | null
          repair_tasks: Json | null
          sent_email_templates: Json | null
          serial_number: string | null
          service_type: string | null
          services: Json | null
          status: string
          uncased_at: string | null
          updated_at: string
          used_parts: Json | null
          waiver_reason: string | null
          waiver_signed: boolean | null
          watch_brand: string | null
          watch_model: string | null
          work_started: boolean | null
          work_started_at: string | null
        }
        Insert: {
          assigned_watchmaker?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          custom_tasks?: Json | null
          due_date?: string | null
          estimate_number?: string | null
          estimated_cost?: number | null
          finished_date?: string | null
          id?: string
          in_testing_at?: string | null
          inspection_id?: string | null
          intake_date?: string | null
          is_movement_service?: boolean | null
          last_update_email_sent?: string | null
          needs_liability_waiver?: boolean | null
          notes?: string | null
          outsourced_tasks?: Json | null
          parts_approval_needed?: boolean | null
          parts_approval_status?: string | null
          parts_details?: string | null
          parts_requests?: Json | null
          repair_tasks?: Json | null
          sent_email_templates?: Json | null
          serial_number?: string | null
          service_type?: string | null
          services?: Json | null
          status?: string
          uncased_at?: string | null
          updated_at?: string
          used_parts?: Json | null
          waiver_reason?: string | null
          waiver_signed?: boolean | null
          watch_brand?: string | null
          watch_model?: string | null
          work_started?: boolean | null
          work_started_at?: string | null
        }
        Update: {
          assigned_watchmaker?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          custom_tasks?: Json | null
          due_date?: string | null
          estimate_number?: string | null
          estimated_cost?: number | null
          finished_date?: string | null
          id?: string
          in_testing_at?: string | null
          inspection_id?: string | null
          intake_date?: string | null
          is_movement_service?: boolean | null
          last_update_email_sent?: string | null
          needs_liability_waiver?: boolean | null
          notes?: string | null
          outsourced_tasks?: Json | null
          parts_approval_needed?: boolean | null
          parts_approval_status?: string | null
          parts_details?: string | null
          parts_requests?: Json | null
          repair_tasks?: Json | null
          sent_email_templates?: Json | null
          serial_number?: string | null
          service_type?: string | null
          services?: Json | null
          status?: string
          uncased_at?: string | null
          updated_at?: string
          used_parts?: Json | null
          waiver_reason?: string | null
          waiver_signed?: boolean | null
          watch_brand?: string | null
          watch_model?: string | null
          work_started?: boolean | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      liability_waivers: {
        Row: {
          additional_components: string | null
          additional_info: string | null
          completed_at: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          dial_defects: boolean | null
          estimate_number: string | null
          hand_defects: boolean | null
          id: string
          job_id: string | null
          reference_number: string | null
          serial_number: string | null
          status: string
          updated_at: string
          waiver_date: string | null
          waiver_number: string | null
          watch_brand: string | null
          watch_model: string | null
        }
        Insert: {
          additional_components?: string | null
          additional_info?: string | null
          completed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          dial_defects?: boolean | null
          estimate_number?: string | null
          hand_defects?: boolean | null
          id?: string
          job_id?: string | null
          reference_number?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          waiver_date?: string | null
          waiver_number?: string | null
          watch_brand?: string | null
          watch_model?: string | null
        }
        Update: {
          additional_components?: string | null
          additional_info?: string | null
          completed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          dial_defects?: boolean | null
          estimate_number?: string | null
          hand_defects?: boolean | null
          id?: string
          job_id?: string | null
          reference_number?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          waiver_date?: string | null
          waiver_number?: string | null
          watch_brand?: string | null
          watch_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "liability_waivers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      login_sessions: {
        Row: {
          created_at: string
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          is_current: boolean
          last_active_at: string
          location_info: Json | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean
          last_active_at?: string
          location_info?: Json | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean
          last_active_at?: string
          location_info?: Json | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      model_references: {
        Row: {
          brand: string
          caliber: string | null
          created_at: string
          id: string
          model: string | null
          notes: string | null
          part_number: string
          source: string | null
          updated_at: string
        }
        Insert: {
          brand: string
          caliber?: string | null
          created_at?: string
          id?: string
          model?: string | null
          notes?: string | null
          part_number: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string
          caliber?: string | null
          created_at?: string
          id?: string
          model?: string | null
          notes?: string | null
          part_number?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      note_usage: {
        Row: {
          created_at: string
          id: string
          last_used_at: string
          note: string
          section: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string
          note: string
          section: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string
          note?: string
          section?: string
          usage_count?: number
        }
        Relationships: []
      }
      parts_approvals: {
        Row: {
          approved_at: string | null
          approved_by_name: string | null
          client_email: string | null
          client_name: string | null
          client_notes: string | null
          created_at: string
          id: string
          job_id: string
          parts_items: Json
          status: string
          tc_agreed: boolean
          tc_ip_address: string | null
          tc_user_agent: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_name?: string | null
          client_email?: string | null
          client_name?: string | null
          client_notes?: string | null
          created_at?: string
          id?: string
          job_id: string
          parts_items?: Json
          status?: string
          tc_agreed?: boolean
          tc_ip_address?: string | null
          tc_user_agent?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_name?: string | null
          client_email?: string | null
          client_name?: string | null
          client_notes?: string | null
          created_at?: string
          id?: string
          job_id?: string
          parts_items?: Json
          status?: string
          tc_agreed?: boolean
          tc_ip_address?: string | null
          tc_user_agent?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_approvals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      scanner_settings: {
        Row: {
          auto_process: boolean
          created_at: string
          folder_path: string
          id: string
          poll_interval_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_process?: boolean
          created_at?: string
          folder_path?: string
          id?: string
          poll_interval_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_process?: boolean
          created_at?: string
          folder_path?: string
          id?: string
          poll_interval_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scanner_uploads: {
        Row: {
          created_at: string
          filename: string
          id: string
          processed_at: string | null
          status: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          processed_at?: string | null
          status?: string
          storage_path: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          processed_at?: string | null
          status?: string
          storage_path?: string
        }
        Relationships: []
      }
      scantron_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          storage_path: string
          uploaded_by: string | null
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          storage_path: string
          uploaded_by?: string | null
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          storage_path?: string
          uploaded_by?: string | null
          version?: string
        }
        Relationships: []
      }
      service_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_bracelet: boolean
          is_movement_service: boolean
          job_type: string
          label: string
          sort_order: number
          updated_at: string
          weeks: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_bracelet?: boolean
          is_movement_service?: boolean
          job_type: string
          label: string
          sort_order?: number
          updated_at?: string
          weeks?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_bracelet?: boolean
          is_movement_service?: boolean
          job_type?: string
          label?: string
          sort_order?: number
          updated_at?: string
          weeks?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_security: {
        Row: {
          created_at: string
          id: string
          login_notification_enabled: boolean
          pin_hash: string | null
          session_timeout_minutes: number
          totp_enabled: boolean
          totp_secret: string | null
          totp_verified: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          login_notification_enabled?: boolean
          pin_hash?: string | null
          session_timeout_minutes?: number
          totp_enabled?: boolean
          totp_secret?: string | null
          totp_verified?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          login_notification_enabled?: boolean
          pin_hash?: string | null
          session_timeout_minutes?: number
          totp_enabled?: boolean
          totp_secret?: string | null
          totp_verified?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watches: {
        Row: {
          brand: string
          created_at: string
          customer_id: string
          estimate_number: string
          id: string
          model: string | null
          reference_number: string | null
          target_date: string | null
          updated_at: string
        }
        Insert: {
          brand: string
          created_at?: string
          customer_id: string
          estimate_number: string
          id?: string
          model?: string | null
          reference_number?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string
          created_at?: string
          customer_id?: string
          estimate_number?: string
          id?: string
          model?: string | null
          reference_number?: string | null
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watches_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      watchmakers: {
        Row: {
          created_at: string
          id: string
          initials: string
          is_active: boolean
          name: string
          updated_at: string
          weekly_target: number
          weekly_testing_target: number
        }
        Insert: {
          created_at?: string
          id?: string
          initials: string
          is_active?: boolean
          name: string
          updated_at?: string
          weekly_target?: number
          weekly_testing_target?: number
        }
        Update: {
          created_at?: string
          id?: string
          initials?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          weekly_target?: number
          weekly_testing_target?: number
        }
        Relationships: []
      }
      wiki_articles: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          sort_order: number
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_parts_request:
        | { Args: { _job_id: string; _parts_requests: Json }; Returns: boolean }
        | {
            Args: {
              _job_id: string
              _job_status?: string
              _parts_approval_status?: string
              _parts_requests: Json
            }
            Returns: boolean
          }
      assign_watchmaker: {
        Args: { _assigned_watchmaker: string; _job_id: string }
        Returns: boolean
      }
      can_edit_data: { Args: { _user_id: string }; Returns: boolean }
      can_manage_users: { Args: { _user_id: string }; Returns: boolean }
      generate_parts_request_number: { Args: never; Returns: string }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_job_status: {
        Args: { job_id: string; new_status: string }
        Returns: boolean
      }
      user_has_2fa: { Args: { _user_id: string }; Returns: boolean }
      user_has_pin: { Args: { _user_id: string }; Returns: boolean }
      verify_user_pin: {
        Args: { _pin: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "manager" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "manager", "staff"],
    },
  },
} as const
