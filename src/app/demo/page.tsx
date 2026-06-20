"use client";

import { useState } from "react";
import { fixtures } from "@/fixtures/messages";
import type { AnalyzeResponse, AnalyzeDemoResponse } from "@/types/api";

function isDemoResponse(r: AnalyzeResponse): r is AnalyzeDemoResponse {
  return "demoContactUrl" in r;
}

export default function DemoPage() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (isDemoResponse(body)) {
      sessionStorage.setItem(`circlecheck:${body.checkId}`, body.demoContactUrl);
    }
    setResult(body);
    setBusy(false);
  }

  return (
    <>
      <p className="eyebrow">Deterministic presentation mode</p>
      <h1>Run the complete safety loop without an AI key.</h1>
      <p className="lede">
        This resets temporary demo state and loads the gift-card emergency
        fixture.
      </p>
      <section className="card">
        <button disabled={busy} onClick={runDemo} type="button">
          {busy ? "Preparing demo…" : "Reset and create demo request"}
        </button>
        {result && (
          <div className="grid" style={{ marginTop: "1.5rem" }}>
            <a className="button" href={`/check/${result.checkId}`}>
              Open senior view
            </a>
            {isDemoResponse(result) && (
              <a
                className="button secondary"
                href={result.demoContactUrl}
              >
                Open trusted-contact view
              </a>
            )}
          </div>
        )}
      </section>
    </>
  );
}
