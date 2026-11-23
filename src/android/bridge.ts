export const android = import.meta.env?.MODE === "android";
export const monthly = "suncalc_monthly",
  lifetime = "suncalc_lifetime";
export type State = {
  kind: "trial" | "monthly" | "lifetime" | "locked";
  trialUntil: number;
  monthlyUntil: number;
  now: number;
  commerceReady: boolean;
  prices: Record<string, string>;
};
type Channel = {
  postMessage(s: string): void;
  onmessage: ((e: { data: string }) => void) | null;
};
declare global {
  interface Window {
    SunCalcNative?: Channel;
  }
}
let sequence = 0,
  bound: Channel | undefined;
const waiting = new Map<number, (o: Record<string, unknown>) => void>();
export function native<T = Record<string, unknown>>(
  method: string,
  args: object = {},
): Promise<T> {
  const channel = window.SunCalcNative;
  if (!channel) return Promise.reject(Error("Android service unavailable."));
  if (channel !== bound) {
    bound = channel;
    channel.onmessage = (e) => {
      const r = JSON.parse(e.data);
      waiting.get(r.id)?.(r.value);
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence,
      timer = setTimeout(() => {
        waiting.delete(id);
        reject(Error("Device request timed out."));
      }, 30000);
    waiting.set(id, (value) => {
      clearTimeout(timer);
      waiting.delete(id);
      if (value.error) reject(Error(String(value.error)));
      else resolve(value as T);
    });
    channel.postMessage(JSON.stringify({ id, method, args }));
  });
}
export function listen<T>(kind: string, callback: (value: T) => void) {
  const fn = (e: Event) => callback((e as CustomEvent<T>).detail);
  window.addEventListener("sc:" + kind, fn);
  return () => window.removeEventListener("sc:" + kind, fn);
}
