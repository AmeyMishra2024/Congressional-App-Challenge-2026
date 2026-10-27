import { expect } from "@playwright/test";

// Existing journeys start as a parent; the public entry itself now starts as a student.
export async function enterDemo(page) {
  await page.goto("/");
  if (process.env.TEST_PUBLIC_PREVIEW === "true") {
    await page
      .getByRole("button", { name: "Open practice app", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Switch to parent", exact: true })
      .click();
  } else {
    await page.getByText("Try a demonstration", { exact: true }).click();
    await page
      .getByRole("button", { name: "Start judge demo", exact: true })
      .click();
  }
  await expect(
    page.getByRole("button", { name: "Switch to child", exact: true }),
  ).toBeVisible();
}
