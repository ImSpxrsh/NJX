import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database";
import type {
  CircleCheckRepositories,
  ExpiryResult,
  PendingVerificationCreator,
} from "./contracts";
import {
  SupabaseCheckDataSource,
  SupabaseCheckRepository,
} from "./supabase-check-repository";
import {
  SupabasePendingVerificationCreator,
  SupabasePendingVerificationDataSource,
} from "./supabase-pending-verification";
import { mapHouseholdRow } from "./database-mappers";

function unsupported(name: string): never {
  throw new Error(`${name} is not configured for Supabase mode.`);
}

export function createSupabaseRepositories(
  client: SupabaseClient<Database>,
  pendingVerificationCreator: PendingVerificationCreator = new SupabasePendingVerificationCreator(
    new SupabasePendingVerificationDataSource(client),
  ),
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
      async listForHousehold() {
        return unsupported("Trusted-contact repository");
      },
      async countForHousehold() {
        return unsupported("Trusted-contact repository");
      },
      async create() {
        return unsupported("Trusted-contact repository");
      },
      async update() {
        return unsupported("Trusted-contact repository");
      },
      async remove() {
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
      async resolveHouseholdForCaller() {
        return unsupported("Phone-alert repository");
      },
      async registerCall() {
        return unsupported("Phone-alert repository");
      },
      async recordAlert() {
        return unsupported("Phone-alert repository");
      },
      async getInternalByCallHash() {
        return unsupported("Phone-alert repository");
      },
    },
    contactVerifications: {
      async createChallenge() {
        return unsupported("Contact-verification repository");
      },
      async getActiveChallenge() {
        return unsupported("Contact-verification repository");
      },
      async registerFailedAttempt() {
        return unsupported("Contact-verification repository");
      },
      async expireChallenge() {
        return unsupported("Contact-verification repository");
      },
      async completeChallenge() {
        return unsupported("Contact-verification repository");
      },
      async countStartsSince() {
        return unsupported("Contact-verification repository");
      },
    },
    enrollmentVerifications: {
      async createContact() {
        return unsupported("Enrollment-verification repository");
      },
      async start() {
        return unsupported("Enrollment-verification repository");
      },
      async confirmByToken() {
        return unsupported("Enrollment-verification repository");
      },
      async confirmByCode() {
        return unsupported("Enrollment-verification repository");
      },
      async getStatus() {
        return unsupported("Enrollment-verification repository");
      },
      async changeDestination() {
        return unsupported("Enrollment-verification repository");
      },
    },
    verificationNotifications: {
      async sendVerificationLink() {
        return unsupported("Verification-notification repository");
      },
      async getInternalByRequestId() {
        return unsupported("Verification-notification repository");
      },
    },
    expiry: {
      async expirePendingChecks(): Promise<ExpiryResult> {
        const { data, error } = await client.rpc("expire_pending_checks");
        if (error) throw new Error(`[supabase] expiry failed: ${error.message}`);
        const rpcResultSchema = z
          .array(
            z.object({
              expired_checks: z.number().int().nonnegative(),
              expired_requests: z.number().int().nonnegative(),
            }),
          )
          .min(1);
        const parsed = rpcResultSchema.parse(data);
        return {
          expiredChecks: parsed[0].expired_checks,
          expiredRequests: parsed[0].expired_requests,
        };
      },
    },
    households: {
      async getInternalById(id) {
        const { data } = await client
          .from("households")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        return data ? mapHouseholdRow(data) : null;
      },
    },
  };
}
