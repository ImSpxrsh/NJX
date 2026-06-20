import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database";
import type {
  PendingVerificationCreationInput,
  PendingVerificationCreator,
} from "./contracts";
import { createVerificationToken } from "@/lib/security/tokens";

type PendingVerificationRpcInput = {
  checkId: string;
  trustedContactId: string;
  tokenHash: string;
  expiresAt: string;
};

type PendingVerificationRpcResult = {
  requestId: string;
  expiresAt: string;
};

export interface PendingVerificationDataSource {
  getVerifiedContactId(householdId: string): Promise<string | null>;
  createPending(
    input: PendingVerificationRpcInput,
  ): Promise<PendingVerificationRpcResult>;
}

const rpcResultSchema = z
  .object({
    request_id: z.string().uuid(),
    expires_at: z.string().datetime({ offset: true }),
  })
  .strict();

export class SupabasePendingVerificationDataSource implements PendingVerificationDataSource {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getVerifiedContactId(householdId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("trusted_contacts")
      .select("id")
      .eq("household_id", householdId)
      .not("destination_verified_at", "is", null)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Unable to select trusted contact.");
    return data?.id ?? null;
  }

  async createPending(
    input: PendingVerificationRpcInput,
  ): Promise<PendingVerificationRpcResult> {
    const { data, error } = await this.client.rpc(
      "create_pending_verification",
      {
        target_check_id: input.checkId,
        target_trusted_contact_id: input.trustedContactId,
        supplied_token_hash: input.tokenHash,
        supplied_expires_at: input.expiresAt,
      },
    );
    if (error) throw new Error("Unable to create verification request.");
    const parsed = rpcResultSchema.parse(data?.[0]);
    return {
      requestId: parsed.request_id,
      expiresAt: parsed.expires_at,
    };
  }
}

export class SupabasePendingVerificationCreator implements PendingVerificationCreator {
  constructor(private readonly dataSource: PendingVerificationDataSource) {}

  async create(input: PendingVerificationCreationInput) {
    const trustedContactId = await this.dataSource.getVerifiedContactId(
      input.householdId,
    );
    if (!trustedContactId) {
      throw new Error("No verified trusted contact is available.");
    }
    const { rawToken, tokenHash } = createVerificationToken();
    const result = await this.dataSource.createPending({
      checkId: input.checkId,
      trustedContactId,
      tokenHash,
      expiresAt: input.expiresAt,
    });
    return {
      requestId: result.requestId,
      expiresAt: result.expiresAt,
      rawToken,
    };
  }
}
