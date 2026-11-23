// Authored public pages. Dates describe content edits, not build times.
export const origin = "https://suncalc.app";
export const repository = "https://github.com/matijarma/suncalc.app";
export const summer = "/#lat=43.5083&lon=16.4383&at=2026-06-21T10%3A56%3A03.155Z&place=Split+waterfront";
export const winter = "/#lat=43.5083&lon=16.4383&at=2026-12-21T10%3A52%3A17.274Z&place=Split+waterfront";
export const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const link = (href, label, classes = "") => `<a${classes ? ` class="${classes}"` : ""} href="${escapeHTML(href)}">${label}</a>`;
const example = (href, label) => link(href, label + " <span aria-hidden=\"true\">↗</span>", "site-button");
const pricing = `<p>The complete planner is free during preview. No trial clock is running and no payment is taken. The planned paid release includes 30 full days, then <strong>€1 once for this browser installation</strong>. Today’s sunrise and sunset will stay free. A recovery code will let you restore a paid installation.</p>`;
const limit = `<p>SunCalc models a clear, level horizon. Buildings, trees, terrain and weather are not modelled. Use it to understand the direction and timing of sunlight, then check the actual view from your location.</p>`;
const guideCards = () => `<div class="site-cards">
  ${link("/guides/sun-direction/", '<span class="site-kicker">01 · Direction</span><h3>Where will the sun be?</h3><p>Read bearings, follow the day, and plan a sunrise or sunset.</p><span aria-hidden="true">Read the guide →</span>')}
  ${link("/guides/shadow-length/", '<span class="site-kicker">02 · Shadows</span><h3>How long is a shadow?</h3><p>Turn an object’s height and the sun’s altitude into a useful estimate.</p><span aria-hidden="true">Read the guide →</span>')}
  ${link("/guides/seasonal-sunlight/", '<span class="site-kicker">03 · Seasons</span><h3>What changes in winter?</h3><p>Compare the same place in June and December.</p><span aria-hidden="true">Read the guide →</span>')}
</div>`;

