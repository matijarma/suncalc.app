import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./web-tests",
  timeout: 40000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:8795",
    viewport: { width: 412, height: 860 },
    launchOptions: {
      executablePath: process.env.CHROME_BIN,
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    },
  },
  webServer: {
    command:
      "python3 -m http.server 8795 --bind 127.0.0.1 --directory ../.cache/android-web",
    url: "http://127.0.0.1:8795",
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "ignore",
  },
});
