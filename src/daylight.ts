import tokens from "./design/tokens.json";
const stops = tokens.exposure.map(([alt, hex]) => ({
  alt: Number(alt),
  rgb: [1, 3, 5].map((i) => parseInt(String(hex).slice(i, i + 2), 16)),
}));
type Color = number[];
export function altitudeColor(alt: number): Color {
  const i = stops.findIndex((s) => s.alt >= alt);
  if (i === -1) return stops[stops.length - 1].rgb;
  if (i === 0) return stops[0].rgb;
  const a = stops[i - 1],
    b = stops[i],
    f = (alt - a.alt) / (b.alt - a.alt);
  return a.rgb.map((c, j) => Math.round(c + (b.rgb[j] - c) * f));
}
// Keep enough stops to reproduce every equally spaced sample within one RGB level.
export function daylightGradient(altitudes: number[]) {
  const c = altitudes.map(altitudeColor),
    last = c.length - 1,
    keep: number[] = [0];
  function segment(start: number, end: number) {
    let chosen = -1,
      worst = 1;
    for (let i = start + 1; i < end; i++) {
      const f = (i - start) / (end - start),
        err = Math.max(
          ...c[i].map((x, j) =>
            Math.abs(x - c[start][j] - (c[end][j] - c[start][j]) * f),
          ),
        );
      if (err > worst) {
        chosen = i;
        worst = err;
      }
    }
    if (chosen >= 0) {
      segment(start, chosen);
      segment(chosen, end);
    } else keep.push(end);
  }
  segment(0, last);
  return (
    "linear-gradient(90deg," +
    keep
      .map(
        (i) =>
          "rgb(" + c[i].join(" ") + ") " + ((100 * i) / last).toFixed(3) + "%",
      )
      .join(",") +
    ")"
  );
}
export const lightPhase = (alt: number) =>
  alt >= 6
    ? "Daylight"
    : alt >= -4
      ? "Golden hour"
      : alt >= -18
        ? "Twilight"
        : "Night";
export function shadowDirection(az: number) {
  return [
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
  ][Math.round(((az + 180) % 360) / 45) % 8];
}
