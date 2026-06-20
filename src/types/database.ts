export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          display_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      trusted_contacts: {
        Row: {
          id: string;
          household_id: string;
          display_name: string;
          phone_e164: string | null;
          email: string | null;
          channel: string;
          destination_verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          display_name: string;
          phone_e164?: string | null;
          email?: string | null;
          channel: string;
          destination_verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          display_name?: string;
          phone_e164?: string | null;
          email?: string | null;
          channel?: string;
          destination_verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trusted_contacts_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      checks: {
        Row: {
          id: string;
          household_id: string;
          source: Database["public"]["Enums"]["check_source"];
          state: Database["public"]["Enums"]["check_state"];
          verification_level: Database["public"]["Enums"]["verification_level"];
          sanitized_summary: string;
          evidence_json: Json;
          policy_reasons: Json;
          created_at: string;
          updated_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          source: Database["public"]["Enums"]["check_source"];
          state: Database["public"]["Enums"]["check_state"];
          verification_level: Database["public"]["Enums"]["verification_level"];
          sanitized_summary: string;
          evidence_json: Json;
          policy_reasons: Json;
          created_at?: string;
          updated_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          household_id?: string;
          source?: Database["public"]["Enums"]["check_source"];
          state?: Database["public"]["Enums"]["check_state"];
          verification_level?: Database["public"]["Enums"]["verification_level"];
          sanitized_summary?: string;
          evidence_json?: Json;
          policy_reasons?: Json;
          created_at?: string;
          updated_at?: string;
          expires_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "checks_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_requests: {
        Row: {
          id: string;
          check_id: string;
          trusted_contact_id: string;
          token_hash: string;
          status: string;
          response: Database["public"]["Enums"]["verification_response"] | null;
          expires_at: string;
          used_at: string | null;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          check_id: string;
          trusted_contact_id: string;
          token_hash: string;
          status?: string;
          response?:
            | Database["public"]["Enums"]["verification_response"]
            | null;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          check_id?: string;
          trusted_contact_id?: string;
          token_hash?: string;
          status?: string;
          response?:
            | Database["public"]["Enums"]["verification_response"]
            | null;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
          responded_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "verification_requests_check_id_fkey";
            columns: ["check_id"];
            isOneToOne: false;
            referencedRelation: "checks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verification_requests_trusted_contact_id_fkey";
            columns: ["trusted_contact_id"];
            isOneToOne: false;
            referencedRelation: "trusted_contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      phone_alerts: {
        Row: {
          id: string;
          household_id: string;
          check_id: string;
          twilio_call_sid_hash: string;
          pressed_digit: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          check_id: string;
          twilio_call_sid_hash: string;
          pressed_digit: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          check_id?: string;
          twilio_call_sid_hash?: string;
          pressed_digit?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "phone_alerts_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "phone_alerts_check_id_fkey";
            columns: ["check_id"];
            isOneToOne: false;
            referencedRelation: "checks";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_pending_verification: {
        Args: {
          target_check_id: string;
          target_trusted_contact_id: string;
          supplied_token_hash: string;
          supplied_expires_at: string;
        };
        Returns: {
          request_id: string;
          expires_at: string;
        }[];
      };
      consume_verification_token: {
        Args: {
          supplied_token: string;
          supplied_response: Database["public"]["Enums"]["verification_response"];
        };
        Returns: {
          result_state: Database["public"]["Enums"]["check_state"];
          result_message: string;
        }[];
      };
    };
    Enums: {
      check_source: "web" | "phone";
      check_state:
        | "RECEIVED"
        | "PAUSED"
        | "PENDING"
        | "VERIFIED"
        | "DENIED"
        | "EXPIRED";
      verification_level: "L0" | "L1" | "L2" | "L3";
      verification_response: "CONFIRMED_MINE" | "DENIED_MINE" | "CALL_ME";
    };
    CompositeTypes: Record<never, never>;
  };
};

export type PublicSchema = Database["public"];
export type TableName = keyof PublicSchema["Tables"];
export type TableRow<T extends TableName> = PublicSchema["Tables"][T]["Row"];
export type TableInsert<T extends TableName> =
  PublicSchema["Tables"][T]["Insert"];
export type RpcName = keyof PublicSchema["Functions"];
export type RpcResult<T extends RpcName> =
  PublicSchema["Functions"][T]["Returns"];
