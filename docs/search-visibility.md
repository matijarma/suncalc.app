# Search visibility runbook

## Account setup

1. In [Google Search Console](https://search.google.com/search-console), add a **Domain** property for `suncalc.app`.
2. Publish the exact `google-site-verification=…` TXT value Google supplies at the DNS apex, then choose Verify. This is public verification data, not an account password.
3. Submit `https://suncalc.app/sitemap.xml` in Sitemaps. Inspect `/` and `/guides/shadow-length/`, including the live rendered page, and request indexing once.
4. Sign into [Bing Webmaster Tools](https://www.bing.com/webmasters/) and import the verified Google property, or complete Bing's own DNS/file verification. Submit the same sitemap.
5. Keep verification records in DNS and record the setup date and outstanding issues.

Account login, verification completion and submissions require the account owner
where no authenticated integration is available. Serving a sitemap or DNS record
alone is not proof of indexing or submission.

## Weekly review, first four weeks

| Week | Indexed pages / issues | Non-brand impressions / clicks | Queries and countries | Aggregate opens / planning / shares | Launch activity and feedback |
| --- | --- | --- | --- | --- | --- |
| Baseline | Pending account setup | Pending | Pending | Use the existing private usage dashboard | Site and repository release |
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |

Separate SunCalc / SunCalc.app searches from task queries such as “shadow length
calculator.” Inspect actual queries before treating ambiguous brand searches as
demand for this independent app. Results can lag, and launch spikes do not
establish which channel caused each visit.

The existing aggregate counters do not identify people or attribute individual
conversions to campaigns. Standalone opens are not install counts. No analytics
identifiers, referrer collection or coordinate logging have been added.

Reassess after 6–12 weeks. Improve pages that receive relevant impressions but
fail to answer the query. Add city pages or translations when the data and user
questions justify useful, original content.

## Technical checks after releases

- All six published URLs appear in the sitemap; only genuine edits change `lastmod`.
- Raw HTML contains useful text, canonicals, titles, descriptions and social metadata.
- HTTP and www redirect to the HTTPS apex, preserving paths and queries.
- Missing paths remain 404s, including in a service-worker-controlled browser.
- Preview assets send `X-Robots-Tag: noindex, nofollow`; production does not.
- The planner stays in the first viewport. Sharing, section links, offline reopening and payments retain their behavior.
- Guide screenshots preserve attribution and load lazily below the fold.

Use Search Console for indexing and performance evidence. A curl request or
Lighthouse score is not proof of indexing.
