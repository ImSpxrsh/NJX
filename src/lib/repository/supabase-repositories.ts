import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  CircleCheckRepositories,
  PendingVerificationCreator,
} from "./contracts";
import {
  SupabaseCheckDataSource,
  SupabaseCheckRepository,
} from "./supabase-check-repository";

function unsupported(name: string): never {
  throw new Error(`${name} is not configured for Supabase mode.`);
}

export function createSupabaseRepositories(
  client: SupabaseClient<Database>,
  pendingVerificationCreator?: PendingVerificationCreator,
): CircleCheckRepositories {
  return {
    checks: new SupabaseCheckRepository(
      new SupabaseCheckDataSource(client),
      pendingVerificationCreator,
      Number(process.env.VERIFICATION_TOKEN_TTL_MINUTES ?? 10),
    ),
    trustedContacts: {
      async getInternalById() {
        return unsupported("Trusted-contact repository");
      },
      async getVerifiedForHousehold() {
        return unsupported("Trusted-contact repository");
      },
    },
    verificationRequests: {
      async getContext() {
        return unsupported("Verification-request repository");
      },
      async respond() {
        return unsupported("Verification-request repository");
      },
      async getInternalById() {
        return unsupported("Verification-request repository");
      },
    },
    phoneAlerts: {
      async registerCall() {
        return unsupported("Phone-alert repository");
      },
      async getInternalByCallHash() {
        return unsupported("Phone-alert repository");
      },
    },
    households: {
      async getInternalById() {
        return unsupported("Household repository");
      },
    },
  };
}
