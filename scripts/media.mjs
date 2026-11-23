import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { summer, winter } from "./site-content.mjs";

const base = process.env.MEDIA_BASE_URL || "http://127.0.0.1:8789";
if (new URL(base).hostname !== "127.0.0.1" && new URL(base).hostname !== "localhost")
  throw Error("Capture launch assets from a local preview, not live usage.");
mkdirSync("public/images", { recursive: true });
mkdirSync("public/media", { recursive: true });
mkdirSync(".cache/media", { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || "/usr/bin/google-chrome", args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
try {
  for (const [name, path, viewport] of [
    ["sun-direction", summer, { width: 1200, height: 833 }],
    ["shadow-length", winter, { width: 1200, height: 833 }],
    ["planner-mobile", summer, { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, colorScheme: "light", serviceWorkers: "block" });
    const page = await context.newPage();
    await page.goto(base + path);
    await page.getByRole("button", { name: "Zoom in" }).waitFor();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".planner").screenshot({ path: `.cache/media/${name}.png` });
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", `.cache/media/${name}.png`, "-c:v", "libwebp", "-quality", "86", `public/images/${name}.webp`]);
    await context.close();
  }
  const card = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await card.setContent(`<!doctype html><html lang="en"><style>
    @font-face{font-family:Bric;src:url('${base}/brand/bricolage.woff2')}*{box-sizing:border-box}body{margin:0;background:#F8F6EC;color:#20231C;font-family:Bric,system-ui}main{height:630px;padding:55px 60px;position:relative;overflow:hidden}.brand{display:flex;align-items:center;gap:15px;font-size:34px;font-weight:750}.brand img{width:48px;height:48px}h1{font-size:76px;line-height:1;letter-spacing:-4px;font-weight:700;max-width:670px;margin:48px 0 22px}p{font-size:27px;margin:0;max-width:660px;line-height:1.5}.mark{position:absolute;right:56px;top:177px;width:300px;height:300px}.footer{position:absolute;left:60px;right:60px;bottom:40px;padding-top:23px;border-top:1px solid #D0CEBA;display:flex;justify-content:space-between;align-items:center;font-size:22px}.tag{font-size:18px;color:#505344;letter-spacing:1px}
    </style><main><div class="brand"><img src="${base}/icon.svg" alt="">SunCalc.app</div><h1>Know where<br>the sun will be.</h1><p>Sun position. Shadows. Seasons.<br>No account required.</p><img class="mark" src="${base}/icon.svg" alt=""><div class="footer"><span>A little planning. A little more sunlight.</span><span class="tag">SUNCALC.APP</span></div></main></html>`);
  await card.evaluate(() => document.fonts.ready);
  await card.locator(".mark").evaluate((el) => el.decode());
  await card.screenshot({ path: "public/images/social-card.png" });
  await card.close();
  if (!process.argv.includes("--screenshots-only")) {
    const captions = `WEBVTT

00:00:00.000 --> 00:00:05.000
SunCalc.app opens straight into the planner.

00:00:05.000 --> 00:00:09.000
Choose sunrise, then move through the day.

00:00:09.000 --> 00:00:15.000
Watch the sun direction and shadow change.

00:00:15.000 --> 00:00:22.000
Compare the same place in December.

00:00:22.000 --> 00:00:29.000
Open source. Free during preview. suncalc.app
`;
    writeFileSync("public/media/suncalc-demo.vtt", captions);
    const context = await browser.newContext({ viewport: { width: 1200, height: 833 }, colorScheme: "light", serviceWorkers: "block", recordVideo: { dir: ".cache/media", size: { width: 1200, height: 833 } } });
    const page = await context.newPage();
    const started = Date.now();
    const until = async (seconds) => { const remaining = seconds * 1000 - (Date.now() - started); if (remaining > 0) await page.waitForTimeout(remaining); };
    await page.goto(base + summer);
    await page.getByRole("button", { name: "Zoom in" }).waitFor();
    await until(5);
    await page.locator(".event-rise").click();
    await until(8);
    for (const [second, minute] of [[8, 8 * 60], [10, 12 * 60], [12, 16 * 60]]) {
      await until(second);
      await page.getByRole("slider").evaluate((el, value) => { el.value = String(value); el.dispatchEvent(new Event("input", { bubbles: true })); }, minute);
    }
    await until(15);
    await page.goto(base + winter);
    await until(22);
    await until(28);
    const video = page.video();
    await context.close();
    const raw = await video.path();
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2,subtitles=public/media/suncalc-demo.vtt:force_style='FontName=DejaVu Sans,FontSize=11,PrimaryColour=&H00FFFFFF,OutlineColour=&H001C2320,Alignment=1,BorderStyle=3,Outline=4,MarginL=20,MarginR=110,MarginV=20'", "-t", "28", "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", "public/media/suncalc-demo.mp4"]);
    rmSync(raw);
  }
  console.log("Launch images and requested demo generated in public/images and public/media.");
} finally {
  await browser.close();
}
