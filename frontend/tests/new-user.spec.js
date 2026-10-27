import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { enterDemo } from "./helpers.js";

test("published interface sources contain no em dashes or retired slogans", async () => {
  function walk(directory) {
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? walk(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      );
  }
  const files = [...walk("src"), ...walk("public"), "index.html"].filter(
    (file) => /\.(jsx?|json|html|webmanifest)$/.test(file),
  );
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    expect(text, file).not.toMatch(/\u2014|\\u2014/i);
    expect(text, file).not.toMatch(
      /Practice money\. Real understanding|LEARN IT\. TRY IT|SMALL STEPS\. REAL UNDERSTANDING|Let's unpack it|A good reason beats a quick click|YOUR OWN PACE\. NO TRADES REQUIRED/,
    );
  }
});

test("new users choose the tutorial and can find definitions without opening extra activities", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Learn about investing with a practice account",
      exact: true,
    }),
  ).toBeVisible();
  if (process.env.TEST_PUBLIC_PREVIEW === "true") {
    await expect(
      page.getByRole("button", { name: "Parent setup", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Open practice app", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Switch to parent", exact: true }),
    ).toBeVisible();
  } else {
    await enterDemo(page);
    await page
      .getByRole("button", { name: "Switch to child", exact: true })
      .click();
  }
  await expect(
    page.getByRole("region", { name: "Getting started tutorial" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start guided tutorial", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start your first lesson", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".activity-directory")).not.toHaveAttribute("open");
  await expect(page.locator(".optional-challenge")).not.toHaveAttribute("open");
  await page.screenshot({
    path: info.outputPath("new-user-home.png"),
    animations: "disabled",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Start guided tutorial", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Meet your practice wallet",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Skip tutorial", exact: true })
    .click();
  await page.getByRole("link", { name: "Learning tools", exact: true }).click();
  await expect(page.locator(".tour-collapsed, .concept")).toHaveCount(0);
  const glossary = page.getByRole("region", { name: "Investing glossary" });
  await glossary
    .getByLabel("Find an investing term", { exact: true })
    .fill("fractional");
  await expect(glossary.locator("dt")).toHaveText(["Fractional share"]);
  await glossary
    .getByLabel("Find an investing term", { exact: true })
    .fill("no-such-term");
  await expect(
    glossary.getByText("No glossary entries match this search.", {
      exact: false,
    }),
  ).toBeVisible();
  await glossary.getByLabel("Find an investing term", { exact: true }).fill("");
  await expect(glossary.locator("dt")).toHaveCount(10);
  await glossary
    .getByRole("button", { name: "Define stock", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Stock", exact: true }),
  ).toContainText("ownership interest");
  await page.keyboard.press("Escape");
  await expect(
    glossary.getByRole("button", { name: "Define stock", exact: true }),
  ).toBeFocused();
  if (process.env.TEST_PUBLIC_PREVIEW === "true") {
    await page
      .getByLabel("Goal name", { exact: true })
      .fill("My saved project");
    await page
      .getByLabel("Illustrative target ($)", { exact: true })
      .fill("600");
    await page.getByRole("button", { name: "Save goal", exact: true }).click();
    await expect(
      page.getByText("Your goal has been saved and is shown on Home.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page
      .getByRole("button", { name: "Open practice app", exact: true })
      .click();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Saved learning goal" }),
    ).toContainText("My saved project");
    await expect(
      page.getByRole("button", { name: "Resume tutorial", exact: true }),
    ).toBeVisible();
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize().width);
});
