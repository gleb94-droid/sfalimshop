// =============================================================================
// /p/<handle> link previews — statically-named Vercel Serverless Function.
// -----------------------------------------------------------------------------
// This is a Vite SPA project, NOT Next.js. Vercel only resolves dynamic API
// segments (`api/p/[handle].js`) under Next.js. On a plain Vite project the
// bracket file is treated as a static literal and `/api/p/<anything>` returns
// 404, so a `/p/:handle` rewrite that targets it silently falls through to
// the SPA catch-all (which is what happened in production — every /p/<slug>
// served index.html with the generic OG tags and never hit a function).
//
// Fix: a STATICALLY-named function (`api/og.js`) is always resolvable on any
// Vercel project. The vercel.json rewrite passes the handle as a query
// string so the function reads it from req.query.handle.
//
// Behavior (unchanged from the previous attempt):
//   1. Look up the BLOOM character in Supabase pet_designs by slug column.
//   2. Social-crawler UA → 200 HTML with per-character OG/Twitter tags.
//   3. Real browser → 302 to /#pets/<handle> so the SPA opens the modal.
//   4. Unknown handle → 302 to /.
//
// SECURITY: PUBLIC anon key only (already shipped in the client bundle).
// LAUNCH STEP: while MAINTENANCE is true the crawler HTML carries
// `noindex, nofollow`. Flip to false at launch — same gate as index.html.
// =============================================================================

const MAINTENANCE = true;

const FALLBACK_SUPABASE_URL = `https://ubvgrxlxtelulwjtfudd.supabase.co`;
const FALLBACK_SUPABASE_ANON_KEY = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVidmdyeGx4dGVsdWx3anRmdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODIyODMsImV4cCI6MjA5NDM1ODI4M30.79zQ0LMAzzocGSMD3ruNl2m_jan6siQJ_A1Ex7lOxyE`;

// M6: prefer the env-provided anon key; warn (don't throw) if it's missing so a
// Vercel env misconfig surfaces in logs instead of silently using the public
// fallback. Switch to a hard throw once SUPABASE_ANON_KEY is set in Vercel.
if (!process.env.SUPABASE_ANON_KEY) {
  console.warn(
    `[og] SUPABASE_ANON_KEY env var not set — using public anon fallback. Set it in Vercel env for clean key rotation.`
  );
}

const SITE_ORIGIN = `https://www.sfalimshop.com`;
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

const CRAWLER_PATTERNS = [
  `facebookexternalhit`,
  `facebot`,
  `twitterbot`,
  `whatsapp`,
  `linkedinbot`,
  `slackbot`,
  `telegrambot`,
  `discordbot`,
  `pinterest`,
  `googlebot`,
  `bingbot`,
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = String(userAgent).toLowerCase();
  for (const p of CRAWLER_PATTERNS) {
    if (ua.includes(p)) return true;
  }
  return false;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, `&amp;`)
    .replace(/</g, `&lt;`)
    .replace(/>/g, `&gt;`)
    .replace(/"/g, `&quot;`)
    .replace(/'/g, `&#39;`);
}

async function lookupDesign(handle) {
  const url = process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

  const safeHandle = encodeURIComponent(String(handle || ``).toLowerCase());
  const select = `id,slug,name_he,name_en,name_ru,animal_he,animal_en,animal_ru,tagline_he,tagline_en,tagline_ru,mockup_url,design_url,price_shirt_basic,price_shirt_oversized,price_shirt,price_mug`;
  const endpoint = `${url}/rest/v1/pet_designs?slug=eq.${safeHandle}&is_active=eq.true&select=${select}&limit=1`;
  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
    if (!res.ok) {
      console.log(`[og] supabase non-ok status=${res.status} handle=${handle}`);
      return null;
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0];
  } catch (err) {
    console.error(`[og] pet_designs fetch failed:`, err);
    return null;
  }
}

function pickName(d) {
  return d.name_he || d.name_en || `BLOOM`;
}

function pickDescription(d) {
  const tagline = d.tagline_he || d.tagline_en || ``;
  const animal = d.animal_he || d.animal_en || ``;
  const tail = [tagline, animal].filter(Boolean).join(` · `);
  const name = pickName(d);
  if (tail) return `${name} — ${tail} · BLOOM Collection · ספלים שופ`;
  return `${name} · BLOOM Collection של ספלים שופ`;
}

