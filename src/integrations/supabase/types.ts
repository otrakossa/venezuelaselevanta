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
      bot_sessions: {
        Row: {
          chat_id: number
          data: Json
          updated_at: string | null
        }
        Insert: {
          chat_id: number
          data: Json
          updated_at?: string | null
        }
        Update: {
          chat_id?: number
          data?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      bot_users: {
        Row: {
          chat_id: number
          first_name: string | null
          last_seen: string | null
          username: string | null
        }
        Insert: {
          chat_id: number
          first_name?: string | null
          last_seen?: string | null
          username?: string | null
        }
        Update: {
          chat_id?: number
          first_name?: string | null
          last_seen?: string | null
          username?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          color: string
          created_at?: string
          description?: string | null
          icon: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string
          name: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message: string
          name: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string
          name?: string
          subject?: string | null
        }
        Relationships: []
      }
      health_centers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          osm_id: number | null
          osm_type: string | null
          phone: string | null
          state: string | null
          type: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          osm_id?: number | null
          osm_type?: string | null
          phone?: string | null
          state?: string | null
          type?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          osm_id?: number | null
          osm_type?: string | null
          phone?: string | null
          state?: string | null
          type?: string
        }
        Relationships: []
      }
      missing_persons: {
        Row: {
          age: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          found_date: string | null
          id: string
          last_seen_lat: number | null
          last_seen_lng: number | null
          last_seen_location: string | null
          matched_at: string | null
          matched_by: string | null
          matched_patient_id: string | null
          municipality: string | null
          name: string
          parish: string | null
          photo_url: string | null
          report_date: string
          source_id: string | null
          source_label: string | null
          source_url: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          found_date?: string | null
          id?: string
          last_seen_lat?: number | null
          last_seen_lng?: number | null
          last_seen_location?: string | null
          matched_at?: string | null
          matched_by?: string | null
          matched_patient_id?: string | null
          municipality?: string | null
          name: string
          parish?: string | null
          photo_url?: string | null
          report_date?: string
          source_id?: string | null
          source_label?: string | null
          source_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          found_date?: string | null
          id?: string
          last_seen_lat?: number | null
          last_seen_lng?: number | null
          last_seen_location?: string | null
          matched_at?: string | null
          matched_by?: string | null
          matched_patient_id?: string | null
          municipality?: string | null
          name?: string
          parish?: string | null
          photo_url?: string | null
          report_date?: string
          source_id?: string | null
          source_label?: string | null
          source_url?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missing_persons_matched_patient_id_fkey"
            columns: ["matched_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      needs: {
        Row: {
          category: string
          center_address: string | null
          center_name: string
          contact_info: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          municipality: string | null
          parish: string | null
          quantity: string | null
          reporter_name: string | null
          site_id: string | null
          state: string | null
          status: string
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          category: string
          center_address?: string | null
          center_name: string
          contact_info?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          municipality?: string | null
          parish?: string | null
          quantity?: string | null
          reporter_name?: string | null
          site_id?: string | null
          state?: string | null
          status?: string
          title: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          category?: string
          center_address?: string | null
          center_name?: string
          contact_info?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          municipality?: string | null
          parish?: string | null
          quantity?: string | null
          reporter_name?: string | null
          site_id?: string | null
          state?: string | null
          status?: string
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "needs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          category: string
          contact_info: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          location_desc: string | null
          municipality: string | null
          need_id: string | null
          parish: string | null
          quantity: string | null
          site_id: string | null
          state: string | null
          status: string
          title: string
        }
        Insert: {
          category: string
          contact_info?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_desc?: string | null
          municipality?: string | null
          need_id?: string | null
          parish?: string | null
          quantity?: string | null
          site_id?: string | null
          state?: string | null
          status?: string
          title: string
        }
        Update: {
          category?: string
          contact_info?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_desc?: string | null
          municipality?: string | null
          need_id?: string | null
          parish?: string | null
          quantity?: string | null
          site_id?: string | null
          state?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          age: number | null
          center_address: string | null
          center_lat: number | null
          center_lng: number | null
          center_name: string
          created_at: string
          discharged_at: string | null
          health_center_id: string | null
          id: string
          id_number: string | null
          matched_missing_id: string | null
          name: string
          notes: string | null
          phone: string | null
          registered_by: string | null
          sector: string | null
          sex: string | null
          state: string | null
          status: string
        }
        Insert: {
          address?: string | null
          age?: number | null
          center_address?: string | null
          center_lat?: number | null
          center_lng?: number | null
          center_name: string
          created_at?: string
          discharged_at?: string | null
          health_center_id?: string | null
          id?: string
          id_number?: string | null
          matched_missing_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          registered_by?: string | null
          sector?: string | null
          sex?: string | null
          state?: string | null
          status?: string
        }
        Update: {
          address?: string | null
          age?: number | null
          center_address?: string | null
          center_lat?: number | null
          center_lng?: number | null
          center_name?: string
          created_at?: string
          discharged_at?: string | null
          health_center_id?: string | null
          id?: string
          id_number?: string | null
          matched_missing_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          registered_by?: string | null
          sector?: string | null
          sex?: string | null
          state?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_health_center_id_fkey"
            columns: ["health_center_id"]
            isOneToOne: false
            referencedRelation: "health_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patients_matched_missing_id_fkey"
            columns: ["matched_missing_id"]
            isOneToOne: false
            referencedRelation: "missing_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      push_config: {
        Row: {
          broadcast_secret: string | null
          broadcast_url: string | null
          id: boolean
        }
        Insert: {
          broadcast_secret?: string | null
          broadcast_url?: string | null
          id?: boolean
        }
        Update: {
          broadcast_secret?: string | null
          broadcast_url?: string | null
          id?: boolean
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          lat: number | null
          lng: number | null
          p256dh: string
          radius_km: number
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          lat?: number | null
          lng?: number | null
          p256dh: string
          radius_km?: number
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          lat?: number | null
          lng?: number | null
          p256dh?: string
          radius_km?: number
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      report_comments: {
        Row: {
          author_name: string | null
          content: string
          created_at: string
          id: string
          report_id: string
        }
        Insert: {
          author_name?: string | null
          content: string
          created_at?: string
          id?: string
          report_id: string
        }
        Update: {
          author_name?: string | null
          content?: string
          created_at?: string
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_comments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_votes: {
        Row: {
          created_at: string
          device_id: string
          id: string
          report_id: string
          updated_at: string
          vote: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          report_id: string
          updated_at?: string
          vote: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          report_id?: string
          updated_at?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_votes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          address: string | null
          affected_count: number | null
          category: string
          confirm_count: number
          created_at: string
          description: string | null
          dispute_count: number
          external_id: string | null
          hidden: boolean
          hidden_at: string | null
          hidden_reason: string | null
          id: string
          lat: number
          lng: number
          media_thumbs: string[]
          media_urls: string[]
          municipality: string | null
          parish: string | null
          photo_url: string | null
          reporter_name: string | null
          source: string | null
          state: string | null
          status: string
          title: string
          updated_at: string
          urgency: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          address?: string | null
          affected_count?: number | null
          category: string
          confirm_count?: number
          created_at?: string
          description?: string | null
          dispute_count?: number
          external_id?: string | null
          hidden?: boolean
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          lat: number
          lng: number
          media_thumbs?: string[]
          media_urls?: string[]
          municipality?: string | null
          parish?: string | null
          photo_url?: string | null
          reporter_name?: string | null
          source?: string | null
          state?: string | null
          status?: string
          title: string
          updated_at?: string
          urgency?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          address?: string | null
          affected_count?: number | null
          category?: string
          confirm_count?: number
          created_at?: string
          description?: string | null
          dispute_count?: number
          external_id?: string | null
          hidden?: boolean
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          lat?: number
          lng?: number
          media_thumbs?: string[]
          media_urls?: string[]
          municipality?: string | null
          parish?: string | null
          photo_url?: string | null
          reporter_name?: string | null
          source?: string | null
          state?: string | null
          status?: string
          title?: string
          updated_at?: string
          urgency?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      site_responsibles: {
        Row: {
          contact_info: string | null
          created_at: string
          id: string
          name: string | null
          phone: string | null
          role_label: string | null
          site_id: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          id?: string
          name?: string | null
          phone?: string | null
          role_label?: string | null
          site_id: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          id?: string
          name?: string | null
          phone?: string | null
          role_label?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_responsibles_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          municipality: string | null
          name: string
          parish: string | null
          state: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          municipality?: string | null
          name: string
          parish?: string | null
          state?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          municipality?: string | null
          name?: string
          parish?: string | null
          state?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_sessions: {
        Row: {
          chat_id: number
          draft: Json
          state: string
          updated_at: string
        }
        Insert: {
          chat_id: number
          draft?: Json
          state?: string
          updated_at?: string
        }
        Update: {
          chat_id?: number
          draft?: Json
          state?: string
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
      cast_report_vote: {
        Args: { p_device_id: string; p_report_id: string; p_vote: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_missing_to_patient: {
        Args: { p_missing_id: string; p_patient_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      suggest_missing_matches: {
        Args: { p_patient_id: string }
        Returns: {
          last_seen_location: string
          missing_age: number
          missing_id: string
          missing_name: string
          score: number
          status: string
        }[]
      }
      suggest_patient_matches: {
        Args: { p_missing_id: string }
        Returns: {
          center_name: string
          patient_age: number
          patient_id: string
          patient_name: string
          score: number
          status: string
        }[]
      }
      unlink_missing_patient: {
        Args: { p_missing_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
