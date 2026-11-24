import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from "jose";
import { serveAdmin } from "../admin/handler";
import worker from "../worker/app";
import { authorized } from "../admin/auth";
import { fetchHours, syncEdge, windows, EDGE_START } from "../admin/edge";
import { fixture } from "./usage-fixture";
import { readStats } from "../admin/stats";
import { renderStats } from "../admin/render";
import { HOUR } from "../shared/usage";
test("the same Worker keeps admin routes and assets off the public and preview hosts", async () => {
  const publicAssets: string[] = [];
  const env = {
    ASSETS: {
      fetch: async (req: Request) => {
        publicAssets.push(new URL(req.url).pathname);
        return new Response("public asset");
      },
    },
  } as Parameters<typeof worker.fetch>[1];
  const call = (host: string, path: string) =>
    worker.fetch(
      new Request("https://" + host + path),
      env,
      {} as ExecutionContext,
    );
  for (const path of [
    "/",
    "/icon.svg",
    "/site.css",
    "/guides/",
    "/api/config",
    "/api/stats",
    "/tiles/v1/0/0/0.mvt",
  ]) {
    const resp = await call("sin.suncalc.app", path);
    assert.equal(resp.status, 403, path);
    assert.match(resp.headers.get("Cache-Control")!, /private, no-store/);
  }
  assert.deepEqual(publicAssets, []);
  for (const host of [
    "suncalc.app",
    "www.suncalc.app",
    "suncalc-app-preview.example.workers.dev",
  ]) {
    assert.equal(await (await call(host, "/")).text(), "public asset");
    assert.equal((await call(host, "/api/config")).status, 200);
    assert.equal((await call(host, "/api/stats")).status, 404);
  }
});

test("Access: require allowed hostname, signed identity, issuer, audience and expiry before every response", async () => {
  const { db } = fixture(),
    env = {
      ASSETS: {
        fetch: async (input: URL) => new Response(input.pathname),
      } as Fetcher,
      USAGE_DB: db,
      ACCESS_ISSUER: "https://example.cloudflareaccess.com",
      ACCESS_AUD: "sin-audience",
    },
    pair = await generateKeyPair("RS256"),
    key = createLocalJWKSet({
      keys: [{ ...(await exportJWK(pair.publicKey)), kid: "test" }],
    });
  const token = (iss = env.ACCESS_ISSUER, aud = env.ACCESS_AUD, exp = "2m") =>
    new SignJWT({ email: "operator@example.test" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuedAt()
      .setIssuer(iss)
      .setAudience(aud)
      .setExpirationTime(exp)
      .sign(pair.privateKey);
  const call = (url: string, t?: string, e = env, method = "GET") =>
    serveAdmin(
      new Request(url, {
        method,
        headers: t
          ? { "Cf-Access-Jwt-Assertion": t }
          : { "Cf-Access-Authenticated-User-Email": "operator@example.test" },
      }),
      e,
      (r, bindings) => authorized(r, bindings, key),
    );
  for (const path of [
    "/",
    "/api/stats",
    "/font.woff2",
    "/icon.svg",
    "/wordmark.svg",
  ])
    assert.equal(
      (
        await call("https://sin.suncalc.app" + path, undefined, {
          ...env,
          USAGE_DB: null as any,
        })
      ).status,
      403,
    );
  for (const t of [
    await token("https://another.cloudflareaccess.com"),
    await token(undefined, "other-app"),
    await token(undefined, undefined, "-1m"),
    "not-a-jwt",
  ])
    assert.equal(
      (await call("https://sin.suncalc.app/api/stats", t)).status,
      403,
    );
  const valid = await token();
  for (const host of ["suncalc.app", "suncalc-admin.example.workers.dev"])
    assert.equal(
      (await call("https://" + host + "/api/stats", valid)).status,
      404,
    );
  for (const [asset, path, type] of [
    ["/font.woff2", "/brand/bricolage.woff2", "font/woff2"],
    ["/wordmark.svg", "/brand/wordmark.svg", "image/svg+xml"],
    ["/icon.svg", "/icon.svg", "image/svg+xml"],
  ]) {
    const url = "https://sin.suncalc.app" + asset;
    const response = await call(url, valid);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), type);
    assert.equal(await response.text(), path);
    assert.equal(await (await call(url, valid, env, "HEAD")).text(), "");
  }
  for (const path of ["/api/config", "/site.css", "/sw.js"])
    assert.equal(
      (await call("https://sin.suncalc.app" + path, valid)).status,
      404,
    );
  const page = await call("https://sin.suncalc.app/", valid);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("cache-control")!, /no-store/);
  assert.match(
    page.headers.get("content-security-policy")!,
    /default-src 'none'/,
  );
  const html = await page.text();
  assert.match(html, /Tool reach/);
  assert.match(html, /Not measured/);
  assert.equal(
    (await call("https://sin.suncalc.app/api/stats?range=today", valid)).status,
    200,
  );
});
test("Cloudflare archive is bounded, idempotent, production-only and keeps last good results on failure", async () => {
  const { sql, db } = fixture(),
    env = { USAGE_DB: db, CF_ANALYTICS_TOKEN: "test-only" },
    now = EDGE_START + 3.5 * HOUR;
  let reads = 0;
  const fetched = (async (_url: unknown, opts: any) => {
    reads++;
    const { query, variables: v } = JSON.parse(opts.body);
    assert.equal(v.host, "suncalc.app");
    assert.match(query, /requestSource:"eyeball"/);
    assert.match(query, /verifiedBotCategory:""/);
    assert.ok(Date.parse(v.end) - Date.parse(v.start) <= 24 * HOUR);
    const h = { datetimeHour: v.start };
    return Response.json({
      data: {
        viewer: {
          zones: [
            {
              traffic: [
                { dimensions: h, count: 100, sum: { edgeResponseBytes: 2048 } },
              ],
              errors: [{ dimensions: h, count: 1 }],
              countries: [
                {
                  dimensions: { ...h, clientCountryName: "HR" },
                  sum: { visits: 7 },
                },
              ],
            },
          ],
        },
      },
    });
  }) as typeof fetch;
  assert.ok(await syncEdge(env, now, fetched));
  const first = sql.prepare("SELECT * FROM edge_hourly ORDER BY hour").all();
  assert.equal(first.length, 4);
  assert.ok(await syncEdge(env, now, fetched));
  assert.deepEqual(
    sql.prepare("SELECT * FROM edge_hourly ORDER BY hour").all(),
    first,
  );
  assert.ok(reads >= 2);
  const failed = async () =>
    Response.json({ errors: [{ message: "no analytics" }] });
  assert.equal(await syncEdge(env, now + 60000, failed), false);
  assert.deepEqual(
    sql.prepare("SELECT * FROM edge_hourly ORDER BY hour").all(),
    first,
  );
  const s = await readStats(db, "7", now + 60000);
  assert.equal(s.edge.stale, true);
  assert.deepEqual(s.edge.totals, {
    visits: 7,
    requests: 100,
    bytes: 2048,
    errors: 1,
  });
  assert.deepEqual(s.edge.countries, [["HR", 7]]);
  assert.match(renderStats(s, "nonce"), /last available figures/);
  assert.ok(s.points.some((p) => p.visits === null));
  await assert.rejects(
    fetchHours("x", EDGE_START, EDGE_START + 25 * HOUR, fetched),
  );
  const ws = windows(EDGE_START + 35 * 24 * HOUR, new Set());
  assert.ok(ws.every(([a, b]) => b > a && b - a <= 24 * HOUR));
  assert.ok(ws.length <= 4);
});
