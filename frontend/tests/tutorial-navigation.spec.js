import { test, expect } from "@playwright/test";
import { enterDemo } from "./helpers.js";

async function openStudent(page) {
  await page.goto("/");
  await enterDemo(page);
  await page
    .getByRole("button", { name: "Switch to child", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start guided tutorial", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Getting started tutorial" }),
  ).toBeVisible();
}
async function atDestination(page, id) {
  const target = page.locator(`#${id}`);
  await expect(target).toBeFocused();
  await expect
    .poll(async () => (await target.boundingBox())?.y)
    .toBeGreaterThanOrEqual(0);
  expect((await target.boundingBox()).y).toBeLessThan(
    page.viewportSize().height / 2,
  );
  return target;
}

test("tutorial links reach real targets on the same page, across pages and on repeated activation", async ({
  page,
}, info) => {
  const errors = [];
  const financialWrites = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /\/api\/runs\/\d+\/(orders|advance|reset)/.test(request.url())
    )
      financialWrites.push(request.url());
  });
  await openStudent(page);
  const tour = page.getByRole("region", { name: "Getting started tutorial" });
  const walletLink = tour.getByRole("link", { name: /^See my wallet/ });
  await walletLink.click();
  const wallet = await atDestination(page, "practice-wallet");
  await expect(page).toHaveURL(/#\/dashboard$/);
  await expect(wallet).toContainText("$1,000.00");
  const walletBox = await wallet.boundingBox();
  expect(walletBox.y + walletBox.height).toBeLessThanOrEqual(
    page.viewportSize().height,
  );
  await page.screenshot({
    path: info.outputPath("wallet-destination.png"),
    animations: "disabled",
  });
  // The URL is already Home: activating it again must still visibly do something.
  await walletLink.focus();
  await walletLink.press("Enter");
  await atDestination(page, "practice-wallet");
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await walletLink.click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await atDestination(page, "practice-wallet");
  // Starting from the dedicated tutorial page uses the same reliable destination.
  await page.getByRole("link", { name: "Tutorial", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue guided tutorial", exact: true })
    .click();
  await atDestination(page, "practice-wallet");
  await tour
    .getByRole("button", { name: "Next tour step", exact: true })
    .click();
  await tour.getByRole("link", { name: /^Explore an investment/ }).click();
  await atDestination(page, "investment-picker");
  await tour
    .getByRole("button", { name: "Next tour step", exact: true })
    .click();
  await tour.getByRole("button", { name: "Define stock", exact: true }).click();
  await page
    .getByRole("button", { name: "Close definition", exact: true })
    .click();
  await tour
    .getByRole("button", { name: "Next tour step", exact: true })
    .click();
  await tour.getByRole("link", { name: /^Find the practice form/ }).click();
  await atDestination(page, "practice-decision");
  await tour
    .getByRole("button", { name: "Continue without a trade", exact: true })
    .click();
  await tour.getByRole("link", { name: /^See my requests/ }).click();
  await atDestination(page, "practice-requests");
  await tour
    .getByRole("button", { name: "I understand parent review", exact: true })
    .click();
  await tour.getByRole("link", { name: /^Open market replay/ }).click();
  await atDestination(page, "market-replay");
  expect(financialWrites).toEqual([]);
  expect(errors).toEqual([]);
});

test("wallet destination waits for saved data instead of losing the navigation action", async ({
  page,
}) => {
  test.skip(
    process.env.TEST_PUBLIC_PREVIEW === "true",
    "The public preview has no server-side portfolio fetch to delay.",
  );
  let release;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/runs/*", async (route) => {
    if (
      route.request().method() === "GET" &&
      /\/api\/runs\/\d+$/.test(new URL(route.request().url()).pathname)
    )
      await ready;
    await route.continue();
  });
  try {
    await openStudent(page);
    await page.getByRole("link", { name: "Explore", exact: true }).click();
    await page.getByRole("link", { name: /^See my wallet/ }).click();
    await expect(page).toHaveURL(/#\/dashboard$/);
    await expect(page.locator("#practice-wallet")).toHaveCount(0);
    release();
    await atDestination(page, "practice-wallet");
    const wallet = page.locator("#practice-wallet");
    await expect(wallet).toContainText("$1,000.00");
  } finally {
    release();
  }
});
