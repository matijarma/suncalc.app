import { SPLIT, validSpot, type Spot } from "./solar";
export function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem("sc:" + key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function write(key: string, value: unknown) {
  try {
    localStorage.setItem("sc:" + key, JSON.stringify(value));
  } catch {}
}
export function shareURL(p: Spot, ms: number) {
  const u = new URL(location.href);
  u.search = "";
  u.hash = new URLSearchParams({
    lat: String(p.lat),
    lon: String(p.lon),
    at: new Date(ms).toISOString(),
    place: p.name,
  }).toString();
  return u.toString();
}
export function initial() {
  const h = new URLSearchParams(location.hash.slice(1)),
    p = {
      lat: Number(h.get("lat")),
      lon: Number(h.get("lon")),
      name: (h.get("place") || "Shared pin").slice(0, 140),
    },
    ms = Date.parse(h.get("at") || "");
  if (
    h.has("lat") &&
    h.has("lon") &&
    validSpot(p) &&
    Number.isFinite(ms) &&
    new Date(ms).getUTCFullYear() >= 1900 &&
    new Date(ms).getUTCFullYear() <= 2100
  )
    return { p, ms, example: false };
  const last = read<Spot | null>("last", null);
  return {
    p: validSpot(last) ? last : SPLIT,
    ms: Date.now(),
    example: !validSpot(last),
  };
}
export function coordinates(q: string): Spot | null {
  const m = q
    .trim()
    .match(
      /^(?:geo:)?\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/i,
    );
  if (!m) return null;
  const p = { lat: +m[1], lon: +m[2], name: "Pinned coordinates" };
  return validSpot(p) ? p : null;
}
