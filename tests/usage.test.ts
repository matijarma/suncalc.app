import test from "node:test";
import assert from "node:assert/strict";
import { createCollector, type UsagePort } from "../src/usage";
import {
  midnight,
  HOUR,
  zagrebDay,
  type Metric,
  type Surface,
} from "../shared/usage";
import { collectUsage } from "../worker/usage";
import { fixture } from "./usage-fixture";
import { readStats } from "../admin/stats";
function client() {
  let activeDay = "",
    online = true,
    visible = true,
    now = Date.parse("2026-11-21T22:58Z");
  const sent: { surface: Surface; events: Metric[] }[] = [];
  const port: UsagePort = {
    now: () => now,
    online: () => online,
    visible: () => visible,
    surface: () => "pwa",
    claimDay: (d) => {
      if (activeDay === d) return false;
      activeDay = d;
      return true;
    },
    send: (surface, events) => sent.push({ surface, events }),
    later: () => 1 as unknown as ReturnType<typeof setTimeout>,
    cancel: () => {},
  };
  return {
    sent,
    port,
    online: (v: boolean) => (online = v),
    visible: (v: boolean) => (visible = v),
    time: (v: number) => (now = v),
  };
}
test("once per open tool reach, distinct daily marker across reloads, resets at Zagreb midnight", () => {
  const f = client(),
    a = createCollector(f.port);
  a.observe();
  for (let i = 0; i < 200; i++) a.observe("time");
  a.observe("place");
  a.flush();
  assert.deepEqual(f.sent, [
    { surface: "pwa", events: ["open", "planning", "time", "place", "active"] },
  ]);
  const b = createCollector(f.port);
  b.observe("save");
  b.flush();
  assert.deepEqual(f.sent[1].events, ["open", "planning", "save"]);
  f.time(Date.parse("2026-11-21T23:01Z"));
  b.observe("time");
  b.flush();
  assert.deepEqual(f.sent[2].events, ["open", "planning", "time", "active"]);
});
test("never replays offline or hidden use; failed storage or network never breaks planning", () => {
  const f = client(),
    a = createCollector(f.port);
  f.online(false);
  a.observe("seasons");
  f.online(true);
  a.observe("place");
  f.online(false);
  a.offline();
  f.online(true);
  f.visible(false);
  a.observe("share");
  f.visible(true);
  a.observe();
  a.flush();
  assert.deepEqual(f.sent[0].events, ["open", "active"]);
  a.observe("time");
  f.time(Date.parse("2026-11-22T06:00Z"));
  a.flush();
  assert.equal(f.sent.length, 1);
  const broken = createCollector({
    ...f.port,
    claimDay: () => false,
    send: () => {
      throw Error("network");
    },
  });
  assert.doesNotThrow(() => {
    broken.observe("shadow");
    broken.flush();
  });
});
const req = (
  data: unknown,
  url = "https://suncalc.app/api/usage",
  origin = "https://suncalc.app",
) =>
  new Request(url, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(data),
  });
test("collector admits only small allowlisted counters for the production origin, neither stores nor accepts context", async () => {
  const { sql, db } = fixture(),
    now = Date.parse("2026-11-22T02:22Z"),
    good = {
      surface: "browser",
      events: ["open", "active", "planning", "place"],
    };
  assert.equal((await collectUsage(req(good), db, now)).status, 204);
  for (const data of [
    { ...good, lat: 42 },
    { ...good, id: "random" },
    { ...good, events: ["open", "query text"] },
    { ...good, events: ["open", "open"] },
    { surface: "iphone", events: ["open"] },
  ])
    assert.equal((await collectUsage(req(data), db, now)).status, 400);
  assert.equal(
    (await collectUsage(req({ extra: "x".repeat(530) }), db, now)).status,
    413,
  );
  assert.equal(
    (
      await collectUsage(
        req(good, undefined, "https://elsewhere.example"),
        db,
        now,
      )
    ).status,
    403,
  );
  for (const host of [
    "sin.suncalc.app",
    "localhost",
    "suncalc-app-preview.kompmajstor4.workers.dev",
  ])
    assert.equal(
      (await collectUsage(req(good, "https://" + host + "/api/usage"), db, now))
        .status,
      404,
    );
  assert.deepEqual(
    sql
      .prepare("SELECT name FROM pragma_table_info('usage_hourly')")
      .all()
      .map((r) => r.name),
    ["day", "hour", "surface", "event", "n"],
  );
  assert.equal(sql.prepare("SELECT sum(n) n FROM usage_hourly").get()?.n, 4);
  const stats = await readStats(db, "7", now);
  assert.equal(stats.measuredDays, 1);
  assert.deepEqual(stats.planner, {
    opens: 1,
    activePerDay: 1,
    planning: 1,
    pwa: 0,
  });
  assert.equal(stats.points.filter((p) => !p.measured).length, 6);
  assert.equal(stats.edge.totals, null);
  const later = await readStats(db, "7", now + 24 * HOUR);
  assert.equal(later.measuredDays, 2);
  assert.equal(later.planner?.activePerDay, 0.5);
  assert.equal(later.points.at(-1)?.opens, 0);
  assert.equal(later.points.at(-1)?.measured, true);
});
test("Zagreb reporting has 23/25 hours, and autumn’s two 02:00 buckets are distinct", async () => {
  assert.equal(midnight("2026-03-30") - midnight("2026-03-29"), 23 * HOUR);
  assert.equal(midnight("2026-10-26") - midnight("2026-10-25"), 25 * HOUR);
  assert.equal(zagrebDay(Date.parse("2026-06-20T22:00Z")), "2026-06-21");
  const f = fixture(),
    s = await readStats(f.db, "today", midnight("2026-10-26") - 1);
  const twice = s.points.filter((p) => p.label.startsWith("02:00"));
  assert.equal(s.points.length, 25);
  assert.equal(twice.length, 2);
  assert.notEqual(twice[0].label, twice[1].label);
  assert.equal(s.planner, null);
});
