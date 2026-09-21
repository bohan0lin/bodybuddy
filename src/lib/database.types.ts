export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agent_actions: {
        Row: {
          action_id: string
          created_at: string
          payload: Json
          record_id: string
          user_id: string
        }
        Insert: {
          action_id: string
          created_at?: string
          payload: Json
          record_id: string
          user_id: string
        }
        Update: {
          action_id?: string
          created_at?: string
          payload?: Json
          record_id?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          body: Json
          created_at: string
          id: string
          reply_to: string | null
          role: string
          sequence: number
          user_id: string
        }
        Insert: {
          body: Json
          created_at?: string
          id: string
          reply_to?: string | null
          role: string
          sequence?: never
          user_id: string
        }
        Update: {
          body?: Json
          created_at?: string
          id?: string
          reply_to?: string | null
          role?: string
          sequence?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_messages_user_id_reply_to_fkey"
            columns: ["user_id", "reply_to"]
            isOneToOne: true
            referencedRelation: "coach_messages"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      coach_proposals: {
        Row: {
          action_id: string
          expires_at: string
          message_id: string
          payload: Json
          status: string
          user_id: string
          version: number
        }
        Insert: {
          action_id: string
          expires_at?: string
          message_id: string
          payload: Json
          status?: string
          user_id: string
          version?: number
        }
        Update: {
          action_id?: string
          expires_at?: string
          message_id?: string
          payload?: Json
          status?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_proposals_user_id_message_id_fkey"
            columns: ["user_id", "message_id"]
            isOneToOne: false
            referencedRelation: "coach_messages"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      foods: {
        Row: {
          aliases: string | null
          base_amount: number
          brand: string | null
          calories: number
          carbs: number
          created_at: string
          embedding: string | null
          fat: number
          id: string
          name: string
          name_en: string | null
          preparation: string | null
          protein: number
          source: string
          unit: string
        }
        Insert: {
          aliases?: string | null
          base_amount?: number
          brand?: string | null
          calories: number
          carbs: number
          created_at?: string
          embedding?: string | null
          fat: number
          id?: string
          name: string
          name_en?: string | null
          preparation?: string | null
          protein: number
          source?: string
          unit?: string
        }
        Update: {
          aliases?: string | null
          base_amount?: number
          brand?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          embedding?: string | null
          fat?: number
          id?: string
          name?: string
          name_en?: string | null
          preparation?: string | null
          protein?: number
          source?: string
          unit?: string
        }
        Relationships: []
      }
      knowledge: {
        Row: {
          content: string
          created_at: string
          id: string
          tags: string | null
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          tags?: string | null
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          tags?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          amount: number | null
          brand: string | null
          calories: number
          carbs: number
          created_at: string
          date: string
          fat: number
          id: string
          name: string
          photo_url: string | null
          protein: number
          type: string
          unit: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          brand?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          date: string
          fat?: number
          id?: string
          name: string
          photo_url?: string | null
          protein?: number
          type: string
          unit?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          brand?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          date?: string
          fat?: number
          id?: string
          name?: string
          photo_url?: string | null
          protein?: number
          type?: string
          unit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          goal_type: string | null
          height_cm: number
          id: string
          target_calories: number
          target_carbs: number
          target_fat: number
          target_protein: number
        }
        Insert: {
          created_at?: string
          display_name?: string
          goal_type?: string | null
          height_cm?: number
          id: string
          target_calories?: number
          target_carbs?: number
          target_fat?: number
          target_protein?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          goal_type?: string | null
          height_cm?: number
          id?: string
          target_calories?: number
          target_carbs?: number
          target_fat?: number
          target_protein?: number
        }
        Relationships: []
      }
      saved_items: {
        Row: {
          base_amount: number
          brand: string | null
          calories: number
          carbs: number
          created_at: string
          fat: number
          id: string
          kind: string
          name: string
          note: string | null
          photo_url: string | null
          protein: number
          unit: string
          user_id: string
        }
        Insert: {
          base_amount?: number
          brand?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          id?: string
          kind: string
          name: string
          note?: string | null
          photo_url?: string | null
          protein?: number
          unit?: string
          user_id: string
        }
        Update: {
          base_amount?: number
          brand?: string | null
          calories?: number
          carbs?: number
          created_at?: string
          fat?: number
          id?: string
          kind?: string
          name?: string
          note?: string | null
          photo_url?: string | null
          protein?: number
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      weight_logs: {
        Row: {
          body_fat: number | null
          created_at: string
          date: string
          id: string
          user_id: string
          weight: number
        }
        Insert: {
          body_fat?: number | null
          created_at?: string
          date: string
          id?: string
          user_id: string
          weight: number
        }
        Update: {
          body_fat?: number | null
          created_at?: string
          date?: string
          id?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      workouts: {
        Row: {
          calories: number
          created_at: string
          date: string
          duration_min: number
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          calories?: number
          created_at?: string
          date: string
          duration_min?: number
          id?: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          calories?: number
          created_at?: string
          date?: string
          duration_min?: number
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_coach_message: {
        Args: {
          p_body: Json
          p_id: string
          p_owner: string
          p_proposals?: Json
          p_reply_to?: string
          p_role: string
        }
        Returns: undefined
      }
      confirm_agent_action: {
        Args: { p_action_id: string; p_payload: Json }
        Returns: Json
      }
      execute_agent_action: {
        Args: { p_action_id: string; p_payload: Json }
        Returns: Json
      }
      find_foods_exact: {
        Args: {
          p_brand?: string
          p_preparation?: string
          p_query: string
          p_unit?: string
        }
        Returns: {
          base_amount: number
          calories: number
          carbs: number
          distance: number
          fat: number
          id: string
          name: string
          name_en: string
          protein: number
          source: string
          unit: string
        }[]
      }
      find_foods_semantic: {
        Args: {
          p_brand?: string
          p_embedding: string
          p_preparation?: string
          p_unit?: string
        }
        Returns: {
          base_amount: number
          calories: number
          carbs: number
          distance: number
          fat: number
          id: string
          name: string
          name_en: string
          protein: number
          source: string
          unit: string
        }[]
      }
      match_foods: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          base_amount: number
          calories: number
          carbs: number
          distance: number
          fat: number
          id: string
          name: string
          name_en: string
          protein: number
          unit: string
        }[]
      }
      record_food_entry: {
        Args: { p_favorite?: boolean; p_id: string; p_meal: Json }
        Returns: undefined
      }
      reserve_ai_request: {
        Args: {
          p_endpoint: string
          p_image?: boolean
          p_ip_hash: string
          p_user_id: string
        }
        Returns: Json
      }
      transition_coach_proposal: {
        Args: {
          p_action_id: string
          p_operation: string
          p_owner: string
          p_payload: Json
          p_version: number
        }
        Returns: Json
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
