# Building a sun planner that opens straight into the map

*Draft by Matija Radeljak, for manual publication alongside SunCalc.app.*

I wanted a sun planner that answered a small set of questions quickly: where
will the light come from, when will the sun set, and how long will a shadow be?
SunCalc.app opens into the working map. The explanation lives below the planner
and in separate guides, so it is available when someone needs it.

## A precise moment in a link

A useful plan needs a place and a time. The app puts latitude, longitude,
an ISO timestamp and a place label in the URL fragment, after the `#`.
Browsers do not send that fragment in HTTP requests. A recipient can open the
same moment, while the server receives the page request without the precise
shared pin or time.

This is not secrecy: anyone with the link can read it, and maps still need tile
requests that identify an area. It avoids storing an additional collection of
personal plans on the server. Saved places stay in local storage.

Adding links to the explanation revealed a boundary: not every fragment is a
plan. An anchor such as `#learn` must move the reader without resetting their
chosen time. The parser now distinguishes valid plans from page navigation.

## The clock belongs to the place

The displayed time is local to the pin, including daylight saving. A civil day
can contain 23 or 25 hours, so the slider follows the actual interval between
that location's two midnights. Both instances of a repeated autumn hour can be
selected. Polar days can legitimately contain no sunrise or sunset.

Astronomy Engine supplies the solar calculations. Tests include independent
US Naval Observatory references, both daylight-saving transitions, polar
conditions and a fractional-offset time zone. Those checks are more useful
than checking one calculation against another copy of itself.

## A small shadow model, explained

The shadow ruler divides an upright object's height by the tangent of the sun's
altitude. It assumes level ground. At 45°, the shadow has the same length as the
object's height. Near the horizon, the result grows rapidly.

At solar noon on the Split waterfront, a 2 m post casts about a 0.7 m shadow on
21 June 2026 and 4.7 m on 21 December. That is a useful seasonal comparison,
but it is not a simulation of the shaded area behind a building. Trees, terrain,
building outlines and weather are outside the model. The interface and guides
say so because a precise-looking line can suggest more than it knows.

## Offline use without caching the whole world

The app caches its shell, solar code and a bounded amount of recently viewed
map and search data. Calculations continue offline; unvisited detailed maps need
a connection. Maps, fonts and browser scripts are served first-party.

The guides are lightweight HTML pages and do not load the map bundle. They
also retain their own URLs and errors: a failed guide request must not silently
become the cached planner under the guide's address. The service worker falls
back to the planner only for the planner URL after a network failure. Real 404
and 503 responses keep their status.

## Making the explanation discoverable

Search engines can render JavaScript, but an empty app mount gives them little
to work with immediately. The homepage now includes real explanatory HTML,
canonical metadata, a social card and a sitemap. Three guides answer specific
questions about sun direction, shadow length and seasonal changes.

A visitor can use the planner at once, or scroll to an example and learn how to
interpret it. The code is MIT licensed:
https://github.com/matijarma/suncalc.app

SunCalc.app is an independent project, not affiliated with SunCalc.org,
SunCalc.net or the SunCalc JavaScript library. The hosted app is free during
preview; the planned release is 30 full days followed by €1 once per browser
installation, with today's sunrise and sunset remaining free.

Try it: https://suncalc.app/
