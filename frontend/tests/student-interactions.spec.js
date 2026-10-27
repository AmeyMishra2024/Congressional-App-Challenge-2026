import { test, expect } from "@playwright/test";
import { enterDemo } from "./helpers.js";

async function openStudent(page) {
  await page.goto("/");
  await enterDemo(page);
  await expect(
    page.getByRole("link", { name: "Tutorial", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Switch to child", exact: true })
    .click();
  await page.goto("/#/dashboard");
  await page
    .getByRole("button", { name: "Start guided tutorial", exact: true })
    .click();
}
async function fits(page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize().width);
}

test("whole investment card selects, independent stars and keyboard work without placing orders", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openStudent(page);
  await page
    .getByRole("button", { name: "Skip tutorial", exact: true })
    .click();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  const card = (ticker) =>
    page.getByRole("button", { name: new RegExp(`^Explore ${ticker} `) });
  for (const [ticker, selector] of [
    ["AAPL", ".asset-monogram"],
    ["MSFT", ".investment-kind"],
    ["BND", ".investment-price strong"],
  ]) {
    await card(ticker).locator(selector).click();
    await expect(card(ticker)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#investment-detail-title")).toContainText(
      ticker,
    );
    await expect(page.locator(".trade-card form")).toContainText(ticker);
  }
  // Empty corner inside the full button, not a title/icon/price hit target.
  const size = await card("VTI").boundingBox();
  await card("VTI").click({
    position: { x: size.width - 12, y: size.height - 12 },
  });
  await expect(card("VTI")).toHaveAttribute("aria-pressed", "true");
  const star = page.getByRole("button", {
    name: "Add MSFT to watchlist",
    exact: true,
  });
  const starBox = await star.boundingBox();
  expect(starBox.width).toBeGreaterThanOrEqual(44);
  expect(starBox.height).toBeGreaterThanOrEqual(44);
  await star.click();
  await expect(
    page.getByRole("button", { name: "Remove MSFT from watchlist" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(card("VTI")).toHaveAttribute("aria-pressed", "true");
  await card("AAPL").focus();
  await page.keyboard.press("Enter");
  await expect(card("AAPL")).toHaveAttribute("aria-pressed", "true");
  await card("MSFT").focus();
  await page.keyboard.press("Space");
  await expect(card("MSFT")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".investment-card button button")).toHaveCount(0);
  await page.locator(".asset-grid").screenshot({
    path: info.outputPath("student-cards.png"),
    animations: "disabled",
  });
  await page.screenshot({
    path: info.outputPath("student-explore.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "See details", exact: true }).click();
  await expect(page.locator("#investment-detail-title")).toBeFocused();
  await expect(page).toHaveURL(/#\/explore$/);
  await page.getByRole("link", { name: "Portfolio", exact: true }).click();
  await expect(
    page.getByText(
      "You have not submitted a practice decision in this account. You can explore an investment to write a request, or continue with the lessons without making a trade.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.locator(".child-wallet")).toContainText("$1,000.00");
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addStyleTag({ content: ":root { font-size:22px!important; }" });
  await fits(page);
  expect(errors).toEqual([]);
});

test("discoverable saved tutorial, student trail and explanatory warm-ups", async ({
  page,
}, info) => {
  const writes = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      new URL(request.url()).pathname.startsWith("/api/")
    )
      writes.push(request.url());
  });
  await openStudent(page);
  const tour = page.getByRole("region", { name: "Getting started tutorial" });
  await tour.getByRole("button", { name: "Next tour step" }).click();
  await tour.getByRole("button", { name: "Skip tutorial" }).click();
  await page.getByRole("link", { name: "Tutorial", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Getting started with Sprout",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Tutorial overview" }).locator("li"),
  ).toHaveCount(6);
  await page
    .getByRole("button", { name: "Continue guided tutorial", exact: true })
    .click();
  await expect(page).toHaveURL(/#\/explore$/);
  await expect(
    tour.getByRole("heading", { name: "Explore one investment", exact: true }),
  ).toBeVisible();
  await expect(tour.locator('[aria-current="step"]')).toContainText("Explore");
  await tour
    .getByRole("button", { name: "Previous tour step", exact: true })
    .click();
  await expect(
    tour.getByRole("heading", {
      name: "Meet your practice wallet",
      exact: true,
    }),
  ).toBeVisible();
  await tour.getByRole("link", { name: "See my wallet" }).click();
  await tour
    .getByRole("button", { name: "Next tour step", exact: true })
    .click();
  await tour.getByRole("link", { name: "Explore an investment" }).click();
  await page.reload();
  await expect(
    tour.getByRole("heading", { name: "Explore one investment", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("student-tutorial.png"),
    fullPage: false,
    animations: "disabled",
  });
  await tour.getByRole("button", { name: "Skip tutorial" }).click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page
    .getByText("Browse other practice activities", { exact: true })
    .click();
  await page.getByText("Try a practice question", { exact: true }).click();
  const trail = page.getByRole("region", {
    name: "Practice activities",
    exact: true,
  });
  await expect(trail.getByRole("link")).toHaveCount(4);
  const challenge = page.getByRole("region", {
    name: "Comparing stocks and funds",
    exact: true,
  });
  const before = writes.length;
  await challenge
    .getByRole("button", { name: "A single company's stock", exact: true })
    .click();
  await expect(challenge.getByRole("status")).toContainText(
    "That answer is incorrect. Read the explanation below before trying again.",
  );
  await challenge
    .getByRole("button", { name: "A broad stock fund", exact: true })
    .click();
  await expect(challenge.getByRole("status")).toContainText(
    "Your answer is correct. The explanation below shows why.",
  );
  await expect(challenge.getByRole("status")).toContainText(
    "whole market can still fall",
  );
  expect(writes.length).toBe(before);
  await expect(page.locator(".learning-meter")).toContainText("0 / 6");
  await expect(page.locator(".child-wallet")).toContainText("$1,000.00");
  await page.screenshot({
    path: info.outputPath("student-home.png"),
    fullPage: true,
    animations: "disabled",
  });
  await challenge
    .getByRole("button", { name: "Try another idea", exact: true })
    .click();
  const second = page.getByRole("region", {
    name: "Calculating a percentage loss",
    exact: true,
  });
  await second
    .getByRole("button", {
      name: "It lost 10% of its starting value",
      exact: true,
    })
    .click();
  await expect(second.getByRole("status")).toContainText(
    "Your answer is correct. The explanation below shows why.",
  );
  await second
    .getByRole("button", { name: "Try another idea", exact: true })
    .click();
  const third = page.getByRole("region", {
    name: "Writing a decision reason",
    exact: true,
  });
  await third
    .getByRole("button", {
      name: "Explain my goal, one risk, and when I'll review",
      exact: true,
    })
    .click();
  await expect(third.getByRole("status")).toContainText(
    "keeping practice cash is a valid choice",
  );
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addStyleTag({ content: ":root { font-size:22px!important; }" });
  await fits(page);
  const explore = trail.getByRole("link").filter({
    has: page.getByRole("heading", { name: "Investments", exact: true }),
  });
  const size = await explore.boundingBox();
  await explore.click({ position: { x: size.width - 8, y: 8 } });
  await expect(page).toHaveURL(/#\/explore$/);
  await page.getByRole("link", { name: "Tutorial", exact: true }).click();
  await fits(page);
});
