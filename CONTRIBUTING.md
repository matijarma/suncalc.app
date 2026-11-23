# Contributing to SunCalc.app

Try [the planner](https://suncalc.app/) and open an issue before a substantial change.
Small fixes, clearer explanations, accessibility improvements and reproducible
accuracy reports are welcome.

Use Node 22.13+ and npm. Run `npm ci`, `npm run ci`, local database migrations and
the browser tests as described in the README. Submit a focused pull request with
the problem, resulting behavior and relevant verification.

Keep these product boundaries in mind:

- The homepage opens directly into the planner. Explanatory content follows it.
- No accounts, advertising, cookies or user-level analytics identifiers.
- Shared coordinates and times remain in URL fragments.
- Calculations assume a clear, level horizon. Do not imply terrain or building-shade modelling.
- Third-party data and screenshots retain attribution and their own licenses.

Public content and metadata live in `scripts/site-content.mjs`. The Vite plugin
renders those pages and the sitemap in production and serves them during development.
Update each page's modification date only when its content changes materially.
Do not use the build timestamp as a sitemap modification date.

Original contributions are licensed under MIT. Do not include credentials,
private locations, recovery codes, customer data or third-party assets you cannot redistribute.

Production releases use GitHub-connected Cloudflare Workers Builds. Pull requests
do not deploy production. Maintainers merge reviewed changes to `main` to release.
Workers Builds runs the repository's CI command and reports its status on GitHub.
Run the unit and browser checks locally before submitting a pull request.
