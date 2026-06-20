import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DemoBanner } from "@/components/DemoBanner";
import { getRuntimeConfig } from "@/lib/runtime-mode";

export const metadata: Metadata = {
  title: "CircleCheck — Stop and verify",
  description: "Risk-adaptive verification for urgent impersonation requests.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Runtime config is resolved server-side; the browser cannot influence
  // whether the demo banner appears.
  const { isDemo } = getRuntimeConfig();
  return (
    <html lang="en">
      <body>
        {isDemo && <DemoBanner />}
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
