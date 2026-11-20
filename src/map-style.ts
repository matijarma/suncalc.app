import type {
  Map as GLMap,
  StyleSpecification,
  LayerSpecification,
} from "maplibre-gl";
import tokens from "./design/tokens.json";
import type { Scheme } from "./appearance";
export function atlasStyle(
  scheme: Scheme,
  origin = location.origin,
): StyleSpecification {
  const ix = scheme === "light" ? 0 : 1,
    c = (k: keyof typeof tokens.colors) => tokens.colors[k][ix];
  const layer = (
    id: string,
    type: string,
    sl: string,
    paint: Record<string, unknown>,
    other: Record<string, unknown> = {},
  ): LayerSpecification =>
    ({
      id,
      type,
      source: "atlas",
      "source-layer": sl,
      paint,
      ...other,
    }) as LayerSpecification;
  const name = ["coalesce", ["get", "name:en"], ["get", "name"]];
  const layout = {
    "text-field": name,
    "text-font": ["Noto Sans Regular"],
    "text-size": 11,
    "text-max-width": 9,
  };
  const text = {
    "text-color": c("mapLabel"),
    "text-halo-color": c("land"),
    "text-halo-width": 1.2,
  };
  return {
    version: 8,
    glyphs: origin + "/maps/fonts/{fontstack}/{range}.pbf",
    sources: {
      atlas: {
        type: "vector",
        tiles: [origin + "/tiles/v1/{z}/{x}/{y}.mvt"],
        maxzoom: 15,
      },
    },
    layers: [
      {
        id: "paper",
        type: "background",
        paint: { "background-color": c("land") },
      },
      layer("earth", "fill", "earth", { "fill-color": c("land") }),
      layer("cover", "fill", "landcover", {
        "fill-color": [
          "match",
          ["get", "kind"],
          ["wood", "forest", "grassland", "grass", "scrub"],
          c("park"),
          c("land"),
        ],
      }),
      layer("uses", "fill", "landuse", {
        "fill-color": [
          "match",
          ["get", "kind"],
          [
            "park",
            "forest",
            "wood",
            "nature_reserve",
            "garden",
            "grass",
            "recreation_ground",
            "playground",
            "pitch",
            "dog_park",
          ],
          c("park"),
          ["pedestrian", "parking", "commercial", "industrial"],
          c("building"),
          c("land"),
        ],
      }),
      layer("sea", "fill", "water", { "fill-color": c("water") }),
      layer(
        "river",
        "line",
        "water",
        { "line-color": c("water"), "line-width": 1.6 },
        { filter: ["==", ["geometry-type"], "LineString"] },
      ),
      layer(
        "piers",
        "fill",
        "landuse",
        { "fill-color": c("land"), "fill-outline-color": c("buildingEdge") },
        { filter: ["==", ["get", "kind"], "pier"] },
      ),
      layer("country-boundaries", "line", "boundaries", {
        "line-color": c("mapGuide"),
        "line-width": 0.8,
        "line-dasharray": [3, 3],
      }),
      layer(
        "buildings",
        "fill",
        "buildings",
        {
          "fill-color": c("building"),
          "fill-outline-color": c("buildingEdge"),
        },
        { minzoom: 12 },
      ),
      layer(
        "road-edges",
        "line",
        "roads",
        {
          "line-color": c("streetEdge"),
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            0.9,
            12,
            2.1,
            15,
            4.4,
            18,
            11,
          ],
        },
        { layout: { "line-join": "round", "line-cap": "round" } },
      ),
      layer(
        "road-fill",
        "line",
        "roads",
        {
          "line-color": c("street"),
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            0.45,
            12,
            1.1,
            15,
            3.2,
            18,
            8.5,
          ],
        },
        { layout: { "line-join": "round", "line-cap": "round" } },
      ),
      layer("street-label", "symbol", "roads", text, {
        minzoom: 13,
        layout: {
          ...layout,
          "symbol-placement": "line",
          "text-rotation-alignment": "map",
          "symbol-spacing": 240,
        },
      }),
      layer("poi-label", "symbol", "pois", text, {
        minzoom: 14,
        filter: [
          "step",
          ["zoom"],
          [
            "match",
            ["get", "kind"],
            [
              "museum",
              "peak",
              "park",
              "viewpoint",
              "theatre",
              "train_station",
              "townhall",
              "ferry_terminal",
              "castle",
              "attraction",
            ],
            true,
            false,
          ],
          17,
          true,
        ],
        layout: { ...layout, "text-size": 10, "text-padding": 7 },
      }),
      layer("place-label", "symbol", "places", text, {
        layout: {
          ...layout,
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            11,
            9,
            14,
            14,
            13,
          ],
          "text-letter-spacing": 0.045,
        },
      }),
    ],
  };
}
// Only paint changes. Sources, requests, camera and the selected point are untouched.
export function recolorAtlas(map: GLMap, scheme: Scheme) {
  for (const layer of atlasStyle(scheme).layers) {
    if (!map.getLayer(layer.id) || !("paint" in layer) || !layer.paint)
      continue;
    for (const [name, value] of Object.entries(layer.paint))
      if (name.endsWith("color"))
        map.setPaintProperty(
          layer.id,
          name as Parameters<GLMap["setPaintProperty"]>[1],
          value,
        );
  }
}
