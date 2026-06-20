"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fixtures } from "@/fixtures/messages";
import type { AnalyzeResponse } from "@/types/api";

const householdId =
  process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD_ID ??
  "00000000-0000-4000-8000-000000000001";

export function MessageInput() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ householdId, message, mode: "fixture" }),
    });
    const body = (await response.json()) as AnalyzeResponse & {
      error?: string;
    };
    if (!response.ok) {
      setError(
        body.error ?? "We could not check this request. Do not act yet.",
      );
      setBusy(false);
      return;
    }
    const demoContactUrl =
      body.verification && "demoContactUrl" in body.verification
        ? body.verification.demoContactUrl
        : null;
    if (demoContactUrl) {
      sessionStorage.setItem(`circlecheck:${body.checkId}`, demoContactUrl);
    }
    router.push(`/check/${body.checkId}`);
  }

  return (
    <form className="card" onSubmit={submit}>
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
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button disabled={busy} type="submit">
          {busy ? "Checking…" : "Check this request"}
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => setMessage(fixtures.giftCardEmergency)}
        >
          Use sample message
        </button>
      </div>
    </form>
  );
}
