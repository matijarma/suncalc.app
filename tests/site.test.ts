import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { sharedPlan } from "../src/storage";
import { searchResponse } from "../worker/site";

test("only complete, valid plan fragments change the planning state", () => {
  for (const hash of ["", "#learn", "#privacy", "#lat=1&lon=2", "#lat=91&lon=2&at=2026-01-01T12:00:00Z", "#lat=1&lon=2&at=2200-01-01T12:00:00Z"])
    assert.equal(sharedPlan(hash), null);
  const shared = sharedPlan("#lat=43.5083&lon=16.4383&at=2026-06-21T10%3A56%3A03.155Z&place=Split+waterfront");
  assert.equal(shared?.p.name, "Split waterfront");
  assert.equal(shared?.p.lat, 43.5083);
  assert.equal(new Date(shared!.ms).toISOString(), "2026-06-21T10:56:03.155Z");
});

test("preview assets are noindex while production remains indexable", async () => {
  for (const [host, expected] of [["suncalc.app", null], ["suncalc-app-preview.mrma.workers.dev", "noindex, nofollow"]]) {
    const response = searchResponse(new Request(`https://${host}/guides/`), new Response("<h1>Guide</h1>", { headers: { "Content-Type": "text/html" } }));
    assert.equal(response.headers.get("X-Robots-Tag"), expected);
    assert.equal(await response.text(), "<h1>Guide</h1>");
  }
});

// Exercise the actual navigation handler embedded in the generated service worker.
test("offline fallback stays at the planner URL; HTTP failures are preserved", async () => {
  const script = readFileSync("scripts/service-worker.mjs", "utf8");
  const code = script.slice(script.indexOf("if(r.mode==='navigate')"), script.indexOf("if(SHELL.includes"));
  async function navigate(path: string, status: number | null) {
    let response: Promise<Response> | undefined;
    const context = {
      r: { mode: "navigate" }, u: new URL("https://suncalc.app" + path),
      e: { respondWith: (value: Promise<Response>) => { response = value; } },
      fetch: async () => { if (status === null) throw Error("offline"); return new Response("original", { status }); },
      caches: { open: async () => ({ match: async () => new Response("cached planner") }) },
      NAME: "test", Response,
    };
    runInNewContext(`(function(){${code}})()`, context);
    return response!;
  }
  for (const status of [200, 404, 503]) {
    const response = await navigate("/missing/", status);
    assert.equal(response.status, status);
    assert.equal(await response.text(), "original");
  }
  assert.equal(await (await navigate("/", null)).text(), "cached planner");
  const guide = await navigate("/guides/sun-direction/", null);
  assert.equal(guide.status, 503);
  assert.match(await guide.text(), /This page needs a connection/);
});
