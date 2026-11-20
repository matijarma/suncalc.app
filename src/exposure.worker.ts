import { Observer } from "astronomy-engine";
import { positionAt } from "./sun-position";
import { daylightGradient } from "./daylight";
self.onmessage = ({
  data,
}: {
  data: { lat: number; lon: number; start: number; end: number };
}) => {
  const { lat, lon, start, end } = data,
    observer = new Observer(lat, lon, 0),
    alts: number[] = [];
  for (let t = start; t < end; t += 60000)
    alts.push(positionAt(observer, t).alt);
  alts.push(positionAt(observer, end).alt);
  self.postMessage(daylightGradient(alts));
};
