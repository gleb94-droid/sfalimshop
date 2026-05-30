// Throwaway preview generator for the restyled waitlist-welcome email.
// Mirrors renderEmail() from supabase/functions/waitlist-welcome/index.ts.
import { writeFileSync } from "node:fs";

const ORANGE = `#FF6B35`, DARK = `#0f0f0f`, PAGE = `#f5f3ef`;
const SITE_URL = `https://www.sfalimshop.com`;
const INSTAGRAM = `https://www.instagram.com/sfalimshop/`;

const COPY = {
  he: {
    subject: `אתם במשפחת BLOOM 🐾`, dir: `rtl`,
    preheader: `נשמור לכם גישה מוקדמת — נעדכן ברגע שהדלתות נפתחות.`,
    eyebrow: `— הצטרפתם בהצלחה —`,
    heading: `ברוכים הבאים למשפחת BLOOM 🐾`,
    body1: `תודה שהצטרפתם! אתם ברשימה — וזה אומר גישה מוקדמת לקולקציית BLOOM: דיוקנאות כלבים וחתולים על חולצות, ספלים ומדבקות.`,
    body2: `אנחנו עוד מלטשים את הפרטים האחרונים. ברגע שהחנות נפתחת — אתם תהיו מהראשונים לדעת, לפני כולם.`,
    cta: `עקבו אחרינו באינסטגרם`, signoff: `נתראה בקרוב,\nצוות ספלים שופ`,
    footerNote: `קיבלתם את המייל הזה כי נרשמתם לרשימת ההמתנה של ספלים שופ.`,
  },
  en: {
    subject: `You're in the BLOOM Family 🐾`, dir: `ltr`,
    preheader: `Your early access is reserved — we'll ping you the moment doors open.`,
    eyebrow: `— You're on the list —`,
    heading: `Welcome to the BLOOM Family 🐾`,
    body1: `Thanks for joining! You're on the list — which means early access to the BLOOM collection: dog & cat portraits on tees, mugs and stickers.`,
    body2: `We're polishing the last details. The moment the shop opens, you'll be among the first to know — before everyone else.`,
    cta: `Follow us on Instagram`, signoff: `See you soon,\nThe Sfalim Shop team`,
    footerNote: `You received this email because you joined the Sfalim Shop waitlist.`,
  },
};

const renderEmail = (lang) => {
  const c = COPY[lang];
  const signoffHtml = c.signoff.split(`\n`).join(`<br>`);
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${c.dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.subject}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500&display=swap" rel="stylesheet">
<style>@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};font-family:'Heebo','Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;direction:${c.dir};color:#1a1a1a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${c.preheader}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:${PAGE};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,0.1);overflow:hidden;">

<tr><td style="background:${DARK};padding:56px 32px 48px;text-align:center;">
<h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:46px;font-weight:700;color:#ffffff;letter-spacing:0.5px;line-height:1.1;">Sfalim Shop</h1>
<div style="width:56px;height:3px;background:${ORANGE};margin:18px auto 14px;border-radius:2px;"></div>
<p style="margin:0;font-family:'Heebo',sans-serif;color:${ORANGE};font-size:13px;font-weight:500;letter-spacing:3px;text-transform:uppercase;">ספלים שופ</p>
</td></tr>

<tr><td style="padding:48px 40px 8px;background:#ffffff;text-align:center;" dir="${c.dir}">
<p style="margin:0 0 10px;font-family:'Playfair Display',Georgia,serif;font-size:15px;color:${ORANGE};font-style:italic;letter-spacing:1px;">${c.eyebrow}</p>
<h2 style="margin:0;font-family:'Heebo',sans-serif;font-size:28px;color:#1a1a1a;font-weight:700;line-height:1.35;">${c.heading}</h2>
</td></tr>

<tr><td style="padding:20px 44px 8px;background:#ffffff;text-align:center;" dir="${c.dir}">
<p style="margin:0 0 16px;font-family:'Heebo',sans-serif;color:#5a5a5a;font-size:16px;line-height:1.75;font-weight:400;">${c.body1}</p>
<p style="margin:0;font-family:'Heebo',sans-serif;color:#5a5a5a;font-size:16px;line-height:1.75;font-weight:400;">${c.body2}</p>
</td></tr>

<tr><td style="padding:28px 40px 8px;background:#ffffff;text-align:center;">
<a href="${INSTAGRAM}" style="display:inline-block;background:${ORANGE};color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:50px;font-family:'Heebo',sans-serif;font-weight:600;font-size:15px;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(255,107,53,0.4);">
${c.cta} →
</a>
</td></tr>

<tr><td style="padding:28px 40px 44px;background:#ffffff;text-align:center;" dir="${c.dir}">
<p style="margin:0;font-family:'Heebo',sans-serif;color:#5a5a5a;font-size:15px;line-height:1.7;">${signoffHtml}</p>
</td></tr>

<tr><td style="background:${DARK};padding:32px 40px;">
<p style="margin:0 0 12px;font-family:'Playfair Display',Georgia,serif;font-size:18px;color:#ffffff;text-align:center;font-weight:500;letter-spacing:0.5px;">Sfalim Shop</p>
<div style="width:32px;height:2px;background:${ORANGE};margin:0 auto 16px;border-radius:2px;"></div>
<p style="margin:0 0 14px;font-family:'Heebo',sans-serif;color:#888;font-size:12px;text-align:center;line-height:1.8;font-weight:300;">
<a href="${SITE_URL}" style="color:${ORANGE};text-decoration:none;">sfalimshop.com</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="mailto:hello@sfalimshop.com" style="color:#bbb;text-decoration:none;">hello@sfalimshop.com</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="${INSTAGRAM}" style="color:#bbb;text-decoration:none;">@sfalimshop</a>
</p>
<p style="margin:0;font-family:'Heebo',sans-serif;color:#666;font-size:11px;text-align:center;line-height:1.6;font-weight:300;">${c.footerNote}</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
};

writeFileSync(`scripts/_preview-waitlist-he.html`, renderEmail(`he`));
writeFileSync(`scripts/_preview-waitlist-en.html`, renderEmail(`en`));
console.log(`wrote he + en previews`);
