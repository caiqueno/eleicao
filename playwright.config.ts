import { defineConfig, devices } from "@playwright/test";

const PORTA = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORTA}`, trace: "off" },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"] } },
    { name: "tablet", use: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1366, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npx next start -p ${PORTA}`, port: PORTA, reuseExistingServer: true, timeout: 60_000 },
});
