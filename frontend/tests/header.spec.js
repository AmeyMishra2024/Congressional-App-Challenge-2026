import { test, expect } from "@playwright/test";
import { enterDemo } from "./helpers.js";

async function checkLayout(page, maxHeight) {
  const header = page.getByRole("banner", { name: "Workspace toolbar" });
  const bounds = await header.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return {
      height: box.height,
      controls: [...el.querySelectorAll("select, button, summary")].map(
        (control) => {
          const rect = control.getBoundingClientRect();
          return {
            left: rect.left - box.left,
            right: box.right - rect.right,
            bottom: box.bottom - rect.bottom,
            height: rect.height,
          };
        },
      ),
    };
  });
  expect(bounds.height).toBeLessThanOrEqual(maxHeight);
  for (const control of bounds.controls) {
    expect(control.left).toBeGreaterThanOrEqual(0);
    expect(control.right).toBeGreaterThanOrEqual(0);
    expect(control.bottom).toBeGreaterThanOrEqual(12);
    expect(control.height).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize().width);
}

test("compact workspace header: controls, readable history and small-screen disclosure", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await enterDemo(page);
  const practice = page.getByRole("combobox", {
    name: "Practice space",
    exact: true,
  });
  await expect(practice).toHaveValue(/\d+/);
  await expect(practice.locator("option:checked")).toHaveText(
    "Practice wallet",
  );
  await expect(page.locator(".demo-bar, .context-bar, .topbar")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Child profile" }),
  ).toHaveValue(/\d+/);
  await checkLayout(page, info.project.name === "desktop-chrome" ? 200 : 300);
  await page.screenshot({
    path: info.outputPath("header-parent.png"),
    animations: "disabled",
  });

  await page
    .getByRole("link", { name: "Parent controls", exact: true })
    .click();
  await page
    .getByLabel("Why are you resetting?")
    .fill("Start another learning attempt and keep the earlier history.");
  await page
    .getByRole("button", { name: "Archive & reset practice", exact: true })
    .click();
  await expect(
    page.getByText("Practice reset recorded. Your previous run is archived.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(practice.locator("option:checked")).toHaveText(
    "Practice wallet",
  );
  const archived = practice
    .locator("option")
    .filter({ hasText: "past attempt 1 (read only)" });
  await expect(archived).toHaveCount(1);
  const archivedId = await archived.getAttribute("value");
  const activeId = await practice.inputValue();
  await practice.selectOption(archivedId);
  await expect(
    page.getByRole("button", {
      name: "Select an active run to reset it",
    }),
  ).toBeDisabled();
  await practice.selectOption(activeId);
  await expect(
    page.getByRole("button", { name: "Archive & reset practice", exact: true }),
  ).toBeEnabled();

  await page
    .getByRole("button", { name: "Switch to child", exact: true })
    .click();
  await page.goto("/#/dashboard");
  await page
    .getByRole("button", { name: "Skip tutorial", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Child profile" }),
  ).toHaveCount(0);
  await checkLayout(page, info.project.name === "desktop-chrome" ? 200 : 250);
  await page.screenshot({
    path: info.outputPath("header-child.png"),
    animations: "disabled",
  });

  // The disclosure remains usable with a keyboard at a narrow width and larger text.
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addStyleTag({ content: ":root { font-size:22px!important; }" });
  await checkLayout(page, 380);
  const summary = page.locator(".header-preview-info > summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(page.locator(".header-preview-popover")).toBeVisible();
  const popover = await page.locator(".header-preview-popover").boundingBox();
  expect(popover.x).toBeGreaterThanOrEqual(0);
  expect(popover.x + popover.width).toBeLessThanOrEqual(320);
  await summary.press("Enter");
  await expect(page.locator(".header-preview-popover")).toBeHidden();
  await page
    .getByRole("button", { name: "Switch to parent", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Child profile" }),
  ).toBeVisible();
  await checkLayout(page, 380);
  expect(errors).toEqual([]);
});
