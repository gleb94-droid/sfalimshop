// =============================================================================
// /p/<handle> — per-BLOOM-character link-preview function
// -----------------------------------------------------------------------------
// Vercel Node Serverless Function. Lives OUTSIDE the SPA bundle (single-file
// rule in CLAUDE.md applies to App.jsx, not to api/*).
//
// Behavior:
//   1. Look up the BLOOM character in Supabase pet_designs by slug (same slug
//      derivation the SPA uses for #pets/<slug>, so links round-trip).
//   2. If the request UA matches a known social-card crawler → 200 HTML with
//      per-product OG/Twitter meta. Crawlers do NOT execute JS, so we must
//      serve real <meta> tags inline.
//   3. If it's a real browser → 302 to the SPA hash route so the modal opens.
//   4. Unknown handle → 302 to "/" (home).
//
// SECURITY: reads only the PUBLIC anon key (already public in App.jsx for the
// client). NEVER use the service_role key here. Env vars are preferred so the
// values can be rotated without a code change; if either var is missing we
// fall back to the existing public values to keep previews working.
//
// LAUNCH STEP: while MAINTENANCE is true, the crawler HTML carries
// `<meta name="robots" content="noindex, nofollow">`. Flip MAINTENANCE to
// false at launch — same gate as the three robots meta tags in index.html.
// =============================================================================

const MAINTENANCE = true;

// Public values — already shipped in the client bundle. The function only
// reads `pet_designs` (RLS already allows anon SELECT on active rows).
const FALLBACK_SUPABASE_URL = `https://ubvgrxlxtelulwjtfudd.supabase.co`;
const FALLBACK_SUPABASE_ANON_KEY = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVidmdyeGx4dGVsdWx3anRmdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODIyODMsImV4cCI6MjA5NDM1ODI4M30.79zQ0LMAzzocGSMD3ruNl2m_jan6siQJ_A1Ex7lOxyE`;

const SITE_ORIGIN = `https://www.sfalimshop.com`;
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

// Match the App.jsx slugify exactly (App.jsx ~6459) so /p/<handle> resolves to
// the same character as #pets/<handle>. Lowercases name_en, replaces every
// non-alphanumeric run with a single dash, trims leading/trailing dashes.
function slugify(d) {
  const raw = (d && d.name_en ? d.name_en : ``).toLowerCase().replace(/[^a-z0-9]+/g, `-`).replace(/^-+|-+$/g, ``);
  if (raw) return raw;
  return d && d.id != null ? String(d.id) : ``;
}

// Conservative social-crawler list. Case-insensitive substring match against
// the User-Agent header. WhatsApp shows up as "WhatsApp/<ver>". Googlebot is
// included so search engines can also see the rich card.
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

// Minimal HTML escape for values we drop into <meta content="..."> attributes
// and the <title> tag. Quotes + tag-delimiters only — that's enough for an
// attribute context.
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

  // Direct REST against pet_designs — avoids pulling the supabase-js client
  // into a serverless cold start for a single read. Public anon key only.
  const endpoint = `${url}/rest/v1/pet_designs?select=id,name_he,name_en,name_ru,animal_he,animal_en,animal_ru,tagline_he,tagline_en,tagline_ru,mockup_url,design_url&is_active=eq.true`;
  let rows = [];
  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
    if (!res.ok) return null;
    rows = await res.json();
    if (!Array.isArray(rows)) return null;
  } catch (err) {
    console.error(`pet_designs fetch failed:`, err);
    return null;
  }
  const target = String(handle || ``).toLowerCase();
  return rows.find(d => slugify(d) === target) || null;
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
  // /api/p/[handle] — `handle` from the dynamic route; fall back to the last
  // path segment so a direct call also works in local dev.
  let handle = ``;
  if (req.query && typeof req.query.handle === `string`) {
    handle = req.query.handle;
  } else if (Array.isArray(req.query?.handle)) {
    handle = req.query.handle[0] || ``;
  }
  if (!handle && req.url) {
    const path = req.url.split(`?`)[0];
    const segments = path.split(`/`).filter(Boolean);
    handle = segments[segments.length - 1] || ``;
  }
  handle = String(handle || ``).toLowerCase();

  const ua = req.headers && (req.headers[`user-agent`] || req.headers[`User-Agent`]);
  const crawler = isCrawler(ua);

  if (!handle) {
    res.statusCode = 302;
    res.setHeader(`Location`, `/`);
    res.end();
    return;
  }

  const design = await lookupDesign(handle);

  if (!design) {
    // Unknown handle — bounce to home so the user lands somewhere sensible.
    res.statusCode = 302;
    res.setHeader(`Location`, `/`);
    res.end();
    return;
  }

  if (!crawler) {
    // Real browser — send them to the SPA hash route that opens the modal.
    res.statusCode = 302;
    res.setHeader(`Location`, `/#pets/${encodeURIComponent(handle)}`);
    res.end();
    return;
  }

  // Crawler — serve the per-product preview HTML.
  const html = buildCrawlerHtml(design, handle);
  res.statusCode = 200;
  res.setHeader(`Content-Type`, `text/html; charset=utf-8`);
  // Short edge cache; OG previews are scraped once and re-fetched rarely, but
  // we don't want stale cards if Gleb edits a row.
  res.setHeader(`Cache-Control`, `public, s-maxage=300, stale-while-revalidate=600`);
  res.end(html);
};
