import { Bookmark, ChevronDown, CalendarDays } from "lucide-preact";
import { clock, local, direction, type Spot, type SolarDay } from "./solar";
import { lightPhase } from "./daylight";
import { Ribbon } from "./Ribbon";
type Props = {
  spot: Spot;
  day: SolarDay;
  ms: number;
  current: { alt: number; az: number };
  example: boolean;
  saved: boolean;
  locked: boolean;
  pick: () => void;
  save: () => void;
  date: () => void;
  time: () => void;
  change: (t: number) => void;
  access: () => void;
};
export function ClockFace({
  spot,
  day: d,
  ms,
  current,
  example,
  saved,
  locked,
  pick,
  save,
  date,
  time,
  change,
  access,
}: Props) {
  const context = d.zone.split("/").at(-1)!.replaceAll("_", " "),
    offset = local(locked ? Date.now() : ms, d.zone).offset;
  const dateText = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(d.day + "T12:00Z"));
  return (
    <section class="clockface" aria-label="Location and sun time">
      <div class="place-row">
        <div class="place-heading" data-example={example}>
          <span class="over">
            {example ? "Example location" : "At your pin"}
          </span>
          <button
            class="place-button"
            aria-label={"Find a place, currently " + spot.name}
            onClick={pick}
          >
            <span>{spot.name}</span>
            <ChevronDown size={17} />
          </button>
          <p class="place-context" title={d.zone}>
            {context} · UTC{offset}
          </p>
        </div>
        <button
          class="action"
          aria-label={saved ? "Remove saved place" : "Save place"}
          title={saved ? "Remove saved place" : "Save place"}
          aria-pressed={saved}
          onClick={save}
        >
          <Bookmark size={20} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div class="date-row">
        <button
          class="date-chip"
          aria-label="Choose planning date"
          onClick={date}
          disabled={locked}
        >
          <CalendarDays size={15} />
          {dateText}
          <ChevronDown size={12} />
        </button>
        {!locked && <span class="phase">{lightPhase(current.alt)}</span>}
      </div>
      {locked ? (
        <div class="locked">
          <h2>Your free month has ended.</h2>
          <p>Today’s sunrise and sunset are always yours.</p>
          <button class="primary" onClick={access}>
            Unlock the planner · €1
          </button>
        </div>
      ) : (
        <>
          <div class="reading">
            <button
              class="big-clock"
              aria-label="Enter local time"
              onClick={time}
            >
              {clock(ms, d.zone)}
            </button>
            <div class="angle">
              <b>
                {Math.round(current.az) % 360}° {direction(current.az)}
              </b>
              <span>
                {current.alt < 0 ? "−" : ""}
                {Math.round(Math.abs(current.alt))}° altitude
              </span>
            </div>
          </div>
          <Ribbon spot={spot} day={d} ms={ms} onChange={change} />
        </>
      )}
      <div class="events" aria-label="Daylight events">
        {d.events
          .filter(
            (v) =>
              v.key === "rise" ||
              v.key === "set" ||
              (!locked && v.key === "noon"),
          )
          .map((v) => (
            <button
              key={v.key}
              class={"event-" + v.key}
              disabled={locked || v.ms === null}
              onClick={() => v.ms !== null && change(v.ms)}
            >
              <span>{v.label}</span>
              <b>{v.ms === null ? "No event" : clock(v.ms, d.zone)}</b>
            </button>
          ))}
      </div>
    </section>
  );
}
