import { rename, rm } from "node:fs/promises";
const dir = ".cache/android-web/";
await rename(dir + "android.html", dir + "index.html");
for (const name of [
  "_headers",
  "manifest.webmanifest",
  "site.css",
  "images",
  "media",
  ".well-known",
  "android",
])
  await rm(dir + name, { recursive: true, force: true });
