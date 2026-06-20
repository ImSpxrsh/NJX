export const demoModeWarning =
  "DEMO MODE — This environment uses simulated data and must not be used for real emergencies, identity verification, or financial decisions.";

export function DemoModeBanner({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;
  return (
    <div className="demo-banner" role="status" aria-live="polite">
      <strong>{demoModeWarning}</strong>
    </div>
  );
}
