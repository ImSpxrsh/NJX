export default function PhonePage() {
  const phone =
    process.env.TWILIO_PHONE_NUMBER ?? "the CircleCheck number on your card";
  return (
    <>
      <p className="eyebrow">Landline and phone help</p>
      <h1>Call. Press 1. Then use your known number.</h1>
      <section className="card">
        <ol>
          <li>
            Call <strong>{phone}</strong>.
          </li>
          <li>
            Press 1 for a request involving money, gift cards, a password, or a
            verification code.
          </li>
          <li>Hang up. Do not send anything yet.</li>
          <li>
            Call the trusted number already printed on your CircleCheck card.
          </li>
        </ol>
        <p>
          CircleCheck does not record, transcribe, or analyze your voice in this
          phone flow.
        </p>
      </section>
    </>
  );
}
