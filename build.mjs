#!/usr/bin/env node
/**
 * Générateur du site birusk.app. Zéro dépendance.
 *
 *   node build.mjs            construit dist/
 *   node build.mjs --watch    reconstruit à chaque modification
 *   node build.mjs --serve    construit puis sert dist/ sur http://localhost:4321
 *
 * content.json porte tout le texte. Toute valeur de la forme
 * { "fr": "…", "en": "…", "ckb": "…" } est résolue à la langue en cours,
 * si bien que le template n'a jamais à connaître les langues.
 *
 * Sortie : dist/index.html (fr) · dist/en/index.html · dist/ckb/index.html
 */

import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist");

const LANGS = {
  fr:  { label: "FR", name: "Français", dir: "ltr", locale: "fr-FR", ogLocale: "fr_FR" },
  en:  { label: "EN", name: "English",  dir: "ltr", locale: "en",    ogLocale: "en_US" },
  ckb: { label: "KU", name: "کوردی",     dir: "rtl", locale: "ckb-IQ", ogLocale: "ckb_IQ" },
};

// ── moteur de template ───────────────────────────────────────────────────────

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

function tokenize(src) {
  const re = /\{\{\{([^}]+)\}\}\}|\{\{([^}]+)\}\}/g;
  const out = []; let last = 0, m;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ t: "text", v: src.slice(last, m.index) });
    out.push(m[1] !== undefined ? { t: "raw", v: m[1].trim() } : { t: "tag", v: m[2].trim() });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ t: "text", v: src.slice(last) });
  return out;
}

function parse(tokens) {
  const root = { t: "root", kids: [] };
  const stack = [root];
  const put = (n, c) => (n.inAlt ? n.alt.push(c) : n.kids.push(c));
  for (const tk of tokens) {
    const top = stack[stack.length - 1];
    if (tk.t === "text" || tk.t === "raw") { put(top, tk); continue; }
    const v = tk.v;
    if (v.startsWith("#")) {
      const [kw, ...rest] = v.slice(1).split(/\s+/);
      if (!["if", "unless", "each"].includes(kw)) throw new Error(`Bloc inconnu {{#${kw}}}`);
      const node = { t: "block", kw, expr: rest.join(" "), kids: [], alt: null, inAlt: false };
      put(top, node); stack.push(node);
    } else if (v === "else") {
      top.alt = []; top.inAlt = true;
    } else if (v.startsWith("/")) {
      if (stack.length === 1) throw new Error(`Fermeture orpheline {{${v}}}`);
      stack.pop();
    } else put(top, { t: "var", v });
  }
  if (stack.length !== 1) throw new Error(`Bloc non fermé {{#${stack[stack.length - 1].kw}}}`);
  return root;
}

function lookup(path, scopes) {
  let up = 0;
  while (path.startsWith("../")) { path = path.slice(3); up++; }
  if (up) scopes = scopes.slice(0, Math.max(1, scopes.length - up));
  if (path === "this" || path === ".") return scopes[scopes.length - 1].value;
  if (path.startsWith("@")) {
    for (let i = scopes.length - 1; i >= 0; i--)
      if (scopes[i].meta && path.slice(1) in scopes[i].meta) return scopes[i].meta[path.slice(1)];
    return undefined;
  }
  const parts = path.split(".");
  for (let i = scopes.length - 1; i >= 0; i--) {
    let cur = scopes[i].value, ok = true;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object" || !(p in cur)) { ok = false; break; }
      cur = cur[p];
    }
    if (ok) return cur;
  }
  return undefined;
}

const truthy = (v) => !(v == null || v === false || v === "" || (Array.isArray(v) && !v.length));

