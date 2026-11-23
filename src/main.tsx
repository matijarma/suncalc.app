import { startUsage, counted } from "./usage";
import {android,native} from "./android/bridge";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Map as GLMap } from "maplibre-gl";
import {
  Sun,
  Contrast,
  Search,
  Bookmark,
  Share2,
  ChevronRight,
  CalendarDays,
  Layers2,
  ArrowUpRight,
  MapPin,
  LocateFixed,
  Check,
  Ruler,
  ArrowRight,
} from "lucide-preact";
import Atlas from "./Atlas";
import { ClockFace } from "./ClockFace";
import { ShadowRuler } from "./ShadowRuler";
import { useAppearance } from "./appearance";
import { Preferences } from "./Preferences";
import { DateSheet, TimeSheet, HeightSheet } from "./PlanningSheets";
import { Modal } from "./Modal";
import {
  SPLIT,
  clock,
  solarDay,
  sun,
  zoneAt,
  dayAt,
  atClock,
  direction,
  duration,
  shadow,
  validSpot,
  type Spot,
} from "./solar";
import { read, write, shareURL, initial, sharedPlan, coordinates } from "./storage";
import { find, type Result } from "./search";
import { settings, post, initialAccess, persist, type Access } from "./access";
import "./style.css";
type Panel =
  | "settings"
  | "more"
  | "height"
  | "date"
  | "time"
  | "search"
  | "saved"
  | "share"
  | "compare"
  | "details"
  | "about"
  | "access"
  | null;
const fmtDate = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en", { ...opts, timeZone: "UTC" }).format(
    new Date(date + "T12:00Z"),
  );
