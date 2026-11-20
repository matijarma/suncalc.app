import test from "node:test";
import assert from "node:assert/strict";
import {
  SPLIT,
  solarDay,
  atClock,
  zoneAt,
  local,
  sun,
  shadow,
} from "../src/solar";
import { coordinates } from "../src/storage";
// US Naval Observatory one-day API, standard apparent horizon, times rounded to minutes.
// https://aa.usno.navy.mil/api/rstt/oneday?date=2026-06-21&coords=43.5083,16.4383&tz=2
// https://aa.usno.navy.mil/api/rstt/oneday?date=2026-12-21&coords=-33.8688,151.2093&tz=11
for (const [spot, date, expected] of [
  [SPLIT, "2026-06-21", ["05:13", "12:56", "20:39"]],
  [
    { name: "Sydney", lat: -33.8688, lon: 151.2093 },
    "2026-12-21",
    ["05:41", "12:53", "20:05"],
  ],
] as const)
  test("USNO minute reference: " + spot.name, () => {
    const d = solarDay(spot, date);
    [d.rise, d.noon, d.set].forEach((ms, i) =>
      assert.ok(
        ms && Math.abs(ms - atClock(date, expected[i], d.zone)) < 120000,
      ),
    );
    assert.ok(d.light > 14 * 3600000);
  });
test("local daylight-saving boundaries include both repeated hours", () => {
  const ny = { name: "NY", lat: 40.7128, lon: -74.006 };
  const spring = solarDay(ny, "2026-03-08"),
    fall = solarDay(ny, "2026-11-01");
  assert.equal(spring.end - spring.start, 23 * 3600000);
  assert.equal(fall.end - fall.start, 25 * 3600000);
  assert.equal(local(fall.start + 60 * 60000, fall.zone).hour, 1);
  assert.equal(local(fall.start + 120 * 60000, fall.zone).hour, 1);
  assert.equal(
    local(atClock(spring.day, "02:30", spring.zone), spring.zone).hour,
    3,
  );
});
test("polar day/night and a fractional-offset zone", () => {
  const tr = { lat: 69.65, lon: 18.96, name: "Tromsø" };
  for (const [date, h] of [
    ["2026-06-21", 24],
    ["2026-12-21", 0],
  ] as const) {
    const d = solarDay(tr, date);
    assert.equal(d.rise, null);
    assert.equal(d.set, null);
    assert.equal(d.light, h * 3600000);
  }
  const np = zoneAt({ lat: 27.72, lon: 85.32, name: "Kathmandu" });
  assert.equal(local(Date.now(), np).offset, "+05:45");
});
test("shadow needs the sun above the horizon; coordinates reject out-of-range pins", () => {
  assert.equal(shadow(2, -1), null);
  assert.ok(Math.abs(shadow(2, 45)! - 2) < 1e-7);
  assert.equal(coordinates("-91, 0"), null);
  assert.equal(coordinates("geo:0,0")?.lon, 0);
  assert.ok(sun(SPLIT, atClock("2026-06-21", "13:00", zoneAt(SPLIT))).alt > 65);
});
