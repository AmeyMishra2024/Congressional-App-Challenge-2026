import { test, expect } from "@playwright/test";
import { enterDemo } from "./helpers.js";

async function capture(page, testInfo, name) {
  // Capture the document from its top so sticky navigation has its normal position.
  await page.mouse.click(1, 1);
  await page.mouse.wheel(0, -10000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
}

test("parent → lesson → proposal → approval → replay → reflection → reload", async ({
  page,
}, testInfo) => {
  const pageErrors = [];
  const apiRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.goto("/");
  if (process.env.TEST_PUBLIC_PREVIEW === "true")
    await expect(
      page.getByRole("button", { name: "Parent sign in", exact: true }),
    ).toHaveCount(0);
  await capture(page, testInfo, "welcome.png");
  await enterDemo(page);
  await expect(
    page.getByRole("group", { name: "Preview controls", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.getByRole("link", { name: "Skip to content" }).press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(
    page.getByRole("region", { name: "Virtual portfolio summary" }),
  ).toBeVisible();
  await capture(page, testInfo, "overview.png");
  await page
    .getByRole("link", { name: "Parent controls", exact: true })
    .click();
  await page.getByLabel("Fictional nickname").fill("Casey");
  if (process.env.TEST_PUBLIC_PREVIEW !== "true")
    await page.getByLabel("Child PIN").fill("246810");
  await page.getByLabel("Starting virtual funds", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Create child profile" }).click();
  await expect(
    page.getByText("Profile Casey created and selected."),
  ).toBeVisible();
  await expect(page.getByLabel("Maximum virtual buy per order")).toHaveValue(
    "200.00",
  );
  await page.getByLabel("Maximum virtual buy per order").fill("250");
  await page.getByLabel("Daily gross virtual buying limit").fill("400");
  await page.getByRole("button", { name: "Save virtual limits" }).click();
  await expect(
    page.getByText("Your trading limits have been saved.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Child profile", exact: true })
    .selectOption({ label: "Alex" });
  await expect(page.getByLabel("Maximum virtual buy per order")).toHaveValue(
    "200.00",
  );
  await page
    .getByRole("combobox", { name: "Child profile", exact: true })
    .selectOption({ label: "Casey" });
  await expect(page.getByLabel("Maximum virtual buy per order")).toHaveValue(
    "250.00",
  );
  await page.getByRole("button", { name: "Switch to child" }).click();
  await page.getByRole("link", { name: "Lessons", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Stocks and ownership" }),
  ).toBeVisible();
  await capture(page, testInfo, "lesson-progression.png");
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", { name: "Stocks and ownership" }),
    })
    .click();
  await page.getByRole("button", { name: /^See an example/ }).click();
  await page.getByRole("button", { name: /^Try it yourself/ }).click();
  await page
    .getByLabel("In that same example, what percentage do 20 shares represent?")
    .fill("2");
  await page.getByRole("radio", { name: "A small ownership interest" }).check();
  await page.getByRole("button", { name: "Check & save my learning" }).click();
  await expect(
    page.getByText(
      "You have completed this lesson, and your progress is saved.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Market replay", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start market replay" })
    .first()
    .click();
  await expect(
    page.getByText("SYNTHETIC MARKET REPLAY · SESSION 1 OF 12"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByLabel("Practice amount ($)").fill("100");
  await expect(page.locator("figure.chart")).toBeVisible();
  await capture(page, testInfo, "explore.png");
  await page
    .getByLabel("What's your plan, and what could go wrong?")
    .fill(
      "I want to practice spreading company risk with a broad fund and will review my time horizon.",
    );
  await page.getByRole("button", { name: "Ask your parent" }).click();
  await expect(
    page.getByText(
      "Your request is saved and is waiting for your parent to review it.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to parent" }).click();
  await page
    .getByRole("link", { name: "Parent controls", exact: true })
    .click();
  await page
    .getByLabel("Feedback for this decision")
    .fill(
      "We discussed market risk, diversification and the practice time horizon.",
    );
  await capture(page, testInfo, "approval-queue.png");
  await page.getByRole("button", { name: "Approve & execute" }).click();
  await expect(page.getByText("filled", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Switch to child" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Market replay", exact: true })
    .click();
  for (let i = 2; i <= 12; i++) {
    await page.getByRole("button", { name: "See what happened next" }).click();
    await expect(
      page.getByText(`SYNTHETIC MARKET REPLAY · SESSION ${i} OF 12`),
    ).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Scenario completed", exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Virtual portfolio summary" })
      .getByText("$1,002.00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".benchmark").getByText("$1,020.00", { exact: true }),
  ).toBeVisible();
  const reflection =
    "I learned that diversification reduces company-specific risk but cannot prevent market losses. I would review my reasoning, even after a gain.";
  await page.getByLabel("Your reflection").fill(reflection);
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(
    page.getByText("Your reflection has been saved with this practice run."),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Scenario completed", exact: true })).toBeVisible();
  await expect(page.getByText(reflection)).toBeVisible();
  await capture(page, testInfo, "completed-debrief.png");
  await page.getByRole("link", { name: "Portfolio", exact: true }).click();
  await expect(page.getByText("1.00000000", { exact: true })).toHaveCount(2);
  await capture(page, testInfo, "holdings.png");
  await page.getByRole("link", { name: "Lessons", exact: true }).click();
  await expect(page.getByText("Complete", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Parent controls", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  expect(pageErrors).toEqual([]);
  if (process.env.TEST_PUBLIC_PREVIEW === "true")
    expect(apiRequests).toEqual([]);
});
