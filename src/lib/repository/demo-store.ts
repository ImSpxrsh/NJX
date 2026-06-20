import "server-only";
import { randomUUID } from "node:crypto";
import type {
  CheckRecord,
  ContactDestinationVerificationRecord,
  EnrollmentVerificationRecord,
  EvidenceExtraction,
  HouseholdRecord,
  PhoneAlertRecord,
  PhoneCallerRoute,
  PolicyDecision,
  PublicCheckRecord,
  TrustedContactRecord,
  VerificationRequestRecord,
  VerificationResponse,
} from "@/types/domain";
import { transitionCheck } from "@/lib/state/check-state-machine";
import {
  createVerificationToken,
  isValidTokenFormat,
} from "@/lib/security/tokens";
import { sha256 } from "@/lib/security/hashing";
import { normalizePhoneE164 } from "@/lib/security/phone";
import type {
  CircleCheckRepositories,
  ContactWriteInput,
  DestinationChallengeInput,
  VerificationContext,
  VerificationNotification,
} from "./contracts";
import {
  createEnrollmentDemoRepository,
  resetEnrollmentDemo,
} from "./enrollment-demo-store";

export type DemoStore = {
  checks: Map<string, CheckRecord>;
  requests: Map<string, VerificationRequestRecord>;
  phoneCallIds: Set<string>;
  phoneAlerts: Map<string, PhoneAlertRecord>;
  verificationNotifications: Map<string, VerificationNotification>;
  contacts: Map<string, TrustedContactRecord>;
  destinationChallenges: Map<string, ContactDestinationVerificationRecord>;
  enrollments: Map<string, EnrollmentVerificationRecord>;
};

export const householdId =
  process.env.DEMO_HOUSEHOLD_ID ?? "00000000-0000-4000-8000-000000000001";
const contactId =
  process.env.DEMO_TRUSTED_CONTACT_ID ?? "00000000-0000-4000-8000-000000000002";
const defaultCallerPhone = "+15555550100";

const demoHousehold: HouseholdRecord = {
  id: householdId,
  displayName: "CircleCheck Demo Household",
  createdAt: new Date(0).toISOString(),
};

function buildDemoContact(): TrustedContactRecord {
  return {
    id: contactId,
    householdId,
    displayName: "Demo Trusted Contact",
    phoneE164: null,
    email: "trusted-contact@example.test",
    channel: "manual_demo",
    destinationVerifiedAt: new Date(0).toISOString(),
    destinationVerifiedChannel: "email",
    updatedAt: new Date(0).toISOString(),
    createdAt: new Date(0).toISOString(),
  };
}

function seedContactsInto(target: Map<string, TrustedContactRecord>): void {
  target.set(contactId, buildDemoContact());
}

function createStore(): DemoStore {
  const contacts = new Map<string, TrustedContactRecord>();
  seedContactsInto(contacts);
  return {
    checks: new Map(),
    requests: new Map(),
    phoneCallIds: new Set(),
    phoneAlerts: new Map(),
    verificationNotifications: new Map(),
    contacts,
    destinationChallenges: new Map(),
    enrollments: new Map(),
  };
}

const globalStore = globalThis as typeof globalThis & {
  circleCheckStore?: DemoStore;
};

export const store =
  globalStore.circleCheckStore ??
  (globalStore.circleCheckStore = createStore());

export function seedContacts(): void {
  seedContactsInto(store.contacts);
}

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

export function expirePendingChecks() {
  const now = new Date();
  const nowIso = now.toISOString();
  let expiredChecks = 0;
  let expiredRequests = 0;

  for (const request of store.requests.values()) {
    if (
      request.status !== "PENDING" ||
      Date.parse(request.expiresAt) > now.getTime()
    ) {
      continue;
    }

    request.status = "EXPIRED";
    expiredRequests += 1;

    const check = store.checks.get(request.checkId);
    if (check?.state === "PENDING") {
      check.state = transitionCheck(check.state, "EXPIRED");
      check.updatedAt = nowIso;
      check.statusSource = "SYSTEM_EXPIRY";
      expiredChecks += 1;
    }
  }

  return { expiredChecks, expiredRequests };
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
      check.updatedAt = new Date().toISOString();
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
  request.usedAt = now;
  request.status = "COMPLETED";

  if (response === "CALL_ME") {
    return {
      ok: true as const,
      state: "PENDING" as const,
      message: "Callback requested. The check remains pending.",
    };
  }

  const terminalState =
    response === "CONFIRMED_MINE" ? ("VERIFIED" as const) : ("DENIED" as const);
  check.state = transitionCheck(check.state, terminalState);
  check.updatedAt = now;
  check.statusSource = "ENROLLED_CONTACT";
  return {
    ok: true as const,
    state: terminalState,
    message:
      terminalState === "VERIFIED"
        ? "The enrolled contact confirmed making this request."
        : "The enrolled contact denied making this request.",
  };
}

