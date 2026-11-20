import { useLayoutEffect, useState } from "preact/hooks";
import tokens from "./design/tokens.json";
export type Scheme = "light" | "dark";
export type Preference = Scheme | "auto";
const key = "suncalc:appearance";
const parse = (v: unknown): Preference =>
  v === "dark" || v === "light" ? v : "auto";
export function useAppearance() {
  const [media] = useState(() => matchMedia("(prefers-color-scheme: dark)"));
  const [device, setDevice] = useState<Scheme>(() =>
    media.matches ? "dark" : "light",
  );
  const [preference, setPreference] = useState<Preference>(() =>
    parse(
      document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')
        ?.content,
    ),
  );
  const scheme = preference === "auto" ? device : preference;
  useLayoutEffect(() => {
    const system = () => setDevice(media.matches ? "dark" : "light"),
      sync = (event: StorageEvent) => {
        if (event.key === key || event.key === null)
          setPreference(parse(event.newValue));
      };
    media.addEventListener("change", system);
    addEventListener("storage", sync);
    system();
    return () => {
      media.removeEventListener("change", system);
      removeEventListener("storage", sync);
    };
  }, [media]);
  useLayoutEffect(() => {
    document.querySelector<HTMLMetaElement>(
      'meta[name="color-scheme"]',
    )!.content = preference === "auto" ? "light dark" : preference;
    document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    )!.content = tokens.colors.canvas[scheme === "dark" ? 1 : 0];
    document.documentElement.dataset.scheme = scheme;
  }, [preference, scheme]);
  function choose(value: Preference) {
    try {
      if (value === "auto") localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
    setPreference(value);
  }
  return { preference, scheme, device, choose };
}
export type Appearance = ReturnType<typeof useAppearance>;
