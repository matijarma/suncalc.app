import { Ruler, ChevronDown, ArrowRight } from "lucide-preact";
import { shadowDirection } from "./daylight";
export const measurement = (n: number) =>
  n.toLocaleString("en", { maximumFractionDigits: 1 });
export function ShadowRuler({
  height,
  length,
  az,
  edit,
  more,
}: {
  height: number;
  length: number | null;
  az: number;
  edit: () => void;
  more: () => void;
}) {
  const scale =
      length === null
        ? 0
        : Math.min(118 / Math.max(0.001, length), 44 / height),
    top = 54 - height * scale,
    tip = 27 + (length ?? 0) * scale;
  return (
    <section class="shadowcard" aria-label="Shadow ruler">
      <div class="shadow-title">
        <div>
          <span class="over">On level ground</span>
          <h2>Your shadow</h2>
        </div>
        <button
          class="height-btn"
          aria-label="Change object height"
          onClick={edit}
        >
          <Ruler size={15} /> {measurement(height)} m <ChevronDown size={12} />
        </button>
      </div>
      <div class="shadow-body">
        <p>
          {length === null ? (
            <>
              <b>No direct shadow.</b>
              <br />
              The sun is below the horizon.
            </>
          ) : (
            <>
              A {measurement(height)} m post casts a{" "}
              <b>
                {measurement(length)} m shadow {shadowDirection(az)}.
              </b>
            </>
          )}
        </p>
        <svg class="sideview" viewBox="0 0 184 70" aria-hidden="true">
          <path class="ground" d="M2 54h180" />
          {length !== null && (
            <>
              <path class="projection" d={`M27 ${top} L${tip} 54`} />
              <path class="post" d={`M24 ${top}h6V54h-6z`} />
              <path class="cast" d={`M30 53H${Math.max(30, tip)}l-4 4H30z`} />
            </>
          )}
          <text x="91" y="68" text-anchor="middle">
            {length === null ? "Sun below horizon" : measurement(length) + " m"}
          </text>
        </svg>
      </div>
      <div class="footnote">
        <span>Clear horizon</span>
        <button onClick={more}>
          More tools <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}
