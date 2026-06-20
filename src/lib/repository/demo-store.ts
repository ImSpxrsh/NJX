import "server-only";
import { randomUUID } from "node:crypto";
import type {
  CheckRecord,
  HouseholdRecord,
  PhoneAlertRecord,
  PublicCheckRecord,
  TrustedContactRecord,
  VerificationRequestRecord,
  VerificationResponse,
} from "@/types/domain";
import type { EvidenceExtraction, PolicyDecision } from "@/types/domain";
import { transitionCheck } from "@/lib/state/check-state-machine";
import {
  createVerificationToken,
  isValidTokenFormat,
} from "@/lib/security/tokens";
import { sha256 } from "@/lib/security/hashing";
import type { CircleCheckRepositories, VerificationContext } from "./contracts";

type Store = {
  checks: Map<string, CheckRecord>;
  requests: Map<string, VerificationRequestRecord>;
  phoneCallIds: Set<string>;
  phoneAlerts: Map<string, PhoneAlertRecord>;
};

const globalStore = globalThis as typeof globalThis & {
  circleCheckStore?: Store;
};

const store =
  globalStore.circleCheckStore ??
  (globalStore.circleCheckStore = {
    checks: new Map(),
    requests: new Map(),
    phoneCallIds: new Set(),
    phoneAlerts: new Map(),
  });

const householdId =
  process.env.DEMO_HOUSEHOLD_ID ?? "00000000-0000-4000-8000-000000000001";
const contactId =
  process.env.DEMO_TRUSTED_CONTACT_ID ?? "00000000-0000-4000-8000-000000000002";

export function createCheck(input: {
  extraction: EvidenceExtraction;
  decision: PolicyDecision;
  source?: "web" | "phone";
}) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const base: CheckRecord = {
    id,
    householdId,
    source: input.source ?? "web",
    state: transitionCheck("RECEIVED", "PAUSED"),
    verificationLevel: input.decision.level,
    sanitizedSummary: input.extraction.plainLanguageSummary,
    extraction: input.extraction,
    policyReasons: input.decision.reasons,
    requestedAction: input.extraction.requestedAction,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
    statusSource: "POLICY_ENGINE",
  };

  let verification:
    | {
        requestId: string;
        rawToken: string;
        expiresAt: string;
      }
    | undefined;

  if (input.decision.verificationRequired) {
    const ttl = Number(process.env.VERIFICATION_TOKEN_TTL_MINUTES ?? 10);
    const expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();
    const { rawToken, tokenHash } = createVerificationToken();
    const requestId = randomUUID();
    base.state = transitionCheck(base.state, "PENDING");
    base.expiresAt = expiresAt;
    base.statusSource = "NO_RESPONSE";
    store.requests.set(requestId, {
      id: requestId,
      checkId: id,
      trustedContactId: contactId,
      tokenHash,
      status: "PENDING",
      response: null,
      expiresAt,
      usedAt: null,
      createdAt: now,
      respondedAt: null,
    });
    verification = { requestId, rawToken, expiresAt };
  }
  store.checks.set(id, base);
  return { check: structuredClone(base), verification };
}

export function getCheck(id: string): CheckRecord | null {
  const check = store.checks.get(id);
  if (!check) return null;
  if (
    check.state === "PENDING" &&
    check.expiresAt &&
    Date.parse(check.expiresAt) <= Date.now()
  ) {
    check.state = transitionCheck(check.state, "EXPIRED");
    check.updatedAt = new Date().toISOString();
    check.statusSource = "SYSTEM_EXPIRY";
  }
  return structuredClone(check);
}

function toPublicCheck(check: CheckRecord): PublicCheckRecord {
  const signals = Object.fromEntries(
    Object.entries(check.extraction.signals).map(([name, signal]) => [
      name,
      {
        name: signal.name,
        score: signal.score,
        present: signal.present,
        explanation: signal.explanation,
      },
    ]),
  ) as PublicCheckRecord["signals"];
  return {
    id: check.id,
    source: check.source,
    state: check.state,
    verificationLevel: check.verificationLevel,
    sanitizedSummary: check.sanitizedSummary,
    policyReasons: check.policyReasons,
    requestedAction: check.requestedAction,
    createdAt: check.createdAt,
    updatedAt: check.updatedAt,
    expiresAt: check.expiresAt,
    statusSource: check.statusSource,
    signals,
  };
}

export function getVerificationContext(
  rawToken: string,
): VerificationContext | null {
  if (!isValidTokenFormat(rawToken)) return null;
  const tokenHash = sha256(rawToken);
  const request = [...store.requests.values()].find(
    (candidate) => candidate.tokenHash === tokenHash,
  );
  if (!request) return null;
  const check = getCheck(request.checkId);
  if (!check) return null;
  return {
    state:
      request.usedAt || request.status === "COMPLETED"
        ? "COMPLETED"
        : Date.parse(request.expiresAt) <= Date.now()
          ? "EXPIRED"
          : "PENDING",
    summary: check.sanitizedSummary,
    requestedAction: check.requestedAction,
    createdAt: check.createdAt,
    expiresAt: request.expiresAt,
  };
}

