import {
  HOUR,
  METRICS,
  zagrebDay,
  type Metric,
  type Surface,
} from "../shared/usage";
const allowed = new Set<string>(METRICS);
const reply = (s: number) =>
  new Response(null, {
    status: s,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
export async function collectUsage(
  req: Request,
  db?: D1Database,
  now = Date.now(),
) {
  if (new URL(req.url).origin !== "https://suncalc.app" || !db)
    return reply(404);
  if (req.method !== "POST") return reply(405);
  if (
    req.headers.get("origin") !== "https://suncalc.app" ||
    !["same-origin", null].includes(req.headers.get("sec-fetch-site")) ||
    req.headers.has("authorization")
  )
    return reply(403);
  if (
    req.headers.get("content-type")?.split(";")[0].trim() !== "application/json"
  )
    return reply(415);
  if (Number(req.headers.get("content-length")) > 512) return reply(413);
  const reader = req.body?.getReader();
  if (!reader) return reply(400);
  let size = 0;
  const text = new TextDecoder(),
    parts: string[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512) {
      void reader.cancel();
      return reply(413);
    }
    parts.push(text.decode(value, { stream: true }));
  }
  let input: unknown;
  try {
    input = JSON.parse(parts.join("") + text.decode());
  } catch {
    return reply(400);
  }
  if (
    !input ||
    typeof input !== "object" ||
    Object.keys(input).sort().join(",") !== "events,surface"
  )
    return reply(400);
  const { surface, events } = input as { surface: Surface; events: Metric[] };
  if (
    !["browser", "pwa"].includes(surface) ||
    !Array.isArray(events) ||
    events.length < 1 ||
    events.length > allowed.size ||
    events.some((n) => !allowed.has(n)) ||
    new Set(events).size !== events.length
  )
    return reply(400);
  const day = zagrebDay(now),
    hour = Math.floor(now / HOUR) * HOUR;
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO usage_meta(key,value) VALUES('planner_since',?)",
      )
      .bind(now),
    ...events.map((n) =>
      db
        .prepare(
          "INSERT INTO usage_hourly(day,hour,surface,event,n) VALUES(?,?,?,?,1) ON CONFLICT(day,hour,surface,event) DO UPDATE SET n=n+1",
        )
        .bind(day, hour, surface, n),
    ),
  ]);
  return reply(204);
}
