"use client";

import { useState } from "react";
import { PrintableSafetyCard } from "./PrintableSafetyCard";

export function TrustedContactForm() {
  const [trustedNumber, setTrustedNumber] = useState("(555) 010-2020");
  const circleCheckNumber =
    process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER ?? "(555) 010-1010";

  return (
    <>
      <form className="card" onSubmit={(event) => event.preventDefault()}>
        <p className="eyebrow">Demo setup data</p>
        <div className="grid">
          <label>
            Household display name
            <input defaultValue="The Rivera family" />
          </label>
          <label>
            Trusted-contact name
            <input defaultValue="Alex Rivera" />
          </label>
          <label>
            Contact destination
            <input defaultValue="alex@example.test" type="email" />
          </label>
          <label>
            Known callback number
            <input
              value={trustedNumber}
              onChange={(event) => setTrustedNumber(event.target.value)}
              type="tel"
            />
          </label>
        </div>
        <p className="muted">
          This prototype shows seeded demo data. Production enrollment and
          destination verification are not implemented.
        </p>
        <button type="button" onClick={() => window.print()}>
          Print safety card
        </button>
      </form>
      <PrintableSafetyCard
        circleCheckNumber={circleCheckNumber}
        trustedNumber={trustedNumber}
      />
    </>
  );
}
