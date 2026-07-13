export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      budget: {
        Row: {
          category_id: string;
          created_at: string;
          id: string;
          limit_amount: number;
          period: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          id?: string;
          limit_amount: number;
          period: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          id?: string;
          limit_amount?: number;
          period?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "category";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_total: {
        Row: {
          created_at: string;
          id: string;
          limit_amount: number;
          period: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          limit_amount: number;
          period: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          limit_amount?: number;
          period?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      category: {
        Row: {
          created_at: string;
          icon: string | null;
          id: string;
          is_active: boolean;
          is_system_default: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          is_system_default?: boolean;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          is_system_default?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      item: {
        Row: {
          aliases: Json;
          created_at: string;
          default_category_id: string | null;
          id: string;
          merged_into_item_id: string | null;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          aliases?: Json;
          created_at?: string;
          default_category_id?: string | null;
          id?: string;
          merged_into_item_id?: string | null;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          aliases?: Json;
          created_at?: string;
          default_category_id?: string | null;
          id?: string;
          merged_into_item_id?: string | null;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_default_category_id_fkey";
            columns: ["default_category_id"];
            isOneToOne: false;
            referencedRelation: "category";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_merged_into_item_id_fkey";
            columns: ["merged_into_item_id"];
            isOneToOne: false;
            referencedRelation: "item";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_method: {
        Row: {
          card_issuer: string | null;
          card_kind: string | null;
          created_at: string;
          display_name: string;
          id: string;
          is_active: boolean;
          is_system_default: boolean;
          subtype: string | null;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          card_issuer?: string | null;
          card_kind?: string | null;
          created_at?: string;
          display_name: string;
          id?: string;
          is_active?: boolean;
          is_system_default?: boolean;
          subtype?: string | null;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          card_issuer?: string | null;
          card_kind?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          is_active?: boolean;
          is_system_default?: boolean;
          subtype?: string | null;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      synonym_dictionary: {
        Row: {
          created_at: string;
          group_key: string;
          id: string;
          term: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          group_key: string;
          id?: string;
          term: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          group_key?: string;
          id?: string;
          term?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      transaction: {
        Row: {
          adjustment_amount: number;
          amount: number;
          category_id: string;
          created_at: string;
          external_id: string | null;
          has_detail: boolean;
          id: string;
          input_type: string;
          memo: string | null;
          occurred_at: string;
          payment_method_id: string;
          raw_payload: Json | null;
          source_app: string | null;
          updated_at: string;
          user_id: string;
          vendor_id: string;
        };
        Insert: {
          adjustment_amount?: number;
          amount: number;
          category_id: string;
          created_at?: string;
          external_id?: string | null;
          has_detail?: boolean;
          id?: string;
          input_type: string;
          memo?: string | null;
          occurred_at: string;
          payment_method_id: string;
          raw_payload?: Json | null;
          source_app?: string | null;
          updated_at?: string;
          user_id: string;
          vendor_id: string;
        };
        Update: {
          adjustment_amount?: number;
          amount?: number;
          category_id?: string;
          created_at?: string;
          external_id?: string | null;
          has_detail?: boolean;
          id?: string;
          input_type?: string;
          memo?: string | null;
          occurred_at?: string;
          payment_method_id?: string;
          raw_payload?: Json | null;
          source_app?: string | null;
          updated_at?: string;
          user_id?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "category";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_method";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendor";
            referencedColumns: ["id"];
          },
        ];
      };
      transaction_detail: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          item_id: string;
          item_raw_text: string;
          quantity_raw_text: string | null;
          quantity_value: number | null;
          transaction_id: string;
          unit_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          item_id: string;
          item_raw_text: string;
          quantity_raw_text?: string | null;
          quantity_value?: number | null;
          transaction_id: string;
          unit_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          item_id?: string;
          item_raw_text?: string;
          quantity_raw_text?: string | null;
          quantity_value?: number | null;
          transaction_id?: string;
          unit_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_detail_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "item";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_detail_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transaction";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_detail_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "unit";
            referencedColumns: ["id"];
          },
        ];
      };
      unit: {
        Row: {
          created_at: string;
          id: string;
          is_system_default: boolean;
          name: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_system_default?: boolean;
          name: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_system_default?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      utility_bill_item: {
        Row: {
          created_at: string;
          has_usage: boolean;
          id: string;
          is_active: boolean;
          name: string;
          source_labels: Json;
          usage_unit: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          has_usage?: boolean;
          id?: string;
          is_active?: boolean;
          name: string;
          source_labels?: Json;
          usage_unit?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          has_usage?: boolean;
          id?: string;
          is_active?: boolean;
          name?: string;
          source_labels?: Json;
          usage_unit?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      utility_bill_item_value: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          item_id: string;
          meter_current: number | null;
          meter_previous: number | null;
          record_id: string;
          usage_value: number | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          item_id: string;
          meter_current?: number | null;
          meter_previous?: number | null;
          record_id: string;
          usage_value?: number | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          item_id?: string;
          meter_current?: number | null;
          meter_previous?: number | null;
          record_id?: string;
          usage_value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "utility_bill_item_value_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "utility_bill_item";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "utility_bill_item_value_record_id_fkey";
            columns: ["record_id"];
            isOneToOne: false;
            referencedRelation: "utility_bill_record";
            referencedColumns: ["id"];
          },
        ];
      };
      utility_bill_record: {
        Row: {
          created_at: string;
          file_path: string | null;
          id: string;
          period: string;
          source: string;
          transaction_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          file_path?: string | null;
          id?: string;
          period: string;
          source: string;
          transaction_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          file_path?: string | null;
          id?: string;
          period?: string;
          source?: string;
          transaction_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "utility_bill_record_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: true;
            referencedRelation: "transaction";
            referencedColumns: ["id"];
          },
        ];
      };
      vendor: {
        Row: {
          created_at: string;
          default_category_id: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          default_category_id?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          default_category_id?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vendor_default_category_id_fkey";
            columns: ["default_category_id"];
            isOneToOne: false;
            referencedRelation: "category";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      item_stats: {
        Row: {
          avg_amount: number | null;
          item_id: string | null;
          period: string | null;
          total_amount: number | null;
          transaction_count: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_detail_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "item";
            referencedColumns: ["id"];
          },
        ];
      };
      item_unit_stats: {
        Row: {
          avg_unit_price: number | null;
          item_id: string | null;
          period: string | null;
          total_amount: number | null;
          total_quantity: number | null;
          unit_id: string | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_detail_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "item";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_detail_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "unit";
            referencedColumns: ["id"];
          },
        ];
      };
      tx_stats: {
        Row: {
          category_id: string | null;
          payment_method_id: string | null;
          period: string | null;
          total_amount: number | null;
          transaction_count: number | null;
          user_id: string | null;
          vendor_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "category";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_method";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendor";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      get_item_stats: {
        Args: { p_period?: string };
        Returns: {
          avg_amount: number | null;
          item_id: string | null;
          period: string | null;
          total_amount: number | null;
          transaction_count: number | null;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "item_stats";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_item_unit_stats: {
        Args: { p_period?: string };
        Returns: {
          avg_unit_price: number | null;
          item_id: string | null;
          period: string | null;
          total_amount: number | null;
          total_quantity: number | null;
          unit_id: string | null;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "item_unit_stats";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_tx_stats: {
        Args: { p_period?: string };
        Returns: {
          category_id: string | null;
          payment_method_id: string | null;
          period: string | null;
          total_amount: number | null;
          transaction_count: number | null;
          user_id: string | null;
          vendor_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "tx_stats";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
