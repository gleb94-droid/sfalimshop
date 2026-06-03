// =============================================================================
// /api/pay-return — post-payment return handler (statically-named Vercel
// Serverless Function, same runtime/style as api/og.js).
// -----------------------------------------------------------------------------
// Tranzila returns the customer's BROWSER to the success/fail URL via POST.
// Vercel's static SPA hosting rejects a POST to a hash route with HTTP 405
// ("This page isn't working") — even though the payment itself succeeded and
// the webhook already marked the order paid. This tiny function accepts ANY
// method (GET + POST) and 302-redirects the browser to the SPA hash route, so
// the customer's browser does a clean GET and lands on the thank-you / retry
// screen instead of a 405.
//
//   success → 302 /#track?order_group=<enc>&paid=1
//   fail    → 302 /#order?paid=0
//
// No external deps. Public, no secrets. The webhook (notify_url) remains the
// source of truth for payment_status; this only routes the browser.
// =============================================================================

// Query values can arrive as a string or (rarely) a string[]; normalise to one.
const firstStr = (v) => Array.isArray(v) ? (v[0] || ``) : (typeof v === `string` ? v : ``);

module.exports = async function handler(req, res) {
  const q = (req && req.query) || {};
  const paid = firstStr(q.paid);
  // Sanitize order_group: cap length, then URL-encode for safe interpolation.
  const orderGroup = encodeURIComponent(firstStr(q.order_group).slice(0, 200));

  const target = paid === `0`
    ? `/#order?paid=0`
    : `/#track?order_group=${orderGroup}&paid=1`;

  console.log(`[pay-return] method=${req && req.method} paid=${paid} order_group=${orderGroup ? `set` : `none`} -> ${target}`);

  res.statusCode = 302;
  res.setHeader(`Location`, target);
  res.setHeader(`Cache-Control`, `private, no-store`);
  res.end();
};
