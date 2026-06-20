// Typed errors for the trusted-contact enrollment + verification domain.
// Carrying an HTTP status keeps route handlers thin: they catch ContactError
// and translate it directly, while the domain stays transport-agnostic.

export type ContactErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "LIMIT_EXCEEDED"
  | "CONFLICT"
  | "VERIFICATION_FAILED";

const STATUS_BY_CODE: Record<ContactErrorCode, number> = {
  VALIDATION: 422,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  LIMIT_EXCEEDED: 429,
  CONFLICT: 409,
  VERIFICATION_FAILED: 400,
};

export class ContactError extends Error {
  readonly code: ContactErrorCode;
  readonly status: number;

  constructor(code: ContactErrorCode, message: string) {
    super(message);
    this.name = "ContactError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}
