import { Body, Observer, Equator, Horizon } from "astronomy-engine";
export function positionAt(observer: Observer, ms: number) {
  const date = new Date(ms),
    e = Equator(Body.Sun, date, observer, true, true),
    h = Horizon(date, observer, e.ra, e.dec, "normal");
  return { az: h.azimuth, alt: h.altitude };
}
export function sun(p: { lat: number; lon: number }, ms: number) {
  return positionAt(new Observer(p.lat, p.lon, 0), ms);
}
