# Visibility release verification · 23 November 2026

- `npm run ci`: 18 unit tests passed; TypeScript and the production build passed.
- Full Playwright suite: 12 browser tests passed, including payment restoration,
  anonymous counters, both daylight-saving hours, sharing and offline reopening.
- New checks cover fragment navigation without changing the current plan, all
  six sitemap pages without JavaScript, working links and images, no planner
  bundle on guides, preview noindex headers and genuine 404 navigation.
- Homepage example links bring the planner into view and move keyboard focus
  to it; explanatory anchors preserve the selected place and time.
- Widths 320, 390, 741 and 1440 px: no horizontal overflow; explanatory content
  begins after the planner's full first viewport.
- Light/dark guide pages, the social card and the captioned 28-second demo were
  visually reviewed. Captions leave the shadow reading and map attribution visible.
- Gitleaks 8.30.1: full Git history and the staged public snapshot passed. Exact
  allowlist entries cover only the public map archive filename and Access audience.

## Synthetic mobile performance

Lighthouse 13.6.0 with simulated mobile throttling and software WebGL on the VM:

| Build and serving environment | Performance | LCP | Total blocking time | CLS |
| --- | ---: | ---: | ---: | ---: |
| Original, production CDN | 49 | 6.0 s | 2,030 ms | 0 |
| Original, fresh local preview | 47 | 6.6 s | 1,990 ms | 0 |
| Updated, fresh local preview | 49 | 6.0 s | 1,710 ms | 0 |

The updated planner and the shadow guide scored 100 on Lighthouse's automated
accessibility and SEO categories. Those scores do not prove full accessibility,
indexing or rankings. A pre-existing unscored label/name advisory remains on
planner controls.

An earlier run against a reused local preview scored 41 (8.5 s LCP). The local
runtime had cache warnings; the result did not reproduce with a fresh server.
MapLibre initialization dominated long tasks in both builds. These single-run
VM results are indicative, not field Core Web Vitals or evidence of a speed win.
Real-device map startup remains a worthwhile follow-up.

The HTTP-to-HTTPS redirect was checked with a guide path and query string; both
were preserved. Post-deployment checks cover the public sitemap, canonical URLs,
www redirect, source repository and deployed commit.

Google/Bing account verification and sitemap submission require the owner's
account access. Follow [the search runbook](search-visibility.md); no indexing
claim is made by this release.
