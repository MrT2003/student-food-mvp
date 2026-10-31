export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      cart_items: {
        Row: {
          cart_id: string;
          created_at: string;
          id: string;
          menu_item_id: string;
          option_hash: string;
          quantity: number;
          restaurant_id: string;
          selected_options: Json | null;
          updated_at: string;
        };
        Insert: {
          cart_id: string;
          created_at?: string;
          id?: string;
          menu_item_id: string;
          option_hash?: string;
          quantity: number;
          restaurant_id: string;
          selected_options?: Json | null;
          updated_at?: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          id?: string;
          menu_item_id?: string;
          option_hash?: string;
          quantity?: number;
          restaurant_id?: string;
          selected_options?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_cart_item_menu_restaurant";
            columns: ["menu_item_id", "restaurant_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id", "restaurant_id"];
          },
        ];
      };
      carts: {
        Row: {
          created_at: string;
          id: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_item_option_groups: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          is_multiple: boolean;
          is_required: boolean;
          menu_item_id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_multiple?: boolean;
          is_required?: boolean;
          menu_item_id: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_multiple?: boolean;
          is_required?: boolean;
          menu_item_id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_item_option_groups_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_item_options: {
        Row: {
          additional_price: number;
          created_at: string;
          group_id: string;
          id: string;
          is_active: boolean;
          option_name: string;
          updated_at: string;
        };
        Insert: {
          additional_price?: number;
          created_at?: string;
          group_id: string;
          id?: string;
          is_active?: boolean;
          option_name: string;
          updated_at?: string;
        };
        Update: {
          additional_price?: number;
          created_at?: string;
          group_id?: string;
          id?: string;
          is_active?: boolean;
          option_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_item_options_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "menu_item_option_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          category: string | null;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean;
          is_available: boolean;
          name: string;
          price: number;
          restaurant_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_available?: boolean;
          name: string;
          price: number;
          restaurant_id: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_available?: boolean;
          name?: string;
          price?: number;
          restaurant_id?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          content: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          related_order_id: string | null;
          title: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          related_order_id?: string | null;
          title?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          related_order_id?: string | null;
          title?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_related_order_id_fkey";
            columns: ["related_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          image_url: string | null;
          item_name_snapshot: string;
          menu_item_id: string | null;
          order_id: string;
          quantity: number;
          selected_options: Json | null;
          unit_price_snapshot: number;
        };
        Insert: {
          id?: string;
          image_url?: string | null;
          item_name_snapshot: string;
          menu_item_id?: string | null;
          order_id: string;
          quantity: number;
          selected_options?: Json | null;
          unit_price_snapshot: number;
        };
        Update: {
          id?: string;
          image_url?: string | null;
          item_name_snapshot?: string;
          menu_item_id?: string | null;
          order_id?: string;
          quantity?: number;
          selected_options?: Json | null;
          unit_price_snapshot?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          accepted_at: string | null;
          completed_at: string | null;
          created_at: string;
          customer_notes: string | null;
          delivery_address: string | null;
          id: string;
          order_code: string;
          order_status: Database["public"]["Enums"]["order_status"];
          payment_confirmed_at: string | null;
          payment_confirmed_by: string | null;
          payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null;
          restaurant_id: string;
          session_checkout_id: string;
          student_id: string;
          subtotal: number;
          total: number;
        };
        Insert: {
          accepted_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_notes?: string | null;
          delivery_address?: string | null;
          id?: string;
          order_code: string;
          order_status?: Database["public"]["Enums"]["order_status"];
          payment_confirmed_at?: string | null;
          payment_confirmed_by?: string | null;
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null;
          restaurant_id: string;
          session_checkout_id: string;
          student_id: string;
          subtotal: number;
          total: number;
        };
        Update: {
          accepted_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          customer_notes?: string | null;
          delivery_address?: string | null;
          id?: string;
          order_code?: string;
          order_status?: Database["public"]["Enums"]["order_status"];
          payment_confirmed_at?: string | null;
          payment_confirmed_by?: string | null;
          payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null;
          restaurant_id?: string;
          session_checkout_id?: string;
          student_id?: string;
          subtotal?: number;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_payment_confirmed_by_fkey";
            columns: ["payment_confirmed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          image_urls: string[] | null;
          is_contact_allowed: boolean;
          order_id: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          restaurant_id: string;
          status: string;
          student_id: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_urls?: string[] | null;
          is_contact_allowed?: boolean;
          order_id?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          restaurant_id: string;
          status?: string;
          student_id: string;
          type: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          image_urls?: string[] | null;
          is_contact_allowed?: boolean;
          order_id?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          restaurant_id?: string;
          status?: string;
          student_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_banks: {
        Row: {
          account_name: string;
          account_no: string;
          bank_name: string;
          created_at: string;
          id: string;
          is_default: boolean;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          account_name: string;
          account_no: string;
          bank_name: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          account_name?: string;
          account_no?: string;
          bank_name?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_banks_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurants: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          delivery_token: string;
          delivery_token_updated_at: string | null;
          description: string | null;
          id: string;
          location: string | null;
          name: string;
          operating_hours: Json | null;
          operating_status: string;
          owner_id: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          delivery_token?: string;
          delivery_token_updated_at?: string | null;
          description?: string | null;
          id?: string;
          location?: string | null;
          name: string;
          operating_hours?: Json | null;
          operating_status?: string;
          owner_id: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          delivery_token?: string;
          delivery_token_updated_at?: string | null;
          description?: string | null;
          id?: string;
          location?: string | null;
          name?: string;
          operating_hours?: Json | null;
          operating_status?: string;
          owner_id?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurants_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          app_lock_pin: string | null;
          avatar_url: string | null;
          created_at: string;
          id: string;
          name: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          status: string;
          updated_at: string;
          work_for_restaurant_id: string | null;
        };
        Insert: {
          app_lock_pin?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          id: string;
          name: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: string;
          updated_at?: string;
          work_for_restaurant_id?: string | null;
        };
        Update: {
          app_lock_pin?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: string;
          updated_at?: string;
          work_for_restaurant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_users_work_for_restaurant";
            columns: ["work_for_restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_order: { Args: { p_order_id: string }; Returns: Json };
      add_staff_by_phone: { Args: { p_staff_phone: string }; Returns: Json };
      add_to_cart: {
        Args: {
          p_menu_item_id: string;
          p_option_hash: string;
          p_quantity: number;
          p_restaurant_id: string;
          p_selected_options: Json;
        };
        Returns: Json;
      };
      cancel_order: { Args: { p_order_id: string }; Returns: Json };
      change_app_lock_pin: {
        Args: { p_current_pin: string; p_new_pin: string };
        Returns: Json;
      };
      complete_delivery: {
        Args: { p_delivery_token: string; p_order_id: string };
        Returns: Json;
      };
      create_checkout: {
        Args: { p_delivery_address: string; p_restaurant_preferences: Json };
        Returns: Json;
      };
      delete_cart_item: { Args: { p_cart_item_id: string }; Returns: Json };
      get_restaurant_orders: {
        Args: { p_restaurant_id: string };
        Returns: Json;
      };
      register_seller: {
        Args: {
          p_app_lock_pin?: string;
          p_avatar_url?: string;
          p_description?: string;
          p_location?: string;
          p_operating_hours?: Json;
          p_restaurant_name: string;
        };
        Returns: Json;
      };
      reject_order: { Args: { p_order_id: string }; Returns: Json };
      remove_staff: { Args: { p_staff_id: string }; Returns: Json };
      reset_delivery_token: {
        Args: { p_restaurant_id: string };
        Returns: string;
      };
      set_restaurant_operating_status: {
        Args: { p_operating_status: string; p_restaurant_id: string };
        Returns: Json;
      };
      update_cart_item_options:
        | {
            Args: {
              p_cart_item_id: string;
              p_menu_item_id: string;
              p_new_option_hash: string;
              p_new_quantity: number;
              p_new_selected_options: Json;
              p_restaurant_id: string;
            };
            Returns: Json;
          }
        | {
            Args: {
              p_cart_item_id: string;
              p_new_option_hash: string;
              p_new_quantity: number;
              p_new_selected_options: Json;
            };
            Returns: Json;
          };
      update_cart_item_quantity: {
        Args: { p_cart_item_id: string; p_quantity: number };
        Returns: Json;
      };
      update_my_profile: {
        Args: { p_avatar_url?: string; p_name: string; p_phone: string };
        Returns: Json;
      };
      update_restaurant_profile: {
        Args: {
          p_avatar_url: string;
          p_description: string;
          p_location: string;
          p_name: string;
          p_operating_hours: Json;
          p_restaurant_id: string;
        };
        Returns: Json;
      };
      verify_app_lock_pin: { Args: { p_app_lock_pin: string }; Returns: Json };
    };
    Enums: {
      order_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "cancelled"
        | "completed";
      payment_method_type: "cash" | "bank_transfer";
      user_role: "student" | "seller" | "staff";
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
  public: {
    Enums: {
      order_status: [
        "pending",
        "accepted",
        "rejected",
        "cancelled",
        "completed",
      ],
      payment_method_type: ["cash", "bank_transfer"],
      user_role: ["student", "seller", "staff"],
    },
  },
} as const;
