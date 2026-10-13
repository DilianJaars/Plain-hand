import { build, context } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/** "public" is the folder Vercel looks for by default, so the site deploys even without extra settings. */
const dist = join(root, "public");
const watch = process.argv.includes("--watch");

/** Optional shared review service, e.g. REVIEWS_URL=https://reviews.example.com npm run build. Empty keeps reviews on the device. */
const REVIEWS_URL = (process.env.REVIEWS_URL ?? "").replace(/\/+$/, "");
if (REVIEWS_URL && !/^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(REVIEWS_URL)) throw new Error("REVIEWS_URL must be an https:// address");
const REVIEWS_ORIGIN = REVIEWS_URL ? new URL(REVIEWS_URL).origin : "";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Caveat:wght@700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap";

/** Security headers as a meta tag. Hosts that can send real headers should send the same policy as an HTTP header. */
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  `connect-src ${REVIEWS_ORIGIN || "'none'"}`,
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

const options = {
  entryPoints: [join(root, "src/main.ts")],
  bundle: true,
  minify: !watch,
  sourcemap: false,
  target: "es2020",
  format: "iife",
  outdir: dist,
  entryNames: "app",
  logLevel: "info",
  define: { __REVIEWS_URL__: JSON.stringify(REVIEWS_URL) },
};

function compose() {
  const js = readFileSync(join(dist, "app.js"), "utf8");
  const css = readFileSync(join(dist, "app.css"), "utf8");

  // Standalone site: external files, strict CSP, no inline code.
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="no-referrer">
<meta name="description" content="A free writing check for students. Marks passages that read like machine writing, explains why, and helps you declare any AI help you used.">
<meta name="color-scheme" content="light dark">
<title>Plainhand</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="app.css">
</head>
<body>
<div id="app"></div>
<noscript><p style="padding:2rem;font-family:sans-serif">Plainhand needs JavaScript to read your draft. Nothing is sent anywhere.</p></noscript>
<script src="app.js"></script>
</body>
</html>
`;
  writeFileSync(join(dist, "index.html"), page);

  // Single-file version for pasting into hosts that want one document (used for the preview).
  const single = `<title>Plainhand</title>
<link rel="stylesheet" href="${FONTS}">
<style>${css}</style>
<div id="app"></div>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
`;
  writeFileSync(join(dist, "plainhand.single.html"), single);
}

mkdirSync(dist, { recursive: true });
if (watch) {
  const ctx = await context({ ...options, plugins: [{ name: "compose", setup(b) { b.onEnd(compose); } }] });
  await ctx.watch();
  console.log("Watching src/. Open public/index.html.");
} else {
  await build(options);
  compose();
  console.log("Built public/index.html and public/plainhand.single.html");
}
