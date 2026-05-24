import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(PUBLIC, 'exports');

fs.mkdirSync(OUT, { recursive: true });

const FONTS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,400;1,700;1,900&family=Heebo:wght@400;500;700&display=swap" rel="stylesheet">
`;

const targets = [
  { svg: 'logo.svg',         out: 'logo.png',                w: 1600, h: 480  },
  { svg: 'logo.svg',         out: 'logo@2x.png',             w: 2400, h: 720  },
  { svg: 'logo-stacked.svg', out: 'logo-stacked.png',        w: 1200, h: 1200 },
  { svg: 'logo-stacked.svg', out: 'logo-instagram-1080.png', w: 1080, h: 1080 },
  { svg: 'logo-mark.svg',    out: 'logo-mark.png',           w: 1080, h: 1080 },
  { svg: 'logo-mark.svg',    out: 'logo-mark-500.png',       w: 500,  h: 500  },
  { svg: 'favicon.svg',      out: 'favicon-512.png',         w: 512,  h: 512  },
  { svg: 'favicon.svg',      out: 'favicon-180.png',         w: 180,  h: 180  },
  { svg: 'favicon.svg',      out: 'favicon-32.png',          w: 32,   h: 32   },
  { svg: 'favicon.svg',      out: 'favicon-16.png',          w: 16,   h: 16   },
  { svg: 'logo-stacked.svg', out: 'og-image.png',            w: 1200, h: 630,  wrap: true },
];

const wrapHTML = (svg, wrap) => wrap
  ? `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>html,body{margin:0;padding:0;background:#0f0f0f;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden}svg{height:88%;width:auto;max-width:88%}</style></head><body>${svg}</body></html>`
  : `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}svg{width:100%;height:100%;display:block}</style></head><body>${svg}</body></html>`;

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  console.log(`Rendering ${targets.length} PNG exports...\n`);

  for (const t of targets) {
    const page = await browser.newPage();
    await page.setViewport({ width: t.w, height: t.h, deviceScaleFactor: 1 });

    const svg = fs.readFileSync(path.join(PUBLIC, t.svg), 'utf-8');
    await page.setContent(wrapHTML(svg, t.wrap), { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 250));

    await page.screenshot({
      path: path.join(OUT, t.out),
      type: 'png',
      clip: { x: 0, y: 0, width: t.w, height: t.h },
    });

    console.log(`  ✓ ${t.out.padEnd(28)} ${t.w}×${t.h}`);
    await page.close();
  }

  await browser.close();
  console.log(`\nDone — ${targets.length} files saved to public/exports/`);
}

run().catch(err => { console.error('Export failed:', err); process.exit(1); });
