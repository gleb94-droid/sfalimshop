// generate-sitemap — dynamic XML sitemap of published blog posts + all active
// BLOOM breed pages (+ key static routes). Preferred over the static
// public/sitemap.xml because that file goes stale as posts/breeds change.
// Published posts and active breeds are public per RLS, so the anon key is enough.
//
// Deploy:  supabase functions deploy generate-sitemap --no-verify-jwt
// Public URL once deployed:
//   https://ubvgrxlxtelulwjtfudd.supabase.co/functions/v1/generate-sitemap
// Point robots.txt's Sitemap: line at that URL.
//
// URLs are REAL crawlable paths (no #fragments): breeds at /breed/<slug> and
// posts at /blog/<slug> are served as per-entity HTML to crawlers by api/og.js
// (which 302s humans into the SPA hash route). Mirrors public/sitemap.xml.
//
// While MAINTENANCE_MODE keeps the site noindex/nofollow, crawlers won't index
// anything yet — this is ready for launch.
// MIRROR ONLY: edit committed for repo↔prod parity; redeploy at launch.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://www.sfalimshop.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const xmlEscape = (s: string) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(supabaseUrl, anonKey);

  const { data: posts, error } = await supabase
    .from("blog_posts")
    .select("slug, updated_at, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    return new Response(`<!-- sitemap error: ${xmlEscape(error.message)} -->`, {
      status: 500,
      headers: { ...cors, "Content-Type": "application/xml; charset=utf-8" },
    });
  }

  // All active BLOOM breed pages (#/breed/<slug>). A bad fetch here is non-fatal:
  // breeds is null and the sitemap still serves posts + static routes.
  const { data: breeds } = await supabase
    .from("pet_designs")
    .select("slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const staticUrls = [
    { loc: `${SITE}/`, priority: "1.0" },
    { loc: `${SITE}/mugs`, priority: "0.8" },
    { loc: `${SITE}/pets`, priority: "0.9" },
    { loc: `${SITE}/about`, priority: "0.6" },
    { loc: `${SITE}/blog`, priority: "0.7" },
    { loc: `${SITE}/quiz`, priority: "0.6" },
    { loc: `${SITE}/faq`, priority: "0.4" },
    { loc: `${SITE}/privacy`, priority: "0.3" },
    { loc: `${SITE}/terms`, priority: "0.3" },
    { loc: `${SITE}/refunds`, priority: "0.3" },
    { loc: `${SITE}/shipping`, priority: "0.3" },
    { loc: `${SITE}/accessibility`, priority: "0.2" },
  ];

  const urlTag = (loc: string, lastmod: string | null, priority: string) =>
    `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n${lastmod ? `    <lastmod>${xmlEscape(lastmod)}</lastmod>\n` : ""}    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

  const entries: string[] = [];
  for (const u of staticUrls) entries.push(urlTag(u.loc, null, u.priority));
  for (const b of breeds ?? []) {
    entries.push(urlTag(`${SITE}/breed/${b.slug}`, null, "0.7"));
  }
  for (const p of posts ?? []) {
    const lastmod = (p.updated_at || p.published_at || "").slice(0, 10) || null;
    entries.push(urlTag(`${SITE}/blog/${p.slug}`, lastmod, "0.6"));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: {
      ...cors,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
