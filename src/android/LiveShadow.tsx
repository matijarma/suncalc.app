import { useEffect, useMemo, useState } from "preact/hooks";
import { sun, direction, shadow } from "../solar";
import { listen, native } from "./bridge";
type Reading = {
  lat?: number;
  lon?: number;
  heading?: number | null;
  status?: string;
};
export function LiveShadow() {
  const [r, read] = useState<Reading>({ status: "Finding your location…" }),
    [now, clock] = useState(Date.now());
  useEffect(() => {
    const off = listen<Reading>("sensor", read);
    native("sensorStart").catch((e) => read({ status: e.message }));
    const t = setInterval(() => clock(Date.now()), 10000);
    return () => {
      off();
      clearInterval(t);
      native("sensorStop").catch(() => {});
    };
  }, []);
  const solar = useMemo(
    () =>
      r.lat != null && r.lon != null
        ? sun({ lat: r.lat, lon: r.lon }, now)
        : null,
    [r.lat, r.lon, now],
  );
  const len = solar ? shadow(1, solar.alt) : null,
    bearing = solar ? (solar.az + 180) % 360 : 0,
    heading = r.heading ?? 0;
  const radius =
    len != null
      ? Math.max(1, Math.pow(2, Math.ceil(Math.log2(Math.max(len, 0.01)))))
      : 1;
  const point = (a: number, d: number) => ({
    x: 110 + d * Math.sin((a * Math.PI) / 180),
    y: 110 - d * Math.cos((a * Math.PI) / 180),
  });
  const tip = point(bearing - heading, (82 * (len ?? 0)) / radius);
  return (
    <section class="live-shadow">
      <p>Hold your phone flat. The post in the centre is one metre tall.</p>
      <svg viewBox="0 0 220 220" aria-label="Live shadow direction" role="img">
        <circle cx="110" cy="110" r="89" class="dial-ground" />
        <circle cx="110" cy="110" r="42" class="dial-ring" />
        {["N", "E", "S", "W"].map((v, i) => {
          const p = point(i * 90 - heading, 99);
          return (
            <text key={v} x={p.x} y={p.y + 4} text-anchor="middle">
              {v}
            </text>
          );
        })}
        {solar && len != null && (
          <>
            <line x1="110" y1="110" x2={tip.x} y2={tip.y} class="cast-line" />
            <circle cx={tip.x} cy={tip.y} r="4" class="cast-tip" />
          </>
        )}
        <circle cx="110" cy="110" r="5" class="dial-post" />
      </svg>
      <p role="status">
        {r.status ??
          (len === null ? (
            "The sun is below the horizon. No direct shadow."
          ) : (
            <>
              <strong>
                {len.toLocaleString("en", { maximumFractionDigits: 2 })} m ·{" "}
                {direction(bearing)}
              </strong>{" "}
              on level ground.
            </>
          ))}
      </p>
      {solar && (
        <small>
          {r.heading == null
            ? "North-up view · no reliable compass heading."
            : "Compass aligned to true north."}{" "}
          {len != null
            ? "Dial radius: " + radius.toLocaleString("en") + " m."
            : ""}
        </small>
      )}
      <p class="muted">
        Uses your location and the time right now. Terrain and nearby objects
        aren’t included.
      </p>
    </section>
  );
}
