import type { StyleSpecification, LayerSpecification } from "maplibre-gl";
export function atlasStyle(): StyleSpecification {
  const light = "#f1efe4",
    ink = "#706f62",
    gold = "#ddba80",
    src = "atlas";
  const layer = (
    id: string,
    type: string,
    sl: string,
    paint: any,
    more: any = {},
  ) =>
    ({
      id,
      type,
      source: src,
      "source-layer": sl,
      paint,
      ...more,
    }) as LayerSpecification;
  const name = ["coalesce", ["get", "name:en"], ["get", "name"]];
  const text = (size: number, color: string) => ({
    layout: {
      "text-field": name,
      "text-font": ["Noto Sans Regular"],
      "text-size": size,
      "text-max-width": 9,
    },
    paint: {
      "text-color": color,
      "text-halo-color": light,
      "text-halo-width": 1.1,
    },
  });
  const poi = text(10, "#677663"),
    place = text(12, "#4e6053"),
    road = text(10, ink);
  return {
    version: 8,
    glyphs: location.origin + "/maps/fonts/{fontstack}/{range}.pbf",
    sources: {
      atlas: {
        type: "vector",
        tiles: [location.origin + "/tiles/v1/{z}/{x}/{y}.mvt"],
        maxzoom: 15,
      },
    },
    layers: [
      { id: "paper", type: "background", paint: { "background-color": light } },
      layer("earth", "fill", "earth", { "fill-color": light }),
      layer("cover", "fill", "landcover", {
        "fill-color": [
          "match",
          ["get", "kind"],
          ["wood", "forest"],
          "#cbd7bc",
          ["grassland", "grass", "scrub"],
          "#dce2cb",
          "#e8e7d5",
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
          ],
          "#d5dec5",
          ["pedestrian", "parking", "commercial", "industrial"],
          "#e6e1d4",
          "#e9e7db",
        ],
      }),
      layer("sea", "fill", "water", { "fill-color": "#bcd5d2" }),
      layer(
        "river",
        "line",
        "water",
        { "line-color": "#adc9c6", "line-width": 1.4 },
        { filter: ["==", ["geometry-type"], "LineString"] },
      ),
      layer("country-boundaries", "line", "boundaries", {
        "line-color": "#b5aea0",
        "line-width": 0.85,
        "line-dasharray": [3, 3],
      }),
      layer(
        "buildings",
        "fill",
        "buildings",
        { "fill-color": "#d9d2bf", "fill-outline-color": "#c6bfae" },
        { minzoom: 12 },
      ),
      layer(
        "road-edges",
        "line",
        "roads",
        {
          "line-color": [
            "match",
            ["get", "kind"],
            ["highway", "major_road"],
            gold,
            "#d6ceba",
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            0.7,
            12,
            1.8,
            15,
            4.2,
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
          "line-color": [
            "match",
            ["get", "kind"],
            ["highway", "major_road"],
            "#f9e4b7",
            "#fbf8ed",
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            0.4,
            12,
            1,
            15,
            2.8,
            18,
            8,
          ],
        },
        { layout: { "line-join": "round", "line-cap": "round" } },
      ),
      layer("street-label", "symbol", "roads", road.paint, {
        minzoom: 13,
        layout: {
          ...road.layout,
          "symbol-placement": "line",
          "text-rotation-alignment": "map",
          "symbol-spacing": 220,
        },
      }),
      layer("poi-label", "symbol", "pois", poi.paint, {
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
        layout: { ...poi.layout, "text-padding": 7 },
      }),
      layer("place-label", "symbol", "places", place.paint, {
        layout: {
          ...place.layout,
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
          "text-letter-spacing": 0.055,
        },
      }),
    ],
  };
}