export const pages = [
  {
    path: "/", title: "Sun Position & Shadow Length Calculator | SunCalc.app",
    description: "See sun direction, sunrise, sunset and shadow length anywhere on Earth. Choose a date, compare seasons and share a pin. No account required.",
    updated: "2026-11-23",
    content: `<section class="site-section site-intro" id="learn" aria-labelledby="learn-title">
      <div class="site-reading"><p class="site-kicker">A little planning. A little more sunlight.</p>
      <h1 id="learn-title" tabindex="-1">Sun position and shadow length calculator</h1>
      <p class="site-lead">See where the sun will be and how long a shadow it casts. Choose any place on Earth, move through the day, and make a plan without an account.</p>
      <p>SunCalc.app puts sunrise, solar noon and sunset on a map. Read the sun’s compass direction and altitude, compare the seasons, or estimate the shadow of a post, person or other upright object. Use it to choose a time for a walk, scout a sunset photograph, or understand the sunlight around your home.</p>
      <h2>From a place to a plan</h2>
      <ol><li><strong>Choose your place.</strong> Search a town, enter coordinates, drop a pin, or use your location when you choose to share it.</li><li><strong>Pick a date and time.</strong> Scrub the day or jump to sunrise, solar noon or sunset. Times follow the pin’s local time zone.</li><li><strong>Read the light.</strong> Follow the sun’s bearing, set an object’s height for a shadow estimate, and open More tools for season comparisons and Shadow &amp; light details.</li></ol>
      <p>For example, at solar noon on the Split waterfront, a 2 m post casts a shadow of about 0.7 m on 21 June 2026 and 4.7 m on 21 December. The place and object are the same; the sun’s height changes.</p>
      <div class="site-actions">${example(summer, "Try the June example")}${link("/guides/seasonal-sunlight/", "Compare the seasons")}</div>
      <h2>What the map can tell you</h2>${limit}
      <h2>Your plans stay yours</h2><p>No accounts, cookies or ads. Saved places stay in your browser. Shared coordinates and times live in the part of the link after the #, which is not sent in an HTTP request. Optional address lookup uses Geoapify; anonymous aggregate counters help us understand which tools are useful. ${link("/about/#privacy", "Read about privacy")}.</p>
      <h2>Free to try during preview</h2>${pricing}</div>
      <section class="site-guide-list" aria-labelledby="guide-title"><h2 id="guide-title">Make the most of the light</h2>${guideCards()}</section>
    </section>`,
  },
  {
    path: "/about/", title: "About, Privacy & Accuracy | SunCalc.app",
    description: "Meet the independent SunCalc.app project. Learn about its solar calculations, privacy, open-source license, preview pricing and map data.",
    heading: "A small tool for following the sun", kicker: "About SunCalc.app", updated: "2026-11-23",
    content: `<p class="site-lead">SunCalc.app is an independent sun and shadow planner made by Matija Radeljak. It opens straight into a map so you can get on with planning.</p>
      <p>This project is independent of SunCalc.org, SunCalc.net and the SunCalc JavaScript library. Its solar calculations use Astronomy Engine. The original application code is available under the MIT license in the ${link(repository, "public GitHub repository")}.</p>
      <h2 id="pricing">Access and pricing</h2>${pricing}<p>The source code and the hosted service are separate: MIT permits you to use, modify and host the original code, including commercially. Third-party maps, data and fonts keep their own licenses.</p>
      <h2 id="accuracy">Accuracy and the horizon</h2>${limit}
      <p>Bearings are measured clockwise from true north. Event times use the pin’s local civil time, including daylight-saving changes. The time-zone boundary lookup is approximate very close to borders. Solar noon is the sun’s highest point that day; it is not necessarily 12:00 on the clock.</p>
      <p>The shadow ruler assumes an upright object on level ground and uses its height and the sun’s altitude. It does not trace a building’s outline or calculate which parts of a garden are shaded. Near the horizon, a small change in altitude produces a large change in shadow length.</p>
      <p>Golden light is defined here as solar altitude from −4° to +6°. These are planning thresholds, not a forecast of the colour or quality of the light. At polar locations, sunrise or sunset may not happen on the chosen day.</p>
      <h2 id="privacy">Privacy</h2>
      <p>No cookies, ads, accounts or analytics identifiers. Saved places and appearance preferences stay in your browser. Location permission is optional.</p>
      <p>We count online app opens and which planner tools are used in aggregate. A date stored in the browser helps estimate daily active browsers; that date is not sent. These counts contain no coordinates, selected times, search text, shared links or purchase details. Infrastructure statistics provide aggregate requests, bandwidth and source countries.</p>
      <p>Map and local town-search requests go to SunCalc.app. Map tile coordinates necessarily identify a map area to the hosting infrastructure. Precise shared pins and times are kept in URL fragments and are not sent in page requests. Anyone you give a share link to can read the information in that link.</p>
      <p>If you explicitly choose address lookup, the submitted text is sent through our server to Geoapify. No installation key, GPS coordinates or user IP header is forwarded with that lookup. We do not keep a persistent query log.</p>
      <p>In the paid release, an anonymous installation key will record trial and purchase status separately from map traffic. Payment will take place on the processor’s own site. A recovery code is a private credential: keep it safe and do not include it in a public issue.</p>
      <h2 id="offline">Using SunCalc offline</h2>
      <p>After an online visit, the app can reopen and calculate the sun without a connection. Recently viewed map areas and search data are cached within limits. Unvisited detailed maps and address lookup require a connection. These guides require a connection; the planner’s offline cache is kept focused on the app.</p>
      <h2 id="credits">Data and credits</h2>
      <ul><li>Maps: ${link("https://www.openstreetmap.org/copyright", "OpenStreetMap contributors")} (ODbL), ${link("https://protomaps.com/", "Protomaps")} and Natural Earth.</li><li>Town search: ${link("https://www.geonames.org/", "GeoNames")} (CC BY 4.0).</li><li>Solar calculations: ${link("https://github.com/cosinekitty/astronomy", "Astronomy Engine")} (MIT).</li><li>Time zones: @photostructure/tz-lookup, with data from ${link("https://github.com/evansiroky/timezone-boundary-builder", "timezone-boundary-builder")}.</li><li>Type: Bricolage Grotesque and Noto Sans (${link("/brand/OFL.txt", "SIL Open Font License")}).</li></ul>
      <h2>Feedback and contributions</h2><p>Found a problem or have an idea? ${link(repository + "/issues", "Open a GitHub issue")}. For an accuracy report, include the date, time zone and a public example location, and tell us what you expected to see. Avoid sharing private locations or recovery codes.</p>`,
  },
  {
    path: "/guides/", title: "Sun Direction, Shadows & Seasonal Sunlight Guides | SunCalc.app",
    description: "Practical guides to reading sun direction, estimating shadow length and comparing seasonal sunlight, with examples you can open in SunCalc.app.",
    heading: "A little knowledge goes a long way", kicker: "SunCalc guides", updated: "2026-11-23",
    content: `<p class="site-lead">Understand what the sun is doing, then try it on the map. Start with the question you want to answer.</p><section aria-labelledby="topics"><h2 id="topics">Choose a guide</h2>${guideCards()}</section><h2>A note before you start</h2>${limit}<p>All examples use local times at the selected pin. You can change the place or date after opening an example. ${link("/about/#accuracy", "How the calculations work")}.</p>`,
  },
  {
    path: "/guides/sun-direction/", title: "How to Read Sun Direction & Plan a Sunset | SunCalc.app",
    description: "Learn sun bearings, altitude and solar noon. Use a map to find sunrise and sunset directions and choose a time for a walk or photograph.",
    heading: "Where will the sun be?", kicker: "Guide 01 · Sun direction", updated: "2026-11-23",
    content: `<p class="site-lead">The time of sunset tells you when to look. The direction tells you where. A sun-path map brings both together.</p>
      <h2>Read direction and height separately</h2><p>The sun’s <strong>azimuth</strong> is its compass bearing: 0° is north, 90° east, 180° south and 270° west. SunCalc measures bearings from true north. A magnetic compass may need a local correction.</p><p>The sun’s <strong>altitude</strong> is its angle above the horizon. At 0° it is on the geometric horizon; at 90° it is directly overhead. A negative value puts it below that horizon. The map shows the bearing, while the altitude tells you how high to look.</p>
      <figure><img src="/images/sun-direction.webp" alt="SunCalc map of Split at June solar noon, showing the sun nearly due south and about 70 degrees above the horizon." width="1200" height="833" loading="lazy"><figcaption>Split waterfront, 21 June 2026, at solar noon. Map: © OpenStreetMap contributors · Protomaps.</figcaption></figure>
      <h2>Plan a sunrise or sunset in three steps</h2><ol><li><strong>Put the pin where you will stand.</strong> A viewpoint on the other side of a bay may have a very different foreground.</li><li><strong>Choose your date.</strong> The sunrise and sunset directions move through the year. East and west are only rough shortcuts.</li><li><strong>Select Sunrise or Sunset.</strong> Follow the corresponding ray on the map and compare it with the coastline, street or landmark you want in view.</li></ol>
      <p>Move the time a little earlier or later to see how the bearing changes. For a photograph, this helps you distinguish a view facing into the sun from one lit from the side. For a walk, it helps you choose which way to face at a scenic stop.</p>
      <div class="site-actions">${example(summer, "Explore the Split example")}</div>
      <h2>Solar noon is not always 12:00</h2><p>Solar noon is when the sun reaches its highest altitude that day. Your longitude, the time zone, daylight saving and the changing relationship between clock time and solar time affect the displayed hour. In Split on 21 June 2026 it is about 12:56 local time; on 21 December it is about 11:52.</p><p>The sun is often south of an observer in the Northern Hemisphere and north in the Southern Hemisphere at noon. In the tropics, that direction can change with the season. Read the actual bearing for your pin instead of applying a rule everywhere.</p>
      <h2>Golden light and the actual view</h2><p>Open More tools, then Shadow &amp; light details, for morning and evening golden-light events. SunCalc uses −4° to +6° solar altitude. Clouds, haze, mountains and nearby buildings can change what you see, so leave time to check the scene.</p>${limit}<p>Near the poles there may be no sunrise or sunset on the chosen day. “No event” is a valid result, not a missing forecast.</p><p>Next: ${link("/guides/shadow-length/", "estimate a shadow’s length")} or ${link("/guides/seasonal-sunlight/", "compare the seasons")}.</p>`,
  },
  {
    path: "/guides/shadow-length/", title: "Shadow Length Calculator: Height, Angle & Direction | SunCalc.app",
    description: "Estimate an upright object’s shadow from its height and the sun’s altitude. Worked examples explain the formula and the limits of level-ground estimates.",
    heading: "How long will the shadow be?", kicker: "Guide 02 · Shadow length", updated: "2026-11-23",
    content: `<p class="site-lead">A low sun casts a long shadow. With an object’s height and the sun’s altitude, you can put a number on it.</p>
      <h2>The level-ground calculation</h2><p>For an upright object on level ground:</p><p class="site-formula">shadow length = object height ÷ tan(sun altitude)</p><p>Use the same unit for the object and the result. For example, a 2 m post with the sun 45° above the horizon casts a 2 m shadow. At 30°, it casts about 3.5 m; at 10°, about 11.3 m. The relevant angle is altitude above the horizon, not the compass bearing.</p>
      <figure><img src="/images/shadow-length.webp" alt="SunCalc shadow ruler for a 2 metre post in Split in December: about 4.7 metres at solar noon." width="1200" height="833" loading="lazy"><figcaption>The same 2 m post casts a much longer shadow under the December sun. Map: © OpenStreetMap contributors · Protomaps.</figcaption></figure>
      <h2>Try it in SunCalc</h2><ol><li>Choose the location and date, then move to the time you want to check.</li><li>Select the height beside Your shadow and enter the upright object’s height in metres.</li><li>Read the estimated length and direction. Open More tools → Shadow &amp; light details, then choose Show shadow on map to see the ground-level projection.</li></ol>
      <p>The shadow points opposite the sun: add 180° to the sun’s bearing and wrap around at 360°. A sun due south casts a shadow north. At night, the app shows “No direct shadow” because this calculation concerns direct sunlight.</p>
      <div class="site-actions">${example(winter, "Try the December shadow")}</div>
      <h2>A worked seasonal comparison</h2><p>At the Split waterfront on 21 June 2026, solar noon is about 12:56 local time and the sun’s altitude is about 69.9°. A 2 m post casts a shadow of about 0.7 m. On 21 December, solar noon is about 11:52, the altitude is about 23.1°, and the shadow is about 4.7 m.</p><p>Comparing solar noon keeps the example tied to each day’s highest sun. Comparing an identical clock hour is a different question, especially when daylight saving changes.</p>
      <h2>Limits of the estimate</h2><p>This is useful for understanding a pole, an upright person, or a simple vertical edge on flat ground. Sloping ground changes where the shadow meets the surface. A roof, tree canopy or irregular building needs more geometry than a single height.</p><p>SunCalc does not detect nearby obstacles or calculate a garden’s shaded area. It also does not account for cloud cover or scattered light. As the sun approaches the horizon, the ideal length grows rapidly and becomes less useful as a practical prediction.</p><p>For a real site, compare the estimate with an observed shadow and note any slope or obstruction. ${link("/guides/seasonal-sunlight/", "Learn why the seasons change the result")}.</p>`,
  },
  {
    path: "/guides/seasonal-sunlight/", title: "Summer vs Winter Sunlight: Compare Sun Paths & Shadows | SunCalc.app",
    description: "Compare seasonal sun altitude, day length and shadows at the same location. A Split example shows why winter sunlight reaches places differently.",
    heading: "Same place. A different season.", kicker: "Guide 03 · Seasonal sunlight", updated: "2026-11-23",
    content: `<p class="site-lead">A sunny place in June can feel very different in December. The sun’s path changes its height, direction and time above the horizon.</p>
      <h2>Compare three things</h2><ul><li><strong>Day length:</strong> the interval between sunrise and sunset.</li><li><strong>Sun altitude:</strong> a higher sun produces shorter shadows from the same upright object.</li><li><strong>Sunrise and sunset bearings:</strong> the sun meets different parts of the horizon through the year.</li></ul><p>For the Northern Hemisphere, the June solstice is near the longest day and the December solstice near the shortest. In the Southern Hemisphere, the seasons are reversed. Near the equator, changes in day length are smaller; within the polar circles, continuous daylight or night can occur.</p>
      <h2>A comparison on the Split waterfront</h2><p>These values use the same pin, a clear level horizon and a 2 m upright post. Times are local to Split.</p><div class="site-table-wrap" role="region" aria-label="Seasonal sunlight comparison" tabindex="0"><table><caption>Split, Croatia · 43.5083° N, 16.4383° E · 2026</caption><thead><tr><th scope="col">At the pin</th><th scope="col">21 June</th><th scope="col">21 December</th></tr></thead><tbody><tr><th scope="row">Sunrise</th><td>05:13</td><td>07:23</td></tr><tr><th scope="row">Sunset</th><td>20:38</td><td>16:20</td></tr><tr><th scope="row">Daylight, rounded</th><td>15 h 26 min</td><td>8 h 57 min</td></tr><tr><th scope="row">Solar noon</th><td>12:56 (UTC+02:00)</td><td>11:52 (UTC+01:00)</td></tr><tr><th scope="row">Noon sun altitude</th><td>69.9°</td><td>23.1°</td></tr><tr><th scope="row">Noon shadow of a 2 m post</th><td>0.7 m</td><td>4.7 m</td></tr></tbody></table></div>
      <div class="site-actions">${example(summer, "Open June at solar noon")}${example(winter, "Open December at solar noon")}</div>
      <h2>Compare your own location</h2><ol><li>Find your place or place the pin on the map.</li><li>Open More tools and choose Compare seasons to compare the solstice dates. Select either date to see its path on the map.</li><li>Use the date control to explore the exact days you care about. Check sunrise, noon and sunset, and move between them.</li></ol><p>For a balcony or garden, note which direction an open view faces and which obstacles you can actually see. The map helps you follow the incoming light; it cannot tell whether a neighbouring wall blocks it.</p>
      <h2>Choose a comparison that answers your question</h2><p>If you want to compare the highest sun and shortest shadow, use solar noon on each date. If you want to know the direction of light during lunch, compare the same local clock time instead. A daylight-saving change can shift the relationship between clock time and the sun by an hour.</p><p>You can save a place and revisit it later, or share a precise date and time with someone else. The year and time are included in an example link, so it always opens the example rather than silently changing to today.</p>
      <h2>Use the map as a starting point</h2>${limit}<p>For a site decision, combine the calculated direction with photographs or observations from the actual location. For another example, ${link("/guides/shadow-length/", "try the shadow ruler")}.</p>`,
  },
];

