export function DemoBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: "#fef3c7",
        borderBottom: "2px solid #f59e0b",
        color: "#92400e",
        fontWeight: 600,
        padding: "0.75rem 1rem",
        textAlign: "center",
        fontSize: "0.9rem",
      }}
    >
      DEMO MODE — This environment uses simulated data and must not be used for
      real emergencies, identity verification, or financial decisions.
    </div>
  );
}
