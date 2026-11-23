import { render } from "preact";
import { App } from "./main";
render(<App />, document.getElementById("app")!);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  addEventListener("load", () => {
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        const paths = performance
          .getEntriesByType("resource")
          .map((r) => new URL(r.name, location.href))
          .filter(
            (u) =>
              u.origin === location.origin &&
              /^\/(tiles|maps\/fonts|towns)\//.test(u.pathname),
          )
          .map((u) => u.pathname);
        for (const path of [...new Set(paths)].slice(-45))
          fetch(path).catch(() => {});
      },
      { once: true },
    );
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
