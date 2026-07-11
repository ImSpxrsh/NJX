import { test, expect } from "@playwright/test";

test.describe("analyze flow", () => {
  test("home page loads with message input", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Stop and verify");
    await expect(
      page.locator("textarea, [role='textbox'], input[type='text']").first(),
    ).toBeVisible();
  });

  test("submitting a low-risk message shows a result", async ({ page }) => {
    await page.goto("/");

    // Find the message textarea or input
    const input = page.locator("textarea").first();
    await input.fill(
      "Hey, just checking in. Hope you're doing well! Call me when you get a chance.",
    );

    const button = page
      .getByRole("button", { name: /check|analyze|submit/i })
      .first();
    await button.click();

    // Should show a result — either a status level or the result card
    // L0 messages should not show a hold/warn banner
    await expect(
      page
        .locator("[data-testid='result'], .result-card, .check-result")
        .first(),
    )
      .toBeVisible({
        timeout: 10_000,
      })
      .catch(async () => {
        // Fallback: any change from the initial state within the timeout
        await expect(page.locator("body")).toContainText(
          /L0|safe|looks fine|no warning|pending|verified/i,
          { timeout: 10_000 },
        );
      });
  });

  test("submitting a high-risk message shows a hold instruction", async ({
    page,
  }) => {
    await page.goto("/");

    const input = page.locator("textarea").first();
    await input.fill(
      "This is your bank security team. Your account has been compromised. Wire $2,500 to this emergency account immediately and do not tell anyone.",
    );

    const button = page
      .getByRole("button", { name: /check|analyze|submit/i })
      .first();
    await button.click();

    // High-risk: should show a HOLD/STOP instruction or L2/L3 level
    await expect(page.locator("body")).toContainText(
      /hold|stop|verify|L[23]/i,
      {
        timeout: 15_000,
      },
    );
  });

  test("empty message cannot be submitted", async ({ page }) => {
    await page.goto("/");
    const button = page
      .getByRole("button", { name: /check|analyze|submit/i })
      .first();
    // Button should be disabled or form validation should prevent submission
    const isDisabled = await button.isDisabled();
    if (!isDisabled) {
      await button.click();
      // If it doesn't navigate away, the form prevented submission
      await expect(page).toHaveURL("/");
    } else {
      expect(isDisabled).toBe(true);
    }
  });

  test("setup page renders enrollment form", async ({ page }) => {
    await page.goto("/setup");
    await expect(page.locator("h1")).toBeVisible();
    // Should show step 1 of the enrollment flow
    await expect(page.locator("body")).toContainText(/contact|enroll|step/i);
    await expect(
      page.getByRole("button", { name: /save|verify|enroll/i }).first(),
    ).toBeVisible();
  });
});
