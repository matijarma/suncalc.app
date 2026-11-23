import { test, expect } from "@playwright/test";

test("the app stays in the first viewport and section links preserve a shared plan", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#lat=43.5083&lon=16.4383&at=2026-06-21T16%3A00%3A00Z&place=Waterfront");
  await expect(page.locator(".big-clock")).toHaveText("18:00");
  expect((await page.locator("#learn").boundingBox())!.y).toBeGreaterThanOrEqual(844);
  await page.getByRole("link", { name: "About & guides" }).click();
  await expect(page).toHaveURL(/#learn$/);
  await expect(page.locator(".big-clock")).toHaveText("18:00");
  await expect(page.locator(".place-button")).toContainText("Waterfront");
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await page.goBack();
  await expect(page.locator(".big-clock")).toHaveText("18:00");
  await page.getByRole("link", { name: "About & guides" }).click();
  await page.getByRole("link", { name: "Try the June example" }).click();
  await expect(page.locator(".big-clock")).toHaveText("12:56");
  await expect(page.locator(".appbar")).toBeInViewport();
  await expect(page.locator("#planner-content")).toBeFocused();
  expect(await page.locator("main").count()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("sitemap pages are useful without JavaScript and have working internal links", async ({ browser, request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const locations = [...(await response.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(locations).toHaveLength(6);
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: "http://127.0.0.1:8789", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const links = new Set<string>();
  for (const path of locations) {
    const document = await page.goto(path);
    expect(document!.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://suncalc.app" + path);
    expect((await page.locator("main").innerText()).length).toBeGreaterThan(350);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
    const discovered = await page.locator('a[href^="/"], img[src^="/"]').evaluateAll((els) => els.map((el) => el.getAttribute("href") || el.getAttribute("src") || ""));
    for (const url of discovered) links.add(url.split("#")[0]);
  }
  for (const url of links) expect((await request.get(url)).status(), url).toBe(200);
  await context.close();
});

test("guides load no planner bundle and controlled navigation preserves a 404", async ({ page }) => {
  const resources: string[] = [];
  page.on("request", (r) => resources.push(r.url()));
  await page.goto("/guides/shadow-length/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How long will the shadow be?");
  expect(resources.some((r) => /maps\/lib|\/assets\/.*\.js/.test(r))).toBe(false);
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
  });
  const missing = await page.goto("/not-a-real-suncalc-page/");
  expect(missing!.status()).toBe(404);
  await expect(page.locator(".planner")).toHaveCount(0);
});
