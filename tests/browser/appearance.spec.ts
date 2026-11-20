import { test, expect, type Page } from "@playwright/test";
const share =
  "/#lat=43.5083&lon=16.4383&at=2026-06-21T16%3A00%3A00.000Z&place=Waterfront";
async function choose(p: Page, name: string) {
  await p.getByRole("button", { name: "Appearance and settings" }).click();
  await p.getByRole("radio", { name, exact: true }).locator("..").click();
  await p.getByRole("button", { name: "Close dialog" }).click();
}
test("appearance follows the OS or stays pinned, without moving the map or refetching geography", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(share);
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "light");
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeEnabled();
  await expect(page.locator(".big-clock")).toHaveText("18:00");
  const canvas = page.locator(".mapcanvas canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw Error("No map canvas");
  const x = bounds.x + bounds.width * 0.5,
    y = bounds.y + bounds.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 30, y + 15, { steps: 5 });
  await page.waitForTimeout(180);
  await page.mouse.up();
  await expect(page.locator(".initial-map")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  const before = await page.locator(".sun-overlay>g").getAttribute("style");
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/tiles/")) requests.push(r.url());
  });
  await choose(page, "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
  await expect(page.locator(".sun-overlay>g")).toHaveAttribute(
    "style",
    before!,
  );
  await expect(page.locator(".big-clock")).toHaveText("18:00");
  await expect(page.locator(".place-button")).toContainText("Waterfront");
  expect(requests).toEqual([]);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
  const peer = await context.newPage();
  await peer.goto(share);
  await choose(peer, "Light");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "light");
  await peer.close();
  await choose(page, "Auto");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
  expect(
    await page.evaluate(() => localStorage.getItem("suncalc:appearance")),
  ).toBeNull();
  await page.getByRole("button", { name: "Enter local time" }).click();
  await page.getByLabel(/Time at the pin/).fill("23:30");
  await page.getByRole("button", { name: "Set time", exact: true }).click();
  await expect(page.locator(".shadow-body")).toContainText("No direct shadow");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
});
test("the two repeated hours are independently selectable and manual appearance works with storage disabled", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Unavailable", "SecurityError");
      },
    }),
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(
    "/#lat=40.7128&lon=-74.006&at=2026-11-01T05%3A30%3A00Z&place=New+York",
  );
  const r = page.getByRole("slider");
  await expect(r).toHaveAttribute("max", "1499");
  await expect(r).toHaveAttribute("aria-valuetext", /01:30 · UTC-04:00/);
  await r.evaluate((el) => {
    const input = el as HTMLInputElement;
    input.value = "150";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(r).toHaveAttribute("aria-valuetext", /01:30 · UTC-05:00/);
  await choose(page, "Light");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
});
test("installed shell keeps both first-paint maps, font and controls when offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) =>
        navigator.serviceWorker.addEventListener("controllerchange", r, {
          once: true,
        }),
      );
  });
  await context.setOffline(true);
  await choose(page, "Dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
  for (const p of [
    "/maps/split-waterfront.webp",
    "/maps/split-waterfront-dark.webp",
    "/appearance-boot.js",
    "/brand/bricolage.woff2",
    "/brand/wordmark.svg",
    "/icon-512.png",
  ]) {
    expect(
      await page.evaluate(async (u) => (await fetch(u)).status, p),
      p,
    ).toBe(200);
  }
  await expect(page.locator(".map-status")).toContainText("Offline");
  await choose(page, "Light");
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "light");
});
test("verified restore response unlocks an expired install and survives an offline reopening", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("sc:access")) {
      localStorage.setItem(
        "sc:access",
        JSON.stringify({ mode: "live", until: 1, paid: false }),
      );
      localStorage.setItem(
        "sc:install",
        JSON.stringify("1e231712-b076-41cc-8d4d-86c41215cf05"),
      );
    }
  });
  await page.route("**/api/config", (r) =>
    r.fulfill({ json: { mode: "live", addressLookup: false } }),
  );
  for (const path of ["start", "status"]) {
    await page.route("**/api/" + path, (r) =>
      r.fulfill({ json: { mode: "live", until: 1, paid: false } }),
    );
  }
  const code = "43ab".repeat(8);
  await page.route("**/api/restore", (r) => {
    expect(r.request().postDataJSON()).toEqual({ code });
    return r.fulfill({ json: { mode: "live", paid: true } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Access & restore" }).click();
  await page.getByRole("textbox", { name: "Recovery code" }).fill(code);
  await page
    .getByRole("button", { name: "Restore access", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Lifetime access is active",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("slider")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) =>
        navigator.serviceWorker.addEventListener("controllerchange", r, {
          once: true,
        }),
      );
  });
  await page.unrouteAll();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("slider")).toBeVisible();
  await page.getByRole("button", { name: "Appearance and settings" }).click();
  await page.getByRole("button", { name: /Your access/ }).click();
  await expect(page.getByRole("dialog")).toContainText(code);
});
