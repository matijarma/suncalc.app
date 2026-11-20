import { readFileSync, writeFileSync } from "node:fs";
const { colors } = JSON.parse(
  readFileSync(new URL("../src/design/tokens.json", import.meta.url), "utf8"),
);
const scheme = (i) =>
  Object.entries(colors)
    .map(([role, pair]) => "--" + role + ":" + pair[i] + ";")
    .join("");
const pinned = (s) =>
  ':root:has(>head>meta[name="color-scheme"][content="' + s + '"])';
writeFileSync(
  new URL("../public/brand/palette.css", import.meta.url),
  [
    ":root{color-scheme:light dark;" + scheme(0) + "}",
    "@media(prefers-color-scheme:dark){:root{" + scheme(1) + "}}",
    ...["light", "dark"].map(
      (s, i) => pinned(s) + "{color-scheme:" + s + ";" + scheme(i) + "}",
    ),
  ].join("\n"),
);
