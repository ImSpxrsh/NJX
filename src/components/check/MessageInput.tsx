"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fixtures } from "@/fixtures/messages";
import type { AnalyzeResponse } from "@/types/api";

const householdId =
  process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD_ID ??
  "00000000-0000-4000-8000-000000000001";

type FailureKind = "unavailable" | "timeout" | "generic";

const TIMEOUT_MS = 15_000;

export function MessageInput() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [failureKind, setFailureKind] = useState<FailureKind | null>(null);
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const resultRegionRef = useRef<HTMLDivElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setFailureKind(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort("timeout"),
      TIMEOUT_MS,
    );

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId, message, mode: "fixture" }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        const isUnavailable =
          response.status === 503 || response.status === 502;
        setFailureKind(isUnavailable ? "unavailable" : "generic");
        setError(
          body.error ?? "We could not check this request. Do not act yet.",
        );
        setBusy(false);
        window.setTimeout(() => errorRef.current?.focus(), 0);
        return;
      }

      const body = (await response.json()) as AnalyzeResponse & {
        error?: string;
      };
      const demoContactUrl =
        body.verification && "demoContactUrl" in body.verification
          ? body.verification.demoContactUrl
          : null;
      if (demoContactUrl) {
        sessionStorage.setItem(`circlecheck:${body.checkId}`, demoContactUrl);
      }
      router.push(`/check/${body.checkId}`);
    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout =
        err instanceof Error
          ? err.name === "AbortError"
          : String(err) === "timeout";
      setFailureKind(isTimeout ? "timeout" : "unavailable");
      setError(
        isTimeout
          ? "The check timed out. Do not act yet."
          : "The service is not reachable right now.",
      );
      setBusy(false);
      window.setTimeout(() => errorRef.current?.focus(), 0);
    }
  }

  const failureMessage =
    failureKind === "unavailable"
      ? "Service temporarily unavailable — do not act on this request. Instead, use a phone number you already know to verify directly."
      : failureKind === "timeout"
        ? "The check took too long — do not act on this request. Instead, use a phone number you already know to verify directly."
        : null;

  return (
    <form
      className="card"
      onSubmit={submit}
      aria-label="Check a suspicious request"
    >
      <div className="field">
        <label htmlFor="message">Paste or type the request</label>
        <textarea
          id="message"
          required
          maxLength={4000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Example: I need gift cards today. Please do not call anyone."
          aria-describedby="message-help"
        />
        <span className="muted" id="message-help">
          The original message is checked but is not stored.
        </span>
      </div>

      {error && (
        <div role="alert" aria-atomic="true" ref={resultRegionRef}>
          <p ref={errorRef} tabIndex={-1} style={{ outline: "none" }}>
            {error}
          </p>
          {failureMessage && <p className="muted">{failureMessage}</p>}
          {failureKind === "timeout" && (
            <button
              className="secondary"
              type="submit"
              aria-label="Retry checking this request"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div className="actions">
        <button
          disabled={busy}
          type="submit"
          aria-label={
            busy
              ? "Checking request, please wait"
              : "Check this request for warning signs"
          }
        >
          {busy ? "Checking…" : "Check this request"}
        </button>
        <button
          className="secondary"
          type="button"
          aria-label="Load a sample suspicious message to try CircleCheck"
          onClick={() => setMessage(fixtures.giftCardEmergency)}
        >
          Use sample message
        </button>
      </div>
    </form>
  );
}
