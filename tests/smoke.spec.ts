import { test, expect, type Page } from "@playwright/test";

// Two forms are seeded; navigate by title instead of clicking the first card.
async function openEventFill(page: Page) {
  await page.goto("/");
  const href = await page.getByRole("link", { name: "Event Booking Request" }).getAttribute("href");
  await page.goto(href!.replace("/forms/", "/fill/"));
}

test("dashboard lists seeded forms", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Event Booking Request")).toBeVisible();
  await expect(page.getByText("Restaurant Venue Profile")).toBeVisible();
});

test("builder shows creator agent panel", async ({ page }) => {
  await page.goto("/new");
  await expect(page.getByText("Creator agent", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder(/Event booking/i)).toBeVisible();
});

test("traditional fill submit works", async ({ page }) => {
  await openEventFill(page);
  await expect(page.getByText("Filler agent", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Your answer").first().fill("Ada Lovelace");
  const texts = page.locator('input[placeholder="Your answer"]');
  await texts.nth(1).fill("2026-08-02");
  await texts.nth(2).fill("12");
  await page.locator("select").first().selectOption("Vegan");
  await page.getByRole("button", { name: "Submit response" }).first().click();
  await expect(page.getByText("Response submitted")).toBeVisible();
});

test("filler extract UI can show paper-shader reveal @ui", async ({ page }) => {
  await openEventFill(page);
  await expect(page.getByText("Filler agent", { exact: true })).toBeVisible();

  await page.route("**/api/forms/*/extract", async (route) => {
    await new Promise((r) => setTimeout(r, 150));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answers: { q1: "Test User", q3: "5", q4: "Vegan" },
        missing: ["q2", "q5", "q6"],
      }),
    });
  });

  await page.locator('input[type="file"]').setInputFiles("fixtures/sample-document.txt");
  await expect(page.getByTestId("extract-reveal")).toBeVisible({ timeout: 10000 });
  await expect(page.locator('input[placeholder="Your answer"]').first()).toHaveValue("Test User", {
    timeout: 15000,
  });
});

test("live AI extract fills vegan meal @ai", async ({ page }) => {
  test.skip(!process.env.AI_E2E, "Set AI_E2E=1 for live AI e2e");
  await openEventFill(page);
  await page.locator('input[type="file"]').setInputFiles("fixtures/sample-document.txt");
  await expect(page.getByTestId("extract-reveal")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("select").first()).toHaveValue("Vegan", { timeout: 60000 });
});
