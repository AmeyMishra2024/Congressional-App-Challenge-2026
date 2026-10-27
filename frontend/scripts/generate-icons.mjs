// Code-native icon rendered at exact install sizes, including maskable safe area.
import { chromium } from "@playwright/test";
import path from "node:path";
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({
    viewport: { width: 512, height: 512 },
    deviceScaleFactor: 1,
  });
  for (const size of [192, 512]) {
    await page.setContent(
      `<style>body{margin:0}</style><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" fill="#183153"/><path d="M160 347h192" stroke="#F2BE45" stroke-width="24" stroke-linecap="round"/><path d="M256 335V212" stroke="#F2BE45" stroke-width="24" stroke-linecap="round"/><path d="M253 254c-69 0-101-38-101-91 59 0 101 26 101 91Z" fill="#FFF8EC"/><path d="M260 230c0-62 37-91 93-91 0 59-39 91-93 91Z" fill="#F2BE45"/></svg>`,
    );
    await page
      .locator("svg")
      .screenshot({ path: path.resolve(`public/icon-${size}.png`) });
  }
} finally {
  await browser.close();
}
