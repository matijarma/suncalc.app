import { useEffect, useRef, useState } from "preact/hooks";
import type { Map as GLMap } from "maplibre-gl";
import { version } from "maplibre-gl/package.json";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, Minus, LocateFixed, WifiOff, Navigation } from "lucide-preact";
import { atlasStyle, recolorAtlas } from "./map-style";
import type { Scheme } from "./appearance";
import {
  type Spot,
  type SolarDay,
  sun,
  shadow,
  SPLIT,
  direction,
} from "./solar";
type Props = {
  p: Spot;
  day: SolarDay;
  ms: number;
  offline: boolean;
  scheme: Scheme;
  locked: boolean;

  shadowHeight: number | null;
  onPin: (p: Spot) => void;
  onGPS: () => void;

  onMap: (map: GLMap | null) => void;
};
export default function Atlas(props: Props) {
  const node = useRef<HTMLDivElement>(null),
    frame = useRef<HTMLDivElement>(null),
    map = useRef<GLMap | null>(null),
    current = useRef(props);
  current.current = props;
  const paintedScheme = useRef<Scheme | null>(null);
  const [mapWidth, setMapWidth] = useState(500);
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
        const scheme = current.current.scheme;
        paintedScheme.current = scheme;
        const p = current.current.p,
          m = new gl.Map({
            container: node.current!,
            style: atlasStyle(scheme),
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
          missing = false;
          setStatus("");
        });
        // The first idle event can precede the first drawn street tile. Keep the
        // matching offline plate visible until the live map has real geometry.
        const reveal = () => {
          if (
            dead ||
            !m.isStyleLoaded() ||
            !m.queryRenderedFeatures({
              layers: ["sea", "buildings", "road-fill"],
            }).length
          )
            return;
          m.off("render", reveal);
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              if (!dead) setPainted(true);
            }),
          );
        };
        m.on("render", reveal);
        m.on("zoom", () => setZoom(m.getZoom()));
        m.on("move", () => {
          const center = m.getCenter();
          if (
            Math.abs(center.lat - SPLIT.lat) > 0.00001 ||
            Math.abs(center.lng - SPLIT.lon) > 0.00001 ||
            Math.abs(m.getZoom() - 15.05) > 0.001
          )
            setPainted(true);
          project();
        });
        m.on("resize", () => {
          setMapWidth(node.current?.clientWidth ?? 500);
          project();
        });
        setMapWidth(node.current?.clientWidth ?? 500);
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
  useEffect(() => {
    const m = map.current;
    if (ready && m && paintedScheme.current !== props.scheme) {
      recolorAtlas(m, props.scheme);
      paintedScheme.current = props.scheme;
    }
  }, [props.scheme, ready]);
  const d = props.day,
    p = props.p,
    now = sun(p, props.ms),
    r = 89,
    scale = Math.min(680, mapWidth * (mapWidth < 520 ? 0.97 : 0.66)) / 350,
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
  const a = xy(now.az, 106),
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
          <g
            transform={`scale(${scale})`}
            class="sun-dial"
            data-down={now.alt <= 0 ? "true" : "false"}
          >
            <circle class="disc" r={r} />
            <g class="dial-ticks">
              {Array.from({ length: 36 }, (_, i) => {
                const [x, y] = xy(i * 10, r),
                  [u, v] = xy(i * 10, i % 3 === 0 ? 82 : 86);
                return <path key={i} d={`M${x} ${y}L${u} ${v}`} />;
              })}
            </g>
            <path class="skytrail" d={path} />
            {rays.map((v) => {
              const [x, y] = xy(sun(p, v.ms!).az, 97);
              return (
                <g key={v.id}>
                  <path class="guide-ray" d={`M0 0L${x} ${y}`} />
                  {mapWidth > 650 && (
                    <text class="ray-label" x={x} y={y + (y > 0 ? 10 : -4)}>
                      {v.id === "rise" ? "Sunrise" : "Sunset"}
                    </text>
                  )}
                </g>
              );
            })}
            <g class="current-ray">
              <path class="ray-edge" d={`M0 0L${a[0]} ${a[1]}`} />
              <path class="ray" d={`M0 0L${a[0]} ${a[1]}`} />
              <circle class="sun-dot" cx={a[0]} cy={a[1]} r="5.7" />
            </g>
            <g
              class="bearing-tag"
              transform={`translate(${a[0]} ${a[1] - 17})`}
            >
              <rect x="-25" y="-11" width="50" height="21" rx="10" />
              <text y="3" text-anchor="middle">
                {Math.round(now.az) % 360}° {direction(now.az)}
              </text>
            </g>
            <circle class="pin" r="6" />
            <circle class="pin-core" r="2" />
          </g>
          {shadowPx !== null && (
            <g>
              <line
                x2={end[0]}
                y2={end[1]}
                stroke="var(--mapLabel)"
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
        </g>
      </svg>
      {(status || props.offline) && (
        <div class="map-status" role="status">
          {props.offline && <WifiOff size={15} />}{" "}
          {props.offline ? "Offline · " + (status || "saved map") : status}
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
