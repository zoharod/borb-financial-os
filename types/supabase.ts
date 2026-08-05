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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          card_id: string | null
          created_at: string
          currency: string
          household_id: string
          id: string
          institution: string | null
          name: string
          type: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          currency: string
          household_id: string
          id?: string
          institution?: string | null
          name: string
          type: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          currency?: string
          household_id?: string
          id?: string
          institution?: string | null
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          category_id: string
          currency: string
          household_id: string
          id: string
          month: string
          planned_amount: number
        }
        Insert: {
          category_id: string
          currency: string
          household_id: string
          id?: string
          month: string
          planned_amount: number
        }
        Update: {
          category_id?: string
          currency?: string
          household_id?: string
          id?: string
          month?: string
          planned_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          bank: string | null
          cardholder_user_id: string | null
          created_at: string
          credit_limit: number | null
          full_payment_amount: number | null
          household_id: string
          id: string
          last4: string | null
          legacy_cardholder_name: string | null
          minimum_payment: number | null
          name: string
          network: string | null
          payment_due_day: number | null
          statement_closing_day: number | null
        }
        Insert: {
          bank?: string | null
          cardholder_user_id?: string | null
          created_at?: string
          credit_limit?: number | null
          full_payment_amount?: number | null
          household_id: string
          id?: string
          last4?: string | null
          legacy_cardholder_name?: string | null
          minimum_payment?: number | null
          name: string
          network?: string | null
          payment_due_day?: number | null
          statement_closing_day?: number | null
        }
        Update: {
          bank?: string | null
          cardholder_user_id?: string | null
          created_at?: string
          credit_limit?: number | null
          full_payment_amount?: number | null
          household_id?: string
          id?: string
          last4?: string | null
          legacy_cardholder_name?: string | null
          minimum_payment?: number | null
          name?: string
          network?: string | null
          payment_due_day?: number | null
          statement_closing_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          household_id: string
          id: string
          is_extra_default: boolean
          name: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          is_extra_default?: boolean
          name: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          is_extra_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expected_income: {
        Row: {
          amount: number
          created_at: string
          currency: string
          destination_account_id: string | null
          expected_date: string
          frequency: string
          household_id: string
          household_member_user_id: string | null
          id: string
          source: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          destination_account_id?: string | null
          expected_date: string
          frequency?: string
          household_id: string
          household_member_user_id?: string | null
          id?: string
          source: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          destination_account_id?: string | null
          expected_date?: string
          frequency?: string
          household_id?: string
          household_member_user_id?: string | null
          id?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "expected_income_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expected_income_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_commitments: {
        Row: {
          account_id: string | null
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          end_date: string | null
          frequency: string
          household_id: string
          id: string
          name: string
          next_payment_date: string | null
          remaining_installments: number | null
          start_date: string
          status: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          created_at?: string
          currency: string
          end_date?: string | null
          frequency?: string
          household_id: string
          id?: string
          name: string
          next_payment_date?: string | null
          remaining_installments?: number | null
          start_date: string
          status?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          end_date?: string | null
          frequency?: string
          household_id?: string
          id?: string
          name?: string
          next_payment_date?: string | null
          remaining_installments?: number | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_commitments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_commitments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_commitments_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string
          message: string | null
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          household_id: string
          id?: string
          invited_by: string
          message?: string | null
          role: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string
          message?: string | null
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invitations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          household_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          household_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          avatar_url: string | null
          base_currency_default: string
          created_at: string
          default_budget_period: string
          financial_month_start_day: number
          id: string
          name: string
          onboarding_step: string
          secondary_currency: string | null
        }
        Insert: {
          avatar_url?: string | null
          base_currency_default?: string
          created_at?: string
          default_budget_period?: string
          financial_month_start_day?: number
          id?: string
          name: string
          onboarding_step?: string
          secondary_currency?: string | null
        }
        Update: {
          avatar_url?: string | null
          base_currency_default?: string
          created_at?: string
          default_budget_period?: string
          financial_month_start_day?: number
          id?: string
          name?: string
          onboarding_step?: string
          secondary_currency?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          budget_alerts: boolean
          cashback_opportunities: boolean
          monthly_summary: boolean
          payment_reminders: boolean
          savings_milestones: boolean
          unusual_transaction_alerts: boolean
          updated_at: string
          user_id: string
          weekly_summary: boolean
        }
        Insert: {
          budget_alerts?: boolean
          cashback_opportunities?: boolean
          monthly_summary?: boolean
          payment_reminders?: boolean
          savings_milestones?: boolean
          unusual_transaction_alerts?: boolean
          updated_at?: string
          user_id: string
          weekly_summary?: boolean
        }
        Update: {
          budget_alerts?: boolean
          cashback_opportunities?: boolean
          monthly_summary?: boolean
          payment_reminders?: boolean
          savings_milestones?: boolean
          unusual_transaction_alerts?: boolean
          updated_at?: string
          user_id?: string
          weekly_summary?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_format: string
          full_name: string | null
          id: string
          number_format: string
          preferred_currency: string | null
          preferred_language: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_format?: string
          full_name?: string | null
          id: string
          number_format?: string
          preferred_currency?: string | null
          preferred_language?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_format?: string
          full_name?: string | null
          id?: string
          number_format?: string
          preferred_currency?: string | null
          preferred_language?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          card_id: string | null
          category_id: string | null
          commitment_id: string | null
          created_at: string
          created_by: string
          currency: string
          description: string | null
          household_id: string
          id: string
          reconciled_at: string | null
          source: string
          status: string
          to_account_id: string | null
          transaction_date: string
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          card_id?: string | null
          category_id?: string | null
          commitment_id?: string | null
          created_at?: string
          created_by: string
          currency: string
          description?: string | null
          household_id: string
          id?: string
          reconciled_at?: string | null
          source?: string
          status?: string
          to_account_id?: string | null
          transaction_date: string
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          card_id?: string | null
          category_id?: string | null
          commitment_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          household_id?: string
          id?: string
          reconciled_at?: string | null
          source?: string
          status?: string
          to_account_id?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "financial_commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_household_invitation: {
        Args: { target_token: string }
        Returns: string
      }
      create_household_for_current_user: {
        Args: {
          household_name: string
          household_secondary_currency?: string
          primary_currency?: string
        }
        Returns: string
      }
      create_household_invitation: {
        Args: {
          target_email: string
          target_household_id: string
          target_message?: string
          target_role: string
        }
        Returns: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string
          message: string | null
          role: string
          status: string
          token: string
        }
        SetofOptions: {
          from: "*"
          to: "household_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_household: {
        Args: { target_household_id: string }
        Returns: undefined
      }
      get_household_member_emails: {
        Args: { target_household_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_invitation_preview: {
        Args: { target_token: string }
        Returns: {
          expires_at: string
          household_name: string
          invited_by_name: string
          message: string
          role: string
          status: string
        }[]
      }
      leave_household: {
        Args: { target_household_id: string }
        Returns: undefined
      }
      remove_household_member: {
        Args: { target_member_id: string }
        Returns: undefined
      }
      transfer_household_ownership: {
        Args: { new_owner_user_id: string; target_household_id: string }
        Returns: undefined
      }
      user_household_ids: { Args: never; Returns: string[] }
      user_household_role: {
        Args: { target_household_id: string }
        Returns: string
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
    Enums: {},
  },
} as const
