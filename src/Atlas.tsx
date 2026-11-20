import { useEffect, useRef, useState } from "preact/hooks";
import type { Map as GLMap } from "maplibre-gl";
import { version } from "maplibre-gl/package.json";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Plus,
  Minus,
  LocateFixed,
  MapPin,
  Navigation,
  Bookmark,
} from "lucide-preact";
import { atlasStyle } from "./map-style";
import { type Spot, type SolarDay, sun, shadow, SPLIT } from "./solar";
type Props = {
  p: Spot;
  day: SolarDay;
  ms: number;
  example: boolean;
  locked: boolean;
  saved: boolean;
  shadowHeight: number | null;
  onPin: (p: Spot) => void;
  onGPS: () => void;
  onSave: () => void;
  onMap: (map: GLMap | null) => void;
};
export default function Atlas(props: Props) {
  const node = useRef<HTMLDivElement>(null),
    frame = useRef<HTMLDivElement>(null),
    map = useRef<GLMap | null>(null),
    current = useRef(props);
  current.current = props;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null),
    [status, setStatus] = useState(""),
    [ready, setReady] = useState(false),
    [painted, setPainted] = useState(false),
    [zoom, setZoom] = useState(15.05);
  useEffect(() => {
    let dead = false,
      resize: ResizeObserver | undefined;
    (async () => {
      try {
        const root = "/maps/lib/" + version + "/",
          gl = (await import(
            /* @vite-ignore */ root + "maplibre-gl.mjs"
          )) as typeof import("maplibre-gl");
        if (dead) return;
        gl.setWorkerUrl(root + "maplibre-gl-worker.mjs");
        const p = current.current.p,
          m = new gl.Map({
            container: node.current!,
            style: atlasStyle(),
            center: [p.lon, p.lat],
            zoom: 15.05,
            minZoom: 1,
            maxZoom: 19,
            attributionControl: false,
            dragRotate: false,
            pitchWithRotate: false,
            maxPitch: 0,
            renderWorldCopies: true,
          });
        map.current = m;
        m.touchZoomRotate.disableRotation();
        m.keyboard.disableRotation();
        const project = () => {
          if (dead) return;
          const pin = current.current.p,
            q = m.project([pin.lon, pin.lat]);
          setPos({ x: q.x, y: q.y });
        };
        project();
        let missing = false;
        m.on("movestart", () => {
          setPainted(true);
          missing = false;
          setStatus("");
        });
        m.on("zoom", () => setZoom(m.getZoom()));
        m.once("idle", () => setPainted(true));
        m.on("move", project);
        m.on("resize", project);
        m.on("load", () => {
          if (dead) return;
          setReady(true);
          project();
          current.current.onMap(m);
        });
        m.on("error", (e: any) => {
          if (dead) return;
          if (
            e.error?.name?.includes("GPU") ||
            !m.getCanvas().getContext("webgl2")
          )
            setStatus(
              "Map graphics unavailable. Search or enter coordinates to plan.",
            );
          else if (e.tile || e.sourceId || Number(e.error?.status) >= 400) {
            missing = true;
            setStatus(
              navigator.onLine
                ? "Map detail unavailable here"
                : "This map area is not cached",
            );
          }
        });
        m.on("sourcedata", (e: any) => {
          if (
            !missing &&
            e.tile?.state === "loaded" &&
            m.areTilesLoaded() &&
            navigator.onLine
          )
            setStatus("");
        });
        m.on("click", (e) => {
          if (current.current.locked) return;
          const ll = e.lngLat.wrap();
          current.current.onPin({
            lat: +ll.lat.toFixed(5),
            lon: +ll.lng.toFixed(5),
            name: "Dropped pin",
          });
        });
        resize = new ResizeObserver(() => {
          m.resize();
          project();
        });
        resize.observe(node.current!);
      } catch {
        if (!dead)
          setStatus(
            "Map graphics unavailable. Search or enter coordinates to plan.",
          );
      }
    })();
    return () => {
      dead = true;
      resize?.disconnect();
      current.current.onMap(null);
      try {
        map.current?.remove();
      } catch {}
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const q = m.project([props.p.lon, props.p.lat]);
    setPos({ x: q.x, y: q.y });
    m.jumpTo({ center: [props.p.lon, props.p.lat] });
  }, [props.p.lat, props.p.lon]);
  const d = props.day,
    p = props.p,
    now = sun(p, props.ms),
    r = 94,
    rad = (v: number) => (v * Math.PI) / 180,
    xy = (az: number, len: number) => [
      Math.sin(rad(az)) * len,
      -Math.cos(rad(az)) * len,
    ];
  const rays = [
    { id: "rise", ms: d.rise },
    { id: "set", ms: d.set },
  ].filter((e) => e.ms !== null);
  const point = (a: number, h: number) => xy(a, r * (1 - Math.max(0, h) / 90));
  const path = d.path
    .map((s, i) =>
      s.alt < 0
        ? ""
        : (i && d.path[i - 1].alt >= 0 ? "L" : "M") +
          point(s.az, s.alt).join(","),
    )
    .join(" ");
  const a = xy(now.az, r + 24),
    pt = point(now.az, now.alt),
    length = props.shadowHeight ? shadow(props.shadowHeight, now.alt) : null,
    shadowPx =
      length === null
        ? null
        : length /
          ((40075016.686 * Math.cos((p.lat * Math.PI) / 180)) /
            (512 * 2 ** zoom)),
    end = xy(now.az + 180, Math.min(2000, shadowPx ?? 0));
  return (
    <section class="mapframe" ref={frame} aria-label="Sun path map">
      <div class="mapcanvas" ref={node} />
      {!painted && p.lat === SPLIT.lat && p.lon === SPLIT.lon && (
        <div class="initial-map" aria-hidden="true" />
      )}
      <div class="place-tag">
        <span class="tag-icon">
          <MapPin size={16} />
        </span>
        <div>
          <small>
            {props.example ? "EXAMPLE LOCATION" : "OBSERVATION POINT"}
          </small>
          <strong>{p.name}</strong>
        </div>
        <button
          title={props.saved ? "Remove saved place" : "Save place"}
          aria-label={props.saved ? "Remove saved place" : "Save place"}
          onClick={props.onSave}
        >
          <Bookmark size={17} fill={props.saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div class="north" aria-label="True north">
        N<Navigation size={18} fill="currentColor" />
      </div>
      <svg class="sun-overlay" aria-hidden="true">
        <g
          style={{
            transform: pos
              ? "translate(" + pos.x + "px," + pos.y + "px)"
              : "translate(50%,50%)",
            display: props.locked ? "none" : undefined,
          }}
        >
          <circle
            r={r}
            fill="rgba(255,250,221,.14)"
            stroke="#455e4f"
            strokeOpacity=".55"
            strokeWidth="1"
          />
          {Array.from({ length: 48 }, (_, i) => {
            const major = i % 4 === 0;
            const [x, y] = xy(i * 7.5, r),
              [u, v] = xy(i * 7.5, r - (major ? 6 : 3));
            return (
              <line
                x1={x}
                y1={y}
                x2={u}
                y2={v}
                stroke="#546657"
                opacity={major ? 0.8 : 0.45}
              />
            );
          })}
          {["N", "E", "S", "W"].map((c, i) => {
            const [x, y] = xy(i * 90, r + 12);
            return (
              <text x={x} y={y + 3} class="dial-letter">
                {c}
              </text>
            );
          })}
          <path
            d={path}
            fill="none"
            stroke="#c1781a"
            strokeWidth="2"
            strokeDasharray="3 3"
          />
          {rays.map((v) => {
            const [x, y] = xy(sun(p, v.ms!).az, r + 44);
            return (
              <g>
                <line
                  x2={x}
                  y2={y}
                  stroke={v.id === "rise" ? "#9b6c17" : "#a65c30"}
                  strokeWidth="1.6"
                  strokeDasharray="5 4"
                />
                <text class="ray-label" x={x} y={y + (y > 0 ? 13 : -5)}>
                  {v.id === "rise" ? "Sunrise" : "Sunset"}
                </text>
              </g>
            );
          })}
          <line
            x2={a[0]}
            y2={a[1]}
            stroke={now.alt >= 0 ? "#bc6c07" : "#566877"}
            strokeWidth="2.5"
            strokeDasharray={now.alt < 0 ? "4 4" : undefined}
          />
          <circle
            cx={pt[0]}
            cy={pt[1]}
            r="7"
            fill={now.alt >= 0 ? "#ffbc45" : "#748795"}
            stroke="#fff9e9"
            strokeWidth="2"
          />
          {shadowPx !== null && (
            <g>
              <line
                x2={end[0]}
                y2={end[1]}
                stroke="#344b54"
                strokeWidth="5"
                strokeLinecap="round"
                opacity=".72"
              />
              <text class="ray-label" x={end[0]} y={end[1] + 17}>
                {length!.toLocaleString("en", { maximumFractionDigits: 1 })} m
                shadow
              </text>
            </g>
          )}
          <circle r="6.5" fill="#244b38" stroke="#fffbee" strokeWidth="2.5" />
        </g>
      </svg>
      {status && (
        <div class="map-status" role="status">
          {status}
        </div>
      )}
      <div class="map-ctrl">
        <button
          aria-label="Use my location"
          title="Use my location"
          onClick={props.onGPS}
        >
          <LocateFixed size={18} />
        </button>
        <div>
          <button
            title="Zoom in"
            aria-label="Zoom in"
            disabled={!ready}
            onClick={() => map.current?.zoomIn()}
          >
            <Plus size={18} />
          </button>
          <button
            title="Zoom out"
            aria-label="Zoom out"
            disabled={!ready}
            onClick={() => map.current?.zoomOut()}
          >
            <Minus size={18} />
          </button>
        </div>
      </div>
      <div class="map-credit">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>{" "}
        · Protomaps
      </div>
    </section>
  );
}
