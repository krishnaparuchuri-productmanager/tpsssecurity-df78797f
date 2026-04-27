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
      clients: {
        Row: {
          address: string | null
          billing_frequency: string
          client_code: string
          client_name: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          contract_value: number | null
          created_at: string
          created_by: string | null
          gst_applicable: boolean
          gst_number: string | null
          gst_percentage: number
          id: string
          is_active: boolean
          notes: string | null
          service_type: string
          state: string
          tds_percentage: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          billing_frequency?: string
          client_code: string
          client_name: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          gst_applicable?: boolean
          gst_number?: string | null
          gst_percentage?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          service_type?: string
          state?: string
          tds_percentage?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          billing_frequency?: string
          client_code?: string
          client_name?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          gst_applicable?: boolean
          gst_number?: string | null
          gst_percentage?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          service_type?: string
          state?: string
          tds_percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      company_profile: {
        Row: {
          cin_number: string | null
          company_name: string
          created_at: string
          email: string | null
          entity_type: string
          gst_effective_from: string | null
          gst_number: string | null
          id: string
          logo_url: string | null
          pan_number: string | null
          phone: string | null
          registered_address: string | null
          state: string
          updated_at: string
          website: string | null
        }
        Insert: {
          cin_number?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          entity_type?: string
          gst_effective_from?: string | null
          gst_number?: string | null
          id?: string
          logo_url?: string | null
          pan_number?: string | null
          phone?: string | null
          registered_address?: string | null
          state?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          cin_number?: string | null
          company_name?: string
          created_at?: string
          email?: string | null
          entity_type?: string
          gst_effective_from?: string | null
          gst_number?: string | null
          id?: string
          logo_url?: string | null
          pan_number?: string | null
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
          designation: string
          employee_code: string
          epf_exempt: boolean
          esi_exempt: boolean
          esi_number: string | null
          full_name: string
          id: string
          is_new_joiner: boolean
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
          designation: string
          employee_code: string
          epf_exempt?: boolean
          esi_exempt?: boolean
          esi_number?: string | null
          full_name: string
          id?: string
          is_new_joiner?: boolean
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
          designation?: string
          employee_code?: string
          epf_exempt?: boolean
          esi_exempt?: boolean
          esi_number?: string | null
          full_name?: string
          id?: string
          is_new_joiner?: boolean
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
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
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
          message?: string
          related_record_id?: string | null
          title?: string
          type?: string
          user_id?: string
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
    }
    Enums: {
      app_role: "ceo_admin" | "coo_ops" | "accountant"
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
    },
  },
} as const
