"use client";

import { useEffect, useState } from "react";
import type { VerificationResponse } from "@/types/domain";

type Context = {
  state: "PENDING" | "COMPLETED" | "EXPIRED";
  summary: string;
  requestedAction: string | null;
  createdAt: string;
  expiresAt: string;
};

export function ContactResponseForm({ token }: { token: string }) {
  const [context, setContext] = useState<Context | null>(null);
  const [selected, setSelected] = useState<VerificationResponse | null>(null);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/verification/context?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    }).then(async (response) => {
      if (response.ok) setContext((await response.json()) as Context);
      else setResult("This verification link is unavailable.");
    });
  }, [token]);

  async function submit() {
    if (!selected) return;
    setBusy(true);
    const response = await fetch("/api/verification/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, response: selected }),
    });
    const body = (await response.json()) as { message?: string; code?: string };
    setResult(
      body.message ??
        (body.code === "EXPIRED"
          ? "This verification request expired."
          : "This link cannot accept another response."),
    );
    if (response.ok && selected !== "CALL_ME") {
      setContext((current) =>
        current ? { ...current, state: "COMPLETED" } : current,
      );
    }
    setBusy(false);
  }

  if (result && !context) return <div className="status final">{result}</div>;
  if (!context) return <p>Loading request details…</p>;
  if (context.state !== "PENDING") {
    return (
      <div className="status final">
        {context.state === "EXPIRED"
          ? "This verification request expired. No approval was recorded."
          : result || "This verification request was already completed."}
      </div>
    );
  }
  return (
    <section className="card">
      <h2>Was this request yours?</h2>
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
        {[
          ["CONFIRMED_MINE", "Yes, this request was mine."],
          ["DENIED_MINE", "No, this request was not mine."],
          ["CALL_ME", "Call me."],
        ].map(([value, label]) => (
          <label className="signal" key={value}>
            <input
              style={{ width: 24, minHeight: 24, marginRight: 12 }}
              type="radio"
              name="response"
              value={value}
              checked={selected === value}
              onChange={() => setSelected(value as VerificationResponse)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <p>
        Confirm that your selection is accurate before sending. The confirmation
        link can only be completed once.
      </p>
      <button disabled={!selected || busy} onClick={submit} type="button">
        {busy ? "Sending…" : "Confirm and send response"}
      </button>
      {result && <p role="status">{result}</p>}
    </section>
  );
}
