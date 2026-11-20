import {
  HOUR,
  zagrebDay,
  type Metric,
  type Tool,
  type Surface,
} from "../shared/usage";
// Sredstva's first-party, keepalive delivery with Kajima's closed counters.
// A lost batch is discarded. No replay, persistent queue or session identifier.
export interface UsagePort {
  now(): number;
  visible(): boolean;
  online(): boolean;
  surface(): Surface;
  claimDay(day: string): boolean;
  send(surface: Surface, events: Metric[]): void;
  later(fn: () => void): ReturnType<typeof setTimeout>;
  cancel(id: ReturnType<typeof setTimeout>): void;
}
export function createCollector(port: UsagePort) {
  let day = "",
    nextHour = 0,
    surface: Surface = "browser",
    timer: ReturnType<typeof setTimeout> | undefined;
  const seen = new Set<Metric>(),
    pending = new Set<Metric>();
  function stop() {
    if (timer !== undefined) port.cancel(timer);
    timer = undefined;
    pending.clear();
  }
  function discard() {
    for (const event of pending) seen.delete(event);
    stop();
  }
  function flush() {
    if (!port.online() || zagrebDay(port.now()) !== day) {
      discard();
      return;
    }
    const batch = [...pending];
    stop();
    if (!batch.length) return;
    try {
      if (batch.includes("open") && port.claimDay(day)) batch.push("active");
      port.send(surface, batch);
    } catch {
      /* best effort */
    }
  }
  function queue(metric: Metric) {
    if (seen.has(metric)) return;
    seen.add(metric);
    pending.add(metric);
    if (timer === undefined) timer = port.later(flush);
  }
  function observe(tool?: Tool) {
    try {
      if (!port.online() || !port.visible()) return;
      const now = port.now();
      if (now >= nextHour || !day) {
        const today = zagrebDay(now);
        nextHour = (Math.floor(now / HOUR) + 1) * HOUR;
        if (day !== today) {
          stop();
          day = today;
          seen.clear();
          surface = port.surface();
        }
      }
      queue("open");
      if (tool) {
        queue("planning");
        queue(tool);
      }
    } catch {
      /* A counter must never interrupt the planner. */
    }
  }
  return { observe, flush, offline: discard, dispose: stop };
}
let instance: ReturnType<typeof createCollector> | undefined;
export function startUsage() {
  if (location.origin !== "https://suncalc.app") return;
  const c = createCollector({
    now: Date.now,
    visible: () => document.visibilityState === "visible",
    online: () => navigator.onLine,
    surface: () =>
      matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
        ? "pwa"
        : "browser",
    claimDay: (day) => {
      try {
        const key = "sc:usage-day";
        if (localStorage.getItem(key) === day) return false;
        localStorage.setItem(key, day);
        return true;
      } catch {
        return false;
      }
    },
    send: (surface, events) => {
      void fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface, events }),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
        cache: "no-store",
      }).catch(() => {});
    },
    later: (fn) => setTimeout(fn, 180),
    cancel: (id) => clearTimeout(id),
  });
  instance = c;
  const visibility = () => {
      if (document.visibilityState === "visible") c.observe();
      else c.flush();
    },
    online = () => c.observe();
  document.addEventListener("visibilitychange", visibility);
  addEventListener("pagehide", c.flush);
  addEventListener("offline", c.offline);
  addEventListener("online", online);
  c.observe();
  return () => {
    document.removeEventListener("visibilitychange", visibility);
    removeEventListener("pagehide", c.flush);
    removeEventListener("offline", c.offline);
    removeEventListener("online", online);
    c.dispose();
    instance = undefined;
  };
}
export const counted = (tool: Tool) => instance?.observe(tool);
