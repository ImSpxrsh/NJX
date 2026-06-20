import { TrustedContactForm } from "@/components/setup/TrustedContactForm";

export default function SetupPage() {
  return (
    <>
      <p className="eyebrow">Calm-time setup</p>
      <h1>Choose the number you already trust.</h1>
      <p className="lede">
        Verification destinations must be enrolled before an urgent request
        arrives. Never use a new number supplied by the requester.
      </p>
      <TrustedContactForm />
    </>
  );
}
