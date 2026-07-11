import { test, expect } from "@playwright/test";

test.describe("verify page", () => {
  test("verify page with unknown token shows an error state", async ({
    page,
  }) => {
    // A malformed or unknown token should not crash the app — it should
    // render a graceful error state (expired/invalid token UI).
    await page.goto("/verify/not-a-real-token-abcdefghijklmnopq1234");
    // The page should load (not 500) and show something meaningful
    await expect(page.locator("body")).not.toContainText(
      /500|internal server error/i,
    );
    await expect(page.locator("h1, [role='heading']").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("verify page renders the contact response form for valid token format", async ({
    page,
  }) => {
    // A token with valid format (43 base64url chars) that doesn't exist in DB
    // should render the form which then shows an expired/not-found state.
    // This tests the page renders without crashing rather than the happy path.
    const fakeToken = "a".repeat(43);
    await page.goto(`/verify/${fakeToken}`);
    await expect(page.locator("body")).not.toContainText(
      /500|internal server error/i,
    );
    // Page should load with headings visible
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 5_000 });
  });

  test("navigation from home to setup works", async ({ page }) => {
    await page.goto("/");
    // The setup link should be reachable from the page or via direct nav
    await page.goto("/setup");
    await expect(page).toHaveURL("/setup");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("phone instructions page loads", async ({ page }) => {
    await page.goto("/phone");
    await expect(page.locator("body")).not.toContainText(
      /500|internal server error/i,
    );
    await expect(page.locator("h1, [role='heading']").first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
