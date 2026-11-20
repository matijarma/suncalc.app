import { authorized, type AccessEnv } from "./auth";
import { readStats, readRange } from "./stats";
import { renderStats } from "./render";
import type { EdgeEnv } from "./edge";
export type AdminEnv = AccessEnv & EdgeEnv;
export const ADMIN_HOST = "sin.suncalc.app";
export function createHandler(
  assets: { font: ArrayBuffer; icon: string; wordmark: string },
  verify: typeof authorized = authorized,
) {
  return async (request: Request, env: AdminEnv) => {
    const url = new URL(request.url),
      nonce = crypto.randomUUID(),
      headers = new Headers({
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'nonce-" +
          nonce +
          "'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
    const reply = (
      text: BodyInit | null,
      status: number,
      type = "text/plain; charset=utf-8",
    ) => {
      headers.set("Content-Type", type);
      return new Response(request.method === "HEAD" ? null : text, {
        status,
        headers,
      });
    };
    if (
      url.origin !== "https://" + ADMIN_HOST ||
      !["GET", "HEAD"].includes(request.method)
    )
      return reply("Not found", 404);
    if (!(await verify(request, env))) return reply("Access required", 403);
    if (url.pathname === "/font.woff2")
      return reply(assets.font, 200, "font/woff2");
    if (url.pathname === "/wordmark.svg")
      return reply(assets.wordmark, 200, "image/svg+xml");
    if (url.pathname === "/icon.svg")
      return reply(assets.icon, 200, "image/svg+xml");
    if (!["/", "/api/stats"].includes(url.pathname))
      return reply("Not found", 404);
    try {
      const snapshot = await readStats(
        env.USAGE_DB,
        readRange(url.searchParams.get("range")),
      );
      return url.pathname === "/"
        ? reply(renderStats(snapshot, nonce), 200, "text/html; charset=utf-8")
        : reply(JSON.stringify(snapshot), 200, "application/json");
    } catch {
      return reply("Usage data is temporarily unavailable.", 503);
    }
  };
}
