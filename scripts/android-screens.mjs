// Render the shipped Android UI with a reproducible position and heading. No test bridge is packaged.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir } from "node:fs/promises";
const base = "http://127.0.0.1:8796",
  out = "android/play/en-US";
const server = spawn(
  "python3",
  [
    "-m",
    "http.server",
    "8796",
    "--bind",
    "127.0.0.1",
    "--directory",
    ".cache/android-web",
  ],
  { stdio: "ignore" },
);
let browser;
try {
  for (let i = 0; i < 50; i++) {
    if (
      await fetch(base)
        .then((v) => v.ok)
        .catch(() => false)
    )
      break;
    await delay(100);
  }
  await mkdir(out, { recursive: true });
  browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN || undefined,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 384, height: 682 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });
  await page.clock.setFixedTime(new Date("2026-06-21T14:20:00Z"));
  await page.addInitScript(() => {
    window.SunCalcNative = {
      onmessage: null,
      postMessage(text) {
        const { id, method } = JSON.parse(text);
        queueMicrotask(() => {
          window.SunCalcNative.onmessage({
            data: JSON.stringify({
              id,
              value:
                method === "state"
                  ? {
                      kind: "trial",
                      now: Date.now(),
                      trialUntil: Date.now() + 604800000,
                      monthlyUntil: 0,
                      commerceReady: false,
                      prices: {},
                    }
                  : method === "config"
                    ? { addressLookup: false }
                    : {},
            }),
          });
          if (method === "sensorStart")
            dispatchEvent(
              new CustomEvent("sc:sensor", {
                detail: { lat: 43.5083, lon: 16.4383, heading: 30 },
              }),
            );
        });
      },
    };
  });
  await page.goto(
    base +
      "/#lat=43.5083&lon=16.4383&at=2026-06-21T14%3A20%3A00Z&place=Split%20waterfront",
  );
  await page.locator("#planner-content").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.locator("canvas.maplibregl-canvas").waitFor();
  await page.waitForTimeout(750);
  await page.screenshot({ path: out + "/01-planner.png" });
  await page.getByRole("button", { name: "Appearance and settings" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Live Shadow/ })
    .click();
  await page
    .getByText("Compass aligned to true north.", { exact: false })
    .waitFor();
  await page.screenshot({ path: out + "/02-live-shadow.png" });
} finally {
  await browser?.close();
  server.kill();
}
