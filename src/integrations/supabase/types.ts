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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_billing_lines: {
        Row: {
          client_id: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          is_deleted: boolean
          is_sandbox: boolean
          rate_per_month: number
          sac_code: string | null
          sort_order: number
          unit_label: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          is_sandbox?: boolean
          rate_per_month?: number
          sac_code?: string | null
          sort_order?: number
          unit_label?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          is_sandbox?: boolean
          rate_per_month?: number
          sac_code?: string | null
          sort_order?: number
          unit_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_mw_rates: {
        Row: {
          basic: number
          client_id: string
          created_at: string
          da: number
          designation: string
          effective_from: string
          effective_to: string | null
          epf_mw_wages: number
          esi_mw_wages: number
          id: string
          ta: number
        }
        Insert: {
          basic?: number
          client_id: string
          created_at?: string
          da?: number
          designation: string
          effective_from?: string
          effective_to?: string | null
          epf_mw_wages?: number
          esi_mw_wages?: number
          id?: string
          ta?: number
        }
        Update: {
          basic?: number
          client_id?: string
          created_at?: string
          da?: number
          designation?: string
          effective_from?: string
          effective_to?: string | null
          epf_mw_wages?: number
          esi_mw_wages?: number
          id?: string
          ta?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_mw_rates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_wage_config: {
        Row: {
          basic: number
          bonus_amount: number
          client_id: string
          conveyance_allowance: number
          created_at: string
          created_by: string | null
          da: number
          deleted_at: string | null
          designation: string
          effective_from: string
          effective_to: string | null
          epf_mw_wages: number
          esi_mw_wages: number
          four_hour_ot_rate: number
          id: string
          is_current: boolean
          is_deleted: boolean
          is_sandbox: boolean
          leave_wages: number
          notes: string | null
          payable_gross: number
          relieving_charges: number
          spl_allowance: number
          ta: number
          updated_at: string
          washing_allowance: number
          weekly_off_allowance: number
        }
        Insert: {
          basic?: number
          bonus_amount?: number
          client_id: string
          conveyance_allowance?: number
          created_at?: string
          created_by?: string | null
          da?: number
          deleted_at?: string | null
          designation: string
          effective_from?: string
          effective_to?: string | null
          epf_mw_wages?: number
          esi_mw_wages?: number
          four_hour_ot_rate?: number
          id?: string
          is_current?: boolean
          is_deleted?: boolean
          is_sandbox?: boolean
          leave_wages?: number
          notes?: string | null
          payable_gross?: number
          relieving_charges?: number
          spl_allowance?: number
          ta?: number
          updated_at?: string
          washing_allowance?: number
          weekly_off_allowance?: number
        }
        Update: {
          basic?: number
          bonus_amount?: number
          client_id?: string
          conveyance_allowance?: number
          created_at?: string
          created_by?: string | null
          da?: number
          deleted_at?: string | null
          designation?: string
          effective_from?: string
          effective_to?: string | null
          epf_mw_wages?: number
          esi_mw_wages?: number
          four_hour_ot_rate?: number
          id?: string
          is_current?: boolean
          is_deleted?: boolean
          is_sandbox?: boolean
          leave_wages?: number
          notes?: string | null
          payable_gross?: number
          relieving_charges?: number
          spl_allowance?: number
          ta?: number
          updated_at?: string
          washing_allowance?: number
          weekly_off_allowance?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          billing_frequency: string
          client_code: string
          client_name: string
          client_type: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          contract_value: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          e_invoice_applicable: boolean
          gst_applicable: boolean
          gst_number: string | null
          gst_percentage: number
          gst_rcm: boolean
          id: string
          invoice_prefix: string | null
          is_active: boolean
          is_deleted: boolean
          is_sandbox: boolean
          notes: string | null
          pt_applicable: boolean
          service_type: string
          state: string
          tds_percentage: number
          tds_rate: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          billing_frequency?: string
          client_code: string
          client_name: string
          client_type?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          e_invoice_applicable?: boolean
          gst_applicable?: boolean
          gst_number?: string | null
          gst_percentage?: number
          gst_rcm?: boolean
          id?: string
          invoice_prefix?: string | null
          is_active?: boolean
          is_deleted?: boolean
          is_sandbox?: boolean
          notes?: string | null
          pt_applicable?: boolean
          service_type?: string
          state?: string
          tds_percentage?: number
          tds_rate?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          billing_frequency?: string
          client_code?: string
          client_name?: string
          client_type?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          e_invoice_applicable?: boolean
          gst_applicable?: boolean
          gst_number?: string | null
          gst_percentage?: number
          gst_rcm?: boolean
          id?: string
          invoice_prefix?: string | null
          is_active?: boolean
          is_deleted?: boolean
          is_sandbox?: boolean
          notes?: string | null
          pt_applicable?: boolean
          service_type?: string
          state?: string
          tds_percentage?: number
          tds_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      company_profile: {
        Row: {
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          cin_number: string | null
          company_name: string
          created_at: string
          email: string | null
          entity_type: string
          esi_code: string | null
          gst_effective_from: string | null
          gst_number: string | null
          id: string
          invoice_location_code: string | null
          iso_certification: string | null
          jurisdiction: string | null
          logo_url: string | null
          pan_number: string | null
          pf_code: string | null
          phone: string | null
          registered_address: string | null
          state: string
          updated_at: string
          website: string | null
        }
        Insert: {
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          cin_number?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          entity_type?: string
          esi_code?: string | null
          gst_effective_from?: string | null
          gst_number?: string | null
          id?: string
          invoice_location_code?: string | null
          iso_certification?: string | null
          jurisdiction?: string | null
          logo_url?: string | null
          pan_number?: string | null
          pf_code?: string | null
          phone?: string | null
          registered_address?: string | null
          state?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          cin_number?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          entity_type?: string
          esi_code?: string | null
          gst_effective_from?: string | null
          gst_number?: string | null
          id?: string
          invoice_location_code?: string | null
          iso_certification?: string | null
          jurisdiction?: string | null
          logo_url?: string | null
          pan_number?: string | null
          pf_code?: string | null
          phone?: string | null
          registered_address?: string | null
          state?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          aadhaar_number: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          basic: number
          client_id: string | null
          conveyance_allowance: number
          created_at: string
          created_by: string | null
          da: number
          date_of_joining: string
          date_of_leaving: string | null
          deleted_at: string | null
          designation: string
          employee_code: string
          epf_exempt: boolean
          esi_exempt: boolean
          esi_number: string | null
          full_name: string
          id: string
          is_deleted: boolean
          is_new_joiner: boolean
          is_sandbox: boolean
          mobile: string | null
          notes: string | null
          payable_gross: number | null
          spl_allowance: number
          status: string
          ta: number
          uan_number: string | null
          updated_at: string
          washing_allowance: number
          weekly_off_allowance: number
        }
        Insert: {
          aadhaar_number?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          basic?: number
          client_id?: string | null
          conveyance_allowance?: number
          created_at?: string
          created_by?: string | null
          da?: number
          date_of_joining?: string
          date_of_leaving?: string | null
          deleted_at?: string | null
          designation: string
          employee_code: string
          epf_exempt?: boolean
          esi_exempt?: boolean
          esi_number?: string | null
          full_name: string
          id?: string
          is_deleted?: boolean
          is_new_joiner?: boolean
          is_sandbox?: boolean
          mobile?: string | null
          notes?: string | null
          payable_gross?: number | null
          spl_allowance?: number
          status?: string
          ta?: number
          uan_number?: string | null
          updated_at?: string
          washing_allowance?: number
          weekly_off_allowance?: number
        }
        Update: {
          aadhaar_number?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          basic?: number
          client_id?: string | null
          conveyance_allowance?: number
          created_at?: string
          created_by?: string | null
          da?: number
          date_of_joining?: string
          date_of_leaving?: string | null
          deleted_at?: string | null
          designation?: string
          employee_code?: string
          epf_exempt?: boolean
          esi_exempt?: boolean
          esi_number?: string | null
          full_name?: string
          id?: string
          is_deleted?: boolean
          is_new_joiner?: boolean
          is_sandbox?: boolean
          mobile?: string | null
          notes?: string | null
          payable_gross?: number | null
          spl_allowance?: number
          status?: string
          ta?: number
          uan_number?: string | null
          updated_at?: string
          washing_allowance?: number
          weekly_off_allowance?: number
        }
        Relationships: [
          {
            foreignKeyName: "employees_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_ledger: {
        Row: {
          balance_after: number
          category: Database["public"]["Enums"]["ledger_category"]
          client_id: string | null
          created_at: string
          created_by: string | null
          credit_amount: number
          debit_amount: number
          entry_date: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          is_deleted: boolean
          is_sandbox: boolean
          particulars: string
          reference_id: string | null
          reference_type: string | null
          voucher_number: string
        }
        Insert: {
          balance_after?: number
          category: Database["public"]["Enums"]["ledger_category"]
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_amount?: number
          debit_amount?: number
          entry_date?: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          is_deleted?: boolean
          is_sandbox?: boolean
          particulars: string
          reference_id?: string | null
          reference_type?: string | null
          voucher_number: string
        }
        Update: {
          balance_after?: number
          category?: Database["public"]["Enums"]["ledger_category"]
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_amount?: number
          debit_amount?: number
          entry_date?: string
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          is_deleted?: boolean
          is_sandbox?: boolean
          particulars?: string
          reference_id?: string | null
          reference_type?: string | null
          voucher_number?: string
        }
        Relationships: []
      }
      invoice_deduction_templates: {
        Row: {
          client_id: string
          created_at: string
          id: string
          template_rows: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          template_rows?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          template_rows?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      invoice_number_seq: {
        Row: {
          fy: string
          is_sandbox: boolean
          last_number: number
          prefix: string
        }
        Insert: {
          fy: string
          is_sandbox: boolean
          last_number?: number
          prefix: string
        }
        Update: {
          fy?: string
          is_sandbox?: boolean
          last_number?: number
          prefix?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_in_words: string | null
          amount_receivable: number
          amount_received: number
          billing_amount: number
          billing_lines: Json
          client_id: string
          created_at: string
          created_by: string | null
          deduction_rows: Json
          deleted_at: string | null
          due_date: string | null
          gst_amount: number
          gst_applicable: boolean
          gst_percentage: number
          gst_rcm: boolean
          id: string
          invoice_date: string
          invoice_notes: string | null
          invoice_number: string
          irn_number: string | null
          is_deleted: boolean
          is_sandbox: boolean
          month: string
          month_date: string
          net_margin: number
          outstanding_amount: number
          paysheet_id: string | null
          qr_code_data: string | null
          service_period_from: string | null
          service_period_to: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          tds_amount: number
          tds_percentage: number
          template_config: Json
          total_deductions: number
          total_invoice_value: number
          total_taxable_value: number
          updated_at: string
        }
        Insert: {
          amount_in_words?: string | null
          amount_receivable?: number
          amount_received?: number
          billing_amount?: number
          billing_lines?: Json
          client_id: string
          created_at?: string
          created_by?: string | null
          deduction_rows?: Json
          deleted_at?: string | null
          due_date?: string | null
          gst_amount?: number
          gst_applicable?: boolean
          gst_percentage?: number
          gst_rcm?: boolean
          id?: string
          invoice_date?: string
          invoice_notes?: string | null
          invoice_number: string
          irn_number?: string | null
          is_deleted?: boolean
          is_sandbox?: boolean
          month: string
          month_date: string
          net_margin?: number
          outstanding_amount?: number
          paysheet_id?: string | null
          qr_code_data?: string | null
          service_period_from?: string | null
          service_period_to?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tds_amount?: number
          tds_percentage?: number
          template_config?: Json
          total_deductions?: number
          total_invoice_value?: number
          total_taxable_value?: number
          updated_at?: string
        }
        Update: {
          amount_in_words?: string | null
          amount_receivable?: number
          amount_received?: number
          billing_amount?: number
          billing_lines?: Json
          client_id?: string
          created_at?: string
          created_by?: string | null
          deduction_rows?: Json
          deleted_at?: string | null
          due_date?: string | null
          gst_amount?: number
          gst_applicable?: boolean
          gst_percentage?: number
          gst_rcm?: boolean
          id?: string
          invoice_date?: string
          invoice_notes?: string | null
          invoice_number?: string
          irn_number?: string | null
          is_deleted?: boolean
          is_sandbox?: boolean
          month?: string
          month_date?: string
          net_margin?: number
          outstanding_amount?: number
          paysheet_id?: string | null
          qr_code_data?: string | null
          service_period_from?: string | null
          service_period_to?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tds_amount?: number
          tds_percentage?: number
          template_config?: Json
          total_deductions?: number
          total_invoice_value?: number
          total_taxable_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_paysheet_id_fkey"
            columns: ["paysheet_id"]
            isOneToOne: false
            referencedRelation: "paysheets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          is_sandbox: boolean
          message: string
          related_record_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          is_sandbox?: boolean
          message: string
          related_record_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          is_sandbox?: boolean
          message?: string
          related_record_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          bank_name: string | null
          client_id: string
          created_at: string
          id: string
          invoice_id: string
          is_deleted: boolean
          is_sandbox: boolean
          notes: string | null
          payment_date: string
          payment_mode: string
          receipt_number: string
          recorded_by: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          bank_name?: string | null
          client_id: string
          created_at?: string
          id?: string
          invoice_id: string
          is_deleted?: boolean
          is_sandbox?: boolean
          notes?: string | null
          payment_date?: string
          payment_mode: string
          receipt_number: string
          recorded_by?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string | null
          client_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          is_deleted?: boolean
          is_sandbox?: boolean
          notes?: string | null
          payment_date?: string
          payment_mode?: string
          receipt_number?: string
          recorded_by?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      paysheet_employees: {
        Row: {
          advance_deduction: number
          anomaly_flags: Json
          basic: number
          bonus: number
          conveyance_allowance: number
          created_at: string
          da: number
          designation: string
          earned_wages: number
          employee_id: string | null
          employee_name: string
          epf_employee_deduction: number
          epf_employer_contribution: number
          epf_mw_wages: number
          epf_wages: number
          esi_employee_deduction: number
          esi_employer_contribution: number
          esi_number: string | null
          esi_wages: number
          final_net_salary: number
          four_hour_ot: number
          id: string
          is_deleted: boolean
          is_new_joiner: boolean
          is_sandbox: boolean
          leave_wages: number
          net_salary: number
          no_of_duties: number
          notes: string | null
          payable_gross: number
          paysheet_id: string
          pt_deduction: number
          relieving_charges: number
          spl_allowance: number
          ta: number
          uan_number: string | null
          updated_at: string
          washing_allowance: number
          weekly_off: number
          working_days: number
        }
        Insert: {
          advance_deduction?: number
          anomaly_flags?: Json
          basic?: number
          bonus?: number
          conveyance_allowance?: number
          created_at?: string
          da?: number
          designation: string
          earned_wages?: number
          employee_id?: string | null
          employee_name: string
          epf_employee_deduction?: number
          epf_employer_contribution?: number
          epf_mw_wages?: number
          epf_wages?: number
          esi_employee_deduction?: number
          esi_employer_contribution?: number
          esi_number?: string | null
          esi_wages?: number
          final_net_salary?: number
          four_hour_ot?: number
          id?: string
          is_deleted?: boolean
          is_new_joiner?: boolean
          is_sandbox?: boolean
          leave_wages?: number
          net_salary?: number
          no_of_duties?: number
          notes?: string | null
          payable_gross?: number
          paysheet_id: string
          pt_deduction?: number
          relieving_charges?: number
          spl_allowance?: number
          ta?: number
          uan_number?: string | null
          updated_at?: string
          washing_allowance?: number
          weekly_off?: number
          working_days?: number
        }
        Update: {
          advance_deduction?: number
          anomaly_flags?: Json
          basic?: number
          bonus?: number
          conveyance_allowance?: number
          created_at?: string
          da?: number
          designation?: string
          earned_wages?: number
          employee_id?: string | null
          employee_name?: string
          epf_employee_deduction?: number
          epf_employer_contribution?: number
          epf_mw_wages?: number
          epf_wages?: number
          esi_employee_deduction?: number
          esi_employer_contribution?: number
          esi_number?: string | null
          esi_wages?: number
          final_net_salary?: number
          four_hour_ot?: number
          id?: string
          is_deleted?: boolean
          is_new_joiner?: boolean
          is_sandbox?: boolean
          leave_wages?: number
          net_salary?: number
          no_of_duties?: number
          notes?: string | null
          payable_gross?: number
          paysheet_id?: string
          pt_deduction?: number
          relieving_charges?: number
          spl_allowance?: number
          ta?: number
          uan_number?: string | null
          updated_at?: string
          washing_allowance?: number
          weekly_off?: number
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "paysheet_employees_paysheet_id_fkey"
            columns: ["paysheet_id"]
            isOneToOne: false
            referencedRelation: "paysheets"
            referencedColumns: ["id"]
          },
        ]
      }
      paysheets: {
        Row: {
          anomaly_count: number
          approved_at: string | null
          approved_by: string | null
          client_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean
          is_sandbox: boolean
          month: string
          month_date: string
          paysheet_number: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["paysheet_status"]
          submitted_at: string | null
          submitted_by: string | null
          total_advance_deductions: number
          total_days_in_month: number
          total_earned_wages: number
          total_employees: number
          total_epf_employee: number
          total_epf_employer: number
          total_esi_employee: number
          total_esi_employer: number
          total_net_salary: number
          total_pt_deduction: number
          updated_at: string
        }
        Insert: {
          anomaly_count?: number
          approved_at?: string | null
          approved_by?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          is_sandbox?: boolean
          month: string
          month_date: string
          paysheet_number: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["paysheet_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          total_advance_deductions?: number
          total_days_in_month: number
          total_earned_wages?: number
          total_employees?: number
          total_epf_employee?: number
          total_epf_employer?: number
          total_esi_employee?: number
          total_esi_employer?: number
          total_net_salary?: number
          total_pt_deduction?: number
          updated_at?: string
        }
        Update: {
          anomaly_count?: number
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          is_sandbox?: boolean
          month?: string
          month_date?: string
          paysheet_number?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["paysheet_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          total_advance_deductions?: number
          total_days_in_month?: number
          total_earned_wages?: number
          total_employees?: number
          total_epf_employee?: number
          total_epf_employer?: number
          total_esi_employee?: number
          total_esi_employer?: number
          total_net_salary?: number
          total_pt_deduction?: number
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_view: boolean
          id: string
          role: Database["public"]["Enums"]["app_role"]
          screen_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          screen_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          screen_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          last_login?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          updated_at?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _iw_under_hundred: { Args: { n: number }; Returns: string }
      amount_in_words_inr: { Args: { amt: number }; Returns: string }
      approve_paysheet: { Args: { _id: string }; Returns: undefined }
      current_environment: { Args: never; Returns: string }
      fy_string: { Args: { _d: string }; Returns: string }
      gen_invoice_number: {
        Args: { _client_id: string; _invoice_date: string; _sandbox: boolean }
        Returns: string
      }
      gen_paysheet_number: {
        Args: { _month_date: string; _sandbox: boolean }
        Returns: string
      }
      gen_receipt_number: {
        Args: { _d: string; _sandbox: boolean }
        Returns: string
      }
      gen_voucher_number: { Args: { _d: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: { _action: string; _screen: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      is_sandbox_env: { Args: never; Returns: boolean }
      mark_overdue_invoices: { Args: never; Returns: number }
      reject_paysheet: {
        Args: { _id: string; _reason: string }
        Returns: undefined
      }
      save_paysheet: { Args: { _payload: Json }; Returns: string }
      wipe_sandbox: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "ceo_admin" | "coo_ops" | "accountant"
      client_type_enum: "individual_huf" | "company_firm"
      invoice_status: "draft" | "sent" | "partially_paid" | "paid" | "overdue"
      ledger_category:
        | "client_billing"
        | "payment_received"
        | "epf_payment"
        | "esi_payment"
        | "gst_payment"
        | "pt_payment"
        | "staff_salary"
        | "salary_advance"
        | "advance_recovery"
        | "admin_expense"
        | "vehicle_expense"
        | "other_income"
        | "other_expense"
      ledger_entry_type: "receipt" | "payment" | "journal" | "contra"
      paysheet_status: "draft" | "submitted" | "approved" | "rejected"
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
      app_role: ["ceo_admin", "coo_ops", "accountant"],
      client_type_enum: ["individual_huf", "company_firm"],
      invoice_status: ["draft", "sent", "partially_paid", "paid", "overdue"],
      ledger_category: [
        "client_billing",
        "payment_received",
        "epf_payment",
        "esi_payment",
        "gst_payment",
        "pt_payment",
        "staff_salary",
        "salary_advance",
        "advance_recovery",
        "admin_expense",
        "vehicle_expense",
        "other_income",
        "other_expense",
      ],
      ledger_entry_type: ["receipt", "payment", "journal", "contra"],
      paysheet_status: ["draft", "submitted", "approved", "rejected"],
    },
  },
} as const
