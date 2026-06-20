import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DemoModeBanner, demoModeWarning } from "./DemoModeBanner";

describe("DemoModeBanner", () => {
  it("renders persistent accessible warning copy in demo mode", () => {
    const html = renderToStaticMarkup(<DemoModeBanner isDemo />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain(demoModeWarning);
  });

  it("renders nothing outside demo mode", () => {
    expect(renderToStaticMarkup(<DemoModeBanner isDemo={false} />)).toBe("");
  });
});