function evaluate(nodes, scopes) {
  let out = "";
  for (const n of nodes) {
    if (n.t === "text") { out += n.v; continue; }
    if (n.t === "raw")  { const v = lookup(n.v, scopes); out += v == null ? "" : String(v); continue; }
    if (n.t === "var")  { const v = lookup(n.v, scopes); out += v == null ? "" : esc(v); continue; }
    const v = lookup(n.expr, scopes);
    if (n.kw === "each") {
      const list = Array.isArray(v) ? v : [];
      if (!list.length) { out += n.alt ? evaluate(n.alt, scopes) : ""; continue; }
      list.forEach((item, i) => {
        out += evaluate(n.kids, [...scopes, {
          value: item,
          meta: { index: i, number: i + 1, first: i === 0, last: i === list.length - 1 },
        }]);
      });
    } else {
      const cond = n.kw === "if" ? truthy(v) : !truthy(v);
      out += cond ? evaluate(n.kids, scopes) : n.alt ? evaluate(n.alt, scopes) : "";
    }
  }
  return out;
}

const compile = (src) => { const ast = parse(tokenize(src)); return (ctx) => evaluate(ast.kids, [{ value: ctx, meta: {} }]); };

// ── localisation ─────────────────────────────────────────────────────────────

const codes = new Set(Object.keys(LANGS));
const isLocalized = (v) =>
  v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).length > 0 &&
  Object.keys(v).every((k) => codes.has(k) && typeof v[k] === "string");

function localize(v, lang, fb) {
  if (isLocalized(v)) return v[lang] ?? v[fb] ?? Object.values(v)[0] ?? "";
  if (Array.isArray(v)) return v.map((x) => localize(x, lang, fb));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = localize(val, lang, fb);
    return o;
  }
  return v;
}

// ── build ────────────────────────────────────────────────────────────────────

async function build() {
  const content = JSON.parse(await readFile(join(ROOT, "content.json"), "utf8"));
  const page = compile(await readFile(join(ROOT, "template/page.html"), "utf8"));
  const css  = await readFile(join(ROOT, "template/style.css"), "utf8");
  const js   = await readFile(join(ROOT, "template/app.js"), "utf8");

  const langs = content.languages;
  const def = content.defaultLanguage;

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  if (existsSync(join(ROOT, "assets"))) await cp(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });

  const written = [];
  // URLs absolues pour le SEO : les href relatifs de la nav ne conviennent pas.
  const origin = `https://${content.site.domain}`;
  const path = (l) => (l === def ? "/" : `/${l}/`);

  for (const lang of langs) {
    const meta = LANGS[lang];
    const isDef = lang === def;
    const base = isDef ? "." : "..";
    const data = localize(content, lang, def);

    const ctx = {
      ...data,
      lang, base, origin,
      dir: meta.dir,
      rtl: meta.dir === "rtl",
      locale: meta.locale,
      ogLocale: meta.ogLocale,
      ogAlternates: langs.filter((l) => l !== lang).map((l) => LANGS[l].ogLocale),
      // l'arabe et le latin ne partagent aucun glyphe : précharger la police
      // que la langue courante n'utilise pas coûterait 90 à 124 Ko pour rien
      preloadFont: meta.dir === "rtl" ? "kufi-arabic.woff2" : "archivo-latin.woff2",
      jsonld: jsonld(content, data, lang, origin, path),
      css, js,
      year: content.buildYear ?? new Date().getFullYear(),
      canonical: `${origin}${path(lang)}`,
      langLinks: langs.map((l) => ({
        code: l,
        label: LANGS[l].label,
        name: LANGS[l].name,
        href: l === def ? `${base}/` : `${base}/${l}/`,
        url: `${origin}${path(l)}`,
        current: l === lang,
      })),
      // le marquee est répété pour couvrir la largeur sans coupure
      marqueeLoop: [...data.marquee, ...data.marquee, ...data.marquee],
    };

    const html = page(ctx);
    const out = isDef ? join(DIST, "index.html") : join(DIST, lang, "index.html");
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html, "utf8");
    written.push({ lang, bytes: Buffer.byteLength(html) });
  }

  await writeFile(join(DIST, "_headers"), HEADERS, "utf8");
  await writeFile(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: https://${content.site.domain}/sitemap.xml\n`, "utf8");
  await writeFile(join(DIST, "sitemap.xml"), sitemap(content), "utf8");
  await writeFile(join(DIST, "404.html"), notFound(content, css), "utf8");

  return written;
}

