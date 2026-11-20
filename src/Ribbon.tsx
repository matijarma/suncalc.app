import { useEffect, useMemo, useState } from "preact/hooks";
import { atClock, clock, local, type Spot, type SolarDay } from "./solar";
import { daylightGradient } from "./daylight";
export function Ribbon({
  spot,
  day: d,
  ms,
  onChange,
}: {
  spot: Spot;
  day: SolarDay;
  ms: number;
  onChange: (n: number) => void;
}) {
  const { start, end } = d,
    range = Math.ceil((end - start) / 60000) - 1,
    val = Math.max(0, Math.min(range, Math.floor((ms - start) / 60000))),
    key = [spot.lat, spot.lon, start, end].join("/");
  const coarse = useMemo(() => daylightGradient(d.path.map((v) => v.alt)), [d]);
  const [precise, setPrecise] = useState<{
    key: string;
    gradient: string;
  } | null>(null);
  useEffect(() => {
    let worker: Worker | undefined;
    try {
      worker = new Worker(new URL("./exposure.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e) => {
        setPrecise({ key, gradient: e.data });
        worker?.terminate();
      };
      worker.onerror = () => worker?.terminate();
      worker.postMessage({ lat: spot.lat, lon: spot.lon, start, end });
    } catch {
      /* The solar path already provides an offline fallback. */
    }
    return () => worker?.terminate();
  }, [key]);
  const labels = useMemo(
    () =>
      [0, 6, 12, 18]
        .map((h) => ({
          h,
          t: atClock(d.day, String(h).padStart(2, "0") + ":00", d.zone),
        }))
        .filter((v) => v.t >= start && v.t < end),
    [d],
  );
  return (
    <div
      class="ribbon"
      style={{
        "--progress": (val / range) * 100 + "%",
        "--band": precise?.key === key ? precise.gradient : coarse,
      }}
    >
      <div class="ribbon-shell">
        <div class="film" />
        <div class="ribbon-ticks" aria-hidden="true">
          {Array.from({ length: 73 }, (_, i) => (
            <i
              key={i}
              class={i % 3 === 0 ? "major" : ""}
              style={{ left: (100 * i) / 72 + "%" }}
            />
          ))}
        </div>
        <div class="cursor" />
        <input
          type="range"
          aria-label="Time of day"
          aria-valuetext={
            clock(ms, d.zone) +
            " · UTC" +
            local(ms, d.zone).offset +
            " at the pin"
          }
          min={0}
          max={range}
          step={1}
          value={val}
          onInput={(e) =>
            onChange(start + e.currentTarget.valueAsNumber * 60000)
          }
        />
      </div>
      <div class="hours" aria-hidden="true">
        {labels.map(({ h, t }) => (
          <span
            key={h}
            style={{ left: ((t - start) / (end - start)) * 100 + "%" }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
        <span class="last">24</span>
      </div>
    </div>
  );
}
