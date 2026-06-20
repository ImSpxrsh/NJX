"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CheckStatusResponse } from "@/types/api";
import { ReadAloudButton } from "@/components/accessibility/ReadAloudButton";
import { StatusBanner } from "@/components/accessibility/StatusBanner";

const headings = {
  RECEIVED: "This request is being checked.",
  PAUSED: "This request needs another check.",
  PENDING: "Waiting for your trusted contact. Do not act yet.",
  VERIFIED:
    "Your enrolled contact confirmed making this request. Continue to use caution.",
  DENIED:
    "Identity mismatch confirmed. Your enrolled contact says this request was not theirs.",
  EXPIRED:
    "Verification expired. Do not proceed. Start a new check or call a known number.",
} as const;

export function VerificationStatus({ checkId }: { checkId: string }) {
  const [data, setData] = useState<CheckStatusResponse | null>(null);
  const [contactUrl, setContactUrl] = useState<string | null>(null);

  useEffect(() => {
    const contactUrlTimer = window.setTimeout(() => {
      setContactUrl(sessionStorage.getItem(`circlecheck:${checkId}`));
    }, 0);
    let active = true;
    async function load() {
      const response = await fetch(`/api/checks/${checkId}`, {
        cache: "no-store",
      });
      if (response.ok && active) {
        setData((await response.json()) as CheckStatusResponse);
      }
    }
    void load();
    const interval = window.setInterval(load, 2500);
    return () => {
      active = false;
      window.clearTimeout(contactUrlTimer);
      window.clearInterval(interval);
    };
  }, [checkId]);

  if (!data) return <p role="status">Loading this check…</p>;
  const isHold = data.level === "L3" && data.state === "PENDING";
  const tone =
    data.state === "PENDING"
      ? isHold
        ? "hold"
        : "pending"
      : data.state === "VERIFIED" ||
          data.state === "DENIED" ||
          data.state === "EXPIRED"
        ? "final"
        : "status";

  return (
    <div className="grid">
      <StatusBanner tone={tone} title={headings[data.state]}>
        {isHold && (
          <p>
            <strong>
              Stop. Do not send money, gift cards, passwords, or verification
              codes.
            </strong>
          </p>
        )}
        <p>{data.contactResponseStatus}</p>
        {data.expiresAt && data.state === "PENDING" && (
          <p className="muted">
            This request expires at {new Date(data.expiresAt).toLocaleString()}.
          </p>
        )}
        <ReadAloudButton
          text={`${headings[data.state]} ${data.contactResponseStatus}`}
        />
      </StatusBanner>

      <section className="card">
        <p className="eyebrow">Verification level {data.level}</p>
        <h2>What CircleCheck noticed</h2>
        <p>{data.summary}</p>
        <div className="grid">
          {Object.values(data.signals)
            .filter((signal) => signal.present)
            .map((signal) => (
              <div className="signal" key={signal.name}>
                <strong>{signal.name.replace("_", " ")}</strong>
                <div>{signal.explanation}</div>
              </div>
            ))}
        </div>
      </section>

      {contactUrl && data.state === "PENDING" && (
        <section className="card">
          <p className="eyebrow">Demo delivery channel</p>
          <h2>Open the trusted-contact view</h2>
          <p>
            In production, this one-time link is sent to the pre-enrolled
            contact. It is shown here only for the deterministic hackathon demo.
          </p>
          <Link className="button" href={contactUrl}>
            Open contact link
          </Link>
        </section>
      )}
      <p>
        <Link href="/">Start a new check</Link>
      </p>
    </div>
  );
}
