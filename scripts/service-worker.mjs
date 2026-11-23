import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(dir + "/" + d.name) : [dir + "/" + d.name],
  );
}
const all = files("dist").map((f) => f.slice(4));
const shell = all.filter(
  (f) =>
    f.startsWith("/assets/") ||
    f.startsWith("/brand/") ||
    (f.startsWith("/maps/lib/") && f.endsWith(".mjs")) ||
    [
      "/index.html",
      "/maps/split-waterfront.webp",
      "/maps/split-waterfront-dark.webp",
      "/appearance-boot.js",
      "/site.css",
      "/icon-180.png",
      "/icon.svg",
      "/icon-192.png",
      "/icon-512.png",
      "/manifest.webmanifest",
    ].includes(f),
);
const hash = createHash("sha256");
for (const f of shell) hash.update(readFileSync("dist" + f));
hash.update(readFileSync("scripts/service-worker.mjs"));
const ver = hash.digest("hex").slice(0, 12);
writeFileSync(
  "dist/sw.js",
  `const NAME='sc-shell-${ver}',DATA='sc-map-v1',SHELL=${JSON.stringify(shell.map((f) => (f === "/index.html" ? "/" : f)))};
self.addEventListener('install',e=>e.waitUntil(caches.open(NAME).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sc-shell-')&&k!==NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
let trim=Promise.resolve();function prune(cache){trim=trim.catch(()=>{}).then(async()=>{const keys=await cache.keys();if(keys.length>360)await Promise.all(keys.slice(0,keys.length-340).map(k=>cache.delete(k)))});return trim}
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/')||u.pathname==='/sw.js')return;
if(r.mode==='navigate'){e.respondWith(fetch(r).catch(async()=>{if(u.pathname==='/'){const cached=await caches.open(NAME).then(c=>c.match('/'));if(cached)return cached}return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page unavailable offline · SunCalc.app</title><h1>This page needs a connection</h1><p>The sun planner is available offline after an online visit.</p><a href="/">Open the planner</a></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}})}));return}
if(SHELL.includes(u.pathname)){e.respondWith(caches.open(NAME).then(async c=>(await c.match(u.pathname))||fetch(r)));return}
if(!/^\\/(tiles|towns|maps)\\//.test(u.pathname))return;
e.respondWith((async()=>{const c=await caches.open(DATA),hit=await c.match(r);if(hit)return hit;try{const resp=await fetch(r);if(resp.ok&&resp.status===200){try{await c.put(r,resp.clone());await prune(c)}catch{}}return resp}catch{return new Response('Not cached offline',{status:503})}})());});`,
);
console.log("Offline shell:", shell.length, "assets, version", ver);
