import { test, expect } from "@playwright/test";
import { enterDemo } from "./helpers.js";

async function demoChild(page) {
  await page.goto("/");
  await enterDemo(page);
  await page
    .getByRole("button", { name: "Switch to child", exact: true })
    .click();
  await page.goto("/#/dashboard");
  await page
    .getByRole("button", { name: "Start guided tutorial", exact: true })
    .click();
}
async function fits(page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(page.viewportSize().width);
}

test("first child: saved tutorial, keyboard and tap definitions, returning progress", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demoChild(page);
  const tour = page.getByRole("region", { name: "Getting started tutorial" });
  await expect(
    tour.getByRole("heading", { name: "Meet your practice wallet" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start your first lesson" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".child-home p")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(18);
  await page.screenshot({
    path: info.outputPath("child-home.png"),
    animations: "disabled",
    fullPage: true,
  });
  await tour.getByRole("button", { name: "Next tour step" }).click();
  await expect(
    tour.getByRole("heading", { name: "Explore one investment" }),
  ).toBeVisible();
  await tour.getByRole("button", { name: "Skip tutorial" }).click();
  await page.reload();
  await expect(tour).toHaveCount(0);
  await page.getByRole("button", { name: "Resume tutorial" }).click();
  await expect(
    tour.getByRole("heading", { name: "Explore one investment" }),
  ).toBeVisible();
  await tour.getByRole("link", { name: "Explore an investment" }).click();
  await page.locator(".asset-title").filter({ hasText: "AAPL" }).click();
  await tour.getByRole("button", { name: "Next tour step" }).click();
  const term = tour.getByRole("button", { name: "Define stock", exact: true });
  await term.focus();
  await term.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Stock", exact: true });
  await expect(dialog).toContainText("1,000 equal shares");
  await dialog.getByText("A little more detail", { exact: true }).click();
  await expect(dialog).toContainText("Dividends are not guaranteed");
  await page.screenshot({
    path: info.outputPath("definition.png"),
    animations: "disabled",
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(term).toBeFocused();
  await tour.getByRole("button", { name: "Next tour step" }).click();
  await expect(page.getByLabel("Practice amount ($)")).toBeVisible();
  await tour.getByRole("button", { name: "Continue without a trade" }).click();
  await tour.getByRole("link", { name: "See my requests" }).click();
  await tour
    .getByRole("button", { name: "I understand parent review" })
    .click();
  await tour.getByRole("link", { name: "Open market replay" }).click();
  await page
    .getByRole("button", { name: "Start market replay" })
    .first()
    .click();
  await page.getByRole("button", { name: "See what happened next" }).click();
  await tour.getByRole("button", { name: "Finish tutorial" }).click();
  // Reload only after the UI acknowledges the saved write, not while it is pending.
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(
    page.getByText("Getting-started tour completed", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Getting-started tour completed", { exact: true }),
  ).toBeVisible();
  await expect(tour).toHaveCount(0);
  await page.getByRole("button", { name: "Replay tutorial" }).click();
  await expect(
    tour.getByRole("heading", { name: "Meet your practice wallet" }),
  ).toBeVisible();
  await tour.getByRole("button", { name: "Skip tutorial" }).click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.screenshot({
    path: info.outputPath("returning-home.png"),
    animations: "disabled",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Learning tools", exact: true }).click();
  for (const name of [
    "stock",
    "fund",
    "diversification",
    "return",
    "benchmark",
  ]) {
    await page
      .getByRole("button", { name: `Define ${name}`, exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("For example");
    await page.getByRole("button", { name: "Close definition" }).click();
  }
  await page
    .getByRole("button", { name: "Define diversification", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Open the related lesson" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Diversification",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^See an example/ }).click();
  await expect(
    page.getByText("One company vs. a basket", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("visual-lesson.png"),
    animations: "disabled",
    fullPage: true,
  });
  const largerText = await page.addStyleTag({
    content: ":root { font-size:22px!important; }",
  });
  await fits(page);
  await largerText.evaluate((el) => el.remove());
  await fits(page);
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
    .fill("2");
  await page.getByRole("radio", { name: "A small ownership interest" }).check();
  await page.getByRole("button", { name: "Check & save my learning" }).click();
  await expect(
    page.getByText(
      "You have completed this lesson, and your progress is saved.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.reload();
  await page.goto("/#/dashboard");
  await expect(
    page.getByRole("link", { name: "Try a practice investment" }),
  ).toBeVisible();
  await expect(page.locator(".learning-meter")).toContainText("1 / 6");
  await fits(page);
  expect(errors).toEqual([]);
});

test("real parent setup, child access and returning account are not demo flows", async ({
  page,
}) => {
  test.skip(
    process.env.TEST_PUBLIC_PREVIEW === "true",
    "Browser-only preview intentionally has no real account authentication.",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Parent setup", exact: true }).click();
  const username = `parent-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
  await page.getByLabel("Parent username").fill(username);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a-strong-test-password");
  await page.getByRole("button", { name: "Create family account" }).click();
  await expect(
    page.getByRole("heading", { name: "Set up your child's learning space" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create a child profile" }).click();
  await page.getByLabel("Fictional nickname").fill("Morgan");
  await page.getByLabel("Child PIN").fill("246810");
  await page
    .getByRole("button", { name: "Create child profile", exact: true })
    .click();
  await expect(
    page.getByText("Profile Morgan created and selected."),
  ).toBeVisible();
  const code = await page
    .locator("p")
    .filter({ hasText: /^Family code:/ })
    .locator("strong")
    .textContent();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Start learning", exact: true })
    .click();
  await page.getByLabel("Family code").fill(code.trim());
  await page.getByLabel("Nickname", { exact: true }).fill("Morgan");
  await page.getByLabel("PIN (6–12 digits)").fill("246810");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page.goto("/#/dashboard");
  await expect(
    page.getByRole("heading", { name: "Hi, Morgan." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to parent" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Skip tutorial" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Parent username").fill(username);
  await page
    .getByLabel("Password", { exact: true })
    .fill("a-strong-test-password");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Parent controls", exact: true }),
  ).toBeVisible();
  await fits(page);
});

test("parent pause explains unavailable actions without blocking the tutorial", async ({
  page,
}) => {
  await demoChild(page);
  await page
    .getByRole("button", { name: "Switch to parent", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Parent controls", exact: true })
    .click();
  await page.getByLabel("Pause trading (keep learning available)").check();
  await page.getByRole("button", { name: "Save virtual limits" }).click();
  await expect(
    page.getByText("Your trading limits have been saved.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Switch to child", exact: true })
    .click();
  await page.goto("/#/dashboard");
  const tour = page.getByRole("region", { name: "Getting started tutorial" });
  await tour.getByRole("button", { name: "Next tour step" }).click();
  await tour.getByRole("link", { name: "Explore an investment" }).click();
  await tour.getByRole("button", { name: "Next tour step" }).click();
  await tour.getByRole("button", { name: "Define stock", exact: true }).click();
  await page.getByRole("button", { name: "Close definition" }).click();
  await tour.getByRole("button", { name: "Next tour step" }).click();
  await expect(tour).toContainText("New trades aren't available");
  await expect(
    page.getByRole("button", { name: "Trading is paused", exact: true }),
  ).toBeDisabled();
  await tour.getByRole("button", { name: "Continue without a trade" }).click();
  await expect(
    tour.getByRole("heading", { name: "Understand parent review" }),
  ).toBeVisible();
  await fits(page);
});

test("PWA has public-only cache and refuses offline changes", async ({
  page,
  context,
}) => {
  await demoChild(page);
  await page.getByRole("button", { name: "Skip tutorial" }).click();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await page.getByLabel("Practice amount ($)").fill("25");
  await page
    .getByLabel("What's your plan, and what could go wrong?")
    .fill("I am considering market risk and a long practice time horizon.");
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(2);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByLabel("Practice amount ($)")).toBeVisible();
  await page.getByLabel("Practice amount ($)").fill("25");
  await page
    .getByLabel("What's your plan, and what could go wrong?")
    .fill("I am considering market risk and a long practice time horizon.");
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Ask your parent", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Nothing has been queued",
  );
  const cached = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (k) =>
          (await (await caches.open(k)).keys()).map(
            (r) => new URL(r.url).pathname,
          ),
        ),
      )
    ).flat(),
  );
  expect(cached.sort()).toEqual(
    ["/icon-192.png", "/icon-512.png", "/offline.html"].sort(),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "You're offline." }),
  ).toBeVisible();
  await expect(page.getByText("$1,000.00")).toHaveCount(0);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again when connected" }).click();
  await expect(
    page.getByRole("link", { name: "Portfolio", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Portfolio", exact: true }).click();
  await expect(
    page.getByText(
      "You have not submitted a practice decision in this account. You can explore an investment to write a request, or continue with the lessons without making a trade.",
    ),
  ).toBeVisible();
});
