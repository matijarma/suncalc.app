import type { Snapshot } from "./stats";
import { TOOLS, ZONE } from "../shared/usage";
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const integer = new Intl.NumberFormat("en-GB"),
  one = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }),
  countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const number = (n: number | null | undefined) =>
    n == null ? "—" : integer.format(n),
  time = (n: number) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ZONE,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(n);
function volume(n: number) {
  const units = ["B", "kB", "MB", "GB", "TB"];
  let i = 0;
  while (i < units.length - 1 && n >= 1000) {
    n /= 1000;
    i++;
  }
  return one.format(n) + " " + units[i];
}
function table(label: string, cols: string[], rows: string[][]) {
  return `<div class="scroll" tabindex="0" role="region" aria-label="${esc(label)}"><table><caption class="sr">${esc(label)}</caption><thead><tr>${cols.map((c) => "<th scope=col>" + esc(c) + "</th>").join("")}</tr></thead><tbody>${rows
    .map(
      (r) =>
        "<tr><th scope=row>" +
        esc(r[0]) +
        "</th>" +
        r
          .slice(1)
          .map((v) => "<td>" + esc(v) + "</td>")
          .join("") +
        "</tr>",
    )
    .join("")}</tbody></table></div>`;
}
const kpi = (name: string, v: string, desc: string) =>
  `<article class="kpi"><h3>${esc(name)}</h3><strong>${esc(v)}</strong><p>${esc(desc)}</p></article>`;
