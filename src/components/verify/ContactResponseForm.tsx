"use client";

import { useEffect, useRef, useState } from "react";
import type { VerificationResponse } from "@/types/domain";

type Context = {
  state: "PENDING" | "COMPLETED" | "EXPIRED";
  summary: string;
  policyLevel: string;
  requestedAction: string | null;
  createdAt: string;
  expiresAt: string;
};

type Step = "select" | "confirm";

type ErrorKind =
  | "expired"
  | "already_used"
  | "unknown_token"
  | "network"
  | "generic";

function errorMessage(kind: ErrorKind): string {
  switch (kind) {
    case "expired":
      return "This verification link has expired. No response was recorded.";
    case "already_used":
      return "This link has already been used. Your previous response stands.";
    case "unknown_token":
      return "This verification link is not recognised. It may have already been used or may be invalid.";
    case "network":
      return "A network error occurred. Your response was not sent. Do not act — try again or use a phone number you already know.";
    case "generic":
      return "An unexpected error occurred. Your response was not sent.";
  }
}

function codeToErrorKind(code: string | undefined, status: number): ErrorKind {
  if (code === "EXPIRED") return "expired";
  if (code === "ALREADY_USED" || status === 409) return "already_used";
  if (status === 404) return "unknown_token";
  return "generic";
}

export function ContactResponseForm({ token }: { token: string }) {
  const [context, setContext] = useState<Context | null>(null);
  const [loadError, setLoadError] = useState<ErrorKind | null>(null);
  const [selected, setSelected] = useState<VerificationResponse | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [submitError, setSubmitError] = useState<ErrorKind | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmHeadingRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/verification/context?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!active) return;
        if (response.ok) {
          setContext((await response.json()) as Context);
        } else {
          const body = (await response.json().catch(() => ({}))) as {
            code?: string;
          };
          setLoadError(codeToErrorKind(body.code, response.status));
        }
      })
      .catch(() => {
        if (active) setLoadError("network");
      });
    return () => {
      active = false;
    };
  }, [token]);

  // If page is revisited (back/refresh) and context is already COMPLETED/EXPIRED,
  // the server-loaded state shows the "already responded" guard without any
  // additional client-side check needed — context.state !== "PENDING" handles it.

  function advanceToConfirm() {
    if (!selected) return;
    setStep("confirm");
    window.setTimeout(() => confirmHeadingRef.current?.focus(), 0);
  }

  function backToSelect() {
    setStep("select");
    setSubmitError(null);
  }

  async function submitFinal() {
    if (!selected || busy || submitted) return;
    setBusy(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/verification/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, response: selected }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        code?: string;
      };

      if (response.ok) {
        setSubmitted(true);
        if (selected !== "CALL_ME") {
          setContext((current) =>
            current ? { ...current, state: "COMPLETED" } : current,
          );
        }
        window.setTimeout(() => doneRef.current?.focus(), 0);
      } else {
        setSubmitError(codeToErrorKind(body.code, response.status));
      }
    } catch {
      setSubmitError("network");
    } finally {
      setBusy(false);
    }
  }

  // --- Terminal states ---

  if (loadError) {
    return (
      <div role="alert" aria-atomic="true" className="status final">
        {errorMessage(loadError)}
      </div>
    );
  }

  if (!context) {
    return <p role="status">Loading request details…</p>;
  }

  if (context.state === "EXPIRED") {
    return (
      <div role="alert" aria-atomic="true" className="status final">
        This verification request expired. No approval was recorded.
      </div>
    );
  }

  if (context.state === "COMPLETED" || submitted) {
    const callMePending = selected === "CALL_ME" && submitted;
    return (
      <div
        role="alert"
        aria-atomic="true"
        className="status final"
        ref={doneRef}
        tabIndex={-1}
        style={{ outline: "none" }}
      >
        {callMePending ? (
          <>
            <p>
              <strong>Your &ldquo;Call me&rdquo; response was recorded.</strong>
            </p>
            <p>
              The original check remains pending. The household has been
              notified to call you back on a number they already know.
            </p>
          </>
        ) : (
          <p>This verification request was already completed. Thank you.</p>
        )}
      </div>
    );
  }

  const responseLabels: [VerificationResponse, string][] = [
    ["CONFIRMED_MINE", "Yes, this request was mine."],
    ["DENIED_MINE", "No, this request was not mine."],
    ["CALL_ME", "Call me."],
  ];

  // --- Step 1: select ---

  if (step === "select") {
    return (
      <section className="card" aria-label="Select your response">
        <h2>Was this request yours?</h2>

        <p className="eyebrow">Policy level: {context.policyLevel ?? "—"}</p>
        <p>{context.summary}</p>
        <p>
          <strong>Requested action:</strong>{" "}
          {context.requestedAction ?? "No specific action identified"}
        </p>
        <p className="muted">
          Expires {new Date(context.expiresAt).toLocaleString()}
        </p>

        <fieldset className="grid">
          <legend>Select one response</legend>
          {responseLabels.map(([value, label]) => (
            <label className="signal" key={value}>
              <input
                style={{ width: 24, minHeight: 24, marginRight: 12 }}
                type="radio"
                name="response"
                value={value}
                checked={selected === value}
                onChange={() => setSelected(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <p className="muted">
          <strong>Important:</strong> Your response is final and cannot be
          changed. The link can only be used once.
        </p>

        <button
          disabled={!selected}
          type="button"
          onClick={advanceToConfirm}
          aria-label="Continue to review and confirm your response"
        >
          Review response
        </button>
      </section>
    );
  }

  // --- Step 2: confirm ---

  const selectedLabel =
    responseLabels.find(([v]) => v === selected)?.[1] ?? selected;

  return (
    <section className="card" aria-label="Confirm your response">
      <h2 ref={confirmHeadingRef} tabIndex={-1} style={{ outline: "none" }}>
        Confirm your response
      </h2>

      <p>
        You selected: <strong>{selectedLabel}</strong>
      </p>

      {selected === "CALL_ME" && (
        <p>
          Choosing &ldquo;Call me&rdquo; will notify the household to call you
          on a number they already know.{" "}
          <strong>The original check remains pending</strong> until a final
          response is given.
        </p>
      )}

      <p>
        <strong>
          This action is irreversible. Once submitted this link cannot be used
          again.
        </strong>
      </p>

      {submitError && (
        <p role="alert" aria-atomic="true">
          {errorMessage(submitError)}
        </p>
      )}

      <div className="actions">
        <button
          type="button"
          disabled={busy || submitted}
          onClick={submitFinal}
          aria-label={`Submit response: ${selectedLabel}`}
        >
          {busy ? "Sending…" : "Submit response"}
        </button>
        <button
          className="secondary"
          type="button"
          disabled={busy || submitted}
          onClick={backToSelect}
          aria-label="Go back and change your selection"
        >
          Go back
        </button>
      </div>
    </section>
  );
}
