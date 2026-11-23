import { collectUsage } from "./usage";
import { api, type Env } from "./api";
import { tile } from "./tiles";
import { searchResponse } from "./site";
export { MapImport } from "./import";
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const p = new URL(req.url).pathname;
    try {
      if (p === "/api/usage") return await collectUsage(req, env.USAGE_DB);
      if (p.startsWith("/api/")) return await api(req, env);
      if (p.startsWith("/tiles/")) {
        const m = p.match(
          /^\/tiles\/v1\/(\d{1,2})\/(\d{1,5})\/(\d{1,5})\.mvt$/,
        );
        return req.method === "GET" && m
          ? await tile(req, env, ctx, m)
          : new Response(null, { status: 404 });
      }
      return searchResponse(req, await env.ASSETS.fetch(req));
    } catch {
      return Response.json(
        { error: "The service is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
};
