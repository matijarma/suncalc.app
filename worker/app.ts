import { androidApi } from "./android";
import { collectUsage } from "./usage";
import { api, type Env } from "./api";
import { tile } from "./tiles";
import { searchResponse } from "./site";
import { ADMIN_HOST, serveAdmin, type AdminEnv } from "../admin/handler";
import { syncEdge, type EdgeEnv } from "../admin/edge";

type AppEnv = Env & AdminEnv;
export default {
  async fetch(req: Request, env: AppEnv, ctx: ExecutionContext) {
    const url = new URL(req.url);
    if (url.hostname === ADMIN_HOST) return serveAdmin(req, env);
    const p = url.pathname;
    try {
      if (p.startsWith("/api/android/")) return await androidApi(req, env);
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
  async scheduled(_event: ScheduledController, env: EdgeEnv) {
    if (!env.USAGE_DB || !env.CF_ANALYTICS_TOKEN)
      throw Error("Missing usage archive bindings");
    if (!(await syncEdge(env))) throw Error("Edge archive did not refresh");
  },
};
