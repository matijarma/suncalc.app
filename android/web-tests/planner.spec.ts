import { test, expect, type Page } from "@playwright/test";
async function bridge(page: Page, initial: string) {
  await page.addInitScript((initial) => {
    const w = window as any;
    let kind = initial;
    const prices = { suncalc_monthly: "€0.50", suncalc_lifetime: "€5.00" };
    const state = () => ({
      kind,
      prices,
      commerceReady: true,
      now: Date.now(),
      trialUntil: Date.now() + 604800000,
      monthlyUntil: 0,
    });
    w.setKind = (v: string) => {
      kind = v;
      dispatchEvent(new CustomEvent("sc:state", { detail: state() }));
    };
    w.SunCalcNative = {
      onmessage: null,
      postMessage(text: string) {
        const { id, method } = JSON.parse(text);
        queueMicrotask(() => {
          w.SunCalcNative.onmessage({
            data: JSON.stringify({
              id,
              value:
                method === "state"
                  ? state()
                  : method === "config"
                    ? { addressLookup: false }
                    : {},
            }),
          });
          if (method === "sensorStart")
            dispatchEvent(
              new CustomEvent("sc:sensor", {
                detail: { lat: 43.508, lon: 16.438, heading: null },
              }),
            );
          if (method === "restore") w.setKind("lifetime");
        });
      },
    };
  }, initial);
}
test("expired shared link never mounts the planner, free compass survives, restore returns the shared pin", async ({
  page,
}) => {
  await bridge(page, "locked");
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto(
    "/#lat=51.5&lon=-0.1&at=2026-06-21T11%3A00%3A00Z&place=London",
  );
  await expect(
    page.getByRole("heading", { name: "Your seven days are up" }),
  ).toBeVisible();
  expect(urls.some((u) => /\/tiles\/|\/assets\/main-/.test(u))).toBe(false);
  await page.getByRole("button", { name: /Live Shadow/ }).click();
  await expect(page.getByText(/North-up view/)).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Restore purchases" }).click();
  await expect(
    page.getByRole("button", { name: "Find a place, currently London" }),
  ).toBeVisible();
});
test("first-open planner, native share URL, foreground expiry and saved pins", async ({
  page,
}) => {
  await bridge(page, "trial");
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Save place", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save place", exact: true }).click();
  await page.getByRole("button", { name: "Share plan", exact: true }).click();
  await expect(page.getByLabel("Share link")).toHaveValue(
    /^https:\/\/suncalc\.app\/#lat=/,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.evaluate(() => (window as any).setKind("locked"));
  await expect(
    page.getByRole("heading", { name: "Your seven days are up" }),
  ).toBeVisible();
  await expect(page.locator("#planner-content")).toHaveCount(0);
  await page.getByRole("button", { name: "Restore purchases" }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved place", exact: true }),
  ).toBeVisible();
});
