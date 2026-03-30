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
      api_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      appraisals: {
        Row: {
          appraisal_date: string
          appraisal_number: string
          appraiser_name: string | null
          appraiser_title: string | null
          bracelet_strap: string | null
          condition: string | null
          created_at: string
          created_by: string | null
          crystal: string | null
          customer_id: string
          dial_features: string | null
          hands: string | null
          id: string
          item_description: string | null
          maker: string | null
          material: string | null
          model_description: string | null
          movement: string | null
          notes: string | null
          photo_url: string | null
          replacement_cost: number | null
          sent_at: string | null
          status: string
          style_number: string | null
          updated_at: string
          watch_id: string | null
        }
        Insert: {
          appraisal_date?: string
          appraisal_number: string
          appraiser_name?: string | null
          appraiser_title?: string | null
          bracelet_strap?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          crystal?: string | null
          customer_id: string
          dial_features?: string | null
          hands?: string | null
          id?: string
          item_description?: string | null
          maker?: string | null
          material?: string | null
          model_description?: string | null
          movement?: string | null
          notes?: string | null
          photo_url?: string | null
          replacement_cost?: number | null
          sent_at?: string | null
          status?: string
          style_number?: string | null
          updated_at?: string
          watch_id?: string | null
        }
        Update: {
          appraisal_date?: string
          appraisal_number?: string
          appraiser_name?: string | null
          appraiser_title?: string | null
          bracelet_strap?: string | null
          condition?: string | null
          created_at?: string
          created_by?: string | null
          crystal?: string | null
          customer_id?: string
          dial_features?: string | null
          hands?: string | null
          id?: string
          item_description?: string | null
          maker?: string | null
          material?: string | null
          model_description?: string | null
          movement?: string | null
          notes?: string | null
          photo_url?: string | null
          replacement_cost?: number | null
          sent_at?: string | null
          status?: string
          style_number?: string | null
          updated_at?: string
          watch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appraisals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appraisals_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "watches"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          attachment_type: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          job_id: string | null
          pressure_test_id: string | null
          timing_test_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          attachment_type?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          job_id?: string | null
          pressure_test_id?: string | null
          timing_test_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          attachment_type?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          job_id?: string | null
          pressure_test_id?: string | null
          timing_test_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_pressure_test_id_fkey"
            columns: ["pressure_test_id"]
            isOneToOne: false
            referencedRelation: "pressure_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_timing_test_id_fkey"
            columns: ["timing_test_id"]
            isOneToOne: false
            referencedRelation: "timing_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          created_at?: string | null
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          created_at?: string | null
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: []
      }
      bins: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location_id: string
          name: string
          qr_code_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          qr_code_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          qr_code_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bins_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_headers: {
        Row: {
          bom_name: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_disassembly: boolean
          parent_part_id: string
          updated_at: string
        }
        Insert: {
          bom_name: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_disassembly?: boolean
          parent_part_id: string
          updated_at?: string
        }
        Update: {
          bom_name?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_disassembly?: boolean
          parent_part_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_headers_parent_part_id_fkey"
            columns: ["parent_part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_headers_parent_part_id_fkey"
            columns: ["parent_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_headers_parent_part_id_fkey"
            columns: ["parent_part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
        ]
      }
      bom_lines: {
        Row: {
          bom_header_id: string
          component_part_id: string
          created_at: string
          id: string
          notes: string | null
          qty: number
          sort_order: number | null
          uom: Database["public"]["Enums"]["uom_type"]
        }
        Insert: {
          bom_header_id: string
          component_part_id: string
          created_at?: string
          id?: string
          notes?: string | null
          qty?: number
          sort_order?: number | null
          uom?: Database["public"]["Enums"]["uom_type"]
        }
        Update: {
          bom_header_id?: string
          component_part_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          qty?: number
          sort_order?: number | null
          uom?: Database["public"]["Enums"]["uom_type"]
        }
        Relationships: [
          {
            foreignKeyName: "bom_lines_bom_header_id_fkey"
            columns: ["bom_header_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_component_part_id_fkey"
            columns: ["component_part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_component_part_id_fkey"
            columns: ["component_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_lines_component_part_id_fkey"
            columns: ["component_part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
        ]
      }
      cache_store: {
        Row: {
          created_at: string
          expires_at: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      caliber_parts: {
        Row: {
          caliber_id: string
          created_at: string
          id: string
          notes: string | null
          part_id: string
          position: string | null
        }
        Insert: {
          caliber_id: string
          created_at?: string
          id?: string
          notes?: string | null
          part_id: string
          position?: string | null
        }
        Update: {
          caliber_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          part_id?: string
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caliber_parts_caliber_id_fkey"
            columns: ["caliber_id"]
            isOneToOne: false
            referencedRelation: "calibers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caliber_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caliber_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caliber_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
        ]
      }
      calibers: {
        Row: {
          brand: string
          caliber_number: string
          created_at: string
          frequency: number | null
          id: string
          is_active: boolean
          jewels: number | null
          movement_type: string | null
          name: string | null
          notes: string | null
          power_reserve_hours: number | null
          updated_at: string
        }
        Insert: {
          brand: string
          caliber_number: string
          created_at?: string
          frequency?: number | null
          id?: string
          is_active?: boolean
          jewels?: number | null
          movement_type?: string | null
          name?: string | null
          notes?: string | null
          power_reserve_hours?: number | null
          updated_at?: string
        }
        Update: {
          brand?: string
          caliber_number?: string
          created_at?: string
          frequency?: number | null
          id?: string
          is_active?: boolean
          jewels?: number | null
          movement_type?: string | null
          name?: string | null
          notes?: string | null
          power_reserve_hours?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      client_property: {
        Row: {
          bin_id: string | null
          brand: string
          created_at: string
          custody_status: string | null
          customer_id: string
          date_received: string
          date_released: string | null
          estimate_id: string | null
          id: string
          intake_date: string | null
          is_in_inventory: boolean
          job_id: string | null
          label_printed: boolean
          label_printed_at: string | null
          model: string | null
          notes: string | null
          reference_number: string | null
          release_date: string | null
          serial_number: string
          updated_at: string
          watch_tag_number: string | null
        }
        Insert: {
          bin_id?: string | null
          brand: string
          created_at?: string
          custody_status?: string | null
          customer_id: string
          date_received?: string
          date_released?: string | null
          estimate_id?: string | null
          id?: string
          intake_date?: string | null
          is_in_inventory?: boolean
          job_id?: string | null
          label_printed?: boolean
          label_printed_at?: string | null
          model?: string | null
          notes?: string | null
          reference_number?: string | null
          release_date?: string | null
          serial_number: string
          updated_at?: string
          watch_tag_number?: string | null
        }
        Update: {
          bin_id?: string | null
          brand?: string
          created_at?: string
          custody_status?: string | null
          customer_id?: string
          date_received?: string
          date_released?: string | null
          estimate_id?: string | null
          id?: string
          intake_date?: string | null
          is_in_inventory?: boolean
          job_id?: string | null
          label_printed?: boolean
          label_printed_at?: string | null
          model?: string | null
          notes?: string | null
          reference_number?: string | null
          release_date?: string | null
          serial_number?: string
          updated_at?: string
          watch_tag_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_property_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_property_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_property_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_property_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_import_staging: {
        Row: {
          applied_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          created_by: string | null
          delta_preview: Json | null
          error_count: number | null
          file_name: string | null
          id: string
          import_type: string
          raw_data: Json | null
          row_count: number | null
          status: string | null
          validation_errors: Json | null
          value_impact: number | null
        }
        Insert: {
          applied_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          delta_preview?: Json | null
          error_count?: number | null
          file_name?: string | null
          id?: string
          import_type: string
          raw_data?: Json | null
          row_count?: number | null
          status?: string | null
          validation_errors?: Json | null
          value_impact?: number | null
        }
        Update: {
          applied_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          delta_preview?: Json | null
          error_count?: number | null
          file_name?: string | null
          id?: string
          import_type?: string
          raw_data?: Json | null
          row_count?: number | null
          status?: string | null
          validation_errors?: Json | null
          value_impact?: number | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address_type: string
          city: string | null
          country: string | null
          created_at: string
          customer_id: string
          id: string
          is_same_as_billing: boolean | null
          state: string | null
          street1: string | null
          street2: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_type: string
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_same_as_billing?: boolean | null
          state?: string | null
          street1?: string | null
          street2?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_type?: string
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_same_as_billing?: boolean | null
          state?: string | null
          street1?: string | null
          street2?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_communication_permissions: {
        Row: {
          consent_email: string | null
          consent_recorded: boolean | null
          consent_recorded_at: string | null
          consent_recorded_by: string | null
          created_at: string
          customer_id: string
          id: string
          updated_at: string
        }
        Insert: {
          consent_email?: string | null
          consent_recorded?: boolean | null
          consent_recorded_at?: string | null
          consent_recorded_by?: string | null
          created_at?: string
          customer_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          consent_email?: string | null
          consent_recorded?: boolean | null
          consent_recorded_at?: string | null
          consent_recorded_by?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_communication_permissions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company_name: string | null
          created_at: string
          display_name: string | null
          email: string | null
          email_normalized: string | null
          first_name: string
          id: string
          internal_notes: string | null
          is_organization: boolean | null
          last_name: string
          middle_name: string | null
          mobile_phone: string | null
          notes: string | null
          parent_customer_id: string | null
          phone: string | null
          phone_normalized: string | null
          qbo_customer_id: string | null
          state: string | null
          suffix: string | null
          title: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_normalized?: string | null
          first_name: string
          id?: string
          internal_notes?: string | null
          is_organization?: boolean | null
          last_name: string
          middle_name?: string | null
          mobile_phone?: string | null
          notes?: string | null
          parent_customer_id?: string | null
          phone?: string | null
          phone_normalized?: string | null
          qbo_customer_id?: string | null
          state?: string | null
          suffix?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_normalized?: string | null
          first_name?: string
          id?: string
          internal_notes?: string | null
          is_organization?: boolean | null
          last_name?: string
          middle_name?: string | null
          mobile_phone?: string | null
          notes?: string | null
          parent_customer_id?: string | null
          phone?: string | null
          phone_normalized?: string | null
          qbo_customer_id?: string | null
          state?: string | null
          suffix?: string | null
          title?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_parent_customer_id_fkey"
            columns: ["parent_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_count_lines: {
        Row: {
          bin_id: string
          counted_at: string | null
          counted_by: string | null
          counted_qty: number | null
          created_at: string
          cycle_count_id: string
          id: string
          notes: string | null
          part_id: string
          system_qty: number
          variance_cost: number | null
          variance_qty: number | null
        }
        Insert: {
          bin_id: string
          counted_at?: string | null
          counted_by?: string | null
          counted_qty?: number | null
          created_at?: string
          cycle_count_id: string
          id?: string
          notes?: string | null
          part_id: string
          system_qty: number
          variance_cost?: number | null
          variance_qty?: number | null
        }
        Update: {
          bin_id?: string
          counted_at?: string | null
          counted_by?: string | null
          counted_qty?: number | null
          created_at?: string
          cycle_count_id?: string
          id?: string
          notes?: string | null
          part_id?: string
          system_qty?: number
          variance_cost?: number | null
          variance_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_count_lines_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_count_lines_cycle_count_id_fkey"
            columns: ["cycle_count_id"]
            isOneToOne: false
            referencedRelation: "cycle_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_count_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_count_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_count_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
        ]
      }
      cycle_counts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bin_id: string | null
          count_date: string
          count_number: string
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          notes: string | null
          posted_at: string | null
          posted_by: string | null
          requires_approval: boolean | null
          status: string
          store_id: string | null
          total_variance_qty: number | null
          total_variance_value: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bin_id?: string | null
          count_date?: string
          count_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          requires_approval?: boolean | null
          status?: string
          store_id?: string | null
          total_variance_qty?: number | null
          total_variance_value?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bin_id?: string | null
          count_date?: string
          count_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          requires_approval?: boolean | null
          status?: string
          store_id?: string | null
          total_variance_qty?: number | null
          total_variance_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_counts_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_counts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_counts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          created_at: string
          description: string
          estimate_id: string
          extended_price: number
          id: string
          internal_cost: number | null
          line_type: string
          notes: string | null
          part_id: string | null
          quantity: number
          service_subcategory_id: string | null
          sort_order: number | null
          taxable: boolean
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          estimate_id: string
          extended_price?: number
          id?: string
          internal_cost?: number | null
          line_type?: string
          notes?: string | null
          part_id?: string | null
          quantity?: number
          service_subcategory_id?: string | null
          sort_order?: number | null
          taxable?: boolean
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          estimate_id?: string
          extended_price?: number
          id?: string
          internal_cost?: number | null
          line_type?: string
          notes?: string | null
          part_id?: string | null
          quantity?: number
          service_subcategory_id?: string | null
          sort_order?: number | null
          taxable?: boolean
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "estimate_line_items_service_subcategory_id_fkey"
            columns: ["service_subcategory_id"]
            isOneToOne: false
            referencedRelation: "service_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_template_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          line_type: string
          part_id: string | null
          quantity: number
          service_subcategory_id: string | null
          sort_order: number | null
          taxable: boolean
          template_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          line_type?: string
          part_id?: string | null
          quantity?: number
          service_subcategory_id?: string | null
          sort_order?: number | null
          taxable?: boolean
          template_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          line_type?: string
          part_id?: string | null
          quantity?: number
          service_subcategory_id?: string | null
          sort_order?: number | null
          taxable?: boolean
          template_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_template_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_template_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_template_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "estimate_template_lines_service_subcategory_id_fkey"
            columns: ["service_subcategory_id"]
            isOneToOne: false
            referencedRelation: "service_subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_template_lines_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "estimate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      estimates: {
        Row: {
          converted_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          estimate_number: string
          id: string
          internal_notes: string | null
          job_id: string | null
          notes: string | null
          sent_at: string | null
          shipping_amount: number | null
          status: Database["public"]["Enums"]["estimate_status"]
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          valid_until: string | null
          watch_id: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          estimate_number: string
          id?: string
          internal_notes?: string | null
          job_id?: string | null
          notes?: string | null
          sent_at?: string | null
          shipping_amount?: number | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
          watch_id?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          estimate_number?: string
          id?: string
          internal_notes?: string | null
          job_id?: string | null
          notes?: string | null
          sent_at?: string | null
          shipping_amount?: number | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
          watch_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "watches"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_requests: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          customer_id: string
          estimate_id: string
          id: string
          notes: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          customer_id: string
          estimate_id: string
          id?: string
          notes?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          customer_id?: string
          estimate_id?: string
          id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_requests_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_leads: {
        Row: {
          awaiting_reply: boolean | null
          created_at: string
          customer_id: string | null
          email: string | null
          full_name: string | null
          id: string
          insured_value: number | null
          is_na: boolean | null
          item_type: string | null
          job_id: string | null
          notes: string | null
          payload_json: Json | null
          phone: string | null
          processed_at: string | null
          processed_by: string | null
          received_at: string
          source: string
          status: string
          updated_at: string
          watch_reference: string | null
          watch_serial: string | null
        }
        Insert: {
          awaiting_reply?: boolean | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          insured_value?: number | null
          is_na?: boolean | null
          item_type?: string | null
          job_id?: string | null
          notes?: string | null
          payload_json?: Json | null
          phone?: string | null
          processed_at?: string | null
          processed_by?: string | null
          received_at?: string
          source?: string
          status?: string
          updated_at?: string
          watch_reference?: string | null
          watch_serial?: string | null
        }
        Update: {
          awaiting_reply?: boolean | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          insured_value?: number | null
          is_na?: boolean | null
          item_type?: string | null
          job_id?: string | null
          notes?: string | null
          payload_json?: Json | null
          phone?: string | null
          processed_at?: string | null
          processed_by?: string | null
          received_at?: string
          source?: string
          status?: string
          updated_at?: string
          watch_reference?: string | null
          watch_serial?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_leads_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjusted_by: string | null
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          bin_id: string
          cost_per_unit: number | null
          created_at: string
          id: string
          part_id: string
          qty_after: number
          qty_before: number
          qty_change: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          total_cost_impact: number | null
        }
        Insert: {
          adjusted_by?: string | null
          adjustment_type: Database["public"]["Enums"]["adjustment_type"]
          bin_id: string
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          part_id: string
          qty_after: number
          qty_before: number
          qty_change: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          total_cost_impact?: number | null
        }
        Update: {
          adjusted_by?: string | null
          adjustment_type?: Database["public"]["Enums"]["adjustment_type"]
          bin_id?: string
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          part_id?: string
          qty_after?: number
          qty_before?: number
          qty_change?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          total_cost_impact?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
        ]
      }
      inventory_moves: {
        Row: {
          created_at: string
          destination_bin_id: string
          id: string
          move_number: string
          moved_at: string
          moved_by: string | null
          notes: string | null
          part_id: string
          qty_moved: number
          source_bin_id: string
        }
        Insert: {
          created_at?: string
          destination_bin_id: string
          id?: string
          move_number: string
          moved_at?: string
          moved_by?: string | null
          notes?: string | null
          part_id: string
          qty_moved?: number
          source_bin_id: string
        }
        Update: {
          created_at?: string
          destination_bin_id?: string
          id?: string
          move_number?: string
          moved_at?: string
          moved_by?: string | null
          notes?: string | null
          part_id?: string
          qty_moved?: number
          source_bin_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_moves_destination_bin_id_fkey"
            columns: ["destination_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_moves_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_moves_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_moves_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "inventory_moves_source_bin_id_fkey"
            columns: ["source_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          bin_id: string
          created_at: string
          id: string
          last_count_date: string | null
          last_count_qty: number | null
          part_id: string
          qty_allocated: number
          qty_on_hand: number
          qty_on_order: number
          updated_at: string
        }
        Insert: {
          bin_id: string
          created_at?: string
          id?: string
          last_count_date?: string | null
          last_count_qty?: number | null
          part_id: string
          qty_allocated?: number
          qty_on_hand?: number
          qty_on_order?: number
          updated_at?: string
        }
        Update: {
          bin_id?: string
          created_at?: string
          id?: string
          last_count_date?: string | null
          last_count_qty?: number | null
          part_id?: string
          qty_allocated?: number
          qty_on_hand?: number
          qty_on_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          completed_date: string | null
          created_at: string
          created_by: string | null
          from_bin_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_bin_id: string
          transfer_date: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          from_bin_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_bin_id: string
          transfer_date?: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          from_bin_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_bin_id?: string
          transfer_date?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_from_bin_id_fkey"
            columns: ["from_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_to_bin_id_fkey"
            columns: ["to_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: []
      }
      job_activity_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          job_id: string
          message: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          job_id: string
          message: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          job_id?: string
          message?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_activity_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          max_attempts: number
          payload: Json
          priority: number
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          scheduled_at?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["job_status"] | null
          id: string
          job_id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_to: string | null
          condition_notes: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          due_date: string | null
          estimate_id: string | null
          estimate_number: string | null
          finished_date: string | null
          id: string
          intake_date: string | null
          intake_notes: string | null
          job_id: string
          priority: Database["public"]["Enums"]["priority_level"]
          quickbooks_invoice_id: string | null
          simple_status: Database["public"]["Enums"]["simple_job_status"] | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          watch_id: string
        }
        Insert: {
          assigned_to?: string | null
          condition_notes?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          due_date?: string | null
          estimate_id?: string | null
          estimate_number?: string | null
          finished_date?: string | null
          id?: string
          intake_date?: string | null
          intake_notes?: string | null
          job_id: string
          priority?: Database["public"]["Enums"]["priority_level"]
          quickbooks_invoice_id?: string | null
          simple_status?:
            | Database["public"]["Enums"]["simple_job_status"]
            | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          watch_id: string
        }
        Update: {
          assigned_to?: string | null
          condition_notes?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          due_date?: string | null
          estimate_id?: string | null
          estimate_number?: string | null
          finished_date?: string | null
          id?: string
          intake_date?: string | null
          intake_notes?: string | null
          job_id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          quickbooks_invoice_id?: string | null
          simple_status?:
            | Database["public"]["Enums"]["simple_job_status"]
            | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          watch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "watches"
            referencedColumns: ["id"]
          },
        ]
      }
      label_prints: {
        Row: {
          id: string
          label_data: Json | null
          label_type: string
          printed_at: string
          printed_by: string | null
          reference_id: string
          reference_type: string
        }
        Insert: {
          id?: string
          label_data?: Json | null
          label_type: string
          printed_at?: string
          printed_by?: string | null
          reference_id: string
          reference_type: string
        }
        Update: {
          id?: string
          label_data?: Json | null
          label_type?: string
          printed_at?: string
          printed_by?: string | null
          reference_id?: string
          reference_type?: string
        }
        Relationships: []
      }
      line_items: {
        Row: {
          category: string | null
          created_at: string
          description: string
          id: string
          internal_cost: number | null
          job_id: string
          notes: string | null
          quantity: number
          taxable: boolean
          unit_price: number
          updated_at: string
          vendor: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          id?: string
          internal_cost?: number | null
          job_id: string
          notes?: string | null
          quantity?: number
          taxable?: boolean
          unit_price?: number
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          internal_cost?: number | null
          job_id?: string
          notes?: string | null
          quantity?: number
          taxable?: boolean
          unit_price?: number
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "line_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string | null
          updated_at?: string
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
      outbound_events: {
        Row: {
          attempts: number
          created_at: string
          event_type: string
          id: string
          job_id: string | null
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          next_attempt_at: string | null
          payload: Json
          reference_id: string | null
          reference_type: string | null
          response_body: string | null
          response_code: number | null
          status: Database["public"]["Enums"]["outbound_event_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_type: string
          id?: string
          job_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          payload: Json
          reference_id?: string | null
          reference_type?: string | null
          response_body?: string | null
          response_code?: number | null
          status?: Database["public"]["Enums"]["outbound_event_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_type?: string
          id?: string
          job_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          payload?: Json
          reference_id?: string | null
          reference_type?: string | null
          response_body?: string | null
          response_code?: number | null
          status?: Database["public"]["Enums"]["outbound_event_status"]
          updated_at?: string
        }
        Relationships: []
      }
      package_scan_logs: {
        Row: {
          carrier: string | null
          created_at: string
          email_sent: boolean | null
          email_sent_at: string | null
          id: string
          matched_customer_id: string | null
          matched_estimate_id: string | null
          notes: string | null
          scanned_at: string
          scanned_by: string | null
          tracking_formatted: string | null
          tracking_number: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          matched_customer_id?: string | null
          matched_estimate_id?: string | null
          notes?: string | null
          scanned_at?: string
          scanned_by?: string | null
          tracking_formatted?: string | null
          tracking_number: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          id?: string
          matched_customer_id?: string | null
          matched_estimate_id?: string | null
          notes?: string | null
          scanned_at?: string
          scanned_by?: string | null
          tracking_formatted?: string | null
          tracking_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_scan_logs_matched_customer_id_fkey"
            columns: ["matched_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_scan_logs_matched_estimate_id_fkey"
            columns: ["matched_estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      part_aliases: {
        Row: {
          alias_sku: string
          alias_type: string
          created_at: string
          id: string
          notes: string | null
          part_id: string
        }
        Insert: {
          alias_sku: string
          alias_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          part_id: string
        }
        Update: {
          alias_sku?: string
          alias_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          part_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "part_aliases_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_aliases_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_aliases_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
        ]
      }
      part_vendor_prices: {
        Row: {
          created_at: string
          id: string
          is_preferred: boolean | null
          last_updated: string | null
          lead_time_days: number | null
          min_order_qty: number | null
          notes: string | null
          part_id: string
          unit_cost: number
          vendor_id: string
          vendor_part_number: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_preferred?: boolean | null
          last_updated?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          notes?: string | null
          part_id: string
          unit_cost?: number
          vendor_id: string
          vendor_part_number?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_preferred?: boolean | null
          last_updated?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          notes?: string | null
          part_id?: string
          unit_cost?: number
          vendor_id?: string
          vendor_part_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "part_vendor_prices_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_vendor_prices_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "part_vendor_prices_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "part_vendor_prices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          average_cost: number | null
          brand: string | null
          caliber_id: string | null
          category: string | null
          created_at: string
          default_bin_id: string | null
          default_sell_price: number | null
          description: string
          highest_cost: number | null
          id: string
          is_active: boolean
          is_serialized: boolean
          item_type: Database["public"]["Enums"]["item_type"]
          last_cost: number | null
          lowest_cost: number | null
          max_qty: number | null
          min_qty: number | null
          notes: string | null
          part_number: string
          qbo_asset_account: string | null
          qbo_cogs_account: string | null
          qbo_income_account: string | null
          qbo_item_id: string | null
          reorder_point: number | null
          reorder_qty: number | null
          subcategory: string | null
          track_lot: boolean
          uom: Database["public"]["Enums"]["uom_type"]
          upc: string | null
          updated_at: string
        }
        Insert: {
          average_cost?: number | null
          brand?: string | null
          caliber_id?: string | null
          category?: string | null
          created_at?: string
          default_bin_id?: string | null
          default_sell_price?: number | null
          description: string
          highest_cost?: number | null
          id?: string
          is_active?: boolean
          is_serialized?: boolean
          item_type?: Database["public"]["Enums"]["item_type"]
          last_cost?: number | null
          lowest_cost?: number | null
          max_qty?: number | null
          min_qty?: number | null
          notes?: string | null
          part_number: string
          qbo_asset_account?: string | null
          qbo_cogs_account?: string | null
          qbo_income_account?: string | null
          qbo_item_id?: string | null
          reorder_point?: number | null
          reorder_qty?: number | null
          subcategory?: string | null
          track_lot?: boolean
          uom?: Database["public"]["Enums"]["uom_type"]
          upc?: string | null
          updated_at?: string
        }
        Update: {
          average_cost?: number | null
          brand?: string | null
          caliber_id?: string | null
          category?: string | null
          created_at?: string
          default_bin_id?: string | null
          default_sell_price?: number | null
          description?: string
          highest_cost?: number | null
          id?: string
          is_active?: boolean
          is_serialized?: boolean
          item_type?: Database["public"]["Enums"]["item_type"]
          last_cost?: number | null
          lowest_cost?: number | null
          max_qty?: number | null
          min_qty?: number | null
          notes?: string | null
          part_number?: string
          qbo_asset_account?: string | null
          qbo_cogs_account?: string | null
          qbo_income_account?: string | null
          qbo_item_id?: string | null
          reorder_point?: number | null
          reorder_qty?: number | null
          subcategory?: string | null
          track_lot?: boolean
          uom?: Database["public"]["Enums"]["uom_type"]
          upc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_caliber_id_fkey"
            columns: ["caliber_id"]
            isOneToOne: false
            referencedRelation: "calibers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_default_bin_id_fkey"
            columns: ["default_bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
        ]
      }
      po_lines: {
        Row: {
          bom_header_id: string | null
          created_at: string
          extended_cost: number
          id: string
          landed_cost_per_unit: number | null
          notes: string | null
          part_id: string
          po_id: string
          qty_ordered: number
          qty_received: number
          sort_order: number | null
          unit_cost: number
        }
        Insert: {
          bom_header_id?: string | null
          created_at?: string
          extended_cost: number
          id?: string
          landed_cost_per_unit?: number | null
          notes?: string | null
          part_id: string
          po_id: string
          qty_ordered: number
          qty_received?: number
          sort_order?: number | null
          unit_cost: number
        }
        Update: {
          bom_header_id?: string | null
          created_at?: string
          extended_cost?: number
          id?: string
          landed_cost_per_unit?: number | null
          notes?: string | null
          part_id?: string
          po_id?: string
          qty_ordered?: number
          qty_received?: number
          sort_order?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_lines_bom_header_id_fkey"
            columns: ["bom_header_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "po_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_receipt_lines: {
        Row: {
          actual_cost: number | null
          bin_id: string
          created_at: string
          id: string
          lot_number: string | null
          notes: string | null
          part_id: string
          po_line_id: string
          qty_received: number
          receipt_id: string
          serial_number: string | null
        }
        Insert: {
          actual_cost?: number | null
          bin_id: string
          created_at?: string
          id?: string
          lot_number?: string | null
          notes?: string | null
          part_id: string
          po_line_id: string
          qty_received: number
          receipt_id: string
          serial_number?: string | null
        }
        Update: {
          actual_cost?: number | null
          bin_id?: string
          created_at?: string
          id?: string
          lot_number?: string | null
          notes?: string | null
          part_id?: string
          po_line_id?: string
          qty_received?: number
          receipt_id?: string
          serial_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_receipt_lines_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_receipt_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_receipt_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_receipt_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "po_receipt_lines_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "po_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "po_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      po_receipts: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          po_id: string
          receipt_date: string
          received_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          po_id: string
          receipt_date?: string
          received_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          po_id?: string
          receipt_date?: string
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pressure_tests: {
        Row: {
          created_at: string
          id: string
          job_id: string
          method: string | null
          notes: string | null
          result_passed: boolean
          target_bar: number | null
          test_date: string
          tested_by: string | null
          tester: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          method?: string | null
          notes?: string | null
          result_passed?: boolean
          target_bar?: number | null
          test_date?: string
          tested_by?: string | null
          tester?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          method?: string | null
          notes?: string | null
          result_passed?: boolean
          target_bar?: number | null
          test_date?: string
          tested_by?: string | null
          tester?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pressure_tests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          allocate_shipping: boolean
          created_at: string
          created_by: string | null
          duty_amount: number | null
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          qbo_bill_id: string | null
          received_date: string | null
          shipping_amount: number | null
          source: string | null
          source_reference: string | null
          status: Database["public"]["Enums"]["po_status"]
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          allocate_shipping?: boolean
          created_at?: string
          created_by?: string | null
          duty_amount?: number | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          qbo_bill_id?: string | null
          received_date?: string | null
          shipping_amount?: number | null
          source?: string | null
          source_reference?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          allocate_shipping?: boolean
          created_at?: string
          created_by?: string | null
          duty_amount?: number | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          qbo_bill_id?: string | null
          received_date?: string | null
          shipping_amount?: number | null
          source?: string | null
          source_reference?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_account_mappings: {
        Row: {
          created_at: string
          id: string
          mapping_key: string
          mapping_label: string
          qbo_account_id: string | null
          qbo_account_name: string | null
          qbo_account_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapping_key: string
          mapping_label: string
          qbo_account_id?: string | null
          qbo_account_name?: string | null
          qbo_account_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mapping_key?: string
          mapping_label?: string
          qbo_account_id?: string | null
          qbo_account_name?: string | null
          qbo_account_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qbo_daily_journal: {
        Row: {
          cogs_credit: number | null
          cogs_debit: number | null
          created_at: string
          entry_count: number | null
          id: string
          inventory_asset_credit: number | null
          inventory_asset_debit: number | null
          journal_date: string
          notes: string | null
          qbo_journal_id: string | null
          synced_at: string | null
          synced_to_qbo: boolean
        }
        Insert: {
          cogs_credit?: number | null
          cogs_debit?: number | null
          created_at?: string
          entry_count?: number | null
          id?: string
          inventory_asset_credit?: number | null
          inventory_asset_debit?: number | null
          journal_date: string
          notes?: string | null
          qbo_journal_id?: string | null
          synced_at?: string | null
          synced_to_qbo?: boolean
        }
        Update: {
          cogs_credit?: number | null
          cogs_debit?: number | null
          created_at?: string
          entry_count?: number | null
          id?: string
          inventory_asset_credit?: number | null
          inventory_asset_debit?: number | null
          journal_date?: string
          notes?: string | null
          qbo_journal_id?: string | null
          synced_at?: string | null
          synced_to_qbo?: boolean
        }
        Relationships: []
      }
      qbo_invoices: {
        Row: {
          balance: number | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_qbo_id: string | null
          doc_number: string | null
          due_date: string | null
          id: string
          invoice_date: string
          is_editable: boolean
          line_items: Json | null
          memo: string | null
          qbo_invoice_id: string
          raw_data: Json | null
          status: string | null
          synced_at: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          balance?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_qbo_id?: string | null
          doc_number?: string | null
          due_date?: string | null
          id?: string
          invoice_date: string
          is_editable?: boolean
          line_items?: Json | null
          memo?: string | null
          qbo_invoice_id: string
          raw_data?: Json | null
          status?: string | null
          synced_at?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          balance?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_qbo_id?: string | null
          doc_number?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          is_editable?: boolean
          line_items?: Json | null
          memo?: string | null
          qbo_invoice_id?: string
          raw_data?: Json | null
          status?: string | null
          synced_at?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qbo_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_sync_log: {
        Row: {
          completed_at: string | null
          environment: string
          error_message: string | null
          id: string
          intuit_tids: string[] | null
          records_created: number | null
          records_skipped: number | null
          records_updated: number | null
          started_at: string
          status: string
          sync_type: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          environment?: string
          error_message?: string | null
          id?: string
          intuit_tids?: string[] | null
          records_created?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          started_at?: string
          status: string
          sync_type: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          environment?: string
          error_message?: string | null
          id?: string
          intuit_tids?: string[] | null
          records_created?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      qbo_tokens: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          created_at: string
          environment: string
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          last_sync_type: string | null
          realm_id: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          environment?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_sync_type?: string | null
          realm_id: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          environment?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_sync_type?: string | null
          realm_id?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      quickbooks_sync_log: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          job_id: string
          request_payload: Json | null
          response_payload: Json | null
          status: string
          synced_by: string | null
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          job_id: string
          request_payload?: Json | null
          response_payload?: Json | null
          status: string
          synced_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status?: string
          synced_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_sync_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      received_webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string
          id: string
          job_id: string | null
          processed_at: string | null
          raw_payload: Json
          received_at: string
          sales_order_id: string | null
          status: Database["public"]["Enums"]["received_webhook_status"]
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type: string
          id?: string
          job_id?: string | null
          processed_at?: string | null
          raw_payload: Json
          received_at?: string
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["received_webhook_status"]
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string
          id?: string
          job_id?: string | null
          processed_at?: string | null
          raw_payload?: Json
          received_at?: string
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["received_webhook_status"]
        }
        Relationships: []
      }
      reorder_suggestions: {
        Row: {
          created_at: string
          current_on_hand: number
          id: string
          part_id: string
          po_id: string | null
          reorder_point: number
          status: string
          suggested_cost: number | null
          suggested_qty: number
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          current_on_hand?: number
          id?: string
          part_id: string
          po_id?: string | null
          reorder_point?: number
          status?: string
          suggested_cost?: number | null
          suggested_qty?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          current_on_hand?: number
          id?: string
          part_id?: string
          po_id?: string | null
          reorder_point?: number
          status?: string
          suggested_cost?: number | null
          suggested_qty?: number
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reorder_suggestions_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_suggestions_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_suggestions_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "reorder_suggestions_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_suggestions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          permission_key: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission_key: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission_key?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_orders: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          job_id: string | null
          notes: string | null
          order_date: string
          qbo_invoice_id: string | null
          ship_date: string | null
          shipping_amount: number | null
          so_number: string
          status: Database["public"]["Enums"]["so_status"]
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          work_completed_sent: boolean
          work_completed_sent_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          job_id?: string | null
          notes?: string | null
          order_date?: string
          qbo_invoice_id?: string | null
          ship_date?: string | null
          shipping_amount?: number | null
          so_number: string
          status?: Database["public"]["Enums"]["so_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          work_completed_sent?: boolean
          work_completed_sent_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          order_date?: string
          qbo_invoice_id?: string | null
          ship_date?: string | null
          shipping_amount?: number | null
          so_number?: string
          status?: Database["public"]["Enums"]["so_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          work_completed_sent?: boolean
          work_completed_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      service_subcategories: {
        Row: {
          category_id: string
          created_at: string
          default_duration_minutes: number | null
          default_price: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          service_code: string
          service_type: Database["public"]["Enums"]["service_type"]
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          default_duration_minutes?: number | null
          default_price?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          service_code: string
          service_type?: Database["public"]["Enums"]["service_type"]
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          default_duration_minutes?: number | null
          default_price?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          service_code?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          cycle_count_qty_threshold: number | null
          cycle_count_value_threshold: number | null
          default_estimate_validity_days: number | null
          default_store_id: string | null
          email: string | null
          id: string
          incoming_webhook_api_key: string | null
          mask_serial_on_print: boolean | null
          next_count_number: number | null
          next_estimate_number: number | null
          next_po_number: number | null
          next_so_number: number | null
          next_transfer_number: number | null
          phone: string | null
          qbo_sync_enabled: boolean | null
          rolliworking_api_key: string | null
          rolliworking_timeout_seconds: number | null
          rolliworking_webhook_url: string | null
          serial_mask_rule: string | null
          shop_time_hourly_rate: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          cycle_count_qty_threshold?: number | null
          cycle_count_value_threshold?: number | null
          default_estimate_validity_days?: number | null
          default_store_id?: string | null
          email?: string | null
          id?: string
          incoming_webhook_api_key?: string | null
          mask_serial_on_print?: boolean | null
          next_count_number?: number | null
          next_estimate_number?: number | null
          next_po_number?: number | null
          next_so_number?: number | null
          next_transfer_number?: number | null
          phone?: string | null
          qbo_sync_enabled?: boolean | null
          rolliworking_api_key?: string | null
          rolliworking_timeout_seconds?: number | null
          rolliworking_webhook_url?: string | null
          serial_mask_rule?: string | null
          shop_time_hourly_rate?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          cycle_count_qty_threshold?: number | null
          cycle_count_value_threshold?: number | null
          default_estimate_validity_days?: number | null
          default_store_id?: string | null
          email?: string | null
          id?: string
          incoming_webhook_api_key?: string | null
          mask_serial_on_print?: boolean | null
          next_count_number?: number | null
          next_estimate_number?: number | null
          next_po_number?: number | null
          next_so_number?: number | null
          next_transfer_number?: number | null
          phone?: string | null
          qbo_sync_enabled?: boolean | null
          rolliworking_api_key?: string | null
          rolliworking_timeout_seconds?: number | null
          rolliworking_webhook_url?: string | null
          serial_mask_rule?: string | null
          shop_time_hourly_rate?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_default_store_id_fkey"
            columns: ["default_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_labels: {
        Row: {
          carrier: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          estimate_id: string | null
          id: string
          insurance_amount: number | null
          label_file_path: string | null
          notes: string | null
          request_line_item_id: string | null
          ship_date: string | null
          status: string | null
          tracking_number: string
          tracking_number_formatted: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          estimate_id?: string | null
          id?: string
          insurance_amount?: number | null
          label_file_path?: string | null
          notes?: string | null
          request_line_item_id?: string | null
          ship_date?: string | null
          status?: string | null
          tracking_number: string
          tracking_number_formatted?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          estimate_id?: string | null
          id?: string
          insurance_amount?: number | null
          label_file_path?: string | null
          notes?: string | null
          request_line_item_id?: string | null
          ship_date?: string | null
          status?: string | null
          tracking_number?: string
          tracking_number_formatted?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_labels_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_labels_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          base_rate: number
          carrier: string
          created_at: string
          id: string
          insurance_rate_per_1000: number
          is_active: boolean
          max_insured_value: number | null
          min_insured_value: number | null
          notes: string | null
          service_name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          base_rate: number
          carrier: string
          created_at?: string
          id?: string
          insurance_rate_per_1000: number
          is_active?: boolean
          max_insured_value?: number | null
          min_insured_value?: number | null
          notes?: string | null
          service_name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          base_rate?: number
          carrier?: string
          created_at?: string
          id?: string
          insurance_rate_per_1000?: number
          is_active?: boolean
          max_insured_value?: number | null
          min_insured_value?: number | null
          notes?: string | null
          service_name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      shop_time_entries: {
        Row: {
          created_at: string
          duration_minutes: number | null
          end_time: string | null
          id: string
          is_manual_entry: boolean
          job_id: string | null
          notes: string | null
          service_subcategory_id: string | null
          start_time: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          is_manual_entry?: boolean
          job_id?: string | null
          notes?: string | null
          service_subcategory_id?: string | null
          start_time?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          is_manual_entry?: boolean
          job_id?: string | null
          notes?: string | null
          service_subcategory_id?: string | null
          start_time?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_time_entries_service_subcategory_id_fkey"
            columns: ["service_subcategory_id"]
            isOneToOne: false
            referencedRelation: "service_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      so_lines: {
        Row: {
          created_at: string
          extended_price: number
          id: string
          notes: string | null
          part_id: string
          qty_allocated: number
          qty_ordered: number
          qty_shipped: number
          so_id: string
          sort_order: number | null
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          extended_price: number
          id?: string
          notes?: string | null
          part_id: string
          qty_allocated?: number
          qty_ordered: number
          qty_shipped?: number
          so_id: string
          sort_order?: number | null
          unit_cost?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          extended_price?: number
          id?: string
          notes?: string | null
          part_id?: string
          qty_allocated?: number
          qty_ordered?: number
          qty_shipped?: number
          so_id?: string
          sort_order?: number | null
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "so_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "so_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "so_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "so_lines_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      timing_tests: {
        Row: {
          amplitude: number | null
          beat_error: number | null
          created_at: string
          id: string
          job_id: string
          lift_angle: number | null
          machine: string | null
          notes: string | null
          position_crown_down_amplitude: number | null
          position_crown_down_rate: number | null
          position_crown_left_amplitude: number | null
          position_crown_left_rate: number | null
          position_crown_right_amplitude: number | null
          position_crown_right_rate: number | null
          position_crown_up_amplitude: number | null
          position_crown_up_rate: number | null
          position_dial_down_amplitude: number | null
          position_dial_down_rate: number | null
          position_dial_up_amplitude: number | null
          position_dial_up_rate: number | null
          rate: number | null
          test_date: string
          tested_by: string | null
        }
        Insert: {
          amplitude?: number | null
          beat_error?: number | null
          created_at?: string
          id?: string
          job_id: string
          lift_angle?: number | null
          machine?: string | null
          notes?: string | null
          position_crown_down_amplitude?: number | null
          position_crown_down_rate?: number | null
          position_crown_left_amplitude?: number | null
          position_crown_left_rate?: number | null
          position_crown_right_amplitude?: number | null
          position_crown_right_rate?: number | null
          position_crown_up_amplitude?: number | null
          position_crown_up_rate?: number | null
          position_dial_down_amplitude?: number | null
          position_dial_down_rate?: number | null
          position_dial_up_amplitude?: number | null
          position_dial_up_rate?: number | null
          rate?: number | null
          test_date?: string
          tested_by?: string | null
        }
        Update: {
          amplitude?: number | null
          beat_error?: number | null
          created_at?: string
          id?: string
          job_id?: string
          lift_angle?: number | null
          machine?: string | null
          notes?: string | null
          position_crown_down_amplitude?: number | null
          position_crown_down_rate?: number | null
          position_crown_left_amplitude?: number | null
          position_crown_left_rate?: number | null
          position_crown_right_amplitude?: number | null
          position_crown_right_rate?: number | null
          position_crown_up_amplitude?: number | null
          position_crown_up_rate?: number | null
          position_dial_down_amplitude?: number | null
          position_dial_down_rate?: number | null
          position_dial_up_amplitude?: number | null
          position_dial_up_rate?: number | null
          rate?: number | null
          test_date?: string
          tested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timing_tests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_lines: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          part_id: string
          qty: number
          transfer_id: string
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          part_id: string
          qty: number
          transfer_id: string
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          part_id?: string
          qty?: number
          transfer_id?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_lines_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "transfer_lines_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_parts: {
        Row: {
          created_at: string
          id: string
          is_preferred: boolean
          last_purchased_at: string | null
          lead_time_days: number | null
          min_order_qty: number | null
          notes: string | null
          part_id: string
          updated_at: string
          vendor_cost: number | null
          vendor_description: string | null
          vendor_id: string
          vendor_pack_qty: number | null
          vendor_part_number: string | null
          vendor_uom: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_preferred?: boolean
          last_purchased_at?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          notes?: string | null
          part_id: string
          updated_at?: string
          vendor_cost?: number | null
          vendor_description?: string | null
          vendor_id: string
          vendor_pack_qty?: number | null
          vendor_part_number?: string | null
          vendor_uom?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_preferred?: boolean
          last_purchased_at?: string | null
          lead_time_days?: number | null
          min_order_qty?: number | null
          notes?: string | null
          part_id?: string
          updated_at?: string
          vendor_cost?: number | null
          vendor_description?: string | null
          vendor_id?: string
          vendor_pack_qty?: number | null
          vendor_part_number?: string | null
          vendor_uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_parts_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "vendor_parts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_price_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          effective_date: string
          id: string
          notes: string | null
          part_id: string | null
          source: string | null
          unit_cost: number
          vendor_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          id?: string
          notes?: string | null
          part_id?: string | null
          source?: string | null
          unit_cost: number
          vendor_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          effective_date?: string
          id?: string
          notes?: string | null
          part_id?: string | null
          source?: string | null
          unit_cost?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_price_history_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "low_stock_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_history_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_price_history_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "total_stock"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "vendor_price_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          lead_time_days: number | null
          min_order_amount: number | null
          min_order_qty: number | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          qbo_vendor_id: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          min_order_amount?: number | null
          min_order_qty?: number | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          qbo_vendor_id?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          min_order_amount?: number | null
          min_order_qty?: number | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          qbo_vendor_id?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          estimate_id: string | null
          follow_up_date: string
          id: string
          notes: string | null
          notified_at: string | null
          service_requested: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          estimate_id?: string | null
          follow_up_date: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          service_requested?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          estimate_id?: string | null
          follow_up_date?: string
          id?: string
          notes?: string | null
          notified_at?: string | null
          service_requested?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      watches: {
        Row: {
          band_material: string | null
          brand: string
          case_material: string | null
          created_at: string
          customer_id: string
          id: string
          model: string | null
          movement_type: string | null
          notes: string | null
          reference_number: string | null
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          band_material?: string | null
          brand: string
          case_material?: string | null
          created_at?: string
          customer_id: string
          id?: string
          model?: string | null
          movement_type?: string | null
          notes?: string | null
          reference_number?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          band_material?: string | null
          brand?: string
          case_material?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          model?: string | null
          movement_type?: string | null
          notes?: string | null
          reference_number?: string | null
          serial_number?: string | null
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
    }
    Views: {
      dashboard_stats: {
        Row: {
          active_vendors_count: number | null
          client_property_count: number | null
          low_stock_count: number | null
          open_po_count: number | null
          open_so_count: number | null
          refreshed_at: string | null
          total_parts: number | null
        }
        Relationships: []
      }
      low_stock_parts: {
        Row: {
          current_qty: number | null
          description: string | null
          id: string | null
          part_number: string | null
          qty_needed: number | null
          reorder_point: number | null
        }
        Relationships: []
      }
      total_stock: {
        Row: {
          average_cost: number | null
          bin_count: number | null
          description: string | null
          part_id: string | null
          part_number: string | null
          total_allocated: number | null
          total_on_order: number | null
          total_qty: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cache_cleanup: { Args: never; Returns: number }
      cache_get: { Args: { p_key: string }; Returns: Json }
      cache_set: {
        Args: { p_key: string; p_ttl_seconds?: number; p_value: Json }
        Returns: undefined
      }
      calculate_shipping_cost: {
        Args: { p_insured_value: number; p_item_type: string }
        Returns: {
          base_rate: number
          carrier: string
          insurance_cost: number
          service_name: string
          total_cost: number
        }[]
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_limit?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      claim_next_job: {
        Args: { p_job_types?: string[] }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          max_attempts: number
          payload: Json
          priority: number
          scheduled_at: string
          started_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "job_queue"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_appraisal_number: { Args: never; Returns: string }
      generate_job_id: { Args: never; Returns: string }
      generate_reorder_suggestions: { Args: never; Returns: number }
      get_next_count_number: { Args: never; Returns: string }
      get_next_estimate_number: { Args: never; Returns: string }
      get_next_job_id: { Args: never; Returns: string }
      get_next_move_number: { Args: never; Returns: string }
      get_next_po_number: { Args: never; Returns: string }
      get_next_so_number: { Args: never; Returns: string }
      get_next_transfer_number: { Args: never; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
      job_id_exists: { Args: { p_job_id: string }; Returns: boolean }
      normalize_email: { Args: { email: string }; Returns: string }
      normalize_phone: { Args: { phone: string }; Returns: string }
      refresh_dashboard_stats: { Args: never; Returns: undefined }
      search_parts: {
        Args: { search_term: string }
        Returns: {
          description: string
          id: string
          match_type: string
          matched_value: string
          part_number: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      adjustment_type:
        | "cycle_count"
        | "shrinkage"
        | "damage"
        | "correction"
        | "disassembly"
        | "assembly"
      app_role: "admin" | "staff" | "manager" | "office"
      custody_status: "in_custody" | "released"
      cycle_count_status:
        | "draft"
        | "in_progress"
        | "submitted"
        | "approved"
        | "posted"
      estimate_status: "draft" | "sent" | "converted" | "expired" | "declined"
      item_type:
        | "inventory"
        | "non_inventory"
        | "service"
        | "client_property"
        | "assembly"
        | "client_watch"
      job_status:
        | "intake"
        | "in_review"
        | "awaiting_customer_approval"
        | "approved"
        | "in_service"
        | "testing"
        | "ready_to_ship"
        | "closed"
      outbound_event_status: "pending" | "sent" | "failed"
      po_status:
        | "draft"
        | "issued"
        | "partial_received"
        | "received"
        | "cancelled"
      priority_level: "low" | "normal" | "high" | "urgent"
      received_webhook_status: "received" | "processed" | "duplicate" | "failed"
      service_type:
        | "watch_service"
        | "bracelet_service"
        | "other_service"
        | "warranty_service"
      simple_job_status: "estimate" | "on_hand" | "finished"
      so_status:
        | "draft"
        | "open"
        | "partial_fulfilled"
        | "fulfilled"
        | "cancelled"
      transfer_status: "pending" | "in_transit" | "completed" | "cancelled"
      uom_type: "ea" | "hr" | "box" | "set" | "lb" | "oz" | "ft" | "in"
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
      adjustment_type: [
        "cycle_count",
        "shrinkage",
        "damage",
        "correction",
        "disassembly",
        "assembly",
      ],
      app_role: ["admin", "staff", "manager", "office"],
      custody_status: ["in_custody", "released"],
      cycle_count_status: [
        "draft",
        "in_progress",
        "submitted",
        "approved",
        "posted",
      ],
      estimate_status: ["draft", "sent", "converted", "expired", "declined"],
      item_type: [
        "inventory",
        "non_inventory",
        "service",
        "client_property",
        "assembly",
        "client_watch",
      ],
      job_status: [
        "intake",
        "in_review",
        "awaiting_customer_approval",
        "approved",
        "in_service",
        "testing",
        "ready_to_ship",
        "closed",
      ],
      outbound_event_status: ["pending", "sent", "failed"],
      po_status: [
        "draft",
        "issued",
        "partial_received",
        "received",
        "cancelled",
      ],
      priority_level: ["low", "normal", "high", "urgent"],
      received_webhook_status: ["received", "processed", "duplicate", "failed"],
      service_type: [
        "watch_service",
        "bracelet_service",
        "other_service",
        "warranty_service",
      ],
      simple_job_status: ["estimate", "on_hand", "finished"],
      so_status: [
        "draft",
        "open",
        "partial_fulfilled",
        "fulfilled",
        "cancelled",
      ],
      transfer_status: ["pending", "in_transit", "completed", "cancelled"],
      uom_type: ["ea", "hr", "box", "set", "lb", "oz", "ft", "in"],
    },
  },
} as const