// Inline JSON-LD safely: JSON.stringify does NOT escape `<`, so a stray
// `</script>` in DB text could break out of the tag — neutralise it.
function jsonLdScript(obj) {
  const json = JSON.stringify(obj).replace(/</g, `\\u003c`);
  return `<script type="application/ld+json">${json}</script>`;
}

// Per-breed crawler HTML, used by BOTH /breed/<slug> and the legacy /p/<slug>
// character-share path. Canonical is the breed real path so /p shares
// consolidate onto /breed. Carries Product JSON-LD.
function buildBreedHtml(d, handle) {
  const name = pickName(d);
  const description = pickDescription(d);
  const image = d.mockup_url || d.design_url || DEFAULT_OG_IMAGE;
  const canonical = `${SITE_ORIGIN}/breed/${encodeURIComponent(handle)}`;
  const robots = MAINTENANCE ? `noindex, nofollow` : `index, follow`;

  const title = escapeHtml(`${name} · BLOOM · ספלים שופ`);
  const descAttr = escapeHtml(description);
  const imageAttr = escapeHtml(image);
  const canonicalAttr = escapeHtml(canonical);
  const nameAttr = escapeHtml(name);
  const robotsAttr = escapeHtml(robots);

  // Price span across this breed's purchasable products (shirt + mug) so the
  // Product rich result can show a price. Pet-name (+₪20) is an optional add-on,
  // excluded from the base offer range. Mirrors the runtime BreedPage JSON-LD.
  const offerPrices = [d.price_shirt_basic, d.price_shirt_oversized, d.price_shirt, d.price_mug]
    .map((p) => Number(p))
    .filter((p) => Number.isFinite(p) && p > 0);

  const ld = jsonLdScript({
    "@context": `https://schema.org`,
    "@type": `Product`,
    name,
    image: [image],
    description,
    brand: { "@type": `Brand`, name: `BLOOM / Sfalim Shop` },
    url: canonical,
    ...(offerPrices.length ? {
      offers: {
        "@type": `AggregateOffer`,
        priceCurrency: `ILS`,
        lowPrice: Math.min(...offerPrices),
        highPrice: Math.max(...offerPrices),
        availability: `https://schema.org/InStock`,
      },
    } : {}),
  });

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<meta name="description" content="${descAttr}" />
<meta name="robots" content="${robotsAttr}" />
<link rel="canonical" href="${canonicalAttr}" />
<meta property="og:type" content="product" />
<meta property="og:site_name" content="ספלים שופ" />
<meta property="og:url" content="${canonicalAttr}" />
<meta property="og:title" content="${nameAttr}" />
<meta property="og:description" content="${descAttr}" />
<meta property="og:image" content="${imageAttr}" />
<meta property="og:image:secure_url" content="${imageAttr}" />
<meta property="og:image:alt" content="${nameAttr}" />
<meta property="og:locale" content="he_IL" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${canonicalAttr}" />
<meta name="twitter:title" content="${nameAttr}" />
<meta name="twitter:description" content="${descAttr}" />
<meta name="twitter:image" content="${imageAttr}" />
${ld}
</head>
<body></body>
</html>`;
}

// ---- Blog post crawler HTML (/blog/<slug>) ----
async function lookupBlogPost(handle) {
  const url = process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
  const safe = encodeURIComponent(String(handle || ``).toLowerCase());
  const select = `slug,title_he,title_en,title_ru,excerpt_he,excerpt_en,excerpt_ru,seo_title_he,seo_description_he,cover_image_url,cover_image_alt_he,published_at,updated_at,category`;
  const endpoint = `${url}/rest/v1/blog_posts?slug=eq.${safe}&status=eq.published&select=${select}&limit=1`;
  try {
    const res = await fetch(endpoint, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } });
    if (!res.ok) { console.log(`[og] blog non-ok status=${res.status} handle=${handle}`); return null; }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0];
  } catch (err) {
    console.error(`[og] blog_posts fetch failed:`, err);
    return null;
  }
}

function buildBlogHtml(p, handle) {
  const title = p.title_he || p.title_en || `BLOOM`;
  const seoTitle = p.seo_title_he || title;
  const description = p.seo_description_he || p.excerpt_he || p.excerpt_en || `${title} · בלוג ספלים שופ`;
  const image = p.cover_image_url || DEFAULT_OG_IMAGE;
  const canonical = `${SITE_ORIGIN}/blog/${encodeURIComponent(handle)}`;
  const robots = MAINTENANCE ? `noindex, nofollow` : `index, follow`;

  const titleAttr = escapeHtml(`${seoTitle} — Sfalim Shop`);
  const ogTitleAttr = escapeHtml(title);
  const descAttr = escapeHtml(description);
  const imageAttr = escapeHtml(image);
  const canonicalAttr = escapeHtml(canonical);
  const robotsAttr = escapeHtml(robots);

  const ld = jsonLdScript({
    "@context": `https://schema.org`,
    "@type": `Article`,
    headline: title,
    image: [image],
    description,
    datePublished: p.published_at || undefined,
    dateModified: p.updated_at || p.published_at || undefined,
    author: { "@type": `Organization`, name: `Sfalim Shop` },
    publisher: { "@type": `Organization`, name: `Sfalim Shop`, logo: { "@type": `ImageObject`, url: `${SITE_ORIGIN}/exports/logo-mark-500.png` } },
    mainEntityOfPage: canonical,
    url: canonical,
  });

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>${titleAttr}</title>
<meta name="description" content="${descAttr}" />
<meta name="robots" content="${robotsAttr}" />
<link rel="canonical" href="${canonicalAttr}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="ספלים שופ" />
<meta property="og:url" content="${canonicalAttr}" />
<meta property="og:title" content="${ogTitleAttr}" />
<meta property="og:description" content="${descAttr}" />
<meta property="og:image" content="${imageAttr}" />
<meta property="og:image:secure_url" content="${imageAttr}" />
<meta property="og:image:alt" content="${ogTitleAttr}" />
<meta property="og:locale" content="he_IL" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${canonicalAttr}" />
<meta name="twitter:title" content="${ogTitleAttr}" />
<meta name="twitter:description" content="${descAttr}" />
<meta name="twitter:image" content="${imageAttr}" />
${ld}
</head>
<body></body>
</html>`;
}

// ---- Mugs hub crawler HTML (/mugs) — static, no DB lookup. The brand's
// namesake/core page, so it gets its own share preview instead of the generic
// home OG. Humans are redirected to the SPA hash route /#mugs.
function buildMugsHtml() {
  const title = escapeHtml(`הספלים שלנו · ספלים שופ`);
  const description = escapeHtml(`ספל קרמי 11oz עם דיוקן BLOOM, עיצוב משלכם, או ספל מעוצב לחתונה ולאירועים. מודפס ביד בבאר שבע.`);
  const canonical = escapeHtml(`${SITE_ORIGIN}/mugs`);
  const image = escapeHtml(DEFAULT_OG_IMAGE);
  const robots = escapeHtml(MAINTENANCE ? `noindex, nofollow` : `index, follow`);

  const ld = jsonLdScript({
    "@context": `https://schema.org`,
    "@type": `Product`,
    name: `ספל מותאם אישית · ספלים שופ`,
    image: [DEFAULT_OG_IMAGE],
    description: `ספל קרמי 11oz עם דיוקן BLOOM או העיצוב שלכם — מודפס ביד בבאר שבע.`,
    brand: { "@type": `Brand`, name: `Sfalim Shop` },
    url: `${SITE_ORIGIN}/mugs`,
    offers: {
      "@type": `AggregateOffer`,
      priceCurrency: `ILS`,
      lowPrice: 59,
      highPrice: 149,
      availability: `https://schema.org/InStock`,
    },
  });

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="robots" content="${robots}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="ספלים שופ" />
<meta property="og:url" content="${canonical}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:secure_url" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="${image && image.endsWith('.webp') ? 'image/webp' : 'image/png'}" />
<meta property="og:image:alt" content="${title}" />
<meta property="og:locale" content="he_IL" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:url" content="${canonical}" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
${ld}
</head>
<body></body>
</html>`;
}

module.exports = async function handler(req, res) {
  // Resolve handle. vercel.json rewrite passes it as ?handle=<slug>; fall back
  // to scraping the path for local dev / direct calls.
  let handle = ``;
  if (req.query && typeof req.query.handle === `string`) {
    handle = req.query.handle;
  } else if (Array.isArray(req.query?.handle)) {
    handle = req.query.handle[0] || ``;
  }
  if (!handle && req.url) {
    try {
      const parsed = new URL(req.url, `https://x.invalid`);
      handle = parsed.searchParams.get(`handle`) || ``;
      if (!handle) {
        const segments = parsed.pathname.split(`/`).filter(Boolean);
        handle = segments[segments.length - 1] || ``;
      }
    } catch (err) {
      // ignore — handle stays empty and we'll redirect to /
    }
  }
  handle = String(handle || ``).toLowerCase();

  // type = breed | blog | (default) character. Set by the vercel.json rewrites
  // (/breed/:slug → ?type=breed, /blog/:slug → ?type=blog). /p/<slug> sends no
  // type — the legacy character-share path.
  let type = ``;
  if (req.query && typeof req.query.type === `string`) type = req.query.type;
  if (!type && req.url) { try { type = new URL(req.url, `https://x.invalid`).searchParams.get(`type`) || ``; } catch (_) {} }
  type = String(type || ``).toLowerCase();

  const ua = (req.headers && (req.headers[`user-agent`] || req.headers[`User-Agent`])) || ``;
  const crawler = isCrawler(ua);

  // Single structured log line per invocation — visible in Vercel runtime logs.
  // Branch decision is appended below after the lookup so we log it once.
  console.log(`[og] method=${req.method} url=${req.url} handle=${handle} ua=${String(ua).slice(0, 120)}`);

  if (!handle && type !== `mugs`) {
    console.log(`[og] branch=notfound reason=empty-handle`);
    res.statusCode = 302;
    res.setHeader(`Location`, `/`);
    res.setHeader(`Cache-Control`, `private, no-store`);
    res.end();
    return;
  }

  const redirectHome = () => {
    res.statusCode = 302;
    res.setHeader(`Location`, `/`);
    res.setHeader(`Cache-Control`, `private, no-store`);
    res.end();
  };
  const redirectHuman = (target) => {
    res.statusCode = 302;
    res.setHeader(`Location`, target);
    res.setHeader(`Cache-Control`, `private, no-store`);
    res.end();
  };
  // DO NOT add a public Cache-Control on the crawler 200: Vercel's edge cache is
  // keyed by URL alone, so caching a crawler-branch 200 would poison subsequent
  // non-crawler requests (they'd get HTML instead of a 302). Run every time.
  const serveHtml = (html) => {
    res.statusCode = 200;
    res.setHeader(`Content-Type`, `text/html; charset=utf-8`);
    res.setHeader(`Cache-Control`, `private, no-store`);
    res.end(html);
  };
  const enc = encodeURIComponent(handle);

  if (type === `mugs`) {
    if (!crawler) { console.log(`[og] branch=human type=mugs → /#mugs`); return redirectHuman(`/#mugs`); }
    console.log(`[og] branch=crawler type=mugs`);
    return serveHtml(buildMugsHtml());
  }

  if (type === `blog`) {
    const post = await lookupBlogPost(handle);
    if (!post) { console.log(`[og] branch=notfound type=blog handle=${handle}`); return redirectHome(); }
    if (!crawler) { console.log(`[og] branch=human type=blog handle=${handle} → /#/blog/${handle}`); return redirectHuman(`/#/blog/${enc}`); }
    console.log(`[og] branch=crawler type=blog handle=${handle}`);
    return serveHtml(buildBlogHtml(post, handle));
  }

  // type=breed (real /breed/<slug> page) OR no type (legacy /p/<slug> character
  // share) — both resolve a pet_designs row. They differ only in where humans land.
  const design = await lookupDesign(handle);
  if (!design) { console.log(`[og] branch=notfound type=${type || `pet`} handle=${handle}`); return redirectHome(); }
  const humanTarget = type === `breed` ? `/#/breed/${enc}` : `/#pets/${enc}`;
  if (!crawler) { console.log(`[og] branch=human type=${type || `pet`} handle=${handle} → ${humanTarget}`); return redirectHuman(humanTarget); }
  console.log(`[og] branch=crawler type=${type || `pet`} handle=${handle} name=${pickName(design)}`);
  return serveHtml(buildBreedHtml(design, handle));
};