const numeric = (n: number) => n.toFixed(4);
export function App({androidAccess,liveShadow}:{androidAccess?:()=>void; liveShadow?:()=>void}) {
  useEffect(() => { if(!android) return startUsage(); }, []);
  const appearance = useAppearance();
  const boot = useMemo(initial, []),
    [p, setP] = useState(boot.p),
    [ms, setMs] = useState(boot.ms),
    [example, setExample] = useState(boot.example),
    [panel, open] = useState<Panel>(null),
    [notice, setNotice] = useState(""),
    [offline, setOffline] = useState(!navigator.onLine);
  const [saved, setSaved] = useState<Spot[]>(() => {
      const a = read<unknown>("saved", []);
      return Array.isArray(a) ? a.filter(validSpot) : [];
    }),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<Result[]>([]),
    [lookup, setLookup] = useState(false),
    [searchState, setSearchState] = useState("");
  const [showShadow, setShowShadow] = useState(false),
    [height, setHeight] = useState(() => {
      const h = read<number>("height", 2);
      return Number.isFinite(h) && h >= 0.1 && h <= 10000 ? h : 2;
    }),
    [access, setAccess] = useState<Access>(initialAccess),
    [recovery, setRecovery] = useState(""),
    [busy, setBusy] = useState(false);
  const map = useRef<GLMap | null>(null),
    trial = useRef<Promise<void> | null>(null),
    searchInput = useRef<HTMLInputElement>(null),
    addressGeneration = useRef(0);
  const locked =
    access.mode === "live" &&
    !access.paid &&
    !!access.until &&
    access.until <= Date.now();
  const zone = useMemo(() => zoneAt(p), [p.lat, p.lon]),
    date = dayAt(locked ? Date.now() : ms, zone),
    d = useMemo(() => solarDay(p, date, zone), [p.lat, p.lon, date, zone]),
    current = useMemo(() => sun(p, ms), [p.lat, p.lon, ms]);
  const isSaved = saved.some((v) => v.lat === p.lat && v.lon === p.lon),
    notify = (s: string) => setNotice(s);
  const changeAccess = (a: Access) => setAccess(persist(a));
  async function refreshOrder(ref: string) {
    try {
      const x = await post("confirm", { ref }, true);
      if (x.paid) {
        changeAccess({ ...x, mode: "live" });
        write("pending", "");
        open("access");
        history.replaceState(null, "", location.pathname + location.hash);
      } else if (x.status === "FAILED" || x.status === "EXPIRED") {
        write("pending", "");
        notify("Payment was not completed.");
      } else notify("Payment is pending. You can check it again in Access.");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  useEffect(() => {
    let active = true;
    (android ? native<{mode:"preview";addressLookup:boolean}>("config").then(c=>({...c,mode:"preview" as const})) : settings())
      .then(async (c) => {
        if (!active) return;
        setLookup(c.addressLookup);
        const old = initialAccess();
        if (c.mode === "preview") {
          changeAccess({ ...old, mode: "preview" });
          return;
        }
        changeAccess({ ...old, mode: "live" });
        if (read("install", "")) {
          const a = await post("status", {}, true);
          if (active) changeAccess({ ...old, ...a });
        }
        const ref =
          new URLSearchParams(location.search).get("order") ||
          read<string>("pending", "");
        if (ref && active) await refreshOrder(ref);
      })
      .catch(() => {});
    const net = () => {
      setOffline(!navigator.onLine);
      if (android && navigator.onLine) native<{addressLookup:boolean}>("config").then(c=>{if(active)setLookup(c.addressLookup)}).catch(()=>{});
    };
    addEventListener("online", net);
    addEventListener("offline", net);
    return () => {
      active = false;
      removeEventListener("online", net);
      removeEventListener("offline", net);
    };
  }, []);
  useEffect(() => {
    const shared = () => {
      const v = sharedPlan(location.hash);
      if (!v) return;
      setP(v.p);
      setMs(v.ms);
      setExample(v.example);
      open(null);
      const planner = document.getElementById("planner-content");
      planner?.scrollIntoView({ block: "start" });
      planner?.focus({ preventScroll: true });
    };
    addEventListener("hashchange", shared);
    return () => removeEventListener("hashchange", shared);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (locked) {
      setMs(Date.now());
      setExample(false);
    }
  }, [locked]);
  useEffect(() => {
    if (panel === "search") {
      const i = setTimeout(() => searchInput.current?.focus(), 30);
      return () => clearTimeout(i);
    }
  }, [panel]);
  useEffect(() => {
    const abort = new AbortController();
    addressGeneration.current++;
    setResults([]);
    setSearchState("");
    if (panel === "search" && query.trim().length >= 2) {
      setSearchState("Searching…");
      find(query, map.current, abort.signal)
        .then((r) => {
          if (!abort.signal.aborted) {
            setResults(r);
            setSearchState(
              r.length ? "" : "No local matches. Try a town or coordinates.",
            );
          }
        })
        .catch(() => {
          if (!abort.signal.aborted)
            setSearchState(
              "Town index unavailable here. Try coordinates or the map.",
            );
        });
    }
    return () => abort.abort();
  }, [panel, query]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open("search");
      }
    };
    addEventListener("keydown", fn);
    return () => removeEventListener("keydown", fn);
  }, []);
  function activate() {
    if (locked) {
      open("access");
      return false;
    }
    if (
      access.mode === "live" &&
      !access.until &&
      !access.paid &&
      !trial.current
    ) {
      trial.current = post("start", {}, true)
        .then((a) => changeAccess(a))
        .catch(() => notify("Trial registration will retry when online."))
        .finally(() => {
          trial.current = null;
        });
    }
    return true;
  }
  function time(t: number, kind: "time" | "date" = "time") {
    if (activate() && Number.isFinite(t)) {
      counted(kind);
      setMs(t);
      if (location.hash)
        history.replaceState(null, "", location.pathname + location.search);
    }
  }
  function pick(v: Spot) {
    if (!validSpot(v)) return;
    counted("place");
    if (!locked) activate();
    setP(v);
    write("last", v);
    setExample(false);
    if (locked) setMs(Date.now());
    open(null);
    setQuery("");
    if (location.hash)
      history.replaceState(null, "", location.pathname + location.search);
  }
  function dateTo(s: string) {
    if (!s || s < "1900-01-01" || s > "2100-12-31") return;
    try {
      time(atClock(s, clock(ms, zone), zone), "date");
    } catch {}
  }
  function save() {
    if (!activate()) return;
    if (!isSaved) counted("save");
    const a = isSaved
      ? saved.filter((v) => v.lat !== p.lat || v.lon !== p.lon)
      : [p, ...saved];
    setSaved(a);
    write("saved", a);
    notify(isSaved ? "Place removed" : "Place saved on this device");
  }
  function gps() {
    if(android){ native<{lat:number;lon:number}>("location").then(v=>pick({lat:v.lat,lon:v.lon,name:"My location"})).catch(e=>notify(e.message)); return; }
    if (!navigator.geolocation) {
      notify("Location is unavailable. Search for a place instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        pick({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          name: "My location",
        }),
      () =>
        notify("Location was not available. You can search or tap the map."),
      { timeout: 12000, maximumAge: 120000 },
    );
  }
  async function address() {
    const gen = ++addressGeneration.current;
    setSearchState("Looking up address…");
    try {
      const a = android ? await native<{places:Spot[]}>("address",{q:query}) : await post("address", { q: query });
      if (gen !== addressGeneration.current) return;
      setResults(
        a.places.map((v: Spot) => ({
          ...v,
          detail: "Address lookup · Geoapify",
        })),
      );
      setSearchState(
        a.places.length ? "" : "No address matches. Try adding a city.",
      );
    } catch (e) {
      if (gen === addressGeneration.current)
        setSearchState((e as Error).message);
    }
  }
  async function checkout() {
    setBusy(true);
    try {
      await post("start", {}, true);
      const o = await post("checkout", {}, true);
      write("pending", o.ref);
      location.assign(o.url);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    setBusy(true);
    try {
      await post("start", {}, true);
      const a = await post("restore", { code: recovery }, true);
      changeAccess({ ...a, recovery: recovery.replace(/[\s-]/g, "") });
      notify("Lifetime access restored");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const sh = shadow(height, current.alt),
    openTool = (v: Panel) => {
      if (activate()) {
        if (v === "compare") counted("seasons");
        if (v === "height" || v === "details") counted("shadow");
        open(v);
      }
    },
    coord =
      numeric(Math.abs(p.lat)) +
      "° " +
      (p.lat >= 0 ? "N" : "S") +
      "  ·  " +
      numeric(Math.abs(p.lon)) +
      "° " +
      (p.lon >= 0 ? "E" : "W");
  const compare = useMemo(
    () =>
      panel === "compare"
        ? [6, 12].map((m) =>
            solarDay(
              p,
              date.slice(0, 4) + "-" + String(m).padStart(2, "0") + "-21",
              zone,
            ),
          )
        : [],
    [panel, p, date, zone],
  );
  const href = shareURL(p, ms),
    placeResult = (v: Result) => (
      <button class="result" onClick={() => pick(v)}>
        <MapPin size={18} />
        <span>
          <strong>{v.name}</strong>
          <small>{v.detail}</small>
        </span>
        <ArrowUpRight size={15} />
      </button>
    );
  return (
    <>
      <a
        class="skip"
        href="#planner-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("planner-content")?.focus();
        }}
      >
        Skip to planner
      </a>
      <section class="planner" id="planner-content" aria-label="Sun and shadow planner" tabIndex={-1}>
        <header class="appbar">
          <a class="logo-link" href="/" aria-label="SunCalc home">
            <img
              class="brand-tile"
              src="/icon.svg"
              alt=""
              width="41"
              height="41"
            />
            <span class="wordmark" aria-hidden="true" />
          </a>
          <nav aria-label="Planner tools">
            <button
              class="action"
              aria-label="Find a place or coordinates"
              title="Find a place"
              onClick={() => open("search")}
            >
              <Search size={20} />
              <span>Find place</span>
            </button>
            <button
              class="action"
              aria-label="Saved places"
              title="Saved places"
              onClick={() => openTool("saved")}
            >
              <Bookmark size={19} />
              <span>Saved places</span>
            </button>
            <button
              class="action"
              aria-label="Share plan"
              title="Share plan"
              onClick={() => open("share")}
            >
              <Share2 size={19} />
              <span>Share plan</span>
            </button>
            <button
              class="action"
              aria-label="Appearance and settings"
              title="Appearance and settings"
              onClick={() => open("settings")}
            >
              <Contrast size={20} />
            </button>
          </nav>
        </header>
        <ClockFace
          spot={p}
          day={d}
          ms={ms}
          current={current}
          example={example}
          saved={isSaved}
          locked={locked}
          pick={() => open("search")}
          save={save}
          date={() => openTool("date")}
          time={() => openTool("time")}
          change={time}
          access={androidAccess ? ()=>{open(null);androidAccess()} : ()=>open("access")}
        />
        <Atlas
          p={p}
          day={d}
          ms={ms}
          offline={offline}
          scheme={appearance.scheme}
          shadowHeight={showShadow && !locked ? height : null}
          locked={locked}
          onGPS={gps}
          onPin={pick}
          onMap={(m) => {
            map.current = m;
          }}
        />
        {!locked ? (
          <ShadowRuler
            height={height}
            length={sh}
            az={current.az}
            edit={() => openTool("height")}
            more={() => openTool("more")}
            liveShadow={liveShadow}
          />
        ) : (
          <div class="shadowcard locked-basics">
            <span class="over">At this pin</span>
            <p>{duration(d.light)} of daylight today.</p>
            <button class="chip" onClick={() => open("access")}>
              Access &amp; restore
            </button>
          </div>
        )}
      </section>
      {notice && !panel && (
        <div class="toast" role="status">
          {notice}
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
      {panel && (
        <Modal
          title={
            {
              settings: "Appearance & settings",
              more: "At this pin",
              date: "Planning date",
              time: "Local time",
              height: "Object height",
              search: "Find a place",
              saved: "Saved places",
              share: "Share this moment",
              compare: "Compare seasons",
              details: "Shadow & light",
              about: "About the atlas",
              access: "Your access",
            }[panel]
          }
          onClose={() => open(null)}
        >
          {panel === "settings" && liveShadow && <button class="result" onClick={()=>{open(null);liveShadow()}}>Live Shadow · compass</button>}
          {panel === "settings" && (
            <Preferences
              appearance={appearance}
              access={androidAccess ? ()=>{open(null);androidAccess()} : ()=>open("access")}
              about={() => open("about")}
            />
          )}
          {panel === "date" && (
            <DateSheet
              day={date}
              zone={zone}
              set={(v) => {
                dateTo(v);
                open(null);
              }}
            />
          )}
          {panel === "time" && (
            <TimeSheet
              ms={ms}
              zone={zone}
              set={(v) => {
                time(v);
                open(null);
              }}
            />
          )}
          {panel === "height" && (
            <HeightSheet
              height={height}
              set={(v) => {
                setHeight(v);
                write("height", v);
                open(null);
              }}
            />
          )}
          {panel === "more" && (
            <>
              <p class="muted">
                <strong>{p.name}</strong> · {duration(d.light)} of daylight.
                <br />
                {coord} · {zone.replaceAll("_", " ")}
              </p>
              <button class="result" onClick={() => openTool("compare")}>
                <Layers2 size={18} />
                <span>Compare seasons</span>
                <ChevronRight size={16} />
              </button>
              <button class="result" onClick={() => openTool("details")}>
                <Ruler size={18} />
                <span>Shadow &amp; light details</span>
                <ChevronRight size={16} />
              </button>
              <button
                class="result"
                onClick={() => {
                  time(Date.now());
                  open(null);
                }}
              >
                <Sun size={18} />
                <span>Return to now</span>
                <ChevronRight size={16} />
              </button>
            </>
          )}
          {panel === "search" && (
            <>
              <label class="query">
                <Search size={18} />
                <input
                  ref={searchInput}
                  data-autofocus
                  placeholder="Town, street on this map, or coordinates"
                  aria-label="Search places"
                  value={query}
                  onInput={(e) => {
                    setResults([]);
                    setQuery(e.currentTarget.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const direct = coordinates(e.currentTarget.value);
                      if (direct || results[0]) {
                        e.preventDefault();
                        pick(direct ?? results[0]);
                      }
                    }
                  }}
                />
              </label>
              {query.length < 2 ? (
                <>
                  <button class="result" onClick={gps}>
                    <LocateFixed size={18} />
                    <span>Use my location</span>
                    <ArrowRight size={16} />
                  </button>
                  <span class="kicker block">EXPLORE</span>
                  {[
                    SPLIT,
                    { name: "Tromsø", lat: 69.65, lon: 18.96 },
                    { name: "Kyoto", lat: 35.0116, lon: 135.7681 },
                  ].map((v) => placeResult({ ...v, detail: "Map pin" }))}
                </>
              ) : (
                results.map(placeResult)
              )}
              <p class="muted" role="status">
                {searchState}
              </p>
              {query.trim().length >= 3 && (
                <div class="hint">
                  <small>
                    {lookup
                      ? "Only this submitted text is sent to Geoapify."
                      : "Worldwide address lookup is not connected. Towns, coordinates, and this map are available."}
                  </small>
                  {lookup && (
                    <button class="chip" onClick={address}>
                      Look up address <ArrowUpRight size={13} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {panel === "saved" && (
            <>
              {saved.length ? (
                saved.map((v) =>
                  placeResult({ ...v, detail: "Saved on this device" }),
                )
              ) : (
                <p>
                  Your saved places will appear here. Use the bookmark beside a
                  place name to keep it.
                </p>
              )}
            </>
          )}
          {panel === "share" && (
            <>
              <p>
                Open <strong>{p.name}</strong> at {clock(ms, zone)} on {date}.
                The link contains the pin and time only.
              </p>
              <input
                class="field"
                aria-label="Share link"
                readOnly
                value={href}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                class="primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(href);
                    counted("share");
                    notify("Link copied");
                  } catch {
                    notify("Select and copy the link above.");
                  }
                }}
              >
                Copy link
              </button>
              {android && <button class="chip" onClick={()=>native("share",{url:href}).catch(e=>notify(e.message))}>Share…</button>}
              {!android && !!navigator.share && (
                <button
                  class="chip"
                  onClick={() =>
                    navigator
                      .share({ title: "SunCalc · " + p.name, url: href })
                      .then(() => counted("share"))
                      .catch(() => {})
                  }
                >
                  Share…
                </button>
              )}
            </>
          )}
          {panel === "compare" && (
            <>
              <p>
                Two days at <strong>{p.name}</strong>, with the same clear
                horizon.
              </p>
              {compare.map((v) => (
                <button
                  class="season"
                  onClick={() => {
                    dateTo(v.day);
                    open(null);
                  }}
                >
                  <CalendarDays size={20} />
                  <div>
                    <strong>
                      {fmtDate(v.day, { month: "long", day: "numeric" })}
                    </strong>
                    <small>
                      {v.rise ? clock(v.rise, zone) : "No sunrise"} →{" "}
                      {v.set ? clock(v.set, zone) : "No sunset"}
                    </small>
                  </div>
                  <b>{duration(v.light)}</b>
                  <ChevronRight size={15} />
                </button>
              ))}
              <small class="muted">
                Choose a date to see its path on the map.
              </small>
            </>
          )}
          {panel === "details" && (
            <>
              <p>
                For a vertical object on level ground at{" "}
                <strong>{clock(ms, zone)}</strong>.
              </p>
              <label class="form-label">
                Object height (metres)
                <input
                  class="field"
                  type="number"
                  min=".1"
                  max="10000"
                  step=".1"
                  value={height}
                  onInput={(e) => {
                    const n = e.currentTarget.valueAsNumber;
                    if (n > 0 && n <= 10000) {
                      setHeight(n);
                      write("height", n);
                    }
                  }}
                />
              </label>
              <div class="callout">
                <Ruler size={19} />
                <strong>
                  {sh === null
                    ? "No direct shadow"
                    : sh.toLocaleString("en", { maximumFractionDigits: 2 }) +
                      " m · " +
                      direction((current.az + 180) % 360)}
                </strong>
              </div>
              <button
                class="chip"
                disabled={sh === null && !showShadow}
                onClick={() => {
                  setShowShadow(!showShadow);
                  open(null);
                }}
              >
                {showShadow ? "Hide shadow on map" : "Show shadow on map"}
              </button>
              {d.events.map((v) => (
                <button
                  class="detail-event"
                  disabled={v.ms === null}
                  onClick={() => {
                    if (v.ms !== null) time(v.ms);
                    open(null);
                  }}
                >
                  {v.label}
                  <b>{v.ms === null ? "No event" : clock(v.ms, zone)}</b>
                </button>
              ))}
              <p class="muted">
                Golden light uses −4° to +6° solar altitude. Buildings, trees,
                weather, and terrain are not modelled.
              </p>
            </>
          )}
          {panel === "about" && android && <><p>SunCalc models sunlight on level ground. Bearings use true north. Terrain, trees, and buildings are not included.</p><p>Map: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · Protomaps · Natural Earth. Towns: <a href="https://www.geonames.org/">GeoNames</a>.</p><button class="chip" onClick={()=>native("privacy")}>Android privacy policy</button></>}
          {panel === "about" && !android && (
            <>
              <p><a href="/about/">About SunCalc.app, privacy and credits</a> · <a href="/guides/">Guides</a></p>
              <p>
                SunCalc shows where sunlight comes from at any pin on Earth.
                Bearings use true north; event times use a clear, level horizon
                and the pin’s local clock.
              </p>
              <h3>Privacy</h3>
              <p>
                No cookies, ads, accounts, or analytics identifiers. We count
                online app opens and which planner tools are used in aggregate.
                A date stored on this browser helps estimate daily active
                browsers; it is not sent. These counts contain no coordinates,
                selected times, search text, shared links, or purchase details.
                Saved places stay in this browser. Map requests go to SunCalc; a
                submitted address goes to Geoapify only if you choose lookup.
                Location access is optional.
              </p>
              <p>
                In the paid release an anonymous installation key records trial
                and purchase status separately from map traffic. Payment takes
                place on the processor’s own site.
              </p>
              <h3>Atlas credits</h3>
              <p>
                <a href="https://www.openstreetmap.org/copyright">
                  OpenStreetMap contributors (ODbL)
                </a>{" "}
                · Protomaps · Natural Earth ·{" "}
                <a href="https://www.geonames.org/">GeoNames (CC BY 4.0)</a> ·
                time zones from timezone-boundary-builder · Astronomy Engine ·
                Bricolage Grotesque (
                <a href="/brand/OFL.txt">SIL Open Font License</a>).
              </p>
            </>
          )}
          {panel === "access" && (
            <>
              {access.mode === "preview" ? (
                <>
                  <p>
                    <strong>The complete atlas is free during preview.</strong>{" "}
                    No trial clock is running and no payment is taken.
                  </p>
                  <p>
                    At launch: 30 full days, then €1 once for this browser
                    installation. Today’s sunrise and sunset stay free.
                  </p>
                </>
              ) : access.paid ? (
                <>
                  <p>
                    <Check size={18} /> Lifetime access is active on this
                    installation.
                  </p>
                  {access.recovery && (
                    <>
                      <p>
                        Keep this private code to restore access after clearing
                        your browser.
                      </p>
                      <code class="recovery">{access.recovery}</code>
                      <a
                        class="primary"
                        href={
                          "data:text/plain;charset=utf-8," +
                          encodeURIComponent(
                            "SunCalc lifetime recovery code\n" +
                              access.recovery,
                          )
                        }
                        download="suncalc-recovery.txt"
                      >
                        Download recovery code
                      </a>
                    </>
                  )}
                </>
              ) : (
                <>
                  <p>
                    {locked
                      ? "Your trial has ended."
                      : access.until
                        ? "Full access until " +
                          new Date(access.until).toLocaleDateString("en") +
                          "."
                        : "Your full 30-day trial begins when you start planning."}{" "}
                    One euro unlocks this installation for life.
                  </p>
                  <button class="primary" disabled={busy} onClick={checkout}>
                    Unlock for €1
                  </button>
                  {read("pending", "") && (
                    <button
                      class="chip"
                      onClick={() => refreshOrder(read("pending", ""))}
                    >
                      Check pending purchase
                    </button>
                  )}
                  <h3>Restore a purchase</h3>
                  <input
                    class="field"
                    placeholder="Private recovery code"
                    aria-label="Recovery code"
                    value={recovery}
                    onInput={(e) => setRecovery(e.currentTarget.value)}
                  />
                  <button
                    class="chip"
                    disabled={busy || !recovery}
                    onClick={restore}
                  >
                    Restore access
                  </button>
                </>
              )}
            </>
          )}
          {notice && (
            <p class="dialog-notice" role="status">
              {notice}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
