import { pages, metadata, footer, documentHTML, sitemap, robots } from "./site-content.mjs";

// Static pages share one source in dev and production; no client router or map JS.
export function publicSite() {
  const documents = new Map(pages.slice(1).map((p) => [p.path, documentHTML(p)]));
  documents.set("/sitemap.xml", sitemap());
  documents.set("/robots.txt", robots);
  return {
    name: "suncalc-public-site",
    transformIndexHtml(html) {
      return html.replace("<!-- site:metadata -->", metadata(pages[0]))
        .replace("<!-- site:content -->", pages[0].content)
        .replace("<!-- site:footer -->", footer);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url, "http://localhost").pathname;
        const source = documents.get(path);
        if (!source) return next();
        res.setHeader("Content-Type", path.endsWith(".xml") ? "application/xml" : path.endsWith(".txt") ? "text/plain" : "text/html; charset=utf-8");
        res.end(source);
      });
    },
    generateBundle() {
      for (const [path, source] of documents) {
        this.emitFile({ type: "asset", fileName: path.slice(1) + (path.endsWith("/") ? "index.html" : ""), source });
      }
    },
  };
}
