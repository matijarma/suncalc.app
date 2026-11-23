export function searchResponse(request: Request, response: Response) {
  if (response.status === 404 && request.headers.get("Accept")?.includes("text/html")) {
    const headers = new Headers(response.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    response = new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex"><title>Page not found · SunCalc.app</title><link rel="stylesheet" href="/brand/palette.css"><link rel="stylesheet" href="/site.css"></head><body class="site-document"><main class="site-article"><p class="site-kicker">404 · SunCalc.app</p><h1>That page isn’t here.</h1><p>You can open the planner or find an explanation in the guides.</p><div class="site-actions"><a class="site-button" href="/">Open the planner</a><a href="/guides/">Read the guides</a></div></main></body></html>`, { status: 404, headers });
  }
  if (new URL(request.url).hostname === "suncalc.app") return response;
  // Preview runs the Worker first, including static assets. Never index it.
  const preview = new Response(response.body, response);
  preview.headers.set("X-Robots-Tag", "noindex, nofollow");
  return preview;
}
