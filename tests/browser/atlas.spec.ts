import { test, expect } from "@playwright/test";
test("mobile sundown plan, save and round-trip share without cookies or third-party requests", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const origins = new Set<string>(),
    errors: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("http")) origins.add(new URL(r.url()).origin);
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByText("Split waterfront", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Choose planning date" }).click();
  await page
    .getByRole("dialog")
    .locator('input[type="date"]')
    .fill("2026-06-21");
  await page.getByRole("button", { name: "Set date", exact: true }).click();
  await page.locator(".event-set").click();
  const time = await page.locator(".big-clock").innerText();
  expect(time).toMatch(/^20:3[89]$/);
  await page.getByRole("button", { name: "Save place", exact: true }).click();
  await page.getByRole("button", { name: "Saved places", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Split waterfront"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Share plan" }).click();
  const link = await page.getByLabel("Share link").inputValue();
  expect(new URL(link).hash).toContain("at=");
  await page.goto(link);
  await expect(page.locator(".big-clock")).toHaveText(time);
  await expect(page.getByRole("slider")).toBeVisible();
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".big-clock")).not.toHaveText(time);
  expect(await context.cookies()).toEqual([]);
  expect([...origins]).toEqual(["http://127.0.0.1:8789"]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("town, direct coordinates, polar night and offline revisit", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /Find a place or coordinates/ })
    .click();
  const input = page.getByRole("textbox", { name: "Search places" });
  await input.fill("kyoto");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: /Kyoto Japan/i })
      .first(),
  ).toBeVisible();
  await input.fill("69.65,18.96");
  await input.press("Enter");
  await expect(page.locator(".place-button")).toContainText(
    "Pinned coordinates",
  );
  await page.getByRole("button", { name: "Choose planning date" }).click();
  await page
    .getByRole("dialog")
    .locator('input[type="date"]')
    .fill("2026-12-21");
  await page.getByRole("button", { name: "Set date", exact: true }).click();
  await expect(page.locator(".event-rise")).toContainText("No event");
  await page.getByRole("button", { name: "More tools" }).click();
  await expect(page.getByRole("dialog")).toContainText("0h 00m of daylight");
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((r) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => r(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  const previewImage = await page.evaluate(
    async () => (await fetch("/maps/split-waterfront.webp")).status,
  );
  expect(previewImage).toBe(200);
  await expect(page.locator(".place-button")).toContainText(
    "Pinned coordinates",
  );
  await expect(page.getByRole("slider")).toBeVisible();
  await expect(page.locator(".map-status")).toContainText("Offline");
});
test("an expired installation keeps today’s events and can reach restore", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "sc:access",
      JSON.stringify({ mode: "live", until: Date.now() - 1000, paid: false }),
    );
    localStorage.setItem(
      "sc:install",
      JSON.stringify("1e231712-b076-41cc-8d4d-86c41215cf05"),
    );
  });
  await page.route("**/api/config", (r) =>
    r.fulfill({ json: { mode: "live", addressLookup: false } }),
  );
  await page.route("**/api/status", (r) =>
    r.fulfill({
      json: { mode: "live", until: Date.now() - 1000, paid: false },
    }),
  );
  await page.goto("/");
  await expect(page.locator(".event-rise")).toBeVisible();
  await expect(page.locator(".event-set")).toBeVisible();
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page.getByRole("button", { name: "Unlock the planner · €1" }).click();
  await expect(page.getByLabel("Recovery code")).toBeVisible();
});
