import { authorized, type AccessEnv } from "./auth";
import { readStats, readRange } from "./stats";
import { renderStats } from "./render";
export type AdminEnv = AccessEnv & { ASSETS: Fetcher; USAGE_DB?: D1Database };
export const ADMIN_HOST = "sin.suncalc.app";
const assets = new Map([
  ["/font.woff2", ["/brand/bricolage.woff2", "font/woff2"]],
  ["/wordmark.svg", ["/brand/wordmark.svg", "image/svg+xml"]],
  ["/icon.svg", ["/icon.svg", "image/svg+xml"]],
]);

export async function serveAdmin(
  request: Request,
  env: AdminEnv,
  verify: typeof authorized = authorized,
) {
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
  const asset = assets.get(url.pathname);
  try {
    if (asset) {
      const [path, type] = asset;
      const res = await env.ASSETS.fetch(new URL(path, url), {
        method: request.method,
      });
      return res.ok
        ? reply(res.body, 200, type)
        : reply("Not found", res.status);
    }
    if (!["/", "/api/stats"].includes(url.pathname))
      return reply("Not found", 404);
    if (!env.USAGE_DB)
      return reply("Usage data is temporarily unavailable.", 503);
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
}
