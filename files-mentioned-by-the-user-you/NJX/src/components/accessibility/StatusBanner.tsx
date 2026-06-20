export function StatusBanner({
  tone = "status",
  title,
  children,
}: {
  tone?: "status" | "hold" | "pending" | "final";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`status ${tone}`} aria-live="polite">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
