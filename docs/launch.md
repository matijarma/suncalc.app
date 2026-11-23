# SunCalc.app launch kit

Prepared 23 November 2026. These are drafts for manual publication.
No posts, directory listings or outreach messages have been sent.

## Positioning

**SunCalc.app: see where the sun will be and how long a shadow it casts, without an account.**

> SunCalc.app opens straight into a sun-position map. Drop a pin, choose a date,
> follow sunrise and sunset, compare the seasons and estimate the shadow of an
> upright object. Saved places stay on your device and precise plans can be
> shared as links. The independent project is open source under MIT and free
> during preview. It models a clear, level horizon; buildings, trees, terrain
> and weather are not modelled.

Do not call the complete hosted service “free forever.” The planned release is
30 full days, then €1 once per browser installation; today's sunrise and sunset
remain free. Self-hosting and commercial code reuse are permitted by MIT.

## Assets

- [Desktop planner](../public/images/sun-direction.webp)
- [Mobile planner](../public/images/planner-mobile.webp)
- [December shadow example](../public/images/shadow-length.webp)
- [Social card, 1200 × 630](../public/images/social-card.png)
- [Captioned demonstration](../public/media/suncalc-demo.mp4)
- [Captions](../public/media/suncalc-demo.vtt)

Screenshots and video retain © OpenStreetMap contributors · Protomaps attribution.
The demo uses a public waterfront location. Reproduce it with `npm run media`
while `npm run preview` serves the current build. FFmpeg and Chrome are required.

## Show HN

Title: **Show HN: SunCalc.app – an open-source sun and shadow planner**

URL: https://suncalc.app/

Opening comment:

> I built SunCalc.app because I wanted to open a map, move through the day and
> understand where the light would come from without creating an account.
>
> It shows sun direction and altitude, sunrise and sunset, golden-light times,
> seasonal paths and a height-based shadow ruler. Plans are shareable, saved
> places stay in the browser, and the app can reopen offline after a visit.
>
> One example: at solar noon on the Split waterfront, a 2 m post casts about
> a 0.7 m shadow in June and a 4.7 m shadow in December. The guides include
> examples you can open and change yourself.
>
> It is an independent project, not affiliated with SunCalc.org, SunCalc.net
> or the SunCalc JS library. The stack is Preact, Astronomy Engine, MapLibre
> and Cloudflare, with first-party map delivery. The code is MIT-licensed:
> https://github.com/matijarma/suncalc.app
>
> The hosted app is free during preview. The planned release is 30 full days,
> then €1 once per browser installation; today's sunrise and sunset stay free.
> It assumes a clear, level horizon, so it does not simulate terrain, buildings
> or trees. I'd especially appreciate feedback on readability, mobile use and
> situations where a calculation is hard to understand.

## Community post: seasonal sunlight

Check the community's current rules, disclose that you made the tool, and choose
one relevant community rather than copying the same post everywhere.

> The same 2 m post casts about a 0.7 m shadow at June solar noon and 4.7 m at
> December solar noon on the Split waterfront. I made a small sun-planning app
> and wrote up the comparison here:
> https://suncalc.app/guides/seasonal-sunlight/
>
> You can change the pin to your own location and compare the dates. It is
> useful for understanding light direction, but it doesn't detect buildings
> or tell you the actual shaded area of a garden. I'd be interested in what
> you check when planning around seasonal sunlight.

For photography communities, lead with the sunrise/sunset bearing and link to
the sun-direction guide. For gardening communities, keep the obstacle limitation
in the post and use the seasonal example.

## AlternativeTo listing

- Name: SunCalc.app
- Website: https://suncalc.app/
- Source: https://github.com/matijarma/suncalc.app
- Platforms: Web, installable PWA
- Source license: MIT
- Pricing: Free preview; planned freemium hosted service with €1 one-time unlock per browser installation after 30 days
- Features: Sun path, sunrise/sunset, sun direction, level-ground shadows, seasonal comparison, offline planner, no account
- Description: Use the positioning paragraph above.

Compare against planners on features you have verified. Do not claim terrain
shade, augmented reality or moon planning.

## Publisher pitches

Photography newsletter:

> I made an independent, open-source sun planner that opens directly into a
> map. This short guide shows how to use a sunrise or sunset bearing to scout
> a photograph, with a working example readers can change:
> https://suncalc.app/guides/sun-direction/
> If it fits your next tools or location-scouting edition, you are welcome to
> link to it. Screenshots with map attribution and a short captioned demo are
> available. The hosted app is free during preview.

Gardening or outdoor publisher:

> With the December solstice approaching, I put together a worked example of
> how sun altitude and shadow length change at the same place through the year:
> https://suncalc.app/guides/seasonal-sunlight/
> It includes a live map readers can adapt to their own location. The tool
> shows direction and a simple upright-object shadow; it does not simulate
> shade from nearby buildings or trees. I made the app and would be happy to
> explain the example if it suits a seasonal feature.

Educator:

> I made an MIT-licensed sun planner with examples connecting a real map to
> compass bearings, solar altitude and the tangent relationship for shadows:
> https://suncalc.app/guides/shadow-length/
> Students can change the location, date and height without an account. The
> calculations assume level ground and a clear horizon. If it is useful for
> a lesson, feedback on the explanation would help improve it.

## Four-week sequence

1. Publish the site and source; verify Google and Bing; inspect the homepage and a guide.
2. Publish Show HN and one permitted community example on different days. Be available for comments.
3. Submit the accurate AlternativeTo listing and publish the [technical article](technical-article.md).
4. Send a few tailored publisher pitches. Prepare a December-solstice demonstration, including the opposite season in the Southern Hemisphere.

These are manual tasks, not scheduled jobs. No paid acquisition is planned.
Review feedback before expanding city pages, translations or export features.
