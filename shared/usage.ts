/** Shared, closed Kajima-style vocabulary. No field permits a place, link, timestamp or identifier. */
export const TOOLS = {
  place: "Place selection",
  time: "Time changes",
  date: "Date changes",
  seasons: "Season comparison",
  shadow: "Shadow ruler",
  save: "Saving a place",
  share: "Sharing a plan",
} as const;
export type Tool = keyof typeof TOOLS;
export const METRICS = [
  "open",
  "active",
  "planning",
  ...Object.keys(TOOLS),
] as const;
export type Metric = "open" | "active" | "planning" | Tool;
export type Surface = "browser" | "pwa";
export const ZONE = "Europe/Zagreb";
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const HOUR = 3600000;
export function zagrebDay(ms: number) {
  const p = fmt.formatToParts(ms),
    v = (k: string) => p.find((x) => x.type === k)!.value;
  return v("year") + "-" + v("month") + "-" + v("day");
}
export function shiftDay(day: string, by: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}
export function midnight(day: string) {
  const utc = Date.parse(day + "T00:00:00Z");
  for (let t = utc - 3 * HOUR; t <= utc; t += HOUR)
    if (zagrebDay(t) === day) return t;
  throw Error("Invalid Zagreb day");
}
