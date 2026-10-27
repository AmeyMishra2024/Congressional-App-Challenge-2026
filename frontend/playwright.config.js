import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python =
  process.env.TEST_PYTHON ||
  path.join(
    root,
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
const channel = process.env.TEST_BROWSER === "chromium" ? undefined : "chrome";
const preview = process.env.TEST_PUBLIC_PREVIEW === "true";
// Keep real sign-in throttling enabled. Repeated suites must not share its counters.
const database =
  process.env.TEST_DATABASE_URL || `sqlite:///instance/e2e-${randomUUID()}.db`;
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: {
    baseURL: preview ? "http://127.0.0.1:5052" : "http://127.0.0.1:5051",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], channel },
    },
    { name: "phone-chrome", use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: {
    command: preview
      ? "npm run preview -- --host 127.0.0.1 --port 5052 --strictPort"
      : `"${python}" -m backend.app`,
    cwd: preview ? path.join(root, "frontend") : root,
    url: preview ? "http://127.0.0.1:5052" : "http://127.0.0.1:5051/api/health",
    timeout: 30000,
    // Allow QA in a user Chrome profile alongside the isolated preview tests.
    reuseExistingServer: preview && process.env.TEST_REUSE_PREVIEW === "true",
    stdout: "ignore",
    stderr: "ignore",
    env: {
      PORT: "5051",
      DATABASE_URL: database,
      APP_ENV: "development",
      SESSION_COOKIE_SECURE: "false",
    },
  },
});