export function metadata(page) {
  const url = origin + page.path;
  const schema = page.path === "/" ? {
    "@context": "https://schema.org", "@graph": [
      { "@type": "WebSite", "@id": origin + "/#website", name: "SunCalc.app", url: origin + "/", inLanguage: "en" },
      { "@type": "WebApplication", "@id": origin + "/#application", name: "SunCalc.app", url: origin + "/", description: page.description, applicationCategory: "UtilitiesApplication", operatingSystem: "Any with a modern web browser", browserRequirements: "JavaScript enabled", creator: { "@type": "Person", name: "Matija Radeljak" } },
    ],
  } : { "@context": "https://schema.org", "@type": "WebPage", name: page.title, description: page.description, url, inLanguage: "en", dateModified: page.updated, isPartOf: { "@id": origin + "/#website" } };
  return `<title>${escapeHTML(page.title)}</title>
    <meta name="description" content="${escapeHTML(page.description)}">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="SunCalc.app">
    <meta property="og:title" content="${escapeHTML(page.title)}">
    <meta property="og:description" content="${escapeHTML(page.description)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${origin}/images/social-card.png">
    <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="SunCalc.app — sun position and shadow planning without an account">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHTML(page.title)}">
    <meta name="twitter:description" content="${escapeHTML(page.description)}">
    <meta name="twitter:image" content="${origin}/images/social-card.png">
    <meta name="twitter:image:alt" content="SunCalc.app — sun position and shadow planning without an account">
    <script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>`;
}
export const footer = `<footer class="site-footer"><a class="site-brand" href="/">SunCalc.app</a><nav aria-label="Site"><a href="/guides/">Guides</a><a href="/about/">About</a><a href="/about/#privacy">Privacy</a><a href="${repository}">Source on GitHub</a></nav><p>An independent project by Matija Radeljak.</p></footer>`;
export function documentHTML(page) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="#F8F6EC"><script src="/appearance-boot.js"></script><link rel="stylesheet" href="/brand/palette.css"><link rel="stylesheet" href="/site.css"><link rel="preload" href="/brand/bricolage.woff2" as="font" type="font/woff2" crossorigin><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon-180.png">${metadata(page)}</head><body class="site-document"><a class="site-skip" href="#content">Skip to content</a><header class="site-header"><a class="site-brand" href="/"><img src="/icon.svg" width="36" height="36" alt="">SunCalc.app</a><nav aria-label="Primary"><a href="/guides/"${page.path.startsWith("/guides/") ? ' aria-current="' + (page.path === "/guides/" ? "page" : "true") + '"' : ""}>Guides</a><a class="site-button" href="/">Open planner <span aria-hidden="true">↗</span></a></nav></header><main class="site-article" id="content" tabindex="-1"><p class="site-kicker">${page.kicker}</p><h1>${page.heading}</h1>${page.content}<p class="site-updated">Updated <time datetime="${page.updated}">${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(page.updated + "T12:00:00Z"))}</time> · ${link("/about/", "Matija Radeljak")}</p><div class="site-actions">${link("/", "Open the planner ↗", "site-button")}${page.path !== "/guides/" ? link("/guides/", "All guides") : ""}</div></main>${footer}</body></html>`;
}
export const sitemap = () => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${origin}${p.path}</loc><lastmod>${p.updated}</lastmod></url>`).join("\n")}\n</urlset>\n`;
export const robots = `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