/** Page 404 autonome, dans la langue par défaut, même palette que le site. */
const notFound = (c, css) => {
  const def = c.defaultLanguage;
  const pick = (o) => o?.[def] ?? Object.values(o ?? {})[0] ?? "";
  return `<!doctype html>
<html lang="${def}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 — ${c.site.name}</title>
<meta name="robots" content="noindex">
<style>${css}
.nf{min-height:100svh;display:flex;flex-direction:column;justify-content:center;gap:20px;padding:var(--pad)}
.nf-code{font-size:clamp(5rem,26vw,20rem);font-weight:800;font-stretch:118%;letter-spacing:-.06em;line-height:.85}
.nf-msg{color:var(--muted);max-width:40ch;line-height:1.6}
</style>
</head>
<body>
<div class="grain" aria-hidden="true"></div>
<main class="nf">
  <span class="sec-num">404</span>
  <h1 class="nf-code">${c.site.name.toUpperCase()}</h1>
  <p class="nf-msg">Cette page n'existe pas. ${pick(c.work?.more) ?? ""}</p>
  <a class="link-arrow" href="/">Retour à l'accueil <span aria-hidden="true">↗</span></a>
</main>
</body>
</html>
`;
};

/**
 * Données structurées. Un seul graphe par page : l'organisation, le site et la
 * page courante, reliés par @id — les moteurs comprennent alors qu'il s'agit
 * de trois faces d'une même entité, et non de trois fiches indépendantes.
 */
const jsonld = (c, data, lang, origin, path) => {
  const org = `${origin}/#organisation`;
  const site = `${origin}/#site`;
  const url = `${origin}${path(lang)}`;
  const graph = [
    {
      "@type": "Organization",
      "@id": org,
      name: c.site.name,
      alternateName: c.site.wordmarkKurdish,
      url: `${origin}/`,
      email: c.site.email,
      description: data.meta.description,
      logo: { "@type": "ImageObject", url: `${origin}/assets/logo.png`, width: 512, height: 512 },
      image: `${origin}/assets/og-${lang}.png`,
      knowsLanguage: c.languages,
      areaServed: "Kurdistan",
    },
    { "@type": "WebSite", "@id": site, url: `${origin}/`, name: c.site.name, inLanguage: lang, publisher: { "@id": org } },
    {
      "@type": "WebPage",
      "@id": `${url}#page`,
      url, name: data.meta.title, description: data.meta.description,
      inLanguage: lang, isPartOf: { "@id": site }, about: { "@id": org },
    },
  ];
  // « </ » refermerait la balise <script> par anticipation
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
};

const sitemap = (c) => {
  const urls = c.languages.map((l) =>
    `  <url><loc>https://${c.site.domain}/${l === c.defaultLanguage ? "" : l + "/"}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

const HEADERS = `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

async function run() {
  const t0 = Date.now();
  try {
    const w = await build();
    const total = w.reduce((a, x) => a + x.bytes, 0);
    console.log(`✓ ${w.map((x) => `${x.lang} ${(x.bytes / 1024).toFixed(1)}Ko`).join("  ")}   (${Date.now() - t0}ms)`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  }
}

await run();

if (args.includes("--serve")) {
  const { createServer } = await import("node:http");
  const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
                  ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png",
                  ".jpg": "image/jpeg", ".webp": "image/webp", ".xml": "application/xml", ".txt": "text/plain" };
  createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = join(DIST, p);
    if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
    } catch { res.writeHead(404, { "Content-Type": "text/plain" }).end("404"); }
  }).listen(4321, () => console.log("→ http://localhost:4321"));
}

if (args.includes("--watch")) {
  const { watch } = await import("node:fs");
  let t = null;
  const bump = () => { clearTimeout(t); t = setTimeout(run, 120); };
  for (const d of ["template", "assets"]) if (existsSync(join(ROOT, d))) watch(join(ROOT, d), { recursive: true }, bump);
  watch(join(ROOT, "content.json"), bump);
  console.log("surveillance active…");
}
