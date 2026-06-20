export function PrintableSafetyCard({
  circleCheckNumber,
  trustedNumber,
}: {
  circleCheckNumber: string;
  trustedNumber: string;
}) {
  return (
    <div className="print-card-wrapper">
      <article className="print-card">
        <p>CIRCLECHECK SAFETY CARD</p>
        <strong>Stop. Do not send money or codes until you verify.</strong>
        <hr />
        <p>
          Call CircleCheck
          <strong>{circleCheckNumber || "Number to be configured"}</strong>
        </p>
        <p>Press 1, then hang up.</p>
        <p>
          Call my known trusted contact
          <strong>{trustedNumber || "Write trusted number here"}</strong>
        </p>
        <hr />
        <p>Family Challenge Matrix: ____________________</p>
        <small>Placeholder only. Never share challenge answers by text.</small>
      </article>
    </div>
  );
}
