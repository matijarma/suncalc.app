import { PMTiles, ResolvedValueCache } from "pmtiles";
import seed from "./seed.json";
const local = new Set(seed),
  dirs = new ResolvedValueCache(96);
export async function tile(
  req: Request,
  env: { MAPS: R2Bucket; ASSETS: Fetcher; MAP_KEY: string },
  ctx: ExecutionContext,
  m: RegExpMatchArray,
) {
  const [z, x, y] = m.slice(1).map(Number);
  if (z > 15 || x >= 2 ** z || y >= 2 ** z)
    return new Response(null, { status: 404 });
  const key = [z, x, y].join("/"),
    headers = {
      "Content-Type": "application/vnd.mapbox-vector-tile",
      "Cache-Control": "public, max-age=2592000, immutable",
    };
  if (local.has(key)) {
    const a = await env.ASSETS.fetch(req);
    return new Response(a.body, {
      status: a.status,
      headers: a.ok ? headers : undefined,
    });
  }
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(req);
  if (hit) return hit;
  const archive = new PMTiles(
    {
      getKey: () => env.MAP_KEY,
      getBytes: async (offset, length) => {
        const b = await env.MAPS.get(env.MAP_KEY, {
          range: { offset, length },
        });
        if (!b) throw Error("Archive unavailable");
        return { data: await b.arrayBuffer(), etag: b.etag };
      },
    },
    dirs,
  );
  try {
    const v = await archive.getZxy(z, x, y);
    const r = new Response(v?.data ?? null, { status: v ? 200 : 204, headers });
    ctx.waitUntil(cache.put(req, r.clone()));
    return r;
  } catch {
    return new Response("Map detail is temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