function chart(s: Snapshot, edge = false) {
  const data = s.points,
    w = 800,
    h = 147,
    base = 117,
    top = 14,
    max = Math.max(
      1,
      ...data.map((p) =>
        edge ? (p.visits ?? 0) : Math.max(p.opens, p.planning),
      ),
    ),
    pitch = w / data.length;
  const bars = data
    .map((p, i) => {
      const v = edge ? p.visits : p.measured ? p.opens : null,
        x = i * pitch + pitch * 0.15,
        bar = Math.min(58, pitch * 0.7),
        height = ((v ?? 0) / max) * (base - top);
      const tip =
        p.label +
        ": " +
        (v === null
          ? "not measured"
          : v +
            (edge
              ? " estimated visits"
              : " app opens, " + p.planning + " planning opens"));
      return `<g><title>${esc(tip)}</title>${v === null ? `<rect x="${x}" y="${base - 5}" width="${bar}" height="5" fill="url(#${edge ? "e" : "p"}-missing)"/>` : `<rect class="bar" x="${x}" y="${base - Math.max(1, height)}" width="${bar}" height="${Math.max(1, height)}"/>${!edge && p.planning ? `<rect class="engaged" x="${x + bar * 0.22}" y="${base - (p.planning / max) * (base - top)}" width="${bar * 0.56}" height="${(p.planning / max) * (base - top)}"/>` : ""}`}</g>`;
    })
    .join("");
  const every = Math.max(1, Math.ceil(data.length / 7)),
    labels = data
      .map((p, i) =>
        i % every === 0
          ? `<text x="${i * pitch + pitch * 0.5}" y="140" text-anchor="middle">${esc(s.range === "today" ? p.label.slice(0, 5) : p.label)}</text>`
          : "",
      )
      .join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${edge ? "Estimated Cloudflare visits" : "App opens and planning opens"} by ${s.range === "today" ? "hour" : "day"}; exact figures in the data table"><defs><pattern id="${edge ? "e" : "p"}-missing" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5l5-5" stroke="currentColor"/></pattern></defs><path class="grid" d="M0 14H800M0 65H800M0 117H800"/>${bars}${labels}</svg>`;
}
export function renderStats(s: Snapshot, nonce: string) {
  const totals = s.edge.totals,
    metrics = s.planner,
    period = s.range === "today" ? "Today" : "Last " + s.range + " days",
    percent = (a: number, b: number) =>
      b ? one.format((100 * a) / b) + "% of opens" : "No opens yet";
  const reach = Object.entries(TOOLS)
    .sort(([a], [b]) => s.tools[b] - s.tools[a])
    .map(([k, v]) => [v, metrics ? number(s.tools[k]) : "Not measured"]);
  const cc = (code: string) =>
    code === "XX"
      ? "Unknown"
      : code === "T1"
        ? "Unknown"
        : countryNames.of(code) || code;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex,nofollow"><link rel="icon" href="/icon.svg"><title>Usage · SunCalc admin</title><style nonce="${esc(nonce)}">${css}</style></head><body><a class="skip" href="#content">Skip to usage</a><header class="mast"><div class="wrap"><a class="brand" href="/"><img src="/icon.svg" width="36" height="36" alt=""><b class="wordmark"><span class="sr">SunCalc</span></b></a><span class="divider">/</span><span>Admin</span><span class="private">Private</span></div></header>
 <main class="wrap" id="content"><div class="title"><div><small>SunCalc admin</small><h1>Usage<span>.</span></h1><p>${esc(period)} · ${esc(s.from)}${s.today === s.from ? "" : " — " + esc(s.today)} · Europe/Zagreb</p></div><nav aria-label="Reporting period">${[
   ["today", "Today"],
   ["7", "7 days"],
   ["30", "30 days"],
 ]
   .map(
     ([k, n]) =>
       `<a href="/?range=${k}" ${s.range === k ? 'aria-current="page"' : ""}>${n}</a>`,
   )
   .join("")}</nav></div>
 <section aria-labelledby="planner"><div class="sect"><h2 id="planner">Planner use</h2><span>Online · today is partial</span></div><div class="tiles">${kpi("App opens", number(metrics?.opens), "Visible app loads, including reloads.")}${kpi(s.range === "today" ? "Daily active browsers" : "Avg. daily active browsers", metrics ? one.format(metrics.activePerDay) : "—", s.range === "today" ? "Estimated using a local date only." : "Across " + s.measuredDays + " measured day" + (s.measuredDays === 1 ? "" : "s") + ", including today.")}${kpi("Planning opens", number(metrics?.planning), "Opens with at least one planner action.")}${kpi("Installed-PWA opens", number(metrics?.pwa), metrics ? percent(metrics.pwa, metrics.opens) : "Standalone launches, not installs.")}</div>
 <div class="columns"><section class="panel"><h3>Planning activity</h3><p class="legend"><b>▰</b> App opens &nbsp; <b class="key">▮</b> With a planning action &nbsp; ▧ Not measured</p>${chart(s)}
 <details><summary>View chart data</summary>${table(
   "Planner activity",
   [
     s.range === "today" ? "Hour (Zagreb)" : "Day",
     "Opens",
     "Planning",
     s.range==="today"?"First counted this hour":"Active browsers",
     "PWA",
   ],
   s.points.map((p) => [
     p.label + (p.partial ? " *" : ""),
     ...(p.measured
       ? [p.opens, p.planning, p.active, p.pwa].map((n) => number(n))
       : ["Not measured", "—", "—", "—"]),
   ]),
 )}</details><p class="note">${s.plannerSince ? "Counting since " + esc(time(s.plannerSince)) + "." : "Not measured yet."} Offline use is not recorded. Clearing browser storage can affect the daily estimate.</p></section>
 <section class="panel"><h3>Tool reach</h3><p>Opens that used each tool at least once.</p>${table("Tool use per app open", ["Tool", "Opens"], reach)}</section></div></section>
 <section aria-labelledby="edge"><div class="sect"><h2 id="edge">Cloudflare traffic</h2><span>Public hostname only</span></div><p class="intro">Network traffic is separate from activity inside the planner. One visit can load many map tiles.</p>
 <div class="tiles edge">${kpi("Estimated visits", number(totals?.visits), "Eligible entrances to the public planner.")}${kpi("Requests", number(totals?.requests), "Includes map tiles and static assets.")}${kpi("Bandwidth", totals ? volume(totals.bytes) : "—", "Response bytes at the edge.")}${kpi("Server errors", number(totals?.errors), "HTTP 5xx responses.")}</div>
 <div class="columns"><section class="panel"><h3>Visit trend</h3>${chart(s, true)}<details><summary>View traffic data</summary>${table(
   "Traffic totals",
   [
     s.range === "today" ? "Hour (Zagreb)" : "Day",
     "Visits",
     "Requests",
     "Bytes",
     "5xx",
   ],
   s.points.map((p) => [
     p.label,
     ...(p.visits === null
       ? ["Not measured", "—", "—", "—"]
       : [
           number(p.visits),
           number(p.requests),
           volume(p.bytes),
           number(p.errors),
         ]),
   ]),
 )}</details><p class="note">${s.edge.lastSuccess ? "Last successful refresh: " + esc(time(s.edge.lastSuccess)) + "." : "No successful refresh yet."} ${s.edge.through ? "Data through " + esc(time(s.edge.through)) + "." : ""} ${s.edge.stale ? "Refresh unavailable or overdue; showing the last available figures." : ""} ${s.edge.missingHours ? esc(s.edge.missingHours) + " complete hour(s) missing from this range." : ""}</p></section>
 <section class="panel"><h3>Top countries</h3><p>By estimated visits, from the request’s country, not the map pin.</p>${
   s.edge.countries.length
     ? table(
         "Top countries by estimated visits",
         ["Country", "Visits"],
         s.edge.countries.map(([code, v]) => [cc(code), number(v)]),
       )
     : '<p class="note">No country visits recorded for this range.</p>'
 }</section></div></section></main><footer class="wrap">SunCalc · Usage · All times Europe/Zagreb</footer></body></html>`;
}
const css = `@font-face{font-family:Bric;src:url('/font.woff2') format('woff2');font-weight:200 800;font-display:swap}:root{color-scheme:light dark;--bg:#f8f6ec;--card:#fffdf4;--ink:#20231c;--muted:#505344;--line:#c9c9b5;--grid:#d4d3c3;--accent:#f9d83b;--focus:#2747ab}@media(prefers-color-scheme:dark){:root{--bg:#151728;--card:#202238;--ink:#f7f3df;--muted:#c3c1b6;--line:#50536a;--grid:#414456;--focus:#b7baff}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:475 16px/1.45 Bric,system-ui,sans-serif}a{color:inherit}a:focus-visible,summary:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--focus);outline-offset:2px}.wrap{width:min(1350px,100%);margin:auto;padding-inline:clamp(14px,4vw,58px)}.mast{background:var(--card);border-bottom:1px solid var(--line)}.mast .wrap,.brand,.sect,.title,nav,.tiles,.columns{display:flex;align-items:center}.mast .wrap{min-height:62px;gap:12px}.brand{gap:7px;text-decoration:none;font-size:25px;letter-spacing:-.07em}.wordmark{display:block;width:100px;aspect-ratio:500/108;background:currentColor;mask:url(/wordmark.svg) center/contain no-repeat}.divider,.title p,.sect span,.intro,.note,.panel>p,footer,.kpi p{color:var(--muted)}.private{margin-left:auto;background:var(--accent);color:#20231c;border-radius:4px;padding:4px 9px;font-size:12px;font-weight:690}.title,.sect{justify-content:space-between;gap:12px;flex-wrap:wrap}.title{padding:36px 0 25px}.title small{text-transform:uppercase;letter-spacing:.09em;font-weight:670}.title h1{font-size:clamp(3.1rem,2rem + 4vw,6.3rem);letter-spacing:-.07em;line-height:.96;margin:9px 0}.title h1 span{color:#97782a}.title p,.panel p,.kpi p,.intro{margin:5px 0 12px}nav{gap:3px;border:1px solid var(--line);padding:3px;border-radius:9px;background:var(--card)}nav a{display:grid;place-items:center;min-height:44px;padding:5px 12px;border-radius:6px;text-decoration:none;font-size:14px}nav a[aria-current]{background:var(--ink);color:var(--bg);font-weight:700;text-decoration:underline;text-underline-offset:4px}.sect{border-top:1px solid var(--ink);padding:16px 0 10px}.sect h2,.panel h3,.kpi h3{margin:0}.sect h2{font-size:clamp(1.5rem,1rem + 1.3vw,2.5rem);letter-spacing:-.055em}.sect span,.note,footer{font-size:.81rem}.tiles,.columns{display:grid;align-items:stretch;gap:12px}.tiles{grid-template-columns:repeat(4,minmax(0,1fr))}.kpi,.panel{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:17px}.kpi:first-child{background:var(--accent);color:#20231c}.kpi:first-child p{color:#45442a}.edge .kpi:first-child{background:var(--card);color:var(--ink)}.edge .kpi:first-child p{color:var(--muted)}.kpi h3{font-size:.91rem;font-weight:600}.kpi strong{display:block;line-height:1.2;font-size:clamp(2rem,1rem + 2.2vw,3.3rem);letter-spacing:-.06em;margin:5px 0;font-variant-numeric:tabular-nums}.kpi p,.panel>p{font-size:.87rem}.columns{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);margin:12px 0 30px}.panel{min-width:0}.panel h3{font-size:1.35rem;letter-spacing:-.04em}.chart{display:block;width:100%;height:auto;min-height:90px;color:var(--muted)}.chart text{fill:var(--muted);font-size:12px}.grid{stroke:var(--grid);stroke-dasharray:3 4;fill:none}.bar{fill:var(--ink)}.engaged{fill:var(--accent);stroke:var(--ink);stroke-width:1}.key{background:var(--ink);color:var(--accent);padding-inline:2px}.scroll{overflow:auto;max-height:380px;container-type:inline-size}table{width:100%;border-spacing:0;font-variant-numeric:tabular-nums;font-size:.89rem}th,td{padding:6px 7px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}th:first-child{text-align:left}thead{position:sticky;top:0;z-index:2;background:var(--card)}tbody th{position:sticky;left:0;background:var(--card);font-weight:480}summary{cursor:pointer;min-height:44px;align-content:center}footer{padding-block:12px 22px}.sr,.skip:not(:focus){position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.skip:focus{display:block;padding:6px}@container(max-width:390px){th,td{padding:6px 4px;font-size:.79rem}}@media(max-width:740px){.columns{grid-template-columns:1fr}.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.title{padding:24px 0 18px}.kpi,.panel{padding:12px}.columns,.tiles{gap:8px}}@media(forced-colors:active){.bar{fill:CanvasText}.engaged{fill:Highlight;stroke:CanvasText}nav a[aria-current]{border:2px solid Highlight}}`;