export function registerPhoneCall(callSid: string): boolean {
  const redactedId = sha256(callSid);
  if (store.phoneCallIds.has(redactedId)) return false;
  store.phoneCallIds.add(redactedId);
  return true;
}

export function resolveHouseholdForCaller(
  caller: string | null | undefined,
): PhoneCallerRoute | null {
  const normalizedCaller = normalizePhoneE164(caller);
  const configuredCaller = normalizePhoneE164(
    process.env.DEMO_CALLER_PHONE_E164 ?? defaultCallerPhone,
  );
  if (
    !normalizedCaller ||
    !configuredCaller ||
    sha256(normalizedCaller) !== sha256(configuredCaller)
  ) {
    return null;
  }
  return { householdId };
}

export function recordPhoneAlert(input: {
  callSid: string;
  householdId: string;
  checkId: string;
  verificationRequestId: string;
  pressedDigit: "1";
}): PhoneAlertRecord {
  const callSidHash = sha256(input.callSid);
  const existing = store.phoneAlerts.get(callSidHash);
  if (existing) return structuredClone(existing);
  const now = new Date().toISOString();
  const alert: PhoneAlertRecord = {
    id: randomUUID(),
    householdId: input.householdId,
    checkId: input.checkId,
    verificationRequestId: input.verificationRequestId,
    callSidHash,
    pressedDigit: input.pressedDigit,
    createdAt: now,
  };
  store.phoneAlerts.set(callSidHash, alert);
  return structuredClone(alert);
}

export function sendVerificationLink(input: {
  requestId: string;
  rawToken: string;
  appUrl: string;
}): VerificationNotification {
  if (process.env.DEMO_NOTIFICATION_FAIL === "1") {
    throw new Error("Demo notification delivery failed.");
  }
  const notification: VerificationNotification = {
    requestId: input.requestId,
    verificationUrl: `${input.appUrl.replace(/\/$/, "")}/verify/${input.rawToken}`,
    deliveredAt: new Date().toISOString(),
  };
  store.verificationNotifications.set(input.requestId, notification);
  return structuredClone(notification);
}

export function resetDemo() {
  store.checks.clear();
  store.requests.clear();
  store.phoneCallIds.clear();
  store.phoneAlerts.clear();
  store.verificationNotifications.clear();
  store.contacts.clear();
  store.destinationChallenges.clear();
  store.enrollments.clear();
  seedContacts();
  resetEnrollmentDemo();
}

function requireDemoHousehold(id: string) {
  if (id !== householdId) {
    throw new Error("Demo household unavailable.");
  }
}

function listContacts(forHousehold: string): TrustedContactRecord[] {
  return [...store.contacts.values()]
    .filter((contact) => contact.householdId === forHousehold)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((contact) => structuredClone(contact));
}

function createContact(input: ContactWriteInput): TrustedContactRecord {
  requireDemoHousehold(input.householdId);
  const now = new Date().toISOString();
  const record: TrustedContactRecord = {
    id: randomUUID(),
    householdId: input.householdId,
    displayName: input.displayName,
    phoneE164: input.phoneE164,
    email: input.email,
    channel: input.channel,
    destinationVerifiedAt: null,
    destinationVerifiedChannel: null,
    createdAt: now,
    updatedAt: now,
  };
  store.contacts.set(record.id, record);
  return structuredClone(record);
}

function updateContact(
  id: string,
  input: Omit<ContactWriteInput, "householdId">,
): TrustedContactRecord {
  const existing = store.contacts.get(id);
  if (!existing) throw new Error("Contact not found.");
  const now = new Date().toISOString();
  const updated: TrustedContactRecord = {
    ...existing,
    displayName: input.displayName,
    phoneE164: input.phoneE164,
    email: input.email,
    channel: input.channel,
    destinationVerifiedAt: null,
    destinationVerifiedChannel: null,
    updatedAt: now,
  };
  store.contacts.set(id, updated);
  for (const challenge of store.destinationChallenges.values()) {
    if (challenge.trustedContactId === id) challenge.consumed = true;
  }
  return structuredClone(updated);
}

