import { test, expect } from "@playwright/test";
import { enterDemo } from "./helpers.js";
import fs from "node:fs/promises";

test("learning attempts, independent scenarios, cross-run approvals and report export", async ({
  page,
}, testInfo) => {
  const errors = [];
  const apiRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.goto("/");
  await enterDemo(page);
  await page.getByRole("button", { name: "Switch to child" }).click();
  await page.getByRole("link", { name: "Lessons", exact: true }).click();
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
    .fill("1");
  await page
    .getByRole("radio", { name: "A guaranteed payment", exact: true })
    .check();
  await page.getByRole("button", { name: "Check & save my learning" }).click();
  await expect(
    page.getByText(
      "Review the explanation below, then try the exercise and knowledge check again.",
    ),
  ).toBeVisible();
  await page
    .getByLabel("In that same example, what percentage do 20 shares represent?")
    .fill("2");
  await page.getByRole("radio", { name: "A small ownership interest" }).check();
  await page.getByRole("button", { name: "Check & save my learning" }).click();
  await expect(
    page.getByRole("region", { name: "Learning history" }),
  ).toContainText("Completed");
  await expect(
    page
      .getByRole("region", { name: "Lesson attempt summary" })
      .locator("tbody td.numeric"),
  ).toHaveText("2");

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Market replay", exact: true })
    .click();
  const different = page.locator(".scenario-list li").filter({
    has: page.getByRole("heading", { name: "Different paths", exact: true }),
  });
  await different.getByRole("button", { name: "Start market replay" }).click();
  await expect(
    page.getByText("SYNTHETIC MARKET REPLAY · SESSION 1 OF 12"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await page.getByLabel("Practice amount ($)").fill("50");
  await page
    .getByLabel("What's your plan, and what could go wrong?")
    .fill(
      "I want to consider company-specific exposure and discuss uncertainty before investing.",
    );
  await page.getByRole("button", { name: "Ask your parent" }).click();
  await expect(
    page.getByText(
      "Your request is saved and is waiting for your parent to review it.",
    ),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Market replay", exact: true })
    .click();
  await page.getByText("Choose a practice scenario", { exact: true }).click();
  const headwinds = page.locator(".scenario-list li").filter({
    has: page.getByRole("heading", { name: "Shared headwinds", exact: true }),
  });
  await headwinds.getByRole("button", { name: "Start market replay" }).click();
  await expect(
    page.getByText("SYNTHETIC MARKET REPLAY · SESSION 1 OF 8"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await page.getByLabel("Practice amount ($)").fill("50");
  await page
    .getByLabel("What's your plan, and what could go wrong?")
    .fill(
      "I am practicing a small allocation while considering the possibility of a market-wide loss.",
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
  const queue = page.getByRole("region", { name: "Pending trade approvals" });
  await expect(queue).toContainText("2 pending");
  await expect(queue).toContainText("Different paths");
  await expect(queue).toContainText("Shared headwinds");
  for (let i = 0; i < 2; i++) {
    await queue
      .getByLabel("Feedback for this decision")
      .first()
      .fill(
        "We discussed the time horizon, uncertainty and how this allocation fits your plan.",
      );
    await queue
      .getByRole("button", { name: "Approve & execute" })
      .first()
      .click();
    await expect(queue).toContainText(`${1 - i} pending`);
  }
  await expect(
    page.getByRole("region", { name: "Learning history" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to child" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Market replay", exact: true })
    .click();
  for (let i = 1; i < 8; i++) {
    await page.getByRole("button", { name: "See what happened next" }).click();
    await expect(
      page.getByText(`SYNTHETIC MARKET REPLAY · SESSION ${i + 1} OF 8`),
    ).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Scenario completed", exact: true })).toBeVisible();
  await page
    .getByText("View scenario charts and analysis", { exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Portfolio analysis" }),
  ).toContainText("8 visible sessions");
  await page.getByRole("link", { name: "Portfolio", exact: true }).click();
  await page
    .getByText("View portfolio charts and analysis", { exact: true })
    .click();
  await expect(
    page.getByText("Cash and holdings match the recorded transactions."),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download practice report" }).click();
  const download = await downloadPromise;
  const reportPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(reportPath);
  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  expect(report.portfolio.run.scenario).toBe("shared-headwinds");
  expect(report.visible_market).toHaveLength(8);
  expect(report.reconciliation.ok).toBe(true);
  expect(report.portfolio.orders[0].quote).toBeUndefined();
  await page.getByText("View values by session", { exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Portfolio values by session" })
      .locator("tbody tr"),
  ).toHaveCount(8);
  await page.mouse.click(1, 1);
  await page.mouse.wheel(0, -10000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath("expanded-portfolio.png"),
    fullPage: true,
  });
  await page.reload();
  await page
    .getByText("View portfolio charts and analysis", { exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Portfolio analysis" }),
  ).toContainText("8 visible sessions");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  expect(errors).toEqual([]);
  if (process.env.TEST_PUBLIC_PREVIEW === "true")
    expect(apiRequests).toEqual([]);
});
