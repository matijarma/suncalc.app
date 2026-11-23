import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import { Modal } from "../Modal";
import { useAppearance } from "../appearance";
import { listen, native, monthly, lifetime, type State } from "./bridge";
import { LiveShadow } from "./LiveShadow";
import "../style.css";
import "./android.css";
type Planner = (typeof import("../main"))["App"];
function AndroidRoot() {
  useAppearance();
  const [s, set] = useState<State | null>(null),
    [App, component] = useState<Planner | null>(null),
    [panel, open] = useState<"access" | "shadow" | null>(null),
    [notice, say] = useState("");
  useEffect(() => {
    const off = listen<State>("state", set),
      msg = listen<{ message: string }>("notice", (e) => say(e.message));
    const sync = () =>
      native<State>("state")
        .then(set)
        .catch((e) => say(e.message));
    void sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      off();
      msg();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const kind = s?.kind;
  useEffect(() => {
    if (kind && kind !== "locked")
      import("../main").then((m) => component(() => m.App));
  }, [kind]);
  useEffect(() => {
    if (kind === "locked") open(null);
  }, [kind]);
  useEffect(() => {
    if (!s || (s.kind !== "trial" && s.kind !== "monthly")) return;
    const end = s.kind === "trial" ? s.trialUntil : s.monthlyUntil;
    const t = setTimeout(
      () =>
        native<State>("state")
          .then(set)
          .catch(() => set({ ...s, kind: "locked" })),
      Math.min(2147483647, Math.max(20, end - s.now + 10)),
    );
    return () => clearTimeout(t);
  }, [s]);
  const action = (method: string, args?: object) => {
    say("");
    native(method, args).catch((e) => say(e.message));
  };
  const card = s && (
    <section class="android-access">
      <img src="/icon.svg" width="48" height="48" alt="" />
      <p class="over">SunCalc for Android</p>
      <h1>
        {s.kind === "locked"
          ? "Your seven days are up"
          : s.kind === "trial"
            ? "Your seven-day trial"
            : s.kind === "lifetime"
              ? "Lifetime access"
              : "Monthly access"}
      </h1>
      <p>
        {s.kind === "locked"
          ? "Unlock the planner to return to your saved places. Live Shadow is always available."
          : s.kind === "trial"
            ? "Plan freely until " +
              new Date(s.trialUntil).toLocaleString() +
              ". You won’t be charged automatically."
            : s.kind === "monthly"
              ? "Your Google Play subscription unlocks the full planner."
              : "You own the full Android planner."}
      </p>
      {(s.kind === "locked" || s.kind === "trial") && (
        <>
          <div class="store-offers">
            <button
              class="primary"
              disabled={!s.commerceReady || !s.prices[monthly]}
              onClick={() => action("buy", { product: monthly })}
            >
              {s.prices[monthly]
                ? s.prices[monthly] + " / month"
                : "Monthly subscription"}
            </button>
            <button
              class="chip"
              disabled={!s.commerceReady || !s.prices[lifetime]}
              onClick={() => action("buy", { product: lifetime })}
            >
              {s.prices[lifetime]
                ? s.prices[lifetime] + " once"
                : "Lifetime purchase"}
            </button>
          </div>
          <small>
            Monthly renews until canceled in Google Play. Lifetime is a single
            payment.
          </small>
          {(!s.commerceReady || Object.keys(s.prices).length === 0) && (
            <p class="muted">
              Google Play offers aren’t available right now. Connect to Play to
              see local prices or restore your purchase.
            </p>
          )}
        </>
      )}
      <button class="result" onClick={() => open("shadow")}>
        <span>
          <strong>Live Shadow</strong>
          <small>A free compass for the sun’s shadow, here and now.</small>
        </span>{" "}
        ↗
      </button>
      <div class="android-links">
        <button onClick={() => action("restore")}>Restore purchases</button>
        <button onClick={() => action("manage")}>Manage subscription</button>
        <button onClick={() => action("privacy")}>Privacy</button>
        <button onClick={() => action("support")}>Support</button>
      </div>
    </section>
  );
  return (
    <>
      {!s ? (
        <p class="android-loading" role="status">
          {notice || "Opening SunCalc…"}
        </p>
      ) : kind === "locked" ? (
        card
      ) : App ? (
        <App
          androidAccess={() => open("access")}
          liveShadow={() => open("shadow")}
        />
      ) : (
        <p class="android-loading">Opening planner…</p>
      )}
      {panel === "access" && kind !== "locked" && (
        <Modal title="Your access" onClose={() => open(null)}>
          {card}
          {notice && <p role="status">{notice}</p>}
        </Modal>
      )}
      {panel === "shadow" && (
        <Modal title="Live Shadow" onClose={() => open(null)}>
          <LiveShadow />
        </Modal>
      )}
      {notice && s && !panel && (
        <div class="toast" role="status">
          {notice}
          <button aria-label="Dismiss notification" onClick={() => say("")}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
render(<AndroidRoot />, document.getElementById("app")!);
