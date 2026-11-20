/** Sredstva's bounded UTC-hour archive, using the zone endpoint and visits sourced from the public planner's HTML only. */
import { HOUR } from "../shared/usage";
export const EDGE_START = Date.parse("2026-11-20T15:00:00Z"); // hour the SunCalc zone was created
export const ZONE_ID = "e04a3d1d33de17c733250b0309a6b3bb";
const PAGE = 10000,
  DAY = 24 * HOUR;
const query = `query SunCalcEdge($zone:String!,$start:Time!,$end:Time!,$host:String!){viewer{zones(filter:{zoneTag:$zone}){
 traffic:httpRequestsAdaptiveGroups(limit:24,filter:{datetime_geq:$start,datetime_lt:$end,clientRequestHTTPHost:$host,requestSource:"eyeball"}){count sum{edgeResponseBytes} dimensions{datetimeHour}}
 errors:httpRequestsAdaptiveGroups(limit:24,filter:{datetime_geq:$start,datetime_lt:$end,clientRequestHTTPHost:$host,requestSource:"eyeball",edgeResponseStatus_geq:500,edgeResponseStatus_lt:600}){count dimensions{datetimeHour}}
 countries:httpRequestsAdaptiveGroups(limit:10000,filter:{datetime_geq:$start,datetime_lt:$end,clientRequestHTTPHost:$host,requestSource:"eyeball",clientRequestHTTPMethodName:"GET",clientRequestPath_in:["/","/index.html"],edgeResponseStatus:200,verifiedBotCategory:"",userAgentBrowser_notin:["Curl","YandexBot","GoogleBot","ChromeHeadless"]}){sum{visits} dimensions{datetimeHour clientCountryName}}
}}}`;
type Group = {
  count?: number;
  sum?: { visits?: number; edgeResponseBytes?: number };
  dimensions: { datetimeHour: string; clientCountryName?: string };
};
export type EdgeHour = {
  hour: number;
  through: number;
  requests: number;
  visits: number;
  bytes: number;
  errors: number;
  countries: Record<string, number>;
};
export type EdgeEnv = { USAGE_DB: D1Database; CF_ANALYTICS_TOKEN?: string };
function amount(x: unknown) {
  if (typeof x !== "number" || !Number.isFinite(x) || x < 0)
    throw Error("invalid edge aggregate");
  return Math.round(x);
}
export function archiveStart(now: number) {
  return Math.max(EDGE_START, Math.ceil((now - 30 * DAY) / HOUR) * HOUR);
}
export async function fetchHours(
  token: string,
  start: number,
  end: number,
  fetcher: typeof fetch = fetch,
): Promise<EdgeHour[]> {
  if (!token || start % HOUR !== 0 || end <= start || end - start > DAY)
    throw Error("invalid edge window");
  const res = await fetcher("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: {
        zone: ZONE_ID,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        host: "suncalc.app",
      },
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw Error("edge HTTP " + res.status);
  const payload = (await res.json()) as {
    errors?: unknown[];
    data?: {
      viewer?: {
        zones?: { traffic: Group[]; errors: Group[]; countries: Group[] }[];
      };
    };
  };
  const zone = payload.data?.viewer?.zones?.[0];
  if (
    payload.errors?.length ||
    !zone ||
    ![zone.traffic, zone.errors, zone.countries].every(Array.isArray) ||
    zone.countries.length >= PAGE
  )
    throw Error("incomplete edge results");
  const hours = new Map<number, EdgeHour>();
  for (let h = start; h < end; h += HOUR)
    hours.set(h, {
      hour: h,
      through: Math.min(end, h + HOUR),
      requests: 0,
      visits: 0,
      bytes: 0,
      errors: 0,
      countries: {},
    });
  const bucket = (r: Group) => {
    const b = hours.get(Date.parse(r.dimensions.datetimeHour));
    if (!b) throw Error("unexpected edge hour");
    return b;
  };
  for (const g of zone.traffic) {
    const h = bucket(g);
    h.requests += amount(g.count);
    h.bytes += amount(g.sum?.edgeResponseBytes);
  }
  for (const g of zone.errors) bucket(g).errors += amount(g.count);
  for (const g of zone.countries) {
    const h = bucket(g),
      cc = g.dimensions.clientCountryName || "XX",
      c = /^[A-Z]{2}$/.test(cc) ? cc : "XX",
      v = amount(g.sum?.visits);
    h.visits += v;
    if (v) h.countries[c] = (h.countries[c] || 0) + v;
  }
  return [...hours.values()];
}
export const EDGE_UPSERT =
  "INSERT INTO edge_hourly(hour,through_ms,requests,visits,bytes,errors,countries) VALUES(?,?,?,?,?,?,?) ON CONFLICT(hour) DO UPDATE SET through_ms=excluded.through_ms,requests=excluded.requests,visits=excluded.visits,bytes=excluded.bytes,errors=excluded.errors,countries=excluded.countries WHERE excluded.through_ms>=edge_hourly.through_ms";
export const edgeArgs = (h: EdgeHour) => [
  h.hour,
  h.through,
  h.requests,
  h.visits,
  h.bytes,
  h.errors,
  JSON.stringify(h.countries),
];
export const META_MAX =
  "INSERT INTO usage_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=max(value,excluded.value)";
// Recent values are re-read because adaptive analytics can arrive late. Gradually repair older gaps.
export function windows(
  now: number,
  complete: ReadonlySet<number>,
): [number, number][] {
  const end = Math.floor(now / 60000) * 60000,
    head = Math.floor(end / HOUR) * HOUR,
    low = archiveStart(now);
  if (end <= low) return [];
  const recent = Math.max(
      low,
      head - (new Date(now).getUTCHours() === 2 ? 23 : 3) * HOUR,
    ),
    result: [number, number][] = [[recent, end]];
  let count = 0;
  for (let h = low; h < recent && count < 48; ) {
    if (complete.has(h)) {
      h += HOUR;
      continue;
    }
    const start = h;
    while (h < recent && !complete.has(h) && h - start < DAY && count < 48) {
      h += HOUR;
      count++;
    }
    result.push([start, h]);
  }
  return result;
}
export async function syncEdge(
  env: EdgeEnv,
  now = Date.now(),
  fetcher: typeof fetch = fetch,
) {
  const db = env.USAGE_DB;
  try {
    if (!env.CF_ANALYTICS_TOKEN) throw Error("missing analytics secret");
    const done = await db
      .prepare(
        "SELECT hour FROM edge_hourly WHERE hour>=? AND through_ms>=hour+?",
      )
      .bind(archiveStart(now), HOUR)
      .all<{ hour: number }>();
    for (const [start, end] of windows(
      now,
      new Set(done.results.map((x) => x.hour)),
    )) {
      const rows = await fetchHours(
        env.CF_ANALYTICS_TOKEN,
        start,
        end,
        fetcher,
      );
      await db.batch(
        rows.map((h) => db.prepare(EDGE_UPSERT).bind(...edgeArgs(h))),
      );
    }
    await db.prepare(META_MAX).bind("edge_success", now).run();
  } catch {
    await db.prepare(META_MAX).bind("edge_failure", now).run();
    return false;
  }
  return true;
}
