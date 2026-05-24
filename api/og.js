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
  const select = `id,slug,name_he,name_en,name_ru,animal_he,animal_en,animal_ru,tagline_he,tagline_en,tagline_ru,mockup_url,design_url`;
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

function buildCrawlerHtml(d, handle) {
  const name = pickName(d);
  const description = pickDescription(d);
  const image = d.mockup_url || d.design_url || DEFAULT_OG_IMAGE;
  const canonical = `${SITE_ORIGIN}/p/${encodeURIComponent(handle)}`;
  const robots = MAINTENANCE ? `noindex, nofollow` : `index, follow`;

  const title = escapeHtml(`${name} · BLOOM · ספלים שופ`);
  const descAttr = escapeHtml(description);
  const imageAttr = escapeHtml(image);
  const canonicalAttr = escapeHtml(canonical);
  const nameAttr = escapeHtml(name);
  const robotsAttr = escapeHtml(robots);

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

  const ua = (req.headers && (req.headers[`user-agent`] || req.headers[`User-Agent`])) || ``;
  const crawler = isCrawler(ua);

  // Single structured log line per invocation — visible in Vercel runtime logs.
  // Branch decision is appended below after the lookup so we log it once.
  console.log(`[og] method=${req.method} url=${req.url} handle=${handle} ua=${String(ua).slice(0, 120)}`);

  if (!handle) {
    console.log(`[og] branch=notfound reason=empty-handle`);
    res.statusCode = 302;
    res.setHeader(`Location`, `/`);
    res.setHeader(`Cache-Control`, `private, no-store`);
    res.end();
    return;
  }

  const design = await lookupDesign(handle);

  if (!design) {
    console.log(`[og] branch=notfound handle=${handle}`);
    res.statusCode = 302;
    res.setHeader(`Location`, `/`);
    res.setHeader(`Cache-Control`, `private, no-store`);
    res.end();
    return;
  }

  if (!crawler) {
    console.log(`[og] branch=human handle=${handle} → /#pets/${handle}`);
    res.statusCode = 302;
    res.setHeader(`Location`, `/#pets/${encodeURIComponent(handle)}`);
    res.setHeader(`Cache-Control`, `private, no-store`);
    res.end();
    return;
  }

  console.log(`[og] branch=crawler handle=${handle} name=${pickName(design)}`);
  const html = buildCrawlerHtml(design, handle);
  res.statusCode = 200;
  res.setHeader(`Content-Type`, `text/html; charset=utf-8`);
  // DO NOT add a public Cache-Control here. Vercel's edge cache is keyed by
  // URL alone, so caching a crawler-branch 200 poisons subsequent non-crawler
  // requests at the same URL (they get the cached HTML instead of being
  // routed back through the function for a 302). The function is cheap and
  // BLOOM is 12 rows; just run it every time.
  res.setHeader(`Cache-Control`, `private, no-store`);
  res.end(html);
};
