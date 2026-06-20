import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, TableInsert } from "@/types/database";
import type { CheckRepository, PendingVerificationCreator } from "./contracts";
import { mapCheckRow, mapPublicCheckRow } from "./database-mappers";

export interface CheckDataSource {
  insertPaused(row: TableInsert<"checks">): Promise<unknown>;
  findById(id: string): Promise<unknown | null>;
}

export class SupabaseCheckDataSource implements CheckDataSource {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async insertPaused(row: TableInsert<"checks">): Promise<unknown> {
    const { data, error } = await this.client
      .from("checks")
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error("Unable to create check.");
    return data;
  }

  async findById(id: string): Promise<unknown | null> {
    const { data, error } = await this.client
      .from("checks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error("Unable to read check.");
    return data;
  }
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

export class SupabaseCheckRepository implements CheckRepository {
  constructor(
    private readonly dataSource: CheckDataSource,
    private readonly pendingVerificationCreator?: PendingVerificationCreator,
    private readonly tokenTtlMinutes = 10,
  ) {}

  async create(input: Parameters<CheckRepository["create"]>[0]) {
    const inserted = await this.dataSource.insertPaused({
      household_id: input.householdId,
      source: input.source,
      state: "PAUSED",
      verification_level: input.decision.level,
      sanitized_summary: input.extraction.plainLanguageSummary,
      evidence_json: toJson(input.extraction),
      policy_reasons: toJson(input.decision.reasons),
      expires_at: null,
    });
    const pausedCheck = mapPublicCheckRow(inserted);

    if (!input.decision.verificationRequired) {
      return { check: pausedCheck };
    }
    if (!this.pendingVerificationCreator) {
      throw new Error(
        "Trusted-contact verification is required, but transactional verification creation is unavailable.",
      );
    }

    const expiresAt = new Date(
      Date.now() + this.tokenTtlMinutes * 60_000,
    ).toISOString();
    const verification = await this.pendingVerificationCreator.create({
      checkId: pausedCheck.id,
      householdId: input.householdId,
      expiresAt,
    });
    const pendingRow = await this.dataSource.findById(pausedCheck.id);
    if (!pendingRow) throw new Error("Pending check could not be read.");
    const pendingCheck = mapPublicCheckRow(pendingRow);
    if (pendingCheck.state !== "PENDING") {
      throw new Error("Verification creation did not produce a pending check.");
    }
    return { check: pendingCheck, verification };
  }

  async getPublicById(id: string) {
    const row = await this.dataSource.findById(id);
    return row ? mapPublicCheckRow(row) : null;
  }

  async getInternalById(id: string) {
    const row = await this.dataSource.findById(id);
    return row ? mapCheckRow(row) : null;
  }
}