export function respondToVerification(
  rawToken: string,
  response: VerificationResponse,
) {
  if (!isValidTokenFormat(rawToken)) {
    return { ok: false as const, code: "INVALID_TOKEN" as const };
  }
  const tokenHash = sha256(rawToken);
  const request = [...store.requests.values()].find(
    (candidate) => candidate.tokenHash === tokenHash,
  );
  if (!request) return { ok: false as const, code: "UNKNOWN_TOKEN" as const };
  if (request.usedAt || request.status !== "PENDING") {
    return { ok: false as const, code: "ALREADY_USED" as const };
  }
  const check = store.checks.get(request.checkId);
  if (!check) return { ok: false as const, code: "UNKNOWN_TOKEN" as const };
  if (Date.parse(request.expiresAt) <= Date.now()) {
    request.status = "EXPIRED";
    if (check.state === "PENDING") {
      check.state = transitionCheck(check.state, "EXPIRED");
      check.statusSource = "SYSTEM_EXPIRY";
    }
    return { ok: false as const, code: "EXPIRED" as const };
  }
  if (check.state !== "PENDING") {
    return { ok: false as const, code: "ALREADY_USED" as const };
  }
  const superseded = [...store.requests.values()].some(
    (candidate) =>
      candidate.checkId === request.checkId &&
      Date.parse(candidate.createdAt) > Date.parse(request.createdAt),
  );
  if (superseded) {
    return { ok: false as const, code: "ALREADY_USED" as const };
  }

  const now = new Date().toISOString();
  request.response = response;
  request.respondedAt = now;

  if (response === "CALL_ME") {
    request.usedAt = now;
    request.status = "COMPLETED";
    return {
      ok: true as const,
      state: "PENDING" as const,
      message: "Callback requested. The check remains pending.",
    };
  }

  request.usedAt = now;
  request.status = "COMPLETED";
  check.state = transitionCheck(
    check.state,
    response === "CONFIRMED_MINE" ? "VERIFIED" : "DENIED",
  );
  check.updatedAt = now;
  check.statusSource = "ENROLLED_CONTACT";
  return {
    ok: true as const,
    state: check.state,
    message: "Verification response recorded.",
  };
}

export function registerPhoneCall(callSid: string): boolean {
  const redactedId = sha256(callSid);
  if (store.phoneCallIds.has(redactedId)) return false;
  store.phoneCallIds.add(redactedId);
  return true;
}

export function resetDemo() {
  store.checks.clear();
  store.requests.clear();
  store.phoneCallIds.clear();
  store.phoneAlerts.clear();
}

const demoHousehold: HouseholdRecord = {
  id: householdId,
  displayName: "CircleCheck Demo Household",
  createdAt: new Date(0).toISOString(),
};

const demoContact: TrustedContactRecord = {
  id: contactId,
  householdId,
  displayName: "Demo Trusted Contact",
  phoneE164: null,
  email: "trusted-contact@example.test",
  channel: "manual_demo",
  destinationVerifiedAt: new Date(0).toISOString(),
  createdAt: new Date(0).toISOString(),
};

export function createDemoRepositories(): CircleCheckRepositories {
  return {
    checks: {
      async create(input) {
        if (input.householdId !== householdId) {
          throw new Error("Demo household unavailable.");
        }
        const result = createCheck({
          extraction: input.extraction,
          decision: input.decision,
          source: input.source,
        });
        return {
          check: toPublicCheck(result.check),
          verification: result.verification,
        };
      },
      async getPublicById(id) {
        const check = getCheck(id);
        return check ? toPublicCheck(check) : null;
      },
      async getInternalById(id) {
        return getCheck(id);
      },
    },
    trustedContacts: {
      async getInternalById(id) {
        return id === demoContact.id ? structuredClone(demoContact) : null;
      },
      async getVerifiedForHousehold(id) {
        return id === householdId ? structuredClone(demoContact) : null;
      },
    },
    verificationRequests: {
      async getContext(rawToken) {
        return getVerificationContext(rawToken);
      },
      async respond(rawToken, response) {
        return respondToVerification(rawToken, response);
      },
      async getInternalById(id) {
        const request = store.requests.get(id);
        return request ? structuredClone(request) : null;
      },
    },
    phoneAlerts: {
      async registerCall(callSid) {
        return registerPhoneCall(callSid);
      },
      async getInternalByCallHash(callSidHash) {
        const alert = store.phoneAlerts.get(callSidHash);
        return alert ? structuredClone(alert) : null;
      },
    },
    households: {
      async getInternalById(id) {
        return id === householdId ? structuredClone(demoHousehold) : null;
      },
    },
    async resetDemo() {
      resetDemo();
    },
  };
}
