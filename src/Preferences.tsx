import { ChevronRight } from "lucide-preact";
import type { Appearance, Preference } from "./appearance";
export function Preferences({
  appearance: a,
  access,
  about,
}: {
  appearance: Appearance;
  access: () => void;
  about: () => void;
}) {
  return (
    <>
      <fieldset class="appearance">
        <legend>Appearance</legend>
        <div class="radio-row">
          {(["auto", "light", "dark"] as Preference[]).map((v) => (
            <label key={v}>
              <input
                type="radio"
                name="appearance"
                value={v}
                checked={a.preference === v}
                onChange={() => a.choose(v)}
              />
              <span>{v[0].toUpperCase() + v.slice(1)}</span>
            </label>
          ))}
        </div>
        <small>Device: {a.device}</small>
      </fieldset>
      <p class="muted">
        Auto follows your device. Light or Dark stays selected on this browser.
      </p>
      <button class="result" onClick={access}>
        <span>
          <strong>Your access</strong>
          <small>Purchase and restoration</small>
        </span>
        <ChevronRight size={16} />
      </button>
      <button class="result" onClick={about}>
        <span>
          <strong>About SunCalc</strong>
          <small>Privacy, accuracy and credits</small>
        </span>
        <ChevronRight size={16} />
      </button>
    </>
  );
}
