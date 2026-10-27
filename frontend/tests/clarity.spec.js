import { test, expect } from "@playwright/test";
import { enterDemo } from "./helpers.js";

async function demo(page) {
  await page.goto("/");
  await enterDemo(page);
  await expect(page.locator(".portfolio-summary")).toBeVisible();
}

test("financial values contrast with their surface and navigation stays compact", async ({
  page,
}, info) => {
  await demo(page);
  await expect(
    page.getByRole("heading", { name: "Family overview", exact: true }),
  ).toBeVisible();
  const ratios = await page
    .locator(".portfolio-summary")
    .evaluate((summary) => {
      function luminance(color) {
        const channels = color
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            v /= 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      }
      const bg = luminance(getComputedStyle(summary).backgroundColor);
      const values = [
        ...summary.querySelectorAll(
          "strong, small, .balance-label, .balance-detail > span",
        ),
      ];
      // Exercise all sign colors, including the negative state on this same dark surface.
      for (const state of ["positive", "negative"]) {
        const el = document.createElement("strong");
        el.className = state;
        el.textContent = state === "negative" ? "-$10.00" : "$10.00";
        summary.querySelector(".balance-detail").append(el);
        values.push(el);
      }
      const results = values.map((el) => {
        const fg = luminance(getComputedStyle(el).color);
        return (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
      });
      values.slice(-2).forEach((el) => el.remove());
      return results;
    });
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const link of await nav.getByRole("link").all()) {
    await expect(link).toBeVisible();
    const size = await link.boundingBox();
    expect(size.height).toBeGreaterThanOrEqual(44);
  }
  if (info.project.name === "phone-chrome") {
    expect((await nav.boundingBox()).height).toBeLessThan(175);
  }
  await page.screenshot({
    path: info.outputPath("clarity-parent.png"),
    animations: "disabled",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize().width);
});

test("watchlist filtering keeps cards, details and draft aligned; goals survive reload", async ({
  page,
}, info) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Switch to child", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip tutorial", exact: true })
    .click();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  // Start from no saved symbols, then watch only AAPL while VTI is selected.
  const remove = page.getByRole("button", {
    name: /^Remove .* from watchlist$/,
  });
  while (await remove.count()) await remove.first().click();
  await page
    .getByRole("button", { name: "Add AAPL to watchlist", exact: true })
    .click();
  await page.getByRole("button", { name: /^Explore VTI / }).click();
  await page.getByLabel("Practice amount ($)", { exact: true }).fill("50");
  await page.getByLabel("Watchlist only", { exact: true }).check();
  await expect(page.locator(".asset-select")).toHaveCount(1);
  await expect(page.locator("#investment-detail-title")).toContainText("AAPL");
  await expect(page.locator(".trade-card form")).toContainText("AAPL at");
  await expect(
    page.getByLabel("Practice amount ($)", { exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Remove AAPL from watchlist", exact: true })
    .click();
  await expect(page.locator(".trade-card form")).toHaveCount(0);
  await expect(page.locator("#investment-details")).toHaveCount(0);
  await expect(
    page.getByText("Your watchlist is empty.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Watchlist only", { exact: true }).uncheck();
  await expect(page.locator(".trade-card form")).toContainText("VTI at");
  await expect(page.locator(".trade-note, .concept")).toHaveCount(0);
  await page.getByRole("link", { name: "Learning tools", exact: true }).click();
  await page
    .getByLabel("Goal name", { exact: true })
    .fill("My robotics project");
  await page.getByLabel("Illustrative target ($)", { exact: true }).fill("600");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Your goal has been saved and is shown on Home." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.reload();
  const goal = page.getByRole("region", { name: "Saved learning goal" });
  await expect(goal).toContainText("My robotics project");
  await expect(goal).toContainText("$600.00");
  await expect(
    page.locator(".home-notes, .child-home > .page-heading p"),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("clarity-student.png"),
    animations: "disabled",
  });
});
