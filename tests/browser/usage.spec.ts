import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { renderStats } from "../../admin/render";
import { statsModel, readRange } from "../../admin/stats";
test.use({ serviceWorkers: "block" });
test("real planner emits only fixed, online counters; reload and offline edits do not inflate daily/tool reach", async ({
  page,
  context,
}) => {
  const batches: { surface: string; events: string[] }[] = [];
  const leaks: string[] = [];
  // Some Chromium builds route keepalive traffic through the browser process.
  // Intercept at the document's fetch boundary so a test never beacons to the live apex.
  await page.exposeFunction(
    "inspectUsage",
    (b: { surface: string; events: string[] }, safe: boolean) => {
      if (!safe || Object.keys(b).sort().join(",") !== "events,surface")
        leaks.push("context");
      batches.push(b);
    },
  );
  await page.addInitScript(() => {
    const native = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (
        new URL(
          input instanceof Request ? input.url : String(input),
          location.href,
        ).pathname !== "/api/usage"
      )
        return native(input, init);
      const h = new Headers(init?.headers);
      return (window as any)
        .inspectUsage(
          JSON.parse(String(init?.body)),
          init?.credentials === "omit" &&
            init?.referrerPolicy === "no-referrer" &&
            init?.keepalive === true &&
            !h.has("authorization") &&
            !h.has("cookie"),
        )
        .then(() => new Response(null, { status: 204 }));
    };
  });
  await context.route("https://suncalc.app/**", async (r) => {
    const u = new URL(r.request().url());
    const res = await context.request.get(
      "http://127.0.0.1:8789" + u.pathname + u.search,
    );
    return r.fulfill({ response: res });
  });
  await page.goto(
    "https://suncalc.app/#lat=43.50&lon=16.44&at=2026-06-21T17%3A00%3A00Z&place=Private+example",
  );
  await expect.poll(() => batches.flatMap((b) => b.events)).toContain("open");
  await expect(page.getByRole("slider")).toBeVisible();
  const r = page.getByRole("slider");
  await r.focus();
  for (let k = 0; k < 8; k++) await page.keyboard.press("ArrowRight");
  await expect
    .poll(
      () => batches.flatMap((b) => b.events).filter((e) => e === "time").length,
    )
    .toBe(1);
  expect(
    batches.flatMap((b) => b.events).filter((e) => e === "planning"),
  ).toHaveLength(1);
  await page.reload();
  await expect
    .poll(
      () => batches.flatMap((b) => b.events).filter((e) => e === "open").length,
    )
    .toBe(2);
  expect(
    batches.flatMap((b) => b.events).filter((e) => e === "active"),
  ).toHaveLength(1);
  expect(
    await page.evaluate(() => localStorage.getItem("sc:usage-day")),
  ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save place", exact: true }).click();
  await context.setOffline(false);
  await page.waitForTimeout(400);
  expect(batches.flatMap((b) => b.events)).not.toContain("save");
  expect(batches.every((b) => b.surface === "browser")).toBe(true);
  expect(JSON.stringify(batches)).not.toMatch(
    /Private|43\.50|16\.44|2026|install|https/,
  );
  expect(leaks).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});
test.describe("server-rendered admin", () => {
  test.use({ javaScriptEnabled: false });
  test("private Usage screen works without JavaScript; ranges, accessible tables and narrow layout", async ({
    page,
  }) => {
    const now = Date.parse("2026-11-21T12:16:00Z"),
      hour = Date.parse("2026-11-21T12:00Z");
    const usage = [
      { hour, surface: "pwa" as const, event: "open" as const, n: 3 },
      { hour, surface: "pwa" as const, event: "time" as const, n: 2 },
    ];
    await page.route("https://sin.suncalc.app/**", async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === "/font.woff2")
        return route.fulfill({
          contentType: "font/woff2",
          body: readFileSync("public/brand/bricolage.woff2"),
        });
      if (u.pathname === "/icon.svg")
        return route.fulfill({
          contentType: "image/svg+xml",
          body: readFileSync("public/icon.svg"),
        });
      const s = statsModel(
        readRange(u.searchParams.get("range")),
        now,
        { planner_since: hour, edge_success: now },
        usage,
        [
          {
            hour,
            through_ms: now,
            requests: 90,
            visits: 9,
            bytes: 49000,
            errors: 1,
            countries: '{"HR":9}',
          },
        ],
      );
      return route.fulfill({
        contentType: "text/html",
        body: renderStats(s, "test"),
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("https://sin.suncalc.app/");
    await expect(page.getByRole("heading", { name: "Usage." })).toBeVisible();
    await expect(page.getByRole("link", { name: "7 days" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.getByText("View chart data", { exact: true }).click();
    await expect(
      page.getByRole("table", { name: "Planner activity" }),
    ).toContainText("Not measured");
    await page.getByRole("link", { name: "Today", exact: true }).click();
    await expect(page.getByRole("link", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByRole("table", { name: "Top countries by estimated visits" }),
    ).toContainText("Croatia");
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
    }
    await page.getByRole("link", { name: "30 days" }).click();
    await expect(page.getByRole("link", { name: "30 days" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