function removeContact(id: string): void {
  store.contacts.delete(id);
  for (const [challengeId, challenge] of store.destinationChallenges) {
    if (challenge.trustedContactId === id) {
      store.destinationChallenges.delete(challengeId);
    }
  }
}

function createDestinationChallenge(
  input: DestinationChallengeInput,
): ContactDestinationVerificationRecord {
  for (const challenge of store.destinationChallenges.values()) {
    if (challenge.trustedContactId === input.trustedContactId) {
      challenge.consumed = true;
    }
  }
  const record: ContactDestinationVerificationRecord = {
    id: randomUUID(),
    trustedContactId: input.trustedContactId,
    householdId: input.householdId,
    channel: input.channel,
    codeHash: input.codeHash,
    expiresAt: input.expiresAt,
    attempts: 0,
    consumed: false,
    createdAt: new Date().toISOString(),
  };
  store.destinationChallenges.set(record.id, record);
  return structuredClone(record);
}

function getActiveChallenge(
  trustedContactId: string,
): ContactDestinationVerificationRecord | null {
  const active = [...store.destinationChallenges.values()]
    .filter(
      (challenge) =>
        challenge.trustedContactId === trustedContactId && !challenge.consumed,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return active.length ? structuredClone(active[0]) : null;
}

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
      async getPublicById(id, scope) {
        if (scope && scope.householdId !== householdId) return null;
        const check = getCheck(id);
        return check ? toPublicCheck(check) : null;
      },
      async getInternalById(id) {
        return getCheck(id);
      },
    },
    trustedContacts: {
      async getInternalById(id) {
        const contact = store.contacts.get(id);
        return contact ? structuredClone(contact) : null;
      },
      async getVerifiedForHousehold(id) {
        const verified = listContacts(id).find(
          (contact) => contact.destinationVerifiedAt !== null,
        );
        return verified ?? null;
      },
      async listForHousehold(id) {
        return listContacts(id);
      },
      async countForHousehold(id) {
        return listContacts(id).length;
      },
      async create(input) {
        return createContact(input);
      },
      async update(id, input) {
        return updateContact(id, input);
      },
      async remove(id) {
        removeContact(id);
      },
    },
    contactVerifications: {
      async createChallenge(input) {
        return createDestinationChallenge(input);
      },
      async getActiveChallenge(trustedContactId) {
        return getActiveChallenge(trustedContactId);
      },
      async registerFailedAttempt(challengeId) {
        const challenge = store.destinationChallenges.get(challengeId);
        if (!challenge) return 0;
        challenge.attempts += 1;
        return challenge.attempts;
      },
      async expireChallenge(challengeId) {
        const challenge = store.destinationChallenges.get(challengeId);
        if (challenge) challenge.consumed = true;
      },
      async completeChallenge(input) {
        const challenge = store.destinationChallenges.get(input.challengeId);
        if (challenge) challenge.consumed = true;
        const contact = store.contacts.get(input.trustedContactId);
        if (!contact) throw new Error("Contact not found.");
        contact.destinationVerifiedAt = input.verifiedAt;
        contact.destinationVerifiedChannel = input.channel;
        contact.updatedAt = input.verifiedAt;
        return structuredClone(contact);
      },
      async countStartsSince(id, sinceIso) {
        const since = Date.parse(sinceIso);
        return [...store.destinationChallenges.values()].filter(
          (challenge) =>
            challenge.householdId === id &&
            Date.parse(challenge.createdAt) >= since,
        ).length;
      },
    },
    enrollmentVerifications: createEnrollmentDemoRepository(),
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
    expiry: {
      async expirePendingChecks() {
        return expirePendingChecks();
      },
    },
    phoneAlerts: {
      async resolveHouseholdForCaller(caller) {
        return resolveHouseholdForCaller(caller);
      },
      async registerCall(callSid) {
        return registerPhoneCall(callSid);
      },
      async recordAlert(input) {
        return recordPhoneAlert(input);
      },
      async getInternalByCallHash(callSidHash) {
        const alert = store.phoneAlerts.get(callSidHash);
        return alert ? structuredClone(alert) : null;
      },
    },
    verificationNotifications: {
      async sendVerificationLink(input) {
        return sendVerificationLink(input);
      },
      async getInternalByRequestId(requestId) {
        const notification = store.verificationNotifications.get(requestId);
        return notification ? structuredClone(notification) : null;
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
