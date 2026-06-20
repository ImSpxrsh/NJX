"use client";

import { useState } from "react";
import { fixtures } from "@/fixtures/messages";
import type { AnalyzeResponse } from "@/types/api";

function getDemoContactUrl(result: AnalyzeResponse): string | null {
  const verification = result.verification;
  return verification && "demoContactUrl" in verification
    ? verification.demoContactUrl
    : null;
}

export function DemoControls() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const contactUrl = result ? getDemoContactUrl(result) : null;

  async function runDemo() {
    setBusy(true);
    await fetch("/api/demo/reset", { method: "POST" });
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        householdId: "00000000-0000-4000-8000-000000000001",
        message: fixtures.giftCardEmergency,
        mode: "fixture",
      }),
    });
    const body = (await response.json()) as AnalyzeResponse;
    const demoContactUrl = getDemoContactUrl(body);
    if (demoContactUrl) {
      sessionStorage.setItem(`circlecheck:${body.checkId}`, demoContactUrl);
    }
    setResult(body);
    setBusy(false);
  }

  return (
    <section className="card">
      <button disabled={busy} onClick={runDemo} type="button">
        {busy ? "Preparing demo…" : "Reset and create demo request"}
      </button>
      {result && (
        <div className="grid" style={{ marginTop: "1.5rem" }}>
          <a className="button" href={`/check/${result.checkId}`}>
            Open senior view
          </a>
          {contactUrl && (
            <a className="button secondary" href={contactUrl}>
              Open trusted-contact view
            </a>
          )}
        </div>
      )}
    </section>
  );
}
