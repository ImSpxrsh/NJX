import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "CircleCheck — Stop and verify",
  description: "Risk-adaptive verification for urgent impersonation requests.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="shell">
            <Link className="brand" href="/">
              ◉ CircleCheck
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/phone">Phone help</Link>
              <Link href="/setup">Safety card</Link>
              <Link href="/demo">Demo</Link>
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
