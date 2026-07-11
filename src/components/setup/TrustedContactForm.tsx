"use client";

import { useState } from "react";
import { PrintableSafetyCard } from "./PrintableSafetyCard";

type Step = "contact" | "verify" | "complete";
type Channel = "sms" | "email";

type ContactData = {
  contactId: string;
  displayName: string;
  channel: Channel;
  destination: string;
};

type VerificationData = {
  verificationId: string;
  expiresAt: string;
  demoCode?: string;
  demoVerifyUrl?: string;
};

const HOUSEHOLD_ID =
  process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD_ID ??
  "00000000-0000-4000-8000-000000000001";

export function TrustedContactForm() {
  const [step, setStep] = useState<Step>("contact");
  const [contact, setContact] = useState<ContactData | null>(null);
  const [verification, setVerification] = useState<VerificationData | null>(
    null,
  );
  const [trustedNumber, setTrustedNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const circleCheckNumber =
    process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER ?? "(555) 010-1010";

  async function handleContactSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const form = event.currentTarget;
      const data = new FormData(form);
      const displayName = (data.get("displayName") as string).trim();
      const channel = data.get("channel") as Channel;
      const destination = (data.get("destination") as string).trim();

      const res = await fetch("/api/enrollment/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: HOUSEHOLD_ID,
          displayName,
          channel,
          destination,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          (body as { error?: string }).error ??
            "Could not save contact. Check the destination and try again.",
        );
        return;
      }
      const body = (await res.json()) as {
        contactId: string;
        channel: Channel;
      };
      const savedContact: ContactData = {
        contactId: body.contactId,
        displayName,
        channel,
        destination,
      };
      setContact(savedContact);
      if (channel === "sms") setTrustedNumber(destination);

      const startRes = await fetch("/api/enrollment/verify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: HOUSEHOLD_ID,
          trustedContactId: body.contactId,
        }),
      });
      if (!startRes.ok) {
        setError("Contact saved but could not send verification. Try again.");
        return;
      }
      const startBody = await startRes.json();
      setVerification({
        verificationId: startBody.verificationId,
        expiresAt: startBody.expiresAt,
        demoCode: startBody.demo?.code,
        demoVerifyUrl: startBody.demo?.verifyUrl,
      });
      setStep("verify");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contact) return;
    setError(null);
    setBusy(true);
    try {
      const data = new FormData(event.currentTarget);
      const code = (data.get("code") as string).trim();

      const res = await fetch("/api/enrollment/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trustedContactId: contact.contactId,
          code,
        }),
      });
      if (res.status === 429) {
        setError("Too many attempts. Wait a moment before trying again.");
        return;
      }
      if (!res.ok) {
        setError("That code did not match. Check the code and try again.");
        return;
      }
      setStep("complete");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (!contact) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/enrollment/verify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: HOUSEHOLD_ID,
          trustedContactId: contact.contactId,
        }),
      });
      if (res.status === 429) {
        setError("Too many resend attempts. Wait a few minutes.");
        return;
      }
      if (!res.ok) {
        setError("Could not resend. Try again shortly.");
        return;
      }
      const body = await res.json();
      setVerification({
        verificationId: body.verificationId,
        expiresAt: body.expiresAt,
        demoCode: body.demo?.code,
        demoVerifyUrl: body.demo?.verifyUrl,
      });
    } catch {
      setError("Network error while resending.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {step === "contact" && (
        <form className="card" onSubmit={handleContactSubmit}>
          <p className="eyebrow">Step 1 of 3 — Contact details</p>
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <div className="grid">
            <label>
              Contact name
              <input
                name="displayName"
                required
                maxLength={120}
                placeholder="e.g. Alex Rivera"
                autoComplete="off"
              />
            </label>
            <label>
              Channel
              <select name="channel" required defaultValue="sms">
                <option value="sms">SMS / text message</option>
                <option value="email">Email</option>
              </select>
            </label>
            <label>
              Destination
              <input
                name="destination"
                required
                maxLength={254}
                placeholder="Phone number or email address"
                autoComplete="off"
              />
            </label>
          </div>
          <p className="muted">
            We will send a verification code to confirm you control this
            destination before it can receive alerts.
          </p>
          <button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save and verify"}
          </button>
        </form>
      )}

      {step === "verify" && contact && verification && (
        <form className="card" onSubmit={handleVerifySubmit}>
          <p className="eyebrow">Step 2 of 3 — Verify destination</p>
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <p>
            A verification code was sent to{" "}
            <strong>{contact.destination}</strong> via{" "}
            {contact.channel === "sms" ? "SMS" : "email"}.
          </p>
          {verification.demoCode && (
            <p className="demo-notice">
              Demo mode — code: <strong>{verification.demoCode}</strong>
            </p>
          )}
          {verification.demoVerifyUrl && (
            <p className="demo-notice">
              Demo mode — verify link:{" "}
              <a href={verification.demoVerifyUrl}>
                {verification.demoVerifyUrl}
              </a>
            </p>
          )}
          <div className="grid">
            <label>
              Verification code
              <input
                name="code"
                required
                inputMode="numeric"
                maxLength={8}
                placeholder="8-digit code"
                autoComplete="one-time-code"
              />
            </label>
          </div>
          <p className="muted">
            Code expires at{" "}
            {new Date(verification.expiresAt).toLocaleTimeString()}.{" "}
            <button
              type="button"
              className="link-button"
              disabled={busy}
              onClick={handleResend}
            >
              Resend code
            </button>
          </p>
          <button type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Confirm code"}
          </button>
        </form>
      )}

      {step === "complete" && contact && (
        <>
          <div className="card">
            <p className="eyebrow">Step 3 of 3 — Complete</p>
            <p>
              <strong>{contact.displayName}</strong> is enrolled and verified.
              They will receive alerts when you submit a suspicious message.
            </p>
            <p className="muted">
              Print the safety card below and keep it near your phone. Share the
              callback number with your household.
            </p>
            <button type="button" onClick={() => window.print()}>
              Print safety card
            </button>
          </div>
          <PrintableSafetyCard
            circleCheckNumber={circleCheckNumber}
            trustedNumber={trustedNumber}
          />
        </>
      )}
    </>
  );
}
