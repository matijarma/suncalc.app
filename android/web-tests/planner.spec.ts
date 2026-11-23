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

test("the live shadow rotates with true heading and disappears at night or without a fix", async ({
  page,
}) => {
  await bridge(page, "locked");
  await page.clock.setFixedTime(new Date("2026-06-21T10:00:00Z"));
  await page.goto("/");
  await page.getByRole("button", { name: /Live Shadow/ }).click();
  const line = page.locator(".cast-line");
  const fix = (lat: number, lon: number, heading: number | null) =>
    page.evaluate(
      (v) => dispatchEvent(new CustomEvent("sc:sensor", { detail: v })),
      { lat, lon, heading },
    );
  const vector = () =>
    line.evaluate((el) => [
      Number(el.getAttribute("x2")) - 110,
      Number(el.getAttribute("y2")) - 110,
    ]);
  await expect(line).toBeVisible();
  const [x, y] = await vector();
  await fix(43.508, 16.438, 90);
  await expect(page.getByText(/Compass aligned to true north/)).toBeVisible();
  const [a, b] = await vector();
  expect(a).toBeCloseTo(y, 3);
  expect(b).toBeCloseTo(-x, 3);
  await fix(43.508, -163.562, null);
  await expect(page.getByText(/sun is below the horizon/i)).toBeVisible();
  await expect(line).toHaveCount(0);
  await page.evaluate(() =>
    dispatchEvent(
      new CustomEvent("sc:sensor", {
        detail: { status: "Location permission is off." },
      }),
    ),
  );
  await expect(page.getByText("Location permission is off.")).toBeVisible();
  await expect(line).toHaveCount(0);
});
