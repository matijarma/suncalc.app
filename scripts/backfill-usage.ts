// Write a replayable, aggregate-only SQL import. Pass the zone-scoped token in the environment.
import { archiveStart, edgeArgs, fetchHours } from "../admin/edge";
import { HOUR } from "../shared/usage";
const token = process.env.CF_ANALYTICS_TOKEN;
if (!token)
  throw Error("Set CF_ANALYTICS_TOKEN (suncalc.app Zone / Analytics Read)");
const now = Math.floor(Date.now() / 60000) * 60000;
const quoted = (v: number | string) =>
  typeof v === "number" ? String(v) : "'" + v.replaceAll("'", "''") + "'";
const statements: string[] = [];
for (let t = archiveStart(now); t < now; t += 24 * HOUR) {
  const rows = await fetchHours(token, t, Math.min(t + 24 * HOUR, now));
  for (const row of rows)
    statements.push(
      "INSERT INTO edge_hourly(hour,through_ms,requests,visits,bytes,errors,countries) VALUES(" +
        edgeArgs(row).map(quoted).join(",") +
        ") ON CONFLICT(hour) DO UPDATE SET through_ms=excluded.through_ms,requests=excluded.requests,visits=excluded.visits,bytes=excluded.bytes,errors=excluded.errors,countries=excluded.countries WHERE excluded.through_ms>=edge_hourly.through_ms;",
    );
}
statements.push(
  "INSERT INTO usage_meta(key,value) VALUES('edge_success'," +
    Date.now() +
    ") ON CONFLICT(key) DO UPDATE SET value=max(value,excluded.value);",
);
process.stdout.write(statements.join("\n") + "\n");
