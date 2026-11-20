/** Regenerate both first-paint plates from the same bundled Split tiles, not from the live app. */
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, join, sep, extname } from "node:path";
import { chromium } from "playwright";
import { atlasStyle } from "../src/map-style";
import { SPLIT } from "../src/solar";
import { version } from "maplibre-gl/package.json";
const base = resolve("public"),
  width = 1071,
  height = 640;
const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url!, "http://127.0.0.1"),
      scheme = u.searchParams.get("theme") === "dark" ? "dark" : "light";
    if (u.pathname === "/") {
      res.setHeader("content-type", "text/html");
      res.end(`<!doctype html><meta charset="utf-8"><style>*{margin:0}#map{width:100vw;height:100vh}.maplibregl-canvas{display:block}</style><div id="map"></div><script type="module">
 import * as gl from '/maps/lib/${version}/maplibre-gl.mjs';gl.setWorkerUrl('/maps/lib/${version}/maplibre-gl-worker.mjs');const map=new gl.Map({container:'map',style:${JSON.stringify(atlasStyle(scheme, "http://" + req.headers.host))},center:[${SPLIT.lon},${SPLIT.lat}],zoom:15.05,maxPitch:0,attributionControl:false,fadeDuration:0,canvasContextAttributes:{preserveDrawingBuffer:true}});map.on('idle',()=>{if(map.queryRenderedFeatures({layers:['sea','buildings']}).length>100)window.mapReady=true;});
 </script>`);
      return;
    }
    const p = resolve(base, "." + decodeURIComponent(u.pathname));
    if (!p.startsWith(base + sep)) throw Error();
    res.setHeader(
      "Content-Type",
      extname(p) === ".mjs" ? "text/javascript" : "application/octet-stream",
    );
    res.end(await readFile(p));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const address = server.address();
if (!address || typeof address === "string")
  throw Error("Missing local address");
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN || undefined,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
  });
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    await page.goto("http://127.0.0.1:" + address.port + "/?theme=" + scheme);
    await page.waitForFunction(() => Boolean((window as any).mapReady));
    let output = "";
    for (let attempt = 0; attempt < 6 && !output; attempt++) {
      const png = await page.screenshot();
      output = await page.evaluate(async (b) => {
        const pic = new Image();
        pic.src = "data:image/png;base64," + b;
        await pic.decode();
        const c = document.createElement("canvas");
        c.width = pic.width;
        c.height = pic.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(pic, 0, 0);
        const a = ctx.getImageData(0, 0, c.width, c.height).data,
          colors = new Set<number>();
        for (let i = 0; i < a.length; i += 4 * 53)
          colors.add((a[i] << 16) + (a[i + 1] << 8) + a[i + 2]);
        return colors.size > 100
          ? c.toDataURL("image/webp", 0.85).split(",")[1]
          : "";
      }, png.toString("base64"));
      if (!output) await page.waitForTimeout(150);
    }
    if (!output) throw Error("Map did not paint");
    const out = join(
      base,
      "maps/split-waterfront" + (scheme === "light" ? "" : "-dark") + ".webp",
    );
    await writeFile(out, Buffer.from(output, "base64"));
    console.log(scheme, width + "×" + height, out);
    await page.close();
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
}
