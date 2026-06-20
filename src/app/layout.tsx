import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DemoModeBanner } from "@/components/accessibility/DemoModeBanner";
import { getRuntimeConfig } from "@/lib/runtime-config";

export const metadata: Metadata = {
  title: "CircleCheck — Stop and verify",
  description: "Risk-adaptive verification for urgent impersonation requests.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const runtime = getRuntimeConfig();
  return (
    <html lang="en">
      <body>
        <DemoModeBanner isDemo={runtime.isDemo} />
        <header className="site-header">
          <div className="shell">
            <Link className="brand" href="/">
              ◉ CircleCheck
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/phone">Phone help</Link>
              <Link href="/setup">Safety card</Link>
              {runtime.isDemo && <Link href="/demo">Demo</Link>}
            </nav>
          </div>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
