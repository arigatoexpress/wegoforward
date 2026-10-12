// Zero-dependency site checks for the WeGoForward static site.
// Runs in CI and locally: node tools/check-site.mjs
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`  FAIL ${message}`);
}

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const htmlFiles = readdirSync(root).filter((f) => f.endsWith(".html"));
console.log(`Checking ${htmlFiles.length} pages: ${htmlFiles.join(", ")}`);

const FORBIDDEN = ["Texas Home Outlet", "Project-Go-Forward"];
const idsByFile = new Map();
const links = [];

for (const file of htmlFiles) {
  const html = read(file);

  // Head essentials
  if (!/<title>[^<]+<\/title>/.test(html)) fail(`${file}: missing <title>`);
  if (!/<meta name="description" content="[^"]+">/.test(html)) fail(`${file}: missing meta description`);
  if (!/<link rel="canonical" href="https:\/\/wegoforward\.app\//.test(html)) fail(`${file}: missing canonical URL`);
  if (!/<meta name="viewport"/.test(html)) fail(`${file}: missing viewport meta`);

  // Exactly one h1
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length !== 1) fail(`${file}: expected exactly one <h1>, found ${h1s.length}`);

  // Landmarks + skip link
  if (!html.includes('id="main"')) fail(`${file}: missing #main landmark target`);
  if (!html.includes('class="skip-link"')) fail(`${file}: missing skip link`);

  // Theme + reveal scripts must stay external (CSP has no unsafe-inline for scripts)
  const inlineScripts = html.match(/<script(?![^>]*\bsrc=)[^>]*>/gi) || [];
  const ldJson = inlineScripts.filter((t) => !/application\/ld\+json/.test(t));
  if (ldJson.length) fail(`${file}: inline <script> found — CSP blocks inline scripts`);
  if (/style="/i.test(html)) fail(`${file}: inline style attribute found — CSP blocks inline styles`);

  // Forbidden business names must never appear on the public site
  for (const name of FORBIDDEN) {
    if (html.includes(name)) fail(`${file}: forbidden mention of "${name}"`);
  }

  // Collect ids and links
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  idsByFile.set(file, ids);
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    links.push({ file, href: m[1], text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
  }
}

// Link integrity: internal targets exist, fragments resolve
for (const { file, href, text } of links) {
  if (/^https?:\/\//.test(href) || href.startsWith("mailto:")) {
    // The only external *contact* surface allowed is LinkedIn
    if (/contact/i.test(text) && !href.includes("linkedin.com")) {
      fail(`${file}: contact link "${text}" points outside LinkedIn: ${href}`);
    }
    continue;
  }
  const [pathPart, frag] = href.split("#");
  let targetFile = pathPart;
  if (pathPart === "" ) targetFile = file;
  else if (pathPart === "/" || pathPart === "/index.html") targetFile = "index.html";
  else if (pathPart.startsWith("/")) targetFile = pathPart.slice(1);

  const targetPath = join(root, targetFile);
  if (!existsSync(targetPath) || !statSync(targetPath).isFile()) {
    fail(`${file}: broken internal link "${href}" (${targetFile} not found)`);
    continue;
  }
  if (frag && targetFile.endsWith(".html")) {
    const ids = idsByFile.get(targetFile) || new Set([...read(targetFile).matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    if (!ids.has(frag)) fail(`${file}: link "${href}" targets missing fragment #${frag} in ${targetFile}`);
  }
}

// Required infra files
const required = ["_headers", "_redirects", ".well-known/security.txt", "robots.txt", "sitemap.xml", "favicon.svg", "site.css", "app.js", "og.png", "apple-touch-icon.png"];
for (const rel of required) {
  if (!existsSync(join(root, rel))) fail(`missing required file: ${rel}`);
}

// Security headers must stay in place (HSTS / CSP / XFO)
if (existsSync(join(root, "_headers"))) {
  const headers = read("_headers");
  for (const directive of ["Strict-Transport-Security:", "Content-Security-Policy:", "X-Frame-Options: DENY", "X-Content-Type-Options:", "frame-ancestors 'none'"]) {
    if (!headers.includes(directive)) fail(`_headers: missing "${directive}"`);
  }
}

// www redirect must stay in place
if (existsSync(join(root, "_redirects"))) {
  const redirects = read("_redirects");
  if (!/https:\/\/www\.wegoforward\.app\/\*\s+https:\/\/wegoforward\.app\/:splat\s+301/.test(redirects)) {
    fail("_redirects: www → apex 301 redirect missing");
  }
}

// security.txt must stay valid (RFC 9116)
if (existsSync(join(root, ".well-known/security.txt"))) {
  const txt = read(".well-known/security.txt");
  if (!/^Contact: .+$/m.test(txt)) fail("security.txt: missing Contact field");
  const expires = txt.match(/^Expires: (.+)$/m);
  if (!expires) fail("security.txt: missing Expires field");
  else if (new Date(expires[1]) <= new Date()) fail(`security.txt: Expires ${expires[1]} is in the past`);
  else if (new Date(expires[1]) > new Date(Date.now() + 366 * 24 * 3600 * 1000)) fail(`security.txt: Expires ${expires[1]} is more than a year out`);
}

// Every page is in the sitemap
if (existsSync(join(root, "sitemap.xml"))) {
  const sitemap = read("sitemap.xml");
  for (const file of htmlFiles) {
    const url = file === "index.html" ? "https://wegoforward.app/" : `https://wegoforward.app/${file}`;
    if (!sitemap.includes(`<loc>${url}</loc>`)) fail(`sitemap.xml: missing ${url}`);
  }
}

// app.js must parse cleanly
try {
  execFileSync(process.execPath, ["--check", join(root, "app.js")]);
} catch {
  fail("app.js: syntax error");
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("All site checks passed.");
