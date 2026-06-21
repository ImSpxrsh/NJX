export function StatusBanner({
  tone = "status",
  title,
  children,
}: {
  tone?: "status" | "hold" | "pending" | "final";
  title: string;
  children: React.ReactNode;
}) {
  const isAlert = tone === "hold" || tone === "final";
  return (
    <section
      className={`status ${tone}`}
      role={isAlert ? "alert" : undefined}
      aria-live={isAlert ? undefined : "polite"}
      aria-atomic="true"
    >
      <h2>{title}</h2>
      {children}
    </section>
  );
}
