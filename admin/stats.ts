import {
  HOUR,
  TOOLS,
  midnight,
  shiftDay,
  zagrebDay,
  type Metric,
  type Surface,
} from "../shared/usage";
import { EDGE_START } from "./edge";
export type Range = "today" | "7" | "30";
export function readRange(raw: string | null): Range {
  return raw === "today" || raw === "30" ? raw : "7";
}
type UsageRow = { hour: number; surface: Surface; event: Metric; n: number };
type EdgeRow = {
  hour: number;
  through_ms: number;
  requests: number;
  visits: number;
  bytes: number;
  errors: number;
  countries: string;
};
type Point = {
  key: string;
  label: string;
  measured: boolean;
  partial: boolean;
  opens: number;
  active: number;
  planning: number;
  pwa: number;
  visits: number | null;
  requests: number;
  bytes: number;
  errors: number;
  edgeHours: number;
};
const hourLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "shortOffset",
});
const dayLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});
export function bounds(range: Range, now: number) {
  const today = zagrebDay(now),
    from = shiftDay(today, -(range === "today" ? 0 : Number(range) - 1));
  return { from, today, start: midnight(from) };
}
export function statsModel(
  range: Range,
  now: number,
  meta: Record<string, number>,
  usage: UsageRow[],
  edges: EdgeRow[],
) {
  const { from, today, start } = bounds(range, now),
    since = meta.planner_since ?? null;
  const points: Point[] = [],
    map = new Map<string, Point>(),
    tools = Object.fromEntries(Object.keys(TOOLS).map((k) => [k, 0])),
    countries: Record<string, number> = {};
  function add(key: string, label: string, lo: number, hi: number) {
    const p: Point = {
      key,
      label,
      measured: since !== null && hi > since && lo <= now,
      partial: hi > now || (since !== null && lo < since && hi > since),
      opens: 0,
      active: 0,
      planning: 0,
      pwa: 0,
      visits: null,
      requests: 0,
      bytes: 0,
      errors: 0,
      edgeHours: 0,
    };
    points.push(p);
    map.set(key, p);
  }
  if (range === "today") {
    for (let h = start; h <= now; h += HOUR)
      add(String(h), hourLabel.format(h), h, h + HOUR);
  } else
    for (let day = from; day <= today; day = shiftDay(day, 1))
      add(
        day,
        dayLabel.format(new Date(day + "T12:00:00Z")),
        midnight(day),
        midnight(shiftDay(day, 1)),
      );
  const which = (h: number) =>
    map.get(range === "today" ? String(h) : zagrebDay(h));
  for (const u of usage) {
    const p = which(u.hour);
    if (!p || !p.measured) continue;
    if (u.event === "open") {
      p.opens += u.n;
      if (u.surface === "pwa") p.pwa += u.n;
    } else if (u.event === "active") p.active += u.n;
    else if (u.event === "planning") p.planning += u.n;
    else if (Object.hasOwn(TOOLS, u.event)) tools[u.event] += u.n;
  }
  let through: number | null = null;
  const observed = new Set<number>();
  for (const e of edges) {
    const p = which(e.hour);
    if (!p) continue;
    p.visits = (p.visits ?? 0) + e.visits;
    p.requests += e.requests;
    p.bytes += e.bytes;
    p.errors += e.errors;
    p.edgeHours++;
    through = Math.max(through ?? 0, e.through_ms);
    if (e.through_ms >= Math.min(now, e.hour + HOUR) - 60000)
      observed.add(e.hour);
    for (const [cc, v] of Object.entries(
      JSON.parse(e.countries) as Record<string, number>,
    ))
      if (/^[A-Z]{2}$/.test(cc) && Number.isFinite(v))
        countries[cc] = (countries[cc] || 0) + v;
  }
  let missingHours = 0;
  for (
    let h = Math.max(start, EDGE_START);
    h < Math.floor(now / HOUR) * HOUR;
    h += HOUR
  )
    if (!observed.has(h)) missingHours++;
  const measuredDays =
    range === "today"
      ? since !== null && since <= now
        ? 1
        : 0
      : points.filter((p) => p.measured).length;
  const sum = (
    k:
      | "opens"
      | "active"
      | "planning"
      | "pwa"
      | "visits"
      | "requests"
      | "bytes"
      | "errors",
  ) => points.reduce((n, p) => n + (p[k] ?? 0), 0);
  return {
    range,
    timezone: "Europe/Zagreb",
    from,
    today,
    now,
    plannerSince: since,
    measuredDays,
    points,
    tools,
    planner: measuredDays
      ? {
          opens: sum("opens"),
          activePerDay: sum("active") / measuredDays,
          planning: sum("planning"),
          pwa: sum("pwa"),
        }
      : null,
    edge: {
      totals:
        through === null
          ? null
          : {
              visits: sum("visits"),
              requests: sum("requests"),
              bytes: sum("bytes"),
              errors: sum("errors"),
            },
      countries: Object.entries(countries)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10),
      through,
      lastSuccess: meta.edge_success ?? null,
      stale:
        !meta.edge_success ||
        now - meta.edge_success > 45 * 60000 ||
        (meta.edge_failure || 0) > meta.edge_success,
      missingHours,
    },
  };
}
export async function readStats(
  db: D1Database,
  range: Range,
  now = Date.now(),
) {
  const { from, today, start } = bounds(range, now);
  const [m, u, e] = await db.batch([
    db.prepare("SELECT key,value FROM usage_meta"),
    db
      .prepare(
        range === "today"
          ? "SELECT hour,surface,event,n FROM usage_hourly WHERE day BETWEEN ? AND ? AND hour<=?"
          : "SELECT min(hour) AS hour,surface,event,sum(n) AS n FROM usage_hourly WHERE day BETWEEN ? AND ? AND hour<=? GROUP BY day,surface,event",
      )
      .bind(from, today, now),
    db
      .prepare(
        "SELECT * FROM edge_hourly WHERE hour BETWEEN ? AND ? ORDER BY hour",
      )
      .bind(start, now),
  ]);
  return statsModel(
    range,
    now,
    Object.fromEntries(
      (m.results as { key: string; value: number }[]).map((x) => [
        x.key,
        x.value,
      ]),
    ),
    u.results as UsageRow[],
    e.results as EdgeRow[],
  );
}
export type Snapshot = ReturnType<typeof statsModel>;
