# SunCalc · Sun and shadow planner

An English-language, installable solar planner. Drop a pin, scrub the local day, or select sunrise, solar noon, or sunset. Bookmarks, precise share fragments, solstice comparison, twilight, and a height-based shadow ruler work without an account. The app models a clear level horizon, not shade cast by terrain, buildings, or trees.

## Run and verify

Use Node 22.13+ and npm. From the repository root:

```sh
npm ci
npm run ci
npx wrangler d1 migrations apply suncalc-app --local
npm run preview
```

Open http://127.0.0.1:8789. This serves the production bundle, local D1 and the real Split map without credentials. For live UI editing run `npm run dev` in another terminal. Production service workers are intentionally disabled on the Vite dev server. Use `npx playwright install chromium` then `npm run test:browser`, or set `CHROME_BIN` to an installed Chrome executable.

The CI suite checks solar events against independent US Naval Observatory references, both DST transitions, polar conditions, quota enforcement, and idempotent purchase/restore. Browser tests cover mobile planning, sharing, search, offline reopen, cookies and outgoing requests.

## Map and search data

- Cartography: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL), Natural Earth, and [Protomaps](https://docs.protomaps.com/basemaps/downloads). Planet archive: 20261118 (v4.15.2), 139594494611 bytes; published BLAKE3 `b06573f7a8d3e474f3dab0f0f491996c87c2d3037ac1d8068567fda94db4c568`. The application owns its R2 bucket and serves versioned XYZ tiles on its own origin. The Worker reads byte ranges using PMTiles and caches the decompressed tile at the edge.
- The repo includes a small real OSM extract around Split and the global overview (zoom 0–3). To reproduce them, place the go-pmtiles CLI v1.31.2 in `.cache/`, run `pmtiles extract https://build.protomaps.com/20261118.pmtiles .cache/split.pmtiles --bbox=16.410,43.492,16.464,43.521 --maxzoom=15` and `pmtiles extract https://build.protomaps.com/20261118.pmtiles .cache/world.pmtiles --maxzoom=3`, then `node scripts/seed-map.mjs`. For a future map edition change the versioned tile route, source metadata, archive key and cache namespace together.
- Local town search uses [GeoNames cities500](https://download.geonames.org/export/dump/) (CC BY 4.0): downloadable, first-party prefix shards with country and coordinates. Refresh with `npm run data:towns`. Nearby road/POI search uses the map tiles already loaded. Map labels use Noto Sans (OFL in public/maps/fonts). Time zones come from the compact timezone-boundary-builder lookup distributed by @photostructure/tz-lookup; this is approximate very close to borders. The solar engine is Astronomy Engine (MIT).
- Optional explicit global lookup uses one Geoapify forward-geocoder request. Only submitted text and fixed service parameters leave the Worker. No installation key, GPS, user IP header or persistent query log. The daily 3,000-request cap is enforced atomically in D1. Keep a dedicated provider key and no paid overage.
- Service worker: cache the shell and solar code, and keep a bounded cache of recently viewed map tiles, search shards and glyphs. Unvisited high-resolution map detail requires connectivity. The app can still compute the sun without it.

## Operations

The public GitHub repo is connected to Cloudflare Workers Builds. A push to main runs `npm run ci` then the platform's configured deployment command. Do not deploy application code manually. Wrangler is used locally for preview, migrations, secrets, and workflow monitoring. The immutable map import is an operator-triggered Workflow, never a public HTTP endpoint. Start it once with `npx wrangler workflows trigger suncalc-map-import`; check `npx wrangler workflows instances list suncalc-map-import`. It copies verified byte ranges using a resumable multipart upload and publishes only a complete archive.

D1 holds install-key hashes, trial start, purchase references, recovery-code hashes and anonymous daily search counters. The public planner uses first-party anonymous aggregate counters. It has no analytics identifier, application request logging, ads, third-party browser assets, or cookies. Shared coordinates and times are in URL fragments; saved pins stay on the device.

## Long Shadow

The PWA uses the approved Long Shadow mark, Bricolage Grotesque, and a sunflower instrument face with a separately tuned dark map. **Auto / Light / Dark** lives in Appearance & settings. Auto follows the operating system; pinned preferences persist locally and across tabs. Scrubbing the sun, switching places and changing dates never change the theme. The browser controls, overlays, initial maps and installed-app assets use the same system. No cookies are used.

The exposure strip uses solar altitude over the pin’s actual civil day. A background worker samples each minute and reduces it to a small set of gradient stops. The daily path supplies an immediate fallback. Both map palettes use identical tile URLs and a shared offline cache. The map applies color changes to existing paint properties without resetting its camera.

Color roles and exposure stops are in `src/design/tokens.json`; prebuild generates the CSS palette. To refresh the two first-paint images from the bundled OSM tiles, run `npm run prebuild` and `CHROME_BIN=/usr/bin/google-chrome node --import tsx scripts/map-plates.ts`. The local renderer checks that real street/shoreline features were drawn before writing each image.

The `design/long-shadow` branch builds the separate HTTPS working preview via Workers Builds, using `wrangler.preview.jsonc`, a separate entitlement database, and the same read-only map data. Preview billing stays disabled. A push to `main` is the production release.

## Paid launch gate

The committed mode is **preview**. No trials start and checkout is unavailable. Search addresses require a Worker secret named `GEOAPIFY_KEY`. For billing, provision `SUMUP_KEY`, `SUMUP_MERCHANT`, and a high-entropy stable `RECOVERY_SECRET` in Worker secrets; never commit them. Use a separate staging Worker/database and test merchant first. Confirm the Croatian merchant's €1 minimum and fee, no-email card flow, receipt and applicable tax obligations. Verify success, declined/abandoned checkout, repeat confirmation, offline paid access, recovery after clearing browser data, and trial expiry. Then set `BILLING_MODE` to `live` via git. If credentials are incomplete the API stays in preview.

SumUp is isolated on its own site. A return URL never grants access: the Worker reads the checkout directly from SumUp and matches the amount, currency, merchant and internal reference. Confirmation is retryable after a lost redirect. The recovery code is a private bearer credential, available as a download. Clearing storage can start a new trial; the product deliberately does not fingerprint devices. Android uses a separate seven-day trial and Google Play billing; see the [Android release guide](android-release.md). The web launch gate above does not control Android.

## Private usage dashboard

[sin.suncalc.app](https://sin.suncalc.app/) serves read-only HTML and `/api/stats?range=7` (also `today` and `30`). The separate Worker accepts this hostname only and validates a signed Cloudflare Access JWT, including issuer, app audience and expiry, before any data or assets are served. Use the existing reusable **matija** Allow policy, not a public bypass or generic service token. Admin authentication is confined to the admin hostname. The admin Worker has no workers.dev or version preview URL.

The public PWA sends only `surface` (browser/standalone PWA) and a closed list of event names to its own `POST /api/usage`. App opens count foreground online loads including reloads. Planning and tool reach count once per open, restarting on the next observed Zagreb calendar day. Standalone opens are not install counts. Daily active browsers are a best-effort estimate: the only stored measurement value is the last Zagreb date, never sent; browsers with unavailable storage do not contribute to this estimate. No offline queue, replay, opt-out screen, analytics ID, referrer, coordinates, search text, chosen time or payment details. Preview/admin/localhost cannot write planner counters. The usage database is separate from billing.

The Sredstva-style edge archive reads only apex eyeball traffic with the dedicated **suncalc.app / Zone Analytics Read** Worker secret `CF_ANALYTICS_TOKEN`. Requests, bandwidth and 5xx include the map and assets. Visits and source countries use eligible, successful planner entry requests, excluding known bots and headless clients where Cloudflare identifies them. The data may be sampled; neither visits nor requests are unique people. UTC-hour aggregate replacements are idempotent; missing or stale data is labelled and failed reads do not erase the archive. All display days are Europe/Zagreb, including DST changes.

Apply `migrations-usage` to `suncalc-usage` before releasing. The admin config is `wrangler.admin.jsonc`; its own Workers Builds trigger watches main and runs `npm run ci:admin`. Configure Access **before** attaching the custom domain. The timer refreshes recent hours every 15 minutes, catches up missed windows within zone retention, and rechecks the previous day overnight. To bootstrap or repair from the VM, supply the same scoped read token through the environment, save the output of `node --import tsx scripts/backfill-usage.ts` to an ignored temporary SQL file, then import it with `npx wrangler d1 execute suncalc-usage --config wrangler.admin.jsonc --remote --file <file>`. It writes only hourly aggregates. Initialize `usage_meta.planner_since` once at the public collector release; first accepted use also initializes it if absent. Previously unmeasured dates never become zero-use days.

## Public content and canonical URLs

The public pages and metadata are authored in `scripts/site-content.mjs` and
built by the Vite plugin. Guide images and the demo are generated with
`npm run media` against a local preview. After rebuilding assets, restart an
already-running preview before browser checks so its asset manifest is current.

The zone redirect is recorded in `docs/canonical-redirect.json`. It redirects
HTTP and www directly to the HTTPS apex, preserving the path and query.
Production disables workers.dev and version preview URLs. The preview config
runs the Worker before assets so its noindex response header covers static pages.

Before enabling paid access, update the preview/pricing wording on the public
pages and in the README alongside the existing paid-launch checks. The free
preview is the current offer; the €1 purchase is a planned release.
