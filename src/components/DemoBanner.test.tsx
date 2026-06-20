// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(cleanup);
import { DemoBanner } from "./DemoBanner";

describe("DemoBanner", () => {
  it("renders the demo mode warning text", () => {
    render(<DemoBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/DEMO MODE/i)).toBeInTheDocument();
    expect(
      screen.getByText(/simulated data/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/must not be used for real emergencies/i),
    ).toBeInTheDocument();
  });

  it("has role=status for accessibility", () => {
    render(<DemoBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toBeInTheDocument();
  });

  it("has aria-live=polite for screen reader announcements", () => {
    render(<DemoBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("mentions identity verification and financial decisions in warning", () => {
    render(<DemoBanner />);
    const banner = screen.getByRole("status");
    expect(banner.textContent).toContain("identity verification");
    expect(banner.textContent).toContain("financial decisions");
  });
});
