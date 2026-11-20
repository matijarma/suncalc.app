// Run after extracting the two preview PMTiles files (see README).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PMTiles } from "pmtiles";
const ids = new Set();
function archive(file) {
  const b = readFileSync(".cache/" + file + ".pmtiles");
  return new PMTiles({
    getKey: () => file,
    getBytes: async (o, l) => ({
      data: Uint8Array.from(b.subarray(o, o + l)).buffer,
    }),
  });
}
const tx = (v, z) => Math.floor(((v + 180) / 360) * 2 ** z),
  ty = (v, z) =>
    Math.floor(
      ((1 - Math.asinh(Math.tan((v * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z,
    );
async function tiles(file, bbox, min, max) {
  const a = archive(file);
  for (let z = min; z <= max; z++)
    for (let x = tx(bbox[0], z); x <= tx(bbox[2], z); x++)
      for (let y = ty(bbox[3], z); y <= ty(bbox[1], z); y++) {
        const tile = await a.getZxy(z, x, y);
        if (!tile) continue;
        const key = [z, x, y].join("/");
        mkdirSync("public/tiles/v1/" + z + "/" + x, { recursive: true });
        writeFileSync(
          "public/tiles/v1/" + key + ".mvt",
          new Uint8Array(tile.data),
        );
        ids.add(key);
      }
}
await tiles("world", [-179.999, -85, 179.999, 85], 0, 3);
await tiles("split", [16.41, 43.492, 16.464, 43.521], 4, 15);
writeFileSync("worker/seed.json", JSON.stringify([...ids]));
console.log(ids.size, "preview tiles");
