import { useState } from "preact/hooks";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-preact";
import { T, clock, local } from "./solar";
export function DateSheet({
  day,
  zone,
  set,
}: {
  day: string;
  zone: string;
  set: (v: string) => void;
}) {
  const [date, choose] = useState(day);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (date) set(date);
      }}
    >
      <p class="muted">
        Calendar date at the pin · {zone.replaceAll("_", " ")}
      </p>
      <label class="formlabel">
        Planning date
        <input
          data-autofocus
          class="field"
          type="date"
          min="1900-01-01"
          max="2100-12-31"
          required
          value={date}
          onInput={(e) => choose(e.currentTarget.value)}
        />
      </label>
      <div class="shortcuts">
        <button
          type="button"
          class="chip"
          onClick={() =>
            set(T.PlainDate.from(day).subtract({ days: 1 }).toString())
          }
        >
          <ChevronLeft size={15} /> Previous day
        </button>
        <button
          type="button"
          class="chip"
          onClick={() => set(T.PlainDate.from(day).add({ days: 1 }).toString())}
        >
          Next day <ChevronRight size={15} />
        </button>
      </div>
      <button class="primary">Set date</button>
    </form>
  );
}
export function TimeSheet({
  ms,
  zone,
  set,
}: {
  ms: number;
  zone: string;
  set: (v: number) => void;
}) {
  const [value, edit] = useState(clock(ms, zone)),
    at = local(ms, zone);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value) return;
        const [hour, minute] = value.split(":").map(Number);
        set(
          at.with({ hour, minute, second: 0, millisecond: 0 })
            .epochMilliseconds,
        );
      }}
    >
      <label class="formlabel">
        Time at the pin · UTC{at.offset}
        <input
          data-autofocus
          class="field"
          type="time"
          required
          value={value}
          onInput={(e) => edit(e.currentTarget.value)}
        />
      </label>
      <div class="shortcuts">
        <button class="primary">Set time</button>
        <button type="button" class="chip" onClick={() => set(Date.now())}>
          <Clock3 size={15} /> Now
        </button>
      </div>
    </form>
  );
}
export function HeightSheet({
  height,
  set,
}: {
  height: number;
  set: (v: number) => void;
}) {
  const [value, edit] = useState(String(height));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (n >= 0.1 && n <= 10000) set(n);
      }}
    >
      <p class="muted">Measure a vertical object on level ground.</p>
      <label class="formlabel">
        Object height (metres)
        <input
          data-autofocus
          class="field"
          type="number"
          min=".1"
          max="10000"
          step="any"
          required
          value={value}
          onInput={(e) => edit(e.currentTarget.value)}
        />
      </label>
      <button class="primary">Apply height</button>
    </form>
  );
}
